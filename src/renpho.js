// Tolerant Renpho (or any smart-scale) CSV parser. Pure — unit tested in tests/renpho.test.mjs.
// Auto-detects delimiter, date/time/weight/body-fat/muscle columns by header keywords,
// kg vs lb (header, value suffix, or magnitude), and common date formats. One row per day
// (earliest reading = morning weigh-in).

export const KG_TO_LB = 2.2046226218;

export function parseCSV(text) {
  text = String(text || '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const first = text.split('\n').find(l => l.trim()) || '';
  const counts = [',', ';', '\t'].map(d => [d, first.split(d).length]);
  const delim = counts.sort((a, b) => b[1] - a[1])[0][0];
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; continue; }
    if (c === '"') q = true;
    else if (c === delim) { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return { delim, rows: rows.filter(r => r.some(c => c.trim() !== '')) };
}

const norm = h => String(h).toLowerCase().replace(/\s+/g, ' ').trim();
const unitOf = h => (/\bkg\b|\(kg\)|kgs/.test(norm(h)) ? 'kg' : /\blbs?\b|\(lbs?\)|pounds?/.test(norm(h)) ? 'lb' : null);

export function detectColumns(header) {
  const H = header.map(norm); const find = (ok, bad = /$^/) => H.findIndex(h => ok.test(h) && !bad.test(h));
  const date = find(/date|time|measured|recorded|timestamp|日期|时间/, /^time$|^time\s*\(|update/);
  let time = H.findIndex((h, i) => i !== date && /^time\b|^time\s*\(/.test(h));
  if (time < 0 && date >= 0 && /^date$/.test(H[date])) time = -1;
  const weight = find(/weight|体重|^wt\b|body mass\b/, /lean|muscle|bone|water|fat|free|skeletal|protein|ideal|target|goal|change|bmr|visceral/);
  const bf = find(/body ?fat|fat ?%|fat ?\(%\)|^fat$|体脂/, /visceral|subcut|free|mass|weight|kg|lb/);
  let muscle = find(/muscle mass|skeletal muscle(?! ?%)|^muscle\b|肌肉/, /%|rate|percent/);
  if (muscle < 0) muscle = find(/muscle/, /%|rate|percent/);
  return { date, time, weight, bf, muscle, weightUnit: weight >= 0 ? unitOf(header[weight]) : null, muscleUnit: muscle >= 0 ? unitOf(header[muscle]) : null };
}

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
const pad = n => String(n).padStart(2, '0');
const ymdOf = (y, m, d) => (y >= 1990 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31 ? `${y}-${pad(m)}-${pad(d)}` : null);
function parseTime(s) {
  const m = String(s || '').match(/(\d{1,2}):(\d{2})(?::\d{2})?\s*(am|pm)?/i);
  if (!m) return null;
  let h = +m[1]; const ap = (m[3] || '').toLowerCase();
  if (ap === 'pm' && h < 12) h += 12; if (ap === 'am' && h === 12) h = 0;
  return h * 60 + +m[2];
}
/** order: 'mdy' | 'dmy' for ambiguous slash dates. Returns { date, minutes } or null. */
export function parseDate(s, order = 'mdy') {
  s = String(s || '').trim(); if (!s) return null;
  let m;
  const mins = parseTime(s.replace(/^\S+/, '').trim() || '') ?? parseTime(s.split(/[ T]/).slice(1).join(' '));
  if ((m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/))) return wrap(ymdOf(+m[1], +m[2], +m[3]), mins);
  if ((m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/))) {
    let y = +m[3]; if (y < 100) y += 2000;
    const a = +m[1], b = +m[2];
    const [mo, d] = a > 12 ? [b, a] : b > 12 ? [a, b] : order === 'dmy' ? [b, a] : [a, b];
    return wrap(ymdOf(y, mo, d), mins);
  }
  if ((m = s.match(/^([A-Za-z]{3,9})\.? (\d{1,2}),? (\d{4})/))) return wrap(ymdOf(+m[3], MONTHS[m[1].toLowerCase().slice(0, 4)] || MONTHS[m[1].toLowerCase().slice(0, 3)], +m[2]), mins);
  if ((m = s.match(/^(\d{1,2}) ([A-Za-z]{3,9})\.?,? (\d{4})/))) return wrap(ymdOf(+m[3], MONTHS[m[2].toLowerCase().slice(0, 3)], +m[1]), mins);
  if ((m = s.match(/^(\d{4})年(\d{1,2})月(\d{1,2})日/))) return wrap(ymdOf(+m[1], +m[2], +m[3]), mins);
  return null;
}
const wrap = (date, minutes) => (date ? { date, minutes: minutes ?? null } : null);
const num = v => { const m = String(v ?? '').replace(',', '.').match(/-?\d+(\.\d+)?/); return m ? parseFloat(m[0]) : null; };
const valUnit = v => (/kg/i.test(String(v)) ? 'kg' : /lb/i.test(String(v)) ? 'lb' : null);

/** Parse a scale export. opts.unit forces 'kg'|'lb'. */
export function parseRenpho(text, opts = {}) {
  const { rows, delim } = parseCSV(text);
  if (rows.length < 2) return { ok: false, error: 'No data rows found in this file.' };
  // header = first row containing a date-ish and weight-ish column
  let hi = rows.findIndex(r => { const c = detectColumns(r); return c.date >= 0 && c.weight >= 0; });
  if (hi < 0) return { ok: false, error: 'Couldn’t find date and weight columns. Expected headers like "Date"/"Time" and "Weight".' };
  const header = rows[hi]; const cols = detectColumns(header); const data = rows.slice(hi + 1);
  // ambiguous slash dates: decide order from the whole column
  let order = 'mdy';
  for (const r of data) { const m = String(r[cols.date] || '').trim().match(/^(\d{1,2})[-/.](\d{1,2})[-/.]\d{2,4}/); if (m) { if (+m[1] > 12) { order = 'dmy'; break; } if (+m[2] > 12) { order = 'mdy'; break; } } }
  // unit
  let unit = opts.unit || cols.weightUnit;
  let unitSource = opts.unit ? 'chosen' : cols.weightUnit ? 'header' : null;
  if (!unit) { const sfx = data.map(r => valUnit(r[cols.weight])).find(Boolean); if (sfx) { unit = sfx; unitSource = 'values'; } }
  const ws = data.map(r => num(r[cols.weight])).filter(v => v > 0).sort((a, b) => a - b);
  if (!unit) { const med = ws[Math.floor(ws.length / 2)] || 0; unit = med && med < 150 ? 'kg' : 'lb'; unitSource = 'guessed from values'; }
  const toLb = v => (v == null ? null : +(unit === 'kg' ? v * KG_TO_LB : v).toFixed(1));
  const mUnit = cols.muscleUnit || unit;
  const byDay = new Map(); let skipped = 0;
  for (const r of data) {
    const d = parseDate(r[cols.date], order);
    const w = num(r[cols.weight]);
    if (!d || !(w > 0)) { skipped++; continue; }
    const minutes = cols.time >= 0 ? parseTime(r[cols.time]) : d.minutes;
    const lb = toLb(w);
    if (lb < 70 || lb > 700) { skipped++; continue; }
    const row = { date: d.date, minutes, lb };
    const bf = cols.bf >= 0 ? num(r[cols.bf]) : null; if (bf > 2 && bf < 75) row.bf = +bf.toFixed(1);
    const mm = cols.muscle >= 0 ? num(r[cols.muscle]) : null;
    if (mm > 0) { const mlb = +(mUnit === 'kg' ? mm * KG_TO_LB : mm).toFixed(1); if (mlb < lb) row.muscleLb = mlb; }
    const prev = byDay.get(d.date);
    if (!prev || (minutes ?? 9999) < (prev.minutes ?? 9999)) byDay.set(d.date, row);
  }
  const out = [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date));
  if (!out.length) return { ok: false, error: 'No readable rows (check the date and weight columns).' };
  const dupes = data.length - skipped - out.length;
  return { ok: true, rows: out.map(({ minutes, ...r }) => r), unit, unitSource, delim, order, skipped, dupes, total: data.length,
    columns: { date: header[cols.date], weight: header[cols.weight], bodyFat: cols.bf >= 0 ? header[cols.bf] : null, muscle: cols.muscle >= 0 ? header[cols.muscle] : null },
    from: out[0].date, to: out[out.length - 1].date };
}

/** Merge imported rows into bodyweight entries. mode: 'keep' (existing entries win) | 'overwrite'. */
export function mergeBodyweight(existing, rows, mode = 'keep', { bodyComp = true } = {}) {
  const map = new Map(existing.map(b => [b.date, { ...b }]));
  let added = 0, updated = 0, kept = 0;
  for (const r of rows) {
    const entry = { date: r.date, lb: r.lb, source: 'renpho' };
    if (bodyComp && r.bf != null) entry.bf = r.bf;
    if (bodyComp && r.muscleLb != null) entry.muscleLb = r.muscleLb;
    const cur = map.get(r.date);
    if (!cur) { map.set(r.date, entry); added++; }
    else if (mode === 'overwrite') { map.set(r.date, entry); updated++; }
    else { kept++; if (bodyComp && cur.bf == null && entry.bf != null) { cur.bf = entry.bf; if (entry.muscleLb != null) cur.muscleLb = entry.muscleLb; } }
  }
  return { list: [...map.values()].sort((a, b) => a.date.localeCompare(b.date)), added, updated, kept };
}

/** Lean mass = weight × (1 − body fat %). */
export const leanMass = b => (b && b.bf != null ? +(b.lb * (1 - b.bf / 100)).toFixed(1) : null);
