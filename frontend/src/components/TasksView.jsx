import { useState } from "react";
import { ExternalLink, CheckCircle2, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function TasksView({ games, onGamesChange }) {
  const [loading, setLoading] = useState(false);

  const handleToggleTask = async (gameId, taskId, completed) => {
    try {
      await axios.post(`${API}/games/toggle-task`, {
        game_id: gameId,
        task_id: taskId,
        completed: !completed
      });
      onGamesChange();
    } catch (error) {
      toast.error("更新失敗");
      console.error(error);
    }
  };

  const handleUncheckAll = async () => {
    if (!window.confirm("確定要取消所有任務的勾選嗎?")) return;
    
    setLoading(true);
    try {
      await axios.post(`${API}/games/uncheck-all`);
      toast.success("已取消所有勾選");
      onGamesChange();
    } catch (error) {
      toast.error("操作失敗");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const totalTasks = games.reduce((acc, game) => acc + (game.tasks?.length || 0), 0);
  const completedTasks = games.reduce((acc, game) => {
    return acc + (game.tasks?.filter(t => t.completed).length || 0);
  }, 0);
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return (
    <div className="space-y-6" data-testid="tasks-view">
      {/* Stats Card */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-lg bg-[#141414] border border-[#262626]" data-testid="total-tasks-stat">
          <div className="text-xs font-bold tracking-[0.2em] uppercase text-neutral-500 mb-1">總任務數</div>
          <div className="text-3xl font-bold text-white">{totalTasks}</div>
        </div>
        <div className="p-4 rounded-lg bg-[#141414] border border-[#262626]" data-testid="completed-tasks-stat">
          <div className="text-xs font-bold tracking-[0.2em] uppercase text-neutral-500 mb-1">已完成</div>
          <div className="text-3xl font-bold text-[#39FF14]">{completedTasks}</div>
        </div>
        <div className="p-4 rounded-lg bg-[#141414] border border-[#262626]" data-testid="completion-rate-stat">
          <div className="text-xs font-bold tracking-[0.2em] uppercase text-neutral-500 mb-1">完成率</div>
          <div className="text-3xl font-bold text-[#00F0FF]">{completionRate}%</div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end">
        <Button
          variant="outline"
          onClick={handleUncheckAll}
          disabled={loading || completedTasks === 0}
          className="border-[#262626] text-neutral-400 hover:text-white hover:border-[#404040]"
          data-testid="uncheck-all-button"
        >
          取消所有勾選
        </Button>
      </div>

      {/* Games and Tasks List */}
      <div className="space-y-6">
        {games.length === 0 ? (
          <div className="text-center py-16 text-neutral-500" data-testid="empty-tasks">
            <p className="text-lg mb-2">尚無任務部署</p>
            <p className="text-sm">請從左側邊欄新增遊戲</p>
          </div>
        ) : (
          games.map((game) => (
            <div
              key={game.id}
              className="rounded-lg bg-[#141414] border border-[#262626] overflow-hidden"
              data-testid={`task-game-${game.id}`}
            >
              <div className="p-4 border-b border-[#262626] flex items-center justify-between">
                <h3 className="text-xl font-medium text-neutral-200">{game.name}</h3>
                <button
                  onClick={() => window.open(game.url, '_blank', 'noopener,noreferrer')}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-[#0A0A0A] border border-[#262626] hover:border-[#00F0FF] text-[#00F0FF] text-sm transition-colors duration-200"
                  data-testid={`open-game-link-${game.id}`}
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>開啟遊戲</span>
                </button>
              </div>
              
              <div className="divide-y divide-[#262626]">
                {game.tasks && game.tasks.length > 0 ? (
                  game.tasks.map((task) => (
                    <div
                      key={task.id}
                      className="p-4 flex items-center gap-3 hover:bg-[#0A0A0A] transition-colors duration-200 cursor-pointer"
                      onClick={() => handleToggleTask(game.id, task.id, task.completed)}
                      data-testid={`task-item-${task.id}`}
                    >
                      <button
                        className="flex-shrink-0"
                        data-testid={`task-checkbox-${task.id}`}
                      >
                        {task.completed ? (
                          <CheckCircle2 className="w-6 h-6 text-[#39FF14]" />
                        ) : (
                          <Circle className="w-6 h-6 text-neutral-500" />
                        )}
                      </button>
                      <span
                        className={`text-base flex-1 transition-all duration-200 ${
                          task.completed
                            ? 'line-through text-neutral-500'
                            : 'text-neutral-200'
                        }`}
                      >
                        {task.name}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="p-4 text-center text-neutral-500 text-sm">
                    此遊戲尚無任務
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default TasksView;