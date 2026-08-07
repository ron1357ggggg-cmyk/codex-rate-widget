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
