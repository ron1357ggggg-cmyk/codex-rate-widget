# AI Collaboration Log

Shared by Codex, Claude Agent, and Claude Code. Append every AI-assisted request, investigation, edit, restart, commit, and push here.

## 2026-07-22 Initial shared AI workflow setup

- Actor: Codex.
- User request: add shared AI rules and a modification/question log to every AI development project, then commit and push without affecting running projects.
- Project/task category: workflow and cross-AI handoff.
- Files changed: `CLAUDE.md`, `docs/ai-collaboration-log.md`, global `~/.codex/AGENTS.md`, global `~/.claude/CLAUDE.md`.
- Change: kept shared rules global and added only a thin Claude project entry plus this project collaboration log.
- Validation: file creation verified before commit.
- Runtime/restart impact: none.
- Git result: to be committed and pushed in `Add AI collaboration entrypoints`.

## 2026-11-03 Claude usage moved to status line snapshot

- Actor: Claude Code.
- User request: find out why the widget could not read Claude usage, fix it, and start it.
- Project/task category: bug fix, data source change.
- Files changed: `scripts/claude-statusline.js`, `src/claudeLiveUsage.js`, `src/main.js`, `src/renderer.js`, `README.md`, `.claude/CLAUDE.md`, `docs/`, global `~/.claude/settings.json`.
- Change: replaced `api/oauth/usage` polling with a local snapshot written by the status line; removed the uncommitted 429 cooldown logic from `src/main.js`.
- Validation: syntax checks, script and reader tests with sample data, widget restart compared against the real snapshot.
- Runtime/restart impact: widget restarted.
- Git result: not committed.
