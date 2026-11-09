// ============================================================================
//  PROGRESSIVE OVERLOAD ENGINE (pure functions — unit tested in tests/)
//
//  Base rules (Coach Dre): 3×3 at RIR 2. All sets at top of range →
//  +5 lb upper / +10 lb lower. Week 6 = deload. Bad day = 2 lifts × 2 sets.
//  On top of that:
//   • Double progression per set: sets below the top of range aim +1 rep.
//   • Equipment-aware jumps (barbell 5, DB per hand 5, stacks 10, cable 5;
//     editable per exercise). DB lower +10 = +5/hand.
//   • Effort (RIR) aware: all top sets at RIR 3+ → double jump;
//     all top sets at RIR 0 → hold; RIR 0 set below top → repeat reps.
//   • Missed bottom of range once → hold; twice in a row → −5–10 %.
//   • Stall (no weight or rep gain across 3 sessions) → ~10 % reset or swap.
//   • Deload sessions and bad-day sessions never count for progression/stalls.
//   • After a deload, return to the previous working weight.
// ============================================================================

export const RULES = { upperJump: 5, lowerJump: 10, deloadSets: 2, deloadPct: 0.9, badDayLifts: 2, badDaySets: 2, stallSessions: 3, resetPct: 0.9 };

export const e1rm = (w, r) => (w > 0 && r > 0 ? w * (1 + r / 30) : 0); // Epley

export function equipOf(ex) {
  if (ex.equip) return ex.equip;
  const t = `${ex.name} ${ex.equipment}`.toLowerCase();
  if (ex.perHand) return 'db';
  if (t.includes('smith')) return 'smith';
  if (t.includes('cable')) return 'cable';
  if (t.includes('machine') || t.includes('leg press') || t.includes('pulldown')) return 'machine';
  if (t.includes('barbell') || t.includes('trap') || t.includes('hex')) return 'barbell';
  if (t.includes('dumbbell')) return 'db';
  return 'machine';
}
export const EQUIP_LABEL = { barbell: 'Barbell', smith: 'Smith', db: 'Dumbbells (per hand)', machine: 'Machine / stack', cable: 'Cable stack' };
const DEFAULT_INC = { barbell: 5, smith: 5, db: 5, machine: 10, cable: 5 };
export function defaultIncrement(ex) { return ex.inc || DEFAULT_INC[equipOf(ex)] || 5; }

export function roundTo(w, inc, mode = 'nearest') {
  if (w == null || !inc) return w;
  const f = mode === 'down' ? Math.floor : mode === 'up' ? Math.ceil : Math.round;
  return +(f(w / inc - 1e-9 * (mode === 'up' ? 1 : 0)) * inc).toFixed(2);
}
const fmt = w => `${+(+w).toFixed(1)}`;
const joinReps = sets => sets.map(s => s.reps).join(',');

/** Weight jump for "all sets at top". mult = 2 for an easy (RIR 3+) session. */
export function jumpFor(ex, inc, mult = 1) {
  const eq = equipOf(ex); const lower = ex.region === 'lower';
  const rule = (lower ? RULES.lowerJump : RULES.upperJump) * mult;
  if (eq === 'db' && ex.perHand) {
    const perHand = Math.max(inc, roundTo(rule / 2, inc, 'nearest'));
    const note = perHand * 2 === rule ? `+${perHand} lb/hand = +${rule} total` : `+${perHand} lb/hand (next DB up)`;
    return { jump: perHand, note };
  }
  const jump = Math.max(inc, roundTo(rule, inc, 'up'));
  const note = jump === rule ? `+${jump} lb` : `+${jump} lb (+${rule} rule → next ${eq === 'barbell' || eq === 'smith' ? 'plate' : 'stack'} step)`;
  return { jump, note };
}

const workingSets = (h, n) => h.sets.slice(0, n);
const topW = sets => Math.max(0, ...sets.map(s => +s.weight || 0));
const total = sets => sets.reduce((a, s) => a + (+s.reps || 0), 0);
const hasRir = s => s.rir !== null && s.rir !== undefined && s.rir !== '';

/**
 * @param slot   { sets, reps:[lo,hi] }
 * @param ex     exercise meta (region, perHand, equip…)
 * @param history newest-first [{ date, deload, badDay, sets:[{weight,reps,rir}] }]
 * @param opts   { inc, deload, badDay }
 */
export function suggestNext(slot, ex, history = [], opts = {}) {
  const [lo, hi] = slot.reps; const N = slot.sets;
  const inc = opts.inc || defaultIncrement(ex);
  const assisted = !!ex.assisted;
  const nSets = opts.deload ? Math.min(RULES.deloadSets, N) : opts.badDay ? Math.min(RULES.badDaySets, N) : N;
  const out = (o) => {
    const targets = (o.targets || Array(N).fill(o.rep ?? null)).slice(0, nSets);
    const weights = Array(nSets).fill(o.weight ?? null);
    let text = o.text;
    if (opts.badDay && !opts.deload && !o.first) text += ' Bad day: 2 sets, won’t count toward progression.';
    return { kind: o.kind, first: !!o.first, weight: o.weight ?? null, targets, weights, sets: nSets, text, jumpNote: o.jumpNote || '', stall: o.kind === 'stall', reduce: o.kind === 'reduce', up: o.kind === 'up', last: o.last || null, inc };
  };

  const H = history.filter(h => !h.deload && !h.badDay && h.sets && h.sets.length);
  const any = history.filter(h => h.sets && h.sets.length);
  if (!any.length) {
    return out({ kind: 'first', first: true, weight: null, targets: Array(N).fill(null),
      text: `First time: enter your starting weight — pick a weight you can do for ${lo}–${hi} reps with ~2 reps left.` });
  }
  const base = H[0] || any[0];
  const ls = workingSets(base, N); const W = topW(ls);
  const lastStr = `${fmt(W)} × ${joinReps(ls)}`;
  const backFromDeload = !opts.deload && history[0] && history[0].deload && H[0];
  const pre = backFromDeload ? `Back from deload → return to ${fmt(W)}. ` : '';

  if (opts.deload) {
    const w = assisted ? roundTo(W / RULES.deloadPct, inc, 'up') : Math.min(W, roundTo(W * RULES.deloadPct, inc));
    return out({ kind: 'deload', weight: w, targets: Array(N).fill(lo), last: lastStr,
      text: `Deload week: ${nSets} × ${lo} at ~90% (${fmt(w)}). Smooth, easy reps.` });
  }
  if (!H.length) {
    return out({ kind: 'hold', weight: W, targets: ls.map(s => Math.max(lo, Math.min(hi, +s.reps))), last: lastStr,
      text: `Last time was a bad day/deload at ${fmt(W)} → repeat ${fmt(W)} and aim ${lo}–${hi}.` });
  }
  const down = pct => { let w = assisted ? roundTo(W / pct, inc, 'up') : roundTo(W * pct, inc, 'down'); if (!assisted && w >= W) w = Math.max(0, W - inc); return w; };

  // 1) Missed the bottom of the range two sessions in a row → reduce 5–10 %
  const missed = h => workingSets(h, N).some(s => +s.reps < lo);
  if (H.length >= 2 && missed(H[0]) && missed(H[1])) {
    const short = workingSets(H[0], N).reduce((a, s) => a + Math.max(0, lo - s.reps), 0) / Math.max(1, workingSets(H[0], N).length);
    const pct = short >= 2 ? 0.9 : 0.95; const w = down(pct);
    return out({ kind: 'reduce', weight: w, targets: Array(N).fill(lo), last: lastStr,
      text: `${pre}Under ${lo} reps two sessions in a row → drop to ${fmt(w)} (−${Math.round((1 - pct) * 100)}%) and rebuild to ${hi}.` });
  }
  // 2) Stall: same weight 3 sessions, no rep gain
  const S = RULES.stallSessions;
  if (H.length >= S) {
    const win = H.slice(0, S); const w0 = topW(workingSets(win[S - 1], N));
    const sameW = win.every(h => topW(workingSets(h, N)) === w0);
    const firstTotal = total(workingSets(win[S - 1], N));
    const noGain = win.slice(0, S - 1).every(h => total(workingSets(h, N)) <= firstTotal);
    const allTopNow = ls.length >= N && ls.every(s => +s.reps >= hi);
    if (sameW && noGain && !allTopNow) {
      const w = down(RULES.resetPct);
      return out({ kind: 'stall', weight: w, targets: Array(N).fill(hi > lo + 1 ? lo + 1 : lo), last: lastStr,
        text: `${pre}No progress in ${S} sessions at ${fmt(W)} (${joinReps(ls)}) → reset ~10% to ${fmt(w)} and build back up, or swap the variation.` });
    }
  }
  // 3) All sets at top of range → add weight (RIR-aware)
  const allTop = ls.length >= N && ls.every(s => +s.reps >= hi);
  const rirs = ls.filter(hasRir).map(s => +s.rir);
  const allRirLogged = rirs.length === ls.length && rirs.length > 0;
  if (allTop) {
    if (allRirLogged && rirs.every(r => r === 0)) {
      return out({ kind: 'hold', weight: W, targets: Array(N).fill(hi), last: lastStr,
        text: `${pre}Hit ${joinReps(ls)} at ${fmt(W)} but at failure (RIR 0) → hold ${fmt(W)} and own it at RIR 2.` });
    }
    const easy = allRirLogged && rirs.every(r => r >= 3);
    const { jump, note } = jumpFor(ex, inc, easy ? 2 : 1);
    const w = assisted ? Math.max(0, W - jump) : W + jump;
    return out({ kind: 'up', weight: w, targets: Array(N).fill(lo), last: lastStr, jumpNote: note,
      text: `${pre}Hit ${joinReps(ls)} at ${fmt(W)} last time → ${fmt(w)} today (${note}${easy ? ', RIR 3+ felt easy → bigger jump' : ''}).` });
  }
  // 4) Missed bottom once → hold, aim for bottom on every set
  if (missed(H[0])) {
    const t = ls.map(s => Math.max(lo, Math.min(hi, +s.reps)));
    while (t.length < N) t.push(lo);
    return out({ kind: 'hold', weight: W, targets: t, last: lastStr,
      text: `${pre}Got ${joinReps(ls)} at ${fmt(W)} (below ${lo}) → hold ${fmt(W)}, aim ${t.join(',')}.` });
  }
  // 5) Double progression: +1 rep on each set below top (RIR 0 sets repeat)
  const t = ls.map(s => (+s.reps >= hi ? hi : hasRir(s) && +s.rir === 0 ? +s.reps : Math.min(hi, +s.reps + 1)));
  while (t.length < N) t.push(t[t.length - 1] ?? lo);
  const held = ls.some(s => +s.reps < hi && hasRir(s) && +s.rir === 0);
  return out({ kind: 'reps', weight: W, targets: t, last: lastStr,
    text: `${pre}Hit ${joinReps(ls)} at ${fmt(W)} → stay at ${fmt(W)}, aim ${t.join(',')}${held ? ' (repeat reps on sets taken to failure)' : ''}.` });
}

/** Warm-up ramp for the first lift (not working sets). */
export function warmups(ex, work, inc = defaultIncrement(ex)) {
  if (!(work > 0)) return [];
  const eq = equipOf(ex); const out = [];
  const bar = eq === 'barbell' ? 45 : eq === 'smith' ? 15 : 0;
  if (bar && work > bar * 1.5) out.push({ w: bar, reps: 10, label: 'bar' });
  for (const [p, r] of [[0.5, 8], [0.7, 5], [0.85, 3]]) {
    let w = roundTo(work * p, inc, 'nearest');
    if (bar) w = Math.max(bar, w);
    if (w <= 0 || w >= work) continue;
    if (out.length && out[out.length - 1].w >= w) continue;
    out.push({ w, reps: r, label: `${Math.round(p * 100)}%` });
  }
  return out;
}

/** PRs for a new set vs all prior sets of the same exercise. */
export function detectPRs(prior, set) {
  const w = +set.weight, r = +set.reps;
  const valid = prior.filter(s => +s.reps > 0);
  if (!valid.length || !(r > 0)) return [];
  const out = [];
  if (w > Math.max(...valid.map(s => +s.weight || 0))) out.push('weight');
  const atOrAbove = valid.filter(s => +s.weight >= w);
  if (atOrAbove.length && r > Math.max(...atOrAbove.map(s => +s.reps))) out.push('reps');
  const best = Math.max(...valid.map(s => e1rm(+s.weight, +s.reps)));
  if (e1rm(w, r) > best + 0.05) out.push('e1rm');
  return out;
}

/** Relative strength = best e1RM ÷ bodyweight (nearest weigh-in on/before date). */
export function bwOn(bodyweight, date) {
  const s = [...bodyweight].sort((a, b) => a.date.localeCompare(b.date));
  let v = s.length ? s[0].lb : null;
  for (const b of s) if (b.date <= date) v = b.lb;
  return v;
}
export function relStrength(e, bw) { return e > 0 && bw > 0 ? e / bw : null; }

// ---- Dates (DST-safe week math)
export function dayIndex(d) { return Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000); }
export function weekOf(cycleStartYmd, date, cycleWeeks = 6, deloadWeek = 6, deloadEnabled = true) {
  const [y, m, dd] = cycleStartYmd.split('-').map(Number);
  const start = new Date(y, m - 1, dd);
  const mon = d => dayIndex(d) - ((d.getDay() + 6) % 7);
  const wk = Math.floor((mon(date) - mon(start)) / 7);
  const week = ((wk % cycleWeeks) + cycleWeeks) % cycleWeeks + 1;
  return { week, cycle: Math.floor(wk / cycleWeeks) + 1, deload: !!deloadEnabled && week === deloadWeek, of: cycleWeeks };
}
