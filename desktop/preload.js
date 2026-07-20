const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  request: (req) => ipcRenderer.invoke('api-request', req),
  launchGame: (gamePath) => ipcRenderer.invoke('launch-game', gamePath),
  showNotification: (payload) => ipcRenderer.invoke('show-notification', payload),
});
