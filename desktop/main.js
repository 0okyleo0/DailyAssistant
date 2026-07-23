const { app, BrowserWindow, ipcMain, shell, Notification, dialog, globalShortcut } = require('electron');
const path = require('path');
const dataStore = require('./data-store');
const { launchGame } = require('./game-launcher');

let mainWindow;

// Required for Windows 10/11 native notifications to appear in Action Center
// and to prevent them from showing as "electron.app.<name>".
if (process.platform === 'win32') {
  app.setAppUserModelId('com.dailytasktracker.app');
}

// Set macOS dock icon (Windows uses BrowserWindow.icon, Linux uses .desktop file)
if (process.platform === 'darwin') {
  const iconPath = path.join(__dirname, 'assets', 'icon.png');
  if (app.dock) app.dock.setIcon(iconPath);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#0A0A0A',
    icon: path.join(__dirname, 'assets', process.platform === 'win32' ? 'icon.ico' : 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: '每日任務管理器',
    autoHideMenuBar: true,
  });

  // Load React build
  const isDev = process.env.ELECTRON_START_URL;
  if (isDev) {
    mainWindow.loadURL(process.env.ELECTRON_START_URL);
    mainWindow.webContents.openDevTools();
  } else {
    // In production, React build is bundled as extraResources
    const indexPath = app.isPackaged
      ? path.join(process.resourcesPath, 'app-ui', 'index.html')
      : path.join(__dirname, '..', 'frontend', 'build', 'index.html');
    mainWindow.loadFile(indexPath);
  }

  // Open DevTools by default for diagnostic purposes.
  // Users can toggle it with F12 or Ctrl+Shift+I.
  // If everything works fine, you can remove this line to hide DevTools by default.
  // mainWindow.webContents.openDevTools({ mode: 'detach' });

  mainWindow.setMenu(null);

  // Enable DevTools shortcuts: F12 or Ctrl+Shift+I
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown') {
      if (input.key === 'F12' || (input.control && input.shift && (input.key === 'I' || input.key === 'i'))) {
        mainWindow.webContents.toggleDevTools();
        event.preventDefault();
      }
      if (input.control && input.key === 'r') {
        mainWindow.webContents.reload();
        event.preventDefault();
      }
    }
  });

  // Open external links in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(() => {
  dataStore.init();
  createWindow();

  // Register IPC handlers
  ipcMain.handle('api-request', async (event, req) => {
    try {
      console.log(`[IPC] ${req.method} ${req.url}`);
      const result = await handleApiRequest(req);
      if (result.status >= 400) {
        console.warn(`[IPC] ${req.method} ${req.url} -> ${result.status}`, result.data);
      }
      return result;
    } catch (err) {
      console.error('[IPC] api-request error:', err);
      return { status: 500, data: { error: err.message, stack: err.stack } };
    }
  });

  ipcMain.handle('launch-game', async (event, gamePath) => {
    return await launchGame(gamePath);
  });

  ipcMain.handle('select-game-file', async () => {
    const filters = process.platform === 'win32'
      ? [
          { name: '執行檔 / 捷徑', extensions: ['exe', 'lnk', 'bat', 'cmd'] },
          { name: '所有檔案', extensions: ['*'] },
        ]
      : [
          { name: 'Applications', extensions: ['app', 'sh', 'AppImage'] },
          { name: 'All Files', extensions: ['*'] },
        ];
    const result = await dialog.showOpenDialog(mainWindow, {
      title: '選擇遊戲檔案',
      properties: ['openFile'],
      filters,
    });
    if (result.canceled || !result.filePaths?.[0]) return { canceled: true };
    return { canceled: false, path: result.filePaths[0] };
  });

  ipcMain.handle('show-notification', (event, { title, body }) => {
    try {
      if (!Notification.isSupported()) {
        console.warn('[Notification] Not supported on this OS');
        return { success: false, error: 'not-supported' };
      }
      const iconPath = path.join(
        __dirname,
        'assets',
        process.platform === 'win32' ? 'icon.ico' : 'icon.png'
      );
      const n = new Notification({
        title: title || '每日任務管理器',
        body: body || '',
        icon: iconPath,
        silent: false,
      });
      n.on('click', () => {
        if (mainWindow) {
          if (mainWindow.isMinimized()) mainWindow.restore();
          mainWindow.focus();
        }
      });
      n.show();
      console.log('[Notification] Shown:', title);
      return { success: true };
    } catch (err) {
      console.error('[Notification] Failed:', err);
      return { success: false, error: err.message };
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// API request router
async function handleApiRequest({ method, url, data }) {
  const urlObj = new URL(url, 'http://localhost');
  const pathname = urlObj.pathname;
  const query = Object.fromEntries(urlObj.searchParams);
  const m = method.toUpperCase();

  if (m === 'GET' && pathname === '/api/') {
    return { status: 200, data: { message: 'Daily Task Manager Desktop API' } };
  }

  // Games
  if (m === 'GET' && pathname === '/api/games') {
    return { status: 200, data: dataStore.getGames() };
  }
  if (m === 'POST' && pathname === '/api/games') {
    return { status: 200, data: dataStore.createGame(data) };
  }
  const gameMatch = pathname.match(/^\/api\/games\/([^/]+)$/);
  if (gameMatch) {
    const gameId = gameMatch[1];
    if (m === 'PUT') {
      const updated = dataStore.updateGame(gameId, data);
      if (!updated) return { status: 404, data: { detail: 'Game not found' } };
      return { status: 200, data: updated };
    }
    if (m === 'DELETE') {
      const deleted = dataStore.deleteGame(gameId);
      if (!deleted) return { status: 404, data: { detail: 'Game not found' } };
      return { status: 200, data: { message: 'Game deleted successfully' } };
    }
  }
  if (m === 'POST' && pathname === '/api/games/toggle-task') {
    const result = dataStore.toggleTask(data.game_id, data.task_id, data.completed, data.task_type || 'daily');
    if (!result) return { status: 404, data: { detail: 'Game or task not found' } };
    return { status: 200, data: { message: 'Task updated successfully' } };
  }
  if (m === 'POST' && pathname === '/api/games/uncheck-all') {
    dataStore.uncheckAllTasks((data && data.task_type) || 'all');
    return { status: 200, data: { message: 'All tasks unchecked successfully' } };
  }
  if (m === 'POST' && (pathname === '/api/games/reset-game' || pathname === '/api/games/reset-daily')) {
    const result = dataStore.resetDaily(data.game_id);
    if (!result) return { status: 404, data: { detail: 'Game not found' } };
    return { status: 200, data: { message: 'Daily reset', record: result } };
  }
  if (m === 'POST' && pathname === '/api/games/reset-weekly') {
    const result = dataStore.resetWeekly(data.game_id);
    if (!result) return { status: 404, data: { detail: 'Game not found' } };
    return { status: 200, data: { message: 'Weekly reset', record: result } };
  }
  if (m === 'POST' && pathname === '/api/games/reset-monthly') {
    const result = dataStore.resetMonthly(data.game_id);
    if (!result) return { status: 404, data: { detail: 'Game not found' } };
    return { status: 200, data: { message: 'Monthly reset', record: result } };
  }
  if (m === 'POST' && pathname === '/api/games/archive-version') {
    const result = dataStore.archiveVersion(data.game_id);
    if (!result) return { status: 404, data: { detail: 'Game not found' } };
    return { status: 200, data: { message: 'Version archived', record: result } };
  }

  // Settings
  if (m === 'GET' && pathname === '/api/settings') {
    return { status: 200, data: dataStore.getSettings() };
  }
  if (m === 'PUT' && pathname === '/api/settings') {
    return { status: 200, data: dataStore.updateSettings(data) };
  }

  // Daily records
  if (m === 'GET' && pathname === '/api/daily-records') {
    const limit = parseInt(query.limit || '100', 10);
    return { status: 200, data: dataStore.getDailyRecords(limit, query.game_id, query.task_type) };
  }
  if (m === 'DELETE' && pathname === '/api/daily-records/bulk/delete') {
    const count = dataStore.bulkDeleteRecords(data || []);
    return { status: 200, data: { message: `${count} records deleted successfully` } };
  }
  if (m === 'POST' && pathname === '/api/daily-records/cleanup') {
    const retention = Number(query.retention_days) || 0;
    const deleted = dataStore.cleanupOldRecords(retention);
    return { status: 200, data: { message: `${deleted} old records deleted`, deleted } };
  }
  const recordMatch = pathname.match(/^\/api\/daily-records\/([^/]+)$/);
  if (recordMatch && m === 'DELETE') {
    const deleted = dataStore.deleteDailyRecord(recordMatch[1]);
    if (!deleted) return { status: 404, data: { detail: 'Record not found' } };
    return { status: 200, data: { message: 'Record deleted successfully' } };
  }
  if (m === 'GET' && pathname === '/api/stats') {
    return { status: 200, data: dataStore.getStats(query.game_id, query.task_type) };
  }

  // Backup / Restore
  if (m === 'GET' && pathname === '/api/backup') {
    return { status: 200, data: dataStore.backupAll() };
  }
  if (m === 'POST' && pathname === '/api/restore') {
    const info = dataStore.restoreAll(data || {});
    return { status: 200, data: { message: 'Restore complete', ...info } };
  }

  return { status: 404, data: { detail: `No route for ${method} ${pathname}` } };
}
