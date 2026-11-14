// Workout summary (Hevy / JEFIT / Strong style) + per-set comparison vs last time. Pure.
import { exercise } from './exercises.js';
import { e1rm } from './progression.js';

const n1 = w => `${+(+w).toFixed(1)}`;

/** Compare a set to the same set last time. Returns { kind: 'up'|'same'|'down', label } or null. */
export function compareSet(prev, cur) {
  if (!prev || !cur || !(+cur.reps > 0) || !(+prev.reps > 0)) return null;
  const pw = +prev.weight || 0, cw = +cur.weight || 0, pr = +prev.reps, cr = +cur.reps;
  if (cw === pw && cr === pr) return { kind: 'same', label: '= last' };
  if (cw > pw && cr >= pr) return { kind: 'up', label: `+${n1(cw - pw)} lb` };
  if (cw === pw && cr > pr) return { kind: 'up', label: `+${cr - pr} rep${cr - pr > 1 ? 's' : ''}` };
  const dE = e1rm(cw, cr) - e1rm(pw, pr);
  const parts = [];
  if (cw !== pw) parts.push(`${cw > pw ? '+' : '−'}${n1(Math.abs(cw - pw))} lb`);
  if (cr !== pr) parts.push(`${cr > pr ? '+' : '−'}${Math.abs(cr - pr)} rep${Math.abs(cr - pr) > 1 ? 's' : ''}`);
  const kind = Math.abs(dE) < 0.5 ? 'same' : dE > 0 ? 'up' : 'down';
  return { kind, label: parts.join(' · ') };
}

const vol = exs => exs.reduce((n, e) => n + e.sets.reduce((m, s) => m + (+s.weight || 0) * (+s.reps || 0), 0), 0);
const bestE = sets => Math.max(0, ...sets.map(s => e1rm(+s.weight, +s.reps)));

/**
 * rec: finished session. prevOf(exId) → previous sets array for that lift (or null).
 * prevSame: previous session of the same workout id (or null).
 */
export function summarize(rec, { prevOf = () => null, prevSame = null } = {}) {
  const exs = rec.exercises || [];
  const sets = exs.reduce((n, e) => n + e.sets.length, 0);
  const volume = Math.round(vol(exs));
  const mins = rec.end ? Math.max(0, Math.round((new Date(rec.end) - new Date(rec.start)) / 60000)) : null;
  const prs = [];
  const lifts = exs.filter(e => e.sets.length).map(e => {
    const ex = exercise(e.exId);
    const top = e.sets.reduce((b, s) => (e1rm(+s.weight, +s.reps) > e1rm(+b.weight, +b.reps) ? s : b), e.sets[0]);
    const now = bestE(e.sets); const prev = prevOf(e.exId); const before = prev && prev.length ? bestE(prev) : null;
    for (const s of e.sets) if (s.pr && s.pr.length) prs.push({ name: ex.name, weight: +s.weight, reps: +s.reps, kinds: s.pr });
    return { exId: e.exId, name: ex.name, top: `${n1(top.weight)}×${top.reps}`, e1rm: Math.round(now), dE: before ? +((now - before) / before * 100).toFixed(1) : null };
  });
  const prevVol = prevSame ? Math.round(vol(prevSame.exercises || [])) : null;
  const volDeltaPct = prevVol ? +((volume - prevVol) / prevVol * 100).toFixed(0) : null;
  return { name: rec.workoutName, date: rec.date, sets, volume, mins, prs, lifts, prevVol, volDeltaPct, badDay: !!rec.badDay, deload: !!rec.deload };
}

export function summaryText(sm) {
  const L = [`💪 ${sm.name} · ${sm.date}${sm.deload ? ' (deload)' : ''}${sm.badDay ? ' (bad day)' : ''}`];
  L.push(`${sm.sets} sets · ${sm.volume.toLocaleString()} lb volume${sm.mins != null ? ` · ${sm.mins} min` : ''}${sm.volDeltaPct != null ? ` · ${sm.volDeltaPct >= 0 ? '+' : ''}${sm.volDeltaPct}% vs last ${sm.name}` : ''}`);
  for (const l of sm.lifts) L.push(`• ${l.name}: ${l.top} (e1RM ${l.e1rm}${l.dE != null ? `, ${l.dE >= 0 ? '+' : ''}${l.dE}%` : ''})`);
  if (sm.prs.length) L.push(`🏆 PRs: ${sm.prs.map(p => `${p.name} ${n1(p.weight)}×${p.reps}`).join(', ')}`);
  L.push('— Rep');
  return L.join('\n');
}
