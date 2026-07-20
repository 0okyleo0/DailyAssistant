# 程式碼簽章憑證指南

## 為什麼需要簽章憑證？

當使用者下載並執行未簽章的 `.exe` 檔案時，Windows 會顯示：
- **Windows Defender SmartScreen** 警告：「Windows 已保護您的電腦」
- **未知發行者** 警告：需要點擊「更多資訊」→「仍要執行」才能繼續

簽章憑證可以：
- 證明應用程式的真實來源
- 避免防毒軟體誤報
- 提升使用者信任度

---

## 三種取得憑證的方式

### 選項 1: 購買正式簽章憑證（推薦用於發佈）

從受信任的憑證授權單位 (CA) 購買：

| 提供商 | 標準憑證 (OV) | EV 憑證 |
|--------|-------------|--------|
| **DigiCert** | 約 $474/年 | 約 $699/年 |
| **Sectigo** | 約 $199/年 | 約 $349/年 |
| **SSL.com** | 約 $159/年 | 約 $349/年 |
| **Comodo** | 約 $179/年 | 約 $299/年 |

**兩種類型的差異：**
- **OV (Organization Validation)**: 標準等級，仍需累積下載量才能取得 SmartScreen 信任
- **EV (Extended Validation)**: 立即獲得 SmartScreen 信任，強烈推薦

**購買步驟：**
1. 提交身份/組織驗證資料
2. CA 驗證通過後（通常 1-5 天）
3. 收到 `.pfx` 憑證檔案（或硬體 USB Token）
4. 記下憑證密碼

**使用購買的憑證：**
```bash
# Windows CMD
cd desktop
set CSC_LINK=C:\path\to\your-certificate.pfx
set CSC_KEY_PASSWORD=your_password
yarn dist

# PowerShell
$env:CSC_LINK="C:\path\to\your-certificate.pfx"
$env:CSC_KEY_PASSWORD="your_password"
yarn dist
```

### 選項 2: 自簽憑證（僅供內部測試）

⚠️ **重要限制**：
- 自簽憑證**不會**被 Windows 自動信任
- 使用者仍需手動安裝並信任憑證才能避免警告
- 不建議用於正式發佈

**產生自簽憑證：**
```bash
cd desktop
yarn gen-selfsign
```

執行後會在 `/app/certificate.pfx` 產生憑證檔案。腳本會顯示使用說明。

**其他人執行時仍會看到警告！** 除非他們手動信任此憑證。

### 選項 3: 不簽章（免費，但有警告）

如果只是自己使用，可以完全不簽章。使用者只需點擊「更多資訊」→「仍要執行」即可。

**建置未簽章版本：**
```bash
cd desktop
yarn dist
```
（不要設定 `CSC_LINK` 環境變數）

---

## Build 流程說明

electron-builder **內建**支援環境變數簽章：

```
如果設定 CSC_LINK 和 CSC_KEY_PASSWORD 環境變數
  → electron-builder 自動用該憑證簽章
如果未設定環境變數
  → 產生未簽章版本 (跳過簽章步驟)
```

> ⚠️ **重要**: `package.json` 中**不需要**寫 `certificateFile` 或 `certificatePassword`。
> electron-builder 會自動從環境變數讀取，硬編碼反而會導致路徑錯誤。

### 進階：使用硬體 Token (EV 憑證)

如果您購買了 EV 憑證，通常會收到 USB Token。此時需要用 Windows Certificate Store：

在 `desktop/package.json` 修改：
```json
"win": {
  "certificateSubjectName": "您的公司名稱",  // 從 CA 提供的資料中取得
  ...
}
```

並移除 `certificateFile` 和 `certificatePassword` 設定。

---

## 常見問題

### Q: SmartScreen 仍顯示警告，即使已簽章？
- **OV 憑證** 需要累積下載量與時間才能建立聲譽
- 建議升級為 **EV 憑證** 立即獲得信任

### Q: 憑證即將到期怎麼辦？
- 使用即將到期的憑證簽署的 `.exe` 仍可正常執行（透過時間戳）
- 但無法用來簽署新版本，需要更新憑證

### Q: 我可以在 Linux/macOS 建置 Windows 簽章版本嗎？
- 可以，但需要使用 `osslsigncode` 工具
- Emergent 環境可能不支援，建議在 Windows 環境建置

### Q: 免費有辦法取得受信任的簽章憑證嗎？
- 目前**沒有免費的個人程式碼簽章憑證**（不像網站 SSL 有 Let's Encrypt）
- 有些開源專案可以透過 [Certum](https://shop.certum.eu/data-safety/code-signing-certificates.html) 申請優惠（約 $30/年）
- 或透過 [SignPath.io](https://signpath.io/) 為 GitHub 開源專案提供免費簽章

---

## 目前設定摘要

您的 electron-builder 設定已支援：
- ✅ 圖示 (assets/icon.ico) 
- ✅ 自動讀取環境變數 CSC_LINK 和 CSC_KEY_PASSWORD (electron-builder 內建行為)
- ✅ SHA-256 簽章演算法
- ✅ 未設定憑證時自動跳過簽章 (不會失敗)
- ✅ 產生自簽憑證的腳本 (`yarn gen-selfsign`)

**下一步:** 從三種選項中選擇一種，然後執行 `yarn dist` 即可 build 出簽章版本！
