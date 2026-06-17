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

function applyFreshness(data, sourcePath, sourceType = 'external-json') {
  const checkedAtMs = Date.now();
  const checkedAt = new Date(checkedAtMs).toISOString();
  const sourceTime = Date.parse(data.updatedAt || data.checkedAt || '');
  const timestampMs = Number.isFinite(sourceTime) ? sourceTime : checkedAtMs;
  const sourceEventAgeMs = Math.max(0, checkedAtMs - timestampMs);

  return {
    ...data,
    ok: data.ok !== false,
    checkedAt,
    sourceType: data.sourceType || sourceType,
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
      data: applyFreshness(data, sourcePath, 'external-json'),
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

// Claude does not currently expose a known local log or API that reports
// "% of plan quota used" the way Codex's session .jsonl files do. Rather than
// guess at a live source, this reads a small JSON snapshot the user maintains
// themselves (e.g. copied from Settings -> Usage), using the same
// "windows" shape the rest of this widget already understands. This reuses
// the external-file mechanism above instead of inventing a parallel one.
function defaultClaudeUsagePath() {
  return path.join(os.homedir(), '.claude-usage.json');
}

async function readClaudeUsageFile() {
  const configuredPath = process.env.CLAUDE_USAGE_FILE
    ? expandHome(process.env.CLAUDE_USAGE_FILE)
    : defaultClaudeUsagePath();

  try {
    const text = await fs.readFile(configuredPath, 'utf8');
    const data = JSON.parse(text);
    validateExternalData(data);
    return {
      data: applyFreshness(data, configuredPath, 'claude-usage-json'),
      error: null
    };
  } catch (error) {
    const notFound = error?.code === 'ENOENT';
    return {
      data: null,
      error: {
        sourceType: 'claude-usage-json',
        sourcePath: configuredPath,
        message: notFound
          ? `尚未建立 Claude 用量檔案：${configuredPath}（可設定 CLAUDE_USAGE_FILE 改路徑，格式請見 README）`
          : error?.message || String(error)
      }
    };
  }
}

module.exports = {
  readExternalRateLimitFile,
  readClaudeUsageFile,
  defaultClaudeUsagePath,
  STALE_AFTER_MS
};
