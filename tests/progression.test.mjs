// Run: TZ=America/Los_Angeles node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { suggestNext, jumpFor, roundTo, warmups, detectPRs, e1rm, equipOf, defaultIncrement, bwOn, relStrength, weekOf, RULES } from '../src/progression.js';
import { EX_BY_ID } from '../src/exercises.js';

const X = id => EX_BY_ID[id];
const S = (w, reps, rir) => reps.map((r, i) => ({ weight: w, reps: r, rir: rir ? rir[i] : null }));
const H = (sets, o = {}) => ({ date: o.date || '2026-11-01', deload: !!o.deload, badDay: !!o.badDay, sets });
const bench = { ex: 'bench_press', sets: 3, reps: [6, 8] };
const squat = { ex: 'box_squat', sets: 3, reps: [6, 8] };

test('first session: no prefill + starting-weight guidance', () => {
  const r = suggestNext(bench, X('bench_press'), []);
  assert.equal(r.kind, 'first'); assert.equal(r.weight, null);
  assert.deepEqual(r.targets, [null, null, null]);
  assert.match(r.text, /enter your starting weight.*6–8 reps with ~2 reps left/);
});

test('double progression: per-set +1 only on sets below top', () => {
  const r = suggestNext(bench, X('bench_press'), [H(S(185, [8, 7, 6]))]);
  assert.equal(r.kind, 'reps'); assert.equal(r.weight, 185);
  assert.deepEqual(r.targets, [8, 8, 7]); assert.deepEqual(r.weights, [185, 185, 185]);
  assert.equal(r.text, 'Hit 8,7,6 at 185 → stay at 185, aim 8,8,7.');
});

test('all sets at top, upper barbell → +5 with plain-English line', () => {
  const r = suggestNext(bench, X('bench_press'), [H(S(185, [8, 8, 8]))]);
  assert.equal(r.kind, 'up'); assert.equal(r.weight, 190); assert.deepEqual(r.targets, [6, 6, 6]);
  assert.equal(r.text, 'Hit 8,8,8 at 185 last time → 190 today (+5 lb).');
});

test('all sets at top, lower barbell → +10', () => {
  const r = suggestNext(squat, X('box_squat'), [H(S(225, [8, 8, 8]))]);
  assert.equal(r.weight, 235); assert.match(r.text, /\+10 lb/);
});

test('split squat: +5 rule (smallest jump) → next DB up, explained', () => {
  const r = suggestNext({ ex: 'split_squat', sets: 3, reps: [8, 10] }, X('split_squat'), [H(S(40, [10, 10, 10]))]);
  assert.equal(r.weight, 45); assert.match(r.text, /\+5 lb\/hand \(next DB up\)/);
});

test('DB upper: +5 rule → next DB up (+5/hand)', () => {
  const r = suggestNext({ ex: 'incline_db_press', sets: 3, reps: [8, 10] }, X('incline_db_press'), [H(S(60, [10, 10, 10]))]);
  assert.equal(r.weight, 65); assert.match(r.text, /\+5 lb\/hand \(next DB up\)/);
});

test('machine stack (lat pulldown, default 10): +5 rule rounds to next stack step', () => {
  assert.equal(defaultIncrement(X('lat_pulldown')), 10);
  assert.equal(defaultIncrement(X('leg_press')), 10);
  const r = suggestNext({ ex: 'lat_pulldown', sets: 3, reps: [10, 12] }, X('lat_pulldown'), [H(S(160, [12, 12, 12]))]);
  assert.equal(r.weight, 170); assert.match(r.text, /next stack step/);
});

test('cable lateral raise default 5 lb step', () => {
  assert.equal(equipOf(X('cable_lateral_raise')), 'cable');
  assert.equal(defaultIncrement(X('cable_lateral_raise')), 5);
  const r = suggestNext({ ex: 'cable_lateral_raise', sets: 3, reps: [12, 15] }, X('cable_lateral_raise'), [H(S(15, [15, 15, 15]))]);
  assert.equal(r.weight, 20);
});

test('per-exercise increment override (2.5) is respected', () => {
  const r = suggestNext({ ex: 'cable_lateral_raise', sets: 3, reps: [12, 15] }, X('cable_lateral_raise'), [H(S(15, [15, 15, 15]))], { inc: 2.5 });
  assert.equal(r.weight, 20); // +5 rule is a multiple of 2.5
  const j = jumpFor(X('lat_pulldown'), 2.5); assert.equal(j.jump, 5);
});

test('RIR 3+ on every top set → bigger jump (2× rule)', () => {
  const r = suggestNext(bench, X('bench_press'), [H(S(185, [8, 8, 8], [3, 3, 3]))]);
  assert.equal(r.weight, 195); assert.match(r.text, /RIR 3\+ felt easy/);
});

test('top of range but all at RIR 0 → hold', () => {
  const r = suggestNext(bench, X('bench_press'), [H(S(185, [8, 8, 8], [0, 0, 0]))]);
  assert.equal(r.kind, 'hold'); assert.equal(r.weight, 185); assert.match(r.text, /failure/);
});

test('RIR 0 on a set below top → repeat that set\'s reps, +1 elsewhere', () => {
  const r = suggestNext(bench, X('bench_press'), [H(S(185, [8, 7, 6], [2, 1, 0]))]);
  assert.deepEqual(r.targets, [8, 8, 6]); assert.match(r.text, /repeat reps on sets taken to failure/);
});

test('missed bottom of range once → hold weight, aim bottom', () => {
  const r = suggestNext(bench, X('bench_press'), [H(S(185, [7, 6, 5]))]);
  assert.equal(r.kind, 'hold'); assert.equal(r.weight, 185); assert.deepEqual(r.targets, [7, 6, 6]);
});

test('missed bottom twice → −5% (small miss) / −10% (big miss)', () => {
  const small = suggestNext(bench, X('bench_press'), [H(S(200, [6, 6, 5]), { date: '2026-11-05' }), H(S(200, [6, 5, 5]))]);
  assert.equal(small.kind, 'reduce'); assert.equal(small.weight, 190); assert.match(small.text, /−5%/);
  const big = suggestNext(bench, X('bench_press'), [H(S(200, [5, 4, 3]), { date: '2026-11-05' }), H(S(200, [5, 4, 4]))]);
  assert.equal(big.weight, 180); assert.match(big.text, /−10%/);
});

test('stall: 3 sessions same weight, no rep gain → ~10% reset + swap option', () => {
  const hist = [H(S(185, [7, 7, 6])), H(S(185, [7, 6, 6])), H(S(185, [7, 7, 6]))];
  const r = suggestNext(bench, X('bench_press'), hist);
  assert.equal(r.kind, 'stall'); assert.equal(r.stall, true); assert.equal(r.weight, 165);
  assert.match(r.text, /No progress in 3 sessions.*reset ~10% to 165.*swap/);
});

test('not a stall when reps went up', () => {
  const hist = [H(S(185, [8, 7, 7])), H(S(185, [7, 7, 6])), H(S(185, [7, 6, 6]))];
  assert.equal(suggestNext(bench, X('bench_press'), hist).kind, 'reps');
});

test('deload: 2 sets, same weight, RIR 3', () => {
  const r = suggestNext(bench, X('bench_press'), [H(S(200, [8, 8, 7]))], { deload: true });
  assert.equal(r.kind, 'deload'); assert.equal(r.sets, 2); assert.equal(r.weight, 200); assert.equal(r.targets.length, 2);
  assert.match(r.text, /same weight .*RIR 3/);
});

test('after deload: return to previous working weight (deload session ignored)', () => {
  const hist = [H(S(180, [6, 6]), { deload: true, date: '2026-11-08' }), H(S(200, [8, 8, 7]))];
  const r = suggestNext(bench, X('bench_press'), hist);
  assert.equal(r.weight, 200); assert.deepEqual(r.targets, [8, 8, 8]); assert.match(r.text, /^Back from deload → return to 200/);
});

test('bad-day sessions never count as stalls or progression', () => {
  const hist = [H(S(185, [5, 5]), { badDay: true }), H(S(185, [5, 5]), { badDay: true }), H(S(185, [8, 7, 6]))];
  const r = suggestNext(bench, X('bench_press'), hist);
  assert.equal(r.kind, 'reps'); assert.deepEqual(r.targets, [8, 8, 7]);
});

test('bad day option: 2 sets + note', () => {
  const r = suggestNext(bench, X('bench_press'), [H(S(185, [8, 7, 6]))], { badDay: true });
  assert.equal(r.sets, 2); assert.equal(r.targets.length, 2); assert.match(r.text, /Bad day/);
});

test('only bad-day history → repeat that weight', () => {
  const r = suggestNext(bench, X('bench_press'), [H(S(175, [6, 6]), { badDay: true })]);
  assert.equal(r.kind, 'hold'); assert.equal(r.weight, 175);
});

test('assisted pull-up progresses by REDUCING assistance', () => {
  const r = suggestNext({ ex: 'assisted_pullup', sets: 3, reps: [6, 10] }, X('assisted_pullup'), [H(S(90, [10, 10, 10]))]);
  assert.equal(r.weight, 80);
});

test('PR detection: weight, rep and e1RM PRs; none on first session', () => {
  const prior = S(180, [8, 8, 8]);
  assert.deepEqual(detectPRs([], { weight: 185, reps: 8 }), []);
  assert.deepEqual(detectPRs(prior, { weight: 185, reps: 7 }).sort(), ['e1rm', 'weight']);
  assert.deepEqual(detectPRs(prior, { weight: 180, reps: 9 }).sort(), ['e1rm', 'reps']);
  assert.deepEqual(detectPRs(prior, { weight: 175, reps: 8 }), []);
});

test('Epley e1RM and relative strength', () => {
  assert.equal(Math.round(e1rm(185, 8)), 234);
  assert.equal(e1rm(0, 5), 0);
  const bw = [{ date: '2026-10-23', lb: 255 }, { date: '2026-11-02', lb: 253 }];
  assert.equal(bwOn(bw, '2026-11-05'), 253); assert.equal(bwOn(bw, '2026-10-30'), 255); assert.equal(bwOn(bw, '2026-10-01'), 255);
  assert.equal(relStrength(253, 253), 1);
});

test('warm-ups: bar, 50/70/85% rounded to plates, not above working weight', () => {
  const w = warmups(X('bench_press'), 185);
  assert.deepEqual(w.map(x => x.w), [45, 95, 130, 155]);
  assert.ok(w.every(x => x.w < 185));
  assert.deepEqual(warmups(X('bench_press'), 0), []);
  assert.deepEqual(warmups(X('lat_pulldown'), 160).map(x => x.w), [80, 110, 140]);
});

test('roundTo', () => {
  assert.equal(roundTo(166.5, 5), 165); assert.equal(roundTo(167.6, 5), 170);
  assert.equal(roundTo(171, 10, 'up'), 180); assert.equal(roundTo(170, 10, 'up'), 170); assert.equal(roundTo(179, 10, 'down'), 170);
});

test('week math: Monday rollover, cycles, deload week 6', () => {
  const start = '2026-11-09'; // Monday
  assert.equal(weekOf(start, new Date(2026, 10, 9)).week, 1);
  assert.equal(weekOf(start, new Date(2026, 10, 15, 23, 59)).week, 1); // Sunday night
  assert.equal(weekOf(start, new Date(2026, 10, 16, 0, 1)).week, 2);   // Monday 00:01
  const w6 = weekOf(start, new Date(2026, 11, 14)); assert.equal(w6.week, 6); assert.equal(w6.deload, true);
  const w7 = weekOf(start, new Date(2026, 11, 21)); assert.equal(w7.week, 1); assert.equal(w7.cycle, 2);
  assert.equal(weekOf(start, new Date(2026, 11, 14), 6, 6, false).deload, false);
});

test('week math is DST-safe (America/Los_Angeles spring forward & fall back)', () => {
  // Spring forward Sun 2027-03-14; fall back Sun 2026-11-01
  assert.equal(weekOf('2027-03-08', new Date(2027, 2, 15, 0, 30)).week, 2);
  assert.equal(weekOf('2027-03-08', new Date(2027, 2, 14, 23, 30)).week, 1);
  assert.equal(weekOf('2026-10-26', new Date(2026, 10, 2, 0, 30)).week, 2);
  assert.equal(weekOf('2026-10-26', new Date(2026, 10, 1, 23, 30)).week, 1);
  if (process.env.TZ === 'America/Los_Angeles') assert.equal(new Date(2027, 2, 15).getTimezoneOffset(), 420);
});

test('rules match Coach Brooke', () => {
  assert.deepEqual([RULES.upperJump, RULES.lowerJump, RULES.deloadSets, RULES.badDayLifts, RULES.badDaySets], [5, 10, 2, 2, 2]);
});
