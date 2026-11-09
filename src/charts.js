// Tiny hand-rolled SVG line chart (no external libs).
const fmtDate = t => new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

/**
 * points: [{x,y}]
 * opts.overlay: optional second series [{x,y}] (e.g. 7-day MA), drawn as a dashed line
 */
export function lineChart(points, { goal = null, unit = '', height = 190, color = '#ff4d1a', yPad = 0.08, label = '', overlay = null, overlayColor = '#3aa0ff', overlayLabel = '' } = {}) {
  const W = 360, H = height, L = 40, R = 12, T = 14, B = 26;
  if (!points.length && !(overlay && overlay.length)) return `<div class="chart-empty">No data yet</div>`;
  const xs = [...points.map(p => p.x), ...(overlay || []).map(p => p.x)];
  const ys = [...points.map(p => p.y), ...(overlay || []).map(p => p.y)];
  if (goal != null) ys.push(goal);
  let x0 = Math.min(...xs), x1 = Math.max(...xs);
  if (x0 === x1) { x0 -= 86400000 * 3; x1 += 86400000 * 3; }
  let y0 = Math.min(...ys), y1 = Math.max(...ys);
  const span = y1 - y0; const pad = span ? span * Math.max(yPad, 0.15) : Math.max(Math.abs(y1) * 0.05, 0.01); y0 -= pad; y1 += pad;
  const dec = y1 - y0 < 0.5 ? 3 : y1 - y0 < 5 ? 2 : y1 - y0 < 20 ? 1 : 0;
  const sx = x => L + ((x - x0) / (x1 - x0)) * (W - L - R);
  const sy = y => T + (1 - (y - y0) / (y1 - y0)) * (H - T - B);
  const ticks = 4; let grid = '';
  for (let i = 0; i <= ticks; i++) {
    const v = y0 + ((y1 - y0) * i) / ticks, y = sy(v);
    grid += `<line x1="${L}" x2="${W - R}" y1="${y}" y2="${y}" stroke="#26262c"/><text x="${L - 6}" y="${y + 4}" text-anchor="end" font-size="10" fill="#8e8e96">${dec ? v.toFixed(dec) : Math.round(v)}</text>`;
  }
  const pathFor = (pts) => pts.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(' ');
  let main = '', area = '', dots = '';
  const id = 'g' + Math.random().toString(36).slice(2, 8);
  if (points.length) {
    const d = pathFor(points);
    area = `<path d="${d} L${sx(points[points.length - 1].x)},${H - B} L${sx(points[0].x)},${H - B} Z" fill="url(#${id})"/>`;
    main = `<path d="${d}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`;
    dots = points.map(p => `<circle cx="${sx(p.x)}" cy="${sy(p.y)}" r="3.5" fill="${color}" stroke="#0d0d0f" stroke-width="1.5"/>`).join('');
  }
  let ov = '';
  if (overlay && overlay.length) {
    const d = pathFor(overlay);
    ov = `<path d="${d}" fill="none" stroke="${overlayColor}" stroke-width="2.2" stroke-dasharray="6 4" stroke-linejoin="round" stroke-linecap="round"/>`;
    if (overlayLabel) ov += `<text x="${W - R}" y="${sy(overlay[overlay.length - 1].y) - 6}" text-anchor="end" font-size="10" fill="${overlayColor}" font-weight="700">${overlayLabel}</text>`;
  }
  const goalLine = goal != null
    ? `<line x1="${L}" x2="${W - R}" y1="${sy(goal)}" y2="${sy(goal)}" stroke="#30d158" stroke-dasharray="5 4" stroke-width="1.5"/><text x="${W - R}" y="${sy(goal) - 5}" text-anchor="end" font-size="10" fill="#30d158" font-weight="700">GOAL ${goal}${unit}</text>` : '';
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" aria-label="${label}">
    <defs><linearGradient id="${id}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".35"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>
    ${grid}${goalLine}${area}${main}${ov}${dots}
    <text x="${L}" y="${H - 8}" font-size="10" fill="#8e8e96">${fmtDate(x0)}</text>
    <text x="${W - R}" y="${H - 8}" text-anchor="end" font-size="10" fill="#8e8e96">${fmtDate(x1)}</text>
  </svg>`;
}

// Vertical bar chart vs goal line. bars: [{label, value, highlight}]
export function barChart(bars, { goal = null, unit = '', height = 170, color = '#ff4d1a', okColor = '#30d158' } = {}) {
  const W = 360, H = height, L = 30, R = 8, T = 18, B = 24;
  const max = Math.max(goal || 0, ...bars.map(b => b.value), 1) * 1.1;
  const bw = (W - L - R) / bars.length;
  const sy = v => T + (1 - v / max) * (H - T - B);
  let out = '';
  bars.forEach((b, i) => {
    const x = L + i * bw + bw * 0.18, w = bw * 0.64, y = sy(b.value), hgt = H - B - y;
    const hit = goal != null && b.value >= goal;
    out += `<rect x="${x}" y="${y}" width="${w}" height="${Math.max(hgt, b.value ? 2 : 0)}" rx="6" fill="${hit ? okColor : color}" opacity="${b.highlight ? 1 : 0.75}"/>`;
    if (b.value) out += `<text x="${x + w / 2}" y="${y - 5}" text-anchor="middle" font-size="10" font-weight="700" fill="#d6d6dc">${Math.round(b.value)}</text>`;
    out += `<text x="${x + w / 2}" y="${H - 7}" text-anchor="middle" font-size="11" font-weight="${b.highlight ? 800 : 600}" fill="${b.highlight ? '#fff' : '#8e8e96'}">${b.label}</text>`;
  });
  const g = goal != null ? `<line x1="${L}" x2="${W - R}" y1="${sy(goal)}" y2="${sy(goal)}" stroke="#30d158" stroke-dasharray="5 4" stroke-width="1.5"/><text x="${L - 4}" y="${sy(goal) + 4}" text-anchor="end" font-size="10" fill="#30d158" font-weight="700">${goal}</text>` : '';
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" aria-label="bar chart">${g}${out}</svg>`;
}
