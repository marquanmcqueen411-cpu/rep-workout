// Exercise swap helpers: alternatives + conservative starting-weight conversion.

import { exercise, alternatives as altsByPattern, EXERCISES } from './exercises.js';
import { equipOf, defaultIncrement, roundTo, e1rm } from './progression.js';
import { historyFor, suggest, engineHistory, incFor } from './logic.js';

export function swapAlternatives(exId) {
  const same = altsByPattern(exId);
  const rest = EXERCISES.filter(e => e.id !== exId && !same.includes(e));
  return { same, rest };
}

/**
 * Suggest a starting weight when swapping to `toId`.
 * Prefer the swap's own history; otherwise convert conservatively from the
 * original lift's last top set.
 */
export function swapSuggestion(fromId, toId, slot, { deload = false, badDay = false } = {}) {
  const to = exercise(toId);
  const from = exercise(fromId);
  const hist = engineHistory(toId);
  if (hist.length) {
    const sg = suggest({ ...slot, ex: toId }, { deload, badDay });
    return { ...sg, source: 'history', note: `Using your ${to.name} history.` };
  }
  // No history — convert from the original lift.
  const fromHist = historyFor(fromId).filter(h => !h.session.deload && !h.session.badDay);
  const last = fromHist[0];
  if (!last) {
    const sg = suggest({ ...slot, ex: toId }, { deload, badDay });
    return { ...sg, source: 'fresh', note: 'No history on either lift — set your own starting weight.' };
  }
  const top = Math.max(...last.ex.sets.map(s => +s.weight || 0));
  const topReps = last.ex.sets.find(s => +s.weight === top)?.reps ?? slot.reps[0];
  const converted = convertWeight(from, to, top);
  const inc = incFor(toId) || defaultIncrement(to);
  const weight = roundTo(converted.weight, inc, 'down');
  const targets = Array(slot.sets).fill(slot.reps[0]);
  const text = `Swapped from ${from.name} (${top}×${topReps}). ${converted.note} Start ~${weight} lb — go up if it feels easy.`;
  return {
    kind: 'first', first: true, weight, targets, weights: Array(slot.sets).fill(weight),
    sets: slot.sets, text, jumpNote: '', stall: false, reduce: false, up: false,
    last: `${top}×${topReps} on ${from.name}`, inc, source: 'converted', note: converted.note,
  };
}

/** Conservative equipment/pattern conversion. Returns { weight, note }. */
export function convertWeight(from, to, fromWeight) {
  const w = +fromWeight || 0;
  const fe = equipOf(from), te = equipOf(to);
  let factor = 1;
  let note = 'Matched previous load.';

  // Per-hand DBs: from total-ish barbell → per hand ≈ 40%
  if (!from.perHand && to.perHand) {
    factor = 0.4;
    note = 'DB per hand ≈ 40% of the barbell load (conservative).';
  } else if (from.perHand && !to.perHand) {
    factor = 2.2;
    note = 'Barbell ≈ 2.2× the DB-per-hand load (conservative).';
  } else if (from.perHand && to.perHand) {
    factor = 1;
    note = 'Same per-hand load to start.';
  }

  // Machine/cable vs free weight
  if ((fe === 'barbell' || fe === 'smith') && (te === 'machine' || te === 'cable')) {
    factor *= 0.9;
    note = (note === 'Matched previous load.' ? '' : note + ' ') + 'Machines often feel ~10% lighter — started a bit under.';
  } else if ((fe === 'machine' || fe === 'cable') && (te === 'barbell' || te === 'smith')) {
    factor *= 0.85;
    note = (note === 'Matched previous load.' ? '' : note + ' ') + 'Free weight usually harder — started ~15% under.';
  } else if (fe !== te && factor === 1) {
    factor = 0.9;
    note = 'Different equipment — started ~10% under.';
  }

  // Assisted pull-up: higher assistance = easier; leave blank-ish low number
  if (to.assisted) {
    return { weight: roundTo(Math.max(w * 0.5, 40), defaultIncrement(to), 'down'), note: 'Assisted machine — pick a challenging assistance and adjust.' };
  }
  if (from.assisted && !to.assisted) {
    return { weight: 0, note: 'Coming off assisted — start bodyweight or a light load.' };
  }

  const out = Math.max(0, w * factor);
  return { weight: out, note };
}
