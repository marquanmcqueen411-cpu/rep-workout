import { test } from 'node:test';
import assert from 'node:assert/strict';
import { plateBreakdown, formatPlates, wantsPlates, barFor, LA_PLATES } from '../src/plates.js';
import { exercise } from '../src/exercises.js';

test('185 lb on 45 bar → each side 45 + 25', () => {
  const bd = plateBreakdown(185, 45);
  assert.equal(bd.bar, 45);
  assert.equal(bd.perSide, 70);
  assert.deepEqual(bd.plates, [{ weight: 45, count: 1 }, { weight: 25, count: 1 }]);
  assert.equal(bd.exact, true);
  assert.match(formatPlates(bd), /45 \+ 25/);
});

test('225 lb → 45+45 each side', () => {
  const bd = plateBreakdown(225);
  assert.deepEqual(bd.plates, [{ weight: 45, count: 2 }]);
  assert.equal(formatPlates(bd), 'Each side: 45 + 45');
});

test('bar only and under-bar', () => {
  assert.match(formatPlates(plateBreakdown(45)), /Bar only/);
  const bd = plateBreakdown(40, 45);
  assert.ok(bd.remainder < 0 || bd.total < bd.bar);
});

test('2.5 plates used when needed (135 = 45/side)', () => {
  const bd = plateBreakdown(140, 45); // 47.5/side → 45 + 2.5
  assert.deepEqual(bd.plates, [{ weight: 45, count: 1 }, { weight: 2.5, count: 1 }]);
  assert.equal(bd.exact, true);
});

test('wantsPlates: barbell/trap yes, DB/machine no', () => {
  assert.equal(wantsPlates(exercise('bench_press')), true);
  assert.equal(wantsPlates(exercise('trap_bar_deadlift')), true);
  assert.equal(wantsPlates(exercise('hip_thrust')), true);
  assert.equal(wantsPlates(exercise('incline_db_press')), false);
  assert.equal(wantsPlates(exercise('leg_press')), false);
  assert.equal(wantsPlates(exercise('smith_box_squat')), false);
});

test('barFor uses trapBarWeight for trap bar', () => {
  assert.equal(barFor(exercise('trap_bar_deadlift'), { trapBarWeight: 55, barWeight: 45 }), 55);
  assert.equal(barFor(exercise('bench_press'), { trapBarWeight: 55, barWeight: 45 }), 45);
});

test('LA plate list is the expected set', () => {
  assert.deepEqual(LA_PLATES, [45, 35, 25, 10, 5, 2.5]);
});
