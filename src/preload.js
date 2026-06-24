const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('usageWidget', {
getUsage: () => ipcRenderer.invoke('usage:get'),
refreshUsage: () => ipcRenderer.invoke('usage:refresh'),
onUsage: (callback) => ipcRenderer.on('usage:update', (_event, payload) => callback(payload)),
hide: () => ipcRenderer.send('window:hide'),
quit: () => ipcRenderer.send('window:quit')
});
