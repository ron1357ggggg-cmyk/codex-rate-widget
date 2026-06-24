# 資料流

## 目的

管理資料輸入、處理、轉換、輸出與檔案格式。

## 適用情境

當需求涉及 Excel、JSON、CSV、資料轉換、資料輸入輸出或檔案產生時，AI Agent 應閱讀此文件。

## 目前內容

掃描 Codex sessions 目錄，讀取最新 `.jsonl`，解析 `rate_limits`，再更新 Electron 小窗畫面。

手動刷新走獨立資料流：renderer 呼叫 `usage:refresh` IPC；主程序啟動本機 Codex app-server 並呼叫 `account/rateLimits/read`，同時執行 Claude Code CLI `/usage`。兩邊完成後合併回傳畫面。任一即時查詢失敗時會退回既有資料來源，並附加 `liveRefreshFailed` 狀態。

## 規則

回覆、文件、分析與註解預設使用繁體中文；程式碼、API 名稱、套件名稱、類別名稱、函式名稱、檔案名稱、環境變數名稱與 Git 指令保留原文。

## 範例

待補充。

## 常見錯誤

待補充。

## 注意事項

每次查詢、分析或修改後，若產生可重用結論，必須回寫到本文件或其他對應 docs 文件。修改後也必須提醒使用者提交 Git。
