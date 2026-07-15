import os
import json
import hashlib
import secrets
import threading

DATA_FILE = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'data.json'))
db_lock = threading.Lock()


# ─────────────────────────────────────────────────────────
# Password hashing
# Stored format: "sha256$<salt>$<hexdigest>"
# Plaintext values (e.g. written by the CLI helper) are still
# accepted by verify_password and upgraded on next save.
# ─────────────────────────────────────────────────────────

def hash_password(plain: str) -> str:
    salt = secrets.token_hex(8)
    digest = hashlib.sha256((salt + plain).encode('utf-8')).hexdigest()
    return f"sha256${salt}${digest}"


def verify_password(plain: str, stored: str) -> bool:
    if not stored:
        return False
    if stored.startswith("sha256$"):
        try:
            _, salt, digest = stored.split("$", 2)
        except ValueError:
            return False
        candidate = hashlib.sha256((salt + plain).encode('utf-8')).hexdigest()
        return secrets.compare_digest(candidate, digest)
    return secrets.compare_digest(plain, stored)


def default_data() -> dict:
    return {
        "scripts": [
            {
                "id": "default-health-check",
                "name": "Server Health Check",
                "description": "Checks CPU load, free memory, and root disk usage. Warns when resources run low.",
                "content": "#!/bin/bash\necho \"=== SERVER HEALTH CHECK ===\"\necho \"Timestamp: $(date)\"\n\n# CPU Load\nCPU_LOAD=$(top -bn1 | grep \"Cpu(s)\" | sed \"s/.*, *\\([0-9.]*\\)%* id.*/\\1/\" | awk '{print 100 - $1}')\necho \"CPU Usage: $CPU_LOAD%\"\n\n# RAM Usage\nRAM_FREE=$(free -m | awk '/Mem:/ {print $4}')\nRAM_TOTAL=$(free -m | awk '/Mem:/ {print $2}')\nRAM_USAGE_PCT=$(free | awk '/Mem:/ {printf \"%.2f\", $3/$2 * 100}')\necho \"RAM Usage: $RAM_USAGE_PCT% ($((RAM_TOTAL - RAM_FREE))MB / ${RAM_TOTAL}MB)\"\n\n# Disk Space (Root)\nDISK_USAGE_PCT=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')\nDISK_FREE=$(df -h / | awk 'NR==2 {print $4}')\necho \"Disk Usage (Root): $DISK_USAGE_PCT% (Free: $DISK_FREE)\"\n\nSTATUS=\"OK\"\nif [ -n \"$CPU_LOAD\" ] && [ \"$(echo \"$CPU_LOAD > 90\" | bc -l 2>/dev/null)\" = \"1\" ]; then\n  echo \"[WARN] High CPU load: $CPU_LOAD%\"\n  STATUS=\"WARN\"\nfi\nif [ -n \"$RAM_USAGE_PCT\" ] && [ \"$(echo \"$RAM_USAGE_PCT > 90\" | bc -l 2>/dev/null)\" = \"1\" ]; then\n  echo \"[WARN] High RAM usage: $RAM_USAGE_PCT%\"\n  STATUS=\"WARN\"\nfi\nif [ -n \"$DISK_USAGE_PCT\" ] && [ \"$DISK_USAGE_PCT\" -gt 85 ]; then\n  echo \"[WARN] High Disk usage: $DISK_USAGE_PCT%\"\n  STATUS=\"WARN\"\nfi\n\necho \"STATUS: $STATUS\"\nif [ \"$STATUS\" = \"OK\" ]; then\n  exit 0\nelse\n  exit 1\nfi\n",
                "interval": 60,
                "lastRun": None,
                "lastStatus": None,
                "lastOutput": None
            },
            {
                "id": "default-restart-check",
                "name": "Service Status",
                "description": "Shows the status of common daemons: SSH, Docker, and Nginx.",
                "content": "#!/bin/bash\nfor svc in ssh sshd docker nginx; do\n  state=$(systemctl is-active \"$svc\" 2>/dev/null || echo unknown)\n  echo \"$svc: $state\"\ndone\nexit 0\n",
                "interval": 0,
                "lastRun": None,
                "lastStatus": None,
                "lastOutput": None
            }
        ],
        "remote": {
            "widgets": [
                {
                    "id": "widget-1",
                    "title": "CPU",
                    "description": "Average core load",
                    "type": "metric",
                    "metricType": "cpu",
                    "size": "small",
                    "color": "indigo",
                    "icon": "cpu",
                    "position": 0
                },
                {
                    "id": "widget-2",
                    "title": "RAM",
                    "description": "Memory in use",
                    "type": "metric",
                    "metricType": "ram",
                    "size": "small",
                    "color": "violet",
                    "icon": "database",
                    "position": 1
                },
                {
                    "id": "widget-3",
                    "title": "Health",
                    "description": "Server health check",
                    "type": "indicator",
                    "scriptId": "default-health-check",
                    "size": "medium",
                    "color": "emerald",
                    "icon": "heart-rate",
                    "position": 2
                },
                {
                    "id": "widget-4",
                    "title": "Services",
                    "description": "SSH / Docker / Nginx",
                    "type": "button",
                    "scriptId": "default-restart-check",
                    "size": "small",
                    "color": "amber",
                    "icon": "refresh",
                    "position": 3
                }
            ]
        },
        "sshConnections": [],
        "settings": {
            "port": 8080,
            "secretToken": secrets.token_hex(16),
            "remoteToken": secrets.token_hex(16),
            "username": "admin",
            "password": "admin",
            "remotePin": "1234"
        },
        "history": []
    }


def _migrate(data: dict) -> bool:
    """Upgrade older data.json layouts in place. Returns True if changed."""
    changed = False
    settings = data.setdefault("settings", {})
    if not settings.get("secretToken"):
        settings["secretToken"] = secrets.token_hex(16)
        changed = True
    if not settings.get("remoteToken"):
        settings["remoteToken"] = secrets.token_hex(16)
        changed = True

    scripts = data.get("scripts", [])
    kept = []
    for s in scripts:
        # Workflow scripts are no longer supported — drop them.
        if s.get("type") == "workflow":
            changed = True
            continue
        if "type" in s:
            s.pop("type", None)
            changed = True
        if "isButton" in s:
            s.pop("isButton", None)
            changed = True
        if "isIndicator" in s:
            # interval only matters when the script was a scheduled indicator
            if not s.pop("isIndicator"):
                s["interval"] = 0
            changed = True
        s.setdefault("interval", 0)
        kept.append(s)
    if len(kept) != len(scripts):
        ids = {s["id"] for s in kept}
        remote = data.get("remote", {})
        if "widgets" in remote:
            remote["widgets"] = [
                w for w in remote["widgets"]
                if not w.get("scriptId") or w["scriptId"] in ids
            ]
    data["scripts"] = kept
    return changed


def read_db() -> dict:
    with db_lock:
        try:
            if not os.path.exists(DATA_FILE):
                data = default_data()
                write_db_unlocked(data)
                return data
            with open(DATA_FILE, 'r', encoding='utf-8') as f:
                data = json.load(f)
            if _migrate(data):
                write_db_unlocked(data)
            return data
        except Exception as e:
            print(f"Failed to read database, returning defaults: {e}")
            return default_data()


def write_db(data: dict) -> bool:
    with db_lock:
        return write_db_unlocked(data)


def write_db_unlocked(data: dict) -> bool:
    try:
        tmp_file = DATA_FILE + '.tmp'
        with open(tmp_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        os.replace(tmp_file, DATA_FILE)
        try:
            os.chmod(DATA_FILE, 0o600)
        except Exception:
            pass
        return True
    except Exception as e:
        print(f"Failed to write database: {e}")
        return False


def update_db(updater_fn) -> dict:
    with db_lock:
        try:
            if not os.path.exists(DATA_FILE):
                data = default_data()
            else:
                with open(DATA_FILE, 'r', encoding='utf-8') as f:
                    data = json.load(f)
            _migrate(data)
            updater_fn(data)
            write_db_unlocked(data)
            return data
        except Exception as e:
            print(f"Failed to update database: {e}")
            raise e
