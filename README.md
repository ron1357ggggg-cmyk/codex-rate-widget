# Codex Rate Widget

這是一個很小的 Windows Electron 常駐小窗，用來讀取本機 Codex session 裡最新的 `rate_limits`，顯示：

- 5 小時剩餘百分比與恢復時間
- 1 週剩餘百分比與恢復時間
- 可拖曳移動、置頂、可縮到系統列

## 執行

```powershell
npm.cmd install
npm.cmd start
```

也可以直接雙擊 `start-widget.cmd` 啟動。

小窗會預設出現在右下角工作列時間附近。拖曳視窗本體可以移動位置，位置會自動記住。

## 資料來源

程式會掃描：

```text
%USERPROFILE%\.codex\sessions
```

並從最新的 `.jsonl` 事件中讀取 `rate_limits`。Codex 需要至少跑過一次並產生 token/rate limit 事件，畫面才會有真實資料。
