// Deload triggers (Coach Brooke, final v2). Pure — unit tested.
// Planned at week 6, OR earlier when:
//   • a day's FIRST lift drops two sessions in a row (best set score: e1RM / seconds / reps),
//   • sleep tanks (< 6 h on 2 of the last 3 logged nights, or < 5 h last night),
//   • he flags dizziness (in the last 3 days).
// Deload = 2 sets each, same weights, RIR 3. An early deload lasts 7 days, then a new cycle starts.
import { exercise } from './exercises.js';
import { setScore, bwOn } from './progression.js';

const DAY = 86400000;
const pad = n => String(n).padStart(2, '0');
const ymdOf = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const add = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
export const EARLY_DELOAD_DAYS = 7;

/** Is an early deload active on `date`? */
export function earlyDeloadOn(early, date = new Date()) {
  if (!early || !early.from) return false;
  const k = ymdOf(date);
  return k >= early.from && k <= ymdOf(add(parse(early.from), EARLY_DELOAD_DAYS - 1));
}

/** First-lift drops: per workout, best score fell in each of the last 2 sessions (since the last deload). */
export function firstLiftDrops(st) {
  const out = [];
  const done = (st.sessions || []).filter(s => s.status === 'done' || s.status === 'ended').sort((a, b) => (b.start || '').localeCompare(a.start || ''));
  const lastDeload = done.find(s => s.deload);
  const since = lastDeload ? lastDeload.start : '';
  for (const w of st.program.workouts || []) {
    const first = w.exercises && w.exercises[0]; if (!first) continue;
    const ex = exercise(first.ex);
    const pts = [];
    for (const s of done) {
      if (s.start <= since) break;
      if (s.workoutId !== w.id || s.deload || s.badDay) continue;
      const e = (s.exercises || []).find(x => x.exId === first.ex);
      if (!e || !e.sets || !e.sets.length) continue;
      const bw = bwOn(st.bodyweight || [], s.date) || 250;
      pts.push(Math.max(...e.sets.map(x => setScore(ex, x, bw))));
      if (pts.length === 3) break;
    }
    if (pts.length === 3 && pts[0] < pts[1] && pts[1] < pts[2]) out.push({ workout: w.name, ex: first.ex, name: ex.name });
  }
  return out;
}

/** Reasons to start a deload now ([] = none). Skips when a deload is already on. */
export function deloadTriggers(st, now = new Date(), { plannedDeload = false } = {}) {
  if (plannedDeload || earlyDeloadOn(st.settings && st.settings.earlyDeload, now)) return [];
  const reasons = [];
  for (const d of firstLiftDrops(st)) reasons.push({ key: `drop:${d.ex}`, text: `${d.name} (first lift of ${d.workout}) dropped 2 sessions in a row` });
  const daily = st.daily || {};
  const days = [0, 1, 2].map(i => ymdOf(add(now, -i)));
  const sleeps = days.map(k => (daily[k] && daily[k].sleep != null && daily[k].sleep !== '' ? +daily[k].sleep : null));
  const logged = sleeps.filter(v => v != null);
  if ((sleeps[0] != null && sleeps[0] < 5) || logged.filter(v => v < 6).length >= 2) reasons.push({ key: 'sleep', text: `Sleep has tanked (${logged.map(v => v + ' h').join(', ')})` });
  const cutoff = now.getTime() - 3 * DAY;
  const dizzy = days.some(k => daily[k] && daily[k].dizzy) || (st.dizzyEvents || []).some(e => new Date(e.ts).getTime() >= cutoff);
  if (dizzy) reasons.push({ key: 'dizzy', text: 'Dizziness flagged in the last 3 days' });
  return reasons;
}

/** Start an early deload today. Returns the new settings.earlyDeload. */
export function startEarlyDeload(settings, reasons, now = new Date()) {
  settings.earlyDeload = { from: ymdOf(now), reason: reasons.map(r => r.text).join('; ') || 'Started manually', at: now.toISOString() };
  return settings.earlyDeload;
}

/** When an early deload has finished: log it and restart the cycle (week 1 = the Monday of the week after it). */
export function settleEarlyDeload(settings, now = new Date()) {
  const e = settings.earlyDeload;
  if (!e || earlyDeloadOn(e, now) || ymdOf(now) < e.from) return false;
  const end = add(parse(e.from), EARLY_DELOAD_DAYS);
  const mon = add(end, -((end.getDay() + 6) % 7));
  settings.cycleStart = ymdOf(mon);
  settings.deloadLog = [...(settings.deloadLog || []), { ...e, to: ymdOf(add(end, -1)) }];
  settings.earlyDeload = null;
  return true;
}
