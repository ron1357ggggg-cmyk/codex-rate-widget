# Git 流程

## 目的

管理 branch、commit、merge、pull request 與提交提醒規則。

## 適用情境

當需求涉及 Git、Branch、Commit、Merge 或 Pull Request 時，AI Agent 應閱讀此文件。

## 目前內容

每次完成修改後，必須提醒使用者執行 `git status`、`git add .`、`git commit -m "..."`。除非使用者明確要求，不要自動 push。

## 規則

除非使用者明確要求，不要自動 push。commit message 應依照實際內容使用 `docs:`、`fix:`、`feat:` 等前綴。

## 範例

待補充。

## 常見錯誤

待補充。

## 注意事項

每次查詢、分析或修改後，若產生可重用結論，必須回寫到本文件或其他對應 docs 文件。修改後也必須提醒使用者提交 Git。