const fs = require('fs');
const path = require('path');
const { app } = require('electron');

let DATA_FILE;
let data = null;

function ensureGameShape(g) {
  return {
    id: g.id,
    name: g.name || '',
    path: g.path || g.url || '',
    order: g.order || 0,
    // Daily
    tasks: g.tasks || [],
    reset_time: g.reset_time || '00:00',
    last_reset_date: g.last_reset_date || '',
    daily_reminder_minutes: g.daily_reminder_minutes ?? 0,
    // Weekly
    weekly_tasks: g.weekly_tasks || [],
    weekly_reset_day: g.weekly_reset_day ?? 1,
    weekly_reset_time: g.weekly_reset_time || '00:00',
    weekly_last_reset_date: g.weekly_last_reset_date || '',
    weekly_reminder_minutes: g.weekly_reminder_minutes ?? 0,
    // Version (per-task deadlines; game-level version_deadline retained for legacy migration only)
    version_tasks: g.version_tasks || [],
    version_deadline: g.version_deadline || '',
    version_reminder_minutes: g.version_reminder_minutes ?? 0,
    version_archived: g.version_archived || false,
  };
}

function init() {
  DATA_FILE = path.join(app.getPath('userData'), 'data.json');
  try {
    const userDataParent = path.dirname(app.getPath('userData'));
    const oldPaths = [
      path.join(userDataParent, '遊戲每日任務追蹤器', 'data.json'),
      path.join(userDataParent, 'game-daily-tracker-desktop', 'data.json'),
    ];
    if (!fs.existsSync(DATA_FILE)) {
      for (const oldPath of oldPaths) {
        if (fs.existsSync(oldPath)) {
          const dir = path.dirname(DATA_FILE);
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          fs.copyFileSync(oldPath, DATA_FILE);
          break;
        }
      }
    }
  } catch (err) {
    console.warn('[DataStore] Migration failed:', err.message);
  }
  load();
}

function load() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
      if (!data.games) data.games = [];
      if (!data.settings) data.settings = getDefaultSettings();
      if (!data.daily_records) data.daily_records = [];
      // Migrate old games to new shape
      data.games = data.games.map(ensureGameShape);
    } else {
      data = { games: [], settings: getDefaultSettings(), daily_records: [] };
      save();
    }
  } catch (err) {
    console.error('[DataStore] Load error:', err);
    data = { games: [], settings: getDefaultSettings(), daily_records: [] };
  }
}

function save() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('[DataStore] Save error:', err);
  }
}

function getDefaultSettings() {
  return {
    id: 'default',
    notifications_enabled: false,
    custom_protocol: 'gamelauncher',
  };
}

function genId(prefix = 'id') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

const TASK_FIELDS = {
  daily: 'tasks',
  weekly: 'weekly_tasks',
  version: 'version_tasks',
};
const RESET_DATE_FIELDS = {
  daily: 'last_reset_date',
  weekly: 'weekly_last_reset_date',
  version: 'last_reset_date',
};

// ============ Games ============

function getGames() {
  return [...data.games].sort((a, b) => (a.order || 0) - (b.order || 0));
}

function createGame(input) {
  const maxOrder = data.games.reduce((max, g) => Math.max(max, g.order || 0), -1);
  const game = ensureGameShape({
    ...input,
    id: genId('game'),
    order: maxOrder + 1,
    last_reset_date: '',
    weekly_last_reset_date: '',
    version_archived: false,
  });
  data.games.push(game);
  save();
  return game;
}

function updateGame(gameId, updates) {
  const idx = data.games.findIndex((g) => g.id === gameId);
  if (idx === -1) return null;
  for (const [k, v] of Object.entries(updates || {})) {
    if (v !== undefined && v !== null) data.games[idx][k] = v;
  }
  data.games[idx] = ensureGameShape(data.games[idx]);
  save();
  return data.games[idx];
}

function deleteGame(gameId) {
  const before = data.games.length;
  data.games = data.games.filter((g) => g.id !== gameId);
  const deleted = before !== data.games.length;
  if (deleted) save();
  return deleted;
}

function toggleTask(gameId, taskId, completed, taskType = 'daily') {
  const game = data.games.find((g) => g.id === gameId);
  if (!game) return false;
  const field = TASK_FIELDS[taskType] || 'tasks';
  const task = (game[field] || []).find((t) => t.id === taskId);
  if (!task) return false;
  task.completed = completed;
  save();
  return true;
}

function uncheckAllTasks(taskType = 'all') {
  const fields = [];
  if (taskType === 'all' || taskType === 'daily') fields.push('tasks');
  if (taskType === 'all' || taskType === 'weekly') fields.push('weekly_tasks');
  if (taskType === 'all' || taskType === 'version') fields.push('version_tasks');
  data.games.forEach((game) => {
    fields.forEach((f) => (game[f] || []).forEach((t) => (t.completed = false)));
  });
  save();
}

function _saveRecordAndReset(game, taskType) {
  const field = TASK_FIELDS[taskType];
  const dateField = RESET_DATE_FIELDS[taskType];
  const tasks = game[field] || [];
  const total = tasks.length;
  const completed = tasks.filter((t) => t.completed).length;
  const rate = total > 0 ? Math.round((completed / total) * 10000) / 100 : 0;

  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  const record = {
    id: `record_${taskType}_${game.id}_${yesterday}`,
    date: yesterday,
    game_id: game.id,
    game_name: game.name,
    task_type: taskType,
    tasks: tasks.map((t) => ({ ...t })),
    total_tasks: total,
    completed_tasks: completed,
    completion_rate: rate,
  };
  const idx = data.daily_records.findIndex((r) => r.id === record.id);
  if (idx >= 0) data.daily_records[idx] = record;
  else data.daily_records.push(record);

  tasks.forEach((t) => (t.completed = false));
  const today = new Date().toISOString().split('T')[0];
  game[dateField] = today;
  save();
  return record;
}

function resetDaily(gameId) {
  const game = data.games.find((g) => g.id === gameId);
  if (!game) return null;
  return _saveRecordAndReset(game, 'daily');
}

function resetWeekly(gameId) {
  const game = data.games.find((g) => g.id === gameId);
  if (!game) return null;
  return _saveRecordAndReset(game, 'weekly');
}

function archiveVersion(gameId) {
  const game = data.games.find((g) => g.id === gameId);
  if (!game) return null;
  const record = _saveRecordAndReset(game, 'version');
  game.version_archived = true;
  game.version_deadline = '';
  game.version_tasks = [];
  save();
  return record;
}

// ============ Settings ============

function getSettings() { return { ...data.settings }; }

function updateSettings(updates) {
  for (const [k, v] of Object.entries(updates || {})) {
    if (v !== undefined && v !== null) data.settings[k] = v;
  }
  save();
  return { ...data.settings };
}

// ============ Daily Records ============

function getDailyRecords(limit = 100, gameId = null, taskType = null) {
  let records = data.daily_records;
  if (gameId) records = records.filter((r) => r.game_id === gameId);
  if (taskType && taskType !== 'all') records = records.filter((r) => (r.task_type || 'daily') === taskType);
  return records.slice().sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, limit);
}

function deleteDailyRecord(recordId) {
  const before = data.daily_records.length;
  data.daily_records = data.daily_records.filter((r) => r.id !== recordId);
  const deleted = before !== data.daily_records.length;
  if (deleted) save();
  return deleted;
}

function bulkDeleteRecords(recordIds) {
  const before = data.daily_records.length;
  const idSet = new Set(recordIds);
  data.daily_records = data.daily_records.filter((r) => !idSet.has(r.id));
  const count = before - data.daily_records.length;
  if (count > 0) save();
  return count;
}

function getStats(gameId = null, taskType = null) {
  let records = data.daily_records;
  if (gameId) records = records.filter((r) => r.game_id === gameId);
  if (taskType && taskType !== 'all') records = records.filter((r) => (r.task_type || 'daily') === taskType);

  const today = new Date();
  const daysDiff = (dateStr) => Math.floor((today - new Date(dateStr)) / 86400000);
  const last7 = records.filter((r) => daysDiff(r.date) <= 7);
  const last30 = records.filter((r) => daysDiff(r.date) <= 30);
  const avg = (arr) => arr.length === 0 ? 0 : Math.round((arr.reduce((s, r) => s + (r.completion_rate || 0), 0) / arr.length) * 100) / 100;

  return {
    total_records: records.length,
    last_7_days: { count: last7.length, avg_completion: avg(last7) },
    last_30_days: { count: last30.length, avg_completion: avg(last30) },
  };
}

// ============ Backup / Restore ============

function backupAll() {
  return {
    version: 2,
    timestamp: new Date().toISOString(),
    games: data.games,
    settings: data.settings,
    daily_records: data.daily_records,
  };
}

function restoreAll(payload) {
  if (payload.games !== undefined) data.games = (payload.games || []).map(ensureGameShape);
  if (payload.settings !== undefined) data.settings = { ...getDefaultSettings(), ...payload.settings, id: 'default' };
  if (payload.daily_records !== undefined) data.daily_records = payload.daily_records || [];
  save();
  return { games: data.games.length, records: data.daily_records.length };
}

module.exports = {
  init,
  getGames,
  createGame,
  updateGame,
  deleteGame,
  toggleTask,
  uncheckAllTasks,
  resetDaily,
  resetGame: resetDaily,
  resetWeekly,
  archiveVersion,
  getSettings,
  updateSettings,
  getDailyRecords,
  deleteDailyRecord,
  bulkDeleteRecords,
  getStats,
  backupAll,
  restoreAll,
};
