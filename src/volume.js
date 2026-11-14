// Weekly working sets per muscle (Hevy / JEFIT / Fitbod style). Pure.
// Primary muscle = 1 set, secondary = 0.5 set. "Planned" = one full pass of the program.
import { exercise, MUSCLES } from './exercises.js';

function add(map, exId, n) {
  const ex = exercise(exId); if (!ex) return;
  for (const m of ex.primary || []) map[m] = (map[m] || 0) + n;
  for (const m of ex.secondary || []) map[m] = (map[m] || 0) + n * 0.5;
}

/** sessions: done sessions; from/to: 'YYYY-MM-DD' inclusive. */
export function setsPerMuscle(sessions, from, to) {
  const out = {};
  for (const s of sessions) {
    if (s.date < from || s.date > to) continue;
    for (const e of s.exercises || []) add(out, e.exId, (e.sets || []).length);
  }
  return out;
}

export function plannedPerMuscle(program) {
  const out = {};
  for (const w of program.workouts || []) for (const x of w.exercises || []) add(out, x.ex, +x.sets || 0);
  return out;
}

/** Rows for display: muscles the plan trains (or that were trained), sorted by planned desc. */
export function volumeRows(done, planned, last = {}) {
  const ids = Object.keys(MUSCLES).filter(m => (planned[m] || 0) > 0 || (done[m] || 0) > 0);
  return ids.map(m => ({ m, name: MUSCLES[m], done: +(done[m] || 0).toFixed(1), planned: +(planned[m] || 0).toFixed(1), last: +(last[m] || 0).toFixed(1) }))
    .sort((a, b) => b.planned - a.planned || b.done - a.done);
}
