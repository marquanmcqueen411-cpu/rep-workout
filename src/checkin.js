// Weekly Coach Brooke check-in summary (pure plain-text builder).

import { state, ymd, parseYmd, mondayOf, addDays } from './store.js';
import { PROGRAM } from './program.js';
import { WD_LONG, doneSessions, e1rm, scheduleFor, historyFor, suppAdherence, injectionStatus } from './logic.js';
import { exercise } from './exercises.js';
import { lossRate, movingAverage, muscleRiskFlag } from './fatloss.js';
import { weekOf, setScore, logKind, bwOn } from './progression.js';
import { estimateExpenditure } from './expenditure.js';
import { earlyDeloadOn, deloadTriggers } from './deload.js';

function avg(nums) {
  const a = nums.filter(n => n != null && !Number.isNaN(+n));
  if (!a.length) return null;
  return a.reduce((s, n) => s + +n, 0) / a.length;
}
function fmt1(n) { return n == null ? '—' : (+n).toFixed(1); }
function fmt0(n) { return n == null ? '—' : String(Math.round(+n)); }

/** Monday (inclusive) → Sunday of the week containing `ref`. */
export function weekRange(ref = new Date()) {
  const mon = mondayOf(ref);
  const sun = addDays(mon, 6);
  return { mon, sun, from: ymd(mon), to: ymd(sun) };
}

function daysInRange(from, to) {
  const out = [];
  let d = parseYmd(from);
  const end = parseYmd(to);
  while (d <= end) { out.push(ymd(d)); d = addDays(d, 1); }
  return out;
}

function plannedLifts(from, to) {
  let n = 0;
  for (const k of daysInRange(from, to)) {
    const sc = scheduleFor(parseYmd(k));
    if (sc.type === 'lift') n++;
  }
  return n;
}

function topSet(ex) {
  if (!ex?.sets?.length) return null;
  let best = ex.sets[0];
  for (const s of ex.sets) {
    if (+s.weight > +best.weight || (+s.weight === +best.weight && +s.reps > +best.reps)) best = s;
  }
  return best;
}

/** Build a plain-text weekly summary for Coach Brooke. */
export function buildCheckIn(ref = new Date(), st = state) {
  // Use the just-finished week if today is Monday (Marquan opens it Monday morning).
  // Otherwise summarize the current week-to-date.
  const today = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  const lookAt = today.getDay() === 1 ? addDays(today, -1) : today; // Sun if Mon
  const { from, to, mon, sun } = weekRange(lookAt);
  const keys = daysInRange(from, to);
  const sessions = doneSessions().filter(s => s.date >= from && s.date <= to);
  const planned = plannedLifts(from, to);

  // Bodyweight
  const bwAll = [...st.bodyweight].filter(b => b.date <= to).sort((a, b) => a.date.localeCompare(b.date));
  const bwWeek = bwAll.filter(b => b.date >= from && b.date <= to);
  const ma = movingAverage(bwAll);
  const maNow = ma.filter(m => m.date <= to).at(-1);
  const maPrev = ma.filter(m => m.date < from).at(-1);
  const rate = lossRate(bwAll.filter(b => b.date <= to));
  const avgBw = avg(bwWeek.map(b => b.lb)) ?? maNow?.lb ?? null;
  const change = maNow && maPrev ? +(maNow.lb - maPrev.lb).toFixed(1) : (bwWeek.length >= 2 ? +(bwWeek.at(-1).lb - bwWeek[0].lb).toFixed(1) : null);

  // Lifts
  const progIds = [...new Set(st.program.workouts.flatMap(w => w.exercises.map(x => x.ex)))];
  const liftLines = [];
  const drops = [];
  for (const id of progIds) {
    const hist = historyFor(id).filter(h => !h.session.deload && !h.session.badDay);
    const thisW = hist.filter(h => h.session.date >= from && h.session.date <= to);
    if (!thisW.length) continue;
    const last = thisW[0]; // newest first
    const prior = hist.find(h => h.session.date < from);
    const top = topSet(last.ex);
    const exm = exercise(id); const kind = logKind(exm);
    const sc = h => Math.max(...h.ex.sets.map(s => setScore(exm, s, bwOn(st.bodyweight, h.session.date))));
    const eNow = sc(last);
    const ePrev = prior ? sc(prior) : null;
    const dE = ePrev ? +((eNow - ePrev) / ePrev * 100).toFixed(1) : null;
    if (dE != null && dE <= -3) drops.push({ id, name: exercise(id).name, dE });
    const prs = last.ex.sets.filter(s => s.pr && s.pr.length).length;
    liftLines.push({
      name: exercise(id).name, kind,
      top: !top ? '—' : kind === 'timed' ? `${Math.max(...last.ex.sets.map(s => +s.reps))} s` : kind === 'reps' ? `${Math.max(...last.ex.sets.map(s => +s.reps))} reps` : kind === 'assisted' ? `${+top.weight === 0 ? 'BW' : `−${+top.weight} assist`}×${top.reps}` : `${+top.weight}×${top.reps}`,
      e1rm: Math.round(eNow),
      dE,
      prs,
      date: last.session.date,
    });
  }
  const prCount = sessions.reduce((n, s) => n + s.exercises.reduce((m, e) => m + e.sets.filter(x => x.pr && x.pr.length).length, 0), 0);

  // Nutrition / daily
  const proteins = [], kcals = [], fats = [], carbs = [];
  const sleeps = [], waters = [];
  const stepsDays = [];
  const stepDows = (st.settings.schedule || []).map((x, i) => (x && x.type === 'steps' ? i : -1)).filter(i => i >= 0);
  const stepDayNames = stepDows.length ? [1, 2, 3, 4, 5, 6, 0].filter(i => stepDows.includes(i)).map(i => WD_LONG[i].slice(0, 3)).join('/') : 'step days';
  let suppDays = 0, suppOk = 0, foodDays = 0;
  for (const k of keys) {
    const d = st.daily[k];
    if (!d) continue;
    const hasFood = Array.isArray(d.foodLog) && d.foodLog.length;
    if (hasFood || d.protein || d.kcal) {
      if (hasFood) foodDays++;
      if (d.protein) proteins.push(d.protein);
      if (d.kcal) kcals.push(d.kcal);
      if (d.fat) fats.push(d.fat);
      if (d.carbs) carbs.push(d.carbs);
    }
    if (d.sleep != null) sleeps.push(d.sleep);
    if (d.waterOz) waters.push(d.waterOz);
    const wd = parseYmd(k).getDay();
    if (stepDows.includes(wd) && d.steps) stepsDays.push({ k, steps: d.steps, wd }); // scheduled step-walk days
    const a = suppAdherence(k);
    if (a) { suppDays++; if (a.n === a.total) suppOk++; }
  }
  const proteinGoal = st.settings.targets.protein || 210;
  const avgP = avg(proteins);
  const avgK = avg(kcals);
  const avgF = avg(fats);
  const avgC = avg(carbs);

  // Tirzepatide
  const inj = injectionStatus(parseYmd(to));
  const injLogged = st.injections.filter(i => i.date >= from && i.date <= to);

  // Dizzy / sleep / water notes
  const dizzy = st.dizzyEvents.filter(e => {
    const k = ymd(new Date(e.ts));
    return k >= from && k <= to;
  });
  const dizzyDaily = keys.filter(k => st.daily[k]?.dizzy === true);

  // Program week / deload
  const pw = weekOf(st.settings.cycleStart, parseYmd(to), st.program.cycleWeeks || 6, st.program.deloadWeek || 6, st.settings.deloadEnabled);

  const energy = estimateExpenditure({ bodyweight: st.bodyweight, daily: st.daily, targets: st.settings.targets, now: addDays(parseYmd(to), 1) });
  const flag = muscleRiskFlag(bwAll.filter(b => b.date <= to), { strengthDrops: drops });

  const lines = [];
  lines.push(`Rep weekly check-in · ${from} → ${to}`);
  lines.push(`Marquan · ${st.program.name || PROGRAM.name}`);
  const early = earlyDeloadOn(st.settings.earlyDeload, parseYmd(to)) ? st.settings.earlyDeload : null;
  lines.push(`Program: week ${pw.week} of ${pw.of}${early ? ' (EARLY DELOAD)' : pw.deload ? ' (DELOAD)' : ''} · cycle ${pw.cycle} · compounds RIR 2, isolation RIR 1–2, supersets 60 s`);
  if (early) lines.push(`  Early deload since ${early.from}: ${early.reason}`);
  else {
    const trig = deloadTriggers(st, parseYmd(to), { plannedDeload: pw.deload });
    lines.push(`  Deload check: ${trig.length ? trig.map(t => t.text).join('; ') + ' → deload suggested' : 'no early-deload triggers'}`);
  }
  const doneDeloads = (st.settings.deloadLog || []).filter(x => x.to >= from && x.from <= to);
  for (const x of doneDeloads) lines.push(`  Early deload ${x.from} → ${x.to}: ${x.reason}`);
  lines.push('');
  lines.push('BODYWEIGHT');
  lines.push(`  7-day avg: ${fmt1(avgBw)} lb${change != null ? ` (${change > 0 ? '+' : ''}${fmt1(change)} vs prior week)` : ''}`);
  if (rate) lines.push(`  Rate: ${rate.lbPerWeek > 0 ? '−' : '+'}${fmt1(Math.abs(rate.lbPerWeek))} lb/wk (${rate.pctPerWeek > 0 ? '−' : '+'}${fmt1(Math.abs(rate.pctPerWeek))}% BW/wk)`);
  lines.push(`  Goal: ${st.settings.goalWeight || 200} lb`);
  lines.push('');
  lines.push(`SESSIONS: ${sessions.length} done / ${planned} planned`);
  for (const s of sessions.sort((a, b) => a.date.localeCompare(b.date))) {
    const sets = s.exercises.reduce((n, e) => n + e.sets.length, 0);
    lines.push(`  ${s.date} · ${s.workoutName}${s.badDay ? ' (bad day)' : ''}${s.deload ? ' (deload)' : ''} · ${sets} sets`);
  }
  if (!sessions.length) lines.push('  (none)');
  lines.push('');
  lines.push('LIFTS (top set · e1RM change vs prior)');
  if (!liftLines.length) lines.push('  (no lifts this week)');
  for (const L of liftLines) {
    const noLoad = L.kind === 'timed' || L.kind === 'reps';
    const d = L.dE == null ? 'new' : `${L.dE > 0 ? '+' : ''}${L.dE}%${noLoad ? '' : ' e1RM'}`;
    lines.push(`  ${L.name}: ${L.top}${noLoad ? '' : ` · e1RM ${L.e1rm}`}${L.dE != null ? ` (${d})` : ''}${L.prs ? ` · ${L.prs} PR` : ''}`);
  }
  lines.push(`  PRs this week: ${prCount}`);
  lines.push('');
  lines.push('NUTRITION / RECOVERY');
  lines.push(`  Food days logged: ${foodDays}/${keys.length}`);
  lines.push(`  Protein avg: ${fmt0(avgP)} g / ${proteinGoal} g${avgP != null ? (avgP >= proteinGoal ? ' ✓' : ' (under)') : ''}`);
  if (avgK != null) lines.push(`  Kcal avg: ${fmt0(avgK)} (target ${st.settings.targets.kcal || 1800})`);
  if (energy && energy.ok) lines.push(`  Est. burn (food log + weight trend): ~${energy.expenditure.toLocaleString()} kcal/day (${energy.confidence} confidence, eating ~${energy.avgIntake.toLocaleString()})`);
  if (avgF != null || avgC != null) lines.push(`  Fat avg: ${fmt0(avgF)} g / ${st.settings.targets.fat || 55} g · Carbs avg: ${fmt0(avgC)} g / ${st.settings.targets.carbs || 125} g`);
  if (stepsDays.length) {
    lines.push(`  Steps (${stepDayNames} walk target ${Math.round((st.settings.targets.stepsMin || 6000) / 1000)}–${Math.round((st.settings.targets.stepsMax || 8000) / 1000)}k):`);
    for (const s of stepsDays) lines.push(`    ${WD_LONG[s.wd]} ${s.k}: ${s.steps.toLocaleString()}`);
  } else lines.push(`  Steps on ${stepDayNames}: not logged`);
  lines.push(`  Supplements 100% days: ${suppOk}/${suppDays || keys.length}`);
  lines.push(`  Tirzepatide: ${injLogged.length ? `logged ${injLogged.map(i => i.date).join(', ')}` : inj.status}`);
  if (sleeps.length) lines.push(`  Sleep avg: ${fmt1(avg(sleeps))} h`);
  if (waters.length) lines.push(`  Water avg: ${fmt0(avg(waters))} oz`);
  if (dizzy.length || dizzyDaily.length) {
    lines.push(`  Dizzy: ${dizzy.length + dizzyDaily.length} event(s)${dizzy.map(e => e.note ? ` — ${e.note}` : '').filter(Boolean).join('')}`);
  } else lines.push('  Dizzy: none');
  if (flag) {
    lines.push('');
    lines.push('FLAG');
    lines.push(`  ${flag.message}`);
  }
  lines.push('');
  lines.push('— sent from Rep');
  return {
    from, to, text: lines.join('\n'),
    meta: { sessions: sessions.length, planned, avgBw, change, rate, avgP, prCount, flag, pw },
  };
}
