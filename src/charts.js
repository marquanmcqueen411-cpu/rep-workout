// Tiny hand-rolled SVG line chart (no external libs).
const fmtDate = t => new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

export function lineChart(points, { goal = null, unit = '', height = 190, color = '#ff4d1a', yPad = 0.08, label = '' } = {}) {
  const W = 360, H = height, L = 40, R = 12, T = 14, B = 26;
  if (!points.length) return `<div class="chart-empty">No data yet</div>`;
  const xs = points.map(p => p.x), ys = points.map(p => p.y);
  if (goal != null) ys.push(goal);
  let x0 = Math.min(...xs), x1 = Math.max(...xs);
  if (x0 === x1) { x0 -= 86400000 * 3; x1 += 86400000 * 3; }
  let y0 = Math.min(...ys), y1 = Math.max(...ys);
  const pad = Math.max((y1 - y0) * yPad, 2); y0 -= pad; y1 += pad;
  const sx = x => L + ((x - x0) / (x1 - x0)) * (W - L - R);
  const sy = y => T + (1 - (y - y0) / (y1 - y0)) * (H - T - B);
  const ticks = 4; let grid = '';
  for (let i = 0; i <= ticks; i++) {
    const v = y0 + ((y1 - y0) * i) / ticks, y = sy(v);
    grid += `<line x1="${L}" x2="${W - R}" y1="${y}" y2="${y}" stroke="#26262c"/><text x="${L - 6}" y="${y + 4}" text-anchor="end" font-size="10" fill="#8e8e96">${Math.round(v)}</text>`;
  }
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(' ');
  const area = `${d} L${sx(points[points.length - 1].x)},${H - B} L${sx(points[0].x)},${H - B} Z`;
  const dots = points.map(p => `<circle cx="${sx(p.x)}" cy="${sy(p.y)}" r="3.5" fill="${color}" stroke="#0d0d0f" stroke-width="1.5"/>`).join('');
  const goalLine = goal != null
    ? `<line x1="${L}" x2="${W - R}" y1="${sy(goal)}" y2="${sy(goal)}" stroke="#30d158" stroke-dasharray="5 4" stroke-width="1.5"/><text x="${W - R}" y="${sy(goal) - 5}" text-anchor="end" font-size="10" fill="#30d158" font-weight="700">GOAL ${goal}${unit}</text>` : '';
  const id = 'g' + Math.random().toString(36).slice(2, 8);
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" aria-label="${label}">
    <defs><linearGradient id="${id}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".35"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>
    ${grid}${goalLine}
    <path d="${area}" fill="url(#${id})"/>
    <path d="${d}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
    ${dots}
    <text x="${L}" y="${H - 8}" font-size="10" fill="#8e8e96">${fmtDate(x0)}</text>
    <text x="${W - R}" y="${H - 8}" text-anchor="end" font-size="10" fill="#8e8e96">${fmtDate(x1)}</text>
  </svg>`;
}
