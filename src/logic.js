import { state, ymd, parseYmd, mondayOf, addDays } from './store.js';
import { exercise } from './exercises.js';
import { PROGRESSION } from './program.js';
import { suggestNext, defaultIncrement, e1rm, weekOf, bwOn, relStrength, setScore, logKind } from './progression.js';

export const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const WD_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const workoutById = id => state.program.workouts.find(w => w.id === id);
export const doneSessions = () => state.sessions.filter(s => s.status === 'done' || s.status === 'ended');

export function round(w) {
  if (w == null) return null;
  const step = w < 25 ? 2.5 : 5;
  return Math.round(w / step) * step;
}

// ---- Program week / deload (DST-safe)
export function programWeek(date = new Date()) {
  return weekOf(state.settings.cycleStart, date, state.program.cycleWeeks || 6, state.program.deloadWeek || 6, state.settings.deloadEnabled);
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

export { e1rm };
export function incFor(exId) { const v = state.settings.increments && state.settings.increments[exId]; return v > 0 ? +v : defaultIncrement(exercise(exId)); }
/** Engine history for an exercise, newest first. */
export function engineHistory(exId) {
  return historyFor(exId).map(h => ({ date: h.session.date, start: h.session.start, deload: !!h.session.deload, badDay: !!h.session.badDay, sets: h.ex.sets }));
}
/** Suggest weight/reps for a program slot. */
export function suggest(slot, { deload = false, badDay = false } = {}) {
  return suggestNext(slot, exercise(slot.ex), engineHistory(slot.ex), { inc: incFor(slot.ex), deload, badDay });
}
/** All prior working sets for PR detection. */
export function priorSets(exId) { return historyFor(exId).flatMap(h => h.ex.sets); }
export function exStats(exId) {
  const hist = historyFor(exId).slice().reverse();
  const ex = exercise(exId); const kind = logKind(ex);
  // "top" = heaviest weight; for assisted = least assistance; for timed/reps = most seconds/reps
  const topOf = s => (kind === 'timed' || kind === 'reps' ? +s.reps || 0 : +s.weight || 0);
  const better = (a, b) => (kind === 'assisted' ? a < b : a > b);
  let bestE = 0, heaviest = null, bestSet = null;
  const pts = hist.map(h => {
    const bw = bwOn(state.bodyweight, h.session.date);
    const e = Math.max(...h.ex.sets.map(s => setScore(ex, s, bw)));
    const tops = h.ex.sets.map(topOf); const top = kind === 'assisted' ? Math.min(...tops) : Math.max(...tops);
    for (const s of h.ex.sets) { const v = setScore(ex, s, bw); if (v > bestE) { bestE = v; bestSet = s; } if (heaviest == null || better(topOf(s), heaviest)) heaviest = topOf(s); }
    return { t: new Date(h.session.start).getTime(), date: h.session.date, e1rm: e, top, bw, rel: kind === 'timed' || kind === 'reps' ? null : relStrength(e, bw), session: h.session, ex: h.ex };
  });
  return { pts, bestE, heaviest: heaviest ?? 0, bestSet, kind };
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

// ---- Supplements
export function injDueDay(dt) {
  const wd = state.settings.injectionDay, win = Math.max(1, state.settings.injectionWindowDays || 2);
  return (dt.getDay() - wd + 7) % 7 < win;
}
export const injectionOn = dateKey => state.injections.find(i => i.date === dateKey) || null;
/** Tirzepatide checklist line for a date: shown on due-window days (or the day it was logged). */
export function injLine(dateKey) {
  const dt = parseYmd(dateKey); const due = injDueDay(dt); const logged = injectionOn(dateKey);
  if (!due && !logged) return null;
  const done = !!logged || (due && injectionStatus(dt).status === 'done');
  return { due, done, logged, counts: due };
}
export function suppAdherence(dateKey) {
  const list = state.supplements;
  const taken = (state.daily[dateKey] && state.daily[dateKey].supps) || {};
  let n = list.filter(s => taken[s.id]).length, total = list.length;
  const inj = injLine(dateKey);
  if (inj && inj.counts) { total++; if (inj.done) n++; }
  if (!total) return null;
  return { n, total, pct: n / total };
}
export function suppStreak() {
  // consecutive 100% days ending today (or yesterday if today isn't complete yet)
  let n = 0; let d = new Date();
  const full = dt => { const a = suppAdherence(ymd(dt)); return a && a.n === a.total; };
  if (!full(d)) d = addDays(d, -1);
  while (full(d) && n < 3650) { n++; d = addDays(d, -1); }
  return n;
}

// ---- Tirzepatide injection (weekly; due window = injection day + following day(s))
export function injectionStatus(today = new Date()) {
  const wd = state.settings.injectionDay, win = Math.max(1, state.settings.injectionWindowDays || 2);
  const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const lastDue = addDays(t0, -((t0.getDay() - wd + 7) % 7));
  const nextDue = addDays(lastDue, 7);
  const sorted = [...state.injections].sort((a, b) => b.ts.localeCompare(a.ts));
  const last = sorted[0] || null;
  const earliestOk = ymd(addDays(lastDue, -2)); // logged up to 2 days early still counts
  const done = sorted.some(i => i.date >= earliestOk && i.date <= ymd(t0));
  const daysSinceDue = Math.round((t0 - lastDue) / 86400000);
  let status;
  if (!state.injections.length) status = 'unknown';
  else if (done) status = 'done';
  else if (daysSinceDue < win) status = 'due';
  else status = 'overdue';
  return { status, lastDue, nextDue: done ? nextDue : lastDue, last, daysSinceDue, windowEnd: addDays(lastDue, win - 1) };
}
