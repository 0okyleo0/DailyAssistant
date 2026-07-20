# 遊戲每日任務追蹤器 - 桌面版

## 🎯 這是什麼

這是原網頁應用的**桌面版本**，使用 Electron 打包成單一 `.exe` 檔案。

### 相較於網頁版的優勢

| 功能 | 網頁版 | 桌面版 |
|------|--------|--------|
| 需要安裝 Node.js/Python/MongoDB | ✅ | ❌ 不需要 |
| 需要註冊自訂協議才能啟動遊戲 | ✅ | ❌ 不需要 |
| 一鍵啟動任何 exe | ⚠️ 需配置 | ✅ 直接支援 |
| 資料儲存方式 | MongoDB | 本地 JSON 檔案 |
| 開機自動啟動 | ⚠️ 需寫腳本 | ✅ 內建捷徑 |
| 檔案大小 | - | 約 80MB |

## 📥 下載使用（建議做法）

如果您已 build 好 `.exe` 檔案，直接執行安裝即可：

- **`GameTracker-Setup-1.0.0.exe`** - 完整安裝版（會在開始功能表和桌面建立捷徑）
- **`GameTracker-Portable-1.0.0.exe`** - 免安裝版（單一 exe，可放隨身碟帶著走）

## 🔨 如何 Build（開發者）

### 系統需求
- **Windows 10/11**
- **Node.js 18+** ([下載](https://nodejs.org/))

MongoDB 和 Python 都**不需要**！

### 一鍵 build
```
1. 下載完整專案資料夾到您的電腦
2. 進入 desktop 資料夾
3. 雙點 build-windows.bat
4. 等待 build 完成（第一次約 5-10 分鐘）
5. build 好的 .exe 會在 desktop/dist/ 資料夾中
```

### 手動 build（進階）
```bash
# 1. 安裝前端依賴並 build React
cd frontend
yarn install
yarn build

# 2. 安裝桌面版依賴並打包
cd ../desktop
yarn install
yarn dist
```

### 開發模式（即時預覽）
需要在**兩個** cmd 視窗執行：

```bash
# Terminal 1 - 啟動 React dev server
cd frontend
yarn start

# Terminal 2 - 啟動 Electron 指向 dev server
cd desktop
set ELECTRON_START_URL=http://localhost:3000 && yarn start
```

## 📁 資料儲存位置

桌面版將所有資料儲存在單一 JSON 檔案：

- **Windows**: `%APPDATA%\遊戲每日任務追蹤器\data.json`
- **macOS**: `~/Library/Application Support/遊戲每日任務追蹤器/data.json`
- **Linux**: `~/.config/遊戲每日任務追蹤器/data.json`

### 備份 / 還原資料
只需複製 `data.json` 檔案即可備份。還原時放回同樣位置。

## 🎮 使用方式

1. 執行 `GameTracker-Setup.exe` 或 `GameTracker-Portable.exe`
2. 點擊「新增遊戲」→ 輸入遊戲名稱、`.exe` 完整路徑、任務清單、重置時間
3. 點擊「啟動遊戲」按鈕即可**直接開啟遊戲**（不需任何額外配置！）

### 支援的路徑格式
- 本地 exe: `C:\Games\Genshin\GenshinImpact.exe`
- 帶空格路徑: `C:\Program Files\...\game.exe`
- Steam 遊戲: `steam://rungameid/1234`
- Epic 遊戲: `com.epicgames.launcher://apps/xxx?action=launch`
- Battle.net: `battlenet://WoW`

## 🔧 技術架構

- **UI**: React 19 + Tailwind CSS + Shadcn UI (從網頁版共用)
- **桌面框架**: Electron 28
- **資料儲存**: 本地 JSON 檔案（透過 Node.js fs）
- **遊戲啟動**: Node.js `child_process.spawn` + Electron `shell.openExternal`
- **打包工具**: electron-builder (支援 NSIS 安裝版 + portable 免安裝版)

## 🐛 疑難排解

### Q: 執行時 Windows Defender 阻擋
桌面版沒有數位簽章，可能會被 Windows Defender 標記。點擊「更多資訊」→「仍要執行」即可。若需正式發佈，可購買程式碼簽章憑證。

### Q: 找不到 .exe 檔案
確認遊戲路徑正確，可先在檔案總管貼上路徑確認能否開啟。

### Q: 想要更新版本
重新 build 一次，或下載新版本的 installer。您的資料儲存在 `%APPDATA%` 不會被覆蓋。

### Q: 想要卸載
- 安裝版：透過 Windows「新增或移除程式」卸載
- Portable 版：直接刪除 exe 即可
- 徹底清除資料：刪除 `%APPDATA%\遊戲每日任務追蹤器` 資料夾
