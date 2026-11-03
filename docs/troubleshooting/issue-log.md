# 問題處理紀錄

## 目的

記錄所有已確認的問題、原因、解法、影響範圍與後續注意事項。

## 適用情境

當使用者提出錯誤、Bug、功能異常、查詢問題或修正結果時，AI Agent 應閱讀並追加此文件。

## 目前內容

待補充。

## 規則

所有已確認的問題、原因、解法都要追加到本文件，格式需包含：問題現象、原因分析、解決方式、影響範圍、後續注意事項。

## 範例

## yyyy-MM-dd 問題標題

### 問題現象

### 原因分析

### 解決方式

### 影響範圍

### 後續注意事項

## 常見錯誤

待補充。

## 注意事項

每次查詢、分析或修改後，若產生可重用結論，必須回寫到本文件或其他對應 docs 文件。修改後也必須提醒使用者提交 Git。

## 2026-06-01 Rate Limit Stale Display

### Symptom

The widget could show an older-looking rate-limit state after restart because it selected the first session file with rate-limit data instead of comparing event timestamps.

### Cause

Codex can append fresh rate-limit events to a session log whose path or file grouping looks older. Sorting files alone can therefore pick stale data.

### Resolution

The reader now compares rate-limit event timestamps across active and archived session logs, then renders the newest event. The start script also launches Electron directly so the command window does not need to remain open.

### Verification

Ran the reader directly with Node and confirmed it returned a 2026-06-01 timestamp.

## 2026-06-01 Refresh Button Appears Inactive

### Symptom

Clicking refresh could appear to do nothing when the newest Codex rate-limit event had not changed.

### Cause

The widget titlebar displayed the source event timestamp, not the time when the widget last checked local session logs. If the same source event remained newest, the rendered time and percentages were unchanged.

### Resolution

The rate-limit reader now returns `checkedAt`, and the renderer shows that check time. The refresh button is disabled while the request is running and briefly shows a checking state.

### Verification

Ran the rate-limit reader directly with Node and confirmed `checkedAt` updates independently of the newest source event timestamp.

## 2026-06-01 Refresh Stuck On Checking

### Symptom

The widget titlebar could remain on the checking state after pressing refresh.

### Cause

The renderer set the checking label before awaiting the refresh result, but did not handle rejected or stalled refresh promises with a visible fallback state.

### Resolution

Manual refresh now races the IPC request against a five-second timeout, logs failures, displays a failure state, and always re-enables the refresh button.

### Verification

Restarted the Electron widget after applying the renderer refresh guard.

## 2026-06-01 Refresh Shows Failure After Successful Read

### Symptom

The widget showed the refresh failure state even though the local rate-limit reader returned fresh Codex usage data.

### Cause

A renderer variable was renamed from `updated` to `checked`, but the formatter still referenced `updated`, causing a `ReferenceError` during render.

### Resolution

The formatter now uses the `checked` date value when rendering the titlebar check time.

### Verification

Ran `node --check src/renderer.js` and verified the rate-limit reader returned current remaining percentages.

## 2026-06-03 Duplicate Widget Instances

### Symptom

The widget could appear broken or inconsistent when the desktop shortcut was opened more than once.

### Cause

The app did not enforce a single Electron instance, so multiple widget processes could run at the same time and share the same user-data directory and tray behavior.

### Resolution

The app now uses Electron's single-instance lock. A second launch exits immediately after asking the existing instance to show/focus and refresh.

### Verification

Launched the widget twice after restart and confirmed only one Electron app instance remained.

## 2026-06-05 Source Freshness Diagnostics

### Symptom

The widget can appear to stop updating every few days or remain stuck on a specific timestamp, while Codex Desktop still shows current remaining usage.

### Cause

The widget reads local Codex session `.jsonl` snapshots. It does not query Codex servers or the desktop app's internal live state. Codex rate-limit snapshots are emitted into session logs after Codex activity. If no fresh local `rate_limits` event is written, the widget cannot calculate the exact current rolling-window remaining usage by itself.

Related findings:

- A currently active thread can keep appending to an older path such as `sessions\2026\05\28\...jsonl`, so file path dates are not freshness signals.
- `state_5.sqlite` tracks thread paths and updated times, but does not store a clean rate-limit state.
- `logs_2.sqlite` has token-related traces, but not a stable standalone `rate_limits` payload suitable as the widget source.
- `.codex-global-state.json` does not contain `rate_limits`, `used_percent`, or `resets_at`.

### Resolution

The widget now reports source freshness explicitly with `sourceEventAgeMs` and marks data stale after 45 minutes. Stale/error refreshes are written to `%APPDATA%\codex-rate-widget\diagnostics.jsonl`. Future repairs must start from `docs/rate-limit-widget-quick-index.md` and this issue log.

### Verification

The direct reader returned a fresh 2026-06-05 `codex-session-jsonl` snapshot with 5-hour and weekly windows, and `stale: false`.

## 2026-06-08 Widget Requires Manual Repositioning

### Symptom

Even though the widget is small, it can still be inconvenient when it stays at a previously dragged position and needs to be moved back near the Windows clock area.

### Cause

The main process previously persisted the last moved window bounds in `window-state.json` and reused that position on startup. Once the widget had been dragged elsewhere, future launches could keep showing it away from the taskbar time area.

### Resolution

The main window now computes a docked bottom-right position from Electron `screen.workArea` on startup, when shown from the tray, and after display metrics change. Manual dragging remains available for temporary repositioning.

### Verification

Ran `node --check src\main.js`.

## 2026-06-18 Widget Content Clipped After Claude Section

### Symptom

After adding the Claude usage section, the widget could show all four rate-limit bars but clip the lower value strip or squeeze the right-side percentage column.

### Cause

The window was still sized for the older Codex-only layout, while the CSS split the content into fixed grid bands. Codex and Claude sections competed for vertical space, leaving the bottom value strip with too little room.

### Resolution

The widget window was widened and made slightly taller. The widget grid now uses natural-height rows for the title, Codex section, Claude section, and value strip, with tighter spacing and safer meter columns.

Follow-up tuning reduced excess bottom whitespace by lowering the combined widget height to 315px. Claude reset headers are now parsed from either epoch or ISO timestamp formats, and the Claude weekly row forces date display so the reset date is visible even when the reset is today.

### Verification

Ran `node --check src\main.js`, `node --check src\renderer.js`, `node --check src\preload.js`, `node --check src\claudeUsage.js`, and `node --check src\rateLimits.js`.

## 2026-07-02 Codex Live Value Differs From Local Codex Display

### Symptom

The widget's Codex 5-hour remaining percentage differed from the value shown by the local Codex Desktop app, while Claude values remained correct.

### Cause

Codex app-server `account/rateLimits/read` and the local Codex session LOG can temporarily report different 5-hour values. In the observed case, app-server returned a lower remaining percentage than the fresh local LOG, while the weekly value matched.

### Resolution

Codex refresh now reads app-server and local LOG in parallel. If the local LOG has a fresh rate-limit event within 2 minutes, the widget prefers the local LOG so it matches the local Codex Desktop display. If the local LOG is stale or unavailable, the widget still uses app-server to preserve cross-device usage visibility.

### Verification

Simulated the selection logic with live and local readers. The selected source was `codex-session-jsonl-preferred` when local LOG age was about 13 seconds, and the widget chose the local remaining percentages over the app-server percentages.

## 2026-06-25 Live Values Replaced After Five Minutes

### Symptom

After pressing refresh, the widget showed the newer cross-device live usage for only about five minutes, then the automatic check reverted the display to older local LOG values.

### Cause

The automatic `usage:get` path still read local Codex session LOG data every 30 seconds. A successful Codex live result was cached for only five minutes, so after that TTL expired the background LOG read could overwrite the live app-server values.

### Resolution

The normal automatic path now uses the same live sources as manual refresh: Codex app-server and Claude Code CLI. The background schedule is reduced to about 10 minutes, and Codex keeps the last successful live result if a later live query fails.

### Verification

Ran JavaScript syntax checks, queried Codex live usage through `src/codexLiveUsage.js`, queried Claude live usage through `src/claudeLiveUsage.js`, and ran `git diff --check` with only CRLF normalization warnings.

## 2026-06-24 Manual Refresh Cannot See Cross-Device Usage

### 問題現象

Codex 在其他電腦使用後，本機 Widget 即使手動重新整理，也可能仍顯示舊百分比。

### 原因分析

手動刷新與每 30 秒自動檢查原本共用本機 session LOG。其他電腦的活動不會立即寫入這台電腦的 `.jsonl`；Claude 手動刷新也會沿用 5 分鐘快取。

### 解決方式

新增 `src/codexLiveUsage.js`，手動刷新時呼叫 Codex app-server 的 `account/rateLimits/read`；另新增 `src/claudeLiveUsage.js`，執行 Claude Code CLI `/usage`。即時查詢失敗時退回既有資料來源，畫面顯示失敗狀態並寫入 diagnostics。當時每 30 秒自動檢查保持原樣；2026-06-25 起已改為約每 10 分鐘走同一條 live refresh 資料流。

### 影響範圍

只改變畫面與系統列的手動重新整理；啟動與定時更新仍使用原資料來源。

### 後續注意事項

Codex app-server 目前是 experimental。升級 Codex CLI 後若協定變更，需檢查 `account/rateLimits/read`，不可改用桌面座標點擊或 OCR 作為主要資料來源。

### 驗證

實際啟動 Widget 並按下重新整理，確認 Codex 與 Claude 數值皆更新。等待超過一輪 30 秒排程後，即時值仍保留，未被較舊 LOG 或 API 結果覆蓋。2026-06-25 起不再使用 30 秒 LOG 排程作為主資料來源。
## 2026-08-07 Codex Weekly Window Mislabeled As 5 Hours

### Symptom

Codex currently reports only one limit window, but the widget displayed it as `5 小時`.

### Cause

Both local LOG normalization and app-server normalization assigned labels by array position: first window was always labeled `5 小時`, second window was always labeled `1 週`. Codex now can return a single primary window with `window_minutes` / `windowDurationMins` equal to `10080`, which is a weekly window.

### Resolution

Codex window labels are now derived from duration. `300` minutes is labeled `5 小時`, `10080` minutes is labeled `1 週`, and unknown durations get a duration-based fallback. Codex source selection is also local-first: local session LOG is used whenever available, with app-server only as fallback.

### Verification

Ran both local LOG and app-server readers. Each returned one Codex window labeled `1 週` with `windowMinutes: 10080`.
## 2026-08-10 Stale Local Codex LOG Overrides Live Value

### Symptom

Codex usage looked inaccurate because the widget displayed an old local LOG value even though Codex app-server returned a fresh account value.

### Cause

The local-first logic accepted any local Codex LOG payload with `ok: true`, including stale data. Diagnostics showed a stale local event from 2026-08-07 reporting 17% remaining while live app-server reported 100% remaining on 2026-08-10.

### Resolution

Local Codex LOG is now preferred only when it is not stale. If local data is stale and app-server succeeds, the widget uses app-server and writes `codex-stale-local-live-preferred` diagnostics. Stale local LOG is used only as fallback when live lookup fails.

### Verification

Pending syntax check and source-selection verification.

## 2026-08-10 Claude Current Session Missing Reset

### Symptom

Claude current-session usage did not appear in the widget after the CLI returned `Current session: 0% used` without a reset time.

### Cause

The Claude CLI parser required both a percentage and `resets ...` text for the current-session row. When the CLI omitted reset text, the parser returned `fiveHour: null` even though the session percentage was valid.

### Resolution

The parser now accepts Claude current-session and weekly lines with optional reset text. The UI labels Claude current session as `本次` instead of `5 小時`.

### Verification

Ran syntax checks for `src/claudeLiveUsage.js` and `src/renderer.js`. Parsed both a sample CLI output and the live `claude -p "/usage"` output; both returned a valid current-session row with `remainingPercent: 100` and `resetsAt: null`.

## 2026-11-03 Claude 用量抓不到（HTTP 429 與登入失效交替）

### 問題現象

Widget 的 Claude 區塊顯示「Claude 查詢限流，等待重試」或「登入失效」，沒有百分比，重啟也無法恢復。

### 原因分析

自 2026-11-02 09:14 起，`api/oauth/usage` 的查詢全數失敗，HTTP 429 與「登入失效」交替出現，每段 429 約持續 1 小時。429 的冷卻時間已寫入檔案，所以重啟無效；當時也沒有成功紀錄可顯示。此外 Widget 不會自行更新 access token，且 401、403 共用同一訊息，log 未記狀態碼。

未確認：429 的實際觸發原因與門檻、「登入失效」是 401 還是 403。8 小時的 token 效期解釋不了 11/02 約每 1 小時重複出現的登入失效。

### 解決方式

改用 Claude Code status line 提供的 `rate_limits`：`scripts/claude-statusline.js` 寫出本機快照，Widget 只讀檔，不再呼叫 `api/oauth/usage`。

### 影響範圍

Claude 區塊的資料來源。Codex 區塊不受影響。

### 後續注意事項

Claude Code 閒置時快照不會更新，其他裝置的用量也不會立即反映。`getClaudeLiveUsage()` 仍保留但已無呼叫端，`claude-usage-state.json` 也不再使用。

### 驗證

`node --check` 全數通過；以測試資料驗證腳本與讀取邏輯（完整資料、缺 `rate_limits`、已過重置時間、超過 45 分鐘、檔案不存在）。重啟 Widget 後，實際快照的使用率 21%／38% 在畫面上顯示為剩餘 79%／62%，重置時間 14:20 與 11/5 14:00 也正確，且未再出現 Claude 錯誤。

## 2026-11-03 Claude 百分比比快照慢最多 10 分鐘

### 問題現象

Claude Code 已更新快照，Widget 仍顯示舊百分比。

### 原因分析

Widget 只在啟動、約每 10 分鐘或按下重新整理時讀快照。實測快照 10:41 已是使用 24%，下一次讀取要到 10:47。

### 解決方式

`src/main.js` 監看快照所在資料夾，檔案更新後只刷新 Claude，並沿用上一筆 Codex，不多查 app-server。

### 影響範圍

Claude 區塊的更新時機。Codex 仍約每 10 分鐘查詢。

### 後續注意事項

快照本身只在 Claude Code 收到 API 回應、更新 status line 時改變，回應進行中或閒置時仍會落後。status line 顯示「已使用」，Widget 顯示「剩餘」，兩者相加才是 100%。

### 驗證

以暫時值 50% 寫入快照，未重新整理的情況下畫面約 2 秒內更新，之後已還原原始內容。

## 2026-11-03 Claude 用量改回以 /usage 為基準

### 問題現象

只靠 status line 快照時，Claude Code 閒置或其他裝置用過後，數字不會更新。實測 11:00 快照為 33%／39%，`/usage` 為 34%／40%。

### 原因分析

快照只在這台的 Claude Code 更新 status line 時改變，且內容來自最後一次 API 回應。過去 `/usage` 常見「輸出沒有百分比」，程式在 process `exit` 時就解析 stdout，當時輸出可能尚未收完；這是可能原因，尚未證實是唯一原因。

### 解決方式

`/usage` 作為基準，快照負責兩次查詢之間的即時更新。解析時機改為 `close`，失敗時把 stdout、stderr 尾端寫入 diagnostics，並加上 `--no-session-persistence`。

快照的 `updatedAt` 是 status line 執行時間，不代表資料新舊，所以同一視窗內改取使用率較高的值，而不是只比時間。

### 影響範圍

Claude 區塊的資料來源與更新時機。

### 後續注意事項

若 `/usage` 再次失敗，先查 `claude-cli-usage-error` 的 `details`。使用率若在同一視窗內下降（例如額度規則調整），畫面可能維持較高值，直到快照與 `/usage` 都反映或視窗重置。

### 驗證

語法檢查；合併與解析測試；實際 `/usage` 查詢；以 `CLAUDE_CLI_PATH` 強制失敗後，Widget 仍顯示快照並標示失敗；正常重啟後比對畫面與 `/usage`。
