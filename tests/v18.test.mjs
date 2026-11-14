// v1.8: adaptive expenditure, sets per muscle, summary + last-time comparison, notes, shortcuts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as store from '../src/store.js';
import { estimateExpenditure, weightSlope, loggedKcal, expenditureAdvice } from '../src/expenditure.js';
import { setsPerMuscle, plannedPerMuscle, volumeRows } from '../src/volume.js';
import { compareSet, summarize, summaryText } from '../src/summary.js';
import { PROGRAM } from '../src/program.js';
import { buildCheckIn } from '../src/checkin.js';

const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const food = kcal => ({ foodLog: [{ id: 'x', kcal }], kcal });
// 21 days ending yesterday (now = 2026-11-22): steady loss of 2 lb/wk, eating 1800
function scenario({ lbPerWeek = 2, intake = 1800, now = new Date(2026, 10, 22) } = {}) {
  const bodyweight = [], daily = {};
  for (let i = 21; i >= 1; i--) {
    const d = new Date(now); d.setDate(d.getDate() - i); const k = ymd(d);
    daily[k] = food(intake);
    bodyweight.push({ date: k, lb: +(250 - (21 - i) * lbPerWeek / 7).toFixed(2) });
  }
  return { bodyweight, daily, now, targets: { kcal: 1800 } };
}

test('weightSlope: least squares lb/day', () => {
  const s = weightSlope([{ date: '2026-11-01', lb: 250 }, { date: '2026-11-08', lb: 248 }, { date: '2026-11-15', lb: 246 }]);
  assert.ok(Math.abs(s - (-2 / 7)) < 1e-9);
});

test('loggedKcal skips half-logged days and empty days', () => {
  assert.equal(loggedKcal(food(500)), null);
  assert.equal(loggedKcal({ foodLog: [], kcal: 2000 }), null);
  assert.equal(loggedKcal(food(1700)), 1700);
});

test('expenditure = intake + trend energy (2 lb/wk at 1800 → ~2800)', () => {
  const x = estimateExpenditure(scenario());
  assert.equal(x.ok, true);
  assert.equal(x.avgIntake, 1800);
  assert.ok(Math.abs(x.expenditure - 2800) <= 10, String(x.expenditure));
  assert.ok(Math.abs(x.lbPerWeek - 2) < 0.01);
  assert.equal(x.confidence, 'high');
  assert.equal(x.advice.kind, 'ok'); // 2 lb/wk at ~248 lb ≈ 0.8 %/wk
});

test('expenditure: not enough data explains what is needed', () => {
  const x = estimateExpenditure({ bodyweight: [{ date: '2026-11-20', lb: 250 }], daily: {}, now: new Date(2026, 10, 22) });
  assert.equal(x.ok, false);
  assert.ok(x.need.some(n => /food day/.test(n)) && x.need.some(n => /weigh-in/.test(n)));
});

test('advice flags too-fast loss with a suggested kcal bump; never mutates targets', () => {
  const targets = { kcal: 1800 };
  const x = estimateExpenditure({ ...scenario({ lbPerWeek: 5 }), targets });
  assert.equal(x.advice.kind, 'fast');
  assert.match(x.advice.text, /Coach Brooke/);
  assert.match(x.advice.text, /\+\d+ kcal/);
  assert.deepEqual(targets, { kcal: 1800 });
  const slow = expenditureAdvice({ expenditure: 2000, avgIntake: 1800, curLb: 250, targetKcal: 1800 });
  assert.equal(slow.kind, 'slow');
  const under = expenditureAdvice({ expenditure: 2800, avgIntake: 1300, curLb: 250, targetKcal: 1800 });
  assert.match(under.text, /under target/);
});

test('sets per muscle: primary 1, secondary 0.5, date window', () => {
  const sessions = [
    { date: '2026-11-16', exercises: [{ exId: 'bench_press', sets: [{}, {}, {}] }] },
    { date: '2026-11-09', exercises: [{ exId: 'bench_press', sets: [{}, {}, {}] }] },
  ];
  const v = setsPerMuscle(sessions, '2026-11-16', '2026-11-22');
  assert.equal(v.chest, 3); assert.equal(v.triceps, 1.5); assert.equal(v.front_delts, 1.5);
  const planned = plannedPerMuscle(PROGRAM);
  assert.ok(planned.chest >= 6 && planned.quads >= 6);
  const rows = volumeRows(v, planned, {});
  assert.ok(rows.length > 5 && rows[0].planned >= rows.at(-1).planned);
  assert.equal(rows.find(r => r.m === 'chest').done, 3);
});

test('compareSet: weight up, reps up, same, down', () => {
  assert.deepEqual(compareSet({ weight: 180, reps: 8 }, { weight: 185, reps: 8 }), { kind: 'up', label: '+5 lb' });
  assert.deepEqual(compareSet({ weight: 180, reps: 7 }, { weight: 180, reps: 8 }), { kind: 'up', label: '+1 rep' });
  assert.equal(compareSet({ weight: 180, reps: 8 }, { weight: 180, reps: 8 }).kind, 'same');
  assert.equal(compareSet({ weight: 185, reps: 8 }, { weight: 180, reps: 8 }).kind, 'down');
  assert.deepEqual(compareSet({ weight: 180, reps: 8 }, { weight: 185, reps: 6 }), { kind: 'down', label: '+5 lb · −2 reps' });
  assert.deepEqual(compareSet({ weight: 180, reps: 8 }, { weight: 185, reps: 7 }), { kind: 'same', label: '+5 lb · −1 rep' });
  assert.equal(compareSet(null, { weight: 1, reps: 1 }), null);
});

test('summarize: volume, PRs, e1RM change vs last time, share text', () => {
  const rec = { id: 'b', workoutName: 'Upper A', date: '2026-11-16', start: '2026-11-16T18:00:00Z', end: '2026-11-16T18:52:00Z',
    exercises: [{ exId: 'bench_press', sets: [{ weight: 185, reps: 8, pr: ['weight'] }, { weight: 185, reps: 7 }, { weight: 185, reps: 7 }] }] };
  const prevSame = { exercises: [{ exId: 'bench_press', sets: [{ weight: 180, reps: 8 }, { weight: 180, reps: 8 }, { weight: 180, reps: 8 }] }] };
  const sm = summarize(rec, { prevOf: () => prevSame.exercises[0].sets, prevSame });
  assert.equal(sm.sets, 3); assert.equal(sm.mins, 52);
  assert.equal(sm.volume, 185 * 22);
  assert.equal(sm.prs.length, 1);
  assert.ok(sm.lifts[0].dE > 0);
  assert.equal(sm.volDeltaPct, Math.round((185 * 22 - 180 * 24) / (180 * 24) * 100));
  const t = summaryText(sm);
  assert.match(t, /Upper A/); assert.match(t, /PRs: Barbell Bench Press 185×8/);
});

test('store: exNotes + restNotify defaults and migration survive import', () => {
  store.resetAll();
  assert.deepEqual(store.state.exNotes, {});
  assert.equal(store.state.settings.restNotify, false);
  store.replaceState({ sessions: [], exNotes: { leg_press: 'Seat 6' }, settings: { restNotify: true } });
  assert.equal(store.state.exNotes.leg_press, 'Seat 6');
  assert.equal(store.state.settings.restNotify, true);
  store.replaceState({ sessions: [], exNotes: [] });
  assert.deepEqual(store.state.exNotes, {});
  store.resetAll();
});

test('check-in includes burn estimate once there is data', () => {
  store.resetAll();
  const sc = scenario({ now: new Date(2026, 10, 22) });
  store.state.bodyweight = sc.bodyweight; store.state.daily = sc.daily;
  const c = buildCheckIn(new Date(2026, 10, 22));
  assert.match(c.text, /Est\. burn .* ~2,8\d0 kcal\/day/);
  store.resetAll();
});

test('packaging: v1.8.0 cache, new modules cached, manifest shortcuts', () => {
  const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
  assert.match(sw, /rep-v2\.0\.2/);
  for (const f of ['expenditure.js', 'volume.js', 'summary.js']) assert.ok(sw.includes(`./src/${f}`), f);
  assert.match(sw, /notificationclick/);
  const m = JSON.parse(readFileSync(new URL('../manifest.json', import.meta.url), 'utf8'));
  assert.deepEqual(m.shortcuts.map(s => s.url), ['./?go=workout', './?go=food', './?go=weigh']);
});
