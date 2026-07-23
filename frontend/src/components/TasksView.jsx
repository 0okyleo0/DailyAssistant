import { useState, useEffect } from "react";
import { Copy, CheckCircle2, Circle, Clock, Rocket, Calendar, Archive, Repeat, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import axios from "axios";
import { launchGame, copyGamePath } from "@/utils/launcher";
import {
  weekdayLabel,
  monthDayLabel,
  formatMinutes,
  computeDailyReset,
  computeWeeklyTaskReset,
  computeMonthlyTaskReset,
  computeVersionTaskDeadline,
} from "@/utils/timeOptions";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const FIELDS = {
  daily: { tasks: "tasks", label: "每日任務" },
  weekly: { tasks: "weekly_tasks", label: "每周任務" },
  monthly: { tasks: "monthly_tasks", label: "每月任務" },
  version: { tasks: "version_tasks", label: "版本任務" },
};

// Format a Date as "YYYY/MM/DD HH:MM"
function fmtDateTime(d) {
  if (!d) return "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}/${mm}/${dd} ${hh}:${mi}`;
}

function TasksView({ games, onGamesChange, settings }) {
  const [activeType, setActiveType] = useState("daily");
  // Force re-render every 30s so "剩餘時間" stays fresh
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);
  const proto = settings?.custom_protocol || "gamelauncher";
  const now = new Date();

  const handleToggleTask = async (gameId, taskId, completed, taskType) => {
    try {
      await axios.post(`${API}/games/toggle-task`, { game_id: gameId, task_id: taskId, completed: !completed, task_type: taskType });
      onGamesChange();
    } catch (error) {
      const detail = error?.response?.data?.detail || error?.message || "未知錯誤";
      toast.error("更新失敗: " + detail);
    }
  };

  const handleUncheckAll = async (taskType) => {
    if (!window.confirm(`確定要取消所有${FIELDS[taskType].label}的勾選嗎?`)) return;
    try {
      await axios.post(`${API}/games/uncheck-all`, { task_type: taskType });
      toast.success("已取消所有勾選");
      onGamesChange();
    } catch (error) {
      const detail = error?.response?.data?.detail || error?.message || "未知錯誤";
      toast.error("操作失敗: " + detail);
    }
  };

  const handleArchiveVersion = async (gameId) => {
    if (!window.confirm("確定要歸檔此版本任務嗎? 記錄將移到歷史,任務清單將清空。")) return;
    try {
      await axios.post(`${API}/games/archive-version`, { game_id: gameId });
      toast.success("版本任務已歸檔");
      onGamesChange();
    } catch (error) {
      const detail = error?.response?.data?.detail || error?.message || "未知錯誤";
      toast.error("歸檔失敗: " + detail);
    }
  };

  const statsFor = (type) => {
    const field = FIELDS[type].tasks;
    let total = 0, done = 0;
    games.forEach((g) => {
      const tasks = g[field] || [];
      total += tasks.length;
      done += tasks.filter((t) => t.completed).length;
    });
    const rate = total > 0 ? Math.round((done / total) * 100) : 0;
    return { total, done, rate };
  };

  // Compute a task's next target time. Returns { target, minutesLeft, dueSoon }.
  const taskTiming = (game, task, type) => {
    let target = null;
    if (type === "daily") target = computeDailyReset(game, now);
    else if (type === "weekly") target = computeWeeklyTaskReset(task, game, now);
    else if (type === "monthly") target = computeMonthlyTaskReset(task, game, now);
    else if (type === "version") target = computeVersionTaskDeadline(task, now);
    if (!target) return { target: null, minutesLeft: null, dueSoon: false };
    const minutesLeft = Math.max(0, Math.round((target - now) / 60000));
    const dueSoon = type !== "daily" && minutesLeft <= 1440; // <24h and not daily
    return { target, minutesLeft, dueSoon };
  };

  const renderTaskRow = (game, task, type) => {
    const timing = taskTiming(game, task, type);
    const showTiming = type !== "daily" && timing.target;
    return (
      <div
        key={task.id}
        className="p-4 flex items-center gap-3 hover:bg-[#0A0A0A] transition-colors cursor-pointer"
        onClick={() => handleToggleTask(game.id, task.id, task.completed, type)}
        data-testid={`task-item-${task.id}`}
      >
        <button className="flex-shrink-0">
          {task.completed ? <CheckCircle2 className="w-6 h-6 text-[#39FF14]" /> : <Circle className="w-6 h-6 text-neutral-500" />}
        </button>
        <span className={`text-base flex-1 transition-all ${task.completed ? "line-through text-neutral-500" : "text-neutral-200"}`}>
          {task.name}
        </span>
        {showTiming && (
          <div className="flex flex-col items-end text-xs shrink-0">
            <span className="text-neutral-500" data-testid={`task-target-${task.id}`}>
              {type === "weekly" ? weekdayLabel(task.reset_day ?? game.weekly_reset_day) + " " : ""}
              {type === "monthly" ? monthDayLabel(task.reset_day ?? game.monthly_reset_day) + " " : ""}
              {fmtDateTime(timing.target)}
              {type === "version" && task.cycle_enabled && (
                <Repeat className="inline w-3 h-3 ml-1 text-[#00F0FF]" />
              )}
            </span>
            <span
              className={timing.dueSoon ? "text-[#FF3B30] font-semibold" : "text-neutral-400"}
              data-testid={`task-remaining-${task.id}`}
            >
              {formatMinutes(timing.minutesLeft)}
            </span>
          </div>
        )}
      </div>
    );
  };

  const renderGameCard = (game, type) => {
    const field = FIELDS[type].tasks;
    const tasks = game[field] || [];

    // Game-level subtitle (defaults / summary)
    let subtitle = "";
    let dueSoon = false;
    if (type === "daily") {
      const daily = taskTiming(game, {}, "daily");
      if (daily.target) {
        subtitle = `每日 ${game.reset_time || "00:00"} 重置 · ${formatMinutes(daily.minutesLeft)}`;
      } else {
        subtitle = `每日 ${game.reset_time || "00:00"} 重置`;
      }
    } else if (type === "weekly") {
      // Use the soonest task; if none, fall back to game defaults
      let earliest = null;
      for (const t of tasks) {
        const dt = computeWeeklyTaskReset(t, game, now);
        if (dt && (!earliest || dt < earliest)) earliest = dt;
      }
      if (earliest) {
        const mins = Math.max(0, Math.round((earliest - now) / 60000));
        dueSoon = mins <= 1440;
        subtitle = `最快重置: ${fmtDateTime(earliest)} · ${formatMinutes(mins)}`;
      } else {
        subtitle = `${weekdayLabel(game.weekly_reset_day)} ${game.weekly_reset_time || "00:00"} 預設重置`;
      }
    } else if (type === "monthly") {
      let earliest = null;
      for (const t of tasks) {
        const dt = computeMonthlyTaskReset(t, game, now);
        if (dt && (!earliest || dt < earliest)) earliest = dt;
      }
      if (earliest) {
        const mins = Math.max(0, Math.round((earliest - now) / 60000));
        dueSoon = mins <= 1440;
        subtitle = `最快重置: ${fmtDateTime(earliest)} · ${formatMinutes(mins)}`;
      } else {
        subtitle = `${monthDayLabel(game.monthly_reset_day)} ${game.monthly_reset_time || "00:00"} 預設重置`;
      }
    } else {
      // version
      let earliest = null;
      for (const t of tasks) {
        const dt = computeVersionTaskDeadline(t, now);
        if (dt && (!earliest || dt < earliest)) earliest = dt;
      }
      if (earliest) {
        const mins = Math.max(0, Math.round((earliest - now) / 60000));
        dueSoon = mins <= 1440;
        subtitle = `最快到期: ${fmtDateTime(earliest)} · ${formatMinutes(mins)}`;
      } else {
        subtitle = "未設定到期時間";
      }
    }

    return (
      <div key={game.id} className="rounded-lg bg-[#141414] border border-[#262626] overflow-hidden" data-testid={`task-game-${game.id}-${type}`}>
        <div className="p-4 border-b border-[#262626] flex items-center justify-between gap-2 flex-wrap">
          <div>
            <h3 className="text-xl font-medium text-neutral-200">{game.name}</h3>
            <div className={`flex items-center gap-2 mt-1 text-xs ${dueSoon ? "text-[#FF3B30] font-semibold" : "text-neutral-500"}`} data-testid={`game-subtitle-${game.id}-${type}`}>
              <Clock className="w-3 h-3" />
              <span>{subtitle}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {type === "version" && tasks.length > 0 && (
              <button
                onClick={() => handleArchiveVersion(game.id)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-neutral-800 border border-[#262626] hover:border-neutral-500 text-neutral-300 text-sm transition-colors"
                data-testid={`archive-version-${game.id}`}
              >
                <Archive className="w-4 h-4" />
                <span>歸檔</span>
              </button>
            )}
            <button onClick={() => launchGame(game.path, game.name, proto)} className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-[#39FF14]/10 border border-[#39FF14]/30 hover:border-[#39FF14] text-[#39FF14] text-sm transition-colors" data-testid={`launch-game-link-${game.id}-${type}`}>
              <Rocket className="w-4 h-4" /><span>啟動</span>
            </button>
            <button onClick={() => copyGamePath(game.path, game.name)} className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-[#0A0A0A] border border-[#262626] hover:border-[#00F0FF] text-[#00F0FF] text-sm transition-colors" data-testid={`copy-path-link-${game.id}-${type}`}>
              <Copy className="w-4 h-4" /><span>複製</span>
            </button>
          </div>
        </div>
        <div className="divide-y divide-[#262626]">
          {tasks.length > 0 ? tasks.map((t) => renderTaskRow(game, t, type)) : (
            <div className="p-4 text-center text-neutral-500 text-sm">此類別尚無任務</div>
          )}
        </div>
      </div>
    );
  };

  const daily = statsFor("daily");
  const weekly = statsFor("weekly");
  const monthly = statsFor("monthly");
  const version = statsFor("version");

  return (
    <div className="space-y-6" data-testid="tasks-view">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { key: "daily", label: "每日", stat: daily, color: "text-[#00F0FF]" },
          { key: "weekly", label: "每周", stat: weekly, color: "text-[#39FF14]" },
          { key: "monthly", label: "每月", stat: monthly, color: "text-[#B388FF]" },
          { key: "version", label: "版本", stat: version, color: "text-[#FFB800]" },
        ].map(({ key, label, stat, color }) => (
          <div key={key} className="p-4 rounded-lg bg-[#141414] border border-[#262626]" data-testid={`stats-${key}`}>
            <div className="text-xs font-bold tracking-[0.2em] uppercase text-neutral-500 mb-1">{label} 完成率</div>
            <div className={`text-3xl font-bold ${color}`}>{stat.rate}%</div>
            <div className="text-xs text-neutral-500 mt-1">{stat.done}/{stat.total} 已完成</div>
          </div>
        ))}
      </div>

      <Tabs value={activeType} onValueChange={setActiveType}>
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <TabsList className="grid grid-cols-4 max-w-lg">
            <TabsTrigger value="daily" data-testid="type-tab-daily"><Clock className="w-4 h-4 mr-1" />每日</TabsTrigger>
            <TabsTrigger value="weekly" data-testid="type-tab-weekly"><Calendar className="w-4 h-4 mr-1" />每周</TabsTrigger>
            <TabsTrigger value="monthly" data-testid="type-tab-monthly"><CalendarDays className="w-4 h-4 mr-1" />每月</TabsTrigger>
            <TabsTrigger value="version" data-testid="type-tab-version"><Archive className="w-4 h-4 mr-1" />版本</TabsTrigger>
          </TabsList>
          <Button
            variant="outline"
            onClick={() => handleUncheckAll(activeType)}
            className="border-[#262626] text-neutral-400 hover:text-white"
            data-testid="uncheck-all-button"
          >
            取消所有勾選
          </Button>
        </div>

        {["daily", "weekly", "monthly", "version"].map((type) => (
          <TabsContent key={type} value={type} className="mt-0 space-y-6">
            {games.length === 0 ? (
              <div className="text-center py-16 text-neutral-500">
                <p className="text-lg mb-2">尚無任務部署</p>
                <p className="text-sm">請從左側邊欄新增遊戲</p>
              </div>
            ) : (
              games.map((g) => renderGameCard(g, type))
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

export default TasksView;
