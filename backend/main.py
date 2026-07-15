import os
import json
import time
import asyncio
from contextlib import asynccontextmanager
from typing import Dict, Set

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request, HTTPException, Depends
from fastapi.responses import FileResponse, JSONResponse
import uvicorn

from database import read_db, update_db, hash_password, verify_password
from system_monitor import get_system_stats, get_active_ports
from executor import ScriptExecutor


background_tasks: Set[asyncio.Task] = set()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    task = asyncio.create_task(stats_broadcast_loop())
    background_tasks.add(task)
    task.add_done_callback(background_tasks.discard)
    start_schedulers()
    yield
    for t in list(background_tasks) + list(active_tasks.values()):
        t.cancel()


app = FastAPI(title="ServManager", lifespan=lifespan)

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

    def subscribe_stats(self, websocket: WebSocket):
        self.stats_subscribers.add(websocket)

    def unsubscribe_stats(self, websocket: WebSocket):
        self.stats_subscribers.discard(websocket)

    def subscribe_log(self, websocket: WebSocket, run_id: str):
        self.log_subscribers.setdefault(run_id, set()).add(websocket)

    async def _send_to(self, conns, payload: str):
        dead = []
        for conn in list(conns):
            try:
                await conn.send_text(payload)
            except Exception:
                dead.append(conn)
        for conn in dead:
            self.disconnect(conn)

    async def broadcast(self, message: dict):
        await self._send_to(self.active_connections, json.dumps(message))

    async def broadcast_stats(self, stats_data: dict):
        await self._send_to(self.stats_subscribers, json.dumps({"type": "stats", "data": stats_data}))

    async def broadcast_log(self, run_id: str, log_text: str):
        if run_id not in self.log_subscribers:
            return
        payload = json.dumps({"type": "log", "runId": run_id, "text": log_text})
        await self._send_to(self.log_subscribers[run_id], payload)


manager = ConnectionManager()

# ─────────────────────────────────────────────────────────
# Authentication
#
# Two tokens:
#   - admin token (settings.secretToken): full access, returned by
#     username/password login.
#   - remote token (settings.remoteToken): limited access for the
#     mobile remote, returned by PIN login. It can view stats and
#     scripts and trigger runs, but cannot change anything.
# ─────────────────────────────────────────────────────────

def _request_token(request: Request) -> str:
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        return auth_header.split(" ", 1)[1]
    return ""


def _token_role(token: str) -> str:
    if not token:
        return ""
    settings = read_db().get("settings", {})
    if token == settings.get("secretToken", ""):
        return "admin"
    if token == settings.get("remoteToken", ""):
        return "remote"
    return ""


def require_admin(request: Request):
    if _token_role(_request_token(request)) != "admin":
        raise HTTPException(status_code=401, detail="Unauthorized")


def require_any(request: Request):
    if not _token_role(_request_token(request)):
        raise HTTPException(status_code=401, detail="Unauthorized")


# Simple in-memory login throttling: 5 failures per IP -> 60s lockout.
_login_failures: Dict[str, dict] = {}
_MAX_FAILURES = 5
_LOCKOUT_SECONDS = 60


def _check_lockout(ip: str):
    entry = _login_failures.get(ip)
    if entry and entry["count"] >= _MAX_FAILURES:
        remaining = entry["locked_until"] - time.time()
        if remaining > 0:
            raise HTTPException(
                status_code=429,
                detail=f"Too many failed attempts. Try again in {int(remaining) + 1}s.",
            )
        del _login_failures[ip]


def _record_failure(ip: str):
    entry = _login_failures.setdefault(ip, {"count": 0, "locked_until": 0})
    entry["count"] += 1
    if entry["count"] >= _MAX_FAILURES:
        entry["locked_until"] = time.time() + _LOCKOUT_SECONDS


def _clear_failures(ip: str):
    _login_failures.pop(ip, None)


@app.post("/api/login")
async def api_login(payload: dict, request: Request):
    ip = request.client.host if request.client else "unknown"
    _check_lockout(ip)
    username = payload.get("username") or ""
    password = payload.get("password") or ""
    settings = read_db().get("settings", {})
    if username == settings.get("username", "admin") and verify_password(password, settings.get("password", "")):
        _clear_failures(ip)
        return {"success": True, "token": settings.get("secretToken", ""), "role": "admin"}
    _record_failure(ip)
    raise HTTPException(status_code=401, detail="Invalid username or password")


@app.post("/api/remote/login")
async def api_remote_login(payload: dict, request: Request):
    ip = request.client.host if request.client else "unknown"
    _check_lockout(ip)
    pin = str(payload.get("pin") or "")
    settings = read_db().get("settings", {})
    if pin and pin == str(settings.get("remotePin", "")):
        _clear_failures(ip)
        return {"success": True, "token": settings.get("remoteToken", ""), "role": "remote"}
    _record_failure(ip)
    raise HTTPException(status_code=401, detail="Invalid PIN code")


# ─────────────────────────────────────────────────────────
# Scheduled script runner (scripts with interval > 0)
# ─────────────────────────────────────────────────────────

active_tasks: Dict[str, asyncio.Task] = {}


async def run_scheduled_script(script_id: str, interval_seconds: int):
    while True:
        try:
            db = read_db()
            script = next((s for s in db.get("scripts", []) if s["id"] == script_id), None)
            if not script:
                break

            run_id = f"sched_{script_id}_{int(time.time())}"
            output_log = []
            loop = asyncio.get_event_loop()

            def append_log(text):
                output_log.append(text)
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
                "lastOutput": complete_output[:1000],
            })
        except asyncio.CancelledError:
            break
        except Exception as e:
            print(f"[scheduler] Error running {script_id}: {e}")

        await asyncio.sleep(max(5, interval_seconds))


def start_schedulers():
    for task in list(active_tasks.values()):
        task.cancel()
    active_tasks.clear()

    db = read_db()
    loop = asyncio.get_event_loop()
    for script in db.get("scripts", []):
        if script.get("interval", 0) > 0:
            task = loop.create_task(
                run_scheduled_script(script["id"], script["interval"])
            )
            active_tasks[script["id"]] = task


# ─────────────────────────────────────────────────────────
# REST API — SYSTEM
# ─────────────────────────────────────────────────────────

@app.get("/api/system/stats", dependencies=[Depends(require_any)])
async def api_system_stats():
    return get_system_stats()


@app.get("/api/system/ports", dependencies=[Depends(require_admin)])
async def api_system_ports():
    return get_active_ports()


@app.get("/api/system/info", dependencies=[Depends(require_any)])
async def api_system_info(request: Request):
    db = read_db()
    port = db.get("settings", {}).get("port", 8080)
    host = request.headers.get("x-forwarded-host") or request.headers.get("host") or f"localhost:{port}"
    scheme = "https" if request.headers.get("x-forwarded-proto") == "https" else "http"
    return {
        "remoteUrl": f"{scheme}://{host}/remote",
        "baseUrl": f"{scheme}://{host}",
    }


# ─────────────────────────────────────────────────────────
# REST API — SCRIPTS
# ─────────────────────────────────────────────────────────

@app.get("/api/scripts", dependencies=[Depends(require_any)])
async def api_get_scripts():
    return read_db().get("scripts", [])


@app.post("/api/scripts", dependencies=[Depends(require_admin)])
async def api_save_script(script: dict):
    name = (script.get("name") or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Script name is required")

    try:
        interval = max(0, int(script.get("interval") or 0))
    except (TypeError, ValueError):
        interval = 0
    if 0 < interval < 5:
        interval = 5

    clean = {
        "name": name,
        "description": (script.get("description") or "").strip(),
        "content": script.get("content") or "",
        "interval": interval,
    }
    script_id = script.get("id")

    def updater(db):
        scripts = db.setdefault("scripts", [])
        if script_id:
            existing = next((s for s in scripts if s["id"] == script_id), None)
            if existing:
                existing.update(clean)
                clean["id"] = script_id
                return
        clean["id"] = f"script_{int(time.time() * 1000)}"
        clean.update({"lastRun": None, "lastStatus": None, "lastOutput": None})
        scripts.append(clean)

    update_db(updater)
    start_schedulers()
    return {"success": True, "script": clean}


@app.delete("/api/scripts/{script_id}", dependencies=[Depends(require_admin)])
async def api_delete_script(script_id: str):
    def updater(db):
        db["scripts"] = [s for s in db.get("scripts", []) if s["id"] != script_id]
        if "remote" in db and "widgets" in db["remote"]:
            db["remote"]["widgets"] = [
                w for w in db["remote"]["widgets"] if w.get("scriptId") != script_id
            ]

    update_db(updater)
    if script_id in active_tasks:
        active_tasks[script_id].cancel()
        del active_tasks[script_id]
    return {"success": True}


@app.post("/api/scripts/run", dependencies=[Depends(require_any)])
async def api_run_script(payload: dict):
    script_id = payload.get("id")
    trigger = payload.get("trigger", "manual")

    db = read_db()
    script = next((s for s in db.get("scripts", []) if s["id"] == script_id), None)
    if not script:
        raise HTTPException(status_code=404, detail="Script not found")

    run_id = f"run_{script_id}_{int(time.time() * 1000)}"
    start_time_str = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
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
                "logs": complete_output[:50000],
            })
            data["history"] = data["history"][:100]

        update_db(db_updater)

        await manager.broadcast({
            "type": "script-finished",
            "scriptId": script_id,
            "runId": run_id,
            "status": res["status"],
            "exitCode": res["code"],
        })

    task = asyncio.create_task(run_and_save())
    background_tasks.add(task)
    task.add_done_callback(background_tasks.discard)
    return {"success": True, "runId": run_id}


@app.post("/api/scripts/cancel", dependencies=[Depends(require_any)])
async def api_cancel_script(payload: dict):
    run_id = payload.get("runId")
    killed = executor.kill(run_id)
    return {"success": killed}


# ─────────────────────────────────────────────────────────
# REST API — REMOTE CONFIG
# ─────────────────────────────────────────────────────────

@app.get("/api/remote/config", dependencies=[Depends(require_any)])
async def api_get_remote_config():
    return read_db().get("remote", {"widgets": []})


@app.post("/api/remote/config", dependencies=[Depends(require_admin)])
async def api_save_remote_config(config: dict):
    if "widgets" not in config or not isinstance(config["widgets"], list):
        raise HTTPException(status_code=400, detail="Widgets list is required")

    def updater(db):
        db["remote"] = {"widgets": config["widgets"]}

    update_db(updater)
    await manager.broadcast({"type": "remote-reload"})
    return {"success": True}


# ─────────────────────────────────────────────────────────
# REST API — HISTORY
# ─────────────────────────────────────────────────────────

@app.get("/api/history", dependencies=[Depends(require_admin)])
async def api_get_history():
    return read_db().get("history", [])


@app.delete("/api/history", dependencies=[Depends(require_admin)])
async def api_clear_history():
    def updater(db):
        db["history"] = []
    update_db(updater)
    return {"success": True}


# ─────────────────────────────────────────────────────────
# REST API — SETTINGS
# ─────────────────────────────────────────────────────────

@app.get("/api/settings", dependencies=[Depends(require_admin)])
async def api_get_settings():
    s = read_db().get("settings", {})
    return {
        "port": s.get("port", 8080),
        "username": s.get("username", "admin"),
        "remotePin": s.get("remotePin", ""),
    }


@app.post("/api/settings", dependencies=[Depends(require_admin)])
async def api_save_settings(settings: dict):
    clean = {}

    if "port" in settings:
        try:
            port = int(settings["port"])
        except (TypeError, ValueError):
            raise HTTPException(status_code=400, detail="Port must be a number")
        if not 1 <= port <= 65535:
            raise HTTPException(status_code=400, detail="Port must be between 1 and 65535")
        clean["port"] = port

    if settings.get("username"):
        clean["username"] = str(settings["username"]).strip()

    if settings.get("password"):
        password = str(settings["password"])
        if len(password) < 4:
            raise HTTPException(status_code=400, detail="Password must be at least 4 characters")
        clean["password"] = hash_password(password)

    if settings.get("remotePin"):
        pin = str(settings["remotePin"])
        if not (pin.isdigit() and len(pin) == 4):
            raise HTTPException(status_code=400, detail="PIN must be exactly 4 digits")
        clean["remotePin"] = pin

    def updater(db):
        db.setdefault("settings", {}).update(clean)

    update_db(updater)
    return {
        "success": True,
        "message": "Settings saved. Restart ServManager to apply port changes.",
    }


# ─────────────────────────────────────────────────────────
# REST API — SSH CONNECTIONS
# ─────────────────────────────────────────────────────────

@app.get("/api/ssh/connections", dependencies=[Depends(require_any)])
async def api_get_ssh_connections():
    result = []
    for c in read_db().get("sshConnections", []):
        result.append({
            "id": c["id"],
            "name": c["name"],
            "host": c["host"],
            "port": c.get("port", 22),
            "username": c["username"],
            "hasPassword": bool(c.get("password")),
        })
    return result


@app.post("/api/ssh/connections", dependencies=[Depends(require_admin)])
async def api_save_ssh_connection(conn: dict):
    if not conn.get("host") or not conn.get("username"):
        raise HTTPException(status_code=400, detail="Host and username are required")

    try:
        port = int(conn.get("port") or 22)
    except (TypeError, ValueError):
        port = 22

    clean = {
        "name": (conn.get("name") or conn["host"]).strip(),
        "host": str(conn["host"]).strip(),
        "port": port,
        "username": str(conn["username"]).strip(),
        "password": conn.get("password") or "",
    }
    conn_id = conn.get("id")

    def updater(db):
        conns = db.setdefault("sshConnections", [])
        if conn_id:
            existing = next((c for c in conns if c["id"] == conn_id), None)
            if existing:
                if not clean["password"]:
                    clean["password"] = existing.get("password", "")
                clean["id"] = conn_id
                existing.update(clean)
                return
        clean["id"] = f"ssh_{int(time.time() * 1000)}"
        conns.append(clean)

    update_db(updater)
    return {"success": True}


@app.delete("/api/ssh/connections/{conn_id}", dependencies=[Depends(require_admin)])
async def api_delete_ssh_connection(conn_id: str):
    def updater(db):
        db["sshConnections"] = [c for c in db.get("sshConnections", []) if c["id"] != conn_id]
    update_db(updater)
    return {"success": True}


# ─────────────────────────────────────────────────────────
# WEBSOCKET — MAIN (stats + live script logs)
# ─────────────────────────────────────────────────────────

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    token = websocket.query_params.get("token", "")
    if not _token_role(token):
        await websocket.close(code=1008)
        return

    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            msg = json.loads(data)
            msg_type = msg.get("type")
            if msg_type == "subscribe-stats":
                manager.subscribe_stats(websocket)
            elif msg_type == "unsubscribe-stats":
                manager.unsubscribe_stats(websocket)
            elif msg_type == "subscribe-log" and msg.get("runId"):
                manager.subscribe_log(websocket, msg["runId"])
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        print(f"[ws] Error: {e}")
        manager.disconnect(websocket)


# ─────────────────────────────────────────────────────────
# WEBSOCKET — SSH TERMINAL
# ─────────────────────────────────────────────────────────

@app.websocket("/ws/ssh/{connection_id}")
async def ssh_terminal_ws(websocket: WebSocket, connection_id: str):
    token = websocket.query_params.get("token", "")
    if not _token_role(token):
        await websocket.close(code=1008)
        return

    db = read_db()
    conn = next((c for c in db.get("sshConnections", []) if c["id"] == connection_id), None)
    if not conn:
        await websocket.close(code=1008)
        return

    await websocket.accept()

    try:
        try:
            import asyncssh
        except ImportError:
            await websocket.send_text(json.dumps({
                "type": "error",
                "data": "asyncssh not installed on server. Run: pip install asyncssh\r\n"
            }))
            await websocket.close()
            return

        async with asyncssh.connect(
            conn["host"],
            port=int(conn.get("port", 22)),
            username=conn["username"],
            password=conn.get("password", ""),
            known_hosts=None,
            connect_timeout=15
        ) as ssh_conn:
            async with ssh_conn.create_process(
                term_type='xterm-256color',
                term_size=(80, 24)
            ) as proc:

                async def ws_to_ssh():
                    try:
                        while True:
                            raw = await websocket.receive_text()
                            msg = json.loads(raw)
                            if msg.get("type") == "data":
                                proc.stdin.write(msg["data"])
                            elif msg.get("type") == "resize":
                                proc.change_terminal_size(
                                    int(msg.get("cols", 80)),
                                    int(msg.get("rows", 24))
                                )
                    except Exception:
                        pass

                async def ssh_to_ws():
                    try:
                        async for data in proc.stdout:
                            await websocket.send_text(json.dumps({"type": "data", "data": data}))
                    except Exception:
                        pass

                tasks = [
                    asyncio.create_task(ws_to_ssh()),
                    asyncio.create_task(ssh_to_ws()),
                ]
                _, pending = await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)
                for task in pending:
                    task.cancel()

    except Exception as e:
        try:
            await websocket.send_text(json.dumps({
                "type": "error",
                "data": f"SSH Error: {str(e)}\r\n"
            }))
        except Exception:
            pass
    finally:
        try:
            await websocket.close()
        except Exception:
            pass


# ─────────────────────────────────────────────────────────
# STATS BROADCAST LOOP
# ─────────────────────────────────────────────────────────

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

FRONTEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend", "dist"))


@app.get("/{catchall:path}")
async def serve_frontend(catchall: str):
    if catchall.startswith("api/") or catchall.startswith("ws"):
        return JSONResponse(status_code=404, content={"error": "Not found"})

    # Resolve and confine to the frontend build directory
    file_path = os.path.realpath(os.path.join(FRONTEND_DIR, catchall))
    if file_path.startswith(FRONTEND_DIR + os.sep) and os.path.isfile(file_path):
        return FileResponse(file_path)

    index_path = os.path.join(FRONTEND_DIR, "index.html")
    if os.path.isfile(index_path):
        return FileResponse(index_path)
    return JSONResponse(content={
        "status": "running",
        "message": "ServManager API is ready. Build the React frontend to serve the UI.",
    })


# ─────────────────────────────────────────────────────────
# ENTRY POINT
# ─────────────────────────────────────────────────────────

if __name__ == "__main__":
    db = read_db()
    cfg = db.get("settings", {})
    main_port = cfg.get("port", 8080)

    print("\n==============================================")
    print("  [>] ServManager - Python/FastAPI Backend")
    print(f"  [>] Admin Dashboard : http://localhost:{main_port}/")
    print(f"  [>] Mobile Remote   : http://localhost:{main_port}/remote")
    print("==============================================\n")

    uvicorn.run(app, host="0.0.0.0", port=main_port)
