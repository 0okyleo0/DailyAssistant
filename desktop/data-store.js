const fs = require('fs');
const path = require('path');
const { app } = require('electron');

let DATA_FILE;
let data = null;

function init() {
  DATA_FILE = path.join(app.getPath('userData'), 'data.json');
  load();
}

function load() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8');
      data = JSON.parse(raw);
      // Ensure structure
      if (!data.games) data.games = [];
      if (!data.settings) data.settings = getDefaultSettings();
      if (!data.daily_records) data.daily_records = [];
    } else {
      data = {
        games: [],
        settings: getDefaultSettings(),
        daily_records: [],
      };
      save();
    }
  } catch (err) {
    console.error('Load error:', err);
    data = {
      games: [],
      settings: getDefaultSettings(),
      daily_records: [],
    };
  }
}

function save() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Save error:', err);
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

// ============ Games ============

function getGames() {
  return [...data.games].sort((a, b) => (a.order || 0) - (b.order || 0));
}

function createGame(input) {
  const maxOrder = data.games.reduce((max, g) => Math.max(max, g.order || 0), -1);
  const game = {
    id: genId('game'),
    name: input.name,
    path: input.path,
    tasks: input.tasks || [],
    reset_time: input.reset_time || '00:00',
    last_reset_date: '',
    order: maxOrder + 1,
  };
  data.games.push(game);
  save();
  return game;
}

function updateGame(gameId, updates) {
  const idx = data.games.findIndex((g) => g.id === gameId);
  if (idx === -1) return null;
  for (const [k, v] of Object.entries(updates)) {
    if (v !== undefined && v !== null) data.games[idx][k] = v;
  }
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

function toggleTask(gameId, taskId, completed) {
  const game = data.games.find((g) => g.id === gameId);
  if (!game) return false;
  const task = (game.tasks || []).find((t) => t.id === taskId);
  if (!task) return false;
  task.completed = completed;
  save();
  return true;
}

function uncheckAllTasks() {
  data.games.forEach((game) => {
    (game.tasks || []).forEach((t) => (t.completed = false));
  });
  save();
}

function resetGame(gameId) {
  const game = data.games.find((g) => g.id === gameId);
  if (!game) return null;

  const tasks = game.tasks || [];
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.completed).length;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 10000) / 100 : 0;

  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  const record = {
    id: `record_${game.id}_${yesterday}`,
    date: yesterday,
    game_id: game.id,
    game_name: game.name,
    tasks: tasks.map((t) => ({ ...t })),
    total_tasks: totalTasks,
    completed_tasks: completedTasks,
    completion_rate: completionRate,
  };

  // Upsert record
  const idx = data.daily_records.findIndex((r) => r.id === record.id);
  if (idx >= 0) data.daily_records[idx] = record;
  else data.daily_records.push(record);

  // Reset tasks
  tasks.forEach((t) => (t.completed = false));

  // Update last reset date
  const today = new Date().toISOString().split('T')[0];
  game.last_reset_date = today;

  save();
  return record;
}

// ============ Settings ============

function getSettings() {
  return { ...data.settings };
}

function updateSettings(updates) {
  for (const [k, v] of Object.entries(updates || {})) {
    if (v !== undefined && v !== null) data.settings[k] = v;
  }
  save();
  return { ...data.settings };
}

// ============ Daily Records ============

function getDailyRecords(limit = 100, gameId = null) {
  let records = data.daily_records;
  if (gameId) records = records.filter((r) => r.game_id === gameId);
  return records
    .slice()
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
    .slice(0, limit);
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

function getStats(gameId = null) {
  const records = gameId
    ? data.daily_records.filter((r) => r.game_id === gameId)
    : data.daily_records;

  const today = new Date();
  const daysDiff = (dateStr) => {
    const d = new Date(dateStr);
    return Math.floor((today - d) / 86400000);
  };

  const last7 = records.filter((r) => daysDiff(r.date) <= 7);
  const last30 = records.filter((r) => daysDiff(r.date) <= 30);

  const avg = (arr) => {
    if (arr.length === 0) return 0;
    const sum = arr.reduce((s, r) => s + (r.completion_rate || 0), 0);
    return Math.round((sum / arr.length) * 100) / 100;
  };

  return {
    total_records: records.length,
    last_7_days: { count: last7.length, avg_completion: avg(last7) },
    last_30_days: { count: last30.length, avg_completion: avg(last30) },
  };
}

module.exports = {
  init,
  getGames,
  createGame,
  updateGame,
  deleteGame,
  toggleTask,
  uncheckAllTasks,
  resetGame,
  getSettings,
  updateSettings,
  getDailyRecords,
  deleteDailyRecord,
  bulkDeleteRecords,
  getStats,
};
