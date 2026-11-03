#!/usr/bin/env node
// Claude Code status line 腳本：把 stdin JSON 的 rate_limits 存成本機快照供 Widget 讀取，
// 並輸出一行狀態文字。只寫入額度數字與時間，不讀取也不寫入任何 token。
const fs = require('fs');
const os = require('os');
const path = require('path');

const snapshotPath = process.env.CLAUDE_RATE_LIMIT_SNAPSHOT
  || path.join(os.homedir(), '.claude', 'rate-limit-snapshot.json');

function pickWindow(window) {
  if (!window || typeof window.used_percentage !== 'number') return null;
  return { used_percentage: window.used_percentage, resets_at: window.resets_at };
}

function saveSnapshot(fiveHour, sevenDay) {
  const tempPath = `${snapshotPath}.${process.pid}.tmp`;
  try {
    fs.writeFileSync(tempPath, JSON.stringify({
      updatedAt: new Date().toISOString(),
      five_hour: fiveHour,
      seven_day: sevenDay
    }));
    // 用 rename 整檔替換，Widget 不會讀到寫一半的內容。
    fs.renameSync(tempPath, snapshotPath);
  } catch {
    // 快照失敗不能影響 status line；下一次更新會再寫。
    try { fs.unlinkSync(tempPath); } catch {}
  }
}

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', () => {
  let data = {};
  try { data = JSON.parse(input); } catch {}

  const fiveHour = pickWindow(data.rate_limits && data.rate_limits.five_hour);
  const sevenDay = pickWindow(data.rate_limits && data.rate_limits.seven_day);
  // 工作階段的第一個 API 回應前沒有 rate_limits，此時保留上一份快照。
  if (fiveHour || sevenDay) saveSnapshot(fiveHour, sevenDay);

  const parts = [];
  if (data.model && data.model.display_name) parts.push(data.model.display_name);
  if (fiveHour) parts.push(`5h ${Math.round(fiveHour.used_percentage)}%`);
  if (sevenDay) parts.push(`7d ${Math.round(sevenDay.used_percentage)}%`);
  process.stdout.write(parts.join(' | '));
});
