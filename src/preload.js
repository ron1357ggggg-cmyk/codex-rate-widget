const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('usageWidget', {
getUsage: () => ipcRenderer.invoke('usage:get'),
onUsage: (callback) => ipcRenderer.on('usage:update', (_event, payload) => callback(payload)),
hide: () => ipcRenderer.send('window:hide'),
quit: () => ipcRenderer.send('window:quit')
});
