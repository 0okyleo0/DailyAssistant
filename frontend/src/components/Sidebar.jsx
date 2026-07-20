import { useState } from "react";
import { Plus, Copy, Trash2, Edit2, Menu, X, Clock, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import axios from "axios";
import { launchGame, copyGamePath } from "@/utils/launcher";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function Sidebar({ games, onGamesChange, isOpen, onToggle, settings }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingGame, setEditingGame] = useState(null);
  const [gameName, setGameName] = useState("");
  const [gamePath, setGamePath] = useState("");
  const [resetTime, setResetTime] = useState("00:00");
  const [tasks, setTasks] = useState([{ id: Date.now().toString(), name: "" }]);

  const resetForm = () => {
    setGameName("");
    setGamePath("");
    setResetTime("00:00");
    setTasks([{ id: Date.now().toString(), name: "" }]);
    setEditingGame(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!gameName.trim() || !gamePath.trim()) {
      toast.error("請填寫遊戲名稱和檔案路徑");
      return;
    }

    const validTasks = tasks.filter(t => t.name.trim()).map(t => ({
      id: t.id,
      name: t.name.trim(),
      completed: false
    }));

    try {
      if (editingGame) {
        await axios.put(`${API}/games/${editingGame.id}`, {
          name: gameName,
          path: gamePath,
          reset_time: resetTime,
          tasks: validTasks
        });
        toast.success("遊戲已更新");
      } else {
        await axios.post(`${API}/games`, {
          name: gameName,
          path: gamePath,
          reset_time: resetTime,
          tasks: validTasks
        });
        toast.success("遊戲已新增");
      }
      
      setDialogOpen(false);
      resetForm();
      onGamesChange();
    } catch (error) {
      const detail = error?.response?.data?.detail || error?.response?.data?.error || error?.message || "未知錯誤";
      toast.error("操作失敗: " + detail);
      console.error(error);
    }
  };

  const handleEdit = (game) => {
    setEditingGame(game);
    setGameName(game.name);
    setGamePath(game.path);
    setResetTime(game.reset_time || "00:00");
    setTasks(game.tasks.length > 0 ? game.tasks : [{ id: Date.now().toString(), name: "" }]);
    setDialogOpen(true);
  };

  const handleDelete = async (gameId) => {
    if (!window.confirm("確定要刪除此遊戲嗎?")) return;
    
    try {
      await axios.delete(`${API}/games/${gameId}`);
      toast.success("遊戲已刪除");
      onGamesChange();
    } catch (error) {
      const detail = error?.response?.data?.detail || error?.response?.data?.error || error?.message || "未知錯誤";
      toast.error("刪除失敗: " + detail);
      console.error(error);
    }
  };

  const handleCopyPath = async (path, name) => {
    await copyGamePath(path, name);
  };

  const handleLaunch = (path, name) => {
    launchGame(path, name, settings?.custom_protocol || "gamelauncher");
  };

  const addTask = () => {
    setTasks([...tasks, { id: Date.now().toString(), name: "" }]);
  };

  const updateTask = (id, name) => {
    setTasks(tasks.map(t => t.id === id ? { ...t, name } : t));
  };

  const removeTask = (id) => {
    if (tasks.length > 1) {
      setTasks(tasks.filter(t => t.id !== id));
    }
  };

  return (
    <>
      {/* Mobile menu button */}
      <button
        onClick={onToggle}
        className="fixed top-4 left-4 z-50 lg:hidden p-2 rounded-md bg-[#141414] border border-[#262626] text-white"
        data-testid="sidebar-toggle"
      >
        {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={onToggle}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed lg:static top-0 left-0 h-screen w-64 bg-[#141414] border-r border-[#262626] z-40
          transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
        data-testid="sidebar"
      >
        <div className="p-6 flex flex-col h-full">
          <div className="mb-6">
            <h2 className="text-2xl font-semibold tracking-tight text-neutral-100 mb-4">遊戲列表</h2>
            
            <Dialog open={dialogOpen} onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) resetForm();
            }}>
              <DialogTrigger asChild>
                <Button 
                  className="w-full bg-[#00F0FF] hover:bg-[#00D0DD] text-[#0A0A0A] font-medium"
                  data-testid="add-game-button"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  新增遊戲
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-[#141414] border-[#262626] text-white max-h-[90vh] overflow-y-auto" data-testid="game-dialog">
                <DialogHeader>
                  <DialogTitle className="text-white">{editingGame ? "編輯遊戲" : "新增遊戲"}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="game-name" className="text-neutral-400">遊戲名稱</Label>
                    <Input
                      id="game-name"
                      value={gameName}
                      onChange={(e) => setGameName(e.target.value)}
                      className="bg-[#0A0A0A] border-[#262626] text-white"
                      placeholder="輸入遊戲名稱"
                      data-testid="game-name-input"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="game-path" className="text-neutral-400">遊戲檔案路徑</Label>
                    <Input
                      id="game-path"
                      value={gamePath}
                      onChange={(e) => setGamePath(e.target.value)}
                      className="bg-[#0A0A0A] border-[#262626] text-white"
                      placeholder="例如: C:\Games\game.exe"
                      data-testid="game-path-input"
                    />
                    <p className="text-xs text-neutral-500 mt-1">點擊複製按鈕即可複製路徑到剪貼板</p>
                  </div>

                  <div>
                    <Label htmlFor="reset-time" className="text-neutral-400 flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      每日重置時間
                    </Label>
                    <Input
                      id="reset-time"
                      type="time"
                      value={resetTime}
                      onChange={(e) => setResetTime(e.target.value)}
                      className="bg-[#0A0A0A] border-[#262626] text-white"
                      data-testid="reset-time-input"
                    />
                    <p className="text-xs text-neutral-500 mt-1">到達設定時間時,此遊戲任務將自動重置</p>
                  </div>

                  <div>
                    <Label className="text-neutral-400">任務列表</Label>
                    <div className="space-y-2 mt-2">
                      {tasks.map((task, index) => (
                        <div key={task.id} className="flex gap-2">
                          <Input
                            value={task.name}
                            onChange={(e) => updateTask(task.id, e.target.value)}
                            className="bg-[#0A0A0A] border-[#262626] text-white flex-1"
                            placeholder={`任務 ${index + 1}`}
                            data-testid={`task-input-${index}`}
                          />
                          {tasks.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeTask(task.id)}
                              className="text-[#FF3B30] hover:text-[#FF3B30] hover:bg-[#FF3B30]/10"
                              data-testid={`remove-task-${index}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addTask}
                      className="w-full mt-2 border-[#262626] text-neutral-400 hover:text-white"
                      data-testid="add-task-button"
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      新增任務
                    </Button>
                  </div>

                  <div className="flex gap-2 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setDialogOpen(false);
                        resetForm();
                      }}
                      className="flex-1 border-[#262626] text-neutral-400 hover:text-white"
                      data-testid="cancel-button"
                    >
                      取消
                    </Button>
                    <Button
                      type="submit"
                      className="flex-1 bg-[#00F0FF] hover:bg-[#00D0DD] text-[#0A0A0A]"
                      data-testid="save-game-button"
                    >
                      {editingGame ? "更新" : "新增"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <ScrollArea className="flex-1">
            <div className="space-y-2">
              {games.length === 0 ? (
                <div className="text-center py-8 text-neutral-500" data-testid="empty-games">
                  <p className="text-sm">尚無遊戲</p>
                  <p className="text-xs mt-1">點擊上方按鈕新增</p>
                </div>
              ) : (
                games.map((game) => (
                  <div
                    key={game.id}
                    className="group p-3 rounded-md bg-[#0A0A0A] border border-[#262626] hover:border-[#404040] transition-colors duration-200"
                    data-testid={`game-item-${game.id}`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="text-sm font-medium text-white truncate flex-1">{game.name}</h3>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <button
                          onClick={() => handleLaunch(game.path, game.name)}
                          className="p-1 rounded hover:bg-[#262626] text-[#39FF14]"
                          title="啟動遊戲"
                          data-testid={`launch-game-${game.id}`}
                        >
                          <Rocket className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleCopyPath(game.path, game.name)}
                          className="p-1 rounded hover:bg-[#262626] text-[#00F0FF]"
                          title="複製路徑"
                          data-testid={`copy-path-${game.id}`}
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleEdit(game)}
                          className="p-1 rounded hover:bg-[#262626] text-neutral-400"
                          title="編輯"
                          data-testid={`edit-game-${game.id}`}
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleDelete(game.id)}
                          className="p-1 rounded hover:bg-[#262626] text-[#FF3B30]"
                          title="刪除"
                          data-testid={`delete-game-${game.id}`}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                    <div className="text-xs text-neutral-500 space-y-0.5">
                      <div>{game.tasks?.length || 0} 個任務</div>
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {game.reset_time || "00:00"} 重置
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      </aside>
    </>
  );
}

export default Sidebar;