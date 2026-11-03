# Codex + Claude Rate Widget

這是一個很小的 Windows Electron 常駐小窗，分兩個區塊顯示：

**Codex**（啟動、自動檢查與手動刷新皆優先直接查詢帳戶用量）
- 5 小時剩餘百分比與恢復時間
- 1 週剩餘百分比與恢復時間

**Claude**（讀取 Claude Code status line 寫出的本機快照）
- Session 剩餘百分比與重置時間
- 每週剩餘百分比與重置時間

共同特性：可拖曳移動、置頂、可縮到系統列、約每 10 分鐘自動重新整理。

Widget 啟動、自動重新整理、系統列重新整理與按下標題列重新整理按鈕時：Codex 透過本機 `codex app-server` 取得帳戶最新用量，可反映其他電腦的使用量；Claude 重新讀取本機快照，不發送網路請求。

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

上述 LOG 現在只作為 fallback。啟動、自動檢查與手動刷新都會先由 Codex CLI app-server 的 `account/rateLimits/read` 取得帳戶即時值；若即時查詢失敗，會優先保留上一筆成功的 live 值，沒有 live 值時才退回本機 LOG 並在標題列顯示 fallback 狀態。可用 `CODEX_CLI_PATH` 指定 Codex CLI 執行檔。

## 資料來源：Claude

Claude Code 更新 status line 時會執行 `scripts/claude-statusline.js`，把 `rate_limits` 的 5 小時與 7 天使用率存到 `%USERPROFILE%\.claude\rate-limit-snapshot.json`（可用 `CLAUDE_RATE_LIMIT_SNAPSHOT` 改路徑）。Widget 只讀這個檔案，不查詢網路，也不讀取 token。

需要在 `~/.claude/settings.json` 設定：

```json
"statusLine": {
  "type": "command",
  "command": "node \"C:/Users/ron_li/Desktop/TOOLS/codex-rate-widget/scripts/claude-statusline.js\""
}
```

限制：

- 只支援 claude.ai 訂閱帳號，且工作階段收到第一個 API 回應後才有資料。
- Claude Code 閒置時快照不會更新；超過 45 分鐘或已過重置時間會顯示「待更新」，保留快照原值，不推算成剩餘 100%。
- 其他裝置的用量，要等這台的工作階段收到新回應才會反映。
- 移動本專案資料夾後，要同步修改上面的路徑。

## 視窗位置

Widget 啟動時會自動停靠在 Windows 工作區右下角，靠近工作列時間與通知區上方。從系統列圖示重新顯示 Widget 時，也會重新停靠到滑鼠所在螢幕的右下角附近。

視窗仍可拖曳移動；拖曳只影響當下顯示位置，下一次啟動或從系統列叫出時會回到右下角停靠位置。
## 2026-08-07 Codex 顯示規則

Codex 區塊以這台電腦的本機 Codex session LOG 為主要來源；只有本機 LOG 沒有可用用量時，才 fallback 到 Codex app-server。Codex 視窗名稱依實際 `window_minutes` / `windowDurationMins` 顯示：`300` 顯示 `5 小時`，`10080` 顯示 `1 週`。如果目前 Codex 只回一週視窗，畫面只顯示 `1 週`，不會硬補或誤標成 `5 小時`。
