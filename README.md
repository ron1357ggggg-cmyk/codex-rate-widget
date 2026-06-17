# Codex + Claude Rate Widget

這是一個很小的 Windows Electron 常駐小窗，分兩個區塊顯示：

**Codex**（讀取本機 Codex session 的即時 `rate_limits`）
- 5 小時剩餘百分比與恢復時間
- 1 週剩餘百分比與恢復時間

**Claude**（讀取你手動維護的用量快照檔，見下方說明）
- Session 剩餘百分比與重置時間
- 每週剩餘百分比與重置時間

共同特性：可拖曳移動、置頂、可縮到系統列、每 30 秒自動重新整理。

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

## 資料來源：Claude

Claude 目前沒有像 Codex 一樣，會把 `rate_limits` 寫進本機 session log 的已知機制，所以這裡**不會**假裝有即時資料來源，而是讀取一個你自己維護的小型 JSON 快照檔：

```text
%USERPROFILE%\.claude-usage.json
```

也可以用環境變數 `CLAUDE_USAGE_FILE` 指到別的路徑。檔案格式和 Codex 內部的 `windows` 結構一致，例如打開 Claude 的 Settings → Usage 頁面，把畫面上的數字填進去：

```json
{
  "updatedAt": "2026-06-17T03:00:00.000Z",
  "windows": [
    {
      "label": "Session",
      "usedPercent": 4,
      "remainingPercent": 96,
      "resetsAt": 1750130520000
    },
    {
      "label": "每週",
      "usedPercent": 4,
      "remainingPercent": 96,
      "resetsAt": 1750156800000
    }
  ]
}
```

- `usedPercent` / `remainingPercent`：0-100 的數字，對應 Settings → Usage 顯示的「已使用 X%」。
- `resetsAt`：重置時間，使用 epoch 毫秒（JS 的 `Date.now()` 格式）。
- `updatedAt`：你更新這個檔案的時間，widget 會拿來判斷資料是不是太舊（超過 45 分鐘會標示為過舊）。

範例檔案見 `claude-usage.example.json`，複製一份改名成 `.claude-usage.json` 放到使用者資料夾即可。之後若 Anthropic 開放可程式化讀取用量的方式，可以把這個檔案改成由腳本自動產生，widget 端不需要再改。

## 跨設備注意

目前小工具預設只讀本機資料（Codex session log、Claude 快照檔）。若在另一台電腦執行，該電腦的資料不會自動同步到這台 Windows。
