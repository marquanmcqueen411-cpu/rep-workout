// v1.9: Coach Brooke's 4-day split (5 lifts/day), time-based plank, reps-only banded push-up,
// assisted pull-up logging, home swap, and migration of saved v1 plans without data loss.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as store from '../src/store.js';
import { PROGRAM, DEFAULT_SCHEDULE, DEFAULT_REST } from '../src/program.js';
import { exercise, DRE_SWAPS, HOME_SWAPS, VIDEOS, alternatives } from '../src/exercises.js';
import { suggestNext, detectPRs, setScore, logKind } from '../src/progression.js';
import { swapAlternatives, swapSuggestion, swapTarget, programSlotReps } from '../src/swap.js';
import { compareSet, summarize } from '../src/summary.js';
import { plannedPerMuscle } from '../src/volume.js';
import { buildCheckIn } from '../src/checkin.js';
import * as L from '../src/logic.js';

const S = (w, reps) => reps.map(r => ({ weight: w, reps: r }));
const H = (sets, o = {}) => ({ date: '2026-11-10', deload: false, badDay: false, sets, ...o });
const slotOf = id => PROGRAM.workouts.flatMap(w => w.exercises).find(x => x.ex === id);

test('program (v2.0 final): Brooke 4-day split, exact order, sets × reps, supersets', () => {
  const plan = Object.fromEntries(PROGRAM.workouts.map(w => [w.name, w.exercises.map(x => `${x.ss ? x.ss + x.ssPos + ' ' : ''}${x.ex} ${x.sets}x${x.reps.join('-')}`)]));
  assert.deepEqual(plan, {
    'Upper A': ['bench_press 4x6-8', 'chest_supported_row 3x8-10', 'seated_db_shoulder_press 3x8-10', 'lat_pulldown 3x10-12', 'A1 cable_triceps_pushdown 3x12-15', 'A2 db_curl 3x10-12'],
    'Lower A': ['box_squat 3x6-8', 'romanian_deadlift 3x8-10', 'leg_press 3x10-12', 'seated_leg_curl 3x10-12', 'calf_raise 3x12-15'],
    'Upper B': ['incline_db_press 3x8-10', 'assisted_pullup 3x6-10', 'cable_fly 3x12-15', 'A1 cable_lateral_raise 3x12-15', 'A2 face_pull 3x12-15', 'B1 overhead_cable_extension 3x10-12', 'B2 cable_curl 3x10-12'],
    'Lower B': ['trap_bar_deadlift 3x6-8', 'split_squat 3x8-10', 'lying_leg_curl 3x10-12', 'leg_extension 3x12-15', 'A1 seated_calf_raise 3x12-15', 'A2 plank 3x30-45'],
  });
  const all = PROGRAM.workouts.flatMap(w => w.exercises.map(x => x.ex));
  assert.ok(!all.includes('seated_cable_row') && !all.includes('hip_thrust'), 'seated cable row + hip thrust removed');
  assert.deepEqual(PROGRAM.workouts.map(w => w.id), ['U1', 'L1', 'U2', 'L2'], 'workout ids unchanged so history + rotation carry over');
  assert.equal(PROGRAM.deloadWeek, 6); assert.equal(PROGRAM.rir, 2);
  assert.deepEqual(DEFAULT_REST, { first: 150, other: 90, superset: 60 });
  for (const w of PROGRAM.workouts) for (const x of w.exercises) assert.ok(exercise(x.ex).cues.length, `${x.ex} exists with cues`);
});

test('schedule: Mon UA, Tue REST, Wed LA, Thu steps, Fri UB, Sat LB, Sun steps', () => {
  const sig = DEFAULT_SCHEDULE.map(x => (x.type === 'lift' ? x.workout : x.type));
  assert.deepEqual(sig, ['steps', 'U1', 'rest', 'L1', 'steps', 'U2', 'L2']);
});

test('upper +5 / lower +10 at the top of range on all 3 sets', () => {
  const up = suggestNext(slotOf('cable_triceps_pushdown'), exercise('cable_triceps_pushdown'), [H(S(50, [15, 15, 15]))]);
  assert.equal(up.weight, 55);
  const lo = suggestNext(slotOf('seated_leg_curl'), exercise('seated_leg_curl'), [H(S(100, [12, 12, 12]))]);
  assert.equal(lo.weight, 110);
  const calf = suggestNext(slotOf('calf_raise'), exercise('calf_raise'), [H(S(150, [15, 15, 15]))]);
  assert.equal(calf.weight, 160);
  const curl = suggestNext(slotOf('db_curl'), exercise('db_curl'), [H(S(30, [12, 12, 12]))]);
  assert.equal(curl.weight, 35); // DB per hand
});

test('deload = 2 sets; bad day = 2 sets', () => {
  const d = suggestNext(slotOf('leg_extension'), exercise('leg_extension'), [H(S(100, [13, 13, 12]))], { deload: true });
  assert.equal(d.sets, 2);
  const b = suggestNext(slotOf('leg_extension'), exercise('leg_extension'), [H(S(100, [13, 13, 12]))], { badDay: true });
  assert.equal(b.sets, 2);
});

test('plank: time-based — seconds, +5 s per set, never weight', () => {
  const ex = exercise('plank');
  assert.equal(logKind(ex), 'timed');
  const first = suggestNext(slotOf('plank'), ex, []);
  assert.equal(first.weight, 0); assert.deepEqual(first.targets, [30, 30, 30]); assert.match(first.text, /seconds|s per set|hold/i);
  const r = suggestNext(slotOf('plank'), ex, [H(S(0, [35, 30, 30]))]);
  assert.equal(r.weight, 0); assert.deepEqual(r.targets, [40, 35, 35]); assert.match(r.text, /\+5 s/);
  const top = suggestNext(slotOf('plank'), ex, [H(S(0, [45, 45, 45]))]);
  assert.equal(top.weight, 0); assert.equal(top.kind, 'hold'); assert.match(top.text, /time, not weight/);
  assert.deepEqual(detectPRs(S(0, [40, 35]), { weight: 0, reps: 45 }, ex), ['time']);
  assert.equal(setScore(ex, { weight: 0, reps: 42 }), 42);
  assert.deepEqual(compareSet({ weight: 0, reps: 40 }, { weight: 0, reps: 45 }, ex), { kind: 'up', label: '+5 s' });
});

test('banded push-up: home swap for bench only, reps-only, 3×6–8', () => {
  assert.deepEqual(HOME_SWAPS, { bench_press: ['banded_pushup'] });
  const { ranked, home } = swapAlternatives('bench_press');
  assert.deepEqual(ranked.map(e => e.id), DRE_SWAPS.bench_press, 'Brooke ranked 3 unchanged');
  assert.deepEqual(home.map(e => [e.id, e.tag]), [['banded_pushup', 'Home']]);
  const ex = exercise('banded_pushup'); assert.equal(logKind(ex), 'reps');
  store.resetAll();
  const sg = swapSuggestion('bench_press', 'banded_pushup', slotOf('bench_press'));
  assert.equal(sg.sets, 3); assert.deepEqual(sg.weights, [0, 0, 0]); assert.deepEqual(sg.targets, [6, 6, 6]);
  const next = suggestNext({ sets: 3, reps: [6, 8] }, ex, [H(S(0, [7, 6, 6]))]);
  assert.deepEqual(next.targets, [8, 7, 7]); assert.equal(next.weight, 0);
  const top = suggestNext({ sets: 3, reps: [6, 8] }, ex, [H(S(0, [8, 8, 8]))]);
  assert.match(top.text, /heavier band|slower/);
});

test('pull-up: assistance logged, less assistance = progress; bodyweight = hold', () => {
  const ex = exercise('assisted_pullup'); assert.equal(logKind(ex), 'assisted');
  const r = suggestNext(slotOf('assisted_pullup'), ex, [H(S(60, [10, 10, 10]))]);
  assert.equal(r.weight, 50); assert.match(r.text, /assistance/);
  const bw = suggestNext(slotOf('assisted_pullup'), ex, [H(S(0, [10, 10, 10]))]);
  assert.equal(bw.weight, 0); assert.equal(bw.kind, 'hold');
  assert.match(suggestNext(slotOf('assisted_pullup'), ex, []).text, /assistance weight \(0 = bodyweight\)/);
  // PRs: less assistance, and more reps at same/less assistance; never a "heaviest" PR for more help
  assert.deepEqual(detectPRs(S(60, [8, 8]), { weight: 50, reps: 8 }, ex), ['assist']);
  assert.deepEqual(detectPRs(S(60, [8, 8]), { weight: 70, reps: 8 }, ex), []);
  assert.deepEqual(detectPRs(S(60, [8, 8]), { weight: 60, reps: 9 }, ex), ['reps']);
  assert.ok(setScore(ex, { weight: 40, reps: 8 }, 250) > setScore(ex, { weight: 60, reps: 8 }, 250));
  assert.equal(compareSet({ weight: 60, reps: 8 }, { weight: 50, reps: 8 }, ex).kind, 'up');
  assert.equal(compareSet({ weight: 60, reps: 8 }, { weight: 50, reps: 8 }, ex).label, '−10 lb assist');
});

test("Coach Brooke's ranked swaps for the new lifts, in her order", () => {
  const want = {
    lat_pulldown: ['single_arm_cable_pulldown', 'machine_pulldown', 'band_pulldown'],
    assisted_pullup: ['assisted_pullup_machine', 'lat_pulldown', 'band_assisted_pullup'],
    seated_cable_row: ['machine_row', 'one_arm_db_row', 'band_row'],
    cable_triceps_pushdown: ['rope_pushdown', 'overhead_cable_extension', 'close_grip_pushup'],
    db_curl: ['cable_curl', 'ez_bar_curl', 'band_curl'],
    seated_leg_curl: ['lying_leg_curl', 'stability_ball_leg_curl', 'band_leg_curl'],
    leg_extension: ['spanish_squat', 'heels_elevated_goblet_squat', 'band_leg_extension'],
    calf_raise: ['seated_calf_raise', 'leg_press_calf_raise', 'single_leg_db_calf_raise'],
    plank: ['dead_bug', 'pallof_press', 'side_plank'],
  };
  for (const [id, list] of Object.entries(want)) assert.deepEqual(DRE_SWAPS[id], list, id);
  assert.equal(Object.keys(DRE_SWAPS).length, 26);
  // every lift in the plan now has 3 swaps
  for (const w of PROGRAM.workouts) for (const x of w.exercises) assert.equal(alternatives(x.ex).length, 3, x.ex);
});

test('home swaps are tagged Home like the banded push-up', () => {
  const home = ['band_pulldown', 'band_row', 'close_grip_pushup', 'band_curl', 'band_leg_curl', 'band_leg_extension', 'single_leg_db_calf_raise', 'banded_pushup'];
  for (const id of home) { assert.equal(exercise(id).tag, 'Home', id); assert.equal(exercise(id).home, true, id); }
  for (const id of ['assisted_pullup_machine', 'machine_row', 'rope_pushdown', 'ez_bar_curl', 'seated_calf_raise', 'dead_bug', 'pallof_press', 'side_plank', 'spanish_squat', 'band_assisted_pullup', 'stability_ball_leg_curl']) {
    assert.ok(!exercise(id).home, id);
  }
});

test('swap log kinds: band/bodyweight = reps only, side plank = seconds, machines = weight', () => {
  const K = id => logKind(exercise(id));
  for (const id of ['band_pulldown', 'band_assisted_pullup', 'band_row', 'close_grip_pushup', 'band_curl', 'stability_ball_leg_curl', 'band_leg_curl', 'spanish_squat', 'band_leg_extension', 'dead_bug']) assert.equal(K(id), 'reps', id);
  assert.equal(K('side_plank'), 'timed');
  assert.equal(K('assisted_pullup_machine'), 'assisted');
  for (const id of ['rope_pushdown', 'overhead_cable_extension', 'ez_bar_curl', 'heels_elevated_goblet_squat', 'seated_calf_raise', 'leg_press_calf_raise', 'single_leg_db_calf_raise', 'pallof_press', 'machine_row', 'one_arm_db_row']) assert.equal(K(id), 'weight', id);
});

test('swaps keep the slot reps; plank swaps keep their own targets', () => {
  assert.deepEqual(swapTarget('seated_cable_row', 'band_row', { current: [10, 12], original: [10, 12] }).reps, [10, 12]);
  assert.deepEqual(swapTarget('plank', 'dead_bug', { current: [30, 45], original: [30, 45] }), { reps: [8, 8], note: 'per side' });
  assert.deepEqual(swapTarget('plank', 'pallof_press', { current: [30, 45] }), { reps: [10, 10], note: 'per side' });
  assert.deepEqual(swapTarget('plank', 'side_plank', { current: [30, 45] }), { reps: [20, 30], note: 'per side' });
  // leaving a plank swap goes back to the plan target, not 8/side
  assert.deepEqual(swapTarget('dead_bug', 'plank', { current: [8, 8], original: [30, 45] }).reps, [30, 45]);
  assert.deepEqual(programSlotReps('L2', 5), [30, 45]);
  // suggestions: no weight carry-over; reps-only / timed swaps need no weight
  const sp = swapSuggestion('plank', 'side_plank', { sets: 3, reps: [30, 45] });
  assert.deepEqual(sp.weights, [0, 0, 0]);
  assert.deepEqual(sp.targets.slice(0, 1), [20]);
  const br = swapSuggestion('seated_cable_row', 'band_row', { sets: 3, reps: [10, 12] });
  assert.deepEqual(br.weights, [0, 0, 0]);
  const pal = swapSuggestion('plank', 'pallof_press', { sets: 3, reps: [30, 45] });
  assert.equal(pal.first, true); assert.deepEqual(pal.weights, [null, null, null]);
  assert.match(pal.text, /10 reps/);
});

test('new lifts and Brooke swaps have oEmbed-verified demo videos', () => {
  for (const id of ['cable_triceps_pushdown', 'seated_leg_curl', 'calf_raise', 'db_curl', 'leg_extension', 'plank', 'banded_pushup', 'assisted_pullup',
    'single_arm_cable_pulldown', 'band_pulldown', 'assisted_pullup_machine', 'band_assisted_pullup', 'band_row', 'one_arm_db_row',
    'rope_pushdown', 'overhead_cable_extension', 'close_grip_pushup', 'ez_bar_curl', 'band_curl', 'lying_leg_curl',
    'stability_ball_leg_curl', 'band_leg_curl', 'spanish_squat', 'heels_elevated_goblet_squat', 'band_leg_extension',
    'seated_calf_raise', 'leg_press_calf_raise', 'single_leg_db_calf_raise', 'dead_bug', 'pallof_press', 'side_plank']) {
    assert.match(VIDEOS[id]?.id || '', /^[\w-]{11}$/, id);
  }
});

test('sets-per-muscle targets follow the new week (5 lifts/day)', () => {
  const p = plannedPerMuscle(PROGRAM);
  assert.ok(p.hamstrings >= 9 && p.calves >= 3 && p.biceps >= 6 && p.triceps >= 3 && p.abs >= 3, JSON.stringify(p));
});

test('summary + volume: plank/push-up add no fake lb volume', () => {
  const rec = { id: 'x', workoutName: 'Lower B', date: '2026-11-14', start: '2026-11-14T18:00:00Z', end: '2026-11-14T19:00:00Z',
    exercises: [{ exId: 'leg_extension', sets: S(100, [12, 12, 12]) }, { exId: 'plank', sets: S(0, [40, 40, 35]) }] };
  const sm = summarize(rec);
  assert.equal(sm.volume, 3600);
  assert.equal(sm.lifts[1].top, '40 s'); assert.match(sm.lifts[1].metric, /best 40 s/);
});

// ---- migration
const v1Program = () => ({ id: 'dre-ul4-v1', name: 'Coach Dre — Upper/Lower x4', rir: 2, cycleWeeks: 6, deloadWeek: 6, workouts: [
  { id: 'U1', name: 'Upper 1', exercises: [{ ex: 'bench_press', sets: 3, reps: [6, 8] }, { ex: 'chest_supported_row', sets: 3, reps: [8, 10] }, { ex: 'seated_db_shoulder_press', sets: 3, reps: [8, 10] }] },
  { id: 'L1', name: 'Lower 1', exercises: [{ ex: 'box_squat', sets: 3, reps: [6, 8] }, { ex: 'romanian_deadlift', sets: 3, reps: [8, 10] }, { ex: 'leg_press', sets: 3, reps: [10, 12] }] },
  { id: 'U2', name: 'Upper 2', exercises: [{ ex: 'lat_pulldown', sets: 3, reps: [8, 12] }, { ex: 'incline_db_press', sets: 3, reps: [8, 12] }, { ex: 'cable_lateral_raise', sets: 3, reps: [12, 15] }] },
  { id: 'L2', name: 'Lower 2', exercises: [{ ex: 'bb_deadlift_blocks', sets: 3, reps: [6, 8] }, { ex: 'split_squat', sets: 3, reps: [8, 10] }, { ex: 'hip_thrust', sets: 3, reps: [10, 12] }] },
] });
const v1Schedule = () => [{ type: 'steps' }, { type: 'lift', workout: 'U1' }, { type: 'steps' }, { type: 'lift', workout: 'L1' }, { type: 'steps' }, { type: 'lift', workout: 'U2' }, { type: 'lift', workout: 'L2' }];

test('migration: v1 plan → 4-day split; history, weights, cycle and permanent swaps kept', () => {
  const sessions = [
    { id: 's1', workoutId: 'U1', workoutName: 'Upper 1', date: '2026-11-09', start: '2026-11-09T18:00:00.000Z', status: 'done', exercises: [{ exId: 'bench_press', reps: [6, 8], sets: S(180, [8, 8, 8]) }] },
    { id: 's2', workoutId: 'U2', workoutName: 'Upper 2', date: '2026-11-13', start: '2026-11-13T18:00:00.000Z', status: 'done', exercises: [{ exId: 'lat_pulldown', reps: [8, 12], sets: S(160, [12, 12, 12]) }] },
  ];
  store.replaceState({ program: v1Program(), sessions, settings: { schedule: v1Schedule(), cycleStart: '2026-10-26', rest: { first: 165, other: 90 } }, bodyweight: [{ date: '2026-10-23', lb: 255 }], oneTime: { baseline20261113: true } });
  const s = store.state;
  assert.equal(s.program.id, PROGRAM.id);
  assert.equal(s.program.workouts[0].exercises.length, 6);
  assert.equal(s.sessions.length, 2, 'all sessions kept');
  assert.equal(s.sessions[0].exercises[0].sets[0].weight, 180, 'weights untouched');
  assert.equal(s.settings.cycleStart, '2026-10-26', 'cycle position kept');
  assert.equal(s.settings.rest.first, 165, 'rest tweak kept');
  assert.equal(s.settings.schedule[2].type, 'rest', 'Tuesday rest');
  assert.deepEqual(s.settings.schedule.map(x => x.type === 'lift' ? x.workout : x.type), ['steps', 'U1', 'rest', 'L1', 'steps', 'U2', 'L2']);
  // permanent swap (trap bar → block deadlift) carried into Lower B
  assert.equal(s.program.workouts[3].exercises[0].ex, 'bb_deadlift_blocks');
  assert.deepEqual(s.planMigration.keptSwaps, [{ from: 'trap_bar_deadlift', to: 'bb_deadlift_blocks' }]);
  // carried lift keeps progressing from its own history (lat pulldown 160×12,12,12 → 170)
  assert.equal(L.suggest(s.program.workouts[0].exercises[3]).weight, 170);
  // rotation continues from last workout id (U2 → L2 = Lower B)
  assert.equal(L.nextInRotation().name, 'Lower B');
  store.resetAll();
});

test('migration: customized schedule keeps class days but Tuesday becomes rest; idempotent', () => {
  const sch = v1Schedule(); sch[4] = { type: 'class' };
  store.replaceState({ program: v1Program(), sessions: [], settings: { schedule: sch } });
  assert.equal(store.state.settings.schedule[4].type, 'class');
  assert.equal(store.state.settings.schedule[2].type, 'rest');
  const at = store.state.planMigration.at;
  store.replaceState(JSON.parse(JSON.stringify(store.state)));
  assert.equal(store.state.planMigration.at, at, 'second load does not re-migrate');
  store.resetAll();
});

test('check-in: step days come from the schedule (Thu/Sun), no old wording', () => {
  store.resetAll();
  const c = buildCheckIn(new Date(2026, 10, 16));
  assert.match(c.text, /Steps on Thu\/Sun: not logged/);
  assert.doesNotMatch(c.text, /Tue\/Thu\/Sun/);
  store.resetAll();
});

test('v1.9.1/v2.0: user-facing text calls him Marquan, not Boss', async () => {
  const fs = await import('node:fs');
  for (const f of ['src/app.js', 'src/checkin.js', 'manifest.json', 'index.html']) {
    assert.doesNotMatch(fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8'), /\bBoss\b/, f);
  }
  assert.match(fs.readFileSync(new URL('../src/app.js', import.meta.url), 'utf8'), /Nice work, Marquan\./);
  assert.match(buildCheckIn(new Date('2026-11-16T09:00:00')).text, /^Marquan · /m);
  assert.match(fs.readFileSync(new URL('../sw.js', import.meta.url), 'utf8'), /rep-v2\.0\.1/);
});
