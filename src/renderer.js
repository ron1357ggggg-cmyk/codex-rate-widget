const limitsEl = document.getElementById('limits');
const updatedEl = document.getElementById('updated');
const refreshBtn = document.getElementById('refresh');
const hideBtn = document.getElementById('hide');
const todayUsageEl = document.getElementById('today-usage');
const savedTimeEl = document.getElementById('saved-time');
const savedMoneyEl = document.getElementById('saved-money');
const burnRateEl = document.getElementById('burn-rate');
const remainingHoursEl = document.getElementById('remaining-hours');
const riskStatusEl = document.getElementById('risk-status');
const resetObserverBtn = document.getElementById('reset-observer');
const toggleEventsBtn = document.getElementById('toggle-events');
const recentEventsEl = document.getElementById('recent-events');
const heatmapEl = document.getElementById('heatmap');

const EVENTS_KEY = 'codex_usage_observer_events';
const SETTINGS_KEY = 'codex_usage_observer_settings';
const OBSERVER_SETTINGS = {
  hourlyRateTwd: 600,
  minutesPerFiveHourPercent: 3,
  minutesPerWeeklyPercent: 5
};

let latestFiveHourPercent = null;

function formatResetTime(ms) {
  if (!ms) return '等待資料';
  const date = new Date(ms);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  return new Intl.DateTimeFormat('zh-TW', {
    month: sameDay ? undefined : 'numeric',
    day: sameDay ? undefined : 'numeric',
    hour: sameDay ? 'numeric' : undefined,
    minute: sameDay ? '2-digit' : undefined,
    hour12: true
  }).format(date);
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
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    localStorage.removeItem(key);
    return fallback;
  }
}

function saveJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage may be full or unavailable; keep the widget usable.
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
    lastPercents: settings.lastPercents && typeof settings.lastPercents === 'object' ? settings.lastPercents : {},
    observerResetAt: Number(settings.observerResetAt) || 0
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

function formatPercent(value) {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
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

    if (windowType === '5h' && Number.isFinite(afterPercent)) {
      latestFiveHourPercent = afterPercent;
    }

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

function calculateTodaySavedTime(events = loadEvents()) {
  return events.filter((event) => isToday(event.timestamp)).reduce((total, event) => total + minutesForEvent(event), 0);
}

function calculateTodaySavedMoney(events = loadEvents()) {
  return moneyForMinutes(calculateTodaySavedTime(events));
}

function getTodayUsageSummary(events = loadEvents()) {
  const todayEvents = events.filter((event) => isToday(event.timestamp));
  const fiveHour = todayEvents
    .filter((event) => event.windowType === '5h')
    .reduce((total, event) => total + event.consumedPercent, 0);
  const weekly = todayEvents
    .filter((event) => event.windowType === 'weekly')
    .reduce((total, event) => total + event.consumedPercent, 0);

  return {
    fiveHour: Number(fiveHour.toFixed(2)),
    weekly: Number(weekly.toFixed(2))
  };
}

function getHourlyBurnRate(events = loadEvents()) {
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  const consumed = events
    .filter((event) => event.windowType === '5h' && new Date(event.timestamp).getTime() >= oneHourAgo)
    .reduce((total, event) => total + event.consumedPercent, 0);
  return Number(consumed.toFixed(2));
}

function getEstimatedRemainingHours(currentFiveHourPercent, burnRate) {
  if (!Number.isFinite(currentFiveHourPercent) || !Number.isFinite(burnRate) || burnRate <= 0) return null;
  return currentFiveHourPercent / burnRate;
}

function getRecentUsageEvents(events = loadEvents()) {
  return [...events]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 5);
}

function formatDuration(minutes) {
  const rounded = Math.round(minutes);
  const hours = Math.floor(rounded / 60);
  const mins = rounded % 60;
  if (hours <= 0) return `${mins}m`;
  return `${hours}h ${mins}m`;
}

function dayKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getSevenDayHeatmapData(events = loadEvents()) {
  const days = [];
  const today = new Date();

  for (let i = 6; i >= 0; i -= 1) {
    const date = new Date(today);
    date.setHours(0, 0, 0, 0);
    date.setDate(today.getDate() - i);
    const key = dayKey(date);
    const dayEvents = events.filter((event) => dayKey(new Date(event.timestamp)) === key);
    const consumedPercent = dayEvents.reduce((total, event) => total + event.consumedPercent, 0);
    const savedMinutes = dayEvents.reduce((total, event) => total + minutesForEvent(event), 0);

    days.push({
      date: key,
      consumedPercent: Number(consumedPercent.toFixed(2)),
      savedMinutes,
      savedMoney: moneyForMinutes(savedMinutes),
      level: heatLevel(consumedPercent)
    });
  }

  return days;
}

function heatLevel(percent) {
  if (percent <= 0) return 'zero';
  if (percent <= 20) return 'low';
  if (percent <= 50) return 'mid';
  if (percent <= 80) return 'high';
  return 'max';
}

function detectLoopRisk(events = loadEvents()) {
  const settings = loadSettings();
  const now = Date.now();
  const observerResetAt = settings.observerResetAt || 0;
  const activeEvents = events.filter((event) => new Date(event.timestamp).getTime() > observerResetAt);
  const last30 = activeEvents.filter((event) => now - new Date(event.timestamp).getTime() <= 30 * 60 * 1000);
  const last15 = activeEvents.filter((event) => now - new Date(event.timestamp).getTime() <= 15 * 60 * 1000);
  const last30Consumed = last30.reduce((total, event) => total + event.consumedPercent, 0);

  if (last15.length >= 3) {
    return {
      level: 'danger',
      text: '疑似 loop',
      message: '疑似 AI loop，建議停止當前任務、重新整理 prompt、降低 context 或拆小任務'
    };
  }

  if (last30.length > 5 && last30Consumed > 20) {
    return {
      level: 'warn',
      text: '消耗偏快',
      message: '消耗偏快，建議縮小任務範圍'
    };
  }

  return {
    level: 'normal',
    text: '效率良好',
    message: '效率良好'
  };
}

function renderRecentEvents(events) {
  if (recentEventsEl.hidden) return;
  const recentEvents = getRecentUsageEvents(events);
  if (!recentEvents.length) {
    recentEventsEl.innerHTML = '<div class="event-empty">尚無紀錄</div>';
    return;
  }

  recentEventsEl.innerHTML = recentEvents
    .map((event) => {
      const time = new Intl.DateTimeFormat('zh-TW', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      }).format(new Date(event.timestamp));
      const label = event.windowType === '5h' ? '5小時' : '1週';
      return `<div class="event-row"><span>${time}</span><span>${label}</span><strong>-${formatPercent(event.consumedPercent)}%</strong></div>`;
    })
    .join('');
}

function renderObserver(events) {
  const todayUsage = getTodayUsageSummary(events);
  const savedMinutes = calculateTodaySavedTime(events);
  const savedMoney = calculateTodaySavedMoney(events);
  const burnRate = getHourlyBurnRate(events);
  const estimatedHours = getEstimatedRemainingHours(latestFiveHourPercent, burnRate);
  const risk = detectLoopRisk(events);

  todayUsageEl.textContent = `5h -${formatPercent(todayUsage.fiveHour)}% / 週 -${formatPercent(todayUsage.weekly)}%`;
  savedTimeEl.textContent = formatDuration(savedMinutes);
  savedMoneyEl.textContent = `NT$${new Intl.NumberFormat('zh-TW').format(savedMoney)}`;
  burnRateEl.textContent = `${formatPercent(burnRate)}%/hr`;
  remainingHoursEl.textContent = estimatedHours === null ? '--' : `${formatPercent(estimatedHours)} hr`;
  riskStatusEl.textContent = risk.text;
  riskStatusEl.title = risk.message;
  riskStatusEl.className = `risk-${risk.level}`;

  renderRecentEvents(events);

  heatmapEl.innerHTML = getSevenDayHeatmapData(events)
    .map((day) => {
      const title = `${day.date}\n消耗 ${day.consumedPercent}%\n節省 ${formatDuration(day.savedMinutes)}\n價值 NT$${day.savedMoney}`;
      return `<span class="heat-cell heat-${day.level}" title="${escapeHtml(title)}"></span>`;
    })
    .join('');
}

function render(data) {
  const events = recordUsageEvent(data);

  if (!data?.ok || !data.windows?.length) {
    limitsEl.innerHTML = `<div class="empty">${escapeHtml(data?.message || '尚無資料')}</div>`;
    updatedEl.textContent = '';
    renderObserver(events);
    return;
  }

  limitsEl.innerHTML = data.windows
    .map((item) => {
      const tone = toneFor(item.remainingPercent);
      return `
        <div class="limit-row ${tone}">
          <div class="label">${escapeHtml(item.label)}</div>
          <div class="meter" title="已使用 ${Math.round(item.usedPercent)}%">
            <span style="width:${item.remainingPercent}%"></span>
          </div>
          <div class="percent">${item.remainingPercent}%</div>
          <div class="reset">${formatResetTime(item.resetsAt)}</div>
        </div>
      `;
    })
    .join('');

  const updated = new Date(data.updatedAt);
  updatedEl.textContent = `更新 ${new Intl.DateTimeFormat('zh-TW', {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).format(updated)}`;
  renderObserver(events);
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
  render(await window.codexRateWidget.getRateLimits());
}

refreshBtn.addEventListener('click', refresh);
hideBtn.addEventListener('click', () => window.codexRateWidget.hide());
resetObserverBtn.addEventListener('click', () => {
  const settings = loadSettings();
  settings.observerResetAt = Date.now();
  saveSettings(settings);
  renderObserver(loadEvents());
});
toggleEventsBtn.addEventListener('click', () => {
  recentEventsEl.hidden = !recentEventsEl.hidden;
  toggleEventsBtn.setAttribute('aria-expanded', String(!recentEventsEl.hidden));
  renderRecentEvents(loadEvents());
});
window.codexRateWidget.onRateLimits(render);
refresh();
