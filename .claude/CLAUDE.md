# Claude Project Rules

## 專案定位

本專案是 Windows Electron 常駐小窗，用來顯示 Codex 與 Claude 的流量/額度狀態。主要畫面應維持小巧、可讀、右下角停靠，避免因新增資訊導致視窗裁切、底部空白過大或右側百分比被擠掉。

## 修改前必讀

每次分析或修改前，請先閱讀：

- `README.md`
- `AGENTS.md`
- `docs/architecture/frontend.md`
- `docs/knowledge/feature-overview.md`
- `docs/troubleshooting/issue-log.md`
- `docs/changelog/change-log.md`

若需求涉及資料來源或解析，另讀：

- `docs/knowledge/data-flow.md`
- `src/rateLimits.js`
- `src/claudeUsage.js`

## 工作原則

- 預設使用繁體中文回覆與撰寫文件。
- 修改前先分析問題、需求分類、影響檔案、方案與風險。
- 優先遵守既有架構與命名，不為了重構而大改。
- 不要覆蓋或回復使用者、Codex、Claude 之外已存在的工作成果。
- 不確定需求時先問，不要自行假設。
- 每次程式異動後，必須同步更新 `docs/changelog/change-log.md`。
- 若是錯誤、裁切、顯示異常或排查結果，必須同步更新 `docs/troubleshooting/issue-log.md`。

## UI 規則

- Electron 視窗尺寸以 `src/main.js` 的 `WINDOW_WIDTH`、`WINDOW_HEIGHT` 為準。
- 目前合併 Codex + Claude 顯示的可接受尺寸是 `360x315`。
- 視窗需維持右下角停靠，不要恢復成記憶拖曳座標。
- `src/styles.css` 的 widget 內容應使用自然高度排列，不要讓 Codex/Claude 區塊硬分 `1fr 1fr` 導致底部裁切。
- 百分比欄位需保留固定空間，不能被 meter 進度條擠掉。
- Claude `1 週` reset row 需顯示日期與時間，即使 reset 是今天也要顯示日期。
- 底部 `Codex 等效價值` 不可被裁切，也不要留下過大空白。

## Claude 流量規則

- Claude token 或 credentials 只能從本機讀取，不可寫入 repo。
- `src/claudeUsage.js` 的 reset 時間解析需支援 epoch 秒、epoch 毫秒與 ISO date string。
- 不要把 Claude 的用量套進 Codex 等效價值計算；目前等效價值只用 Codex usage observer events。

## 檢查方式

修改後至少執行：

```powershell
node --check src\main.js
node --check src\renderer.js
node --check src\preload.js
node --check src\claudeUsage.js
node --check src\rateLimits.js
```

若有改 UI，請重啟此專案的 Electron 程序，確認新版實際顯示。

## Git 與敏感資料

- 不要提交 `.claude/settings.local.json`。
- 不要提交 token、credentials、cache、session 或本機私密設定。
- 若要提交 `.claude/`，只提交可公開的規則文件，例如本檔。
- commit 前確認 `git status --short`，不要把無關檔案一起 stage。
- 除非使用者要求，不要自動 push；若使用者明確要求「上 Git」，才 commit 並 push。
