# 程式異動紀錄

## 目的

記錄所有程式與文件異動的原因、內容、檔案、測試方式與風險。

## 適用情境

每次修改程式或文件後，AI Agent 應追加此文件。

## 目前內容

目前建立 AI Agent 文件治理架構。後續所有程式異動都必須依照本文件格式追加紀錄。

## 規則

所有程式異動都要追加到本文件，格式需包含：異動原因、異動內容、異動檔案、測試方式、風險評估。

## 範例

## yyyy-MM-dd 異動標題

### 異動原因

### 異動內容

### 異動檔案

### 測試方式

### 風險評估

## 常見錯誤

待補充。

## 注意事項

每次查詢、分析或修改後，若產生可重用結論，必須回寫到本文件或其他對應 docs 文件。修改後也必須提醒使用者提交 Git。

## 2026-06-01 Update

### Changed

- Select the latest Codex rate-limit event by event timestamp instead of stopping at the first matching session file.
- Include archived Codex session logs when looking for rate-limit events.
- Launch the widget directly through Electron from `start-widget.cmd` so the command window can close after startup.

### Verification

- Ran the rate-limit reader directly with Node and confirmed it returned a 2026-06-01 rate-limit event.

## 2026-06-01 Refresh Feedback Update

### Changed

- Show the latest manual/automatic check time in the widget titlebar so pressing refresh has visible feedback even when Codex has not emitted a newer rate-limit event.
- Disable the refresh button while a refresh request is in flight.

### Verification

- Ran the rate-limit reader directly with Node and confirmed it now includes `checkedAt`.

## 2026-06-01 Refresh Hang Guard

### Changed

- Add a five-second timeout and error state to manual refresh so the titlebar cannot remain stuck on the checking message.

### Verification

- Restarted the Electron widget after applying the renderer refresh guard.

## 2026-06-01 Refresh Failure Regression Fix

### Changed

- Fixed a renderer variable typo that caused successful refresh data to render as a failure state.

### Verification

- Ran `node --check src/renderer.js`.
- Ran the rate-limit reader directly and confirmed it returned current remaining percentages.

## 2026-06-03 Single Instance Update

### Changed

- Added an Electron single-instance lock so launching the desktop shortcut again focuses the existing widget instead of opening a duplicate copy.

### Verification

- Ran JavaScript syntax checks for main, renderer, and rate-limit modules.
- Restarted the widget and launched it twice; only one Electron app instance remained.

## 2026-06-05 Source Freshness Diagnostics

### Changed

- Added `docs/rate-limit-widget-quick-index.md` as the mandatory first-read checklist for future repairs.
- Added `docs/troubleshooting/rate-limit-widget-error-log.md` as a focused recurring widget failure log.
- Added source freshness metadata to rate-limit reads: `sourceType`, `sourceEventAgeMs`, `stale`, and `staleAfterMs`.
- The renderer now shows stale source age when Codex has not written a recent local `rate_limits` snapshot.
- The main process writes stale/error diagnostics to `%APPDATA%\codex-rate-widget\diagnostics.jsonl`.
- Cleaned corrupted UI/source strings in `rateLimits.js` and `renderer.js`.

### Verification

- Ran `node --check src\main.js`, `node --check src\renderer.js`, and `node --check src\rateLimits.js`.
- Ran the rate-limit reader directly and confirmed it returned a 2026-06-05 snapshot with `stale: false`.

## 2026-06-05 Git Automation Rule

### Changed

- Added a mandatory rule that every completed repository modification must be staged, committed, and pushed automatically unless the user explicitly opts out.
- Clarified that the rule applies to source, docs, troubleshooting logs, checklists, and scripts.

### Verification

- Updated the quick index and focused widget error log.

## 2026-06-08 Bottom Right Docking

### Changed

- Replaced persisted startup bounds with a computed Windows work-area bottom-right dock position.
- Re-dock the widget near the clock area when it is shown from the tray or focused by a second launch.
- Recalculate the dock position when display metrics change.
- Documented the new positioning behavior and business rule.

### Verification

- Ran `node --check src\main.js`.
