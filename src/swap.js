// Coach Dre exercise swaps: ranked 3 per primary lift. No weight carry-over.
import { exercise, alternatives, DRE_SWAPS } from './exercises.js';
import { suggest, engineHistory } from './logic.js';

/** Ranked Dre swaps only (exactly 3 for primaries). Lean — no "all exercises" list. */
export function swapAlternatives(exId) {
  const ranked = alternatives(exId);
  return { ranked, same: ranked, rest: [] };
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
  const reps = slot.reps || [6, 8];
  const useSlot = { sets, reps, note: slot.note || '', ex: toId };
  const hist = engineHistory(toId);
  const sg = suggest(useSlot, { deload, badDay });
  if (hist.length) {
    return { ...sg, source: 'history', note: `Logging ${to.name} on its own history.` };
  }
  const lo = reps[0];
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

export { DRE_SWAPS };
