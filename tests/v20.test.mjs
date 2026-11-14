// v2.0: Coach Brooke's FINAL LOCKED v2 plan — supersets, RIR targets, jump rules,
// hybrid deload (week 6 or early triggers), new swaps, v1.9 → v2.0 migration without data loss.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as store from '../src/store.js';
import { PROGRAM, DEFAULT_REST, PROGRESSION, LEGACY_PROGRAM_V2 } from '../src/program.js';
import { exercise, DRE_SWAPS, VIDEOS } from '../src/exercises.js';
import { suggestNext, ruleJump, targetRir, logKind } from '../src/progression.js';
import { plannedPerMuscle } from '../src/volume.js';
import { deloadTriggers, firstLiftDrops, earlyDeloadOn, startEarlyDeload, settleEarlyDeload } from '../src/deload.js';
import { buildCheckIn } from '../src/checkin.js';
import * as L from '../src/logic.js';

const S = (w, reps, rir = null) => reps.map(r => ({ weight: w, reps: r, rir }));
const H = (sets, o = {}) => ({ date: '2026-11-10', deload: false, badDay: false, sets, ...o });
const slot = (wid, ex) => PROGRAM.workouts.find(w => w.id === wid).exercises.find(x => x.ex === ex);

test('supersets: A1/A2 pairs sit together; Upper B has two (A, B); rest 150/90/60', () => {
  for (const w of PROGRAM.workouts) {
    const groups = {};
    w.exercises.forEach((x, i) => { if (x.ss) (groups[x.ss] = groups[x.ss] || []).push([i, x.ssPos]); });
    for (const [g, list] of Object.entries(groups)) {
      assert.deepEqual(list.map(x => x[1]), [1, 2], `${w.name} ${g}`);
      assert.equal(list[1][0], list[0][0] + 1, `${w.name} ${g} adjacent`);
    }
  }
  assert.deepEqual(Object.keys(PROGRAM.workouts.find(w => w.id === 'U2').exercises.reduce((a, x) => (x.ss ? { ...a, [x.ss]: 1 } : a), {})), ['A', 'B']);
  assert.ok(!PROGRAM.workouts.some(w => w.exercises[0].ss || w.exercises[1].ss), 'bad day (first 2 lifts) never splits a superset');
  assert.deepEqual(DEFAULT_REST, { first: 150, other: 90, superset: 60 });
});

test('RIR targets: compounds 2, isolation 1–2', () => {
  assert.equal(targetRir(exercise('bench_press')).label, 'RIR 2');
  assert.equal(targetRir(exercise('trap_bar_deadlift')).label, 'RIR 2');
  for (const id of ['cable_fly', 'face_pull', 'cable_curl', 'overhead_cable_extension', 'lying_leg_curl', 'seated_calf_raise', 'leg_extension'])
    assert.equal(targetRir(exercise(id)).label, 'RIR 1–2', id);
});

test('double progression only at the target RIR', () => {
  const bench = slot('U1', 'bench_press');
  assert.equal(bench.sets, 4);
  // top of range on all 4 sets at RIR 2 → +5
  assert.equal(suggestNext(bench, exercise('bench_press'), [H(S(185, [8, 8, 8, 8], 2))]).weight, 190);
  // top of range but RIR 1 on a compound → hold
  const h = suggestNext(bench, exercise('bench_press'), [H(S(185, [8, 8, 8, 8], 1))]);
  assert.equal(h.weight, 185); assert.equal(h.kind, 'hold'); assert.match(h.text, /RIR 2/);
  // bench just went 3 → 4 sets: a full 3-set session at the top still earns +5, and today has 4 sets
  const t = suggestNext(bench, exercise('bench_press'), [H(S(180, [8, 8, 8]))]);
  assert.equal(t.weight, 185); assert.equal(t.targets.length, 4);
  // only 3 of 4 sets at top → no jump
  assert.equal(suggestNext(bench, exercise('bench_press'), [H(S(185, [8, 8, 8, 7]))]).weight, 185);
  // isolation at RIR 1 is on target → add load
  const fly = slot('U2', 'cable_fly');
  assert.equal(suggestNext(fly, exercise('cable_fly'), [H(S(30, [15, 15, 15], 1))]).weight, 35);
  // isolation at RIR 0 → hold
  assert.equal(suggestNext(fly, exercise('cable_fly'), [H(S(30, [15, 15, 15], 0))]).kind, 'hold');
});

test('jump rules: +5 upper; +10 box squat / trap-bar / RDL / leg press; +5 split squat + isolation', () => {
  for (const id of ['box_squat', 'trap_bar_deadlift', 'romanian_deadlift', 'leg_press']) assert.equal(ruleJump(exercise(id)), 10, id);
  for (const id of ['split_squat', 'lying_leg_curl', 'leg_extension', 'seated_calf_raise', 'calf_raise', 'seated_leg_curl', 'bench_press', 'cable_fly', 'face_pull']) assert.equal(ruleJump(exercise(id)), 5, id);
  assert.equal(suggestNext(slot('L1', 'box_squat'), exercise('box_squat'), [H(S(225, [8, 8, 8]))]).weight, 235);
  assert.equal(suggestNext(slot('L2', 'trap_bar_deadlift'), exercise('trap_bar_deadlift'), [H(S(275, [8, 8, 8]))]).weight, 285);
  assert.equal(suggestNext(slot('L2', 'split_squat'), exercise('split_squat'), [H(S(40, [10, 10, 10]))]).weight, 45);
  // cable stack: +5
  assert.equal(suggestNext(slot('U2', 'face_pull'), exercise('face_pull'), [H(S(40, [15, 15, 15]))]).weight, 45);
  // machine stack: +5 rule → smallest jump (the 10 lb stack step)
  assert.equal(suggestNext(slot('L2', 'lying_leg_curl'), exercise('lying_leg_curl'), [H(S(90, [12, 12, 12]))]).weight, 100);
  assert.equal(PROGRESSION.smallIncrementLb, 5);
});

test('deload = 2 sets each, same weights, RIR 3; bad day = first 2 lifts × 2 sets', () => {
  const d = suggestNext(slot('U1', 'bench_press'), exercise('bench_press'), [H(S(185, [8, 8, 7, 7]))], { deload: true });
  assert.equal(d.sets, 2); assert.equal(d.weight, 185); assert.match(d.text, /RIR 3/);
  const a = suggestNext(slot('U2', 'assisted_pullup'), exercise('assisted_pullup'), [H(S(60, [8, 8, 8]))], { deload: true });
  assert.equal(a.weight, 60, 'same assistance');
  assert.equal(suggestNext(slot('U1', 'bench_press'), exercise('bench_press'), [H(S(185, [8, 8, 7, 7]))], { badDay: true }).sets, 2);
  assert.equal(PROGRESSION.badDayLifts, 2);
});

// ---- deload triggers
const sess = (id, wid, date, exId, sets, o = {}) => ({ id, workoutId: wid, workoutName: wid, date, start: `${date}T18:00:00.000Z`, status: 'done', exercises: [{ exId, reps: [6, 8], sets }], ...o });
const base = (o = {}) => ({ program: JSON.parse(JSON.stringify(PROGRAM)), sessions: [], daily: {}, dizzyEvents: [], bodyweight: [{ date: '2026-10-23', lb: 255 }], settings: { earlyDeload: null }, ...o });

test('deload trigger: a day\'s first lift drops 2 sessions in a row', () => {
  const st = base({ sessions: [
    sess('a', 'U1', '2026-10-26', 'bench_press', S(185, [8, 8, 8, 8])),
    sess('b', 'U1', '2026-11-02', 'bench_press', S(185, [7, 7, 7, 7])),
    sess('c', 'U1', '2026-11-09', 'bench_press', S(185, [6, 6, 6, 6])),
  ] });
  assert.deepEqual(firstLiftDrops(st).map(d => d.ex), ['bench_press']);
  const r = deloadTriggers(st, new Date(2026, 10, 12));
  assert.equal(r.length, 1); assert.match(r[0].text, /Barbell Bench Press .*dropped 2 sessions in a row/);
  // one drop only → nothing
  st.sessions[2].exercises[0].sets = S(185, [8, 8, 8, 8]);
  assert.equal(deloadTriggers(st, new Date(2026, 10, 12)).length, 0);
  // drops before the last deload don't count
  st.sessions[2].exercises[0].sets = S(185, [6, 6, 6, 6]);
  st.sessions.push(sess('d', 'L1', '2026-11-10', 'box_squat', S(200, [6, 6]), { deload: true }));
  assert.equal(firstLiftDrops(st).length, 0);
  // bad-day sessions are ignored
  const st2 = base({ sessions: [
    sess('a', 'L2', '2026-10-31', 'trap_bar_deadlift', S(275, [8, 8, 8])),
    sess('b', 'L2', '2026-11-07', 'trap_bar_deadlift', S(275, [7, 7, 7])),
    sess('c', 'L2', '2026-11-12', 'trap_bar_deadlift', S(275, [5, 5]), { badDay: true }),
  ] });
  assert.equal(firstLiftDrops(st2).length, 0);
});

test('deload trigger: bad sleep or dizziness; none while a deload is on', () => {
  const now = new Date(2026, 10, 13, 9);
  const st = base({ daily: { '2026-11-13': { sleep: 5.5 }, '2026-11-12': { sleep: 5.5 }, '2026-11-11': { sleep: 8 } } });
  assert.deepEqual(deloadTriggers(st, now).map(r => r.key), ['sleep']);
  assert.deepEqual(deloadTriggers(base({ daily: { '2026-11-13': { sleep: 4.5 } } }), now).map(r => r.key), ['sleep'], '< 5 h last night');
  assert.equal(deloadTriggers(base({ daily: { '2026-11-13': { sleep: 5.5 }, '2026-11-12': { sleep: 7 } } }), now).length, 0, 'one short night is fine');
  assert.deepEqual(deloadTriggers(base({ dizzyEvents: [{ ts: '2026-11-12T19:00:00.000Z' }] }), now).map(r => r.key), ['dizzy']);
  assert.deepEqual(deloadTriggers(base({ daily: { '2026-11-11': { dizzy: true } } }), now).map(r => r.key), ['dizzy']);
  assert.equal(deloadTriggers(base({ dizzyEvents: [{ ts: '2026-11-01T19:00:00.000Z' }] }), now).length, 0, 'old dizziness');
  assert.equal(deloadTriggers(st, now, { plannedDeload: true }).length, 0);
  st.settings.earlyDeload = { from: '2026-11-12', reason: 'x' };
  assert.equal(deloadTriggers(st, now).length, 0);
});

test('early deload: 7 days, then a new cycle starts; planned week 6 still works', () => {
  const settings = { cycleStart: '2026-10-26', earlyDeload: null, deloadLog: [] };
  startEarlyDeload(settings, [{ text: 'Sleep has tanked' }], new Date(2026, 10, 12, 8)); // Thu Nov 12
  assert.equal(settings.earlyDeload.from, '2026-11-12');
  assert.ok(earlyDeloadOn(settings.earlyDeload, new Date(2026, 10, 18)));
  assert.ok(!earlyDeloadOn(settings.earlyDeload, new Date(2026, 10, 19)));
  assert.equal(settleEarlyDeload(settings, new Date(2026, 10, 15)), false);
  assert.equal(settleEarlyDeload(settings, new Date(2026, 10, 19)), true);
  assert.equal(settings.earlyDeload, null);
  assert.equal(settings.cycleStart, '2026-11-16', 'week 1 = Monday of the week after the deload ended');
  assert.deepEqual(settings.deloadLog.map(x => [x.from, x.to]), [['2026-11-12', '2026-11-18']]);
  // in-app: programWeek reports the early deload, deloadPrompt hides while it runs
  store.resetAll();
  store.state.settings.cycleStart = '2026-11-02';
  assert.equal(L.programWeek(new Date(2026, 11, 7)).deload, true, 'week 6 planned deload');
  store.state.daily['2026-11-13'] = { sleep: 4 };
  assert.ok(L.deloadPrompt(new Date(2026, 10, 13, 10)));
  startEarlyDeload(store.state.settings, L.deloadPrompt(new Date(2026, 10, 13, 10)).reasons, new Date(2026, 10, 13, 10));
  const pw = L.programWeek(new Date(2026, 10, 14));
  assert.equal(pw.deload, true); assert.equal(pw.early, true); assert.match(pw.reason, /Sleep/);
  assert.equal(L.deloadPrompt(new Date(2026, 10, 14)), null);
  store.resetAll();
});

test('Not now hides the prompt for those reasons today only', () => {
  store.resetAll();
  store.state.daily['2026-11-13'] = { sleep: 4 };
  const now = new Date(2026, 10, 13, 10);
  const p = L.deloadPrompt(now);
  store.state.settings.deloadDismissed = { date: '2026-11-13', key: p.key };
  assert.equal(L.deloadPrompt(now), null);
  store.state.daily['2026-11-14'] = { sleep: 4 };
  assert.ok(L.deloadPrompt(new Date(2026, 10, 14, 10)), 'shows again the next day');
  store.resetAll();
});

test('new swaps: ranked, home tagged, kinds, verified videos', () => {
  const want = {
    cable_fly: ['pec_deck', 'flat_db_fly', 'banded_fly'],
    face_pull: ['reverse_pec_deck', 'rear_delt_db_raise', 'band_pull_apart'],
    overhead_cable_extension: ['db_overhead_extension', 'ez_skull_crusher', 'band_overhead_extension'],
    cable_curl: ['ez_bar_curl', 'db_curl', 'band_curl'],
    lying_leg_curl: ['seated_leg_curl', 'stability_ball_leg_curl', 'band_leg_curl'],
    seated_calf_raise: ['leg_press_calf_raise', 'smith_seated_calf_raise', 'single_leg_db_calf_raise'],
  };
  for (const [id, list] of Object.entries(want)) assert.deepEqual(DRE_SWAPS[id], list, id);
  for (const id of ['banded_fly', 'band_pull_apart', 'band_overhead_extension', 'band_curl', 'band_leg_curl', 'single_leg_db_calf_raise']) assert.equal(exercise(id).tag, 'Home', id);
  for (const id of ['banded_fly', 'band_pull_apart', 'band_overhead_extension']) assert.equal(logKind(exercise(id)), 'reps', id);
  for (const id of ['pec_deck', 'flat_db_fly', 'reverse_pec_deck', 'rear_delt_db_raise', 'db_overhead_extension', 'ez_skull_crusher', 'smith_seated_calf_raise']) assert.equal(logKind(exercise(id)), 'weight', id);
  assert.deepEqual(DRE_SWAPS.bench_press, ['db_bench_press', 'smith_bench_press', 'machine_chest_press'], 'existing swaps stay');
  assert.ok(DRE_SWAPS.seated_cable_row && DRE_SWAPS.hip_thrust, 'removed lifts keep their swap lists');
  for (const id of ['cable_fly', 'face_pull', 'cable_curl', ...Object.values(want).flat()]) assert.match(VIDEOS[id]?.id || '', /^[\w-]{11}$/, id);
  for (const w of PROGRAM.workouts) for (const x of w.exercises) assert.equal(DRE_SWAPS[x.ex].length, 3, x.ex);
});

test('sets per muscle follow the new week: chest ~10, back ~9+, rear delts trained, calves 6+', () => {
  const p = plannedPerMuscle(PROGRAM);
  assert.ok(p.calves >= 6, 'calves ' + p.calves); // 6 direct sets + secondary work
  assert.ok(p.chest >= 10, 'chest ' + p.chest);
  assert.ok(p.rear_delts >= 3, 'rear delts ' + p.rear_delts);
  assert.ok(p.lats >= 9, 'lats ' + p.lats);
  assert.ok(p.biceps >= 6 && p.triceps >= 6, `arms b${p.biceps} t${p.triceps}`);
  assert.equal(p.hamstrings >= 9, true);
});

test('migration v1.9 → v2.0: history, weights, cycle, rest kept; swaps carried; removed lifts keep history', () => {
  const v19 = { id: 'dre-ul4-v2', name: 'Coach Brooke — Upper/Lower 4-day', rir: 2, cycleWeeks: 6, deloadWeek: 6,
    workouts: Object.entries(LEGACY_PROGRAM_V2.workouts).map(([id, exs]) => ({ id, name: id, exercises: exs.map(ex => ({ ex, sets: 3, reps: [8, 10] })) })) };
  v19.workouts[0].exercises[0].ex = 'db_bench_press';           // permanent swap: bench → DB bench
  v19.workouts[2].exercises[2].ex = 'machine_row';              // seated cable row → machine row (lift removed)
  v19.workouts[3].exercises[4] = { ex: 'side_plank', sets: 3, reps: [20, 30], note: 'per side' }; // plank → side plank
  const sessions = [
    { id: 'x1', workoutId: 'U2', workoutName: 'Upper B', date: '2026-11-06', start: '2026-11-06T18:00:00.000Z', status: 'done', exercises: [{ exId: 'seated_cable_row', reps: [10, 12], sets: S(140, [12, 12, 12]) }] },
    { id: 'x2', workoutId: 'L2', workoutName: 'Lower B', date: '2026-11-07', start: '2026-11-07T18:00:00.000Z', status: 'done', exercises: [{ exId: 'hip_thrust', reps: [10, 12], sets: S(225, [12, 12, 12]) }] },
  ];
  const sched = [{ type: 'steps' }, { type: 'lift', workout: 'U1' }, { type: 'rest' }, { type: 'lift', workout: 'L1' }, { type: 'class' }, { type: 'lift', workout: 'U2' }, { type: 'lift', workout: 'L2' }];
  store.replaceState({ program: v19, sessions, settings: { schedule: sched, cycleStart: '2026-11-02', rest: { first: 165, other: 90 }, increments: { face_pull: 2.5 } }, exNotes: { hip_thrust: 'pad' }, oneTime: { baseline20261113: true } });
  const s = store.state;
  assert.equal(s.program.id, PROGRAM.id);
  assert.equal(s.program.workouts[0].exercises[0].ex, 'db_bench_press'); assert.equal(s.program.workouts[0].exercises[0].sets, 4);
  assert.deepEqual(s.program.workouts[3].exercises[5], { ex: 'side_plank', sets: 3, reps: [20, 30], note: 'per side', ss: 'A', ssPos: 2 });
  assert.deepEqual(s.planMigration.droppedSwaps, [{ from: 'seated_cable_row', to: 'machine_row' }]);
  assert.equal(s.sessions.length, 2, 'sessions kept (incl. removed lifts)');
  assert.equal(L.historyFor('seated_cable_row').length, 1); assert.equal(L.historyFor('hip_thrust').length, 1);
  assert.equal(s.exNotes.hip_thrust, 'pad'); assert.equal(s.settings.increments.face_pull, 2.5);
  assert.equal(s.settings.cycleStart, '2026-11-02'); assert.equal(s.settings.rest.first, 165); assert.equal(s.settings.rest.superset, 60);
  assert.equal(s.settings.schedule[4].type, 'class', 'custom schedule kept'); assert.equal(s.settings.schedule[2].type, 'rest');
  assert.equal(s.planMigrations.length, 1);
  const at = s.planMigration.at;
  store.replaceState(JSON.parse(JSON.stringify(s)));
  assert.equal(store.state.planMigration.at, at, 'idempotent');
  store.resetAll();
});

test('check-in: deload status + RIR rules; Marquan; sw cache v2.0.0 includes deload.js', () => {
  store.resetAll();
  store.state.daily['2026-11-15'] = { sleep: 4 };
  const c = buildCheckIn(new Date(2026, 10, 16, 9));
  assert.match(c.text, /compounds RIR 2, isolation RIR 1–2/);
  assert.match(c.text, /Deload check: Sleep has tanked .*deload suggested/);
  assert.match(c.text, /^Marquan · /m);
  store.resetAll();
  const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
  assert.match(sw, /rep-v2\.0\.2/); assert.match(sw, /\.\/src\/deload\.js/);
});
