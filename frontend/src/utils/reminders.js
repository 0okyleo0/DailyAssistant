import { toast } from "sonner";
import { nextDailyResetDate, nextWeeklyResetDate, parseVersionDeadline } from "./timeOptions";

// Track fired reminders to avoid duplicates (keyed by "gameId:type:targetTimestamp")
const firedReminders = new Set();

function keyFor(gameId, type, targetTs) {
  return `${gameId}:${type}:${targetTs}`;
}

/**
 * Build the list of upcoming reminders from games.
 * Returns array of { gameId, gameName, type, targetTime, reminderTime, minutesBefore }
 */
export function buildReminderList(games, now = new Date()) {
  const reminders = [];
  for (const game of games) {
    // Daily
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
    // Weekly
    if (game.weekly_reminder_minutes > 0 && (game.weekly_tasks || []).length > 0) {
      const target = nextWeeklyResetDate(game.weekly_reset_day, game.weekly_reset_time, now);
      const reminderTime = new Date(target.getTime() - game.weekly_reminder_minutes * 60000);
      reminders.push({
        gameId: game.id,
        gameName: game.name,
        type: "weekly",
        typeLabel: "每周任務",
        targetTime: target,
        reminderTime,
        minutesBefore: game.weekly_reminder_minutes,
      });
    }
    // Version
    if (game.version_reminder_minutes > 0 && game.version_deadline && !game.version_archived && (game.version_tasks || []).length > 0) {
      const target = parseVersionDeadline(game.version_deadline);
      if (target && target > now) {
        const reminderTime = new Date(target.getTime() - game.version_reminder_minutes * 60000);
        reminders.push({
          gameId: game.id,
          gameName: game.name,
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
    // Match if reminder time is within +/- 30 seconds of now (i.e., same minute)
    const diffMs = Math.abs(r.reminderTime.getTime() - now.getTime());
    if (diffMs > 30_000) continue;

    // Truncate to minute for deduplication
    const bucket = Math.floor(r.reminderTime.getTime() / 60000) * 60000;
    const k = keyFor(r.gameId, r.type, bucket);
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
  const count = group.length;
  const title = count === 1
    ? `提醒: ${group[0].gameName} 的${group[0].typeLabel}即將到期`
    : `提醒: ${count} 個任務即將到期`;

  const body = group
    .map((r) => `• ${r.gameName} - ${r.typeLabel} (${r.minutesBefore} 分鐘後)`)
    .join("\n");

  // Toast
  toast(title, { description: body, duration: 8000 });

  // OS notification (via Electron IPC or browser Notification API)
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
    // Weekly
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
