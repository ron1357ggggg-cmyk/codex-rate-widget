const limitsEl = document.getElementById('limits');
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

function formatResetTime(ms) {
  if (!ms) return '--';
  const date = new Date(ms);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) {
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

function renderCodexSection(data) {
  if (!data?.ok || !data.windows?.length) {
    return `<div class="section-label">CODEX</div><div class="empty">${escapeHtml(data?.message || '沒有可用資料')}</div>`;
  }
  const rows = data.windows
    .map((item) => {
      const tone = toneFor(item.remainingPercent);
      return `
        <div class="limit-pair">
          <div class="limit-row ${tone}">
            <div class="label">${escapeHtml(item.label)}</div>
            <div class="meter" title="已用 ${Math.round(item.usedPercent)}%">
              <span style="width:${item.remainingPercent}%"></span>
            </div>
            <div class="percent">${item.remainingPercent}%</div>
          </div>
          <div class="reset">${formatResetTime(item.resetsAt)}</div>
        </div>
      `;
    })
    .join('');
  return `<div class="section-label">CODEX</div>${rows}`;
}

function renderClaudeSection(claude) {
  const header = `<div class="section-label claude">CLAUDE</div>`;
  if (!claude?.ok || (!claude.fiveHour && !claude.sevenDay)) {
    return header + `<div class="empty unavailable">Claude 剩餘流量無法取得</div>`;
  }
  const rows = [];
  if (claude.fiveHour) {
    const { remainingPercent, usedPercent, resetsAt } = claude.fiveHour;
    const tone = toneFor(remainingPercent);
    rows.push(`
      <div class="limit-pair">
        <div class="limit-row ${tone}">
          <div class="label">5 小時</div>
          <div class="meter" title="已用 ${Math.round(usedPercent)}%">
            <span style="width:${remainingPercent}%"></span>
          </div>
          <div class="percent">${remainingPercent}%</div>
        </div>
        <div class="reset">${formatResetTime(resetsAt)}</div>
      </div>
    `);
  }
  if (claude.sevenDay) {
    const { remainingPercent, usedPercent, resetsAt } = claude.sevenDay;
    const tone = toneFor(remainingPercent);
    rows.push(`
      <div class="limit-pair">
        <div class="limit-row ${tone}">
          <div class="label">1 週</div>
          <div class="meter" title="已用 ${Math.round(usedPercent)}%">
            <span style="width:${remainingPercent}%"></span>
          </div>
          <div class="percent">${remainingPercent}%</div>
        </div>
        <div class="reset">${formatResetTime(resetsAt)}</div>
      </div>
    `);
  }
  return header + rows.join('');
}

function render(data) {
  const events = recordUsageEvent(data);

  limitsEl.innerHTML = renderCodexSection(data) + renderClaudeSection(data?.claude);

  if (data?.ok) {
    const checkedText = formatClock(data.checkedAt || data.updatedAt);
    const sourceAge = formatAge(Number(data.sourceEventAgeMs));
    updatedEl.textContent = data.stale ? `檢查 ${checkedText} / 資料 ${sourceAge}` : `檢查 ${checkedText}`;
    updatedEl.title = [
      `來源：${data.sourceType || 'unknown'}`,
      `事件：${data.updatedAt || '--'}`,
      `路徑：${data.sourcePath || '--'}`,
      data.stale ? '狀態：Codex 尚未寫出新的 rate_limits snapshot' : '狀態：資料新鮮'
    ].join('\n');
  } else {
    updatedEl.textContent = '';
  }
  renderValue(events);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

async function refresh() {
  refreshBtn.disabled = true;
  updatedEl.textContent = '檢查中';
  try {
    const data = await withTimeout(window.codexRateWidget.getRateLimits(), 5000);
    render(data);
  } catch (error) {
    console.error('Failed to refresh rate limits', error);
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
hideBtn.addEventListener('click', () => window.codexRateWidget.hide());
window.codexRateWidget.onRateLimits(render);
refresh();
