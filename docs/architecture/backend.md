# 後端架構

## 目的

管理後端服務、API、Webhook、Controller、Service 與背景流程。

## 適用情境

當需求涉及 API、Server、Route、Controller、Service、Webhook 或 Bot callback 時，AI Agent 應閱讀此文件。

## 目前內容

Electron main process 負責掃描 `%USERPROFILE%\.codex\sessions`，解析最新 `.jsonl` 事件中的 `rate_limits`。

手動刷新由 main process 經 `src/codexLiveUsage.js` 啟動本機 Codex CLI app-server，呼叫 `account/rateLimits/read`。此流程不得取代每 30 秒自動讀取 LOG 的流程；即時查詢失敗時需 fallback 到 `src/rateLimits.js`。

## 規則

回覆、文件、分析與註解預設使用繁體中文；程式碼、API 名稱、套件名稱、類別名稱、函式名稱、檔案名稱、環境變數名稱與 Git 指令保留原文。

## 範例

待補充。

## 常見錯誤

待補充。

## 注意事項

每次查詢、分析或修改後，若產生可重用結論，必須回寫到本文件或其他對應 docs 文件。修改後也必須提醒使用者提交 Git。
