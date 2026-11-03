const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const https = require('https');

const REQUEST_TIMEOUT_MS = 15_000;
const SNAPSHOT_STALE_MS = 45 * 60 * 1000;
// 要比 renderer 的 15 秒逾時短，失敗時畫面才來得及顯示快照。
const CLI_TIMEOUT_MS = 12_000;
// /usage 與快照的重置時間可能差 1 分鐘，差距在此範圍內視為同一個視窗。
const SAME_WINDOW_TOLERANCE_MS = 2 * 60 * 1000;

function resolveClaudeCliPath() {
  const candidates = [
    process.env.CLAUDE_CLI_PATH,
    path.join(os.homedir(), '.local', 'bin', 'claude.exe')
  ].filter(Boolean);

  return candidates.find((candidate) => fs.existsSync(candidate)) || 'claude.exe';
}

function parseResetText(value, now = new Date()) {
  const withoutZone = String(value || '').replace(/\s*\([^)]+\)\s*$/, '').trim();
  if (!withoutZone) return null;

  const match = withoutZone.match(/^([A-Za-z]{3})\s+(\d{1,2}),\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i);
  if (!match) return null;

  const monthIndex = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
  }[match[1].toLowerCase()];
  if (monthIndex === undefined) return null;

  let hour = Number(match[3]) % 12;
  if (match[5].toLowerCase() === 'pm') hour += 12;
  const minute = Number(match[4] || 0);
  let parsed = new Date(now.getFullYear(), monthIndex, Number(match[2]), hour, minute).getTime();

  if (parsed < now.getTime() - 30 * 24 * 60 * 60 * 1000) {
    parsed = new Date(now.getFullYear() + 1, monthIndex, Number(match[2]), hour, minute).getTime();
  }
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeUsageWindow(match, now) {
  if (!match) return null;
  const usedPercent = Math.min(100, Math.max(0, Number(match[1]) || 0));
  return {
    usedPercent,
    remainingPercent: Math.max(0, Math.round((100 - usedPercent) * 10) / 10),
    resetsAt: parseResetText(match[2], now)
  };
}

function parseClaudeUsageOutput(output, now = new Date()) {
  const sessionMatch = output.match(/Current session:\s*([\d.]+)% used(?:\s*[·•\-–—]\s*resets\s+([^\r\n]+))?/i);
  const weekMatch = output.match(/Current week(?:\s*\([^)]*\))?:\s*([\d.]+)% used(?:\s*[·•\-–—]\s*resets\s+([^\r\n]+))?/i);
  const fiveHour = normalizeUsageWindow(sessionMatch, now);
  const sevenDay = normalizeUsageWindow(weekMatch, now);

  if (!fiveHour && !sevenDay) {
    throw new Error('Claude CLI usage output did not contain limit percentages');
  }

  return {
    ok: true,
    checkedAt: now.toISOString(),
    sourceType: 'claude-cli-usage',
    fiveHour,
    sevenDay
  };
}

function getClaudeCliUsage() {
  return new Promise((resolve, reject) => {
    const cliPath = resolveClaudeCliPath();
    // 定時查詢不留下 session 紀錄，避免每天累積大量 transcript。
    const child = spawn(cliPath, ['-p', '/usage', '--no-session-persistence'], {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let stdout = '';
    let stderr = '';
    let settled = false;

    const finish = (error, result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (!child.killed) child.kill();
      if (error) {
        error.details = { cliPath, stdoutTail: stdout.slice(-1000), stderrTail: stderr.slice(-1000) };
        reject(error);
      } else {
        resolve(result);
      }
    };

    const timeout = setTimeout(() => {
      finish(new Error('Claude live usage request timed out'));
    }, CLI_TIMEOUT_MS);

    child.on('error', (error) => finish(error));
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk) => {
      stderr = `${stderr}${chunk}`.slice(-2000);
    });
    // 用 close 而非 exit：exit 觸發時 stdout 可能還沒收完。
    child.on('close', (code) => {
      if (settled) return;
      if (code !== 0) {
        finish(new Error(stderr.trim() || `Claude CLI exited with code ${code}`));
        return;
      }
      try {
        finish(null, parseClaudeUsageOutput(stdout));
      } catch (error) {
        finish(error);
      }
    });
  });
}

function getClaudeLiveUsage() {
  return new Promise((resolve, reject) => {
    let token;
    try {
      const credentials = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.claude', '.credentials.json'), 'utf8'));
      token = credentials?.claudeAiOauth?.accessToken;
    } catch {}
    if (!token) return reject(new Error('Claude Code 請先重新登入（claude auth login）'));
    const request = https.get('https://api.anthropic.com/api/oauth/usage', {
      headers: { Authorization: `Bearer ${token}`, 'anthropic-beta': 'oauth-2025-04-20' }
    }, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { body += chunk; });
      response.on('error', reject);
      response.on('end', () => {
        if (response.statusCode === 401 || response.statusCode === 403) {
          reject(new Error('Claude Code 登入失效，請執行 claude auth login'));
          return;
        }
        if (response.statusCode !== 200) {
          const error = new Error(`Claude usage HTTP ${response.statusCode}`);
          error.status = response.statusCode;
          const retry = response.headers['retry-after'];
          error.retryAfterMs = /^\d+$/.test(String(retry)) ? Number(retry) * 1000 : Math.max(0, Date.parse(retry) - Date.now()) || 0;
          return reject(error);
        }
        try {
          const data = JSON.parse(body);
          const normalize = (window) => {
            if (!window || typeof window.utilization !== 'number' || !Number.isFinite(window.utilization)) return null;
            const usedPercent = Math.max(0, Math.min(100, window.utilization));
            const reset = Date.parse(window.resets_at);
            return { usedPercent, remainingPercent: Math.round((100 - usedPercent) * 10) / 10, resetsAt: Number.isFinite(reset) ? reset : null };
          };
          const fiveHour = normalize(data.five_hour);
          const sevenDay = normalize(data.seven_day);
          if (!fiveHour && !sevenDay) throw new Error('Claude usage 回應沒有可用額度');
          resolve({ ok: true, checkedAt: new Date().toISOString(), sourceType: 'claude-oauth-usage', fiveHour, sevenDay });
        } catch (error) { reject(error); }
      });
    });
    request.on('error', reject);
    request.setTimeout(REQUEST_TIMEOUT_MS, () => request.destroy(new Error('Claude usage request timed out')));
  });
}

function claudeSnapshotPath() {
  return process.env.CLAUDE_RATE_LIMIT_SNAPSHOT || path.join(os.homedir(), '.claude', 'rate-limit-snapshot.json');
}

function normalizeSnapshotWindow(window, now) {
  if (!window || typeof window.used_percentage !== 'number' || !Number.isFinite(window.used_percentage)) return null;
  const resetsAt = Number.isFinite(window.resets_at) ? window.resets_at * 1000 : null;
  const usedPercent = Math.max(0, Math.min(100, window.used_percentage));
  return { usedPercent, remainingPercent: Math.round((100 - usedPercent) * 10) / 10, resetsAt };
}

// 讀取 scripts/claude-statusline.js 寫出的快照，不發送任何網路請求。
function getClaudeStatusLineUsage(now = Date.now()) {
  let snapshot;
  try {
    snapshot = JSON.parse(fs.readFileSync(claudeSnapshotPath(), 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') throw new Error('等待 Claude Code 回應後更新');
    throw new Error(`Claude 用量快照無法讀取：${error.message}`);
  }
  const fiveHour = normalizeSnapshotWindow(snapshot.five_hour, now);
  const sevenDay = normalizeSnapshotWindow(snapshot.seven_day, now);
  if (!fiveHour && !sevenDay) throw new Error('Claude 用量快照沒有可用額度');
  const updatedAt = Date.parse(snapshot.updatedAt);
  return {
    ok: true,
    checkedAt: snapshot.updatedAt,
    sourceType: 'claude-statusline',
    sourcePath: claudeSnapshotPath(),
    stale: !Number.isFinite(updatedAt) || now - updatedAt > SNAPSHOT_STALE_MS ||
      [fiveHour, sevenDay].some((window) => window && window.resetsAt !== null && window.resetsAt <= now),
    fiveHour,
    sevenDay
  };
}

function pickClaudeWindow(cli, snapshot, cliTime, snapshotTime) {
  if (!cli || !snapshot) return cli || snapshot || null;
  if (cli.resetsAt === null || snapshot.resetsAt === null) {
    return cliTime >= snapshotTime ? cli : snapshot;
  }
  if (Math.abs(cli.resetsAt - snapshot.resetsAt) > SAME_WINDOW_TOLERANCE_MS) {
    return cli.resetsAt > snapshot.resetsAt ? cli : snapshot;
  }
  // 同一個視窗內用量只增不減，較高的值才是較新的資料；快照時間只代表 status line 的執行時間。
  const higher = snapshot.usedPercent > cli.usedPercent ? snapshot : cli;
  return { ...higher, resetsAt: cli.resetsAt };
}

function mergeClaudeUsage(cli, snapshot, now = Date.now()) {
  if (!cli && !snapshot) return null;
  const cliTime = cli ? Date.parse(cli.checkedAt) || 0 : 0;
  const snapshotTime = snapshot ? Date.parse(snapshot.checkedAt) || 0 : 0;
  const latest = Math.max(cliTime, snapshotTime);
  const fiveHour = pickClaudeWindow(cli && cli.fiveHour, snapshot && snapshot.fiveHour, cliTime, snapshotTime);
  const sevenDay = pickClaudeWindow(cli && cli.sevenDay, snapshot && snapshot.sevenDay, cliTime, snapshotTime);
  return {
    ok: true,
    checkedAt: new Date(latest).toISOString(),
    sourceType: 'claude-usage-merged',
    cliCheckedAt: cli ? cli.checkedAt : null,
    snapshotCheckedAt: snapshot ? snapshot.checkedAt : null,
    stale: now - latest > SNAPSHOT_STALE_MS ||
      [fiveHour, sevenDay].some((window) => window && window.resetsAt !== null && window.resetsAt <= now),
    fiveHour,
    sevenDay
  };
}

module.exports = { claudeSnapshotPath, getClaudeCliUsage, getClaudeLiveUsage, getClaudeStatusLineUsage, mergeClaudeUsage, parseClaudeUsageOutput, parseResetText, resolveClaudeCliPath };
