# 遊戲每日任務追蹤器 - 本地運行指南

#Made By AI

## 📋 系統需求

在本地運行此應用程式之前，請確保您的電腦已安裝以下軟體：

### 必要軟體
1. **Node.js** (v18 或以上) - [下載連結](https://nodejs.org/)
2. **Python** (v3.10 或以上) - [下載連結](https://www.python.org/downloads/)
3. **MongoDB** - [下載連結](https://www.mongodb.com/try/download/community)
4. **Yarn** (安裝 Node.js 後執行 `npm install -g yarn`)

### 選擇性軟體
- **Git** - 用於從 GitHub 下載程式碼 - [下載連結](https://git-scm.com/)

---

## 📥 步驟 1：獲取程式碼

### 方式 A：從 GitHub (若已推送)
```bash
git clone <你的 GitHub 儲存庫網址>
cd <專案資料夾>
```

### 方式 B：手動下載
使用 Emergent 的 VS Code 介面，將以下資料夾/檔案完整複製到您的電腦：
```
/app/
├── backend/
│   ├── server.py
│   ├── requirements.txt
│   └── .env
├── frontend/
│   ├── src/
│   ├── public/
│   ├── package.json
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── craco.config.js
│   └── .env
└── README.md
```

---

## 🔧 步驟 2：安裝 MongoDB

### Windows
1. 下載並執行 [MongoDB Community Server](https://www.mongodb.com/try/download/community)
2. 安裝時勾選「Install MongoDB as a Service」（會自動啟動 MongoDB）
3. **重要**: 在 "Install MongoDB Compass" 選項保持勾選（Compass 是 MongoDB 的圖形化管理工具）
4. 預設連線位址為 `mongodb://localhost:27017`

### 確認 MongoDB 正在運行

**方法 A：檢查 Windows 服務（最簡單）**
1. 按 `Win + R` 開啟執行視窗
2. 輸入 `services.msc` 並按 Enter
3. 找到 "MongoDB Server" 或 "MongoDB"
4. 確認「狀態」為「執行中」

**方法 B：使用 MongoDB Compass（圖形化工具）**
1. 開啟 MongoDB Compass（安裝 MongoDB 時已一併安裝）
2. 使用預設連線字串 `mongodb://localhost:27017` 點擊 Connect
3. 若能成功連線代表 MongoDB 正常運行

**方法 C：使用命令列（需另外安裝 mongosh）**
> ⚠️ 注意：MongoDB 5.0+ 版本 `mongosh` 已獨立於伺服器，需要單獨下載
1. 從 [MongoDB Shell 下載頁面](https://www.mongodb.com/try/download/shell) 下載 mongosh
2. 解壓縮後將 `bin` 資料夾加入系統 PATH 環境變數
3. 重開命令提示字元，執行 `mongosh` 測試

**如果 MongoDB 服務未運行：**
1. 在 services.msc 中右鍵點擊 MongoDB → 選擇「啟動」
2. 或者以「系統管理員身分」開啟命令提示字元執行：
   ```bash
   net start MongoDB
   ```

---

## ⚙️ 步驟 3：配置環境變數

### backend/.env 檔案內容
```
MONGO_URL="mongodb://localhost:27017"
DB_NAME="game_tracker"
CORS_ORIGINS="*"
```

### frontend/.env 檔案內容
```
REACT_APP_BACKEND_URL=http://localhost:8001
WDS_SOCKET_PORT=3000
```

---

## 🚀 步驟 4：安裝依賴套件

### 安裝後端依賴 (Backend)
開啟命令提示字元，切換到 `backend` 資料夾：
```bash
cd backend
pip install -r requirements.txt
```

### 安裝前端依賴 (Frontend)
另開一個命令提示字元，切換到 `frontend` 資料夾：
```bash
cd frontend
yarn install
```

---

## ▶️ 步驟 5：啟動應用程式

需要開啟 **兩個** 命令提示字元視窗。

### 視窗 1：啟動後端
```bash
cd backend
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```
看到 `Application startup complete.` 表示後端已啟動。

### 視窗 2：啟動前端
```bash
cd frontend
yarn start
```
瀏覽器會自動打開 `http://localhost:3000`

---

## 🎮 步驟 6：註冊一鍵啟動協議 (Windows)

1. 打開應用 → 進入「設定」頁面
2. 點擊「下載 .reg 檔案」
3. 雙點下載的 `.reg` 檔案
4. 在彈出的安全警告點擊「執行」→「是」→「確定」
5. 關閉並重新開啟瀏覽器
6. 回到任務頁面，點擊「啟動遊戲」按鈕即可!

---

## 💡 一鍵啟動腳本

專案已提供以下腳本，讓您快速啟動應用：

### Windows
- **`start.bat`** - 一鍵啟動前後端（雙擊執行）
- **`stop.bat`** - 停止所有服務

### 使用方式
1. 雙點 `start.bat`
2. 系統會自動開啟兩個命令視窗（前端 + 後端）
3. 等待瀏覽器自動打開 `http://localhost:3000`

---

## 🔄 每次使用

註冊自訂協議後，每次要使用時：

1. 確保 MongoDB 正在運行（Windows 服務會自動啟動）
2. 雙點 `start.bat` 啟動應用
3. 開始使用

---

## ❓ 常見問題

### Q: 後端啟動時出現 `ModuleNotFoundError`
執行 `pip install -r requirements.txt` 重新安裝依賴

### Q: MongoDB 無法連線
確認 MongoDB 服務正在運行：
- Windows: 按 `Win+R` 輸入 `services.msc`，找到 MongoDB 服務並確認狀態為「執行中」
- 若未執行：右鍵 MongoDB 服務 → 選擇「啟動」
- 或以系統管理員身分開啟 CMD，執行 `net start MongoDB`

### Q: 提示 'mongosh' 不是內部或外部命令
這是正常情況：
- MongoDB 5.0+ 版本 `mongosh` 已與伺服器分開發布，安裝伺服器時不會自動安裝 mongosh
- **您不需要 mongosh 也能使用本應用**，因為程式會透過 Python 的 motor 套件直接連線 MongoDB
- 若想驗證 MongoDB 是否運行，建議使用 **MongoDB Compass** 圖形化工具（安裝 MongoDB 時可一併勾選安裝）
- 或至 `services.msc` 檢查 MongoDB 服務狀態

### Q: 前端無法連上後端
確認 `frontend/.env` 中的 `REACT_APP_BACKEND_URL` 是 `http://localhost:8001`

### Q: 「啟動遊戲」按鈕沒反應
1. 確認已下載並執行 `.reg` 檔案
2. 確認遊戲路徑正確（例如：`C:\Games\game.exe`）
3. 重新啟動瀏覽器

### Q: 如何備份資料？
您的所有資料儲存在 MongoDB 中：
- **使用 MongoDB Compass**：連線後可匯出集合為 JSON
- **使用命令列** (需先安裝 [MongoDB Database Tools](https://www.mongodb.com/try/download/database-tools))：
  ```bash
  mongodump --db game_tracker --out ./backup
  ```

---

## 🎯 開機自動啟動 (選擇性)

如果希望每次開機都自動啟動應用：

1. 按 `Win+R` 輸入 `shell:startup` 開啟啟動資料夾
2. 建立 `start.bat` 的捷徑放入此資料夾
3. 開機後應用會自動運行

---

## 📝 技術棧

- **前端**: React 19 + Tailwind CSS + Shadcn UI + Recharts
- **後端**: FastAPI (Python) + Motor (MongoDB async driver)
- **資料庫**: MongoDB
- **字型**: Outfit + Inter + JetBrains Mono
