import os
import json
import time
import asyncio
import threading
from typing import Dict, Set

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
import uvicorn

from database import read_db, update_db
from system_monitor import get_system_stats, get_active_ports
from executor import ScriptExecutor

app = FastAPI(title="ServManager Admin")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

executor = ScriptExecutor()

# ─────────────────────────────────────────────────────────
# WebSocket Connection Manager
# ─────────────────────────────────────────────────────────

class ConnectionManager:
    def __init__(self):
        self.stats_subscribers: Set[WebSocket] = set()
        self.log_subscribers: Dict[str, Set[WebSocket]] = {}
        self.active_connections: Set[WebSocket] = set()

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.add(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.discard(websocket)
        self.stats_subscribers.discard(websocket)
        for run_id in list(self.log_subscribers.keys()):
            self.log_subscribers[run_id].discard(websocket)
            if not self.log_subscribers[run_id]:
                del self.log_subscribers[run_id]

    async def subscribe_stats(self, websocket: WebSocket):
        self.stats_subscribers.add(websocket)

    def unsubscribe_stats(self, websocket: WebSocket):
        self.stats_subscribers.discard(websocket)

    async def subscribe_log(self, websocket: WebSocket, run_id: str):
        if run_id not in self.log_subscribers:
            self.log_subscribers[run_id] = set()
        self.log_subscribers[run_id].add(websocket)

    async def broadcast(self, message: dict):
        payload = json.dumps(message)
        dead = []
        for conn in list(self.active_connections):
            try:
                await conn.send_text(payload)
            except Exception:
                dead.append(conn)
        for conn in dead:
            self.disconnect(conn)

    async def broadcast_stats(self, stats_data: dict):
        payload = json.dumps({"type": "stats", "data": stats_data})
        dead = []
        for conn in list(self.stats_subscribers):
            try:
                await conn.send_text(payload)
            except Exception:
                dead.append(conn)
        for conn in dead:
            self.disconnect(conn)

    async def broadcast_log(self, run_id: str, log_text: str):
        if run_id not in self.log_subscribers:
            return
        payload = json.dumps({"type": "log", "runId": run_id, "text": log_text})
        dead = []
        for conn in list(self.log_subscribers[run_id]):
            try:
                await conn.send_text(payload)
            except Exception:
                dead.append(conn)
        for conn in dead:
            self.disconnect(conn)


manager = ConnectionManager()

# ─────────────────────────────────────────────────────────
# Token Authorization
# ─────────────────────────────────────────────────────────

def verify_token(request: Request):
    if request.url.path in ["/api/login", "/api/remote/login"]:
        return
    if not request.url.path.startswith("/api/"):
        return
    db = read_db()
    secret_token = db.get("settings", {}).get("secretToken", "")
    if not secret_token:
        return
    token = request.query_params.get("token")
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header.split(" ", 1)[1]
    if token != secret_token:
        raise HTTPException(status_code=401, detail="Unauthorized: Invalid access token")


@app.post("/api/login")
async def api_login(payload: dict):
    username = payload.get("username")
    password = payload.get("password")
    db = read_db()
    settings = db.get("settings", {})
    expected_username = settings.get("username", "admin")
    expected_password = settings.get("password", "admin")
    if username == expected_username and password == expected_password:
        return {"success": True, "token": settings.get("secretToken", "")}
    raise HTTPException(status_code=401, detail="Invalid username or password")


@app.post("/api/remote/login")
async def api_remote_login(payload: dict):
    pin = payload.get("pin")
    db = read_db()
    settings = db.get("settings", {})
    expected_pin = settings.get("remotePin", "1234")
    if str(pin) == str(expected_pin):
        return {"success": True, "token": settings.get("secretToken", "")}
    raise HTTPException(status_code=401, detail="Invalid PIN code")


# ─────────────────────────────────────────────────────────
# Background Indicator Scheduler
# ─────────────────────────────────────────────────────────

active_tasks: Dict[str, asyncio.Task] = {}


async def run_indicator_task(script_id: str, interval_seconds: int):
    while True:
        try:
            db = read_db()
            script = next((s for s in db.get("scripts", []) if s["id"] == script_id), None)
            if not script:
                break

            run_id = f"indicator_{script_id}_{int(time.time())}"
            output_log = []
            loop = asyncio.get_event_loop()

            def append_log(text):
                output_log.append(text)
                # Schedule broadcast without blocking sync callback
                asyncio.run_coroutine_threadsafe(
                    manager.broadcast_log(run_id, text), loop
                )

            res = await executor.run(run_id, script, append_log)
            complete_output = "".join(output_log)
            now_str = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())

            def update_script(data):
                scr = next((s for s in data["scripts"] if s["id"] == script_id), None)
                if scr:
                    scr["lastRun"] = now_str
                    scr["lastStatus"] = res["status"]
                    scr["lastOutput"] = complete_output[:1000]

            update_db(update_script)

            await manager.broadcast({
                "type": "indicator-update",
                "scriptId": script_id,
                "lastStatus": res["status"],
                "lastOutput": complete_output,
            })
        except asyncio.CancelledError:
            break
        except Exception as e:
            print(f"[indicator] Error polling {script_id}: {e}")

        await asyncio.sleep(max(5, interval_seconds))


def start_schedulers():
    for task in list(active_tasks.values()):
        task.cancel()
    active_tasks.clear()

    db = read_db()
    loop = asyncio.get_event_loop()
    for script in db.get("scripts", []):
        if script.get("isIndicator") and script.get("interval", 0) > 0:
            task = loop.create_task(
                run_indicator_task(script["id"], script["interval"])
            )
            active_tasks[script["id"]] = task


# ─────────────────────────────────────────────────────────
# REST API ENDPOINTS
# ─────────────────────────────────────────────────────────

@app.get("/api/system/stats", dependencies=[Depends(verify_token)])
async def api_system_stats():
    return get_system_stats()


@app.get("/api/system/ports", dependencies=[Depends(verify_token)])
async def api_system_ports():
    return get_active_ports()


@app.get("/api/scripts", dependencies=[Depends(verify_token)])
async def api_get_scripts():
    db = read_db()
    return db.get("scripts", [])


@app.post("/api/scripts", dependencies=[Depends(verify_token)])
async def api_save_script(script: dict):
    if not script.get("name"):
        raise HTTPException(status_code=400, detail="Script name is required")

    script_id = script.get("id")

    def updater(db):
        if script_id:
            idx = next((i for i, s in enumerate(db["scripts"]) if s["id"] == script_id), -1)
            if idx != -1:
                db["scripts"][idx].update(script)
            else:
                db["scripts"].append(script)
        else:
            script["id"] = f"script_{int(time.time() * 1000)}"
            script.setdefault("lastRun", None)
            script.setdefault("lastStatus", None)
            script.setdefault("lastOutput", None)
            db["scripts"].append(script)

    update_db(updater)
    start_schedulers()
    return {"success": True, "script": script}


@app.delete("/api/scripts/{script_id}", dependencies=[Depends(verify_token)])
async def api_delete_script(script_id: str):
    def updater(db):
        db["scripts"] = [s for s in db["scripts"] if s["id"] != script_id]
        if "remote" in db and "widgets" in db["remote"]:
            db["remote"]["widgets"] = [
                w for w in db["remote"]["widgets"] if w.get("scriptId") != script_id
            ]

    update_db(updater)
    if script_id in active_tasks:
        active_tasks[script_id].cancel()
        del active_tasks[script_id]
    return {"success": True}


@app.post("/api/scripts/run", dependencies=[Depends(verify_token)])
async def api_run_script(payload: dict):
    script_id = payload.get("id")
    trigger = payload.get("trigger", "manual")

    db = read_db()
    script = next((s for s in db.get("scripts", []) if s["id"] == script_id), None)
    if not script:
        raise HTTPException(status_code=404, detail="Script not found")

    run_id = f"run_{int(time.time() * 1000)}"
    loop = asyncio.get_event_loop()

    async def run_and_save():
        output_log = []

        def on_log(text):
            output_log.append(text)
            asyncio.run_coroutine_threadsafe(
                manager.broadcast_log(run_id, text), loop
            )

        res = await executor.run(run_id, script, on_log)
        complete_output = "".join(output_log)
        end_time_str = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())

        try:
            ts_ms = int(run_id.split("_")[1])
            start_time_str = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime(ts_ms / 1000))
        except Exception:
            start_time_str = end_time_str

        def db_updater(data):
            scr = next((s for s in data["scripts"] if s["id"] == script_id), None)
            if scr:
                scr["lastRun"] = end_time_str
                scr["lastStatus"] = res["status"]
                scr["lastOutput"] = complete_output[:1000] + (
                    "\n[Truncated]" if len(complete_output) > 1000 else ""
                )
            data.setdefault("history", []).insert(0, {
                "id": run_id,
                "scriptId": script_id,
                "scriptName": script["name"],
                "trigger": trigger,
                "startTime": start_time_str,
                "endTime": end_time_str,
                "status": res["status"],
                "exitCode": res["code"],
                "logs": complete_output,
            })
            data["history"] = data["history"][:50]

        update_db(db_updater)

        await manager.broadcast({
            "type": "script-finished",
            "scriptId": script_id,
            "runId": run_id,
            "status": res["status"],
            "exitCode": res["code"],
        })

    asyncio.create_task(run_and_save())
    return {"success": True, "runId": run_id}


@app.post("/api/scripts/cancel", dependencies=[Depends(verify_token)])
async def api_cancel_script(payload: dict):
    run_id = payload.get("runId")
    killed = executor.kill(run_id)
    return {"success": killed}


@app.get("/api/remote/config", dependencies=[Depends(verify_token)])
async def api_get_remote_config():
    db = read_db()
    return db.get("remote", {"widgets": []})


@app.post("/api/remote/config", dependencies=[Depends(verify_token)])
async def api_save_remote_config(config: dict):
    if "widgets" not in config:
        raise HTTPException(status_code=400, detail="Widgets list is required")

    def updater(db):
        db["remote"] = config

    update_db(updater)
    await manager.broadcast({"type": "remote-reload"})
    return {"success": True}


@app.get("/api/history", dependencies=[Depends(verify_token)])
async def api_get_history():
    db = read_db()
    return db.get("history", [])


@app.delete("/api/history", dependencies=[Depends(verify_token)])
async def api_clear_history():
    def updater(db):
        db["history"] = []
    update_db(updater)
    return {"success": True}


@app.get("/api/settings", dependencies=[Depends(verify_token)])
async def api_get_settings():
    db = read_db()
    s = db.get("settings", {})
    return {
        "port": s.get("port", 8080),
        "separatePorts": s.get("separatePorts", False),
        "remotePort": s.get("remotePort", 8081),
        "secretToken": s.get("secretToken", ""),
        "username": s.get("username", "admin"),
        "password": s.get("password", "admin"),
        "remotePin": s.get("remotePin", "1234"),
    }


@app.post("/api/settings", dependencies=[Depends(verify_token)])
async def api_save_settings(settings: dict):
    def updater(db):
        db.setdefault("settings", {}).update(settings)
    update_db(updater)
    return {
        "success": True,
        "message": "Settings saved. Restart ServManager to apply port changes.",
    }


# ─────────────────────────────────────────────────────────
# WEBSOCKET ENDPOINT
# ─────────────────────────────────────────────────────────

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            msg = json.loads(data)
            msg_type = msg.get("type")
            if msg_type == "subscribe-stats":
                await manager.subscribe_stats(websocket)
            elif msg_type == "unsubscribe-stats":
                manager.unsubscribe_stats(websocket)
            elif msg_type == "subscribe-log" and msg.get("runId"):
                await manager.subscribe_log(websocket, msg["runId"])
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        print(f"[ws] Error: {e}")
        manager.disconnect(websocket)


# Broadcasts live stats every 2 s to all subscribed clients
async def stats_broadcast_loop():
    while True:
        if manager.stats_subscribers:
            try:
                stats = get_system_stats()
                await manager.broadcast_stats(stats)
            except Exception as e:
                print(f"[stats] Error: {e}")
        await asyncio.sleep(2)


# ─────────────────────────────────────────────────────────
# SERVE REACT FRONTEND
# ─────────────────────────────────────────────────────────

FRONTEND_DIR = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")


@app.on_event("startup")
async def startup_event():
    asyncio.create_task(stats_broadcast_loop())
    start_schedulers()


@app.get("/{catchall:path}")
async def serve_frontend(catchall: str, request: Request):
    if catchall.startswith("api/") or catchall.startswith("ws"):
        return JSONResponse(status_code=404, content={"error": "Not found"})
    file_path = os.path.join(FRONTEND_DIR, catchall)
    if os.path.isfile(file_path):
        return FileResponse(file_path)
    index_path = os.path.join(FRONTEND_DIR, "index.html")
    if os.path.isfile(index_path):
        return FileResponse(index_path)
    return JSONResponse(content={
        "status": "running",
        "message": "ServManager API is ready. Build the React frontend to serve the UI.",
    })


# ─────────────────────────────────────────────────────────
# DUAL-PORT: DEDICATED REMOTE PANEL
# ─────────────────────────────────────────────────────────

def start_remote_only_server(port: int):
    """Run a minimal ASGI app on a separate port that forwards to the main app."""
    remote_app = FastAPI(title="ServManager Remote Panel")
    remote_app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @remote_app.api_route("/api/{path:path}", methods=["GET", "POST", "PUT", "DELETE"])
    async def api_proxy(request: Request, path: str):
        return await app(request.scope, request.receive, request._send)

    @remote_app.websocket("/ws")
    async def ws_proxy(websocket: WebSocket):
        await websocket_endpoint(websocket)

    @remote_app.get("/{catchall:path}")
    async def serve_remote_ui(catchall: str):
        file_path = os.path.join(FRONTEND_DIR, catchall)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        index_path = os.path.join(FRONTEND_DIR, "index.html")
        if os.path.isfile(index_path):
            return FileResponse(index_path)
        return JSONResponse(content={"message": "Remote UI compiling…"})

    uvicorn.run(remote_app, host="0.0.0.0", port=port, log_level="warning")


# ─────────────────────────────────────────────────────────
# ENTRY POINT
# ─────────────────────────────────────────────────────────

if __name__ == "__main__":
    db = read_db()
    cfg = db.get("settings", {})
    main_port = cfg.get("port", 8080)
    is_separate = cfg.get("separatePorts", False)
    remote_port = cfg.get("remotePort", 8081)

    print("\n==============================================")
    print("  [>] ServManager - Python/FastAPI Backend")
    print(f"  [>] Admin Dashboard : http://localhost:{main_port}/")
    if is_separate:
        print(f"  [>] Remote Panel    : http://localhost:{remote_port}/")
        threading.Thread(
            target=start_remote_only_server, args=(remote_port,), daemon=True
        ).start()
    print("==============================================\n")

    uvicorn.run(app, host="0.0.0.0", port=main_port)
