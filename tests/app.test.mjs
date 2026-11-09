// App-level logic with the real store (in-memory in Node) + packaging checks.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import * as store from '../src/store.js';
import * as L from '../src/logic.js';

const reset = () => { store.resetAll(); return store.state; };
const sess = (id, date, wid, exs, o = {}) => ({ id, workoutId: wid, workoutName: wid, date, start: `${date}T18:00:00.000Z`, end: `${date}T19:00:00.000Z`, status: 'done', deload: false, badDay: false, ...o, exercises: exs });

test('suggest() wires history + per-exercise increment override', () => {
  const s = reset();
  s.sessions.push(sess('a', '2026-11-02', 'U2', [{ exId: 'lat_pulldown', reps: [8, 12], sets: [{ weight: 160, reps: 12 }, { weight: 160, reps: 12 }, { weight: 160, reps: 12 }] }]));
  const slot = { ex: 'lat_pulldown', sets: 3, reps: [8, 12] };
  assert.equal(L.suggest(slot).weight, 170);
  s.settings.increments.lat_pulldown = 5;
  assert.equal(L.suggest(slot).weight, 165);
});

test('streak counts weeks with target days (lifts + classes), Monday-based', () => {
  const s = reset(); s.settings.weeklyTarget = 2;
  const ymd = d => store.ymd(d); const mon = store.mondayOf(new Date());
  const lastMon = store.addDays(mon, -7);
  s.sessions.push(sess('1', ymd(lastMon), 'U1', [{ exId: 'bench_press', reps: [6, 8], sets: [{ weight: 100, reps: 8 }] }]));
  s.daily[ymd(store.addDays(lastMon, 6))] = { cls: true }; // Sunday class
  assert.equal(L.streak().weeks, 1);
});

test('injection due window: Sat due, Sun due, Mon overdue', () => {
  const s = reset();
  s.injections = [{ id: 'x', ts: new Date(2026, 9, 31, 9).toISOString(), date: '2026-10-31' }];
  assert.equal(L.injectionStatus(new Date(2026, 10, 7)).status, 'due');
  assert.equal(L.injectionStatus(new Date(2026, 10, 8)).status, 'due');
  assert.equal(L.injectionStatus(new Date(2026, 10, 9)).status, 'overdue');
});

test('supplement adherence counts tirzepatide only on due days', () => {
  reset();
  assert.equal(L.suppAdherence('2026-11-09').total, 2); // Monday
  assert.equal(L.suppAdherence('2026-11-07').total, 3); // Saturday
});

test('export/import roundtrip is lossless (migrate keeps everything)', () => {
  const s = reset();
  s.sessions.push(sess('r', '2026-11-03', 'U1', [{ exId: 'bench_press', reps: [6, 8], sets: [{ weight: 185, reps: 8, rir: 2, pr: ['e1rm'] }] }]));
  s.settings.increments.bench_press = 2.5;
  const dump = JSON.parse(JSON.stringify(s));
  store.replaceState(JSON.parse(JSON.stringify(dump)));
  assert.deepEqual(JSON.parse(JSON.stringify(store.state)), dump);
});

test('service worker precaches every app file; manifest is GitHub-Pages-subpath safe', () => {
  const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
  for (const f of readdirSync(new URL('../src/', import.meta.url))) assert.ok(sw.includes(`./src/${f}`), `sw.js missing ./src/${f}`);
  for (const f of readdirSync(new URL('../icons/', import.meta.url))) assert.ok(sw.includes(`./icons/${f}`), `sw.js missing ./icons/${f}`);
  const m = JSON.parse(readFileSync(new URL('../manifest.json', import.meta.url), 'utf8'));
  for (const k of ['start_url', 'scope', 'id']) assert.ok(!m[k].startsWith('/'), `${k} must be relative`);
  assert.equal(m.display, 'standalone');
  assert.ok(m.icons.some(i => i.sizes === '192x192') && m.icons.some(i => i.sizes === '512x512') && m.icons.some(i => i.purpose === 'maskable'));
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(!/(href|src)="\//.test(html), 'index.html must not use root-absolute paths');
});
