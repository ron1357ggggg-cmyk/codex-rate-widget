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
