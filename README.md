# ServManager

**ServManager** is a self-hosted web-based server administration dashboard and mobile remote. Built with a Python FastAPI backend and a React frontend, it lets you monitor server health, write and run shell scripts, chain workflow automation steps, open SSH terminals in your browser, and control everything from your phone — all through a single port.

---

## Features

- **Real-time Stats** — Live CPU, RAM, and disk tracking pushed over WebSocket.
- **Script Editor** — Write and run shell scripts in the browser with a full code editor (line numbers, Tab indentation, auto-indent).
- **Workflow Builder** — Chain shell commands, HTTP requests, TCP port checks, delays, and conditional branches into multi-step automation sequences.
- **SSH Terminal** — Save SSH credentials in the app and open a full xterm.js terminal session in any browser — desktop or phone.
- **Mobile Remote Panel** — A drag-and-drop customizable widget grid served at `/remote`. Supports button, indicator, live metric, and SSH launcher widgets.
- **QR Code Sharing** — After saving your remote layout, a QR code appears for scanning directly from your phone.
- **Auth Layers** — Username + password for the admin dashboard; a 4-digit PIN for the mobile remote.
- **Background Polling** — Scripts can run on a schedule and push live status badges to all connected clients.
- **Single Port** — Admin dashboard at `/` and mobile remote at `/remote` both served by the same FastAPI process on port 8080. No separate server needed.
- **Zero Database** — All data stored in a single `data.json` file.

---

## Installation (Debian / Ubuntu)

### Method 1: One-liner

```bash
curl -sSL https://raw.githubusercontent.com/sahilsidhu7/servmanager/main/install.sh | sudo bash
```

This automatically installs system dependencies (`python3`, `nodejs`, `npm`), builds the React frontend, sets up a Python virtual environment, writes a `systemd` service, and installs the `servmanager` CLI command.

### Method 2: From Source

```bash
git clone https://github.com/sahilsidhu7/servmanager.git
cd servmanager
sudo ./install.sh
```

### Method 3: `.deb` Package

```bash
# Replace <version> with the latest tag from the Releases page
wget https://github.com/sahilsidhu7/servmanager/releases/download/<version>/servmanager_<version>_all.deb
sudo apt install ./servmanager_<version>_all.deb
```

---

## First Login

After installation, open:

```
http://YOUR_SERVER_IP:8080/
```

**Default credentials:**

| Field    | Default |
|----------|---------|
| Username | `admin` |
| Password | `admin` |

> **Change these immediately** in the Settings tab after first login.

---

## Mobile Remote

```
http://YOUR_SERVER_IP:8080/remote
```

Default PIN: `1234` — change it in Settings.

After saving your remote layout in the Designer tab, a QR code appears. Scan it to open the remote panel directly on your phone.

---

## SSH Terminal

Go to the **SSH Connections** tab, add a host with credentials, then click **Connect** to open a full terminal in your browser. Works on desktop and mobile.

**Requires `asyncssh`** — the installer handles this automatically. If you're running from source:

```bash
pip install asyncssh
```

If `asyncssh` is not installed, the rest of the app starts fine and shows a friendly error only when you try to open an SSH session.

---

## CLI Helper (`servmanager`)

A `servmanager` command is installed system-wide after running the installer. All commands that modify the system require `sudo`.

### Service Management

```bash
sudo servmanager start
sudo servmanager stop
sudo servmanager restart
sudo servmanager status
sudo servmanager enable      # autostart on boot
sudo servmanager disable
sudo servmanager logs        # tail live logs
```

### Configuration

```bash
sudo servmanager set-port 9090       # change dashboard port
sudo servmanager set-pin 5678        # change remote PIN (4 digits)
sudo servmanager set-auth myuser mysecurepassword
```

### Maintenance

```bash
sudo servmanager update    # pull latest release from GitHub
sudo servmanager info      # show install paths and URLs
sudo servmanager version
sudo servmanager help
```

---

## Remote Designer

In the **Designer** tab:

1. Pick a widget type from the library (button, indicator, metric, SSH launcher).
2. Drag widgets in the grid to reorder them using the ✛ handle.
3. Click **Save Layout** to persist. A QR code appears — scan it with your phone.

---

## Customizing the Theme

All design tokens live in one file:

```
frontend/src/theme.css
```

Edit the CSS variables, then rebuild:

```bash
cd /opt/servmanager/frontend
npm run build
sudo servmanager restart
```

Key variables:

| Variable | Purpose |
|---|---|
| `--bg-dark` | Page background (`#111111`) |
| `--bg-paper` | Sidebar / panels |
| `--bg-card` | Card backgrounds |
| `--primary` | Accent color (`#c45c1a` burnt orange) |
| `--primary-light` | Hover / highlight variant |
| `--text-main` | Body text |
| `--text-muted` | Secondary text |
| `--border-color` | Card / element borders |
| `--font-sans` | Body font (IBM Plex Mono) |
| `--font-mono` | Code / terminal font |
| `--radius-md` | Border radius (`0px` by default — square) |

---

## Settings Tab

From the **Settings** tab you can configure:

- **Port** — Change the port ServManager listens on (both admin and remote share it).
- **Admin Credentials** — Update username and password.
- **Remote PIN** — Update the 4-digit PIN for phone access.
- **API Token** — Copy the internal security token.

---

## Project Architecture

- **Backend:** Python — FastAPI, uvicorn, asyncio, psutil, asyncssh
- **Frontend:** React 19, Vite, Vanilla CSS
- **Communication:** REST + WebSocket (real-time stats, log streaming, SSH terminal proxy)
- **Persistence:** `data.json` — no database
- **Theme:** `frontend/src/theme.css` — single file, all CSS variables

---

## Local Development

```bash
# Terminal 1 — backend
cd backend
pip install -r requirements.txt
python -m uvicorn main:app --host 0.0.0.0 --port 8080 --reload

# Terminal 2 — frontend
cd frontend
npm install
npm run dev
```

The frontend dev server proxies API calls to `localhost:8080` automatically.

---

## License

MIT License. See `LICENSE` for details.
