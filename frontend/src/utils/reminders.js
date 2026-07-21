import { toast } from "sonner";
import {
  nextDailyResetDate,
  computeWeeklyTaskReset,
  computeVersionTaskDeadline,
  formatMinutes,
} from "./timeOptions";

// Track fired reminders to avoid duplicates (keyed by "gameId:type:targetTimestamp")
const firedReminders = new Set();

function keyFor(gameId, type, targetTs, taskId = "") {
  return `${gameId}:${type}:${taskId}:${targetTs}`;
}

/**
 * Build the list of upcoming reminders from games.
 * Weekly/Version reminders are computed per-task (each task may have own reset/deadline).
 * Daily reminders remain game-level.
 */
export function buildReminderList(games, now = new Date()) {
  const reminders = [];
  for (const game of games) {
    // Daily (game-level)
    if (game.daily_reminder_minutes > 0 && (game.tasks || []).length > 0) {
      const target = nextDailyResetDate(game.reset_time, now);
      const reminderTime = new Date(target.getTime() - game.daily_reminder_minutes * 60000);
      reminders.push({
        gameId: game.id,
        gameName: game.name,
        type: "daily",
        typeLabel: "每日任務",
        targetTime: target,
        reminderTime,
        minutesBefore: game.daily_reminder_minutes,
      });
    }
    // Weekly (per-task, reminder mins still game-level)
    if (game.weekly_reminder_minutes > 0) {
      for (const task of (game.weekly_tasks || [])) {
        const target = computeWeeklyTaskReset(task, game, now);
        if (!target) continue;
        const reminderTime = new Date(target.getTime() - game.weekly_reminder_minutes * 60000);
        reminders.push({
          gameId: game.id,
          gameName: game.name,
          taskId: task.id,
          taskName: task.name,
          type: "weekly",
          typeLabel: "每周任務",
          targetTime: target,
          reminderTime,
          minutesBefore: game.weekly_reminder_minutes,
        });
      }
    }
    // Version (per-task deadlines)
    if (game.version_reminder_minutes > 0 && !game.version_archived) {
      for (const task of (game.version_tasks || [])) {
        const target = computeVersionTaskDeadline(task, now);
        if (!target || target <= now) continue;
        const reminderTime = new Date(target.getTime() - game.version_reminder_minutes * 60000);
        reminders.push({
          gameId: game.id,
          gameName: game.name,
          taskId: task.id,
          taskName: task.name,
          type: "version",
          typeLabel: "版本任務",
          targetTime: target,
          reminderTime,
          minutesBefore: game.version_reminder_minutes,
        });
      }
    }
  }
  return reminders;
}

/**
 * Check reminders and fire notifications for any that are due right now (within 1 min window).
 * Groups reminders that fire at the same minute into a single notification.
 */
export function checkAndFireReminders(games, options = {}) {
  const { enabled = true, useElectron = false } = options;
  if (!enabled) return;

  const now = new Date();
  const reminders = buildReminderList(games, now);

  // Group by minute-precision reminder time
  const groups = new Map();
  for (const r of reminders) {
    const diffMs = Math.abs(r.reminderTime.getTime() - now.getTime());
    if (diffMs > 30_000) continue;

    const bucket = Math.floor(r.reminderTime.getTime() / 60000) * 60000;
    const k = keyFor(r.gameId, r.type, bucket, r.taskId || "");
    if (firedReminders.has(k)) continue;
    firedReminders.add(k);

    const groupKey = bucket;
    if (!groups.has(groupKey)) groups.set(groupKey, []);
    groups.get(groupKey).push(r);
  }

  for (const group of groups.values()) {
    fireNotification(group, useElectron);
  }

  // Clean up old fired-reminder keys (older than 1 day)
  const cutoff = Math.floor((Date.now() - 86400000) / 60000) * 60000;
  for (const k of firedReminders) {
    const parts = k.split(":");
    const ts = Number(parts[parts.length - 1]);
    if (ts < cutoff) firedReminders.delete(k);
  }
}

function fireNotification(group, useElectron) {
  const types = [...new Set(group.map((r) => r.type))];
  let title;
  if (types.length === 1) {
    const label = types[0] === "daily" ? "每日" : types[0] === "weekly" ? "每周" : "版本";
    title = `${label}任務到期提醒`;
  } else {
    title = "任務到期提醒";
  }

  const body = group
    .map((r) => `• ${r.gameName}${r.taskName ? ` - ${r.taskName}` : ` - ${r.typeLabel}`} (${formatMinutes(r.minutesBefore)})`)
    .join("\n");

  toast(title, { description: body, duration: 8000 });

  if (useElectron && typeof window !== "undefined" && window.electronAPI?.showNotification) {
    window.electronAPI.showNotification({ title, body });
  } else if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
    try {
      new Notification(title, { body });
    } catch (e) {
      console.warn("Notification failed:", e);
    }
  }
}

/**
 * Check and auto-reset games whose reset time has passed today.
 * Returns array of { gameId, gameName, type } for reset actions performed.
 */
export function shouldResetGames(games, now = new Date()) {
  const toReset = [];
  const today = now.toISOString().split("T")[0];

  for (const game of games) {
    // Daily
    if ((game.tasks || []).length > 0 && game.reset_time && game.last_reset_date !== today) {
      const target = new Date(now);
      const [h, m] = game.reset_time.split(":").map(Number);
      target.setHours(h || 0, m || 0, 0, 0);
      if (now >= target) {
        toReset.push({ gameId: game.id, gameName: game.name, type: "daily" });
      }
    }
    // Weekly (game-level; only for tasks WITHOUT per-task override)
    if ((game.weekly_tasks || []).length > 0 && game.weekly_reset_time) {
      const [h, m] = game.weekly_reset_time.split(":").map(Number);
      const target = new Date(now);
      target.setHours(h || 0, m || 0, 0, 0);
      const currentDow = now.getDay();
      if (currentDow === Number(game.weekly_reset_day) && now >= target && game.weekly_last_reset_date !== today) {
        toReset.push({ gameId: game.id, gameName: game.name, type: "weekly" });
      }
    }
  }
  return toReset;
}

/**
 * For each game, compute per-task updates (uncheck + advance) for:
 *  - Weekly tasks with per-task override whose target has passed since last_reset_at
 *  - Version tasks with cycle_enabled whose next_deadline_at has passed
 * Returns array of { gameId, weekly_tasks?, version_tasks? } patches for the API.
 */
export function computePerTaskResets(games, now = new Date()) {
  const patches = [];
  for (const game of games) {
    let weeklyChanged = false;
    let versionChanged = false;

    const newWeekly = (game.weekly_tasks || []).map((t) => {
      const hasOverride = t.reset_day !== undefined || t.reset_time !== undefined;
      if (!hasOverride) return t;
      const day = t.reset_day ?? game.weekly_reset_day ?? 1;
      const timeStr = t.reset_time || game.weekly_reset_time || "00:00";
      const [h, m] = timeStr.split(":").map(Number);
      // "prev" reset target is the most recent past occurrence of (day at time)
      const prev = new Date(now);
      prev.setHours(h || 0, m || 0, 0, 0);
      const dow = prev.getDay();
      let delta = (dow - Number(day) + 7) % 7;
      if (delta === 0 && prev > now) delta = 7;
      prev.setDate(prev.getDate() - delta);
      const lastResetAt = t.last_reset_at ? new Date(t.last_reset_at) : null;
      if (now >= prev && (!lastResetAt || lastResetAt < prev)) {
        weeklyChanged = true;
        return { ...t, completed: false, last_reset_at: now.toISOString() };
      }
      return t;
    });

    const newVersion = (game.version_tasks || []).map((t) => {
      if (!t.cycle_enabled || t.deadline_type !== "days" || !t.next_deadline_at) return t;
      const original = new Date(t.next_deadline_at);
      if (isNaN(original.getTime()) || original > now) return t;
      const days = Number(t.deadline_days) || 0;
      if (days <= 0) return t;
      let advanced = original;
      while (advanced <= now) {
        advanced = new Date(advanced.getTime() + days * 86400000);
      }
      versionChanged = true;
      return { ...t, completed: false, next_deadline_at: advanced.toISOString() };
    });

    if (weeklyChanged || versionChanged) {
      const patch = { gameId: game.id, gameName: game.name };
      if (weeklyChanged) patch.weekly_tasks = newWeekly;
      if (versionChanged) patch.version_tasks = newVersion;
      patches.push(patch);
    }
  }
  return patches;
}
