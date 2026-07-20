import { useEffect, useState } from "react";
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

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function App() {
  const [games, setGames] = useState([]);
  const [settings, setSettings] = useState(null);
  const [activeTab, setActiveTab] = useState("tasks");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    // Diagnostic: check Electron API availability
    if (typeof window !== "undefined") {
      console.log("[App] window.electronAPI:", window.electronAPI);
      if (window.electronAPI?.request) {
        window.electronAPI
          .request({ method: "GET", url: "/api/" })
          .then((r) => console.log("[App] IPC test OK:", r))
          .catch((e) => console.error("[App] IPC test failed:", e));
      } else {
        console.warn("[App] Not running in Electron or electronAPI not exposed");
      }
    }

    fetchGames();
    fetchSettings();
    checkAutoReset();

    // Check for auto-reset every minute
    const interval = setInterval(checkAutoReset, 60000);
    return () => clearInterval(interval);
  }, []);

  const fetchGames = async () => {
    try {
      const response = await axios.get(`${API}/games`);
      setGames(response.data);
    } catch (e) {
      console.error("Error fetching games:", e);
    }
  };

  const fetchSettings = async () => {
    try {
      const response = await axios.get(`${API}/settings`);
      setSettings(response.data);
    } catch (e) {
      console.error("Error fetching settings:", e);
    }
  };

  const checkAutoReset = async () => {
    try {
      const gamesRes = await axios.get(`${API}/games`);
      const currentGames = gamesRes.data;

      const now = new Date();
      const today = now.toISOString().split('T')[0];

      for (const game of currentGames) {
        if (!game.reset_time) continue;

        const [hours, minutes] = game.reset_time.split(':');
        const resetTime = new Date();
        resetTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);

        // Check if we've passed the reset time and haven't reset today
        if (now >= resetTime && game.last_reset_date !== today) {
          // Reset this game
          await axios.post(`${API}/games/reset-game`, { game_id: game.id });
          
          if (settings?.notifications_enabled && "Notification" in window && Notification.permission === "granted") {
            new Notification(`${game.name} 已重置`, {
              body: "每日任務已自動重置",
              icon: "/favicon.ico"
            });
          }
          
          toast.success(`${game.name} 已自動重置`);
        }
      }

      // Refresh games after any resets
      fetchGames();
    } catch (e) {
      console.error("Error checking auto-reset:", e);
    }
  };

  const requestNotificationPermission = async () => {
    if ("Notification" in window && Notification.permission === "default") {
      await Notification.requestPermission();
    }
  };

  useEffect(() => {
    if (settings?.notifications_enabled) {
      requestNotificationPermission();
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
                管理您的遊戲日常任務,追蹤完成進度
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
                <SettingsView settings={settings} onSettingsChange={fetchSettings} />
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;