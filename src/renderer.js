const limitsEl = document.getElementById('limits');
const updatedEl = document.getElementById('updated');
const refreshBtn = document.getElementById('refresh');
const hideBtn = document.getElementById('hide');

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

function render(data) {
  if (!data?.ok || !data.windows?.length) {
    limitsEl.innerHTML = `<div class="empty">${escapeHtml(data?.message || '尚無資料')}</div>`;
    updatedEl.textContent = '';
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
window.codexRateWidget.onRateLimits(render);
refresh();
