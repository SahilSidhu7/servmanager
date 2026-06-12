#!/bin/bash
# ============================================================
# ServManager Automated Installer – Python/FastAPI + React
# Compatible with Debian/Ubuntu Linux systems
#
# Usage:
#   From source: sudo ./install.sh
#   One-liner:   curl -sSL https://raw.githubusercontent.com/sahilsidhu7/servmanager/main/install.sh | sudo bash
# ============================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo ""
echo -e "${BLUE}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║         ServManager – Automated Installer        ║${NC}"
echo -e "${BLUE}║         Python FastAPI + React Dashboard         ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════╝${NC}"
echo ""

# 1. Root check
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}[ERROR] Please run this installer as root or with sudo.${NC}"
  exit 1
fi

INSTALL_DIR="/opt/servmanager"
VENV_DIR="$INSTALL_DIR/venv"
SERVICE_FILE="/etc/systemd/system/servmanager.service"
CLI_SCRIPT="/opt/servmanager/servmanager-cli.sh"
CLI_LINK="/usr/local/bin/servmanager"
GITHUB_REPO="sahilsidhu7/servmanager"

# ─────────────────────────────────────────────────────────────
# Detect source: local checkout or remote one-liner install
# ─────────────────────────────────────────────────────────────
SRC_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" 2>/dev/null || echo /tmp )" && pwd )"

if [ ! -f "$SRC_DIR/backend/main.py" ]; then
  echo -e "${CYAN}[>] No local source found. Fetching latest release from GitHub...${NC}"

  # Resolve latest release tag
  LATEST=$(curl -s "https://api.github.com/repos/${GITHUB_REPO}/releases/latest" | grep '"tag_name"' | sed -E 's/.*"([^"]+)".*/\1/')
  if [ -z "$LATEST" ]; then
    echo -e "${RED}[ERROR] Could not fetch latest release. Check your internet connection.${NC}"
    exit 1
  fi

  echo -e "${GREEN}[>] Downloading ServManager ${LATEST}...${NC}"
  TMP_SRC=$(mktemp -d)
  curl -sL "https://github.com/${GITHUB_REPO}/archive/refs/tags/${LATEST}.tar.gz" -o "$TMP_SRC/servmanager.tar.gz"
  tar -xzf "$TMP_SRC/servmanager.tar.gz" -C "$TMP_SRC" --strip-components=1
  SRC_DIR="$TMP_SRC"
  echo -e "${GREEN}[OK] Source downloaded to $TMP_SRC${NC}"
fi

# ─────────────────────────────────────────────────────────────
# 2. System packages
# ─────────────────────────────────────────────────────────────
echo -e "${YELLOW}[1/7] Checking system dependencies...${NC}"
PKGS_NEEDED=()

if ! command -v python3 >/dev/null 2>&1; then
  PKGS_NEEDED+=(python3)
fi
if ! command -v pip3 >/dev/null 2>&1 && ! python3 -m pip --version >/dev/null 2>&1; then
  PKGS_NEEDED+=(python3-pip)
fi
if ! command -v node >/dev/null 2>&1; then
  PKGS_NEEDED+=(nodejs npm)
fi
if ! command -v npm >/dev/null 2>&1; then
  PKGS_NEEDED+=(npm)
fi
if ! command -v curl >/dev/null 2>&1; then
  PKGS_NEEDED+=(curl)
fi

if [ ${#PKGS_NEEDED[@]} -gt 0 ]; then
  echo -e "${YELLOW}Installing missing packages: ${PKGS_NEEDED[*]}${NC}"
  apt-get update -qq
  apt-get install -y "${PKGS_NEEDED[@]}"
else
  echo -e "${GREEN}[OK] All system dependencies satisfied.${NC}"
fi

# Ensure python3-venv is available
python3 -c "import venv" 2>/dev/null || apt-get install -y python3-venv

# ─────────────────────────────────────────────────────────────
# 3. Create install directory
# ─────────────────────────────────────────────────────────────
echo -e "${YELLOW}[2/7] Creating install directory at $INSTALL_DIR...${NC}"
mkdir -p "$INSTALL_DIR"
mkdir -p "$INSTALL_DIR/scratch"

# ─────────────────────────────────────────────────────────────
# 4. Copy application code
# ─────────────────────────────────────────────────────────────
echo -e "${YELLOW}[3/7] Copying application files...${NC}"
cp -R "$SRC_DIR/backend" "$INSTALL_DIR/"
cp -R "$SRC_DIR/frontend" "$INSTALL_DIR/"
# CLI script is embedded below and written directly — no copy needed

# Copy data.json if not already present (preserve existing user data)
if [ ! -f "$INSTALL_DIR/data.json" ]; then
  if [ -f "$SRC_DIR/data.json" ]; then
    cp "$SRC_DIR/data.json" "$INSTALL_DIR/"
  fi
fi

# ─────────────────────────────────────────────────────────────
# 5. Python virtual environment and dependencies
# ─────────────────────────────────────────────────────────────
echo -e "${YELLOW}[4/7] Setting up Python virtual environment...${NC}"
python3 -m venv "$VENV_DIR"
"$VENV_DIR/bin/pip" install --quiet --upgrade pip
"$VENV_DIR/bin/pip" install --quiet -r "$INSTALL_DIR/backend/requirements.txt"
echo -e "${GREEN}[OK] Python packages installed.${NC}"

# ─────────────────────────────────────────────────────────────
# 6. Build the React frontend
# ─────────────────────────────────────────────────────────────
echo -e "${YELLOW}[5/7] Building React frontend assets...${NC}"
cd "$INSTALL_DIR/frontend"
npm install --silent --no-audit --no-fund
npm run build --silent
echo -e "${GREEN}[OK] React frontend compiled and ready.${NC}"

# ─────────────────────────────────────────────────────────────
# 7. Generate initial config if needed
# ─────────────────────────────────────────────────────────────
echo -e "${YELLOW}[6/7] Configuring ServManager...${NC}"
cd "$INSTALL_DIR"

if [ ! -f "$INSTALL_DIR/data.json" ]; then
  echo -e "${CYAN}Generating initial configuration with default credentials...${NC}"
  "$VENV_DIR/bin/python3" -c "
import json, secrets, os
token = secrets.token_urlsafe(32)
data = {
  'scripts': [],
  'history': [],
  'remote': {'widgets': []},
  'settings': {
    'port': 8080,
    'separatePorts': False,
    'remotePort': 8081,
    'secretToken': token,
    'username': 'admin',
    'password': 'admin',
    'remotePin': '1234'
  }
}
with open('$INSTALL_DIR/data.json', 'w') as f:
    json.dump(data, f, indent=2)
print(token)
" > /tmp/sm_token.txt
  TOKEN=$(cat /tmp/sm_token.txt)
  rm -f /tmp/sm_token.txt
  FIRST_RUN=1
else
  echo -e "${CYAN}Existing configuration detected. Preserving user data...${NC}"
  TOKEN=$("$VENV_DIR/bin/python3" -c "
import json
with open('$INSTALL_DIR/data.json') as f:
    d = json.load(f)
print(d.get('settings',{}).get('secretToken',''))
" 2>/dev/null || echo "")
  FIRST_RUN=0
fi

MAIN_PORT=$("$VENV_DIR/bin/python3" -c "
import json
with open('$INSTALL_DIR/data.json') as f:
    d = json.load(f)
print(d.get('settings',{}).get('port',8080))
" 2>/dev/null || echo "8080")

# ─────────────────────────────────────────────────────────────
# Install systemd service
# ─────────────────────────────────────────────────────────────
cat > "$SERVICE_FILE" <<EOF
[Unit]
Description=ServManager – Python FastAPI Server Management Dashboard
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=$INSTALL_DIR/backend
ExecStart=$VENV_DIR/bin/python3 -m uvicorn main:app --host 0.0.0.0 --port $MAIN_PORT
Restart=on-failure
RestartSec=5
Environment=PYTHONUNBUFFERED=1

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload

# ─────────────────────────────────────────────────────────────
# Install CLI Helper  (always written from embedded heredoc)
# ─────────────────────────────────────────────────────────────
echo -e "${YELLOW}[7/7] Installing servmanager CLI helper...${NC}"

cat > "$CLI_SCRIPT" << 'CLI_EOF'
#!/bin/bash
# ============================================================
# servmanager – Unified CLI Helper
# Usage: sudo servmanager <command> [arguments]
# ============================================================
set -e
RED='\033[0;31m'; GREEN='\033[0;32m'; BLUE='\033[0;34m'
YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
INSTALL_DIR="/opt/servmanager"
DATA_FILE="$INSTALL_DIR/data.json"
VENV_PYTHON="$INSTALL_DIR/venv/bin/python3"
SERVICE_FILE="/etc/systemd/system/servmanager.service"
GITHUB_REPO="sahilsidhu7/servmanager"
print_header() {
  echo ""
  echo -e "${BLUE}┌─────────────────────────────────────────┐${NC}"
  echo -e "${BLUE}│        ServManager CLI Helper           │${NC}"
  echo -e "${BLUE}└─────────────────────────────────────────┘${NC}"
  echo ""
}
require_root() {
  if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}[ERROR] This command requires root. Run with sudo.${NC}"; exit 1
  fi
}
require_data() {
  if [ ! -f "$DATA_FILE" ]; then
    echo -e "${RED}[ERROR] Config not found at $DATA_FILE${NC}"; exit 1
  fi
}
case "$1" in
  start)    require_root; systemctl start servmanager;   echo -e "${GREEN}[OK] Started.${NC}" ;;
  stop)     require_root; systemctl stop servmanager;    echo -e "${GREEN}[OK] Stopped.${NC}" ;;
  restart)  require_root; systemctl restart servmanager; echo -e "${GREEN}[OK] Restarted.${NC}" ;;
  status)   systemctl status servmanager --no-pager ;;
  enable)   require_root; systemctl enable servmanager;  echo -e "${GREEN}[OK] Enabled on boot.${NC}" ;;
  disable)  require_root; systemctl disable servmanager; echo -e "${YELLOW}[OK] Disabled from boot.${NC}" ;;
  logs)     journalctl -u servmanager -f --no-pager ;;
  set-port)
    require_root; require_data
    PORT="$2"
    if [ -z "$PORT" ]; then echo -e "${RED}Usage: servmanager set-port <port>${NC}"; exit 1; fi
    "$VENV_PYTHON" -c "
import json
with open('$DATA_FILE') as f: d=json.load(f)
d.setdefault('settings',{})['port']=int($PORT)
with open('$DATA_FILE','w') as f: json.dump(d,f,indent=2)
"
    sed -i "s/--port [0-9]*/--port $PORT/" "$SERVICE_FILE"
    systemctl daemon-reload; systemctl restart servmanager
    echo -e "${GREEN}[OK] Port set to $PORT and service restarted.${NC}" ;;
  set-pin)
    require_root; require_data
    PIN="$2"
    if [ -z "$PIN" ] || ! [[ "$PIN" =~ ^[0-9]{4}$ ]]; then
      echo -e "${RED}Usage: servmanager set-pin <4-digit-number>${NC}"; exit 1; fi
    "$VENV_PYTHON" -c "
import json
with open('$DATA_FILE') as f: d=json.load(f)
d.setdefault('settings',{})['remotePin']='$PIN'
with open('$DATA_FILE','w') as f: json.dump(d,f,indent=2)
"
    echo -e "${GREEN}[OK] Remote PIN updated to $PIN${NC}" ;;
  set-auth)
    require_root; require_data
    USERNAME="$2"; PASSWORD="$3"
    if [ -z "$USERNAME" ] || [ -z "$PASSWORD" ]; then
      echo -e "${RED}Usage: servmanager set-auth <username> <password>${NC}"; exit 1; fi
    "$VENV_PYTHON" -c "
import json
with open('$DATA_FILE') as f: d=json.load(f)
d.setdefault('settings',{})['username']='$USERNAME'
d.setdefault('settings',{})['password']='$PASSWORD'
with open('$DATA_FILE','w') as f: json.dump(d,f,indent=2)
"
    echo -e "${GREEN}[OK] Credentials updated for user: $USERNAME${NC}" ;;
  update)
    require_root; print_header
    echo -e "${CYAN}[>] Fetching latest release from GitHub...${NC}"
    LATEST=$(curl -s "https://api.github.com/repos/${GITHUB_REPO}/releases/latest" | grep '"tag_name"' | sed -E 's/.*"([^"]+)".*/\1/')
    if [ -z "$LATEST" ]; then echo -e "${RED}[ERROR] Could not fetch latest version.${NC}"; exit 1; fi
    echo -e "${GREEN}[>] Latest version: ${LATEST}${NC}"
    TMP_DIR=$(mktemp -d)
    curl -sL "https://github.com/${GITHUB_REPO}/archive/refs/tags/${LATEST}.tar.gz" -o "$TMP_DIR/sm.tar.gz"
    tar -xzf "$TMP_DIR/sm.tar.gz" -C "$TMP_DIR" --strip-components=1
    bash "$TMP_DIR/install.sh"
    rm -rf "$TMP_DIR"
    echo -e "${GREEN}[OK] Updated to $LATEST${NC}" ;;
  info)
    require_data
    PORT=$("$VENV_PYTHON" -c "import json; print(json.load(open('$DATA_FILE')).get('settings',{}).get('port',8080))" 2>/dev/null || echo 8080)
    IP=$(hostname -I | awk '{print $1}')
    echo -e "${CYAN}Install Dir : ${YELLOW}$INSTALL_DIR${NC}"
    echo -e "${CYAN}Dashboard   : ${BLUE}http://$IP:$PORT/${NC}"
    echo -e "${CYAN}Remote Pad  : ${BLUE}http://$IP:$PORT/remote${NC}" ;;
  help|--help|-h|"")
    print_header
    echo -e "  ${GREEN}Usage: sudo servmanager <command> [args]${NC}"
    echo ""
    echo -e "  ${YELLOW}Service:${NC}  start | stop | restart | status | enable | disable | logs"
    echo -e "  ${YELLOW}Config: ${NC}  set-port <n> | set-pin <4-digits> | set-auth <user> <pass>"
    echo -e "  ${YELLOW}Other:  ${NC}  update | info | help"
    echo "" ;;
  *)
    echo -e "${RED}Unknown command: $1${NC}  —  run: servmanager help"; exit 1 ;;
esac
CLI_EOF

chmod +x "$CLI_SCRIPT"
ln -sf "$CLI_SCRIPT" "$CLI_LINK"
echo -e "${GREEN}[OK] CLI installed. Run: sudo servmanager help${NC}"

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║       ServManager Installed Successfully!        ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  Dashboard Port : ${CYAN}${MAIN_PORT}${NC}"
echo ""

if [ "$FIRST_RUN" = "1" ]; then
  echo -e "  ${YELLOW}Default Credentials:${NC}"
  echo -e "    Username   : ${CYAN}admin${NC}"
  echo -e "    Password   : ${CYAN}admin${NC}"
  echo -e "    Remote PIN : ${CYAN}1234${NC}"
  echo -e ""
  echo -e "  ${RED}Change these immediately after first login via the Settings tab!${NC}"
  echo ""
fi

read -p "Enable ServManager to start automatically on boot? (y/n): " AUTOSTART

if [[ "$AUTOSTART" =~ ^[Yy]$ ]]; then
  systemctl enable servmanager
  systemctl start servmanager
  echo ""
  echo -e "${GREEN}[OK] ServManager service enabled and running.${NC}"
  echo ""
  IP=$(hostname -I | awk '{print $1}')
  echo -e "  Dashboard : ${BLUE}http://$IP:${MAIN_PORT}/${NC}"
  echo -e "  Remote    : ${BLUE}http://$IP:${MAIN_PORT}/remote${NC}"
else
  echo ""
  echo -e "${YELLOW}Service installed but not started. Run to start:${NC}"
  echo -e "  sudo servmanager start"
  echo ""
  echo -e "${YELLOW}Or run directly in foreground:${NC}"
  echo -e "  cd $INSTALL_DIR/backend && $VENV_DIR/bin/python3 -m uvicorn main:app --host 0.0.0.0 --port $MAIN_PORT"
  echo ""
  echo -e "  Dashboard : ${BLUE}http://localhost:${MAIN_PORT}/${NC}"
  echo -e "  Remote    : ${BLUE}http://localhost:${MAIN_PORT}/remote${NC}"
fi

echo ""
echo -e "${CYAN}Enjoy ServManager! Run 'sudo servmanager help' to manage your instance. 🚀${NC}"
echo ""
