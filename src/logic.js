import { state, ymd, parseYmd, mondayOf, addDays } from './store.js';
import { exercise } from './exercises.js';
import { PROGRESSION } from './program.js';

export const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const WD_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const workoutById = id => state.program.workouts.find(w => w.id === id);
export const doneSessions = () => state.sessions.filter(s => s.status === 'done' || s.status === 'ended');

export function round(w) {
  if (w == null) return null;
  const step = w < 25 ? 2.5 : 5;
  return Math.round(w / step) * step;
}

// ---- Program week / deload
export function programWeek(date = new Date()) {
  const start = parseYmd(state.settings.cycleStart);
  const days = Math.floor((mondayOf(date) - mondayOf(start)) / 86400000);
  const wk = Math.floor(days / 7);
  const n = state.program.cycleWeeks || 6;
  const week = ((wk % n) + n) % n + 1;
  const cycle = Math.floor(wk / n) + 1;
  const deload = state.settings.deloadEnabled && week === (state.program.deloadWeek || 6);
  return { week, cycle, deload, of: n };
}

// ---- Rotation / schedule
export function scheduleFor(date = new Date()) { return state.settings.schedule[date.getDay()] || { type: 'rest' }; }
export function nextInRotation() {
  const ws = state.program.workouts;
  const last = doneSessions().filter(s => s.workoutId).sort((a, b) => b.start.localeCompare(a.start))[0];
  if (!last) return ws[0];
  const i = ws.findIndex(w => w.id === last.workoutId);
  return ws[(i + 1) % ws.length];
}

// ---- History & progression
export function historyFor(exId) {
  const out = [];
  for (const s of doneSessions()) {
    const e = s.exercises.find(x => x.exId === exId);
    if (e && e.sets.length) out.push({ session: s, ex: e });
  }
  return out.sort((a, b) => b.session.start.localeCompare(a.session.start));
}

export const e1rm = (w, r) => (w > 0 && r > 0 ? w * (1 + r / 30) : 0); // Epley

/** Suggest weight/reps for a program slot. */
export function suggest(slot, { deload = false } = {}) {
  const ex = exercise(slot.ex);
  const [lo, hi] = slot.reps;
  const hist = historyFor(slot.ex);
  const last = hist.find(h => !h.session.deload) || hist[0];
  const inc = ex.region === 'lower' ? PROGRESSION.lowerIncrementLb : PROGRESSION.upperIncrementLb;
  const sets = deload ? Math.min(PROGRESSION.deloadSets, slot.sets) : slot.sets;
  if (!last) {
    return { first: true, weight: null, reps: Array(sets).fill(null), sets,
      text: `First session — pick a weight you can do for ${lo}–${hi} reps with 2 left in the tank.` };
  }
  const ls = last.ex.sets;
  const lastW = Math.max(...ls.map(s => +s.weight || 0));
  const lastStr = `${fmtW(lastW)} × ${ls.map(s => s.reps).join(', ')}`;
  if (deload) {
    const w = round(lastW * PROGRESSION.deloadWeightPct);
    return { weight: w, reps: Array(sets).fill(lo), sets, last: lastStr,
      text: `Deload: ${sets} sets @ ~${Math.round(PROGRESSION.deloadWeightPct * 100)}% (${fmtW(w)}) × ${lo}. Easy, crisp reps.` };
  }
  const allTop = ls.length >= slot.sets && ls.every(s => +s.reps >= hi);
  if (allTop) {
    const w = lastW + inc;
    return { weight: w, reps: Array(sets).fill(lo), sets, last: lastStr, up: true,
      text: `Hit ${hi} on all sets → add ${inc} lb: ${fmtW(w)} × ${lo}–${hi}.` };
  }
  const reps = Array.from({ length: sets }, (_, i) => {
    const r = ls[i] ? +ls[i].reps : (ls[ls.length - 1] ? +ls[ls.length - 1].reps : lo);
    return Math.max(lo, Math.min(hi, r + 1));
  });
  return { weight: lastW, reps, sets, last: lastStr,
    text: `Same weight (${fmtW(lastW)}), aim for +1 rep per set (target ${reps.join('/')}).` };
}

export const fmtW = w => (w == null || w === '' ? '—' : `${+w % 1 ? (+w).toFixed(1) : +w} lb`);

// ---- Recovery
export function recovery(now = Date.now()) {
  const res = {}; // muscle -> {pct, hours, ts}
  const cutoff = now - 8 * 86400000;
  for (const s of doneSessions()) {
    const t = new Date(s.end || s.start).getTime();
    if (t < cutoff) continue;
    for (const e of s.exercises) {
      if (!e.sets.length) continue;
      const ex = exercise(e.exId);
      const hits = [...ex.primary.map(m => [m, ex.isolation ? 48 : 72]), ...ex.secondary.map(m => [m, 48])];
      for (const [m, recH] of hits) {
        const hours = (now - t) / 3600000;
        const pct = Math.max(0, Math.min(1, hours / recH));
        if (!res[m] || pct < res[m].pct) res[m] = { pct, hours, recH, ts: t };
      }
    }
  }
  return res;
}
export function recColor(pct) {
  if (pct == null) return '#30d158';
  if (pct >= 1) return '#30d158';
  if (pct >= 0.66) return '#ffd60a';
  if (pct >= 0.33) return '#ff8a00';
  return '#ff3b30';
}

// ---- Streak / training days
export function trainingDays() {
  const set = new Set();
  for (const s of doneSessions()) set.add(s.date);
  for (const [d, v] of Object.entries(state.daily)) if (v.cls) set.add(d);
  return set;
}
export function weekCount(monday, days = trainingDays()) {
  let n = 0;
  for (let i = 0; i < 7; i++) if (days.has(ymd(addDays(monday, i)))) n++;
  return n;
}
export function streak() {
  const days = trainingDays();
  const target = state.settings.weeklyTarget;
  const thisMon = mondayOf(new Date());
  const thisWeek = weekCount(thisMon, days);
  let n = 0;
  let mon = addDays(thisMon, -7);
  while (weekCount(mon, days) >= target) { n++; mon = addDays(mon, -7); if (n > 520) break; }
  if (thisWeek >= target) n++;
  return { weeks: n, thisWeek, target };
}
