const { app, BrowserWindow, ipcMain, Menu, Tray, nativeImage, screen } = require('electron');
const fs = require('fs');
const path = require('path');
const { readLatestRateLimits } = require('./rateLimits');

let mainWindow;
let tray;

function statePath() {
  return path.join(app.getPath('userData'), 'window-state.json');
}

function readWindowState() {
  try {
    const state = JSON.parse(fs.readFileSync(statePath(), 'utf8'));
    return {
      ...state,
      width: Math.max(state.width || 0, 276),
      height: Math.max(state.height || 0, 124)
    };
  } catch {
    return null;
  }
}

function saveWindowState() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const bounds = mainWindow.getBounds();
  fs.mkdirSync(app.getPath('userData'), { recursive: true });
  fs.writeFileSync(statePath(), JSON.stringify(bounds, null, 2));
}

function defaultBounds() {
  const display = screen.getPrimaryDisplay();
  const workArea = display.workArea;
  const width = 276;
  const height = 124;
  return {
    width,
    height,
    x: Math.round(workArea.x + workArea.width - width - 14),
    y: Math.round(workArea.y + workArea.height - height - 12)
  };
}

function createWindow() {
  const saved = readWindowState();
  const bounds = saved || defaultBounds();

  mainWindow = new BrowserWindow({
    ...bounds,
    minWidth: 276,
    minHeight: 124,
    maxWidth: 320,
    maxHeight: 180,
    frame: false,
    transparent: true,
    resizable: false,
    show: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.setAlwaysOnTop(true, 'screen-saver');
  mainWindow.loadFile(path.join(__dirname, 'renderer.html'));
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('moved', saveWindowState);
  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
}

function createTray() {
  const icon = nativeImage.createFromDataURL(
    'data:image/svg+xml;utf8,' +
      encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
          <rect width="32" height="32" rx="7" fill="#1f2937"/>
          <path d="M8 18a8 8 0 1 1 15.2 3.5" fill="none" stroke="#f8fafc" stroke-width="2.5" stroke-linecap="round"/>
          <path d="M17 7v9l5 3" fill="none" stroke="#93c5fd" stroke-width="2.5" stroke-linecap="round"/>
        </svg>
      `)
  );

  tray = new Tray(icon);
  tray.setToolTip('Codex 剩餘用量');
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: '顯示/隱藏', click: toggleWindow },
      { label: '重新整理', click: () => pushRateLimits() },
      { type: 'separator' },
      {
        label: '離開',
        click: () => {
          app.isQuitting = true;
          app.quit();
        }
      }
    ])
  );
  tray.on('click', toggleWindow);
}

function toggleWindow() {
  if (!mainWindow) return;
  if (mainWindow.isVisible()) {
    mainWindow.hide();
  } else {
    mainWindow.show();
    mainWindow.focus();
  }
}

async function pushRateLimits() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const data = await readLatestRateLimits();
  mainWindow.webContents.send('rate-limits', data);
}

ipcMain.handle('rate-limits:get', () => readLatestRateLimits());
ipcMain.on('window:hide', () => mainWindow?.hide());
ipcMain.on('window:quit', () => {
  app.isQuitting = true;
  app.quit();
});

app.whenReady().then(() => {
  createWindow();
  createTray();
  pushRateLimits();
  setInterval(pushRateLimits, 30_000);
});

app.on('before-quit', () => {
  app.isQuitting = true;
  saveWindowState();
});

app.on('window-all-closed', (event) => {
  event.preventDefault();
});
