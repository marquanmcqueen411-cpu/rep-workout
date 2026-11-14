// v2.0.1: one-time setup Marquan asked for — Nov 13 Renpho baseline + plan start Mon Nov 23 —
// plus a clean "future cycle start" and the 4-week rescan note.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as store from '../src/store.js';
import { weekOf } from '../src/progression.js';
import { nextRescan } from '../src/renpho.js';
import { buildCheckIn } from '../src/checkin.js';
import * as L from '../src/logic.js';

const phone = (o = {}) => ({ // what his phone has today: v2.0 state, no oneTime flag yet
  program: JSON.parse(JSON.stringify(store.state.program)),
  sessions: [{ id: 's1', workoutId: 'U1', workoutName: 'Upper A', date: '2026-11-09', start: '2026-11-09T18:00:00.000Z', status: 'done', exercises: [{ exId: 'bench_press', reps: [6, 8], sets: [{ weight: 180, reps: 8 }] }] }],
  settings: { cycleStart: '2026-11-09', increments: { bench_press: 2.5 } },
  bodyweight: [{ date: '2026-10-23', lb: 255 }, { date: '2026-11-09', lb: 257.2 }],
  ...o,
});

test('one-time: adds the Nov 13 baseline + sets plan start Nov 23, keeps everything else', () => {
  store.resetAll();
  store.replaceState(phone());
  const s = store.state;
  const b = s.bodyweight.find(x => x.date === '2026-11-13');
  assert.deepEqual(b, { date: '2026-11-13', lb: 256, bf: 39.6, visceral: 21, skeletalMuscleLb: 99.4, fatFreeLb: 154.6, muscleLb: 147, bmr: 1872, source: 'renpho', baseline: true });
  assert.deepEqual(s.bodyweight.map(x => x.date), ['2026-10-23', '2026-11-09', '2026-11-13'], 'sorted, nothing removed');
  assert.equal(s.settings.cycleStart, '2026-11-23');
  assert.equal(s.sessions.length, 1); assert.equal(s.settings.increments.bench_press, 2.5);
  assert.equal(s.oneTime.baseline20261113.addedBaseline, true);
  assert.deepEqual(s.oneTime.baseline20261113.cycleStart, { from: '2026-11-09', to: '2026-11-23' });
  store.resetAll();
});

test('one-time: never runs twice, never overwrites an existing Nov 13 entry', () => {
  store.resetAll();
  store.replaceState(phone({ bodyweight: [{ date: '2026-11-13', lb: 255.8, bf: 39.9 }] }));
  assert.deepEqual(store.state.bodyweight, [{ date: '2026-11-13', lb: 255.8, bf: 39.9 }], 'existing entry kept as-is');
  assert.equal(store.state.oneTime.baseline20261113.addedBaseline, false);
  // he later changes the start date and deletes the baseline; reloading must not redo it
  store.state.settings.cycleStart = '2026-11-30'; store.state.bodyweight = [];
  store.replaceState(JSON.parse(JSON.stringify(store.state)));
  assert.equal(store.state.settings.cycleStart, '2026-11-30');
  assert.equal(store.state.bodyweight.length, 0);
  store.resetAll();
  assert.ok(store.state.oneTime.baseline20261113.skipped, 'fresh installs skip it');
  store.resetAll();
});

test('future cycle start: no negative weeks, no deload, until Mon Nov 23', () => {
  for (const day of [13, 16, 20, 22]) {
    const w = weekOf('2026-11-23', new Date(2026, 10, day), 6, 6, true);
    assert.equal(w.notStarted, true, `Nov ${day}`); assert.equal(w.week, 0); assert.equal(w.deload, false);
    assert.equal(w.startsOn, '2026-11-23'); assert.equal(w.daysToStart, 23 - day);
  }
  const d1 = weekOf('2026-11-23', new Date(2026, 10, 23), 6, 6, true);
  assert.deepEqual([d1.week, d1.cycle, d1.deload, d1.notStarted], [1, 1, false, false]);
  const w6 = weekOf('2026-11-23', new Date(2026, 11, 28), 6, 6, true);
  assert.deepEqual([w6.week, w6.deload], [6, true], 'week 6 deload = Dec 28');
  assert.equal(weekOf('2026-11-23', new Date(2027, 0, 4), 6, 6, true).week, 1, 'cycle 2 starts Jan 4');
});

test('future start in the app: no deload prompt before Nov 23, workouts still suggested, check-in says when it starts', () => {
  store.resetAll();
  store.state.settings.cycleStart = '2026-11-23';
  store.state.daily['2026-11-13'] = { sleep: 4, dizzy: true };
  const pw = L.programWeek(new Date(2026, 10, 13, 10));
  assert.equal(pw.notStarted, true); assert.equal(pw.deload, false);
  assert.equal(L.deloadPrompt(new Date(2026, 10, 13, 10)), null, 'no deload prompt before the plan starts');
  const sg = L.suggest(store.state.program.workouts[0].exercises[0], { deload: pw.deload });
  assert.equal(sg.sets, 4, 'can still log Upper A (bench 4 sets)');
  const c = buildCheckIn(new Date(2026, 10, 16, 9));
  assert.match(c.text, /Program: plan starts 2026-11-23/);
  assert.doesNotMatch(c.text, /week -|week 0|Deload check/);
  // once started, triggers work again
  store.state.daily['2026-11-24'] = { sleep: 4 };
  assert.ok(L.deloadPrompt(new Date(2026, 10, 24, 10)));
  store.resetAll();
});

test('rescan: every 4 weeks after the later of last scan / plan start, on a Monday', () => {
  const bw = [{ date: '2026-10-23', lb: 255 }, { date: '2026-11-13', lb: 256, bf: 39.6, baseline: true }];
  const r = nextRescan(bw, '2026-11-23');
  assert.equal(r.next, '2026-12-21'); assert.equal(r.base.date, '2026-11-13');
  assert.equal(nextRescan([...bw, { date: '2026-12-21', lb: 248, bf: 38 }], '2026-11-23').next, '2027-01-18');
  assert.equal(nextRescan([{ date: '2026-10-23', lb: 255 }], '2026-11-23'), null, 'no scan → no note');
  assert.equal(nextRescan([{ date: '2026-11-11', lb: 255, bf: 40 }], '2026-11-02').next, '2026-12-14', 'Wed scan → Monday after +28 d');
  const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
  assert.match(sw, /rep-v2\.0\.2/);
});
