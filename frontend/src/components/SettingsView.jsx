import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import axios from "axios";
import { Bell, Save, Info, Download, Upload, Rocket, HelpCircle, Copy, Database, Trash2 } from "lucide-react";
import { downloadRegFile, generateRegFile } from "@/utils/launcher";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const RETENTION_OPTIONS = [
  { value: 0, label: "不自動刪除" },
  { value: 30, label: "30 天" },
  { value: 90, label: "90 天" },
  { value: 180, label: "180 天" },
  { value: 365, label: "365 天" },
];

function SettingsView({ settings, onSettingsChange, onDataChange }) {
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [customProtocol, setCustomProtocol] = useState("gamelauncher");
  const [historyRetentionDays, setHistoryRetentionDays] = useState(0);
  const [saving, setSaving] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const fileInputRef = useRef(null);
  const isElectron = typeof window !== "undefined" && !!window.electronAPI;

  useEffect(() => {
    if (settings) {
      setNotificationsEnabled(settings.notifications_enabled || false);
      setCustomProtocol(settings.custom_protocol || "gamelauncher");
      setHistoryRetentionDays(Number(settings.history_retention_days) || 0);
    }
  }, [settings]);

  const handleSave = async () => {
    if (!customProtocol.trim() || !/^[a-z][a-z0-9]*$/i.test(customProtocol)) {
      toast.error("協議名稱只能包含英文字母和數字,且需以字母開頭");
      return;
    }
    setSaving(true);
    try {
      await axios.put(`${API}/settings`, {
        notifications_enabled: notificationsEnabled,
        custom_protocol: customProtocol.toLowerCase(),
        history_retention_days: Number(historyRetentionDays) || 0,
      });
      toast.success("設定已儲存");
      onSettingsChange();
      if (notificationsEnabled && "Notification" in window && Notification.permission === "default") {
        await Notification.requestPermission();
      }
    } catch (error) {
      const detail = error?.response?.data?.detail || error?.message || "未知錯誤";
      toast.error("儲存失敗: " + detail);
    } finally {
      setSaving(false);
    }
  };

  const handleCleanupNow = async () => {
    if (historyRetentionDays <= 0) {
      toast.error("請先選擇保留天數");
      return;
    }
    if (!window.confirm(`確定要立即刪除 ${historyRetentionDays} 天前的所有歷史記錄?`)) return;
    try {
      const res = await axios.post(`${API}/daily-records/cleanup?retention_days=${historyRetentionDays}`);
      toast.success(`已清理 ${res.data.deleted || 0} 筆記錄`);
      onDataChange && onDataChange();
    } catch (error) {
      const detail = error?.response?.data?.detail || error?.message || "未知錯誤";
      toast.error("清理失敗: " + detail);
    }
  };

  const handleCopyReg = async () => {
    try {
      await navigator.clipboard.writeText(generateRegFile(customProtocol));
      toast.success(".reg 內容已複製");
    } catch {
      toast.error("複製失敗");
    }
  };

  const handleBackup = async () => {
    try {
      const res = await axios.get(`${API}/backup`);
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `daily-task-backup-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("備份已下載");
    } catch (error) {
      const detail = error?.response?.data?.detail || error?.message || "未知錯誤";
      toast.error("備份失敗: " + detail);
    }
  };

  const handleRestore = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!window.confirm("還原將覆蓋所有現有資料 (遊戲、設定、歷史記錄)!確定繼續嗎?")) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      await axios.post(`${API}/restore`, parsed);
      toast.success("資料已還原");
      onSettingsChange();
      onDataChange && onDataChange();
    } catch (error) {
      const detail = error?.response?.data?.detail || error?.message || "備份檔案格式錯誤";
      toast.error("還原失敗: " + detail);
    }
  };

  return (
    <div className="space-y-6" data-testid="settings-view">
      {/* Data Backup */}
      <div className="p-6 rounded-lg bg-[#141414] border border-[#262626] space-y-4">
        <h3 className="text-xl font-medium text-neutral-200 flex items-center gap-2">
          <Database className="w-5 h-5 text-[#39FF14]" />
          資料備份與還原
        </h3>
        <p className="text-sm text-neutral-400">
          定期備份您的遊戲、任務與歷史記錄,避免資料遺失。備份檔為 JSON 格式,可隨時還原。
        </p>
        <div className="flex gap-2 flex-wrap">
          <Button onClick={handleBackup} className="bg-[#39FF14]/10 border border-[#39FF14]/30 hover:border-[#39FF14] text-[#39FF14]" data-testid="backup-button">
            <Download className="w-4 h-4 mr-2" />
            下載備份
          </Button>
          <Button onClick={() => fileInputRef.current?.click()} variant="outline" className="border-[#262626] text-neutral-300 hover:text-white" data-testid="restore-button">
            <Upload className="w-4 h-4 mr-2" />
            還原備份
          </Button>
          <input ref={fileInputRef} type="file" accept=".json,application/json" onChange={handleRestore} style={{ display: "none" }} data-testid="restore-file-input" />
        </div>
      </div>

      {/* Launch Protocol */}
      <div className="p-6 rounded-lg bg-[#141414] border border-[#262626] space-y-6">
        <div>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <h3 className="text-xl font-medium text-neutral-200 flex items-center gap-2">
              <Rocket className="w-5 h-5 text-[#00F0FF]" />
              一鍵啟動設定
            </h3>
            <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="border-[#262626] text-neutral-400 hover:text-white" data-testid="help-button">
                  <HelpCircle className="w-4 h-4 mr-2" />
                  安裝教學
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-[#141414] border-[#262626] text-white max-w-2xl max-h-[85vh] overflow-y-auto" data-testid="help-dialog">
                <DialogHeader>
                  <DialogTitle className="text-white text-xl">安裝一鍵啟動協議教學</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 text-sm text-neutral-300">
                  <div className="p-3 rounded-md bg-[#00F0FF]/10 border border-[#00F0FF]/30">
                    <p className="text-[#00F0FF] font-medium">此功能僅適用於 Windows 網頁版</p>
                    <p className="text-xs text-neutral-400 mt-1">桌面版無需協議,可直接啟動任何 exe</p>
                  </div>
                  <div>
                    <h4 className="text-lg font-medium text-white mb-2">安裝步驟</h4>
                    <ol className="space-y-3 list-decimal list-inside">
                      <li>下載下方 .reg 檔案 → 雙點執行 → 「執行」→「是」</li>
                      <li>關閉並重新開啟瀏覽器</li>
                      <li>回到任務頁面,點擊「啟動」按鈕即可</li>
                    </ol>
                  </div>
                  <Button onClick={handleCopyReg} variant="outline" className="w-full border-[#262626] text-neutral-300 hover:text-white" data-testid="copy-reg-button">
                    <Copy className="w-4 h-4 mr-2" />複製 .reg 內容
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-neutral-400">自訂啟動協議名稱</Label>
              <div className="flex gap-2 items-center flex-wrap">
                <Input value={customProtocol} onChange={(e) => setCustomProtocol(e.target.value)} className="bg-[#0A0A0A] border-[#262626] text-white max-w-xs" data-testid="protocol-input" />
                <span className="text-neutral-500 text-sm">://path/to/game.exe</span>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button onClick={() => downloadRegFile(customProtocol)} className="bg-[#00F0FF] hover:bg-[#00D0DD] text-[#0A0A0A]" data-testid="download-reg-button">
                <Download className="w-4 h-4 mr-2" />下載 .reg 檔案
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* History Retention */}
      <div className="p-6 rounded-lg bg-[#141414] border border-[#262626] space-y-4">
        <h3 className="text-xl font-medium text-neutral-200 flex items-center gap-2">
          <Trash2 className="w-5 h-5 text-[#FFB800]" />
          歷史記錄自動清理
        </h3>
        <p className="text-sm text-neutral-400">
          自動刪除超過保留期的舊歷史記錄以節省空間。選擇「不自動刪除」則永久保留。
        </p>
        <div className="flex items-center gap-3 flex-wrap">
          <Select value={String(historyRetentionDays)} onValueChange={(v) => setHistoryRetentionDays(Number(v))}>
            <SelectTrigger className="w-40 bg-[#0A0A0A] border-[#262626] text-white" data-testid="retention-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#141414] border-[#262626] text-white">
              {RETENTION_OPTIONS.map((r) => (
                <SelectItem key={r.value} value={String(r.value)}>{r.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            onClick={handleCleanupNow}
            disabled={historyRetentionDays <= 0}
            className="border-[#262626] text-neutral-300 hover:text-white"
            data-testid="cleanup-now-button"
          >
            立即清理
          </Button>
        </div>
      </div>

      {/* Notifications */}
      <div className="p-6 rounded-lg bg-[#141414] border border-[#262626]">
        <h3 className="text-xl font-medium text-neutral-200 mb-4">通知設定</h3>
        {isElectron ? (
          <div className="flex items-start gap-3 py-2">
            <Bell className="w-5 h-5 text-[#39FF14] flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <Label className="text-neutral-200">桌面通知已自動啟用</Label>
              <p className="text-xs text-neutral-500">
                任務重置及提醒會以系統原生通知顯示 (Windows Action Center / macOS 通知中心)
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between py-4">
            <div className="space-y-1">
              <Label className="flex items-center gap-2 text-neutral-400">
                <Bell className="w-4 h-4" />啟用瀏覽器通知
              </Label>
              <p className="text-xs text-neutral-500">在任務重置及提醒時間發送通知</p>
            </div>
            <Switch checked={notificationsEnabled} onCheckedChange={setNotificationsEnabled} data-testid="notifications-switch" />
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <Button onClick={handleSave} disabled={saving} className="bg-[#00F0FF] hover:bg-[#00D0DD] text-[#0A0A0A] font-medium" data-testid="save-settings-button">
          <Save className="w-4 h-4 mr-2" />
          {saving ? "儲存中..." : "儲存設定"}
        </Button>
      </div>

      <div className="p-6 rounded-lg bg-[#141414] border border-[#262626]">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-[#00F0FF] flex-shrink-0 mt-0.5" />
          <div className="space-y-2">
            <h3 className="text-xl font-medium text-neutral-200">使用說明</h3>
            <div className="text-sm text-neutral-400 space-y-2">
              <p>• 每個遊戲支援三種任務: 每日、每周、版本 (期限任務)</p>
              <p>• 每種任務可各自設定重置時間與提醒時間</p>
              <p>• 同一時間的多個提醒會合併為單一通知</p>
              <p>• 版本任務可手動歸檔,或到期後在「版本」分頁點擊歸檔</p>
              <p>• 請定期使用「下載備份」保存資料,避免資料遺失</p>
              <p>• 歷史記錄可依「每日/每周/版本」分頁查看與篩選</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SettingsView;
