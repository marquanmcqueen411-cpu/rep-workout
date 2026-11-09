import { test } from 'node:test';
import assert from 'node:assert/strict';
import { movingAverage, lossRate, projectGoal, muscleRiskFlag, bwChartSeries } from '../src/fatloss.js';

const mk = (pairs) => pairs.map(([date, lb]) => ({ date, lb }));

test('7-day moving average smooths daily noise', () => {
  const bw = mk([
    ['2026-11-01', 255], ['2026-11-02', 254], ['2026-11-03', 256],
    ['2026-11-04', 253], ['2026-11-05', 252], ['2026-11-06', 251], ['2026-11-07', 250],
  ]);
  const ma = movingAverage(bw);
  assert.equal(ma.length, 7);
  assert.ok(ma.at(-1).lb < 255 && ma.at(-1).lb > 249);
  assert.equal(ma.at(-1).n, 7);
});

test('lossRate reports lb/wk and % BW/wk', () => {
  // Steady ~3.5 lb over 7 days from a flat-ish start
  const bw = mk([
    ['2026-10-25', 255], ['2026-10-26', 254.5], ['2026-10-27', 254],
    ['2026-10-28', 253.5], ['2026-10-29', 253], ['2026-10-30', 252.5],
    ['2026-10-31', 252], ['2026-11-01', 251.5],
  ]);
  const r = lossRate(bw);
  assert.ok(r);
  assert.ok(r.lbPerWeek >= 2 && r.lbPerWeek < 5, `lb/wk ${r.lbPerWeek}`);
  assert.ok(r.pctPerWeek > 0.5, `% ${r.pctPerWeek}`);
  assert.equal(r.losing, true);
});

test('projectGoal estimates arrival date', () => {
  const bw = mk([
    ['2026-10-01', 255], ['2026-10-08', 253], ['2026-10-15', 251],
    ['2026-10-22', 249], ['2026-10-29', 247], ['2026-11-05', 245],
  ]);
  const p = projectGoal(bw, 200);
  assert.ok(p && !p.arrived);
  assert.ok(p.days > 30);
  assert.match(p.date, /^202[6-7]-/);
});

test('muscleRiskFlag fires on fast 2-week cut', () => {
  // ~2% BW/week for 14+ days
  const bw = [];
  let w = 255;
  for (let i = 0; i < 21; i++) {
    const d = new Date(2026, 9, 20 + i);
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    w -= 0.75; // ~5.25 lb/wk ≈ 2%+
    bw.push({ date, lb: +w.toFixed(1) });
  }
  const flag = muscleRiskFlag(bw);
  assert.ok(flag, 'expected fast-loss flag');
  assert.equal(flag.reason, 'fast');
  assert.match(flag.message, /protein|Coach Dre/i);
});

test('muscleRiskFlag fires on multiple e1RM drops', () => {
  const flag = muscleRiskFlag(mk([['2026-11-01', 250], ['2026-11-08', 249]]), {
    strengthDrops: [
      { id: 'bench_press', name: 'Bench', dE: -4 },
      { id: 'box_squat', name: 'Squat', dE: -5 },
    ],
  });
  assert.ok(flag);
  assert.equal(flag.reason, 'e1rm');
});

test('bwChartSeries returns raw + ma points', () => {
  const s = bwChartSeries(mk([['2026-11-01', 250], ['2026-11-02', 249], ['2026-11-03', 248]]));
  assert.equal(s.raw.length, 3);
  assert.equal(s.ma.length, 3);
});
