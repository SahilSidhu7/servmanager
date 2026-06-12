# ServManager

**ServManager** is a powerful, self-hosted web-based server administration dashboard and remote control tool. Built with an asynchronous Python FastAPI backend and a premium, responsive React UI, it enables you to monitor server health, chain together custom workflow automation, and run ad-hoc scripts directly from your browser — and from your phone.

---

## Features

- 📊 **Real-time Diagnostics** — Live CPU, RAM, and disk storage tracking via WebSocket push.
- 🌐 **Network Port Scanner** — View all active listening TCP/UDP ports mapped to your system.
- 💻 **Script Editor** — Create and execute custom Linux shell scripts directly from the web interface.
- 🔗 **Workflow Assembler** — Chain sequential commands, HTTP requests, port checks, and logical conditional branches.
- 📱 **Mobile-Friendly Remote** — A drag-and-drop customizable grid dashboard for triggering workflows from your phone.
- 🔒 **Credential-Based Auth** — Username & password login for the admin dashboard; a 4-digit PIN for the mobile remote panel.
- 🔄 **Background Polling** — Scripts can be run continuously in the background to serve as live indicator badges.
- 🎨 **Themeable Design** — All design tokens are centralized in `frontend/src/theme.css` for instant theme swaps.
- 🛠️ **CLI Helper** — A `servmanager` command installed on the system for managing the service, updating, and changing settings from the terminal.

---

## Installation (Debian/Ubuntu)

ServManager supports two installation methods.

### Method 1: One-liner (Auto-fetches Latest Release)

Run this single command on your server — no manual downloading required:

```bash
curl -sSL https://raw.githubusercontent.com/sahilsidhu7/servmanager/main/install.sh | sudo bash
```

The installer automatically:
- Detects and installs system dependencies (`python3`, `nodejs`, `npm`, `curl`)
- Downloads the latest release from GitHub if no local source is found
- Builds the React frontend and sets up the Python virtual environment
- Writes the `systemd` service file and enables autostart
- Installs the `servmanager` CLI command to `/usr/local/bin/servmanager`

### Method 2: Install from Source

```bash
git clone https://github.com/sahilsidhu7/servmanager.git
cd servmanager
sudo ./install.sh
```

### Method 3: Install via APT (`.deb` Package)

Download and install using `apt`:

```bash
# Replace <version> with the latest tag from the Releases page
wget https://github.com/sahilsidhu7/servmanager/releases/download/<version>/servmanager_<version>_all.deb
sudo apt install ./servmanager_<version>_all.deb
```

---

## First Login

After installation, navigate to:

```
http://YOUR_SERVER_IP:8080/
```

**Default Admin Credentials:**

| Field    | Default |
|----------|---------|
| Username | `admin` |
| Password | `admin` |

> ⚠️ **Change these immediately** after your first login via the **Settings** tab.

---

## Mobile Remote Panel

Access the simplified mobile-optimized control pad at:

```
http://YOUR_SERVER_IP:8080/remote
```

You will be prompted to enter a **4-digit PIN** to access the remote panel.

**Default Remote PIN:** `1234`

> ⚠️ Change this in the **Settings** tab of the admin dashboard.

---

## CLI Helper (`servmanager`)

After installation, a `servmanager` command is available system-wide. All commands that modify the system require `sudo`.

### Service Management

```bash
sudo servmanager start       # Start the service
sudo servmanager stop        # Stop the service
sudo servmanager restart     # Restart the service
sudo servmanager status      # Show systemd service status
sudo servmanager enable      # Enable autostart on boot
sudo servmanager disable     # Disable autostart on boot
sudo servmanager logs        # Tail live service logs
```

### Configuration

```bash
# Change the dashboard port (updates config + systemd + restarts)
sudo servmanager set-port 9090

# Change the mobile remote PIN (4 digits)
sudo servmanager set-pin 5678

# Change admin username and password
sudo servmanager set-auth myuser mysecurepassword
```

### Maintenance

```bash
# Update to the latest release from GitHub (auto-downloads & reinstalls)
sudo servmanager update

# Show installation paths and dashboard URLs
sudo servmanager info

# Show installed version
sudo servmanager version

# Show all commands
sudo servmanager help
```

---

## Remote Dashboard Designer — Drag & Drop

In the **Designer** tab, you can build a custom layout for the mobile remote panel:

1. Use the **Layout Block Library** panel to add new widgets (buttons, indicators, live metrics).
2. In the **Remote Interface Mockup** grid, **drag widgets** to reorder them — grab the ✛ handle on the top-left of each widget card.
3. Click **Save Layout Config** to persist your layout.
4. Open the remote panel on your phone to see the changes live.

---

## Customizing the Theme

All visual design tokens are centralized in a single file:

```
frontend/src/theme.css
```

To change the theme, simply edit the CSS variables in that file and rebuild the frontend:

```bash
cd /opt/servmanager/frontend
npm run build
sudo servmanager restart
```

Key variables you can adjust:

| Variable | Purpose |
|---|---|
| `--bg-dark` | Main page background |
| `--primary` | Primary accent colour |
| `--primary-glow` | Gradient used on buttons and headings |
| `--accent` | Secondary highlight colour |
| `--radius-md` | Card border radius |
| `--font-sans` | Body font family |
| `--font-mono` | Code/terminal font family |

---

## Settings

From the **Settings** tab in the admin dashboard you can configure:

- **Network Ports** — Change the dashboard or dedicated remote port
- **Admin Credentials** — Update your username and password
- **Remote PIN** — Update the 4-digit PIN for phone access
- **API Token** — View the internal API security token

---

## Project Architecture

- **Backend:** Python (FastAPI, uvicorn, asyncio, psutil)
- **Frontend:** React, Vite, Vanilla CSS
- **Communication:** REST APIs + WebSockets for real-time log streaming and indicator updates
- **Persistence:** Local JSON file storage (`data.json`) — zero database overhead
- **Theme System:** `frontend/src/theme.css` for single-file theme customization

---

## Contributing

Pull requests are welcome! For local development:

```bash
# Start the backend
cd backend
python -m uvicorn main:app --host 0.0.0.0 --port 8080 --reload

# Start the frontend dev server (in a separate terminal)
cd frontend
npm install
npm run dev
```

The frontend dev server proxies API calls to `localhost:8080` automatically.

---

## License

MIT License. See `LICENSE` for details.
