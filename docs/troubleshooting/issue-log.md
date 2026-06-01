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
