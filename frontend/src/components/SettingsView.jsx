import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import axios from "axios";
import { Bell, Save, Info, Download, Rocket, HelpCircle, Copy } from "lucide-react";
import { downloadRegFile, generateRegFile } from "@/utils/launcher";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function SettingsView({ settings, onSettingsChange }) {
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [customProtocol, setCustomProtocol] = useState("gamelauncher");
  const [saving, setSaving] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    if (settings) {
      setNotificationsEnabled(settings.notifications_enabled || false);
      setCustomProtocol(settings.custom_protocol || "gamelauncher");
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
        custom_protocol: customProtocol.toLowerCase()
      });
      
      toast.success("設定已儲存");
      onSettingsChange();
      
      if (notificationsEnabled && "Notification" in window && Notification.permission === "default") {
        const permission = await Notification.requestPermission();
        if (permission === "granted") {
          toast.success("通知權限已授予");
        }
      }
    } catch (error) {
      const detail = error?.response?.data?.detail || error?.response?.data?.error || error?.message || "未知錯誤";
      toast.error("儲存失敗: " + detail);
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const handleCopyReg = async () => {
    try {
      await navigator.clipboard.writeText(generateRegFile(customProtocol));
      toast.success(".reg 內容已複製到剪貼板");
    } catch (error) {
      const detail = error?.response?.data?.detail || error?.response?.data?.error || error?.message || "未知錯誤";
      toast.error("複製失敗: " + detail);
    }
  };

  return (
    <div className="space-y-6" data-testid="settings-view">
      {/* Launch Protocol Settings */}
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
                    <p className="text-[#00F0FF] font-medium">此功能僅適用於 Windows 作業系統</p>
                    <p className="text-xs text-neutral-400 mt-1">需要一次性註冊自訂協議,完成後即可以一鍵啟動任何 exe 遊戲</p>
                  </div>

                  <div>
                    <h4 className="text-lg font-medium text-white mb-2">安裝步驟</h4>
                    <ol className="space-y-3 list-decimal list-inside">
                      <li>
                        <span className="font-medium text-white">下載 .reg 檔案</span>
                        <p className="text-neutral-400 ml-6 mt-1">點擊下方「下載 .reg 檔案」按鈕,下載名為 <code className="px-1 bg-[#0A0A0A] rounded text-[#00F0FF]">{customProtocol}-protocol.reg</code> 的檔案</p>
                      </li>
                      <li>
                        <span className="font-medium text-white">執行 .reg 檔案</span>
                        <p className="text-neutral-400 ml-6 mt-1">雙點檔案,在彈出的安全警告中點擊「執行」→「是」→「確定」</p>
                      </li>
                      <li>
                        <span className="font-medium text-white">重新整理瀏覽器</span>
                        <p className="text-neutral-400 ml-6 mt-1">關閉並重新打開瀏覽器,確保協議已被識別</p>
                      </li>
                      <li>
                        <span className="font-medium text-white">測試啟動</span>
                        <p className="text-neutral-400 ml-6 mt-1">回到任務頁面,點擊任何遊戲旁的「啟動」按鈕,首次使用時瀏覽器會詢問是否允許開啟外部應用程式,點擊允許即可</p>
                      </li>
                    </ol>
                  </div>

                  <div>
                    <h4 className="text-lg font-medium text-white mb-2">工作原理</h4>
                    <p className="text-neutral-400">.reg 檔案會在 Windows 註冊表中新增一個自訂協議 <code className="px-1 bg-[#0A0A0A] rounded text-[#00F0FF]">{customProtocol}://</code>,當您點擊啟動按鈕時,瀏覽器會呼叫 PowerShell 執行您指定的 exe 檔案。</p>
                  </div>

                  <div>
                    <h4 className="text-lg font-medium text-white mb-2">如何移除</h4>
                    <p className="text-neutral-400">如需移除協議,可以於註冊表編輯器 (regedit) 中手動刪除 <code className="px-1 bg-[#0A0A0A] rounded text-[#00F0FF]">HKEY_CLASSES_ROOT\{customProtocol}</code> 節點。</p>
                  </div>

                  <div>
                    <h4 className="text-lg font-medium text-white mb-2">Steam / Epic 遊戲</h4>
                    <p className="text-neutral-400">對於 Steam、Epic、Battle.net 等平台遊戲,不需要註冊自訂協議。直接在遊戲路徑欄位輸入以下 URI:</p>
                    <ul className="mt-2 space-y-1 ml-4 text-xs">
                      <li>Steam: <code className="px-1 bg-[#0A0A0A] rounded text-[#00F0FF]">steam://rungameid/1234</code></li>
                      <li>Epic: <code className="px-1 bg-[#0A0A0A] rounded text-[#00F0FF]">com.epicgames.launcher://apps/xxx?action=launch</code></li>
                      <li>Battle.net: <code className="px-1 bg-[#0A0A0A] rounded text-[#00F0FF]">battlenet://WoW</code></li>
                    </ul>
                  </div>

                  <div className="pt-2 border-t border-[#262626]">
                    <Button
                      onClick={handleCopyReg}
                      variant="outline"
                      className="w-full border-[#262626] text-neutral-300 hover:text-white"
                      data-testid="copy-reg-button"
                    >
                      <Copy className="w-4 h-4 mr-2" />
                      複製 .reg 內容到剪貼板
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="protocol" className="text-neutral-400">自訂啟動協議名稱</Label>
              <div className="flex gap-2 items-center flex-wrap">
                <Input
                  id="protocol"
                  value={customProtocol}
                  onChange={(e) => setCustomProtocol(e.target.value)}
                  className="bg-[#0A0A0A] border-[#262626] text-white max-w-xs"
                  placeholder="gamelauncher"
                  data-testid="protocol-input"
                />
                <span className="text-neutral-500 text-sm">://path/to/game.exe</span>
              </div>
              <p className="text-xs text-neutral-500">
                使用自訂協議來啟動本地 exe 檔案。只能包含英文字母和數字,需字母開頭。
              </p>
            </div>

            <div className="flex gap-2 flex-wrap">
              <Button
                onClick={() => downloadRegFile(customProtocol)}
                className="bg-[#00F0FF] hover:bg-[#00D0DD] text-[#0A0A0A] font-medium"
                data-testid="download-reg-button"
              >
                <Download className="w-4 h-4 mr-2" />
                下載 .reg 檔案
              </Button>
              <Button
                variant="outline"
                onClick={() => setHelpOpen(true)}
                className="border-[#262626] text-neutral-300 hover:text-white"
                data-testid="open-help-button"
              >
                <HelpCircle className="w-4 h-4 mr-2" />
                查看安裝教學
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Notifications */}
      <div className="p-6 rounded-lg bg-[#141414] border border-[#262626]">
        <h3 className="text-xl font-medium text-neutral-200 mb-4">通知設定</h3>
        
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

      {/* Save button */}
      <div className="flex gap-3">
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

      {/* Info panel */}
      <div className="p-6 rounded-lg bg-[#141414] border border-[#262626]">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-[#00F0FF] flex-shrink-0 mt-0.5" />
          <div className="space-y-2">
            <h3 className="text-xl font-medium text-neutral-200">使用說明</h3>
            <div className="text-sm text-neutral-400 space-y-2">
              <p>每個遊戲都有獨立的重置時間設定</p>
              <p>到達設定時間時,該遊戲的任務會自動記錄並重置</p>
              <p>完成一鍵啟動協議安裝後,可直接點擊「啟動」按鈕開啟本地 exe 遊戲</p>
              <p>Steam/Epic 等平台遊戲可直接使用它們的 URI (如 steam://rungameid/xxx)</p>
              <p>歷史記錄頁面可以按遊戲篩選,查看特定遊戲的完成紀錄</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SettingsView;
