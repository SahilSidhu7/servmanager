<h1 align="center">ServManager</h1>

<p align="center">
  <b>A self-hosted dashboard and phone remote for your Linux server.</b><br/>
  Watch live resources, run shell scripts from anywhere, and open SSH terminals in the browser — all on one port.
</p>

<p align="center">
  <a href="https://github.com/SahilSidhu7/servmanager/releases/latest"><img src="https://img.shields.io/github/v/release/SahilSidhu7/servmanager?label=download" alt="Latest release"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT license"></a>
  <img src="https://img.shields.io/badge/backend-FastAPI-009688" alt="FastAPI">
  <img src="https://img.shields.io/badge/frontend-React%2019-61dafb" alt="React 19">
</p>

---

Ever needed to restart a service, check disk space, or tail a script — and your laptop wasn't around? ServManager turns any Debian/Ubuntu box into something you can run from your phone:

- **Live overview** — CPU, memory, and disk meters streamed over WebSocket, plus every listening port
- **Scripts** — write shell scripts in a browser editor, run them on demand or on a schedule, stream output live, keep the last 100 run logs
- **Mobile remote** — a PIN-locked widget panel at `/remote`: buttons that run scripts, health indicators, live metrics, SSH launchers. Design it with drag-and-drop, open it by scanning a QR code
- **SSH terminals** — save a host once, get a full xterm.js terminal in any browser, desktop or phone
- **One port, zero database** — dashboard and remote served by a single FastAPI process; everything lives in one `data.json`

## Install (Debian / Ubuntu)

**One-liner:**

```bash
curl -sSL https://raw.githubusercontent.com/SahilSidhu7/servmanager/main/install.sh | sudo bash
```

Installs dependencies, builds the frontend, sets up a systemd service, and adds the `servmanager` CLI.

**From source:**

```bash
git clone https://github.com/SahilSidhu7/servmanager.git
cd servmanager
sudo ./install.sh
```

**`.deb` package** — grab it from the [latest release](https://github.com/SahilSidhu7/servmanager/releases/latest):

```bash
sudo apt install ./servmanager_<version>_all.deb
```

## First login

Open `http://YOUR_SERVER_IP:8080/`

| | Default |
|---|---|
| Username | `admin` |
| Password | `admin` |
| Remote PIN | `1234` |

> **Change all three in Settings right after your first sign-in.** Your password is stored hashed; the PIN unlocks the phone remote.

## The mobile remote

1. In the dashboard, open **Remote Designer** and add widgets — a button per script, live metrics, an SSH launcher.
2. Click **Save layout** and scan the QR code with your phone.
3. Enter your PIN. Done — tap tiles to run scripts and watch output live.

The remote uses a limited-access token: it can view stats and trigger scripts, but it can't edit scripts, settings, or credentials.

## CLI

```bash
sudo servmanager start|stop|restart|status|logs
sudo servmanager enable|disable          # autostart on boot
sudo servmanager set-port 9090
sudo servmanager set-pin 5678
sudo servmanager set-auth user password
sudo servmanager update                  # upgrade to the latest release
sudo servmanager info|version|help
```

## SSH terminals

Add a host under **SSH Hosts**, then click the terminal button — a full interactive terminal opens in your browser. Also available as a remote widget for your phone.

Requires `asyncssh` (the installer handles it). Without it, everything else still works and SSH shows a clear error.

## Theming

All design tokens live in one file — edit and rebuild:

```bash
nano /opt/servmanager/frontend/src/theme.css
cd /opt/servmanager/frontend && npm run build
sudo servmanager restart
```

## Security notes

ServManager is built for your LAN, home lab, or a VPN like Tailscale — don't expose it directly to the public internet.

- Admin password is stored **hashed** (SHA-256 + salt); login and PIN attempts are rate-limited
- The remote PIN grants a **restricted token** — view and run only, no configuration access
- SSH host passwords are stored in `data.json` (mode `600`, root-only) so the server can open sessions on your behalf
- Scripts run as the service user (root by default) — that's the point of the tool, so guard access to it

## Architecture

- **Backend** — Python: FastAPI, uvicorn, psutil, asyncssh. REST + WebSocket (live stats, log streaming, SSH proxy)
- **Frontend** — React 19 + Vite, plain CSS, no UI framework
- **Persistence** — a single `data.json`, no database

## Local development

```bash
# Terminal 1 — backend
cd backend
pip install -r requirements.txt
python -m uvicorn main:app --port 8080 --reload

# Terminal 2 — frontend (proxies /api and /ws to :8080)
cd frontend
npm install
npm run dev
```

## License

MIT. See [LICENSE](LICENSE).
