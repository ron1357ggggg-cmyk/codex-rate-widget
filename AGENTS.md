# AGENTS.md

## 專案定位

本文件為 AI Agent 在 `codex-rate-widget` 專案中的主要工作規範入口。進行任何分析或修改前，必須先閱讀 README.md，並以 README.md 的專案功能說明為優先依據。

本專案是 Windows Electron 常駐小窗，用來讀取本機 Codex session 中最新的 `rate_limits`，顯示 5 小時與 1 週剩餘百分比、恢復時間，並支援拖曳移動、置頂與縮到系統列。

## AI Agent 工作原則

1. 回覆與文件預設使用繁體中文。
2. 修改前必須先分析，不可直接大改。
3. 優先遵守 README.md 的專案功能說明。
4. 優先遵守既有程式架構與命名規則。
5. 不可為了重構而大幅改變架構。
6. 不確定需求時，先提出問題，不要自行假設。
7. 修改後必須更新對應文件。
8. 修改後必須提醒使用者提交 Git。

## 問題分析流程

當使用者提出查詢、錯誤、Bug、功能異常時：

1. 先閱讀 README.md。
2. 再閱讀 AGENTS.md。
3. 判斷問題類型。
4. 依照路由規則閱讀 docs/ 對應文件。
5. 分析可能原因。
6. 說明影響範圍。
7. 提出處理方案。
8. 若有確認結果，必須寫入 docs/troubleshooting/issue-log.md。
9. 若屬於固定知識，必須寫入 docs/knowledge/。
10. 若有修改程式，必須寫入 docs/changelog/change-log.md。

## 修改流程

修改程式前，必須先輸出：

【問題分析】

【需求分類】

【預計閱讀文件】

【影響檔案】

【修改方案】

【風險評估】

等待使用者確認後再修改。

修改程式後，必須輸出：

【修改內容】

【異動檔案】

【文件更新】

【測試方式】

【可能風險】

【Git 提交提醒】

## 文件更新規則

每次查詢、分析、修改後，依照情境更新文件：

- 功能理解或功能規則：寫入 docs/knowledge/feature-overview.md 或 docs/knowledge/business-rule.md。
- 資料流、資料轉換、資料格式：寫入 docs/knowledge/data-flow.md。
- 專案架構、檔案位置、模組分工：寫入 docs/architecture/project-structure.md。
- API 錯誤、Webhook 錯誤、HTTP 錯誤：寫入 docs/troubleshooting/api-error.md。
- 執行錯誤、Crash、套件版本、Log：寫入 docs/troubleshooting/runtime-error.md。
- 部署、環境變數、啟動方式、Hosting：寫入 docs/troubleshooting/deployment.md。
- 問題處理紀錄：所有已確認的問題、原因、解法，都要追加到 docs/troubleshooting/issue-log.md。
- 程式異動紀錄：所有程式異動，都要追加到 docs/changelog/change-log.md。

## Git 提交規則

每次完成修改後，必須提醒使用者執行 Git 提交。

建議指令：

`ash
git status
git add .
git commit -m "docs: 建立 AI Agent 文件治理架構"
`

如果是功能修改，commit message 請依照實際內容調整，例如：

`ash
git commit -m "fix: 修正 LINE webhook 錯誤處理"
git commit -m "feat: 新增 Discord 房間監控紀錄功能"
git commit -m "docs: 更新問題處理紀錄"
`

除非使用者明確要求，不要自動 push。

## 路由規則

### README 優先

任何需求都必須先參考 README.md。README.md 用來判斷該 Repo 的專案定位與核心功能。

### 後端或 API

如果需求涉及 API、Server、Route、Controller、Service、Webhook 或 Bot callback，請先閱讀 docs/architecture/backend.md。

### 前端或畫面

如果需求涉及 HTML、CSS、JavaScript、TypeScript、UI、Button、Widget 或頁面樣式，請先閱讀 docs/architecture/frontend.md。

### 專案結構

如果需求涉及檔案位置、模組拆分、新功能應該放哪裡或重構，請先閱讀 docs/architecture/project-structure.md。

### 核心功能與規則

如果需求涉及 Bot 指令、自動化流程、資料處理、功能行為或使用者操作流程，請先閱讀 docs/knowledge/feature-overview.md 以及 docs/knowledge/business-rule.md。

### 資料流

如果需求涉及 Excel、JSON、CSV、資料轉換、資料輸入輸出或檔案產生，請先閱讀 docs/knowledge/data-flow.md。

### 問題排查

如果需求涉及錯誤訊息、Exception、Crash、Log、Timeout、Token、Webhook 或 HTTP Status Code，請先閱讀 docs/troubleshooting/issue-log.md 以及對應的 troubleshooting 文件。

### 部署

如果需求涉及部署、啟動、環境變數、排程、Windows 啟動、Linux 啟動或 Hosting，請先閱讀 docs/troubleshooting/deployment.md。

### Git

如果需求涉及 Git、Branch、Commit、Merge 或 Pull Request，請先閱讀 docs/standards/git-flow.md。