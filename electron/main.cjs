/**
 * ChromaPenguin-Live — Electron main process
 * Loads Vite-built UI and optionally starts the Python magic backend.
 */
const { app, BrowserWindow, shell, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");
const http = require("http");

const isDev = !app.isPackaged;
let mainWindow = null;
let backendProcess = null;

function loadRuntimeConfig() {
  const candidates = [
    path.join(process.cwd(), "desktop-config.json"),
    path.join(app.getAppPath(), "desktop-config.json"),
    path.join(path.dirname(process.execPath), "desktop-config.json"),
    path.join(process.resourcesPath || "", "desktop-config.json"),
  ];
  for (const file of candidates) {
    try {
      if (file && fs.existsSync(file)) {
        return { ...defaultConfig(), ...JSON.parse(fs.readFileSync(file, "utf8")), _configPath: file };
      }
    } catch {
      /* ignore */
    }
  }
  return defaultConfig();
}

function defaultConfig() {
  return {
    backendHost: "127.0.0.1",
    backendPort: 8765,
    autoStartBackend: true,
    pythonPath: "D:\\\\anaconda3\\\\envs\\\\erdes\\\\python.exe",
    backendDir: "C:\\\\Users\\\\ADMIN\\\\Desktop\\\\大三下\\\\fastsam-penguin",
    backendScript: "web_server.py",
  };
}

function backendHealthUrl(cfg) {
  return `http://${cfg.backendHost}:${cfg.backendPort}/api/health`;
}

function checkBackendHealthy(cfg, timeoutMs = 1200) {
  return new Promise((resolve) => {
    const req = http.get(backendHealthUrl(cfg), (res) => {
      resolve(res.statusCode === 200);
    });
    req.on("error", () => resolve(false));
    req.setTimeout(timeoutMs, () => {
      req.destroy();
      resolve(false);
    });
  });
}

function startBackend(cfg) {
  if (!cfg.autoStartBackend) return;
  const py = cfg.pythonPath;
  const cwd = cfg.backendDir;
  const script = path.join(cwd, cfg.backendScript);
  if (!fs.existsSync(py) || !fs.existsSync(script)) {
    console.warn("[desktop] backend auto-start skipped: python/script not found");
    console.warn("[desktop] python=", py, "script=", script);
    return;
  }

  const env = {
    ...process.env,
    KMP_DUPLICATE_LIB_OK: "TRUE",
    PYTHONUNBUFFERED: "1",
  };

  backendProcess = spawn(py, ["-u", cfg.backendScript], {
    cwd,
    env,
    windowsHide: true,
  });

  backendProcess.stdout?.on("data", (d) => console.log(`[backend] ${d}`.trimEnd()));
  backendProcess.stderr?.on("data", (d) => console.log(`[backend] ${d}`.trimEnd()));
  backendProcess.on("exit", (code) => {
    console.log(`[backend] exited code=${code}`);
    backendProcess = null;
  });
}

function stopBackend() {
  if (!backendProcess) return;
  try {
    if (process.platform === "win32") {
      spawn("taskkill", ["/pid", String(backendProcess.pid), "/f", "/t"], {
        windowsHide: true,
      });
    } else {
      backendProcess.kill("SIGTERM");
    }
  } catch (err) {
    console.warn("[desktop] stop backend failed", err);
  }
  backendProcess = null;
}

async function createWindow() {
  const cfg = loadRuntimeConfig();

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    title: "ChromaPenguin-Live",
    backgroundColor: "#e0f2fe",
    icon: path.join(__dirname, "..", "build", "icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
    show: false,
  });

  mainWindow.once("ready-to-show", () => mainWindow.show());

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  const healthy = await checkBackendHealthy(cfg);
  if (!healthy) {
    startBackend(cfg);
  }

  if (isDev) {
    await mainWindow.loadURL("http://127.0.0.1:5174");
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    await mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }

  // In packaged app, API calls go to localhost:8765 (see config.js / desktop bridge)
  mainWindow.webContents.on("did-fail-load", (_e, code, desc) => {
    console.error("[desktop] did-fail-load", code, desc);
  });
}

app.whenReady().then(async () => {
  try {
    await createWindow();
  } catch (err) {
    dialog.showErrorBox("ChromaPenguin-Live", String(err));
    app.quit();
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  stopBackend();
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  stopBackend();
});
