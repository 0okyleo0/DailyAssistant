const { app, BrowserWindow, ipcMain, shell, Notification } = require('electron');
const path = require('path');
const dataStore = require('./data-store');
const { launchGame } = require('./game-launcher');

let mainWindow;

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
    title: '遊戲每日任務追蹤器',
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

  mainWindow.setMenu(null);

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
      return await handleApiRequest(req);
    } catch (err) {
      console.error('API request error:', err);
      return { status: 500, data: { error: err.message } };
    }
  });

  ipcMain.handle('launch-game', async (event, gamePath) => {
    return await launchGame(gamePath);
  });

  ipcMain.handle('show-notification', (event, { title, body }) => {
    if (Notification.isSupported()) {
      new Notification({ title, body }).show();
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

  // Root
  if (m === 'GET' && pathname === '/api/') {
    return { status: 200, data: { message: 'Game Daily Tracker Desktop API' } };
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
    const result = dataStore.toggleTask(data.game_id, data.task_id, data.completed);
    if (!result) return { status: 404, data: { detail: 'Game or task not found' } };
    return { status: 200, data: { message: 'Task updated successfully' } };
  }
  if (m === 'POST' && pathname === '/api/games/uncheck-all') {
    dataStore.uncheckAllTasks();
    return { status: 200, data: { message: 'All tasks unchecked successfully' } };
  }
  if (m === 'POST' && pathname === '/api/games/reset-game') {
    const result = dataStore.resetGame(data.game_id);
    if (!result) return { status: 404, data: { detail: 'Game not found' } };
    return { status: 200, data: { message: 'Game reset successfully', record: result } };
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
    return { status: 200, data: dataStore.getDailyRecords(limit, query.game_id) };
  }
  const recordMatch = pathname.match(/^\/api\/daily-records\/([^/]+)$/);
  if (recordMatch && m === 'DELETE') {
    const recordId = recordMatch[1];
    if (recordId === 'bulk') {
      // Handle /api/daily-records/bulk/delete case below
    } else {
      const deleted = dataStore.deleteDailyRecord(recordId);
      if (!deleted) return { status: 404, data: { detail: 'Record not found' } };
      return { status: 200, data: { message: 'Record deleted successfully' } };
    }
  }
  if (m === 'DELETE' && pathname === '/api/daily-records/bulk/delete') {
    const count = dataStore.bulkDeleteRecords(data || []);
    return { status: 200, data: { message: `${count} records deleted successfully` } };
  }
  if (m === 'GET' && pathname === '/api/stats') {
    return { status: 200, data: dataStore.getStats(query.game_id) };
  }

  return { status: 404, data: { detail: `No route for ${method} ${pathname}` } };
}
