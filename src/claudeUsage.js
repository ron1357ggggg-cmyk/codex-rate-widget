const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');

const CACHE_TTL_MS = 5 * 60 * 1000;

let cache = null;
let cacheTime = 0;

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
          resetsAt: fiveReset ? Number(fiveReset) * 1000 : null
        };
      }

      if (sevenUtil !== undefined) {
        const used = parseFloat(sevenUtil) * 100;
        result.sevenDay = {
          usedPercent: Math.round(used * 10) / 10,
          remainingPercent: Math.round((100 - used) * 10) / 10,
          resetsAt: sevenReset ? Number(sevenReset) * 1000 : null
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
    cache = err;
    cacheTime = now;
    return err;
  }

  try {
    const result = await fetchClaudeUsage(token);
    cache = result;
    cacheTime = now;
    return result;
  } catch {
    return cache ?? { ok: false, message: 'Claude usage fetch failed' };
  }
}

module.exports = { getClaudeUsage };
