#!/bin/bash
# ============================================================
# ServManager Automated Installer – Python/FastAPI + React
# Compatible with Debian/Ubuntu Linux systems
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

SRC_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
INSTALL_DIR="/opt/servmanager"
VENV_DIR="$INSTALL_DIR/venv"
SERVICE_FILE="/etc/systemd/system/servmanager.service"

# 2. System packages
echo -e "${YELLOW}[1/6] Checking system dependencies...${NC}"
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

if [ ${#PKGS_NEEDED[@]} -gt 0 ]; then
  echo -e "${YELLOW}Installing missing packages: ${PKGS_NEEDED[*]}${NC}"
  apt-get update -qq
  apt-get install -y "${PKGS_NEEDED[@]}"
else
  echo -e "${GREEN}[OK] All system dependencies satisfied.${NC}"
fi

# Ensure python3-venv is available
python3 -c "import venv" 2>/dev/null || apt-get install -y python3-venv

# 3. Create install directory
echo -e "${YELLOW}[2/6] Creating install directory at $INSTALL_DIR...${NC}"
mkdir -p "$INSTALL_DIR"
mkdir -p "$INSTALL_DIR/scratch"

# 4. Copy application code
echo -e "${YELLOW}[3/6] Copying application files...${NC}"
cp -R "$SRC_DIR/backend" "$INSTALL_DIR/"
cp -R "$SRC_DIR/frontend" "$INSTALL_DIR/"

# Copy data.json if not already present (preserve existing data)
if [ ! -f "$INSTALL_DIR/data.json" ]; then
  if [ -f "$SRC_DIR/data.json" ]; then
    cp "$SRC_DIR/data.json" "$INSTALL_DIR/"
  fi
fi

# 5. Python virtual environment and dependencies
echo -e "${YELLOW}[4/6] Setting up Python virtual environment...${NC}"
python3 -m venv "$VENV_DIR"
"$VENV_DIR/bin/pip" install --quiet --upgrade pip
"$VENV_DIR/bin/pip" install --quiet -r "$INSTALL_DIR/backend/requirements.txt"
echo -e "${GREEN}[OK] Python packages installed.${NC}"

# 6. Build the React frontend
echo -e "${YELLOW}[5/6] Building React frontend assets...${NC}"
cd "$INSTALL_DIR/frontend"
npm install --silent --no-audit --no-fund
npm run build --silent
echo -e "${GREEN}[OK] React frontend compiled and ready.${NC}"

# 7. Generate initial config if needed
echo -e "${YELLOW}[6/6] Configuring ServManager...${NC}"
cd "$INSTALL_DIR"

if [ ! -f "$INSTALL_DIR/data.json" ]; then
  echo -e "${CYAN}Generating initial configuration with a random secure token...${NC}"
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
    'secretToken': token
  }
}
with open('$INSTALL_DIR/data.json', 'w') as f:
    json.dump(data, f, indent=2)
print(token)
" > /tmp/sm_token.txt
  TOKEN=$(cat /tmp/sm_token.txt)
  rm -f /tmp/sm_token.txt
else
  echo -e "${CYAN}Existing configuration detected. Reading access token...${NC}"
  TOKEN=$("$VENV_DIR/bin/python3" -c "
import json
with open('$INSTALL_DIR/data.json') as f:
    d = json.load(f)
print(d.get('settings',{}).get('secretToken',''))
" 2>/dev/null || echo "")
fi

MAIN_PORT=$("$VENV_DIR/bin/python3" -c "
import json
with open('$INSTALL_DIR/data.json') as f:
    d = json.load(f)
print(d.get('settings',{}).get('port',8080))
" 2>/dev/null || echo "8080")

# Install systemd service
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

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║       ServManager Installed Successfully!        ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  Access Token   : ${YELLOW}${TOKEN}${NC}"
echo -e "  Dashboard Port : ${CYAN}${MAIN_PORT}${NC}"
echo ""

read -p "Enable ServManager to start automatically on boot? (y/n): " AUTOSTART

if [[ "$AUTOSTART" =~ ^[Yy]$ ]]; then
  systemctl enable servmanager
  systemctl start servmanager
  echo -e ""
  echo -e "${GREEN}[OK] ServManager service enabled and running.${NC}"
  echo -e ""
  echo -e "  Dashboard : ${BLUE}http://YOUR_SERVER_IP:${MAIN_PORT}/?token=${TOKEN}${NC}"
  echo -e "  Remote    : ${BLUE}http://YOUR_SERVER_IP:${MAIN_PORT}/remote?token=${TOKEN}${NC}"
else
  echo -e ""
  echo -e "${YELLOW}Service installed but not started. To start manually:${NC}"
  echo -e "  sudo systemctl start servmanager"
  echo ""
  echo -e "${YELLOW}Or run directly in foreground:${NC}"
  echo -e "  cd $INSTALL_DIR/backend && $VENV_DIR/bin/python3 -m uvicorn main:app --host 0.0.0.0 --port $MAIN_PORT"
  echo ""
  echo -e "  Dashboard : ${BLUE}http://localhost:${MAIN_PORT}/?token=${TOKEN}${NC}"
  echo -e "  Remote    : ${BLUE}http://localhost:${MAIN_PORT}/remote?token=${TOKEN}${NC}"
fi

echo ""
echo -e "${CYAN}Enjoy using ServManager! 🚀${NC}"
echo ""
