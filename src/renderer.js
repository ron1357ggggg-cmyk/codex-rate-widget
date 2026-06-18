const codexLimitsEl = document.getElementById('codex-limits');
const claudeLimitsEl = document.getElementById('claude-limits');
const updatedEl = document.getElementById('updated');
const refreshBtn = document.getElementById('refresh');
const hideBtn = document.getElementById('hide');
const savedMoneyEl = document.getElementById('saved-money');

const EVENTS_KEY = 'codex_usage_observer_events';
const SETTINGS_KEY = 'codex_usage_observer_settings';
const OBSERVER_SETTINGS = {
  hourlyRateTwd: 600,
  minutesPerFiveHourPercent: 3,
  minutesPerWeeklyPercent: 5
};

function formatResetTime(ms, options = {}) {
  if (!ms) return '--';
  const date = new Date(ms);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay && !options.forceDate) {
    return new Intl.DateTimeFormat('zh-TW', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }).format(date);
  }
  const datePart = new Intl.DateTimeFormat('zh-TW', { month: 'numeric', day: 'numeric' }).format(date);
  const timePart = new Intl.DateTimeFormat('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false }).format(date);
  return `${datePart} ${timePart}`;
}

function formatClock(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '--:--:--';
  return new Intl.DateTimeFormat('zh-TW', {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).format(date);
}

function formatAge(ms) {
  if (!Number.isFinite(ms)) return '未知';
  const minutes = Math.max(0, Math.round(ms / 60_000));
  if (minutes < 1) return '剛剛';
  if (minutes < 60) return `${minutes} 分鐘前`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} 小時 ${rest} 分前` : `${hours} 小時前`;
}

function toneFor(percent) {
  if (percent <= 15) return 'danger';
  if (percent <= 35) return 'warn';
  return 'good';
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function loadJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) ?? fallback;
  } catch {
    localStorage.removeItem(key);
    return fallback;
  }
}

function saveJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Keep the widget usable even if local storage is unavailable.
  }
}

function loadEvents() {
  const events = loadJson(EVENTS_KEY, []);
  if (!Array.isArray(events)) return [];
  return events
    .filter((event) => {
      return (
        event &&
        Number.isFinite(new Date(event.timestamp).getTime()) &&
        ['5h', 'weekly'].includes(event.windowType) &&
        Number.isFinite(Number(event.beforePercent)) &&
        Number.isFinite(Number(event.afterPercent)) &&
        Number.isFinite(Number(event.consumedPercent))
      );
    })
    .map((event) => ({
      timestamp: event.timestamp,
      windowType: event.windowType,
      beforePercent: Number(event.beforePercent),
      afterPercent: Number(event.afterPercent),
      consumedPercent: Number(event.consumedPercent)
    }));
}

function loadSettings() {
  const stored = loadJson(SETTINGS_KEY, {});
  const settings = stored && typeof stored === 'object' ? stored : {};
  return {
    lastPercents: settings.lastPercents && typeof settings.lastPercents === 'object' ? settings.lastPercents : {}
  };
}

function saveSettings(settings) {
  saveJson(SETTINGS_KEY, settings);
}

function windowTypeFor(label) {
  if (String(label).includes('5')) return '5h';
  return 'weekly';
}

function minutesForEvent(event) {
  const minutesPerPercent =
    event.windowType === '5h'
      ? OBSERVER_SETTINGS.minutesPerFiveHourPercent
      : OBSERVER_SETTINGS.minutesPerWeeklyPercent;
  return event.consumedPercent * minutesPerPercent;
}

function moneyForMinutes(minutes) {
  return Math.round((minutes / 60) * OBSERVER_SETTINGS.hourlyRateTwd);
}

function isToday(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  return date.toDateString() === now.toDateString();
}

// The savings estimate is tied to Codex's known 5hr/weekly window economics.
// Claude's plan windows/pricing differ, so this tracker intentionally only
// ever consumes Codex data; it is not applied to the Claude section.
function recordUsageEvent(data) {
  if (!data?.ok || !Array.isArray(data.windows)) return loadEvents();

  const settings = loadSettings();
  const events = loadEvents();
  const now = new Date().toISOString();

  for (const item of data.windows) {
    const windowType = windowTypeFor(item.label);
    const afterPercent = Number(item.remainingPercent);
    const beforePercent = Number(settings.lastPercents[windowType]);

    if (Number.isFinite(beforePercent) && Number.isFinite(afterPercent) && afterPercent < beforePercent) {
      const consumedPercent = Number((beforePercent - afterPercent).toFixed(2));
      if (consumedPercent > 0) {
        events.push({
          timestamp: now,
          windowType,
          beforePercent,
          afterPercent,
          consumedPercent
        });
      }
    }

    if (Number.isFinite(afterPercent)) {
      settings.lastPercents[windowType] = afterPercent;
    }
  }

  const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;
  const trimmed = events.filter((event) => new Date(event.timestamp).getTime() >= ninetyDaysAgo);
  saveJson(EVENTS_KEY, trimmed);
  saveSettings(settings);
  return trimmed;
}

function calculateTodaySavedMoney(events = loadEvents()) {
  const savedMinutes = events
    .filter((event) => isToday(event.timestamp))
    .reduce((total, event) => total + minutesForEvent(event), 0);
  return moneyForMinutes(savedMinutes);
}

function renderValue(events) {
  const savedMoney = calculateTodaySavedMoney(events);
  savedMoneyEl.textContent = `NT$${new Intl.NumberFormat('zh-TW').format(savedMoney)}`;
}

function limitPairHtml(label, remainingPercent, usedPercent, resetsAt, options = {}) {
  const tone = toneFor(remainingPercent);
  return `
    <div class="limit-pair">
      <div class="limit-row ${tone}">
        <div class="label">${escapeHtml(label)}</div>
        <div class="meter" title="已用 ${Math.round(usedPercent)}%">
          <span style="width:${remainingPercent}%"></span>
        </div>
        <div class="percent">${remainingPercent}%</div>
      </div>
      <div class="reset">${formatResetTime(resetsAt, options)}</div>
    </div>
  `;
}

function renderCodexContent(data) {
  if (!data?.ok || !data.windows?.length) {
    return `<div class="empty">${escapeHtml(data?.message || '沒有可用資料')}</div>`;
  }
  return data.windows
    .map((item) => limitPairHtml(item.label, item.remainingPercent, item.usedPercent, item.resetsAt))
    .join('');
}

function renderClaudeContent(claude) {
  if (!claude?.ok || (!claude.fiveHour && !claude.sevenDay)) {
    return `<div class="empty unavailable">${escapeHtml(claude?.message || '剩餘流量無法取得')}</div>`;
  }
  const rows = [];
  if (claude.fiveHour) {
    const { remainingPercent, usedPercent, resetsAt } = claude.fiveHour;
    rows.push(limitPairHtml('5 小時', remainingPercent, usedPercent, resetsAt));
  }
  if (claude.sevenDay) {
    const { remainingPercent, usedPercent, resetsAt } = claude.sevenDay;
    rows.push(limitPairHtml('1 週', remainingPercent, usedPercent, resetsAt, { forceDate: true }));
  }
  return rows.join('');
}

function render(payload) {
  const codex = payload?.codex;
  const claude = payload?.claude;
  const events = recordUsageEvent(codex);

  codexLimitsEl.innerHTML = renderCodexContent(codex);
  claudeLimitsEl.innerHTML = renderClaudeContent(claude);

  if (codex?.ok) {
    const checkedText = formatClock(codex.checkedAt || codex.updatedAt);
    const sourceAge = formatAge(Number(codex.sourceEventAgeMs));
    updatedEl.textContent = codex.stale ? `檢查 ${checkedText} / 資料 ${sourceAge}` : `檢查 ${checkedText}`;
    updatedEl.title = [
      `Codex 來源：${codex.sourceType || 'unknown'}`,
      `Codex 路徑：${codex.sourcePath || '--'}`,
      `Codex 狀態：${codex.stale ? '尚未寫出新的 rate_limits snapshot' : '資料新鮮'}`,
      `Claude 狀態：${claude?.ok ? '資料新鮮' : (claude?.message || '無法取得')}`
    ].join('\n');
  } else {
    updatedEl.textContent = '';
  }
  renderValue(events);
}

async function refresh() {
  refreshBtn.disabled = true;
  updatedEl.textContent = '檢查中';
  try {
    const data = await withTimeout(window.usageWidget.getUsage(), 5000);
    render(data);
  } catch (error) {
    console.error('Failed to refresh usage', error);
    updatedEl.textContent = '檢查失敗';
  } finally {
    refreshBtn.disabled = false;
  }
}

function withTimeout(promise, timeoutMs) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Refresh timed out')), timeoutMs);
    })
  ]);
}

refreshBtn.addEventListener('click', refresh);
hideBtn.addEventListener('click', () => window.usageWidget.hide());
window.usageWidget.onUsage(render);
refresh();
