# Claude usage HTTP 429

2026-11-03: The OAuth usage endpoint returned HTTP 429 with
`rate_limit_error` and `Retry-After: 3371` seconds. The response did not
identify the initial trigger or account-wide request threshold.

The widget previously ignored Retry-After, discarded successful values on
errors, and could query twice on startup (main push and renderer get).

The fix deduplicates concurrent requests, reuses successful results for one
minute, persists the last successful result and retry deadline in userData,
and honors server cooldown with a minimum ten-minute delay for HTTP 429.
Failed refreshes display previous values as old data, with timestamp and
retry details available on hover. Without a previous successful result,
the widget displays the error rather than inventing a percentage.

Validation: syntax checks and a simulated 429 verified concurrent request
deduplication, persisted cooldown, and retention of previous percentages.
Live recovery cannot be confirmed until the server cooldown expires.

Superseded the same day: the widget no longer calls this endpoint. It reads a local
snapshot written by the Claude Code status line. See `issue-log.md`.
