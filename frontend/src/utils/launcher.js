import { toast } from "sonner";

/**
 * Launch a game via URI protocol or custom protocol.
 */
export function launchGame(path, name, customProtocol = "gamelauncher") {
  if (!path) {
    toast.error("未設定遊戲路徑");
    return;
  }

  // Electron desktop mode - use native IPC (no protocol needed!)
  if (typeof window !== "undefined" && window.electronAPI?.launchGame) {
    window.electronAPI
      .launchGame(path)
      .then((result) => {
        if (result?.success) {
          toast.success(`正在啟動 ${name}`);
        } else {
          toast.error(`啟動失敗: ${result?.error || "未知錯誤"}`);
        }
      })
      .catch((err) => {
        toast.error(`啟動失敗: ${err.message}`);
      });
    return;
  }

  // Web browser mode - use custom URI protocol
  try {
    let launchUri;

    if (path.includes("://")) {
      launchUri = path;
    } else {
      launchUri = `${customProtocol}://${encodeURIComponent(path)}`;
    }

    const iframe = document.createElement("iframe");
    iframe.style.display = "none";
    iframe.src = launchUri;
    document.body.appendChild(iframe);
    setTimeout(() => {
      if (iframe.parentNode) document.body.removeChild(iframe);
    }, 2000);

    toast.success(`正在啟動 ${name}`);
  } catch (error) {
    console.error("Launch error:", error);
    toast.error("啟動失敗,請檢查自訂協議是否已註冊");
  }
}

/**
 * Copy path with fallback for browsers where Clipboard API is restricted
 * (e.g., iframe context, no focus, permission denied).
 */
export async function copyGamePath(path, name) {
  // Try modern Clipboard API first
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(path);
      toast.success(`${name} 路徑已複製`);
      return;
    } catch (err) {
      console.warn("[Copy] Clipboard API failed, trying fallback:", err);
    }
  }

  // Fallback using document.execCommand (works in more contexts)
  try {
    const textarea = document.createElement("textarea");
    textarea.value = path;
    textarea.style.position = "fixed";
    textarea.style.top = "0";
    textarea.style.left = "0";
    textarea.style.opacity = "0";
    textarea.style.pointerEvents = "none";
    textarea.setAttribute("readonly", "");
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
    const success = document.execCommand("copy");
    document.body.removeChild(textarea);

    if (success) {
      toast.success(`${name} 路徑已複製`);
    } else {
      toast.error("複製失敗,請手動選取路徑");
    }
  } catch (err) {
    console.error("[Copy] Fallback failed:", err);
    toast.error("複製失敗: " + (err.message || "未知錯誤"));
  }
}

export function generateRegFile(protocol) {
  // PowerShell strips protocol prefix AND trailing slash (Windows appends '/' to URIs)
  return `Windows Registry Editor Version 5.00\r\n\r\n[HKEY_CLASSES_ROOT\\${protocol}]\r\n@="URL:${protocol} Protocol"\r\n"URL Protocol"=""\r\n\r\n[HKEY_CLASSES_ROOT\\${protocol}\\DefaultIcon]\r\n@="powershell.exe,0"\r\n\r\n[HKEY_CLASSES_ROOT\\${protocol}\\shell]\r\n\r\n[HKEY_CLASSES_ROOT\\${protocol}\\shell\\open]\r\n\r\n[HKEY_CLASSES_ROOT\\${protocol}\\shell\\open\\command]\r\n@="powershell.exe -WindowStyle Hidden -Command \\"Add-Type -AssemblyName System.Web; $uri = '%1' -replace '^${protocol}:/*','' -replace '/+$',''; $p = [System.Web.HttpUtility]::UrlDecode($uri); if (Test-Path -LiteralPath $p) { Start-Process -FilePath $p } else { Add-Type -AssemblyName PresentationFramework; [System.Windows.MessageBox]::Show('找不到檔案: ' + $p) }\\""\r\n`;
}

export function downloadRegFile(protocol) {
  const content = generateRegFile(protocol);
  const blob = new Blob(["\uFEFF" + content], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${protocol}-protocol.reg`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  toast.success(".reg 檔案已下載");
}
