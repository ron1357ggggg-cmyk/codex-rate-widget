# Codex Rate Widget Quick Index

## Mandatory Pre-Check

Before changing this widget, read these files first:

- `AGENTS.md`
- `docs/rate-limit-widget-quick-index.md`
- `docs/troubleshooting/issue-log.md`
- `docs/changelog/change-log.md`
- The source file you plan to edit under `src/`

Run these checks before and after code edits:

```powershell
git status --short --branch
node --check src\main.js
node --check src\renderer.js
node --check src\rateLimits.js
node -e "require('./src/rateLimits').readLatestRateLimits().then(x=>console.log(JSON.stringify(x,null,2)))"
```

PowerShell note: do not use bash heredocs or `&&`. Run commands separately or use PowerShell-native syntax.

## Git Rule

Every completed modification must be committed and pushed automatically unless the user explicitly says not to use Git.

This applies to all repository changes, including:

- Source code
- Documentation
- Troubleshooting logs
- Rules/checklists
- Scripts such as `start-widget.cmd`

Required close-out steps:

```powershell
git status --short --branch
git add <changed-files>
git commit -m "<type>: <short summary>"
git push origin main
git status --short --branch
```

Do not leave completed edits only in the working tree. If verification fails, fix or clearly record the blocker before committing.

## Runtime Diagnostic Log

The widget writes refresh warnings/errors here:

```text
%APPDATA%\codex-rate-widget\diagnostics.jsonl
```

Check this file whenever the widget appears stuck, stale, or broken.

## Data Source

The widget's startup and 30-second automatic refresh read local Codex session logs:

```text
%USERPROFILE%\.codex\sessions
%USERPROFILE%\.codex\archived_sessions
```

It searches `.jsonl` events for:

```text
payload.rate_limits
rate_limits
```

The session log value is a snapshot emitted by Codex after model activity. It is not a live API query. If Codex Desktop shows a newer value but no new `rate_limits` event has been written to local session logs, the widget cannot derive the exact new value by itself.

Manual refresh is intentionally different: it starts the installed Codex CLI app-server and requests `account/rateLimits/read`. This returns the account-level current limits and can reflect usage from another computer. If the live request fails, the widget falls back to the local session reader and surfaces the fallback state.

## Known Failure Pattern

Symptom:

- The widget appears to freeze on a previous time or percentage for one to three days.

Likely causes:

- Codex has not emitted a fresh local `rate_limits` snapshot.
- The latest active thread is stored in an older path, so path dates look stale even when the file is still being appended.
- Only one rate-limit window is present because Codex emitted `secondary: null`.
- A renderer error prevents successful data from rendering.
- More than one Electron instance was running before the single-instance lock was added.

Current mitigation:

- Pick the latest event by event timestamp, not file path date.
- Surface `checkedAt` separately from source event time.
- Mark data stale when the newest source event is older than 45 minutes.
- Write stale/error diagnostics to `diagnostics.jsonl`.
- Enforce one Electron app instance.

## Modification Direction

Prefer changes in this order:

1. Improve diagnostics and source freshness reporting.
2. Improve session-log indexing without adding heavy dependencies.
3. Keep both manual refresh and scheduled refresh on the documented Codex app-server `account/rateLimits/read` path, with local LOG fallback because the app-server API is experimental.
4. Avoid guessing rolling-window decay from old percentages. That can show precise-looking but wrong data.

## 2026-06-25 Refresh Schedule

- Initial load, manual refresh, tray refresh, and scheduled refresh all use the live Codex app-server / Claude CLI data flow.
- Scheduled refresh runs about every 10 minutes.
- Local Codex session LOG reading is a fallback only; it should not replace the last successful live value during normal operation.

## Quick Manual Checks

List running widget instances:

```powershell
Get-CimInstance Win32_Process | Where-Object { ($_.Name -in @('electron.exe','node.exe','cmd.exe')) -and ($_.CommandLine -like '*codex-rate-widget*') }
```

Show recent diagnostics:

```powershell
Get-Content "$env:APPDATA\codex-rate-widget\diagnostics.jsonl" -Tail 20
```

Show newest session files:

```powershell
Get-ChildItem -Path "$env:USERPROFILE\.codex\sessions","$env:USERPROFILE\.codex\archived_sessions" -Recurse -Filter *.jsonl | Sort-Object LastWriteTime -Descending | Select-Object -First 10 FullName,LastWriteTime
```
