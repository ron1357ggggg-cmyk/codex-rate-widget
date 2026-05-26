const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('codexRateWidget', {
  getRateLimits: () => ipcRenderer.invoke('rate-limits:get'),
  onRateLimits: (callback) => ipcRenderer.on('rate-limits', (_event, payload) => callback(payload)),
  hide: () => ipcRenderer.send('window:hide'),
  quit: () => ipcRenderer.send('window:quit')
});
