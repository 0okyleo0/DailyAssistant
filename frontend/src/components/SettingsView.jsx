import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import axios from "axios";
import { Bell, Save, Info } from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function SettingsView({ settings, onSettingsChange }) {
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings) {
      setNotificationsEnabled(settings.notifications_enabled || false);
    }
  }, [settings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await axios.put(`${API}/settings`, {
        notifications_enabled: notificationsEnabled
      });
      
      toast.success("設定已儲存");
      onSettingsChange();
      
      // Request notification permission if enabled
      if (notificationsEnabled && "Notification" in window && Notification.permission === "default") {
        const permission = await Notification.requestPermission();
        if (permission === "granted") {
          toast.success("通知權限已授予");
        } else {
          toast.error("通知權限被拒絕");
        }
      }
    } catch (error) {
      toast.error("儲存失敗");
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="settings-view">
      <div className="p-6 rounded-lg bg-[#141414] border border-[#262626] space-y-6">
        <div>
          <h3 className="text-xl font-medium text-neutral-200 mb-4">通知設定</h3>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between py-4">
              <div className="space-y-1">
                <Label htmlFor="notifications" className="flex items-center gap-2 text-neutral-400">
                  <Bell className="w-4 h-4" />
                  啟用瀏覽器通知
                </Label>
                <p className="text-xs text-neutral-500">
                  在遊戲任務自動重置時接收通知提醒
                </p>
              </div>
              <Switch
                id="notifications"
                checked={notificationsEnabled}
                onCheckedChange={setNotificationsEnabled}
                data-testid="notifications-switch"
              />
            </div>
          </div>
        </div>

        <div className="flex gap-3 pt-4 border-t border-[#262626]">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-[#00F0FF] hover:bg-[#00D0DD] text-[#0A0A0A] font-medium"
            data-testid="save-settings-button"
          >
            <Save className="w-4 h-4 mr-2" />
            {saving ? "儲存中..." : "儲存設定"}
          </Button>
        </div>
      </div>

      <div className="p-6 rounded-lg bg-[#141414] border border-[#262626] space-y-4">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-[#00F0FF] flex-shrink-0 mt-0.5" />
          <div className="space-y-2">
            <h3 className="text-xl font-medium text-neutral-200">使用說明</h3>
            <div className="text-sm text-neutral-400 space-y-2">
              <p>• 每個遊戲都有獨立的重置時間設定</p>
              <p>• 到達設定時間時,該遊戲的任務會自動記錄並重置</p>
              <p>• 點擊側邊欄或任務頁面的「複製路徑」按鈕即可將遊戲路徑複製到剪貼板</p>
              <p>• 複製後可以在檔案總管或執行視窗中貼上開啟遊戲</p>
              <p>• 歷史記錄頁面可以按遊戲篩選,查看特定遊戲的完成紀錄</p>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 rounded-lg bg-[#141414] border border-[#262626] space-y-2">
        <h3 className="text-xl font-medium text-neutral-200">系統資訊</h3>
        <div className="text-sm space-y-1">
          <p className="text-neutral-400">
            <span className="text-neutral-500">通知狀態:</span> <span className="text-white font-medium">{notificationsEnabled ? "已啟用" : "未啟用"}</span>
          </p>
          <p className="text-neutral-400">
            <span className="text-neutral-500">版本:</span> <span className="text-white font-medium">1.0.0</span>
          </p>
        </div>
      </div>
    </div>
  );
}

export default SettingsView;