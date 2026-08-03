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


# ─────────────────────────────────────────────────────────
# Sample scripts
# Shipped with a fresh install and seeded once into existing
# installs (see _migrate). Each has a stable id so the one-time
# seed never duplicates, and deleting one won't resurrect it.
# All are Debian/Ubuntu-oriented and safe to run as-is; the ones
# that only read state exit 0, health/failed-unit checks exit 1
# on a warning so they light up indicators.
# ─────────────────────────────────────────────────────────

SAMPLE_SCRIPTS = [
    {
        "id": "default-health-check",
        "name": "Server Health Check",
        "description": "CPU load, free memory, and root disk usage. Warns when resources run low.",
        "interval": 60,
        "content": r"""#!/bin/bash
echo "=== SERVER HEALTH CHECK ==="
echo "Timestamp: $(date)"

CPU_LOAD=$(top -bn1 | grep "Cpu(s)" | sed "s/.*, *\([0-9.]*\)%* id.*/\1/" | awk '{print 100 - $1}')
echo "CPU Usage: ${CPU_LOAD}%"

RAM_TOTAL=$(free -m | awk '/Mem:/ {print $2}')
RAM_USED=$(free -m | awk '/Mem:/ {print $3}')
RAM_PCT=$(free | awk '/Mem:/ {printf "%.1f", $3/$2 * 100}')
echo "RAM Usage: ${RAM_PCT}% (${RAM_USED}MB / ${RAM_TOTAL}MB)"

DISK_PCT=$(df -h / | awk 'NR==2 {print $5}' | tr -d '%')
DISK_FREE=$(df -h / | awk 'NR==2 {print $4}')
echo "Disk Usage (/): ${DISK_PCT}% (Free: ${DISK_FREE})"

STATUS="OK"
awk "BEGIN{exit !(${CPU_LOAD:-0} > 90)}" && { echo "[WARN] High CPU load"; STATUS="WARN"; }
awk "BEGIN{exit !(${RAM_PCT:-0} > 90)}" && { echo "[WARN] High RAM usage"; STATUS="WARN"; }
[ "${DISK_PCT:-0}" -gt 85 ] && { echo "[WARN] High disk usage"; STATUS="WARN"; }

echo "STATUS: $STATUS"
[ "$STATUS" = "OK" ] && exit 0 || exit 1
""",
    },
    {
        "id": "default-restart-check",
        "name": "Service Status",
        "description": "Active/inactive state of common daemons: SSH, Docker, Nginx.",
        "interval": 0,
        "content": r"""#!/bin/bash
echo "=== SERVICE STATUS ==="
for svc in ssh sshd docker nginx; do
  state=$(systemctl is-active "$svc" 2>/dev/null || echo unknown)
  printf "%-10s %s\n" "$svc:" "$state"
done
exit 0
""",
    },
    {
        "id": "sample-disk-report",
        "name": "Disk Usage Report",
        "description": "Filesystem usage, the largest top-level directories, and inode pressure.",
        "interval": 0,
        "content": r"""#!/bin/bash
echo "=== DISK USAGE REPORT ==="
date
echo
echo "-- Filesystems --"
df -hP | grep -vE '^tmpfs|^udev|^overlay'
echo
echo "-- Largest directories under / (top 8) --"
du -xhd1 / 2>/dev/null | sort -rh | head -9
echo
echo "-- Inode usage (/) --"
df -iP / | awk 'NR==2 {print $5" used ("$3"/"$2")"}'
exit 0
""",
    },
    {
        "id": "sample-top-processes",
        "name": "Top Processes",
        "description": "The 10 heaviest processes by CPU and by memory right now.",
        "interval": 0,
        "content": r"""#!/bin/bash
echo "=== TOP PROCESSES ==="
echo "-- By CPU --"
ps -eo pid,comm,%cpu,%mem --sort=-%cpu | head -11
echo
echo "-- By Memory --"
ps -eo pid,comm,%cpu,%mem --sort=-%mem | head -11
exit 0
""",
    },
    {
        "id": "sample-apt-updates",
        "name": "APT Update Check",
        "description": "Refreshes the package index and lists upgradable packages. Read-only — never installs.",
        "interval": 0,
        "content": r"""#!/bin/bash
echo "=== APT UPDATE CHECK ==="
if ! command -v apt-get >/dev/null 2>&1; then
  echo "apt-get not found (non-Debian system)."; exit 0
fi
apt-get update -qq 2>/dev/null
COUNT=$(apt-get -s upgrade 2>/dev/null | grep -c '^Inst')
echo "Upgradable packages: $COUNT"
if [ "$COUNT" -gt 0 ]; then
  echo
  echo "-- Packages --"
  apt list --upgradable 2>/dev/null | tail -n +2 | head -30
fi
[ -f /var/run/reboot-required ] && { echo; echo "[!] Reboot required."; }
[ "$COUNT" -eq 0 ] && exit 0 || exit 1
""",
    },
    {
        "id": "sample-failed-services",
        "name": "Failed Services & Reboot",
        "description": "Lists any failed systemd units and whether a reboot is pending.",
        "interval": 0,
        "content": r"""#!/bin/bash
echo "=== SYSTEMD FAILED UNITS ==="
FAILED=$(systemctl --failed --no-legend --plain 2>/dev/null | grep -c .)
if [ "$FAILED" -eq 0 ]; then
  echo "No failed units."
else
  systemctl --failed --no-pager
fi
echo
if [ -f /var/run/reboot-required ]; then echo "[!] Reboot required."; else echo "No reboot required."; fi
[ "$FAILED" -eq 0 ] && exit 0 || exit 1
""",
    },
    {
        "id": "sample-docker-overview",
        "name": "Docker Overview",
        "description": "Running containers and Docker's disk footprint. No-ops cleanly if Docker isn't installed.",
        "interval": 0,
        "content": r"""#!/bin/bash
echo "=== DOCKER OVERVIEW ==="
if ! command -v docker >/dev/null 2>&1; then
  echo "Docker not installed."; exit 0
fi
if ! docker info >/dev/null 2>&1; then
  echo "Cannot talk to the Docker daemon (permission or not running)."; exit 1
fi
echo "-- Running containers --"
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Image}}'
echo
echo "-- Disk usage --"
docker system df
exit 0
""",
    },
    {
        "id": "sample-network",
        "name": "Network & Ports",
        "description": "Listening sockets, established connection count, and the public IP.",
        "interval": 0,
        "content": r"""#!/bin/bash
echo "=== NETWORK OVERVIEW ==="
echo "-- Listening ports --"
ss -tulnH 2>/dev/null | awk '{print $1, $5}' | sort -u | head -30
echo
echo "Established connections: $(ss -tnH state established 2>/dev/null | grep -c .)"
echo "Public IP: $(curl -s --max-time 5 https://ifconfig.me || echo unavailable)"
exit 0
""",
    },
]


def _sample_scripts_with_run_state() -> list:
    out = []
    for s in SAMPLE_SCRIPTS:
        out.append({**s, "lastRun": None, "lastStatus": None, "lastOutput": None})
    return out


def default_data() -> dict:
    return {
        "scripts": _sample_scripts_with_run_state(),
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
    # One-time seed of sample scripts into existing installs. Keyed by a
    # settings flag so it runs once; deleting a sample won't bring it back.
    if not settings.get("samplesSeeded"):
        existing_ids = {s.get("id") for s in kept}
        for sample in SAMPLE_SCRIPTS:
            if sample["id"] not in existing_ids:
                kept.append({**sample, "lastRun": None,
                             "lastStatus": None, "lastOutput": None})
        settings["samplesSeeded"] = True
        changed = True

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
