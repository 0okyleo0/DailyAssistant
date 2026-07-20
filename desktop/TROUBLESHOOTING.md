# 建置常見問題排解

## 🔥 錯誤：Cannot create symbolic link : 用戶端沒有這種特權

### 錯誤訊息
```
⨯ cannot execute  cause=exit status 2
ERROR: Cannot create symbolic link : 用戶端沒有這種特權
C:\Users\...\electron-builder\Cache\winCodeSign\...\darwin\10.12\lib\libcrypto.dylib
```

### 原因
electron-builder 下載 `winCodeSign` 工具包時，內含 macOS 版本的 symbolic link 檔案（`.dylib`）。Windows 預設**禁止一般使用者建立 symbolic link**，導致 7-Zip 解壓縮失敗。

### 三種解法（任選一種）

#### 方案 1: 以系統管理員身份執行（最推薦）✨
最新版的 `build-windows.bat` 已自動處理：
- 執行時會自動彈出 UAC 提升權限視窗
- 您只需點擊「是」允許即可

**手動方式**：
1. 右鍵點擊 `build-windows.bat`
2. 選擇「以系統管理員身分執行」

#### 方案 2: 啟用 Windows 開發者模式（一勞永逸）⭐
啟用後**永久生效**，之後 build 不需要管理員權限：

**Windows 11:**
1. 按 `Win + I` 開啟設定
2. 前往「隱私權與安全性」→「開發者專用」
3. 開啟「開發者模式」
4. 系統會提示「使用開發者功能可能會使裝置和個人資料的安全性遭到危害」→ 點擊「是」

**Windows 10:**
1. 按 `Win + I` 開啟設定
2. 前往「更新與安全性」→「開發人員專用」
3. 選擇「開發人員模式」
4. 系統會安裝相關套件

**優點**：
- ✅ 一次設定終身有效
- ✅ 不需每次都以管理員身份執行
- ✅ 允許普通程式建立 symbolic link
- ✅ 不會影響系統安全

#### 方案 3: 手動清除快取重試
若前兩個方案都不行，可能是快取檔案損壞：

```bash
:: 清除 electron-builder 快取
rmdir /s /q "%LOCALAPPDATA%\electron-builder\Cache"

:: 重新以管理員執行 build
build-windows.bat
```

---

## 🌐 錯誤：下載失敗 / 網路超時

### 錯誤訊息
```
⨯ downloading url=https://github.com/electron-userland/... failed
```

### 原因
electron-builder 需要從 GitHub 下載：
- Electron runtime（約 100MB）
- winCodeSign（約 5MB）
- NSIS installer components

### 解法

**設定 HTTP Proxy（若在公司網路）：**
```cmd
set HTTP_PROXY=http://proxy.company.com:8080
set HTTPS_PROXY=http://proxy.company.com:8080
build-windows.bat
```

**使用國內鏡像（若在中國）：**
```cmd
set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
set ELECTRON_BUILDER_BINARIES_MIRROR=https://npmmirror.com/mirrors/electron-builder-binaries/
build-windows.bat
```

---

## 🛡️ 錯誤：防毒軟體阻擋

### 症狀
- Build 過程中意外中斷
- `dist/` 資料夾中檔案消失
- Windows Defender 警告

### 解法
將專案資料夾加入防毒軟體排除清單：

**Windows Defender:**
1. 開啟 Windows 安全性 → 病毒與威脅防護
2. 病毒與威脅防護設定 → 管理設定
3. 排除項目 → 新增或移除排除項目
4. 新增資料夾 → 選擇專案根目錄

---

## 💾 錯誤：磁碟空間不足

### 症狀
```
ENOSPC: no space left on device
```

### 解法
Build 過程需要約 **2GB** 空閒空間：
- electron runtime: 100MB
- node_modules: 500MB+
- unpacked build: 200MB
- final installer: 80MB
- 臨時檔案: 500MB+

清出足夠空間後重試。

---

## 🔨 手動 Build（不使用 build-windows.bat）

若您不想用批次檔，可以手動執行：

```cmd
:: 1. 以系統管理員身份開啟 CMD（重要！）

:: 2. 進入專案目錄
cd C:\path\to\your\project

:: 3. 安裝前端依賴 & build
cd frontend
yarn install
yarn build
cd ..

:: 4. 安裝桌面版依賴
cd desktop
yarn install

:: 5. 打包（第一次會下載 electron，約 3-5 分鐘）
yarn electron-builder --win
```

Build 完成後檔案在 `desktop\dist\` 資料夾中。

---

## ❓ 其他問題

如果以上方案都無效，請提供以下資訊：

```cmd
:: 執行以下指令並貼出結果
node --version
yarn --version
where npm
ver
```

以及完整的 build 錯誤訊息（從 `[4/4]` 之後到 `error Command failed` 為止）。
