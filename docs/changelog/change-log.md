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

## 2026-06-18 Usage Widget Layout Fix

### Changed

- Increased the widget window from 340x360 to 360x390 for the combined Codex and Claude view.
- Changed the widget content grid to natural-height rows so the bottom value strip is not clipped.
- Tightened title, section, and limit-row spacing while preserving the percentage column.
- Reduced excess bottom whitespace by settling the combined widget at 360x315.
- Parse Claude reset headers as either epoch timestamps or ISO date strings.
- Force the Claude weekly reset row to include the reset date even when it resets today.

### Verification

- Ran `node --check src\main.js`, `node --check src\renderer.js`, `node --check src\preload.js`, `node --check src\claudeUsage.js`, and `node --check src\rateLimits.js`.

## 2026-06-18 Claude Project Rules

### Changed

- Added `.claude/CLAUDE.md` with project-specific rules for Claude, including required reading, UI constraints, reset-time handling, verification, and Git hygiene.
- Ignored `.claude/settings.local.json` so local Claude settings are not committed.

### Verification

- Reviewed `git status --short` to confirm only the public Claude rules file and `.gitignore` changes are staged for commit.

## 2026-06-24 Live Manual Refresh

### Changed

- Added `src/codexLiveUsage.js` to request current account limits through Codex app-server `account/rateLimits/read`.
- Split manual refresh from the existing automatic refresh IPC path.
- Manual refresh now reads Claude subscription limits through Claude Code CLI `/usage` instead of the five-minute API cache.
- Store successful Claude manual results in the shared memory cache and preserve the last successful value when the automatic API source temporarily fails.
- Keep successful Codex live results for five minutes while the unchanged 30-second LOG check continues in the background, preventing an older LOG snapshot from immediately replacing the manual result.
- Added local session fallback and a visible fallback label when Codex live refresh fails.
- Kept startup and 30-second automatic refresh behavior unchanged.
- Updated README, architecture, feature, business-rule, data-flow, troubleshooting, and Claude maintenance rules.

### Verification

- Generated and inspected the installed Codex 0.130.0 app-server protocol schema.
- Queried the live Codex account limits successfully through the new module.
- Queried Claude Code CLI `/usage`, parsed both `1:59pm` and `2pm` reset formats, and verified the live result in the running Widget.
- Confirmed the visible values changed after pressing the Widget refresh button.
- Waited beyond the next 30-second automatic check and confirmed the live values were not replaced by older local data.
- Restarted the Widget and created a desktop shortcut for user testing.
- Ran syntax checks for all changed JavaScript files.

## 2026-06-25 Live Refresh Schedule

### Changed

- Made the normal `usage:get` path use the same live refresh sources as the manual refresh button.
- Changed background refresh from 30 seconds to 10 minutes to avoid repeatedly launching Codex app-server and Claude CLI.
- Removed the five-minute Codex live-result TTL that allowed older local LOG data to replace live cross-device values.
- When Codex live refresh fails, keep the last successful live result when available before falling back to local session LOG.
- Increased the renderer refresh timeout to 15 seconds for both initial and manual live refreshes.

### Verification

- Ran syntax checks for all JavaScript files.
- Queried Codex live usage successfully through `src/codexLiveUsage.js`.
- Queried Claude live usage successfully through `src/claudeLiveUsage.js`.
- Ran `git diff --check`; only existing CRLF normalization warnings were reported.
