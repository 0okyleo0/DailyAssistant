import { useState } from "react";
import { Copy, CheckCircle2, Circle, Clock, Rocket, Calendar, Archive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import axios from "axios";
import { launchGame, copyGamePath } from "@/utils/launcher";
import { weekdayLabel, parseVersionDeadline } from "@/utils/timeOptions";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const FIELDS = {
  daily: { tasks: "tasks", label: "每日任務" },
  weekly: { tasks: "weekly_tasks", label: "每周任務" },
  version: { tasks: "version_tasks", label: "版本任務" },
};

function TasksView({ games, onGamesChange, settings }) {
  const [activeType, setActiveType] = useState("daily");
  const proto = settings?.custom_protocol || "gamelauncher";

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

  const remainingDays = (deadlineStr) => {
    const d = parseVersionDeadline(deadlineStr);
    if (!d) return null;
    const diff = Math.ceil((d - new Date()) / 86400000);
    return diff;
  };

  const renderTaskRow = (game, task, type) => (
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
    </div>
  );

  const renderGameCard = (game, type) => {
    const field = FIELDS[type].tasks;
    const tasks = game[field] || [];
    let subtitle = "";
    if (type === "daily") {
      subtitle = `每日 ${game.reset_time || "00:00"} 自動重置`;
    } else if (type === "weekly") {
      subtitle = `${weekdayLabel(game.weekly_reset_day)} ${game.weekly_reset_time || "00:00"} 自動重置`;
    } else {
      const d = parseVersionDeadline(game.version_deadline);
      if (d) {
        const days = remainingDays(game.version_deadline);
        subtitle = `到期: ${d.toLocaleString("zh-TW", { hour12: false })} (剩 ${days} 天)`;
      } else {
        subtitle = "未設定到期時間";
      }
    }

    return (
      <div key={game.id} className="rounded-lg bg-[#141414] border border-[#262626] overflow-hidden" data-testid={`task-game-${game.id}-${type}`}>
        <div className="p-4 border-b border-[#262626] flex items-center justify-between gap-2 flex-wrap">
          <div>
            <h3 className="text-xl font-medium text-neutral-200">{game.name}</h3>
            <div className="flex items-center gap-2 mt-1 text-xs text-neutral-500">
              <Clock className="w-3 h-3" />
              <span>{subtitle}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {type === "version" && game.version_deadline && (
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
  const version = statsFor("version");

  return (
    <div className="space-y-6" data-testid="tasks-view">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { key: "daily", label: "每日", stat: daily, color: "text-[#00F0FF]" },
          { key: "weekly", label: "每周", stat: weekly, color: "text-[#39FF14]" },
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
          <TabsList className="grid grid-cols-3 max-w-md">
            <TabsTrigger value="daily" data-testid="type-tab-daily"><Clock className="w-4 h-4 mr-1" />每日</TabsTrigger>
            <TabsTrigger value="weekly" data-testid="type-tab-weekly"><Calendar className="w-4 h-4 mr-1" />每周</TabsTrigger>
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

        {["daily", "weekly", "version"].map((type) => (
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
