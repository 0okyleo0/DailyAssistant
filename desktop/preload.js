const { contextBridge, ipcRenderer } = require('electron');

try {
  contextBridge.exposeInMainWorld('electronAPI', {
    isElectron: true,
    request: (req) => ipcRenderer.invoke('api-request', req),
    launchGame: (gamePath) => ipcRenderer.invoke('launch-game', gamePath),
    showNotification: (payload) => ipcRenderer.invoke('show-notification', payload),
  });
  console.log('[Preload] electronAPI exposed successfully');
} catch (err) {
  console.error('[Preload] Failed to expose electronAPI:', err);
}
