import { toast } from "sonner";

/**
 * Launch a game via URI protocol or custom protocol.
 * - If path contains "://" (e.g., steam://, epic://), open directly.
 * - Otherwise, use the custom protocol registered in Windows (default: gamelauncher).
 */
export function launchGame(path, name, customProtocol = "gamelauncher") {
  if (!path) {
    toast.error("未設定遊戲路徑");
    return;
  }

  try {
    let launchUri;

    if (path.includes("://")) {
      launchUri = path;
    } else {
      launchUri = `${customProtocol}://${encodeURIComponent(path)}`;
    }

    // Use an invisible iframe to trigger the protocol without navigating away
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

export async function copyGamePath(path, name) {
  try {
    await navigator.clipboard.writeText(path);
    toast.success(`${name} 路徑已複製`);
  } catch (error) {
    console.error("Copy error:", error);
    toast.error("複製失敗");
  }
}

export function generateRegFile(protocol) {
  return `Windows Registry Editor Version 5.00\r\n\r\n[HKEY_CLASSES_ROOT\\${protocol}]\r\n@="URL:${protocol} Protocol"\r\n"URL Protocol"=""\r\n\r\n[HKEY_CLASSES_ROOT\\${protocol}\\DefaultIcon]\r\n@="powershell.exe,0"\r\n\r\n[HKEY_CLASSES_ROOT\\${protocol}\\shell]\r\n\r\n[HKEY_CLASSES_ROOT\\${protocol}\\shell\\open]\r\n\r\n[HKEY_CLASSES_ROOT\\${protocol}\\shell\\open\\command]\r\n@="powershell.exe -WindowStyle Hidden -Command \\"Add-Type -AssemblyName System.Web; $uri = '%1' -replace '^${protocol}:/*',''; $p = [System.Web.HttpUtility]::UrlDecode($uri); if (Test-Path $p) { Start-Process $p } else { Add-Type -AssemblyName PresentationFramework; [System.Windows.MessageBox]::Show('找不到檔案: ' + $p) }\\""\r\n`;
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
