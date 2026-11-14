// v2.0.2 regression: "Upper A isn't done — I didn't do any workouts, just weighed myself."
// Weigh-ins / body-comp / the baseline seed must never count as a workout, a done card, or streak credit.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as store from '../src/store.js';
import * as L from '../src/logic.js';
import { LEGACY_PROGRAM_V1, LEGACY_PROGRAM_V2 } from '../src/program.js';

const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const today = ymd(new Date());
const weighInsOnly = program => ({ // older-version phone data: zero sessions, only weigh-ins
  program: JSON.parse(JSON.stringify(program)), sessions: [],
  settings: { cycleStart: '2026-10-26' },
  bodyweight: [{ date: '2026-10-23', lb: 255 }, { date: '2026-11-09', lb: 257.2 }],
  daily: { [today]: { weight: 256 } },
});
const sess = (o = {}) => ({ id: 's' + Math.random(), workoutId: 'U1', workoutName: 'Upper A', date: today, start: new Date().toISOString(), status: 'done', exercises: [{ exId: 'bench_press', reps: [6, 8], sets: [] }], ...o });

for (const [name, prog] of [['v1 plan', LEGACY_PROGRAM_V1], ['v1.9 plan', LEGACY_PROGRAM_V2], ['v2.0 plan', null]]) {
  test(`weigh-ins only (${name}) → migration + one-time setup create no session, nothing done, no streak, next = Upper A`, () => {
    store.resetAll();
    store.replaceState(weighInsOnly(prog || store.state.program));
    const s = store.state;
    assert.equal(s.sessions.length, 0, 'no fake session');
    assert.equal(L.doneSessions().length, 0);
    assert.equal(L.trainingDays().size, 0, 'weigh-in / baseline not a training day');
    assert.deepEqual(L.streak(), { weeks: 0, thisWeek: 0, target: s.settings.weeklyTarget });
    assert.equal(L.nextInRotation().name, 'Upper A');
    assert.ok(s.bodyweight.some(b => b.baseline), 'baseline still logged');
    assert.equal(s.settings.cycleStart, '2026-11-23');
    store.resetAll();
  });
}

test('sessions with zero logged sets never count as done, streak, or rotation', () => {
  store.resetAll();
  store.state.sessions = [sess(), sess({ status: 'ended', workoutId: 'L1', workoutName: 'Lower A', exercises: [] }), sess({ exercises: undefined })];
  assert.equal(L.doneSessions().length, 0);
  assert.equal(L.streak().thisWeek, 0);
  assert.equal(L.nextInRotation().name, 'Upper A');
  store.state.sessions.push(sess({ exercises: [{ exId: 'bench_press', reps: [6, 8], sets: [{ weight: 185, reps: 8 }] }] }));
  assert.equal(L.doneSessions().length, 1, 'a real logged set still counts');
  assert.equal(L.streak().thisWeek, 1);
  assert.equal(L.nextInRotation().id, store.state.program.workouts[1].id);
  store.resetAll();
});

test('one-time cleanup: removes only zero-set sessions made by migration/setup code, once; never real sets or user sessions', () => {
  store.resetAll();
  const real = sess({ id: 'seedU1-3', source: 'seed', exercises: [{ exId: 'bench_press', reps: [6, 8], sets: [{ weight: 185, reps: 8 }] }] });
  const userEmpty = sess({ id: 's1731500000000', status: 'ended' });
  const fakes = [sess({ id: 'mig-1', source: 'migration' }), sess({ id: 'x1', setup: true }), sess({ id: 'onetime-baseline', exercises: [] }), sess({ id: 'x2', migrated: true, exercises: [{ exId: 'bench_press', sets: [] }] })];
  const st = JSON.parse(JSON.stringify(store.state)); delete st.oneTime;
  st.sessions = [real, ...fakes, userEmpty];
  store.replaceState(st);
  assert.deepEqual(store.state.sessions.map(x => x.id), ['seedU1-3', 's1731500000000'], 'real sets + user-made kept');
  assert.deepEqual(store.state.oneTime.cleanupEmpty20261113.removed, ['mig-1', 'x1', 'onetime-baseline', 'x2']);
  // flag set → never runs again
  store.state.sessions.push(sess({ id: 'mig-2', source: 'migration' }));
  store.replaceState(JSON.parse(JSON.stringify(store.state)));
  assert.ok(store.state.sessions.some(x => x.id === 'mig-2'), 'cleanup ran once only');
  assert.equal(L.doneSessions().some(x => x.id === 'mig-2'), false, '…and it still does not count as done');
  store.resetAll();
});

test('app: dizzy "end & save" with 0 sets stores no empty session; pre-start Today shows Upper A first; v2.0.2', () => {
  const app = readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
  assert.match(app, /if \(!total\) \{ state\.active = null;/);
  assert.match(app, /preStart \? first\.id/);
  assert.match(app, /First workout · \$\{fmtStart/);
  assert.match(readFileSync(new URL('../sw.js', import.meta.url), 'utf8'), /rep-v2\.0\.2/);
});
