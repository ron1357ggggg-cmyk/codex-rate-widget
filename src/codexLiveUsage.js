const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const REQUEST_TIMEOUT_MS = 12_000;

function resolveCodexCliPath() {
  const targetTriple = process.arch === 'arm64'
    ? 'aarch64-pc-windows-msvc'
    : 'x86_64-pc-windows-msvc';
  const platformPackage = process.arch === 'arm64' ? 'codex-win32-arm64' : 'codex-win32-x64';
  const npmRoot = process.env.APPDATA ? path.join(process.env.APPDATA, 'npm') : null;
  const candidates = [
    process.env.CODEX_CLI_PATH,
    npmRoot
      ? path.join(
          npmRoot,
          'node_modules',
          '@openai',
          'codex',
          'node_modules',
          '@openai',
          platformPackage,
          'vendor',
          targetTriple,
          'codex',
          'codex.exe'
        )
      : null,
    npmRoot ? path.join(npmRoot, 'codex.cmd') : null
  ].filter(Boolean);

  return candidates.find((candidate) => fs.existsSync(candidate)) || 'codex.cmd';
}

function startCodexAppServer(cliPath) {
  if (/\.cmd$/i.test(cliPath)) {
    return spawn(cliPath, ['app-server', '--listen', 'stdio://'], {
      shell: true,
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe']
    });
  }

  return spawn(cliPath, ['app-server', '--listen', 'stdio://'], {
    windowsHide: true,
    stdio: ['pipe', 'pipe', 'pipe']
  });
}

function normalizeWindow(label, item) {
  if (!item) return null;
  const usedPercent = Math.min(100, Math.max(0, Number(item.usedPercent) || 0));
  const windowMinutes = item.windowDurationMins || null;
  return {
    label: labelForWindowMinutes(windowMinutes, label),
    usedPercent,
    remainingPercent: Math.max(0, Math.round(100 - usedPercent)),
    windowMinutes,
    resetsAt: item.resetsAt ? Number(item.resetsAt) * 1000 : null
  };
}

function labelForWindowMinutes(windowMinutes, fallback = '用量') {
  const minutes = Number(windowMinutes);
  if (minutes === 300) return '5 小時';
  if (minutes === 10080) return '1 週';
  if (Number.isFinite(minutes) && minutes > 0) {
    if (minutes % 1440 === 0) return `${Math.round(minutes / 1440)} 天`;
    if (minutes % 60 === 0) return `${Math.round(minutes / 60)} 小時`;
    return `${minutes} 分鐘`;
  }
  return fallback;
}

function normalizeLiveUsage(response, cliPath) {
  const snapshot = response?.rateLimitsByLimitId?.codex || response?.rateLimits;
  if (!snapshot) throw new Error('Codex app-server did not return rate limits');

  const checkedAt = new Date().toISOString();
  return {
    ok: true,
    checkedAt,
    updatedAt: checkedAt,
    sourceType: 'codex-app-server',
    sourcePath: cliPath,
    sourceEventAgeMs: 0,
    stale: false,
    limitId: snapshot.limitId || 'codex',
    planType: snapshot.planType || null,
    reachedType: snapshot.rateLimitReachedType || null,
    windows: [
      normalizeWindow('5 小時', snapshot.primary),
      normalizeWindow('1 週', snapshot.secondary)
    ].filter(Boolean)
  };
}

function getCodexLiveUsage() {
  return new Promise((resolve, reject) => {
    const cliPath = resolveCodexCliPath();
    const child = startCodexAppServer(cliPath);
    let stdoutBuffer = '';
    let stderrBuffer = '';
    let settled = false;

    const finish = (error, result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (!child.killed) child.kill();
      if (error) reject(error);
      else resolve(result);
    };

    const send = (message) => {
      try {
        child.stdin.write(`${JSON.stringify(message)}\n`);
      } catch (error) {
        finish(error);
      }
    };

    const timeout = setTimeout(() => {
      finish(new Error('Codex live usage request timed out'));
    }, REQUEST_TIMEOUT_MS);

    child.on('error', (error) => finish(error));
    child.stdin.on('error', (error) => finish(error));
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk) => {
      stderrBuffer = `${stderrBuffer}${chunk}`.slice(-2000);
    });
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      stdoutBuffer += chunk;
      const lines = stdoutBuffer.split(/\r?\n/);
      stdoutBuffer = lines.pop() || '';

      for (const line of lines) {
        let message;
        try {
          message = JSON.parse(line);
        } catch {
          continue;
        }

        if (message.id === 1 && message.result) {
          send({ method: 'initialized' });
          send({ id: 2, method: 'account/rateLimits/read', params: null });
        } else if (message.id === 1 && message.error) {
          finish(new Error(message.error.message || 'Codex app-server initialization failed'));
        } else if (message.id === 2 && message.result) {
          try {
            finish(null, normalizeLiveUsage(message.result, cliPath));
          } catch (error) {
            finish(error);
          }
        } else if (message.id === 2 && message.error) {
          finish(new Error(message.error.message || 'Codex live usage request failed'));
        }
      }
    });
    child.on('exit', (code) => {
      if (!settled) {
        const detail = stderrBuffer.trim().split(/\r?\n/).pop();
        finish(new Error(detail || `Codex app-server exited with code ${code}`));
      }
    });

    send({
      id: 1,
      method: 'initialize',
      params: {
        clientInfo: { name: 'codex-rate-widget', version: '0.1.0' },
        capabilities: { experimentalApi: true }
      }
    });
  });
}

module.exports = { getCodexLiveUsage, normalizeLiveUsage, resolveCodexCliPath };
