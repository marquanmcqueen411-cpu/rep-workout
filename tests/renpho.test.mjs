import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRenpho, parseDate, parseCSV, mergeBodyweight, leanMass, detectColumns } from '../src/renpho.js';

const LB_CSV = `Time of Measurement,Weight(lb),BMI,Body Fat(%),Fat-free Body Weight(lb),Subcutaneous Fat(%),Visceral Fat,Body Water(%),Skeletal Muscle(%),Muscle Mass(lb),Bone Mass(lb),Protein(%),BMR(kcal),Metabolic Age
"2026-10-23 07:12:05",255.0,36.6,34.1,168.0,29.0,17,47.0,40.1,159.2,8.8,15.1,2180,52
"2026-10-23 19:40:00",257.4,36.9,34.3,169.1,29.1,17,46.9,40.0,159.9,8.9,15.0,2190,52
"2026-10-30 06:58:44",253.6,36.4,33.9,167.6,28.8,17,47.1,40.2,158.8,8.8,15.1,2172,52
"2026-11-06 07:05:10",252.8,36.3,33.6,167.9,28.6,16,47.3,40.3,159.0,8.8,15.2,2170,51
`;
// semicolon, kg, European day-first dates, decimal commas in quotes
const KG_CSV = `Date;Time;Weight (kg);BMI;Body fat (%);Muscle mass (kg)
23/10/2026;07:10;"115,7";36,6;34,1;72,2
30/10/2026;07:00;"115,0";36,4;33,9;72,0
06/11/2026;06:50;"114,7";36,3;33,6;72,1
`;

test('lb export: columns, unit, one row per day (earliest), body comp', () => {
  const r = parseRenpho(LB_CSV);
  assert.equal(r.ok, true); assert.equal(r.unit, 'lb'); assert.equal(r.unitSource, 'header');
  assert.equal(r.rows.length, 3); assert.equal(r.dupes, 1);
  assert.deepEqual(r.rows[0], { date: '2026-10-23', lb: 255, bf: 34.1, muscleLb: 159.2 });
  assert.equal(r.columns.weight, 'Weight(lb)'); assert.equal(r.columns.bodyFat, 'Body Fat(%)'); assert.equal(r.columns.muscle, 'Muscle Mass(lb)');
  assert.equal(r.from, '2026-10-23'); assert.equal(r.to, '2026-11-06');
});

test('kg export: semicolons, DMY dates, decimal commas → converted to lb', () => {
  const r = parseRenpho(KG_CSV);
  assert.equal(r.ok, true); assert.equal(r.unit, 'kg'); assert.equal(r.order, 'dmy'); assert.equal(r.delim, ';');
  assert.equal(r.rows.length, 3);
  assert.equal(r.rows[0].date, '2026-10-23'); assert.equal(r.rows[0].lb, 255.1); assert.equal(r.rows[0].muscleLb, 159.2); assert.equal(r.rows[0].bf, 34.1);
});

test('no unit in header: value suffix or magnitude decides; override works', () => {
  const sfx = parseRenpho('Date,Weight\n2026-11-01,115.2kg\n2026-11-02,115.0kg\n');
  assert.equal(sfx.unit, 'kg'); assert.equal(sfx.rows[0].lb, 254);
  const big = parseRenpho('Date,Weight\n2026-11-01,254.0\n');
  assert.equal(big.unit, 'lb'); assert.equal(big.unitSource, 'guessed from values');
  const small = parseRenpho('Date,Weight\n2026-11-01,115.0\n');
  assert.equal(small.unit, 'kg');
  assert.equal(parseRenpho('Date,Weight\n2026-11-01,115.0\n', { unit: 'lb' }).rows.length, 1);
});

test('date formats', () => {
  const d = s => parseDate(s)?.date;
  assert.equal(d('2026-10-23 07:12:05'), '2026-10-23');
  assert.equal(d('2026/10/23'), '2026-10-23');
  assert.equal(d('10/23/2026 7:12 AM'), '2026-10-23');
  assert.equal(d('10/23/26'), '2026-10-23');
  assert.equal(d('23/10/2026'), '2026-10-23');
  assert.equal(parseDate('03/04/2026', 'dmy').date, '2026-04-03');
  assert.equal(d('Oct 23, 2026'), '2026-10-23');
  assert.equal(d('23 Oct 2026'), '2026-10-23');
  assert.equal(d('2026-10-23T14:12:05Z'), '2026-10-23');
  assert.equal(parseDate('10/23/2026 7:12 PM').minutes, 19 * 60 + 12);
  assert.equal(parseDate('garbage'), null);
});

test('header detection ignores lean/fat-free/bone weight columns', () => {
  const c = detectColumns(['Fat-free Body Weight(lb)', 'Measure Time', 'Weight(lb)', 'Bone Mass(lb)', 'Body Fat(%)', 'Skeletal Muscle(%)', 'Muscle Mass(lb)']);
  assert.equal(c.weight, 2); assert.equal(c.date, 1); assert.equal(c.bf, 4); assert.equal(c.muscle, 6);
});

test('quoted CSV with embedded commas', () => {
  const r = parseCSV('a,b\n"x, y","z ""q"""\n');
  assert.deepEqual(r.rows[1], ['x, y', 'z "q"']);
});

test('bad files give a clear error', () => {
  assert.equal(parseRenpho('').ok, false);
  assert.match(parseRenpho('Foo,Bar\n1,2\n').error, /date and weight/);
});

test('merge: keep existing manual entries (default) vs overwrite; dedupe per day', () => {
  const existing = [{ date: '2026-10-23', lb: 255 }, { date: '2026-11-02', lb: 253 }];
  const rows = parseRenpho(LB_CSV).rows;
  const keep = mergeBodyweight(existing, rows, 'keep');
  assert.equal(keep.added, 2); assert.equal(keep.kept, 1); assert.equal(keep.updated, 0);
  assert.equal(keep.list.length, 4);
  const d23 = keep.list.find(b => b.date === '2026-10-23'); assert.equal(d23.lb, 255); assert.equal(d23.bf, 34.1); // body comp added, manual weight kept
  const ow = mergeBodyweight(existing, rows, 'overwrite');
  assert.equal(ow.updated, 1); assert.equal(ow.list.find(b => b.date === '2026-10-23').source, 'renpho');
  const noComp = mergeBodyweight([], rows, 'keep', { bodyComp: false });
  assert.ok(noComp.list.every(b => b.bf == null && b.muscleLb == null));
  assert.equal(new Set(keep.list.map(b => b.date)).size, keep.list.length);
});

test('lean mass', () => {
  assert.equal(leanMass({ lb: 255, bf: 34.1 }), 168);
  assert.equal(leanMass({ lb: 255 }), null);
});

import { readFileSync } from 'node:fs';
test('fixture files (lb + kg exports of the same history) agree within rounding', () => {
  const lb = parseRenpho(readFileSync(new URL('./fixtures/renpho-lb.csv', import.meta.url), 'utf8'));
  const kg = parseRenpho(readFileSync(new URL('./fixtures/renpho-kg.csv', import.meta.url), 'utf8'));
  assert.equal(lb.rows.length, 8); assert.equal(kg.rows.length, 8);
  lb.rows.forEach((r, i) => { assert.equal(r.date, kg.rows[i].date); assert.ok(Math.abs(r.lb - kg.rows[i].lb) <= 0.2); assert.equal(r.bf, kg.rows[i].bf); });
});
