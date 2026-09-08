import { useState } from "react";
import { Plus, Copy, Trash2, Edit2, Menu, X, Clock, Rocket, FolderOpen, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import axios from "axios";
import { launchGame, copyGamePath } from "@/utils/launcher";
import { TIME_OPTIONS, WEEKDAY_OPTIONS, MONTH_DAY_OPTIONS } from "@/utils/timeOptions";
import { ReminderInput } from "@/components/ReminderInput";
import { WeeklyTaskSettings, MonthlyTaskSettings, VersionTaskSettings } from "@/components/TaskSettings";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const emptyTask = () => ({ id: Date.now().toString() + Math.random().toString(36).slice(2, 5), name: "" });

function TaskListEditor({ tasks, setTasks, testIdPrefix, renderExtra }) {
  const updateTask = (id, patch) => {
    setTasks(tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  };
  return (
    <div className="space-y-2">
      {tasks.map((task, index) => (
        <div key={task.id} className="space-y-1">
          <div className="flex gap-2">
            <Input
              value={task.name}
              onChange={(e) => updateTask(task.id, { name: e.target.value })}
              className="bg-[#0A0A0A] border-[#262626] text-white flex-1"
              placeholder={`任務 ${index + 1}`}
              data-testid={`${testIdPrefix}-input-${index}`}
            />
            {tasks.length > 1 && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setTasks(tasks.filter((t) => t.id !== task.id))}
                className="text-[#FF3B30] hover:text-[#FF3B30] hover:bg-[#FF3B30]/10"
                data-testid={`${testIdPrefix}-remove-${index}`}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
          {renderExtra && renderExtra(task, (patch) => updateTask(task.id, patch), index)}
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setTasks([...tasks, emptyTask()])}
        className="w-full border-[#262626] text-neutral-400 hover:text-white"
        data-testid={`${testIdPrefix}-add`}
      >
        <Plus className="w-3 h-3 mr-1" />
        新增任務
      </Button>
    </div>
  );
}

function Sidebar({ games, onGamesChange, isOpen, onToggle, settings }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingGame, setEditingGame] = useState(null);
  const [tab, setTab] = useState("basic");
  const [dragIndex, setDragIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const isElectron = typeof window !== "undefined" && !!window.electronAPI;

  const handleDragStart = (e, index) => {
    setDragIndex(index);
    e.dataTransfer.effectAllowed = "move";
    try { e.dataTransfer.setData("text/plain", String(index)); } catch {}
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverIndex !== index) setDragOverIndex(index);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
    setDragOverIndex(null);
  };

  const handleDrop = async (e, targetIndex) => {
    e.preventDefault();
    const src = dragIndex;
    setDragIndex(null);
    setDragOverIndex(null);
    if (src === null || src === targetIndex) return;

    // Compute new sorted array
    const arr = [...games];
    const [moved] = arr.splice(src, 1);
    arr.splice(targetIndex, 0, moved);

    // Persist new order for every game whose position changed
    try {
      await Promise.all(
        arr.map((g, i) => {
          if ((g.order ?? -1) !== i) {
            return axios.put(`${API}/games/${g.id}`, { order: i });
          }
          return Promise.resolve();
        })
      );
      onGamesChange();
    } catch (err) {
      const detail = err?.response?.data?.detail || err?.message || "未知錯誤";
      toast.error("排序失敗: " + detail);
    }
  };

  const handleBrowseFile = async () => {
    if (!isElectron) {
      toast.info("網頁預覽版無法呼叫檔案總管，請手動輸入路徑（桌面版即可用瀏覽）");
      return;
    }
    try {
      const result = await window.electronAPI.selectGameFile();
      if (result && !result.canceled && result.path) {
        setGpath(result.path);
      }
    } catch (err) {
      toast.error("選取檔案失敗: " + (err?.message || "未知錯誤"));
    }
  };

  const [name, setName] = useState("");
  const [gpath, setGpath] = useState("");

  const [dailyTasks, setDailyTasks] = useState([emptyTask()]);
  const [dailyResetTime, setDailyResetTime] = useState("00:00");
  const [dailyReminder, setDailyReminder] = useState(0);

  const [weeklyTasks, setWeeklyTasks] = useState([emptyTask()]);
  const [weeklyResetDay, setWeeklyResetDay] = useState(1);
  const [weeklyResetTime, setWeeklyResetTime] = useState("00:00");
  const [weeklyReminder, setWeeklyReminder] = useState(0);

  const [monthlyTasks, setMonthlyTasks] = useState([emptyTask()]);
  const [monthlyResetDay, setMonthlyResetDay] = useState("1");
  const [monthlyResetTime, setMonthlyResetTime] = useState("00:00");
  const [monthlyReminder, setMonthlyReminder] = useState(0);

  const [versionTasks, setVersionTasks] = useState([emptyTask()]);
  const [versionReminder, setVersionReminder] = useState(0);

  const resetForm = () => {
    setName("");
    setGpath("");
    setDailyTasks([emptyTask()]);
    setDailyResetTime("00:00");
    setDailyReminder(0);
    setWeeklyTasks([emptyTask()]);
    setWeeklyResetDay(1);
    setWeeklyResetTime("00:00");
    setWeeklyReminder(0);
    setMonthlyTasks([emptyTask()]);
    setMonthlyResetDay("1");
    setMonthlyResetTime("00:00");
    setMonthlyReminder(0);
    setVersionTasks([emptyTask()]);
    setVersionReminder(0);
    setEditingGame(null);
    setTab("basic");
  };

  // Preserve any per-task fields (reset_day/time overrides, deadline_type, etc.) on save
  const validTasks = (arr) =>
    arr
      .filter((t) => t.name.trim())
      .map((t) => ({ ...t, name: t.name.trim(), completed: !!t.completed }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !gpath.trim()) {
      toast.error("請填寫遊戲名稱和路徑");
      setTab("basic");
      return;
    }

    const payload = {
      name,
      path: gpath,
      tasks: validTasks(dailyTasks),
      reset_time: dailyResetTime,
      daily_reminder_minutes: Number(dailyReminder),
      weekly_tasks: validTasks(weeklyTasks),
      weekly_reset_day: Number(weeklyResetDay),
      weekly_reset_time: weeklyResetTime,
      weekly_reminder_minutes: Number(weeklyReminder),
      monthly_tasks: validTasks(monthlyTasks),
      monthly_reset_day: String(monthlyResetDay),
      monthly_reset_time: monthlyResetTime,
      monthly_reminder_minutes: Number(monthlyReminder),
      version_tasks: validTasks(versionTasks),
      version_reminder_minutes: Number(versionReminder),
    };

    try {
      if (editingGame) {
        await axios.put(`${API}/games/${editingGame.id}`, payload);
        toast.success("遊戲已更新");
      } else {
        await axios.post(`${API}/games`, payload);
        toast.success("遊戲已新增");
      }
      setDialogOpen(false);
      resetForm();
      onGamesChange();
    } catch (error) {
      const detail = error?.response?.data?.detail || error?.message || "未知錯誤";
      toast.error("操作失敗: " + detail);
    }
  };

  const handleEdit = (game) => {
    setEditingGame(game);
    setName(game.name);
    setGpath(game.path);
    setDailyTasks((game.tasks || []).length > 0 ? game.tasks : [emptyTask()]);
    setDailyResetTime(game.reset_time || "00:00");
    setDailyReminder(game.daily_reminder_minutes || 0);
    setWeeklyTasks((game.weekly_tasks || []).length > 0 ? game.weekly_tasks : [emptyTask()]);
    setWeeklyResetDay(game.weekly_reset_day ?? 1);
    setWeeklyResetTime(game.weekly_reset_time || "00:00");
    setWeeklyReminder(game.weekly_reminder_minutes || 0);
    setMonthlyTasks((game.monthly_tasks || []).length > 0 ? game.monthly_tasks : [emptyTask()]);
    setMonthlyResetDay(String(game.monthly_reset_day ?? "1"));
    setMonthlyResetTime(game.monthly_reset_time || "00:00");
    setMonthlyReminder(game.monthly_reminder_minutes || 0);
    setVersionTasks((game.version_tasks || []).length > 0 ? game.version_tasks : [emptyTask()]);
    setVersionReminder(game.version_reminder_minutes || 0);
    setDialogOpen(true);
  };

  const handleDelete = async (gameId) => {
    if (!window.confirm("確定要刪除此遊戲嗎?")) return;
    try {
      await axios.delete(`${API}/games/${gameId}`);
      toast.success("遊戲已刪除");
      onGamesChange();
    } catch (error) {
      const detail = error?.response?.data?.detail || error?.message || "未知錯誤";
      toast.error("刪除失敗: " + detail);
    }
  };

  const proto = settings?.custom_protocol || "gamelauncher";

  return (
    <>
      <button
        onClick={onToggle}
        className="fixed top-4 left-4 z-50 lg:hidden p-2 rounded-md bg-[#141414] border border-[#262626] text-white"
        data-testid="sidebar-toggle"
      >
        {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>
      {isOpen && <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={onToggle} />}

      <aside
        className={`fixed lg:static top-0 left-0 h-screen w-64 bg-[#141414] border-r border-[#262626] z-40 transition-transform duration-300 ${isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
        data-testid="sidebar"
      >
        <div className="p-6 flex flex-col h-full">
          <div className="mb-6">
            <h2 className="text-2xl font-semibold tracking-tight text-neutral-100 mb-4">遊戲列表</h2>
            <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
              <DialogTrigger asChild>
                <Button className="w-full bg-[#00F0FF] hover:bg-[#00D0DD] text-[#0A0A0A] font-medium" data-testid="add-game-button">
                  <Plus className="w-4 h-4 mr-2" />
                  新增遊戲
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-[#141414] border-[#262626] text-white max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="game-dialog">
                <DialogHeader>
                  <DialogTitle className="text-white">{editingGame ? "編輯遊戲" : "新增遊戲"}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <Tabs value={tab} onValueChange={setTab}>
                    <TabsList className="grid grid-cols-5 w-full">
                      <TabsTrigger value="basic" data-testid="tab-basic">基本</TabsTrigger>
                      <TabsTrigger value="daily" data-testid="tab-daily">每日</TabsTrigger>
                      <TabsTrigger value="weekly" data-testid="tab-weekly">每周</TabsTrigger>
                      <TabsTrigger value="monthly" data-testid="tab-monthly">每月</TabsTrigger>
                      <TabsTrigger value="version" data-testid="tab-version">版本</TabsTrigger>
                    </TabsList>

                    <TabsContent value="basic" className="space-y-4 mt-4">
                      <div>
                        <Label className="text-neutral-400">遊戲名稱</Label>
                        <Input value={name} onChange={(e) => setName(e.target.value)} className="bg-[#0A0A0A] border-[#262626] text-white" placeholder="輸入遊戲名稱" data-testid="game-name-input" />
                      </div>
                      <div>
                        <Label className="text-neutral-400">遊戲檔案路徑</Label>
                        <div className="flex gap-2">
                          <Input value={gpath} onChange={(e) => setGpath(e.target.value)} className="bg-[#0A0A0A] border-[#262626] text-white flex-1" placeholder="C:\Games\game.exe" data-testid="game-path-input" />
                          <Button
                            type="button"
                            variant="outline"
                            onClick={handleBrowseFile}
                            className="border-[#262626] text-neutral-300 hover:text-white shrink-0"
                            title={isElectron ? "選擇檔案" : "僅桌面版可用"}
                            data-testid="browse-file-button"
                          >
                            <FolderOpen className="w-4 h-4 mr-1" />
                            瀏覽
                          </Button>
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent value="daily" className="space-y-4 mt-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label className="text-neutral-400 flex items-center gap-1"><Clock className="w-4 h-4" />重置時間</Label>
                          <Select value={dailyResetTime} onValueChange={setDailyResetTime}>
                            <SelectTrigger className="bg-[#0A0A0A] border-[#262626] text-white" data-testid="daily-reset-time"><SelectValue /></SelectTrigger>
                            <SelectContent className="bg-[#141414] border-[#262626] text-white max-h-72">
                              {TIME_OPTIONS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-neutral-400">提醒</Label>
                          <ReminderInput
                            value={dailyReminder}
                            onChange={setDailyReminder}
                            showDays={false}
                            testIdPrefix="daily-reminder"
                          />
                        </div>
                      </div>
                      <div>
                        <Label className="text-neutral-400">任務清單</Label>
                        <TaskListEditor tasks={dailyTasks} setTasks={setDailyTasks} testIdPrefix="daily-task" />
                      </div>
                    </TabsContent>

                    <TabsContent value="weekly" className="space-y-4 mt-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-neutral-400">重置日</Label>
                          <Select value={String(weeklyResetDay)} onValueChange={(v) => setWeeklyResetDay(Number(v))}>
                            <SelectTrigger className="bg-[#0A0A0A] border-[#262626] text-white" data-testid="weekly-reset-day"><SelectValue /></SelectTrigger>
                            <SelectContent className="bg-[#141414] border-[#262626] text-white">
                              {WEEKDAY_OPTIONS.map((w) => <SelectItem key={w.value} value={String(w.value)}>{w.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-neutral-400">重置時間</Label>
                          <Select value={weeklyResetTime} onValueChange={setWeeklyResetTime}>
                            <SelectTrigger className="bg-[#0A0A0A] border-[#262626] text-white" data-testid="weekly-reset-time"><SelectValue /></SelectTrigger>
                            <SelectContent className="bg-[#141414] border-[#262626] text-white max-h-72">
                              {TIME_OPTIONS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div>
                        <Label className="text-neutral-400">提醒</Label>
                        <ReminderInput
                          value={weeklyReminder}
                          onChange={setWeeklyReminder}
                          showDays={true}
                          testIdPrefix="weekly-reminder"
                        />
                      </div>
                      <div>
                        <Label className="text-neutral-400">每周任務清單 <span className="text-xs text-neutral-500">(每筆可自訂重置時間)</span></Label>
                        <TaskListEditor
                          tasks={weeklyTasks}
                          setTasks={setWeeklyTasks}
                          testIdPrefix="weekly-task"
                          renderExtra={(task, patch, index) => (
                            <WeeklyTaskSettings
                              task={task}
                              onChange={patch}
                              testIdPrefix={`weekly-task-settings-${index}`}
                            />
                          )}
                        />
                      </div>
                    </TabsContent>

                    <TabsContent value="monthly" className="space-y-4 mt-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-neutral-400">預設重置日</Label>
                          <Select value={String(monthlyResetDay)} onValueChange={setMonthlyResetDay}>
                            <SelectTrigger className="bg-[#0A0A0A] border-[#262626] text-white" data-testid="monthly-reset-day">
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
                          <Label className="text-neutral-400">預設重置時間</Label>
                          <Select value={monthlyResetTime} onValueChange={setMonthlyResetTime}>
                            <SelectTrigger className="bg-[#0A0A0A] border-[#262626] text-white" data-testid="monthly-reset-time">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-[#141414] border-[#262626] text-white max-h-72">
                              {TIME_OPTIONS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div>
                        <Label className="text-neutral-400">提醒</Label>
                        <ReminderInput
                          value={monthlyReminder}
                          onChange={setMonthlyReminder}
                          showDays={true}
                          testIdPrefix="monthly-reminder"
                        />
                      </div>
                      <div>
                        <Label className="text-neutral-400">每月任務清單 <span className="text-xs text-neutral-500">(每筆可自訂重置日期)</span></Label>
                        <TaskListEditor
                          tasks={monthlyTasks}
                          setTasks={setMonthlyTasks}
                          testIdPrefix="monthly-task"
                          renderExtra={(task, patch, index) => (
                            <MonthlyTaskSettings
                              task={task}
                              onChange={patch}
                              testIdPrefix={`monthly-task-settings-${index}`}
                            />
                          )}
                        />
                      </div>
                    </TabsContent>

                    <TabsContent value="version" className="space-y-4 mt-4">
                      <div>
                        <Label className="text-neutral-400">提醒 <span className="text-xs text-neutral-500">(適用所有版本任務)</span></Label>
                        <ReminderInput
                          value={versionReminder}
                          onChange={setVersionReminder}
                          showDays={true}
                          testIdPrefix="version-reminder"
                        />
                      </div>
                      <div>
                        <Label className="text-neutral-400">版本任務清單 <span className="text-xs text-neutral-500">(每筆獨立到期時間 + 循環)</span></Label>
                        <TaskListEditor
                          tasks={versionTasks}
                          setTasks={setVersionTasks}
                          testIdPrefix="version-task"
                          renderExtra={(task, patch, index) => (
                            <VersionTaskSettings
                              task={task}
                              onChange={patch}
                              testIdPrefix={`version-task-settings-${index}`}
                            />
                          )}
                        />
                      </div>
                    </TabsContent>
                  </Tabs>

                  <div className="flex gap-2 pt-4 border-t border-[#262626]">
                    <Button type="button" variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }} className="flex-1 border-[#262626] text-neutral-400 hover:text-white" data-testid="cancel-button">取消</Button>
                    <Button type="submit" className="flex-1 bg-[#00F0FF] hover:bg-[#00D0DD] text-[#0A0A0A]" data-testid="save-game-button">{editingGame ? "更新" : "新增"}</Button>
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
                games.map((game, index) => (
                  <div
                    key={game.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDrop={(e) => handleDrop(e, index)}
                    onDragEnd={handleDragEnd}
                    className={`group p-3 rounded-md bg-[#0A0A0A] border transition-all ${
                      dragIndex === index
                        ? "border-[#00F0FF] opacity-50"
                        : dragOverIndex === index
                          ? "border-[#00F0FF] scale-[1.02]"
                          : "border-[#262626] hover:border-[#404040]"
                    }`}
                    data-testid={`game-item-${game.id}`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-start gap-1.5 flex-1 min-w-0">
                        <GripVertical className="w-4 h-4 mt-0.5 text-neutral-600 cursor-grab active:cursor-grabbing shrink-0" data-testid={`drag-handle-${game.id}`} />
                        <h3 className="text-sm font-medium text-white truncate flex-1">{game.name}</h3>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => launchGame(game.path, game.name, proto)} className="p-1 rounded hover:bg-[#262626] text-[#39FF14]" title="啟動" data-testid={`launch-game-${game.id}`}><Rocket className="w-3 h-3" /></button>
                        <button onClick={() => copyGamePath(game.path, game.name)} className="p-1 rounded hover:bg-[#262626] text-[#00F0FF]" title="複製路徑" data-testid={`copy-path-${game.id}`}><Copy className="w-3 h-3" /></button>
                        <button onClick={() => handleEdit(game)} className="p-1 rounded hover:bg-[#262626] text-neutral-400" title="編輯" data-testid={`edit-game-${game.id}`}><Edit2 className="w-3 h-3" /></button>
                        <button onClick={() => handleDelete(game.id)} className="p-1 rounded hover:bg-[#262626] text-[#FF3B30]" title="刪除" data-testid={`delete-game-${game.id}`}><Trash2 className="w-3 h-3" /></button>
                      </div>
                    </div>
                    <div className="text-xs text-neutral-500 space-y-0.5 pl-5">
                      <div>日 {(game.tasks || []).length} / 週 {(game.weekly_tasks || []).length} / 月 {(game.monthly_tasks || []).length} / 版 {(game.version_tasks || []).length}</div>
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
