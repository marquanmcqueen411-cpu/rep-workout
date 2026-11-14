// Coach Brooke exercise swaps: ranked 3 per primary lift. No weight carry-over.
import { exercise, alternatives, homeAlternatives, DRE_SWAPS, HOME_SWAPS } from './exercises.js';
import { suggest, engineHistory } from './logic.js';
import { PROGRAM } from './program.js';

/** Ranked Brooke swaps only (exactly 3 for primaries). Lean — no "all exercises" list. */
export function swapAlternatives(exId) {
  const ranked = alternatives(exId);
  return { ranked, same: ranked, rest: [], home: homeAlternatives(exId) };
}

/** Brooke's default rep target for a plan slot (ignores permanent swaps). */
export function programSlotReps(workoutId, idx) {
  const w = PROGRAM.workouts.find(x => x.id === workoutId);
  return w && w.exercises[idx] ? w.exercises[idx].reps : null;
}

/**
 * Rep target after a swap. Same reps as the slot, except swaps with their own target
 * (Brooke's plank swaps: dead bug 8/side, Pallof 10/side, side plank 20–30 s/side).
 * Leaving one of those goes back to the slot's plan target.
 */
export function swapTarget(fromId, toId, { current, original } = {}) {
  const to = exercise(toId), from = exercise(fromId);
  if (to.swapReps) return { reps: [...to.swapReps], note: to.swapNote || '' };
  const reps = from.swapReps ? (original || current) : (current || original);
  return { reps: reps || [6, 8], note: null };
}

/**
 * Suggestion when swapping to `toId`.
 * Same rep range / 3 sets / RIR 2 from the slot.
 * Uses the swap's OWN history only — never converts weight from the original lift.
 * No history → first-session guidance (pick weight for bottom of range at RIR 2).
 */
export function swapSuggestion(fromId, toId, slot, { deload = false, badDay = false } = {}) {
  const to = exercise(toId);
  const sets = 3;
  const reps = to.swapReps || slot.reps || [6, 8];
  const useSlot = { sets, reps, note: slot.note || '', ex: toId };
  const hist = engineHistory(toId);
  const sg = suggest(useSlot, { deload, badDay });
  if (hist.length) {
    return { ...sg, source: 'history', note: `Logging ${to.name} on its own history.` };
  }
  const lo = reps[0];
  if (to.timed || to.bodyweight) return { ...sg, source: 'fresh', note: 'Reps-only — no weight to pick.' };
  const text = `First time on ${to.name}: pick a weight for ${lo} reps at RIR 2 (bottom of the ${lo}–${reps[1]} range). This lift keeps its own log — no weight carried from the swap.`;
  return {
    ...sg,
    kind: 'first', first: true, weight: null,
    targets: Array(sets).fill(null),
    weights: Array(sets).fill(null),
    sets, text, source: 'fresh',
    note: 'Own history starts now — choose a starting weight.',
  };
}

export { DRE_SWAPS, HOME_SWAPS };
