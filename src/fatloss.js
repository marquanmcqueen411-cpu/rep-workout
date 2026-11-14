// Smarter fat-loss tracking (pure). No medical claims — gentle coaching flags only.

import { parseYmd, addDays, ymd } from './store.js';

/** Sorted ascending bodyweight entries: [{date, lb, ...}] */
export function sortedBw(list = []) {
  return [...list].filter(b => b && b.date && +b.lb > 0).sort((a, b) => a.date.localeCompare(b.date));
}

/** 7-day trailing moving average at each weigh-in (uses days with data in the window). */
export function movingAverage(list, windowDays = 7) {
  const bw = sortedBw(list);
  return bw.map((b) => {
    const startKey = ymd(addDays(parseYmd(b.date), -(windowDays - 1)));
    const win = bw.filter(x => x.date >= startKey && x.date <= b.date);
    const avg = win.reduce((a, x) => a + +x.lb, 0) / win.length;
    return { date: b.date, lb: +avg.toFixed(2), n: win.length, raw: +b.lb };
  });
}

/**
 * Weekly rate of loss from the 7-day MA.
 * Uses the newest MA point vs the MA ~7 days earlier (or earliest if short history).
 */
export function lossRate(list, { now = new Date(), windowDays = 7 } = {}) {
  const ma = movingAverage(list, windowDays);
  if (ma.length < 2) return null;
  const last = ma[ma.length - 1];
  const target = parseYmd(last.date).getTime() - 7 * 86400000;
  let prev = ma[0];
  for (const p of ma) {
    if (parseYmd(p.date).getTime() <= target) prev = p;
  }
  if (prev.date === last.date) prev = ma[Math.max(0, ma.length - 2)];
  const days = Math.max(1, Math.round((parseYmd(last.date) - parseYmd(prev.date)) / 86400000));
  const delta = prev.lb - last.lb; // positive = loss
  const lbPerWeek = +(delta * (7 / days)).toFixed(2);
  const pctPerWeek = last.lb > 0 ? +((lbPerWeek / last.lb) * 100).toFixed(2) : 0;
  return {
    from: prev, to: last, days: +days.toFixed(1),
    lbPerWeek, pctPerWeek,
    losing: lbPerWeek > 0.05,
  };
}

/** Project calendar date to reach goalLb at current lb/wk rate. null if not losing. */
export function projectGoal(list, goalLb, { now = new Date() } = {}) {
  const rate = lossRate(list, { now });
  if (!rate || !(rate.lbPerWeek > 0.05)) return null;
  const cur = rate.to.lb;
  if (cur <= goalLb) return { arrived: true, date: rate.to.date, days: 0, rate };
  const days = Math.ceil((cur - goalLb) / (rate.lbPerWeek / 7));
  const dt = addDays(parseYmd(rate.to.date), days);
  return { arrived: false, date: ymd(dt), days, rate, current: cur, goal: goalLb };
}

/**
 * Flag if loss is faster than ~1.5% BW/week for 2+ consecutive weeks,
 * or if several program lifts show dropping e1RM.
 * strengthDrop: [{ id, name, dE }] optional — negative dE means drop.
 */
export function muscleRiskFlag(list, { strengthDrops = [], now = new Date(), pctLimit = 1.5 } = {}) {
  const ma = movingAverage(list);
  if (ma.length < 3) {
    const drops = strengthDrops.filter(s => s.dE <= -3);
    if (drops.length >= 2) {
      return {
        level: 'warn',
        reason: 'e1rm',
        message: `${drops.length} lifts have dropped ~3%+ e1RM while cutting. Hit 210 g protein and tell Coach Brooke.`,
        drops,
      };
    }
    return null;
  }
  // Check last ~14 days as two weekly windows
  const last = ma[ma.length - 1];
  const t1 = parseYmd(last.date).getTime() - 7 * 86400000;
  const t2 = t1 - 7 * 86400000;
  const at = (t) => {
    let best = ma[0];
    for (const p of ma) if (parseYmd(p.date).getTime() <= t) best = p;
    return best;
  };
  const a = at(t2), b = at(t1), c = last;
  const week = (x, y) => {
    const days = Math.max(1, Math.round((parseYmd(y.date) - parseYmd(x.date)) / 86400000));
    if (days < 4) return null;
    const lbw = (x.lb - y.lb) * (7 / days);
    const pct = y.lb > 0 ? (lbw / y.lb) * 100 : 0;
    return { lbPerWeek: +lbw.toFixed(2), pctPerWeek: +pct.toFixed(2), from: x.date, to: y.date };
  };
  const w1 = week(a, b), w2 = week(b, c);
  const fast = (w) => w && w.pctPerWeek >= pctLimit;
  const drops = strengthDrops.filter(s => s.dE <= -3);
  if (fast(w1) && fast(w2)) {
    return {
      level: 'warn',
      reason: 'fast',
      message: `Losing ~${w2.pctPerWeek}% bodyweight/week for 2+ weeks (faster than ~1.5%). Check protein (210 g) and tell Coach Brooke — fast cuts can cost muscle on tirzepatide.`,
      weeks: [w1, w2],
      drops,
    };
  }
  if (drops.length >= 2) {
    return {
      level: 'warn',
      reason: 'e1rm',
      message: `${drops.length} lifts have dropped ~3%+ e1RM while cutting. Hit 210 g protein and tell Coach Brooke.`,
      drops,
      weeks: [w1, w2].filter(Boolean),
    };
  }
  return null;
}

/** Chart-ready points for raw + MA overlay. */
export function bwChartSeries(list, windowDays = 7) {
  const bw = sortedBw(list);
  const ma = movingAverage(bw, windowDays);
  return {
    raw: bw.map(b => ({ x: parseYmd(b.date).getTime(), y: +b.lb, date: b.date })),
    ma: ma.map(b => ({ x: parseYmd(b.date).getTime(), y: b.lb, date: b.date })),
  };
}
