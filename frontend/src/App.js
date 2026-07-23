import { useEffect, useState, useCallback } from "react";
import "@/App.css";
import axios from "axios";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import Sidebar from "@/components/Sidebar";
import TasksView from "@/components/TasksView";
import HistoryView from "@/components/HistoryView";
import SettingsView from "@/components/SettingsView";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckSquare, History, Settings } from "lucide-react";
import { shouldResetGames, checkAndFireReminders, computePerTaskResets } from "@/utils/reminders";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function App() {
  const [games, setGames] = useState([]);
  const [settings, setSettings] = useState(null);
  const [activeTab, setActiveTab] = useState("tasks");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const fetchGames = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/games`);
      setGames(response.data);
    } catch (e) {
      console.error("Error fetching games:", e);
    }
  }, []);

  const fetchSettings = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/settings`);
      setSettings(response.data);
    } catch (e) {
      console.error("Error fetching settings:", e);
    }
  }, []);

  const runAutoReset = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/games`);
      const current = res.data;
      const toReset = shouldResetGames(current);

      const notified = [];
      for (const item of toReset) {
        try {
          if (item.type === "daily") {
            await axios.post(`${API}/games/reset-daily`, { game_id: item.gameId });
          } else if (item.type === "weekly") {
            await axios.post(`${API}/games/reset-weekly`, { game_id: item.gameId });
          } else if (item.type === "monthly") {
            await axios.post(`${API}/games/reset-monthly`, { game_id: item.gameId });
          }
          const typeLabel = item.type === "monthly" ? "每月" : item.type === "weekly" ? "每周" : "每日";
          notified.push(`${item.gameName} - ${typeLabel}任務`);
        } catch (err) {
          console.error("Reset failed:", err);
        }
      }

      // Per-task resets (weekly override + monthly override + version cycle)
      const perTask = computePerTaskResets(current);
      for (const patch of perTask) {
        try {
          const body = {};
          if (patch.weekly_tasks) body.weekly_tasks = patch.weekly_tasks;
          if (patch.monthly_tasks) body.monthly_tasks = patch.monthly_tasks;
          if (patch.version_tasks) body.version_tasks = patch.version_tasks;
          await axios.put(`${API}/games/${patch.gameId}`, body);
          notified.push(`${patch.gameName} - 個別任務`);
        } catch (err) {
          console.error("Per-task reset failed:", err);
        }
      }

      if (notified.length > 0) {
        toast.success(`已自動重置: ${notified.join(", ")}`);
        fetchGames();
      }
    } catch (e) {
      console.error("Auto-reset error:", e);
    }
  }, [fetchGames]);

  const runReminders = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/games`);
      const current = res.data;
      const isElectron = typeof window !== "undefined" && !!window.electronAPI;
      // In Electron, notifications are always enabled (native OS notifications).
      // In web mode, respect the settings toggle.
      const enabled = isElectron ? true : settings?.notifications_enabled !== false;
      checkAndFireReminders(current, {
        enabled,
        useElectron: isElectron,
      });
    } catch (e) {
      console.error("Reminder check error:", e);
    }
  }, [settings?.notifications_enabled]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      console.log("[App] window.electronAPI:", window.electronAPI);
    }
    fetchGames();
    fetchSettings();
  }, [fetchGames, fetchSettings]);

  // Run history cleanup once on startup and hourly, based on settings
  useEffect(() => {
    const runCleanup = async () => {
      const days = Number(settings?.history_retention_days) || 0;
      if (days <= 0) return;
      try {
        await axios.post(`${API}/daily-records/cleanup?retention_days=${days}`);
      } catch (e) {
        console.error("History cleanup error:", e);
      }
    };
    runCleanup();
    const interval = setInterval(runCleanup, 3600_000); // hourly
    return () => clearInterval(interval);
  }, [settings?.history_retention_days]);

  useEffect(() => {
    runAutoReset();
    runReminders();
    const interval = setInterval(() => {
      runAutoReset();
      runReminders();
    }, 60000);
    return () => clearInterval(interval);
  }, [runAutoReset, runReminders]);

  useEffect(() => {
    if (settings?.notifications_enabled && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, [settings?.notifications_enabled]);

  return (
    <div className="App min-h-screen">
      <Toaster position="top-right" richColors />
      <div className="flex">
        <Sidebar
          games={games}
          onGamesChange={fetchGames}
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen(!sidebarOpen)}
          settings={settings}
        />

        <main className="flex-1 p-6 md:p-12">
          <div className="max-w-7xl mx-auto">
            <header className="mb-8">
              <h1 className="text-4xl font-bold tracking-tight text-white mb-2" data-testid="main-title">
                每日任務管理器
              </h1>
              <p className="text-base text-neutral-400">
                管理您的遊戲日常、每周與版本任務,追蹤完成進度
              </p>
            </header>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full max-w-md grid-cols-3 mb-8" data-testid="main-tabs">
                <TabsTrigger value="tasks" className="flex items-center gap-2" data-testid="tasks-tab">
                  <CheckSquare className="w-4 h-4" />
                  <span className="hidden sm:inline">任務</span>
                </TabsTrigger>
                <TabsTrigger value="history" className="flex items-center gap-2" data-testid="history-tab">
                  <History className="w-4 h-4" />
                  <span className="hidden sm:inline">歷史</span>
                </TabsTrigger>
                <TabsTrigger value="settings" className="flex items-center gap-2" data-testid="settings-tab">
                  <Settings className="w-4 h-4" />
                  <span className="hidden sm:inline">設定</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="tasks" className="mt-0">
                <TasksView games={games} onGamesChange={fetchGames} settings={settings} />
              </TabsContent>

              <TabsContent value="history" className="mt-0">
                <HistoryView games={games} />
              </TabsContent>

              <TabsContent value="settings" className="mt-0">
                <SettingsView settings={settings} onSettingsChange={fetchSettings} onDataChange={fetchGames} />
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
