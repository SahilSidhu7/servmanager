# ServManager

**ServManager** is a powerful, self-hosted web-based server administration dashboard and remote control tool. Built with an asynchronous Python FastAPI backend and a premium, responsive React UI, it enables you to monitor server health, chain together custom workflow automation, and run ad-hoc scripts directly from your browser.


## Features

- 📊 **Real-time Diagnostics**: Live CPU, RAM, and disk storage tracking.
- 🌐 **Network Port Scanner**: View all active listening TCP/UDP ports mapped to your system.
- 💻 **Script Editor**: Create and execute custom Linux shell scripts directly from the web interface.
- 🔗 **Workflow Assembler**: Chain sequential commands, HTTP requests, port checks, and logical conditional branches.
- 📱 **Mobile-Friendly Remote**: A customizable dashboard grid allowing you to trigger workflows from your phone like a remote control.
- 🔒 **Secure Authorization**: Token-based access to keep your server protected from unauthorized users.
- 🔄 **Background Polling**: Scripts can be run continuously in the background to serve as live indicator badges for server health.

## Installation (Debian/Ubuntu)

ServManager is packaged for seamless integration into `systemd` and can be installed natively via APT.

### Method 1: Install via APT (GitHub Releases)

1. Download the latest `.deb` package from the [Releases](https://github.com/sahilsidhu7/ServManager/releases) page.
2. Install the package using `apt`:
   ```bash
   wget https://github.com/sahilsidhu7/ServManager/releases/download/v1.0.4/servmanager_1.0.4_all.deb
   sudo apt install ./servmanager_1.0.4_all.deb
   ```

*(The installation automatically builds the Python environment, starts the systemd service, and generates your secure access token).*

### Method 2: Manual Install Script

If you prefer building from source, download the repository and run the automated installer:
```bash
git clone https://github.com/sahilsidhu7/ServManager.git
cd ServManager
sudo ./install.sh
```

## First Steps

After installation, the terminal will output an **Access Token** and the **Dashboard Port** (default `8080`).

1. Open your browser and navigate to `http://YOUR_SERVER_IP:8080/`
2. When prompted, enter your Access Token to unlock the dashboard.
3. Head over to the **Settings** tab to change your server ports or separate the Admin Dashboard from the Mobile Remote Panel.

## Project Architecture

- **Backend:** Python (FastAPI, uvicorn, asyncio, psutil)
- **Frontend:** React, Vite, Vanilla CSS
- **Communication:** REST APIs + WebSockets for real-time log streaming and indicator updates.
- **Persistence:** Local JSON file storage (`data.json`) ensuring portability and zero database overhead.

## Contributing

Pull requests are welcome! If you're running locally, use `npm run dev` in the `/frontend` directory for Vite HMR (Hot Module Replacement) and `python backend/main.py` to start the local FastAPI instance.

## License

MIT License. See `LICENSE` for details.
