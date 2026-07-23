import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TIME_OPTIONS, WEEKDAY_OPTIONS, MONTH_DAY_OPTIONS, monthDayLabel, initialVersionNextDeadline } from "@/utils/timeOptions";
import { DateTimePicker } from "@/components/DateTimePicker";

/**
 * Per-task settings for weekly tasks (optional per-task override for reset_day / reset_time).
 * If the "自訂" switch is off, the task inherits the game-level default.
 */
export function WeeklyTaskSettings({ task, onChange, testIdPrefix }) {
  const hasOverride = task.reset_day !== undefined || task.reset_time !== undefined;
  const [expanded, setExpanded] = useState(hasOverride);

  const toggleOverride = (on) => {
    if (on) {
      onChange({ reset_day: task.reset_day ?? 1, reset_time: task.reset_time ?? "00:00" });
      setExpanded(true);
    } else {
      onChange({ reset_day: undefined, reset_time: undefined });
    }
  };

  return (
    <div className="border border-[#262626] rounded-md bg-[#0A0A0A]/50 mt-1">
      <button
        type="button"
        className="w-full flex items-center justify-between px-3 py-1.5 text-xs text-neutral-400 hover:text-white"
        onClick={() => setExpanded(!expanded)}
        data-testid={`${testIdPrefix}-toggle-panel`}
      >
        <span className="flex items-center gap-1">
          {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          {hasOverride ? `每周重置: ${WEEKDAY_OPTIONS.find(w => w.value === Number(task.reset_day))?.label || ""} ${task.reset_time || "00:00"}` : "使用預設重置時間"}
        </span>
      </button>
      {expanded && (
        <div className="px-3 pb-3 space-y-2">
          <div className="flex items-center gap-2">
            <Switch
              checked={hasOverride}
              onCheckedChange={toggleOverride}
              data-testid={`${testIdPrefix}-override-switch`}
            />
            <span className="text-xs text-neutral-400">自訂此任務的重置時間</span>
          </div>
          {hasOverride && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs text-neutral-500">重置日</Label>
                <Select
                  value={String(task.reset_day ?? 1)}
                  onValueChange={(v) => onChange({ reset_day: Number(v) })}
                >
                  <SelectTrigger className="bg-[#0A0A0A] border-[#262626] text-white h-8" data-testid={`${testIdPrefix}-day`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#141414] border-[#262626] text-white">
                    {WEEKDAY_OPTIONS.map((w) => (
                      <SelectItem key={w.value} value={String(w.value)}>{w.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-neutral-500">重置時間</Label>
                <Select
                  value={task.reset_time || "00:00"}
                  onValueChange={(v) => onChange({ reset_time: v })}
                >
                  <SelectTrigger className="bg-[#0A0A0A] border-[#262626] text-white h-8" data-testid={`${testIdPrefix}-time`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#141414] border-[#262626] text-white max-h-72">
                    {TIME_OPTIONS.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Per-task settings for version tasks:
 * - deadline_type: 'date' | 'days'
 * - date mode: deadline_date + deadline_time
 * - days mode: deadline_days + deadline_time + cycle_enabled
 */
export function VersionTaskSettings({ task, onChange, testIdPrefix }) {
  const mode = task.deadline_type || "date";
  const [expanded, setExpanded] = useState(true);

  const setMode = (m) => {
    if (m === "date") {
      onChange({
        deadline_type: "date",
        deadline_days: undefined,
        cycle_enabled: false,
      });
    } else {
      const days = task.deadline_days || 7;
      const time = task.deadline_time || "00:00";
      onChange({
        deadline_type: "days",
        deadline_days: days,
        deadline_time: time,
        next_deadline_at: initialVersionNextDeadline(days, time),
      });
    }
  };

  const setDays = (n) => {
    const days = Math.max(1, Math.min(365, Number(n) || 1));
    const time = task.deadline_time || "00:00";
    onChange({
      deadline_days: days,
      next_deadline_at: initialVersionNextDeadline(days, time),
    });
  };

  // Build datetime-local style value from deadline_date + deadline_time
  const dateValue = task.deadline_date && task.deadline_time
    ? `${task.deadline_date}T${task.deadline_time}`
    : "";

  const handleDateChange = (val) => {
    if (!val) {
      onChange({ deadline_date: undefined, deadline_time: undefined });
      return;
    }
    const [d, t] = val.split("T");
    onChange({ deadline_date: d, deadline_time: t || "00:00" });
  };

  // Days-mode time (HH:MM) selects
  const setTimeForDays = (hh, mm) => {
    const time = `${hh}:${mm}`;
    const days = task.deadline_days || 7;
    onChange({
      deadline_time: time,
      next_deadline_at: initialVersionNextDeadline(days, time),
    });
  };
  const [hour, minute] = (task.deadline_time || "00:00").split(":");

  return (
    <div className="border border-[#262626] rounded-md bg-[#0A0A0A]/50 mt-1">
      <button
        type="button"
        className="w-full flex items-center justify-between px-3 py-1.5 text-xs text-neutral-400 hover:text-white"
        onClick={() => setExpanded(!expanded)}
        data-testid={`${testIdPrefix}-toggle-panel`}
      >
        <span className="flex items-center gap-1">
          {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          {mode === "days"
            ? `${task.deadline_days || 0} 天後 ${task.deadline_time || "00:00"}${task.cycle_enabled ? " (循環)" : ""}`
            : task.deadline_date
              ? `${task.deadline_date} ${task.deadline_time || "00:00"}`
              : "未設定到期時間"}
        </span>
      </button>
      {expanded && (
        <div className="px-3 pb-3 space-y-3">
          <RadioGroup value={mode} onValueChange={setMode} className="flex gap-4">
            <div className="flex items-center gap-2">
              <RadioGroupItem value="date" id={`${testIdPrefix}-mode-date`} data-testid={`${testIdPrefix}-mode-date`} />
              <Label htmlFor={`${testIdPrefix}-mode-date`} className="text-xs text-neutral-300 cursor-pointer">指定日期</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="days" id={`${testIdPrefix}-mode-days`} data-testid={`${testIdPrefix}-mode-days`} />
              <Label htmlFor={`${testIdPrefix}-mode-days`} className="text-xs text-neutral-300 cursor-pointer">N 天後</Label>
            </div>
          </RadioGroup>

          {mode === "date" ? (
            <DateTimePicker
              value={dateValue}
              onChange={handleDateChange}
              testIdPrefix={`${testIdPrefix}-date`}
            />
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Input
                  type="number"
                  min={1}
                  max={365}
                  value={task.deadline_days || 7}
                  onChange={(e) => setDays(e.target.value)}
                  className="w-20 bg-[#0A0A0A] border-[#262626] text-white h-8"
                  data-testid={`${testIdPrefix}-days`}
                />
                <span className="text-xs text-neutral-400">天後</span>
                <Select
                  value={(hour || "00").padStart(2, "0")}
                  onValueChange={(v) => setTimeForDays(v, (minute || "00").padStart(2, "0"))}
                >
                  <SelectTrigger className="w-20 bg-[#0A0A0A] border-[#262626] text-white h-8" data-testid={`${testIdPrefix}-hour`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#141414] border-[#262626] text-white max-h-72">
                    {Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0")).map((h) => (
                      <SelectItem key={h} value={h}>{h}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-neutral-500">:</span>
                <Select
                  value={(minute || "00").padStart(2, "0")}
                  onValueChange={(v) => setTimeForDays((hour || "00").padStart(2, "0"), v)}
                >
                  <SelectTrigger className="w-20 bg-[#0A0A0A] border-[#262626] text-white h-8" data-testid={`${testIdPrefix}-minute`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#141414] border-[#262626] text-white max-h-72">
                    {Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0")).map((m) => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={!!task.cycle_enabled}
                  onCheckedChange={(on) => onChange({ cycle_enabled: on })}
                  data-testid={`${testIdPrefix}-cycle-switch`}
                />
                <span className="text-xs text-neutral-400">
                  循環 (到期後自動以 {task.deadline_days || 0} 天為週期重置)
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Per-task settings for monthly tasks. Similar to weekly but day is 1..30 or "last".
 */
export function MonthlyTaskSettings({ task, onChange, testIdPrefix }) {
  const hasOverride = task.reset_day !== undefined || task.reset_time !== undefined;
  const [expanded, setExpanded] = useState(hasOverride);

  const toggleOverride = (on) => {
    if (on) {
      onChange({ reset_day: task.reset_day ?? "1", reset_time: task.reset_time ?? "00:00" });
      setExpanded(true);
    } else {
      onChange({ reset_day: undefined, reset_time: undefined });
    }
  };

  return (
    <div className="border border-[#262626] rounded-md bg-[#0A0A0A]/50 mt-1">
      <button
        type="button"
        className="w-full flex items-center justify-between px-3 py-1.5 text-xs text-neutral-400 hover:text-white"
        onClick={() => setExpanded(!expanded)}
        data-testid={`${testIdPrefix}-toggle-panel`}
      >
        <span className="flex items-center gap-1">
          {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          {hasOverride ? `每月重置: ${monthDayLabel(task.reset_day)} ${task.reset_time || "00:00"}` : "使用預設重置時間"}
        </span>
      </button>
      {expanded && (
        <div className="px-3 pb-3 space-y-2">
          <div className="flex items-center gap-2">
            <Switch
              checked={hasOverride}
              onCheckedChange={toggleOverride}
              data-testid={`${testIdPrefix}-override-switch`}
            />
            <span className="text-xs text-neutral-400">自訂此任務的重置日期</span>
          </div>
          {hasOverride && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs text-neutral-500">重置日期</Label>
                <Select
                  value={String(task.reset_day ?? "1")}
                  onValueChange={(v) => onChange({ reset_day: v })}
                >
                  <SelectTrigger className="bg-[#0A0A0A] border-[#262626] text-white h-8" data-testid={`${testIdPrefix}-day`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#141414] border-[#262626] text-white max-h-72">
                    {MONTH_DAY_OPTIONS.map((d) => (
                      <SelectItem key={d.value} value={String(d.value)}>{d.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-neutral-500">重置時間</Label>
                <Select
                  value={task.reset_time || "00:00"}
                  onValueChange={(v) => onChange({ reset_time: v })}
                >
                  <SelectTrigger className="bg-[#0A0A0A] border-[#262626] text-white h-8" data-testid={`${testIdPrefix}-time`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#141414] border-[#262626] text-white max-h-72">
                    {TIME_OPTIONS.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

