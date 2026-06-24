# Codex + Claude Rate Widget

這是一個很小的 Windows Electron 常駐小窗，分兩個區塊顯示：

**Codex**（自動檢查讀取本機 session，手動刷新直接查詢帳戶用量）
- 5 小時剩餘百分比與恢復時間
- 1 週剩餘百分比與恢復時間

**Claude**（透過 Claude Code OAuth token 查詢用量）
- Session 剩餘百分比與重置時間
- 每週剩餘百分比與重置時間

共同特性：可拖曳移動、置頂、可縮到系統列、每 30 秒自動重新整理。

按下標題列的重新整理按鈕時，Widget 會額外執行即時查詢：Codex 透過本機 `codex app-server` 取得帳戶最新用量，Claude 透過本機 Claude Code CLI 的 `/usage` 取得訂閱用量。這可反映同一帳戶在其他電腦產生的使用量，不需要開啟或切換 Codex、Claude 桌面視窗。

## 執行

```powershell
npm.cmd install
npm.cmd start
```

也可以直接雙擊 `start-widget.cmd` 啟動。

小窗會預設出現在右下角工作列時間附近。拖曳視窗本體可以移動位置，位置會自動記住。

## 資料來源：Codex

程式會掃描：

```text
%USERPROFILE%\.codex\sessions
```

並從最新的 `.jsonl` 事件中讀取 `rate_limits`。Codex 需要至少跑過一次並產生 token/rate limit 事件，畫面才會有真實資料。

上述 LOG 是啟動與每 30 秒自動檢查的資料來源。手動刷新改由 Codex CLI app-server 的 `account/rateLimits/read` 取得帳戶即時值；若即時查詢失敗，會退回本機 LOG 並在標題列顯示 fallback 狀態。可用 `CODEX_CLI_PATH` 指定 Codex CLI 執行檔。

## 資料來源：Claude

Claude 區塊透過 Claude Code CLI 的 OAuth token 向 `api.anthropic.com/v1/messages` 發送最小 API 呼叫，從回應標頭取得即時用量資料：

- `anthropic-ratelimit-unified-5h-utilization` → 5 小時視窗已使用比例（0–1）
- `anthropic-ratelimit-unified-7d-utilization` → 7 天視窗已使用比例（0–1）

Widget 以 `100 - 使用%` 顯示剩餘量，並附上各視窗的重置時間。自動檢查沿用 5 分鐘快取，避免過度呼叫 API；手動刷新改讀 Claude CLI `/usage`。可用 `CLAUDE_CLI_PATH` 指定 Claude CLI 執行檔。

Token 存放位置：`%USERPROFILE%\.claude\.credentials.json`（由 Claude Code 自動管理）。

## 視窗位置

Widget 啟動時會自動停靠在 Windows 工作區右下角，靠近工作列時間與通知區上方。從系統列圖示重新顯示 Widget 時，也會重新停靠到滑鼠所在螢幕的右下角附近。

視窗仍可拖曳移動；拖曳只影響當下顯示位置，下一次啟動或從系統列叫出時會回到右下角停靠位置。
