#!/bin/bash
# ============================================================
# servmanager – Unified CLI Helper
# Manage your ServManager service from the command line.
# Usage: sudo servmanager <command> [arguments]
# ============================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

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
    echo -e "${RED}[ERROR] This command requires root privileges. Run with sudo.${NC}"
    exit 1
  fi
}

require_data() {
  if [ ! -f "$DATA_FILE" ]; then
    echo -e "${RED}[ERROR] Configuration file not found at $DATA_FILE${NC}"
    echo -e "${YELLOW}Is ServManager installed? Run the installer first.${NC}"
    exit 1
  fi
}

case "$1" in
  start)
    require_root
    echo -e "${CYAN}[>] Starting ServManager service...${NC}"
    systemctl start servmanager
    echo -e "${GREEN}[OK] ServManager started.${NC}"
    ;;

  stop)
    require_root
    echo -e "${CYAN}[>] Stopping ServManager service...${NC}"
    systemctl stop servmanager
    echo -e "${GREEN}[OK] ServManager stopped.${NC}"
    ;;

  restart)
    require_root
    echo -e "${CYAN}[>] Restarting ServManager service...${NC}"
    systemctl restart servmanager
    echo -e "${GREEN}[OK] ServManager restarted.${NC}"
    ;;

  status)
    echo -e "${CYAN}[>] ServManager service status:${NC}"
    systemctl status servmanager --no-pager
    ;;

  enable)
    require_root
    systemctl enable servmanager
    echo -e "${GREEN}[OK] ServManager enabled on boot.${NC}"
    ;;

  disable)
    require_root
    systemctl disable servmanager
    echo -e "${YELLOW}[OK] ServManager disabled from boot.${NC}"
    ;;

  logs)
    echo -e "${CYAN}[>] Tailing ServManager logs (Ctrl+C to stop):${NC}"
    journalctl -u servmanager -f --no-pager
    ;;

  set-port)
    require_root
    require_data
    PORT="$2"
    if [ -z "$PORT" ]; then
      echo -e "${RED}[ERROR] Usage: servmanager set-port <port>${NC}"
      exit 1
    fi
    echo -e "${CYAN}[>] Setting dashboard port to $PORT...${NC}"
    "$VENV_PYTHON" -c "
import json
with open('$DATA_FILE') as f:
    d = json.load(f)
d.setdefault('settings', {})['port'] = int($PORT)
with open('$DATA_FILE', 'w') as f:
    json.dump(d, f, indent=2)
print('Port updated in data.json')
"
    # Update the systemd service ExecStart port
    sed -i "s/--port [0-9]*/--port $PORT/" "$SERVICE_FILE"
    systemctl daemon-reload
    systemctl restart servmanager
    echo -e "${GREEN}[OK] Port updated to $PORT and service restarted.${NC}"
    ;;

  set-pin)
    require_root
    require_data
    PIN="$2"
    if [ -z "$PIN" ] || ! [[ "$PIN" =~ ^[0-9]{4}$ ]]; then
      echo -e "${RED}[ERROR] Usage: servmanager set-pin <4-digit-number>${NC}"
      exit 1
    fi
    echo -e "${CYAN}[>] Updating mobile remote PIN...${NC}"
    "$VENV_PYTHON" -c "
import json
with open('$DATA_FILE') as f:
    d = json.load(f)
d.setdefault('settings', {})['remotePin'] = '$PIN'
with open('$DATA_FILE', 'w') as f:
    json.dump(d, f, indent=2)
print('Remote PIN updated.')
"
    echo -e "${GREEN}[OK] Mobile remote PIN set to $PIN${NC}"
    ;;

  set-auth)
    require_root
    require_data
    USERNAME="$2"
    PASSWORD="$3"
    if [ -z "$USERNAME" ] || [ -z "$PASSWORD" ]; then
      echo -e "${RED}[ERROR] Usage: servmanager set-auth <username> <password>${NC}"
      exit 1
    fi
    echo -e "${CYAN}[>] Updating dashboard credentials...${NC}"
    "$VENV_PYTHON" -c "
import json
with open('$DATA_FILE') as f:
    d = json.load(f)
d.setdefault('settings', {})['username'] = '$USERNAME'
d.setdefault('settings', {})['password'] = '$PASSWORD'
with open('$DATA_FILE', 'w') as f:
    json.dump(d, f, indent=2)
print('Credentials updated.')
"
    echo -e "${GREEN}[OK] Dashboard credentials updated for user: $USERNAME${NC}"
    ;;

  update)
    require_root
    print_header
    echo -e "${CYAN}[>] Checking for the latest ServManager release on GitHub...${NC}"

    # Fetch latest release version from GitHub API
    LATEST=$(curl -s "https://api.github.com/repos/${GITHUB_REPO}/releases/latest" | grep '"tag_name"' | sed -E 's/.*"([^"]+)".*/\1/')
    if [ -z "$LATEST" ]; then
      echo -e "${RED}[ERROR] Could not determine latest version. Check your internet connection.${NC}"
      exit 1
    fi

    echo -e "${GREEN}[>] Latest version: ${LATEST}${NC}"
    echo -e "${CYAN}[>] Downloading installer for $LATEST...${NC}"

    TMP_DIR=$(mktemp -d)
    curl -sL "https://github.com/${GITHUB_REPO}/archive/refs/tags/${LATEST}.tar.gz" -o "$TMP_DIR/servmanager.tar.gz"
    tar -xzf "$TMP_DIR/servmanager.tar.gz" -C "$TMP_DIR" --strip-components=1
    echo "$LATEST" > "$TMP_DIR/VERSION"

    echo -e "${CYAN}[>] Running installer to upgrade in-place...${NC}"
    bash "$TMP_DIR/install.sh"
    rm -rf "$TMP_DIR"

    echo -e "${GREEN}[OK] ServManager has been updated to $LATEST${NC}"
    ;;

  version)
    VER_FILE="$INSTALL_DIR/VERSION"
    if [ -f "$VER_FILE" ]; then
      echo -e "${CYAN}ServManager version: ${GREEN}$(cat $VER_FILE)${NC}"
    else
      echo -e "${YELLOW}Version file not found. Re-run installer to fix.${NC}"
    fi
    ;;

  info)
    require_data
    echo -e "${CYAN}[>] ServManager Installation Info:${NC}"
    echo -e "    Install Dir : ${YELLOW}$INSTALL_DIR${NC}"
    echo -e "    Config File : ${YELLOW}$DATA_FILE${NC}"
    echo -e "    Service File: ${YELLOW}$SERVICE_FILE${NC}"

    PORT=$("$VENV_PYTHON" -c "
import json
with open('$DATA_FILE') as f:
    d = json.load(f)
print(d.get('settings', {}).get('port', 8080))
" 2>/dev/null || echo "8080")
    IP=$(hostname -I | awk '{print $1}')
    echo -e "    Dashboard   : ${BLUE}http://$IP:$PORT/${NC}"
    echo -e "    Remote Pad  : ${BLUE}http://$IP:$PORT/remote${NC}"
    ;;

  help|--help|-h|"")
    print_header
    echo -e "  ${GREEN}Usage: sudo servmanager <command> [args]${NC}"
    echo ""
    echo -e "  ${YELLOW}Service Commands:${NC}"
    echo -e "    start           Start the ServManager service"
    echo -e "    stop            Stop the ServManager service"
    echo -e "    restart         Restart the ServManager service"
    echo -e "    status          Show service status"
    echo -e "    enable          Enable autostart on boot"
    echo -e "    disable         Disable autostart on boot"
    echo -e "    logs            Tail live service logs"
    echo ""
    echo -e "  ${YELLOW}Configuration Commands:${NC}"
    echo -e "    set-port <n>            Change the dashboard port and restart"
    echo -e "    set-pin <4-digits>      Update the mobile remote PIN"
    echo -e "    set-auth <user> <pass>  Update dashboard username and password"
    echo ""
    echo -e "  ${YELLOW}Maintenance Commands:${NC}"
    echo -e "    update          Download and install the latest release"
    echo -e "    info            Show installation paths and URLs"
    echo -e "    version         Show installed version"
    echo ""
    ;;

  *)
    echo -e "${RED}[ERROR] Unknown command: $1${NC}"
    echo -e "Run ${CYAN}servmanager help${NC} for usage."
    exit 1
    ;;
esac
