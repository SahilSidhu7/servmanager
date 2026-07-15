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

# Resolve version string for VERSION file
if [ -n "$LATEST" ]; then
  SM_VERSION="$LATEST"
elif [ -f "$SRC_DIR/VERSION" ]; then
  SM_VERSION=$(cat "$SRC_DIR/VERSION")
else
  SM_VERSION="dev"
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
rm -f "$INSTALL_DIR/backend/data.json"
rm -rf "$INSTALL_DIR/frontend/node_modules"
# NOTE: any data.json that ships with the source is a dev artifact and is
# never copied — the backend generates a fresh config with unique tokens
# on first start, and an existing /opt/servmanager/data.json is preserved.

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
echo "$SM_VERSION" > "$INSTALL_DIR/VERSION"
echo -e "${GREEN}[OK] React frontend compiled and ready.${NC}"

# ─────────────────────────────────────────────────────────────
# 7. Generate initial config if needed
# ─────────────────────────────────────────────────────────────
echo -e "${YELLOW}[6/7] Configuring ServManager...${NC}"
cd "$INSTALL_DIR"

if [ ! -f "$INSTALL_DIR/data.json" ]; then
  # The backend creates a full default config (example scripts, default
  # widgets, unique tokens) on first start — nothing to seed here.
  echo -e "${CYAN}First install — ServManager will generate its configuration on first start.${NC}"
  FIRST_RUN=1
  MAIN_PORT=8080
else
  echo -e "${CYAN}Existing configuration detected. Preserving user data...${NC}"
  FIRST_RUN=0
  MAIN_PORT=$("$VENV_DIR/bin/python3" -c "
import json
with open('$INSTALL_DIR/data.json') as f:
    d = json.load(f)
print(d.get('settings',{}).get('port',8080))
" 2>/dev/null || echo "8080")
fi

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
# Install CLI Helper (single source of truth: servmanager-cli.sh)
# ─────────────────────────────────────────────────────────────
echo -e "${YELLOW}[7/7] Installing servmanager CLI helper...${NC}"

if [ -f "$SRC_DIR/servmanager-cli.sh" ]; then
  cp "$SRC_DIR/servmanager-cli.sh" "$CLI_SCRIPT"
else
  echo -e "${RED}[ERROR] servmanager-cli.sh not found in source. Aborting.${NC}"
  exit 1
fi
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

if [ -t 0 ]; then
  read -p "Enable ServManager to start automatically on boot? (y/n): " AUTOSTART
else
  AUTOSTART=y
  echo -e "${CYAN}[>] Non-interactive install — enabling service autostart.${NC}"
fi

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
