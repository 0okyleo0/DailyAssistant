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

export function parseVersionDeadline(deadlineStr) {
  if (!deadlineStr) return null;
  try {
    const d = new Date(deadlineStr);
    return isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}
