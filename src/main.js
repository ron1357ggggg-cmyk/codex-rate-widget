const { app, BrowserWindow, ipcMain, Menu, Tray, nativeImage, screen } = require('electron');
const fs = require('fs');
const path = require('path');
const { readLatestRateLimits } = require('./rateLimits');
const { getCodexLiveUsage } = require('./codexLiveUsage');
const { getClaudeUsage, setClaudeUsageCache } = require('./claudeUsage');
const { getClaudeLiveUsage } = require('./claudeLiveUsage');

let mainWindow;
let tray;

const WINDOW_WIDTH = 240;
const WINDOW_HEIGHT = 178;
const DOCK_MARGIN_X = 14;
const DOCK_MARGIN_Y = 12;
const REFRESH_INTERVAL_MS = 10 * 60 * 1000;
const FRESH_LOCAL_CODEX_MS = 2 * 60 * 1000;
const hasSingleInstanceLock = app.requestSingleInstanceLock();
let codexLiveCache = null;

if (!hasSingleInstanceLock) app.quit();

function getDockBounds(display = screen.getPrimaryDisplay()) {
  const workArea = display.workArea;
  return {
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    x: Math.round(workArea.x + workArea.width - WINDOW_WIDTH - DOCK_MARGIN_X),
    y: Math.round(workArea.y + workArea.height - WINDOW_HEIGHT - DOCK_MARGIN_Y)
  };
}

function dockWindow(display = screen.getPrimaryDisplay()) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.setBounds(getDockBounds(display), false);
}

function dockWindowNearCursor() {
  const cursorPoint = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(cursorPoint);
  dockWindow(display);
}

function createWindow() {
  const bounds = getDockBounds();

  mainWindow = new BrowserWindow({
    ...bounds,
    minWidth: WINDOW_WIDTH,
    minHeight: WINDOW_HEIGHT,
    maxWidth: 280,
    maxHeight: 220,
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
  mainWindow.once('ready-to-show', () => {
    dockWindow();
    mainWindow.show();
  });
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
tray.setToolTip('Codex + Claude 剩餘用量');
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
    dockWindowNearCursor();
    mainWindow.show();
    mainWindow.focus();
  }
}

function showWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  dockWindowNearCursor();
  mainWindow.show();
  mainWindow.focus();
}

async function readCodexUsage() {
  const [liveResult, localResult] = await Promise.allSettled([
    getCodexLiveUsage(),
    readLatestRateLimits()
  ]);
  const liveUsage = liveResult.status === 'fulfilled' ? liveResult.value : null;
  const localUsage = localResult.status === 'fulfilled' ? localResult.value : null;

  if (liveUsage?.ok) {
    codexLiveCache = liveUsage;
  } else if (liveResult.status === 'rejected') {
    const error = liveResult.reason;
    writeDiagnostic('codex-live-refresh-error', {
      message: error?.message || String(error),
      stack: error?.stack || null
    });
  }

  if (isFreshLocalCodexUsage(localUsage)) {
    if (liveUsage?.ok && hasCodexUsageDifference(localUsage, liveUsage)) {
      writeDiagnostic('codex-live-local-mismatch', {
        local: summarizeCodexUsage(localUsage),
        live: summarizeCodexUsage(liveUsage)
      });
    }
    return {
      ...localUsage,
      sourceType: 'codex-session-jsonl-preferred'
    };
  }

  if (liveUsage?.ok) return liveUsage;

  if (localUsage?.ok) {
    return {
      ...localUsage,
      liveRefreshFailed: true,
      liveRefreshMessage: liveResult.reason?.message || String(liveResult.reason || 'Codex live refresh failed')
    };
  }

  if (codexLiveCache) {
    return {
      ...codexLiveCache,
      checkedAt: new Date().toISOString(),
      sourceType: 'codex-app-server-cache',
      liveRefreshFailed: true,
      liveRefreshMessage: liveResult.reason?.message || String(liveResult.reason || 'Codex live refresh failed')
    };
  }

  throw liveResult.reason || localResult.reason || new Error('Codex usage sources failed');
}

function isFreshLocalCodexUsage(usage) {
  return usage?.ok && Number.isFinite(Number(usage.sourceEventAgeMs)) && Number(usage.sourceEventAgeMs) <= FRESH_LOCAL_CODEX_MS;
}

function hasCodexUsageDifference(left, right) {
  const leftWindows = summarizeCodexUsage(left).windows;
  const rightWindows = summarizeCodexUsage(right).windows;
  return leftWindows.some((item, index) => {
    const other = rightWindows[index];
    return other && Math.abs(Number(item.remainingPercent) - Number(other.remainingPercent)) >= 1;
  });
}

function summarizeCodexUsage(usage) {
  return {
    checkedAt: usage?.checkedAt || null,
    updatedAt: usage?.updatedAt || null,
    sourceType: usage?.sourceType || null,
    sourceEventAgeMs: usage?.sourceEventAgeMs ?? null,
    windows: Array.isArray(usage?.windows)
      ? usage.windows.map((item) => ({
          label: item.label,
          usedPercent: item.usedPercent,
          remainingPercent: item.remainingPercent,
          resetsAt: item.resetsAt
        }))
      : []
  };
}

async function readClaudeUsage() {
  try {
    const liveUsage = await getClaudeLiveUsage();
    setClaudeUsageCache(liveUsage);
    return liveUsage;
  } catch (error) {
    writeDiagnostic('claude-live-refresh-error', {
      message: error?.message || String(error),
      stack: error?.stack || null
    });
    const fallback = await getClaudeUsage();
    return {
      ...fallback,
      liveRefreshFailed: true,
      liveRefreshMessage: error?.message || String(error)
    };
  }
}

async function loadRateLimitsWithDiagnostics() {
  let codex = { ok: false, windows: [], checkedAt: new Date().toISOString(), message: '讀取中' };
  let claude = { ok: false, message: '讀取中' };
  try {
    [codex, claude] = await Promise.all([
      readCodexUsage(),
      readClaudeUsage()
    ]);
    if (!codex.ok || codex.stale) writeDiagnostic('codex-refresh-warning', codex);
  } catch (error) {
    writeDiagnostic('rate-limit-refresh-error', {
      message: error?.message || String(error),
      stack: error?.stack || null
    });
  }
  return { codex, claude };
}

async function pushRateLimits() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const data = await loadRateLimitsWithDiagnostics();
  mainWindow.webContents.send('usage:update', data);
  return data;
}

function writeDiagnostic(type, payload) {
try {
const logPath = path.join(app.getPath('userData'), 'diagnostics.jsonl');
fs.mkdirSync(path.dirname(logPath), { recursive: true });
fs.appendFileSync(
logPath,
`${JSON.stringify({
timestamp: new Date().toISOString(),
type,
payload
})}\n`
);
} catch {
// Diagnostics must never break the widget.
}
}

ipcMain.handle('usage:get', () => loadRateLimitsWithDiagnostics());
ipcMain.handle('usage:refresh', () => loadRateLimitsWithDiagnostics());
ipcMain.on('window:hide', () => mainWindow?.hide());
ipcMain.on('window:quit', () => {
app.isQuitting = true;
app.quit();
});

if (hasSingleInstanceLock) {
app.on('second-instance', () => {
showWindow();
pushRateLimits();
});

  app.whenReady().then(() => {
    createWindow();
    createTray();
    pushRateLimits();
    setInterval(pushRateLimits, REFRESH_INTERVAL_MS);
    screen.on('display-metrics-changed', () => {
      if (mainWindow?.isVisible()) dockWindow();
    });
  });
}

app.on('before-quit', () => {
  app.isQuitting = true;
});

app.on('window-all-closed', (event) => {
event.preventDefault();
});
