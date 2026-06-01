const fs = require('fs/promises');
const path = require('path');
const os = require('os');

const CODEX_DIR = process.env.CODEX_HOME || path.join(os.homedir(), '.codex');
const SESSIONS_DIR = path.join(CODEX_DIR, 'sessions');
const ARCHIVED_SESSIONS_DIR = path.join(CODEX_DIR, 'archived_sessions');

async function collectJsonlFiles(dir, result = []) {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return result;
  }

  await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await collectJsonlFiles(fullPath, result);
      } else if (entry.isFile() && entry.name.endsWith('.jsonl')) {
        const stat = await fs.stat(fullPath);
        result.push({ path: fullPath, mtimeMs: stat.mtimeMs });
      }
    })
  );

  return result;
}

function readJsonLinesFromEnd(text) {
  return text.split(/\r?\n/).filter(Boolean).reverse();
}

function normalizeRateLimits(raw, sourcePath, timestamp) {
  const primary = raw?.primary || null;
  const secondary = raw?.secondary || null;
  return {
    updatedAt: timestamp || new Date().toISOString(),
    sourcePath,
    limitId: raw?.limit_id || 'codex',
    planType: raw?.plan_type || null,
    reachedType: raw?.rate_limit_reached_type || null,
    windows: [
      normalizeWindow('5 小時', primary),
      normalizeWindow('1 週', secondary)
    ].filter(Boolean)
  };
}

function normalizeWindow(label, item) {
  if (!item) return null;
  const used = clamp(Number(item.used_percent || 0), 0, 100);
  const remaining = Math.max(0, Math.round(100 - used));
  return {
    label,
    usedPercent: used,
    remainingPercent: remaining,
    windowMinutes: item.window_minutes || null,
    resetsAt: item.resets_at ? Number(item.resets_at) * 1000 : null
  };
}

function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

async function readLatestRateLimits() {
  const files = (
    await Promise.all([
      collectJsonlFiles(SESSIONS_DIR),
      collectJsonlFiles(ARCHIVED_SESSIONS_DIR)
    ])
  )
    .flat()
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
  let latest = null;

  for (const file of files) {
    let text;
    try {
      text = await fs.readFile(file.path, 'utf8');
    } catch {
      continue;
    }

    for (const line of readJsonLinesFromEnd(text).slice(0, 2000)) {
      try {
        const event = JSON.parse(line);
        const rateLimits = event?.payload?.rate_limits || event?.rate_limits;
        if (rateLimits) {
          const eventTime = Date.parse(event.timestamp || '');
          const timestampMs = Number.isFinite(eventTime) ? eventTime : file.mtimeMs;
          if (!latest || timestampMs > latest.timestampMs) {
            latest = {
              timestampMs,
              data: {
                ok: true,
                ...normalizeRateLimits(rateLimits, file.path, event.timestamp)
              }
            };
          }
          break;
        }
      } catch {
        // Ignore partial or malformed session lines.
      }
    }
  }

  if (latest) return latest.data;

  return {
    ok: false,
    updatedAt: new Date().toISOString(),
    sourcePath: SESSIONS_DIR,
    windows: [],
    message: '尚未在 Codex session 裡找到 rate_limits。使用一次 Codex 後會自動更新。'
  };
}

module.exports = { readLatestRateLimits };
