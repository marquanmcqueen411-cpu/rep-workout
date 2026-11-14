// MacroFactor-style adaptive expenditure estimate (pure).
// Expenditure ≈ average logged intake + energy from the weight trend change.
// Suggestion only — never changes Coach Dre's targets.
import { parseYmd, addDays, ymd } from './store.js';

// DST-safe whole-day index
const dIdx = k => { const d = parseYmd(k); return Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000); };

export const KCAL_PER_LB = 3500;

/** Least-squares slope (lb/day) of weigh-ins. */
export function weightSlope(points) {
  if (points.length < 2) return null;
  const t0 = dIdx(points[0].date);
  const xs = points.map(p => dIdx(p.date) - t0);
  const ys = points.map(p => +p.lb);
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length, my = ys.reduce((a, b) => a + b, 0) / ys.length;
  let num = 0, den = 0;
  for (let i = 0; i < xs.length; i++) { num += (xs[i] - mx) * (ys[i] - my); den += (xs[i] - mx) ** 2; }
  return den ? num / den : null;
}

/** A day counts as "logged" when it has food entries and a plausible total (skips half-logged days). */
export function loggedKcal(d, minKcal = 800) {
  if (!d || !Array.isArray(d.foodLog) || !d.foodLog.length) return null;
  const k = +d.kcal || d.foodLog.reduce((a, e) => a + (+e.kcal || 0), 0);
  return k >= minKcal ? k : null;
}

/**
 * Estimate daily expenditure over the last `days` complete days (ending yesterday).
 * Returns null when there is not enough data yet (with `need` explaining what's missing).
 */
export function estimateExpenditure({ bodyweight = [], daily = {}, targets = {}, now = new Date(), days = 21, minLogged = 7, minWeighIns = 4, minSpan = 10 } = {}) {
  const end = addDays(new Date(now.getFullYear(), now.getMonth(), now.getDate()), -1);
  const start = addDays(end, -(days - 1));
  const from = ymd(start), to = ymd(end);
  const bw = [...bodyweight].filter(b => b && +b.lb > 0 && b.date >= from && b.date <= to).sort((a, b) => a.date.localeCompare(b.date));
  const intakes = [];
  for (let i = 0; i < days; i++) { const k = ymd(addDays(start, i)); const v = loggedKcal(daily[k]); if (v != null) intakes.push(v); }
  const span = bw.length >= 2 ? dIdx(bw.at(-1).date) - dIdx(bw[0].date) : 0;
  const need = [];
  if (intakes.length < minLogged) need.push(`${minLogged - intakes.length} more full food day${minLogged - intakes.length === 1 ? '' : 's'}`);
  if (bw.length < minWeighIns) need.push(`${minWeighIns - bw.length} more weigh-in${minWeighIns - bw.length === 1 ? '' : 's'}`);
  else if (span < minSpan) need.push(`weigh-ins spread over ${minSpan}+ days`);
  const base = { from, to, loggedDays: intakes.length, weighIns: bw.length, days };
  if (need.length) return { ok: false, ...base, need };
  const slope = weightSlope(bw);                      // lb/day (negative = losing)
  const avgIntake = intakes.reduce((a, b) => a + b, 0) / intakes.length;
  const expenditure = avgIntake - slope * KCAL_PER_LB; // losing → expenditure above intake
  const lbPerWeek = -slope * 7;
  const curLb = bw.at(-1).lb;
  const conf = intakes.length >= 14 && bw.length >= 10 ? 'high' : intakes.length >= 10 && bw.length >= 6 ? 'medium' : 'low';
  return { ok: true, ...base, avgIntake: Math.round(avgIntake), expenditure: Math.round(expenditure / 10) * 10, lbPerWeek: +lbPerWeek.toFixed(2), pctPerWeek: +(lbPerWeek / curLb * 100).toFixed(2), curLb, confidence: conf, advice: expenditureAdvice({ expenditure, avgIntake, curLb, targetKcal: +targets.kcal || 1800 }) };
}

const r50 = n => Math.round(n / 50) * 50;
/** Plain-language suggestion. Safe band for muscle retention: ~0.5–1.5 % BW/week. */
export function expenditureAdvice({ expenditure, avgIntake, curLb, targetKcal }) {
  const atTarget = (expenditure - targetKcal) * 7 / KCAL_PER_LB;  // lb/wk if he eats exactly the target
  const pctAtTarget = atTarget / curLb * 100;
  const under = targetKcal - avgIntake;
  let kind = 'ok', text;
  if (pctAtTarget > 1.5) {
    const add = r50(targetKcal - (expenditure - curLb * 0.01 * KCAL_PER_LB / 7));
    kind = 'fast';
    text = `At ${targetKcal.toLocaleString()} kcal you'd lose ~${atTarget.toFixed(1)} lb/wk (${pctAtTarget.toFixed(1)}% BW) — faster than is ideal for keeping muscle. Ask Coach Dre about ~+${Math.abs(add)} kcal/day (mostly carbs around training).`;
  } else if (pctAtTarget < 0.5) {
    kind = 'slow';
    text = `At ${targetKcal.toLocaleString()} kcal you'd lose ~${Math.max(0, atTarget).toFixed(1)} lb/wk. Check logging (oils, sauces, drinks) for a week before changing anything, then ask Coach Dre.`;
  } else {
    text = `At ${targetKcal.toLocaleString()} kcal you'd lose ~${atTarget.toFixed(1)} lb/wk (${pctAtTarget.toFixed(1)}% BW) — right in the muscle-sparing zone. Keep going.`;
  }
  if (under > 250) text += ` You're averaging ${Math.round(under)} kcal under target — on tirzepatide, eating up to target (and 210 g protein) protects muscle.`;
  return { kind, text, atTargetLbPerWeek: +atTarget.toFixed(2), pctAtTarget: +pctAtTarget.toFixed(2) };
}
