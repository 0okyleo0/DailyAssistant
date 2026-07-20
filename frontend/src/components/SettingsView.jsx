import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import axios from "axios";
import { Bell, Clock, Save } from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function SettingsView({ settings, onSettingsChange }) {
  const [resetTime, setResetTime] = useState("00:00");
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings) {
      setResetTime(settings.reset_time || "00:00");
      setNotificationsEnabled(settings.notifications_enabled || false);
    }
  }, [settings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await axios.put(`${API}/settings`, {
        reset_time: resetTime,
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

  const handleManualReset = async () => {
    if (!window.confirm("確定要立即重置所有任務嗎? 當前狀態將被記錄。")) return;
    
    try {
      // Save current state
      await axios.post(`${API}/daily-records/save`);
      
      // Uncheck all tasks
      await axios.post(`${API}/games/uncheck-all`);
      
      toast.success("任務已手動重置");
      window.location.reload();
    } catch (error) {
      toast.error("重置失敗");
      console.error(error);
    }
  };

  return (
    <div className="space-y-6" data-testid="settings-view">
      <div className="p-6 rounded-lg bg-[#141414] border border-[#262626] space-y-6">
        <div>
          <h3 className="text-xl font-medium text-neutral-200 mb-4">基本設定</h3>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reset-time" className="flex items-center gap-2 text-neutral-400">
                <Clock className="w-4 h-4" />
                每日重置時間
              </Label>
              <Input
                id="reset-time"
                type="time"
                value={resetTime}
                onChange={(e) => setResetTime(e.target.value)}
                className="bg-[#0A0A0A] border-[#262626] text-white max-w-xs"
                data-testid="reset-time-input"
              />
              <p className="text-xs text-neutral-500">
                到達設定時間時,系統將自動記錄當日完成狀況並重置所有任務
              </p>
            </div>

            <div className="flex items-center justify-between py-4">
              <div className="space-y-1">
                <Label htmlFor="notifications" className="flex items-center gap-2 text-neutral-400">
                  <Bell className="w-4 h-4" />
                  啟用瀏覽器通知
                </Label>
                <p className="text-xs text-neutral-500">
                  在任務重置時接收通知提醒
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
        <div>
          <h3 className="text-xl font-medium text-neutral-200 mb-2">危險區域</h3>
          <p className="text-sm text-neutral-500">
            以下操作將影響您的任務狀態,請謹慎操作
          </p>
        </div>
        
        <Button
          variant="destructive"
          onClick={handleManualReset}
          className="bg-[#FF3B30] hover:bg-[#FF3B30]/90"
          data-testid="manual-reset-button"
        >
          <Clock className="w-4 h-4 mr-2" />
          手動重置所有任務
        </Button>
      </div>

      <div className="p-6 rounded-lg bg-[#141414] border border-[#262626] space-y-2">
        <h3 className="text-xl font-medium text-neutral-200">系統資訊</h3>
        <div className="text-sm space-y-1">
          <p className="text-neutral-400">
            <span className="text-neutral-500">當前重置時間:</span> <span className="text-white font-medium">{settings?.reset_time || "未設定"}</span>
          </p>
          <p className="text-neutral-400">
            <span className="text-neutral-500">上次重置日期:</span> <span className="text-white font-medium">{settings?.last_reset_date || "未記錄"}</span>
          </p>
          <p className="text-neutral-400">
            <span className="text-neutral-500">通知狀態:</span> <span className="text-white font-medium">{notificationsEnabled ? "已啟用" : "未啟用"}</span>
          </p>
        </div>
      </div>
    </div>
  );
}

export default SettingsView;