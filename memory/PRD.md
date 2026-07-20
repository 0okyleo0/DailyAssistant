# Game Daily Task Tracker - PRD

## Original Problem Statement (Chinese)
我需要一個程式可以讓我更方便監管各種遊戲的每日任務
- 鏈結遊戲位置並開啟 完成後由用戶勾選
- 可以自行設定每日的到期時間 並記錄前一天、一周的完成狀況
- 會在設定的時間到時自動記錄並重製
- 可以新增更多的遊戲進列表以快速開啟
- 有一鍵取消勾選的按鍵

## User Choices
- Design: 簡約現代風格 (Dark mode, cyan accents #00F0FF)
- Games: 完全空白，用戶自行新增
- Reset time: 用戶自行設定 (每個遊戲獨立設定)
- Notifications: 可自行設定
- History: 完整歷史記錄 + 月度統計 + 可自行刪除

## Architecture
- Backend: FastAPI + MongoDB (motor async driver)
- Frontend: React 19 + Tailwind + Shadcn UI + Recharts
- Font: Outfit (headings) + Inter (body) + JetBrains Mono
- Language: Traditional Chinese

## Core Requirements (Static)
1. Add/edit/delete games with local exe file path
2. Per-game daily reset time (HH:MM)
3. Task checkbox with completion state
4. Copy game path to clipboard (for launching local games)
5. One-click uncheck all button
6. Automatic reset at set time (per game)
7. History with previous day, week, month, and full records
8. Delete individual or bulk history records
9. Optional browser notifications
10. Statistics: 7-day and 30-day averages, weekly bar chart, monthly line chart

## What's Been Implemented (Feb 2026)
- ✅ Backend REST API: games CRUD, toggle-task, uncheck-all, reset-game, settings, daily-records (list/filter/delete/bulk), stats
- ✅ Frontend: Sidebar with game list management dialog
- ✅ Tasks view with per-game reset time display, task toggle, uncheck-all, stats cards
- ✅ History view with game filter dropdown, weekly bar chart, monthly line chart, records table with bulk delete
- ✅ Settings view with notifications toggle
- ✅ Auto-reset logic in App.js checking each game's reset_time every minute
- ✅ Copy path to clipboard (replaces open-in-browser for local exe files)
- ✅ Dark mode UI with cyan accents, custom fonts, responsive design
- ✅ 100% test pass rate (10/10 backend pytest + full frontend UI verification)

## Prioritized Backlog

### P1 (Nice to have)
- Add DialogDescription for a11y compliance
- Backend HH:MM validation for reset_time
- Task reordering (drag & drop)
- Export history as CSV

### P2 (Future)
- User authentication (multi-user support)
- Cloud sync
- Mobile app (React Native)
- Task templates (import/export)
- Streak tracking / achievements
- Custom task categories/tags
