import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as store from '../src/store.js';
import { buildCheckIn, weekRange } from '../src/checkin.js';
import { needsBackupReminder, formatLastBackup, backupPayload, backupFilename, canShareFiles } from '../src/backup.js';
import { swapSuggestion, swapAlternatives, DRE_SWAPS } from '../src/swap.js';
import { alternatives, exercise } from '../src/exercises.js';

const reset = () => { store.resetAll(); return store.state; };
const sess = (id, date, wid, exs, o = {}) => ({
  id, workoutId: wid, workoutName: wid, date,
  start: `${date}T18:00:00.000Z`, end: `${date}T19:00:00.000Z`,
  status: 'done', deload: false, badDay: false, ...o,
  exercises: exs,
});

test('weekRange is Mon–Sun', () => {
  // Wednesday Nov 5 2026
  const r = weekRange(new Date(2026, 10, 5));
  assert.equal(r.from, '2026-11-02');
  assert.equal(r.to, '2026-11-08');
});

test('buildCheckIn summarizes sessions, protein, lifts', () => {
  const s = reset();
  // Seed last week (Mon Nov 2 – Sun Nov 8) relative to "today" Mon Nov 9
  s.sessions.push(
    sess('u1', '2026-11-02', 'U1', [{ exId: 'bench_press', reps: [6, 8], sets: [{ weight: 185, reps: 8, pr: ['e1rm'] }, { weight: 185, reps: 7 }, { weight: 185, reps: 7 }] }]),
    sess('l1', '2026-11-04', 'L1', [{ exId: 'box_squat', reps: [6, 8], sets: [{ weight: 225, reps: 8 }, { weight: 225, reps: 7 }, { weight: 225, reps: 7 }] }]),
  );
  s.bodyweight.push({ date: '2026-11-02', lb: 253 }, { date: '2026-11-09', lb: 251.5 });
  s.daily['2026-11-02'] = { protein: 220, kcal: 1800, waterOz: 100, sleep: 7, steps: 0, dizzy: false, dizzyNote: '', cls: false, proteinLog: [], supps: { creatine: 'x', 'protein-shake': 'x' } };
  s.daily['2026-11-03'] = { protein: 200, kcal: 1750, waterOz: 90, sleep: 6.5, steps: 7200, dizzy: false, dizzyNote: '', cls: false, proteinLog: [], supps: { creatine: 'x' } };
  s.daily['2026-11-04'] = { protein: 210, kcal: 1800, waterOz: 100, sleep: 7, steps: 0, dizzy: false, dizzyNote: '', cls: false, proteinLog: [], supps: { creatine: 'x', 'protein-shake': 'x' } };
  const c = buildCheckIn(new Date(2026, 10, 9)); // Monday → looks at prior week
  assert.equal(c.from, '2026-11-02');
  assert.equal(c.to, '2026-11-08');
  assert.match(c.text, /SESSIONS: 2 done/);
  assert.match(c.text, /Barbell Bench Press/);
  assert.match(c.text, /Protein avg:/);
  assert.match(c.text, /sent from Rep/);
  assert.equal(c.meta.sessions, 2);
  assert.equal(c.meta.prCount, 1);
});

test('needsBackupReminder: never / stale / sunday', () => {
  const mon = new Date(2026, 10, 9, 12); // Mon
  assert.equal(needsBackupReminder(null, { now: mon }).reason, 'never');
  const sun = new Date(2026, 10, 8, 12);
  const recent = new Date(sun.getTime() - 2 * 86400000).toISOString();
  assert.equal(needsBackupReminder(recent, { now: sun }).show, true); // sunday + >1 day
  const fresh = new Date(mon.getTime() - 1 * 86400000).toISOString();
  assert.equal(needsBackupReminder(fresh, { now: mon }).show, false);
  const old = new Date(mon.getTime() - 10 * 86400000).toISOString();
  assert.equal(needsBackupReminder(old, { now: mon }).reason, 'stale');
  assert.equal(formatLastBackup(null), 'Never');
  assert.match(formatLastBackup(new Date(2026, 10, 1, 9).toISOString()), /Nov/);
});

test('backupPayload + filename shape', () => {
  const s = reset();
  const p = backupPayload(s);
  assert.equal(p.app, 'rep-workout');
  assert.ok(p.data.sessions);
  assert.equal(backupFilename('2026-11-09'), 'rep-backup-2026-11-09.json');
  assert.equal(canShareFiles(), false); // Node has no share API
});

test('DRE_SWAPS: every lift has exactly 3 ranked swaps that exist', () => {
  const primaries = [
    'bench_press', 'chest_supported_row', 'seated_db_shoulder_press',
    'box_squat', 'romanian_deadlift', 'leg_press',
    'lat_pulldown', 'incline_db_press', 'cable_lateral_raise',
    'trap_bar_deadlift', 'split_squat', 'hip_thrust',
    // v1.9 lifts — Coach Brooke's lists
    'assisted_pullup', 'seated_cable_row', 'cable_triceps_pushdown', 'db_curl',
    'seated_leg_curl', 'leg_extension', 'calf_raise', 'plank',
  ];
  assert.deepEqual(Object.keys(DRE_SWAPS).sort(), [...primaries].sort());
  for (const id of primaries) {
    const alts = alternatives(id);
    assert.equal(alts.length, 3, `${id} should have 3 swaps`);
    assert.deepEqual(alts.map(a => a.id), DRE_SWAPS[id]);
    for (const a of alts) assert.ok(a.name && a.cues?.length, `${a.id} needs name+cues`);
  }
  assert.match(exercise('bb_deadlift_blocks').tag, /no trap bar/i);
});

test('swapAlternatives returns only Brooke ranked list (lean)', () => {
  const { ranked, rest } = swapAlternatives('trap_bar_deadlift');
  assert.deepEqual(ranked.map(e => e.id), ['bb_deadlift_blocks', 'db_deadlift', 'smith_deadlift']);
  assert.equal(rest.length, 0);
});

test('swapSuggestion uses own history; never converts from original lift', () => {
  const s = reset();
  s.sessions.push(sess('a', '2026-11-02', 'U1', [
    { exId: 'db_bench_press', reps: [6, 8], sets: [{ weight: 70, reps: 8 }, { weight: 70, reps: 8 }, { weight: 70, reps: 8 }] },
  ]));
  const withHist = swapSuggestion('bench_press', 'db_bench_press', { sets: 3, reps: [6, 8] });
  assert.equal(withHist.source, 'history');
  assert.ok(withHist.weight >= 70);

  store.resetAll();
  store.state.sessions.push(sess('b', '2026-11-02', 'U1', [
    { exId: 'bench_press', reps: [6, 8], sets: [{ weight: 185, reps: 8 }, { weight: 185, reps: 8 }, { weight: 185, reps: 7 }] },
  ]));
  const fresh = swapSuggestion('bench_press', 'machine_chest_press', { sets: 3, reps: [6, 8] });
  assert.equal(fresh.source, 'fresh');
  assert.equal(fresh.first, true);
  assert.equal(fresh.weight, null);
  assert.match(fresh.text, /First time.*RIR 2/i);
  assert.ok(!/185|convert|Swapped from/i.test(fresh.text), 'must not carry original weight');
});

test('settings migrate picks up bar/voice/backup defaults', () => {
  store.replaceState({ version: 1, sessions: [], settings: { sound: false } });
  assert.equal(store.state.settings.voice, true);
  assert.equal(store.state.settings.barWeight, 45);
  assert.equal(store.state.settings.trapBarWeight, 45);
  assert.equal(store.state.settings.lastBackupAt, null);
  assert.equal(store.state.settings.sound, false);
});
