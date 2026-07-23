// Time options for HH:MM dropdowns (every 30 minutes)
export const TIME_OPTIONS = (() => {
  const opts = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 30) {
      const hh = String(h).padStart(2, "0");
      const mm = String(m).padStart(2, "0");
      opts.push(`${hh}:${mm}`);
    }
  }
  return opts;
})();

// Weekday options: 0 = Sunday, 6 = Saturday (JS Date.getDay())
export const WEEKDAY_OPTIONS = [
  { value: 0, label: "週日" },
  { value: 1, label: "週一" },
  { value: 2, label: "週二" },
  { value: 3, label: "週三" },
  { value: 4, label: "週四" },
  { value: 5, label: "週五" },
  { value: 6, label: "週六" },
];

// Month day options: 1..30 plus "last" (last day of month, auto-adjusts for 28/29/30/31)
export const MONTH_DAY_OPTIONS = (() => {
  const arr = [];
  for (let d = 1; d <= 30; d++) arr.push({ value: d, label: `${d} 號` });
  arr.push({ value: "last", label: "最後一天" });
  return arr;
})();

export function monthDayLabel(value) {
  const opt = MONTH_DAY_OPTIONS.find((o) => String(o.value) === String(value));
  return opt ? opt.label : "";
}

// Reminder offset in minutes. 0 = disabled.
export const REMINDER_OPTIONS = [
  { value: 0, label: "不提醒" },
  { value: 5, label: "5 分鐘前" },
  { value: 15, label: "15 分鐘前" },
  { value: 30, label: "30 分鐘前" },
  { value: 60, label: "1 小時前" },
  { value: 120, label: "2 小時前" },
  { value: 360, label: "6 小時前" },
  { value: 720, label: "12 小時前" },
  { value: 1440, label: "1 天前" },
  { value: 2880, label: "2 天前" },
  { value: 4320, label: "3 天前" },
];

export function weekdayLabel(value) {
  const opt = WEEKDAY_OPTIONS.find((o) => o.value === Number(value));
  return opt ? opt.label : "";
}

export function reminderLabel(value) {
  const opt = REMINDER_OPTIONS.find((o) => o.value === Number(value));
  return opt ? opt.label : "不提醒";
}

/**
 * Compute the next occurrence Date for a daily reset time.
 * If today's reset hasn't happened yet, return today; else tomorrow.
 */
export function nextDailyResetDate(resetTime, referenceDate = new Date()) {
  const [h, m] = (resetTime || "00:00").split(":").map(Number);
  const d = new Date(referenceDate);
  d.setHours(h || 0, m || 0, 0, 0);
  if (d <= referenceDate) d.setDate(d.getDate() + 1);
  return d;
}

/**
 * Compute the next occurrence Date for a weekly reset (day + time).
 * dayOfWeek: 0=Sun ... 6=Sat
 */
export function nextWeeklyResetDate(dayOfWeek, resetTime, referenceDate = new Date()) {
  const [h, m] = (resetTime || "00:00").split(":").map(Number);
  const d = new Date(referenceDate);
  d.setHours(h || 0, m || 0, 0, 0);
  const currentDow = d.getDay();
  let delta = (Number(dayOfWeek) - currentDow + 7) % 7;
  if (delta === 0 && d <= referenceDate) delta = 7;
  d.setDate(d.getDate() + delta);
  return d;
}

/**
 * Compute the next occurrence Date for a monthly reset.
 * dayOfMonth: 1..30 or "last" (last day of month)
 */
export function nextMonthlyResetDate(dayOfMonth, resetTime, referenceDate = new Date()) {
  const [h, m] = (resetTime || "00:00").split(":").map(Number);
  const buildForMonth = (year, month) => {
    const lastDay = new Date(year, month + 1, 0).getDate();
    let dom;
    if (String(dayOfMonth) === "last") dom = lastDay;
    else dom = Math.min(Number(dayOfMonth) || 1, lastDay);
    const dt = new Date(year, month, dom, h || 0, m || 0, 0, 0);
    return dt;
  };
  const y = referenceDate.getFullYear();
  const mo = referenceDate.getMonth();
  let dt = buildForMonth(y, mo);
  if (dt <= referenceDate) {
    dt = buildForMonth(y, mo + 1);
  }
  return dt;
}

export function parseVersionDeadline(deadlineStr) {
  if (!deadlineStr) return null;
  try {
    const d = new Date(deadlineStr);
    return isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

/**
 * Format a minute count as "X 天 X 小時 X 分鐘後", omitting zero segments.
 * Examples: 10 -> "10 分鐘後" ; 60 -> "1 小時後" ; 1455 -> "1 天 15 分鐘後"
 */
export function formatMinutes(totalMinutes) {
  const m = Math.max(0, Math.round(Number(totalMinutes) || 0));
  const days = Math.floor(m / 1440);
  const hours = Math.floor((m % 1440) / 60);
  const minutes = m % 60;
  const parts = [];
  if (days > 0) parts.push(`${days} 天`);
  if (hours > 0) parts.push(`${hours} 小時`);
  if (minutes > 0) parts.push(`${minutes} 分鐘`);
  if (parts.length === 0) parts.push("0 分鐘");
  return parts.join(" ") + "後";
}

/**
 * Compute the next reset Date for a weekly task, honoring per-task overrides.
 */
export function computeWeeklyTaskReset(task, game, referenceDate = new Date()) {
  const day = task?.reset_day ?? game?.weekly_reset_day ?? 1;
  const time = task?.reset_time || game?.weekly_reset_time || "00:00";
  return nextWeeklyResetDate(day, time, referenceDate);
}

/**
 * Compute the next reset Date for a monthly task, honoring per-task overrides.
 */
export function computeMonthlyTaskReset(task, game, referenceDate = new Date()) {
  const day = task?.reset_day ?? game?.monthly_reset_day ?? 1;
  const time = task?.reset_time || game?.monthly_reset_time || "00:00";
  return nextMonthlyResetDate(day, time, referenceDate);
}

/**
 * Compute the next reset Date for a daily task (currently game-level).
 */
export function computeDailyReset(game, referenceDate = new Date()) {
  return nextDailyResetDate(game?.reset_time || "00:00", referenceDate);
}

/**
 * Compute the deadline Date for a version task.
 * Supports two modes:
 *  - 'date': explicit deadline_date (YYYY-MM-DD) + deadline_time (HH:MM)
 *  - 'days': relative deadline_days from task's next_deadline_at anchor (already stored as ISO)
 * If cycle_enabled + past deadline, advance by deadline_days.
 */
export function computeVersionTaskDeadline(task, referenceDate = new Date()) {
  if (!task) return null;
  const mode = task.deadline_type || (task.deadline_days ? "days" : "date");
  const time = task.deadline_time || "00:00";
  const [h, m] = time.split(":").map(Number);

  if (mode === "date") {
    if (!task.deadline_date) return null;
    const [y, mo, d] = task.deadline_date.split("-").map(Number);
    if (!y || !mo || !d) return null;
    const dt = new Date(y, mo - 1, d, h || 0, m || 0, 0, 0);
    return isNaN(dt.getTime()) ? null : dt;
  }

  // days mode - use next_deadline_at as anchor; advance if cycle enabled
  if (mode === "days") {
    const days = Number(task.deadline_days) || 0;
    if (!task.next_deadline_at) return null;
    let dt = new Date(task.next_deadline_at);
    if (isNaN(dt.getTime())) return null;
    if (task.cycle_enabled && days > 0) {
      // Advance forward until dt > referenceDate
      while (dt <= referenceDate) {
        dt = new Date(dt.getTime() + days * 86400000);
      }
    }
    return dt;
  }
  return null;
}

/**
 * Build initial next_deadline_at for a version task in days mode.
 * created = now if not provided.
 */
export function initialVersionNextDeadline(days, time, created = new Date()) {
  const n = Number(days) || 0;
  const [h, m] = (time || "00:00").split(":").map(Number);
  const dt = new Date(created);
  dt.setDate(dt.getDate() + n);
  dt.setHours(h || 0, m || 0, 0, 0);
  return dt.toISOString();
}
