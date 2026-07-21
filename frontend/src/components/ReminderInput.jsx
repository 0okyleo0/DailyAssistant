import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

/**
 * Reminder input with days/hours/minutes segments.
 * Value is total minutes stored as a number; 0 = disabled.
 * If showDays=false (for daily tasks), days segment is hidden and days are treated as 0.
 */
export function ReminderInput({ value, onChange, showDays = true, testIdPrefix = "reminder" }) {
  const totalMinutes = Number(value) || 0;
  const enabled = totalMinutes > 0;

  const days = showDays ? Math.floor(totalMinutes / 1440) : 0;
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  const clamp = (n, min, max) => Math.max(min, Math.min(max, Number(n) || 0));

  const update = (d, h, m) => {
    const total = d * 1440 + h * 60 + m;
    onChange(total > 0 ? total : (enabled ? 5 : 0)); // never save 0 while enabled
  };

  const toggle = (on) => {
    if (on) {
      // Default to 30 min when enabling
      onChange(30);
    } else {
      onChange(0);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Switch
          checked={enabled}
          onCheckedChange={toggle}
          data-testid={`${testIdPrefix}-toggle`}
        />
        <span className="text-sm text-neutral-400">
          {enabled ? "提前提醒" : "不提醒"}
        </span>
      </div>
      {enabled && (
        <div className="flex items-center gap-2 flex-wrap">
          {showDays && (
            <>
              <Input
                type="number"
                min={0}
                max={30}
                value={days}
                onChange={(e) => update(clamp(e.target.value, 0, 30), hours, minutes)}
                className="w-16 bg-[#0A0A0A] border-[#262626] text-white text-center"
                data-testid={`${testIdPrefix}-days`}
              />
              <span className="text-neutral-400 text-sm">天</span>
            </>
          )}
          <Input
            type="number"
            min={0}
            max={23}
            value={hours}
            onChange={(e) => update(days, clamp(e.target.value, 0, 23), minutes)}
            className="w-16 bg-[#0A0A0A] border-[#262626] text-white text-center"
            data-testid={`${testIdPrefix}-hours`}
          />
          <span className="text-neutral-400 text-sm">小時</span>
          <Input
            type="number"
            min={0}
            max={59}
            value={minutes}
            onChange={(e) => update(days, hours, clamp(e.target.value, 0, 59))}
            className="w-16 bg-[#0A0A0A] border-[#262626] text-white text-center"
            data-testid={`${testIdPrefix}-minutes`}
          />
          <span className="text-neutral-400 text-sm">分</span>
          <span className="text-xs text-neutral-500 ml-2">前</span>
        </div>
      )}
    </div>
  );
}
