const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');

const CACHE_TTL_MS = 5 * 60 * 1000;

let cache = null;
let cacheTime = 0;

function setClaudeUsageCache(value, now = Date.now()) {
  if (!value?.ok) return;
  cache = value;
  cacheTime = now;
}

function parseResetTime(value) {
  if (!value) return null;

  const numeric = Number(value);
  if (Number.isFinite(numeric)) {
    return numeric > 10_000_000_000 ? numeric : numeric * 1000;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function readToken() {
  try {
    const credsPath = path.join(os.homedir(), '.claude', '.credentials.json');
    const creds = JSON.parse(fs.readFileSync(credsPath, 'utf8'));
    return creds?.claudeAiOauth?.accessToken ?? null;
  } catch {
    return null;
  }
}

function fetchClaudeUsage(token) {
  return new Promise((resolve) => {
    const payload = JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1,
      messages: [{ role: 'user', content: '.' }]
    });

    const options = {
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(payload)
      },
      timeout: 10000
    };

    const req = https.request(options, (res) => {
      const fiveUtil = res.headers['anthropic-ratelimit-unified-5h-utilization'];
      const fiveReset = res.headers['anthropic-ratelimit-unified-5h-reset'];
      const sevenUtil = res.headers['anthropic-ratelimit-unified-7d-utilization'];
      const sevenReset = res.headers['anthropic-ratelimit-unified-7d-reset'];

      res.resume();

      if (fiveUtil === undefined && sevenUtil === undefined) {
        resolve({ ok: false, message: 'Rate limit headers not present' });
        return;
      }

      const result = { ok: true };

      if (fiveUtil !== undefined) {
        const used = parseFloat(fiveUtil) * 100;
        result.fiveHour = {
          usedPercent: Math.round(used * 10) / 10,
          remainingPercent: Math.round((100 - used) * 10) / 10,
          resetsAt: parseResetTime(fiveReset)
        };
      }

      if (sevenUtil !== undefined) {
        const used = parseFloat(sevenUtil) * 100;
        result.sevenDay = {
          usedPercent: Math.round(used * 10) / 10,
          remainingPercent: Math.round((100 - used) * 10) / 10,
          resetsAt: parseResetTime(sevenReset)
        };
      }

      resolve(result);
    });

    req.on('error', () => resolve({ ok: false, message: 'Claude usage API call failed' }));
    req.on('timeout', () => {
      req.destroy();
      resolve({ ok: false, message: 'Claude usage API call timed out' });
    });
    req.write(payload);
    req.end();
  });
}

async function getClaudeUsage(force = false) {
  const now = Date.now();
  if (!force && cache && now - cacheTime < CACHE_TTL_MS) return cache;

  const token = readToken();
  if (!token) {
    const err = { ok: false, message: 'Claude Code credentials not found' };
    return cache?.ok ? { ...cache, cachedFallback: true } : err;
  }

  try {
    const result = await fetchClaudeUsage(token);
    if (result.ok) {
      setClaudeUsageCache(result, now);
      return result;
    }
    return cache?.ok ? { ...cache, cachedFallback: true } : result;
  } catch {
    return cache?.ok ? { ...cache, cachedFallback: true } : { ok: false, message: 'Claude usage fetch failed' };
  }
}

module.exports = { getClaudeUsage, setClaudeUsageCache };
