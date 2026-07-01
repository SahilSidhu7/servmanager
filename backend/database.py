import os
import json
import secrets
import threading

DATA_FILE = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'data.json'))
db_lock = threading.Lock()

DEFAULT_DATA = {
    "scripts": [
        {
            "id": "default-health-check",
            "name": "Server Health Diagnostics",
            "description": "Checks CPU load, free memory, and root disk usage. Signals warning if resources are critically low.",
            "type": "shell",
            "content": "#!/bin/bash\necho \"=== SERVER HEALTH CHECK ===\"\necho \"Timestamp: $(date)\"\n\n# CPU Load\nCPU_LOAD=$(top -bn1 | grep \"Cpu(s)\" | sed \"s/.*, *\\([0-9.]*\\)%* id.*/\\1/\" | awk '{print 100 - $1}')\necho \"CPU Usage: $CPU_LOAD%\"\n\n# RAM Usage\nRAM_FREE=$(free -m | awk '/Mem:/ {print $4}')\nRAM_TOTAL=$(free -m | awk '/Mem:/ {print $2}')\nRAM_USAGE_PCT=$(free | awk '/Mem:/ {printf \"%.2f\", $3/$2 * 100}')\necho \"RAM Usage: $RAM_USAGE_PCT% ($((RAM_TOTAL - RAM_FREE))MB / ${RAM_TOTAL}MB)\"\n\n# Disk Space (Root)\nDISK_USAGE_PCT=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')\nDISK_FREE=$(df -h / | awk 'NR==2 {print $4}')\necho \"Disk Usage (Root): $DISK_USAGE_PCT% (Free: $DISK_FREE)\"\n\nSTATUS=\"OK\"\nif [ -n \"$CPU_LOAD\" ] && [ \"$(echo \"$CPU_LOAD > 90\" | bc -l 2>/dev/null)\" = \"1\" ]; then\n  echo \"[WARN] High CPU load: $CPU_LOAD%\"\n  STATUS=\"WARN\"\nfi\nif [ -n \"$RAM_USAGE_PCT\" ] && [ \"$(echo \"$RAM_USAGE_PCT > 90\" | bc -l 2>/dev/null)\" = \"1\" ]; then\n  echo \"[WARN] High RAM usage: $RAM_USAGE_PCT%\"\n  STATUS=\"WARN\"\nfi\nif [ -n \"$DISK_USAGE_PCT\" ] && [ \"$DISK_USAGE_PCT\" -gt 85 ]; then\n  echo \"[WARN] High Disk usage: $DISK_USAGE_PCT%\"\n  STATUS=\"WARN\"\nfi\n\necho \"STATUS: $STATUS\"\nif [ \"$STATUS\" = \"OK\" ]; then\n  exit 0\nelse\n  exit 1\nfi\n",
            "isIndicator": True,
            "isButton": False,
            "interval": 10,
            "lastRun": None,
            "lastStatus": None,
            "lastOutput": None
        },
        {
            "id": "default-ports-scanner",
            "name": "Serving Ports Scanner",
            "description": "Lists all open TCP and UDP listening ports and maps them to running processes.",
            "type": "shell",
            "content": "#!/bin/bash\necho \"=== ACTIVE LISTENING PORTS ===\"\necho \"Scanning for listening sockets...\"\necho \"\"\n\nif command -v ss >/dev/null 2>&1; then\n  ss -tuln\nelse\n  netstat -tuln\nfi\n\necho \"\"\necho \"Scan complete.\"\n",
            "isIndicator": False,
            "isButton": True,
            "interval": 30,
            "lastRun": None,
            "lastStatus": None,
            "lastOutput": None
        },
        {
            "id": "default-services-monitor",
            "name": "Critical Services Health",
            "description": "Checks status of common server daemons: Nginx, SSH, Docker, and MySQL.",
            "type": "workflow",
            "workflow": {
                "steps": [
                    {
                        "id": "step-1",
                        "type": "command",
                        "name": "Check SSH Daemon",
                        "config": {"command": "systemctl is-active ssh || systemctl is-active sshd || echo \"inactive\""}
                    },
                    {
                        "id": "step-2",
                        "type": "command",
                        "name": "Check Docker Daemon",
                        "config": {"command": "systemctl is-active docker || echo \"inactive\""}
                    },
                    {
                        "id": "step-3",
                        "type": "command",
                        "name": "Check Nginx Service",
                        "config": {"command": "systemctl is-active nginx || echo \"inactive\""}
                    }
                ]
            },
            "isIndicator": True,
            "isButton": True,
            "interval": 20,
            "lastRun": None,
            "lastStatus": None,
            "lastOutput": None
        }
    ],
    "remote": {
        "widgets": [
            {
                "id": "widget-1",
                "title": "CPU Usage",
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
                "title": "RAM Usage",
                "description": "Memory consumption",
                "type": "metric",
                "metricType": "ram",
                "size": "small",
                "color": "violet",
                "icon": "database",
                "position": 1
            },
            {
                "id": "widget-3",
                "title": "Server Diagnostics",
                "description": "Health check status",
                "type": "indicator",
                "scriptId": "default-health-check",
                "size": "medium",
                "color": "emerald",
                "icon": "heart-rate",
                "position": 2
            },
            {
                "id": "widget-4",
                "title": "Scan Server Ports",
                "description": "List listening ports",
                "type": "button",
                "scriptId": "default-ports-scanner",
                "size": "small",
                "color": "amber",
                "icon": "terminal",
                "position": 3
            },
            {
                "id": "widget-5",
                "title": "Services Checker",
                "description": "Check running daemons",
                "type": "button",
                "scriptId": "default-services-monitor",
                "size": "small",
                "color": "indigo",
                "icon": "refresh",
                "position": 4
            }
        ]
    },
    "sshConnections": [],
    "settings": {
        "port": 8080,
        "secretToken": secrets.token_hex(16),
        "username": "admin",
        "password": "admin",
        "remotePin": "1234"
    },
    "history": []
}

def read_db() -> dict:
    with db_lock:
        try:
            if not os.path.exists(DATA_FILE):
                write_db_unlocked(DEFAULT_DATA)
                return DEFAULT_DATA
            with open(DATA_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            print(f"Failed to read database, returning defaults: {e}")
            return DEFAULT_DATA

def write_db(data: dict) -> bool:
    with db_lock:
        return write_db_unlocked(data)

def write_db_unlocked(data: dict) -> bool:
    try:
        with open(DATA_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        return True
    except Exception as e:
        print(f"Failed to write database: {e}")
        return False

def update_db(updater_fn) -> dict:
    with db_lock:
        try:
            if not os.path.exists(DATA_FILE):
                data = DEFAULT_DATA
            else:
                with open(DATA_FILE, 'r', encoding='utf-8') as f:
                    data = json.load(f)

            updater_fn(data)
            write_db_unlocked(data)
            return data
        except Exception as e:
            print(f"Failed to update database: {e}")
            raise e
