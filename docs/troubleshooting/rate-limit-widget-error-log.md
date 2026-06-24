# Rate Limit Widget Error Log

Use this focused log for recurring widget failures. Add a new entry every time the widget is repaired.

Global repair rule:

- Every completed modification must be staged, committed, and pushed to Git automatically unless the user explicitly says not to use Git.
- This includes documentation-only repairs and rule updates.
- Before editing, read `docs/rate-limit-widget-quick-index.md` and the exact file being changed.

## 2026-06-05 Stale Snapshot Recurrence

Symptom:

- The widget appears to stop updating after a few days or stays on a specific timestamp.

Observed:

- Direct reader check returned a fresh local `rate_limits` event at `2026-06-05T06:17:19.615Z`.
- The current active Codex thread can be stored in an older path such as `sessions\2026\05\28\...jsonl`, so path dates are misleading.
- Codex rate limits are currently read from local session snapshots only. The widget does not call Codex's backend or the desktop app's internal live state.

Root direction:

- Treat the source event timestamp as the only trustworthy freshness signal.
- Show stale state when Codex has not written a recent local snapshot.
- Persist stale/error diagnostics so the next repair starts with facts.

Change direction:

- Added source freshness metadata in `readLatestRateLimits()`.
- Added stale display in the renderer.
- Added `%APPDATA%\codex-rate-widget\diagnostics.jsonl` logging for stale/error refreshes.
- Added `docs/rate-limit-widget-quick-index.md` as the mandatory first-read checklist.

## 2026-06-24 Cross-Device Manual Refresh

Symptom:

- Manual refresh can remain stale when usage happened on another computer.

Root cause:

- Local Codex session logs only contain events written on this computer.
- Manual refresh previously shared the same local-only reader as automatic refresh.

Resolution:

- Manual refresh calls Codex app-server `account/rateLimits/read` and Claude Code CLI `/usage`.
- Automatic refresh remains local and cached.
- Codex live-query failures fall back to the session reader and are visible in the titlebar and diagnostics.
