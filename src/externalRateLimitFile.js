const fs = require('fs/promises');
const path = require('path');
const os = require('os');

const STALE_AFTER_MS = 45 * 60 * 1000;

function expandHome(filePath) {
  if (!filePath) return filePath;
  if (filePath === '~') return os.homedir();
  if (filePath.startsWith('~/') || filePath.startsWith(`~${path.sep}`)) {
    return path.join(os.homedir(), filePath.slice(2));
  }
  return filePath;
}

function validateExternalData(data) {
  if (!data || typeof data !== 'object') {
    throw new Error('External rate limit JSON must be an object.');
  }
  if (!Array.isArray(data.windows)) {
    throw new Error('External rate limit JSON must include a windows array.');
  }
}

function applyFreshness(data, sourcePath) {
  const checkedAtMs = Date.now();
  const checkedAt = new Date(checkedAtMs).toISOString();
  const sourceTime = Date.parse(data.updatedAt || data.checkedAt || '');
  const timestampMs = Number.isFinite(sourceTime) ? sourceTime : checkedAtMs;
  const sourceEventAgeMs = Math.max(0, checkedAtMs - timestampMs);

  return {
    ...data,
    ok: data.ok !== false,
    checkedAt,
    sourceType: data.sourceType || 'external-json',
    sourcePath,
    sourceEventAgeMs,
    stale: sourceEventAgeMs > STALE_AFTER_MS,
    staleAfterMs: STALE_AFTER_MS
  };
}

async function readExternalRateLimitFile() {
  const configuredPath = process.env.CODEX_RATE_LIMIT_FILE;
  if (!configuredPath) return null;

  const sourcePath = expandHome(configuredPath);
  try {
    const text = await fs.readFile(sourcePath, 'utf8');
    const data = JSON.parse(text);
    validateExternalData(data);
    return {
      data: applyFreshness(data, sourcePath),
      error: null
    };
  } catch (error) {
    return {
      data: null,
      error: {
        sourceType: 'external-json',
        sourcePath,
        message: error?.message || String(error)
      }
    };
  }
}

module.exports = { readExternalRateLimitFile };
