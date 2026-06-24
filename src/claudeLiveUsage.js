const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const REQUEST_TIMEOUT_MS = 15_000;

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
  const sessionMatch = output.match(/Current session:\s*([\d.]+)% used\s*[·-]\s*resets\s+([^\r\n]+)/i);
  const weekMatch = output.match(/Current week(?:\s*\([^)]*\))?:\s*([\d.]+)% used\s*[·-]\s*resets\s+([^\r\n]+)/i);
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

function getClaudeLiveUsage() {
  return new Promise((resolve, reject) => {
    const cliPath = resolveClaudeCliPath();
    const child = spawn(cliPath, ['-p', '/usage'], {
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
      if (error) reject(error);
      else resolve(result);
    };

    const timeout = setTimeout(() => {
      finish(new Error('Claude live usage request timed out'));
    }, REQUEST_TIMEOUT_MS);

    child.on('error', (error) => finish(error));
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk) => {
      stderr = `${stderr}${chunk}`.slice(-2000);
    });
    child.on('exit', (code) => {
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

module.exports = { getClaudeLiveUsage, parseClaudeUsageOutput, parseResetText, resolveClaudeCliPath };
