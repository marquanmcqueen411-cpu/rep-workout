import { state, save, ymd, parseYmd, mondayOf, addDays, day, replaceState, resetAll, resetProgram, clone, uid, recalcProtein } from './store.js';
import { EXERCISES, MUSCLES, exercise, demoUrl, watchUrl, embedUrl } from './exercises.js';
import { PROGRESSION, BODYWEIGHT, SUPP_TIMINGS } from './program.js';
import { WD, WD_LONG, workoutById, doneSessions, programWeek, scheduleFor, nextInRotation, suggest, fmtW,
  historyFor, e1rm, recovery, recColor, streak, trainingDays, round, suppAdherence, suppStreak, injectionStatus, injLine, incFor, priorSets, exStats } from './logic.js';
import { warmups, equipOf, EQUIP_LABEL, defaultIncrement, detectPRs, e1rm as epley } from './progression.js';
import { bodySvg } from './body.js';
import { lineChart, barChart } from './charts.js';
import { parseRenpho, mergeBodyweight, leanMass } from './renpho.js';
import { MEALS, BUILTIN_FOODS, BUILTIN_BY_ID, scaleFood, totals, remaining, syncedTotals, applySyncedTotals, proteinEntriesFromFood, rememberRecent, isFavorite, toggleFavorite, foodKey } from './foods.js';
import { searchFoods, lookupBarcode } from './food-api.js';
import { plateBreakdown, formatPlates, wantsPlates, barFor } from './plates.js';
import { bwChartSeries, lossRate, projectGoal, muscleRiskFlag, movingAverage } from './fatloss.js';
import { buildCheckIn } from './checkin.js';
import { shareOrDownloadBackup, needsBackupReminder, formatLastBackup } from './backup.js';
import { swapAlternatives, swapSuggestion } from './swap.js';
import { estimateExpenditure } from './expenditure.js';
import { setsPerMuscle, plannedPerMuscle, volumeRows } from './volume.js';
import { compareSet, summarize, summaryText } from './summary.js';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtNum = n => Number(n || 0).toLocaleString();
const TABS = ['today', 'progress', 'recovery', 'daily', 'settings'];

let tab = TABS.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'today';
let ui = { histMetric: 'e1rm', choice: null, badDay: false, dailyDate: ymd(), progEx: null, metric: 'e1rm', calMonth: new Date(), pre: null, swap: null };

// =========================================================== render
function render() {
  const view = $('#view');
  const y = window.scrollY;
  view.innerHTML = ({ today: viewToday, progress: viewProgress, recovery: viewRecovery, daily: viewDaily, settings: viewSettings })[tab]();
  document.querySelectorAll('.tabbar button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
  window.scrollTo(0, y);
  renderTimer();
}
function go(t) { closeSheet(); tab = t; location.hash = t; window.scrollTo(0, 0); render(); }

// =========================================================== TODAY
function viewToday() {
  if (state.active) return viewWorkout();
  const now = new Date();
  const pw = programWeek(now);
  const sch = scheduleFor(now);
  const d = day();
  const t = state.settings.targets;
  let h = `<header class="hero"><div class="eyebrow">${WD_LONG[now.getDay()]}, ${now.toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}</div>
    <h1>Today</h1><div class="chips"><span class="chip ${pw.deload ? 'warn' : ''}">Week ${pw.week} of ${pw.of}${pw.deload ? ' · DELOAD' : ''}</span><span class="chip">Cycle ${pw.cycle}</span><span class="chip">RIR 2</span></div></header>`;
  if (pw.deload) h += `<div class="banner deload"><b>Deload week.</b> ~60% volume: 2 sets per lift at ~90% weight. Recover, move well, keep protein high.</div>`;
  h += weighInCard();
  h += checkInCard();
  h += backupReminderCard();
  if (injectionStatus().status !== 'done') h += injectionCard(true);

  const doneToday = doneSessions().filter(s => s.date === ymd());
  const wid = ui.choice || (sch.type === 'lift' ? sch.workout : null);
  if (doneToday.length && !ui.choice) {
    h += `<section class="card done-card"><div class="row between"><h2>✓ ${esc(doneToday.map(s => s.workoutName).join(' + '))} done</h2></div>
      <p class="muted">${doneToday.map(s => `${s.exercises.reduce((a, e) => a + e.sets.length, 0)} sets`).join(', ')} logged. Nice work, Boss. Hit protein and steps.</p>
      <div class="quick"><button class="btn" data-act="summary" data-id="${doneToday.at(-1).id}">View summary</button><button class="btn ghost" data-act="choose">Train another</button></div></section>`;
  } else if (wid && workoutById(wid)) {
    h += workoutPreview(workoutById(wid), sch, pw);
  } else if (sch.type === 'steps') {
    const goalTxt = `${fmtNum(t.stepsMin)}–${fmtNum(t.stepsMax)}`;
    h += `<section class="card"><div class="eyebrow accent">Steps day</div><h2>Walk ${goalTxt} steps</h2>
      ${bar(d.steps, t.steps)}<div class="row between"><span class="big">${fmtNum(d.steps)}</span><span class="muted">goal ${fmtNum(t.steps)}</span></div>
      <div class="quick"><button class="btn" data-act="steps" data-n="1000">+1k</button><button class="btn" data-act="steps" data-n="2500">+2.5k</button><button class="btn" data-act="go" data-tab="daily">Set exact</button></div>
      <button class="btn ghost" data-act="choose">Lift anyway (next: ${esc(nextInRotation().name)})</button></section>`;
  } else if (sch.type === 'class') {
    h += classCard(d, true);
  } else {
    h += `<section class="card"><div class="eyebrow accent">Rest day</div><h2>Recover</h2><p class="muted">Sleep, protein, easy walk.</p>
      <button class="btn ghost" data-act="choose">Lift anyway (next: ${esc(nextInRotation().name)})</button></section>`;
  }
  if (sch.type !== 'class') h += classCard(d, false);

  // snapshot
  h += `<section class="card"><div class="row between"><h3>Daily snapshot</h3><button class="link" data-act="go" data-tab="daily">Open ›</button></div>
    <div class="snap"><div><span class="lbl">Protein</span><b>${d.protein}</b><small>/ ${t.protein} g</small>${bar(d.protein, t.protein)}</div>
    <div><span class="lbl">Water</span><b>${d.waterOz}</b><small>/ ${t.waterOz} oz</small>${bar(d.waterOz, t.waterOz)}</div>
    <div><span class="lbl">Steps</span><b>${fmtNum(d.steps)}</b><small>/ ${fmtNum(t.steps)}</small>${bar(d.steps, t.steps)}</div></div>
    ${(a => a ? `<div class="row between snap-supp"><span class="lbl">Supplements</span><span><b>${a.n}/${a.total}</b> taken</span></div>` : '')(suppAdherence(ymd()))}</section>`;
  h += weekStrip();
  return h;
}

function classCard(d, isPlanned) {
  if (!isPlanned) {
    return d.cls ? `<section class="card slim"><div class="row between"><span>🥋 Class / other training logged today</span><button class="link" data-act="cls">Undo</button></div></section>`
      : `<button class="btn ghost wide" data-act="cls">🥋 Log class / other training today</button>`;
  }
  return `<section class="card"><div class="eyebrow accent">Class / other training</div><h2>Grappling / strength class</h2>
    <p class="muted">Counts toward your weekly streak. Eat carbs + protein 1–2 h before and bring electrolytes.</p>
    <button class="btn ${d.cls ? 'ok' : 'primary'} wide" data-act="cls">${d.cls ? '✓ Class done — tap to undo' : 'Mark class done'}</button>
    <button class="btn ghost" data-act="choose">Lift instead</button></section>`;
}

function workoutPreview(w, sch, pw) {
  const bad = ui.badDay;
  const isSched = sch.type === 'lift' && sch.workout === w.id && !ui.choice;
  const slots = bad ? w.exercises.slice(0, PROGRESSION.badDayLifts) : w.exercises;
  const rows = slots.map((slot, i) => {
    const ex = exercise(slot.ex); const sg = suggest(slot, { deload: pw.deload });
    const sets = bad ? Math.min(PROGRESSION.badDaySets, sg.sets) : sg.sets;
    return `<li data-act="info" data-ex="${slot.ex}"><div class="exnum">${i + 1}</div><div class="grow"><b>${esc(ex.name)}</b>
      <small>${sets} × ${slot.reps[0]}–${slot.reps[1]}${slot.note ? ' ' + esc(slot.note) : ''} · ${sg.weight != null ? fmtW(sg.weight) : 'set your weight'}${sg.up ? ' <span class="up">▲</span>' : ''}</small></div><span class="chev">ⓘ</span></li>`;
  }).join('');
  return `<section class="card workout-card"><div class="eyebrow accent">${isSched ? 'Scheduled' : 'Selected'} workout</div>
    <div class="row between"><h2>${esc(w.name)}</h2><button class="link" data-act="choose">Change</button></div>
    <p class="muted">${slots.length} lifts · ${bad ? 2 : (pw.deload ? 2 : 3)} sets each · leave 2 reps in reserve</p>
    <ol class="exlist">${rows}</ol>
    <label class="toggle"><input type="checkbox" data-change="badDayPre" ${bad ? 'checked' : ''}><span></span>Bad day mode <small>(first 2 lifts, 2 sets each)</small></label>
    <button class="btn primary xl" data-act="precheck" data-w="${w.id}">Start ${esc(w.name)}</button></section>`;
}

function weighInCard() {
  const now = new Date();
  const today = ymd();
  if (now.getDay() !== BODYWEIGHT.weighInDay || state.bodyweight.some(b => b.date === today)) return '';
  const last = [...state.bodyweight].sort((a, b) => b.date.localeCompare(a.date))[0];
  return `<section class="card weigh"><div class="eyebrow accent">Monday weigh-in</div><h3>Morning weight — after bathroom, before food</h3>
    <div class="row"><input id="wiVal" aria-label="Monday weight in lb" class="inp big" type="number" inputmode="decimal" step="0.1" placeholder="${last ? last.lb : 255}"><span class="unit">lb</span>
    <button class="btn primary" data-act="weighIn">Save</button></div></section>`;
}

function checkInCard() {
  const now = new Date();
  // Monday card, or any day if opened from Progress — Today only auto-shows Monday
  if (now.getDay() !== 1) return '';
  const c = buildCheckIn(now);
  return `<section class="card checkin"><div class="eyebrow accent">Coach Dre check-in</div>
    <h3>Weekly summary ready</h3>
    <p class="muted sm">${c.from} → ${c.to} · ${c.meta.sessions}/${c.meta.planned} sessions · avg ${c.meta.avgBw != null ? c.meta.avgBw.toFixed(1) + ' lb' : '—'} · protein ${c.meta.avgP != null ? Math.round(c.meta.avgP) + ' g' : '—'}</p>
    <div class="quick"><button class="btn primary" data-act="checkIn">Open check-in</button><button class="btn" data-act="checkInCopy">Copy</button></div></section>`;
}
function backupReminderCard() {
  const n = needsBackupReminder(state.settings.lastBackupAt);
  if (!n.show) return '';
  const why = n.reason === 'sunday' ? 'Sunday backup day' : n.reason === 'never' ? 'No backup yet' : `${n.days}+ days since last backup`;
  return `<section class="card backup"><div class="eyebrow accent">Backup</div><h3>${why}</h3>
    <p class="muted sm">Save a JSON copy to your phone or pick <b>Drive</b> in the share sheet. Last backed up: <b>${esc(formatLastBackup(state.settings.lastBackupAt))}</b>.</p>
    <button class="btn primary wide" data-act="backupShare">Backup now</button></section>`;
}
function weekStrip() {
  const mon = mondayOf(new Date()); const days = trainingDays();
  let cells = '';
  for (let i = 0; i < 7; i++) {
    const dt = addDays(mon, i); const k = ymd(dt); const s = scheduleFor(dt);
    const tag = s.type === 'lift' ? (workoutById(s.workout)?.short || 'L') : s.type === 'steps' ? '👟' : s.type === 'class' ? '🥋' : '–';
    cells += `<div class="wd ${days.has(k) ? 'hit' : ''} ${k === ymd() ? 'today' : ''}"><span>${WD[dt.getDay()][0]}</span><b>${tag}</b></div>`;
  }
  const st = streak();
  return `<section class="card"><div class="row between"><h3>This week</h3><span class="chip">${st.thisWeek}/${st.target} days · 🔥 ${st.weeks} wk streak</span></div><div class="weekstrip">${cells}</div></section>`;
}

// ---- Active workout
function visible(a) {
  const exs = a.badDay ? a.exercises.slice(0, PROGRESSION.badDayLifts) : a.exercises;
  return exs.map(e => ({ e, sets: a.badDay ? e.sets.slice(0, PROGRESSION.badDaySets) : e.sets }));
}
function viewWorkout() {
  const a = state.active;
  let h = `<div class="safety" role="status"><span>⚠️ Dizzy? <b>Stop. Sit. Sip fluids.</b></span><button class="btn danger sm" data-act="dizzy">I feel dizzy</button></div>`;
  h += `<header class="hero tight"><div class="eyebrow">Week ${a.week}${a.deload ? ' · DELOAD' : ''} · RIR 2</div>
    <div class="row between"><h1>${esc(a.workoutName)}</h1><span class="clock" id="elapsed">0:00</span></div>
    <label class="toggle"><input type="checkbox" data-change="badDay" ${a.badDay ? 'checked' : ''}><span></span>Bad day <small>(2 lifts × 2 sets)</small></label></header>`;
  if (a.deload) h += `<div class="banner deload"><b>Deload:</b> 2 sets at ~90% weight. Smooth reps, no grinding.</div>`;
  if (a.paused) h += `<div class="banner danger"><b>Session paused</b> — dizziness logged. Only resume once fully recovered. <button class="btn sm" data-act="dizzyResume">Resume</button></div>`;
  visible(a).forEach(({ e, sets }, i) => {
    const ex = exercise(e.exId); const sg = e.suggestion;
    const rest = i === 0 ? state.settings.rest.first : state.settings.rest.other;
    const prev = lastSets(e.exId); const note = (state.exNotes || {})[e.exId];
    h += `<section class="card ex"><div class="row between top"><div><div class="eyebrow">Lift ${i + 1} · rest ${fmtSec(rest)}</div>
      <h2>${esc(ex.name)}</h2><div class="muted sm">${esc(ex.equipment)}${ex.perHand ? ' · weight per dumbbell' : ''}</div></div>
      <div class="exbtns"><button class="icon" data-act="info" data-ex="${e.exId}" aria-label="Form cues">ⓘ</button><button class="icon" data-act="exHist" data-ex="${e.exId}" aria-label="History">📈</button><button class="icon" data-act="swap" data-i="${i}" aria-label="Swap exercise">⇄</button></div></div>
      <div class="chips"><span class="chip accent">${e.reps[0]}–${e.reps[1]} reps${e.note ? ' ' + esc(e.note) : ''}</span><span class="chip">RIR 2</span></div>
      <button class="exnote ${note ? 'has' : ''}" data-act="exNote" data-ex="${e.exId}">📝 ${note ? esc(note) : 'Add setup note <small>(seat, pins, grip)</small>'}</button>
      <div class="suggest k-${sg.kind || 'reps'}" data-kind="${sg.kind || ''}"><span class="sg-ico">${KIND_ICON[sg.kind] || '→'}</span><span>${esc(sg.text)}${a.badDay && !a.deload ? ' <b>Bad day: 2 sets, not counted for progression.</b>' : ''}</span></div>
      ${sg.stall ? `<button class="btn ghost sm" data-act="swap" data-i="${i}">⇄ Swap variation instead</button>` : ''}
      ${sg.first ? '' : `<div class="targets"><span class="lbl">Today</span>${sets.map((s, j) => `<span class="tg ${s.done ? 'hit' : ''}">${fmtW0(sg.weights?.[j] ?? sg.weight)}×${sg.targets?.[j] ?? '—'}</span>`).join('')}</div>`}
      ${i === 0 ? warmRow(e, sets) : ''}
      <div class="sethead"><span>Set</span><span>Weight (lb${ex.perHand ? '/hand' : ''})</span><span>Reps</span><span></span></div>
      ${sets.map((s, j) => setRow(i, j, s, e, prev)).join('')}</section>`;
  });
  h += `<div class="finish"><button class="btn primary xl" data-act="finish">Finish workout</button><button class="btn ghost" data-act="discard">Discard</button></div>`;
  return h;
}
const KIND_ICON = { up: '▲', reps: '↗', hold: '＝', reduce: '▼', stall: '⟲', deload: '☾', first: '✎' };
const fmtW0 = w => (w == null || w === '' ? '—' : `${+(+w).toFixed(1)}`);
function warmRow(e, sets) {
  const ex = exercise(e.exId); const w = +sets[0]?.weight || +e.suggestion.weight || 0;
  const ws = warmups(ex, w, incFor(e.exId));
  if (!w) return `<div class="warm"><span class="lbl">Warm-up</span><span class="muted sm">Enter your working weight to see warm-up sets.</span></div>`;
  if (!ws.length) return '';
  return `<div class="warm"><span class="lbl">Warm-up · not logged</span>${ws.map(x => `<span class="wu">${fmtW0(x.w)}×${x.reps}<small>${x.label}</small></span>`).join('')}</div>`;
}
/** Sets from the most recent finished session of this lift (Strong/Hevy "Previous"). */
function lastSets(exId, notId = null) { const h = historyFor(exId).find(x => x.session.id !== notId); return h ? h.ex.sets : null; }
function prevLine(prev, j, s) {
  if (!prev || !prev.length) return '';
  const p = prev[j] || prev[prev.length - 1];
  const c = s.done ? compareSet(p, s) : null;
  return `<div class="prev"><span>Last time <b>${fmtW0(p.weight)}×${p.reps}</b>${p.rir != null ? ` @${p.rir === 3 ? '3+' : p.rir} RIR` : ''}</span>${c ? `<span class="cmp ${c.kind}">${esc(c.label)}</span>` : ''}</div>`;
}
function setRow(i, j, s, e, prev = null) {
  const inc = incFor(e.exId); const tgt = e.suggestion.targets?.[j];
  const ex = exercise(e.exId);
  const rir = s.done ? `<div class="rir" role="group" aria-label="Reps in reserve for set ${j + 1}"><span>Reps left?</span>${[0, 1, 2, 3].map(v => `<button class="${s.rir === v ? 'on' : ''} r${v}" data-act="rir" data-i="${i}" data-j="${j}" data-v="${v}" aria-label="${v === 3 ? '3 or more' : v} reps in reserve">${v === 3 ? '3+' : v}</button>`).join('')}</div>` : '';
  let plates = '';
  if (wantsPlates(ex) && s.weight !== '' && +s.weight > 0) {
    const bd = plateBreakdown(+s.weight, barFor(ex, state.settings));
    plates = `<div class="plates" aria-label="Plate breakdown">${esc(formatPlates(bd))}</div>`;
  }
  return `<div class="set ${s.done ? 'done' : ''} ${s.pr && s.pr.length ? 'pr' : ''}">
    <div class="setn">${j + 1}${tgt != null && !s.done ? `<small>→${tgt}</small>` : ''}${s.pr && s.pr.length ? '<small class="prb">PR</small>' : ''}</div>
    <div class="stepper"><button data-act="step" data-i="${i}" data-j="${j}" data-f="weight" data-d="-${inc}" aria-label="Weight minus ${inc}">−</button>
      <input data-input="set" data-i="${i}" data-j="${j}" data-f="weight" type="number" inputmode="decimal" step="any" value="${s.weight}" placeholder="lb" aria-label="Set ${j + 1} weight">
      <button data-act="step" data-i="${i}" data-j="${j}" data-f="weight" data-d="${inc}" aria-label="Weight plus ${inc}">+</button></div>
    <div class="stepper reps"><button data-act="step" data-i="${i}" data-j="${j}" data-f="reps" data-d="-1" aria-label="Reps minus 1">−</button>
      <input data-input="set" data-i="${i}" data-j="${j}" data-f="reps" type="number" inputmode="numeric" value="${s.reps}" placeholder="reps" aria-label="Set ${j + 1} reps">
      <button data-act="step" data-i="${i}" data-j="${j}" data-f="reps" data-d="1" aria-label="Reps plus 1">+</button></div>
    <button class="check" data-act="toggleSet" data-i="${i}" data-j="${j}" aria-label="Complete set ${j + 1}">✓</button></div>${prevLine(prev, j, s)}${plates}${rir}`;
}
const fmtSec = s => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;

// =========================================================== PROGRESS
function viewProgress() {
  const st = streak();
  let h = `<header class="hero"><h1>Progress</h1></header>`;
  h += `<section class="card streak"><div class="flame">🔥</div><div><div class="big">${st.weeks}-week streak</div><div class="muted">This week ${st.thisWeek}/${st.target} training days (lifts + classes)</div></div></section>
    <button class="btn wide" data-act="checkIn">📋 Weekly check-in for Coach Dre</button>`;
  h += `<section class="card"><div class="row between"><h3>Protein · last 7 days</h3><span class="chip">goal ${state.settings.targets.protein} g</span></div>${protein7(ymd())}</section>`;
  // bodyweight + smarter fat-loss
  const bw = [...state.bodyweight].sort((a, b) => a.date.localeCompare(b.date));
  const goal = state.settings.goalWeight;
  const first = bw[0], cur = bw[bw.length - 1];
  const series = bwChartSeries(bw);
  const rate = lossRate(bw);
  const proj = projectGoal(bw, goal);
  const drops = state.program.workouts.flatMap(w => w.exercises.map(x => x.ex))
    .map(id => { const st = exStats(id); if (st.pts.length < 2) return null; const f = st.pts[0], l = st.pts[st.pts.length - 1]; return { id, name: exercise(id).name, dE: +((l.e1rm - f.e1rm) / f.e1rm * 100).toFixed(1) }; })
    .filter(Boolean);
  const risk = muscleRiskFlag(bw, { strengthDrops: drops });
  let fatBits = '';
  if (rate) {
    fatBits += `<div class="stats four fatstats"><div><small>7-day avg</small><b>${rate.to.lb.toFixed(1)}</b></div>
      <div><small>lb / wk</small><b class="${rate.losing ? 'accent' : 'okc'}">${rate.losing ? '−' : '+'}${Math.abs(rate.lbPerWeek).toFixed(1)}</b></div>
      <div><small>% BW / wk</small><b class="${rate.pctPerWeek >= 1.5 ? 'accent' : ''}">${rate.losing ? '−' : '+'}${Math.abs(rate.pctPerWeek).toFixed(2)}%</b></div>
      <div><small>@ 200</small><b>${proj ? (proj.arrived ? 'There' : proj.date.slice(5)) : '—'}</b></div></div>`;
    if (proj && !proj.arrived) fatBits += `<p class="muted sm">At ~${Math.abs(rate.lbPerWeek).toFixed(1)} lb/wk, ~${proj.days} days to ${goal} lb (around <b>${proj.date}</b>). Trend uses your 7-day average — daily scale noise is ignored.</p>`;
  }
  if (risk) fatBits += `<div class="banner warn"><b>Gentle flag.</b> ${esc(risk.message)}</div>`;
  h += `<section class="card"><div class="row between"><h3>Bodyweight</h3><span class="chip">Goal ${goal} lb</span></div>
    <div class="stats"><div><small>Start</small><b>${first ? first.lb : '—'}</b></div><div><small>Current</small><b>${cur ? cur.lb : '—'}</b></div>
    <div><small>Lost</small><b class="accent">${first && cur ? (first.lb - cur.lb).toFixed(1) : '0'}</b></div><div><small>To go</small><b>${cur ? Math.max(0, cur.lb - goal).toFixed(1) : '—'}</b></div></div>
    ${fatBits}
    ${lineChart(series.raw, { goal, unit: ' lb', label: 'Bodyweight', overlay: series.ma, overlayColor: '#3aa0ff', overlayLabel: '7-day avg' })}
    <div class="row bwrow"><input id="bwDate" class="inp" type="date" aria-label="Weigh-in date" value="${ymd()}"><input id="bwVal" class="inp" aria-label="Weight in lb" type="number" inputmode="decimal" step="0.1" placeholder="lb"><button class="btn primary" data-act="addBw">Add</button></div>
    <ul class="mini">${bw.slice(-6).reverse().map(b => `<li><span>${b.date}${b.source === 'renpho' ? ' <span class="chip sm">Renpho</span>' : ''}</span><b>${b.lb} lb${b.bf != null ? ` · ${b.bf}%` : ''}</b><button class="link" data-act="delBw" data-d="${b.date}" aria-label="Delete ${b.date}">✕</button></li>`).join('')}</ul>
    <button class="btn ghost wide" data-act="renphoPick">⇪ Import from Renpho (CSV)</button></section>`;
  h += expenditureCard();
  h += bodyCompCard(bw);
  // strength + relative strength
  const used = new Set(doneSessions().flatMap(s => s.exercises.map(e => e.exId)));
  const prog = state.program.workouts.flatMap(w => w.exercises.map(x => x.ex));
  const opts = [...new Set([...prog, ...used])];
  if (!ui.progEx || !opts.includes(ui.progEx)) ui.progEx = opts.find(id => used.has(id)) || opts[0];
  const xs = exStats(ui.progEx);
  const pts = xs.pts.map(p => ({ x: p.t, y: ui.metric === 'e1rm' ? Math.round(p.e1rm) : ui.metric === 'top' ? p.top : p.rel != null ? +p.rel.toFixed(3) : null })).filter(p => p.y != null);
  const best = pts.length ? Math.max(...pts.map(p => p.y)) : null;
  h += `<section class="card"><div class="row between"><h3>Strength</h3><button class="link" data-act="exHist" data-ex="${ui.progEx}">History &amp; PRs ›</button></div>
    <select class="inp" data-change="progEx" aria-label="Exercise">${opts.map(id => `<option value="${id}" ${id === ui.progEx ? 'selected' : ''}>${esc(exercise(id).name)}${used.has(id) ? '' : ' (no data)'}</option>`).join('')}</select>
    <div class="seg"><button class="${ui.metric === 'e1rm' ? 'on' : ''}" data-act="metric" data-m="e1rm">Est. 1RM</button><button class="${ui.metric === 'top' ? 'on' : ''}" data-act="metric" data-m="top">Top set</button><button class="${ui.metric === 'rel' ? 'on' : ''}" data-act="metric" data-m="rel">× BW</button></div>
    ${best != null ? `<div class="muted sm">Best ${ui.metric === 'e1rm' ? 'est. 1RM' : ui.metric === 'top' ? 'top set' : 'relative strength'}: <b class="accent">${ui.metric === 'rel' ? best.toFixed(2) + '× BW' : best + ' lb'}</b> · ${pts.length} session${pts.length > 1 ? 's' : ''}</div>` : ''}
    ${lineChart(pts, { unit: ui.metric === 'rel' ? '×' : ' lb', label: 'Strength' })}</section>`;
  h += cutStrengthCard();
  h += calendar();
  // history
  const ss = doneSessions().sort((a, b) => b.start.localeCompare(a.start)).slice(0, 12);
  h += `<section class="card"><h3>Recent sessions</h3>${ss.length ? `<ul class="hist">${ss.map(s => `<li><div><b>${esc(s.workoutName)}</b>${s.badDay ? ' <span class="chip sm">bad day</span>' : ''}${s.deload ? ' <span class="chip sm warn">deload</span>' : ''}${s.dizzy ? ' <span class="chip sm danger">dizzy</span>' : ''}
    <small>${s.date} · ${s.exercises.reduce((a, e) => a + e.sets.length, 0)} sets · ${Math.round((new Date(s.end) - new Date(s.start)) / 60000)} min</small></div><button class="link" data-act="delSession" data-id="${s.id}">✕</button></li>`).join('')}</ul>` : '<p class="muted">No sessions yet.</p>'}</section>`;
  return h;
}

function expenditureCard() {
  const x = estimateExpenditure({ bodyweight: state.bodyweight, daily: state.daily, targets: state.settings.targets });
  if (!x.ok) return `<section class="card energy"><div class="row between"><h3>Energy burn estimate</h3><span class="chip">learning</span></div>
    <p class="muted sm">Like MacroFactor: Rep works out what you actually burn from your food log + weight trend. Needs ${esc(x.need.join(' and '))} in the last ${x.days} days (${x.loggedDays} full food days, ${x.weighIns} weigh-ins so far).</p></section>`;
  const t = state.settings.targets.kcal;
  return `<section class="card energy"><div class="row between"><h3>Energy burn estimate</h3><span class="chip ${x.confidence === 'low' ? 'warn' : 'ok'}">${x.confidence} confidence</span></div>
    <div class="stats"><div><small>You burn ~</small><b class="accent">${fmtNum(x.expenditure)}</b></div><div><small>You eat ~</small><b>${fmtNum(x.avgIntake)}</b></div><div><small>Target</small><b>${fmtNum(t)}</b></div></div>
    <div class="suggest k-${x.advice.kind === 'ok' ? 'up' : 'hold'}"><span class="sg-ico">${x.advice.kind === 'ok' ? '✓' : x.advice.kind === 'fast' ? '!' : '?'}</span><span>${esc(x.advice.text)}</span></div>
    <p class="muted sm">kcal/day · last ${x.days} days (${x.loggedDays} food days, ${x.weighIns} weigh-ins). Suggestion only — Coach Dre sets your targets. Early cut weeks include water weight.</p></section>`;
}

function bodyCompCard(bw) {
  const bc = bw.filter(b => b.bf != null);
  const head = `<section class="card"><div class="row between"><h3>Body composition</h3><span class="chip">lean = weight × (1 − BF%)</span></div>`;
  if (!bc.length) return head + `<p class="muted sm">Import your Renpho history to track lean mass vs fat while cutting.</p><button class="btn ghost" data-act="renphoPick">⇪ Import Renpho CSV</button></section>`;
  const f = bc[0], l = bc[bc.length - 1];
  const lf = leanMass(f), ll = leanMass(l), ff = +(f.lb - lf).toFixed(1), fl = +(l.lb - ll).toFixed(1);
  const dLean = +(ll - lf).toFixed(1), dFat = +(fl - ff).toFixed(1), lost = f.lb - l.lb;
  const pctLean = lost > 0 ? Math.max(0, Math.round((-dLean / lost) * 100)) : null;
  return head + `<div class="stats four"><div><small>Body fat</small><b>${l.bf}%</b></div><div><small>Lean</small><b>${ll}</b></div><div><small>Fat</small><b>${fl}</b></div><div><small>${l.muscleLb != null ? 'Muscle' : 'Weigh-ins'}</small><b>${l.muscleLb != null ? l.muscleLb : bc.length}</b></div></div>
    ${lineChart(bc.map(b => ({ x: parseYmd(b.date).getTime(), y: leanMass(b) })), { unit: ' lb', label: 'Lean mass', color: '#30d158' })}
    <p class="muted sm">Since ${f.date}: fat <b class="${dFat <= 0 ? 'okc' : 'accent'}">${dFat > 0 ? '+' : ''}${dFat} lb</b>, lean <b class="${dLean >= -0.5 ? 'okc' : 'accent'}">${dLean > 0 ? '+' : ''}${dLean} lb</b>${pctLean != null && bc.length > 1 ? ` · ${pctLean}% of weight lost came from lean mass${pctLean <= 25 ? ' — good muscle retention' : ' — prioritize protein + lifting'}` : ''}. Scale body-fat readings are estimates; watch the trend, not single days.</p></section>`;
}

function renphoSheet() {
  const R = ui.renpho; const p = parseRenpho(R.text, { unit: R.unit || undefined });
  if (!p.ok) return sheet(`<div class="eyebrow accent">Import from Renpho</div><h2>Couldn't read that file</h2><p class="muted">${esc(p.error)}</p>
    <p class="muted sm">In the Renpho app, use its data export option and save the CSV, then choose it here.</p><button class="btn ghost wide" data-act="closeSheet">Close</button>`);
  const have = new Set(state.bodyweight.map(b => b.date)); const conflicts = p.rows.filter(r => have.has(r.date)).length;
  const sample = p.rows.length > 6 ? [...p.rows.slice(0, 3), null, ...p.rows.slice(-3)] : p.rows;
  const hasComp = p.rows.some(r => r.bf != null || r.muscleLb != null);
  sheet(`<div class="eyebrow accent">Import from Renpho</div><h2>${p.rows.length} day${p.rows.length > 1 ? 's' : ''} found</h2>
    <p class="muted sm">${esc(R.name)} · ${p.from} → ${p.to} · ${p.total} rows${p.dupes ? `, ${p.dupes} extra same-day readings (kept earliest)` : ''}${p.skipped ? `, ${p.skipped} unreadable skipped` : ''}</p>
    <div class="frow"><label>Weight unit <small class="muted">(${esc(p.unitSource)})</small></label><div class="seg sm"><button class="${p.unit === 'lb' ? 'on' : ''}" data-act="renphoUnit" data-u="lb">lb</button><button class="${p.unit === 'kg' ? 'on' : ''}" data-act="renphoUnit" data-u="kg">kg</button></div></div>
    <p class="muted sm">Columns: date “${esc(p.columns.date)}”, weight “${esc(p.columns.weight)}”${p.columns.bodyFat ? `, body fat “${esc(p.columns.bodyFat)}”` : ''}${p.columns.muscle ? `, muscle “${esc(p.columns.muscle)}”` : ''}.</p>
    <table class="ptable"><thead><tr><th>Date</th><th>Weight</th><th>BF %</th><th>Muscle</th></tr></thead><tbody>
    ${sample.map(r => r ? `<tr><td>${r.date}</td><td>${r.lb} lb</td><td>${r.bf ?? '—'}</td><td>${r.muscleLb != null ? r.muscleLb + ' lb' : '—'}</td></tr>` : '<tr><td colspan="4" class="muted">…</td></tr>').join('')}</tbody></table>
    ${hasComp ? `<label class="toggle"><input type="checkbox" data-change="renphoComp" ${R.comp ? 'checked' : ''}><span></span>Also import body fat % &amp; muscle mass</label>` : ''}
    ${conflicts ? `<p class="muted sm"><b>${conflicts}</b> day${conflicts > 1 ? 's' : ''} already have a weigh-in:</p><div class="seg"><button class="${R.mode === 'keep' ? 'on' : ''}" data-act="renphoMode" data-m="keep">Keep mine</button><button class="${R.mode === 'overwrite' ? 'on' : ''}" data-act="renphoMode" data-m="overwrite">Use Renpho</button></div>` : ''}
    <button class="btn primary xl" data-act="renphoImport">Import ${p.rows.length} day${p.rows.length > 1 ? 's' : ''}</button><button class="btn ghost wide" data-act="closeSheet">Cancel</button>`);
}

function cutStrengthCard() {
  const ids = [...new Set(state.program.workouts.flatMap(w => w.exercises.map(x => x.ex)))];
  const rows = ids.map(id => ({ id, st: exStats(id) })).filter(r => r.st.pts.length >= 2);
  const bw = [...state.bodyweight].sort((a, b) => a.date.localeCompare(b.date));
  const head = `<section class="card"><div class="row between"><h3>Strength on the cut</h3><span class="chip">e1RM ÷ bodyweight</span></div>
    <p class="muted sm">Holding your lifts while the scale drops is a win — relative strength (est. 1RM ÷ bodyweight) should climb.</p>`;
  if (!rows.length) return head + '<p class="muted">Log a lift twice to see the trend.</p></section>';
  let wins = 0;
  const lis = rows.map(({ id, st }) => {
    const f = st.pts[0], l = st.pts[st.pts.length - 1];
    const dE = (l.e1rm - f.e1rm) / f.e1rm * 100; const dR = f.rel && l.rel ? (l.rel - f.rel) / f.rel * 100 : null;
    if (dE > -2 && dR != null && dR >= 0) wins++;
    return `<li data-act="exHist" data-ex="${id}"><span class="grow"><b>${esc(exercise(id).name)}</b><small>${Math.round(f.e1rm)} → ${Math.round(l.e1rm)} lb e1RM</small></span>
      <span class="rel"><b>${l.rel ? l.rel.toFixed(2) : '—'}×</b><small class="${dR >= 0 ? 'okc' : 'accent'}">${dR == null ? '' : (dR >= 0 ? '+' : '') + dR.toFixed(1) + '%'}</small></span></li>`;
  }).join('');
  const lost = bw.length > 1 ? bw[0].lb - bw[bw.length - 1].lb : 0;
  return head + `${lost > 0 ? `<div class="banner win">💪 Down <b>${lost.toFixed(1)} lb</b> and ${wins}/${rows.length} lifts held or gained relative strength.</div>` : ''}<ul class="cutlist">${lis}</ul></section>`;
}

function calendar() {
  const m = ui.calMonth; const y = m.getFullYear(), mo = m.getMonth();
  const first = new Date(y, mo, 1); const start = mondayOf(first);
  const days = trainingDays();
  const lifts = new Set(doneSessions().map(s => s.date));
  const dizzy = new Set([...state.dizzyEvents.map(e => ymd(new Date(e.ts))), ...Object.entries(state.daily).filter(([, v]) => v.dizzy === true).map(([k]) => k)]);
  let cells = '';
  for (let i = 0; i < 42; i++) {
    const d = addDays(start, i); const k = ymd(d);
    if (i >= 35 && d.getMonth() !== mo) break;
    const cls = [d.getMonth() !== mo ? 'out' : '', lifts.has(k) ? 'lift' : days.has(k) ? 'cls' : '', k === ymd() ? 'today' : ''].join(' ');
    cells += d.getMonth() !== mo ? '<div class="cd out" aria-hidden="true"></div>' : `<div class="cd ${cls}" aria-label="${k}${lifts.has(k) ? ' lift' : days.has(k) ? ' class' : ''}${dizzy.has(k) ? ' dizzy' : ''}">${d.getDate()}${dizzy.has(k) ? '<i class="dz"></i>' : ''}</div>`;
  }
  return `<section class="card"><div class="row between"><button class="icon" data-act="cal" data-n="-1">‹</button><h3>${m.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h3><button class="icon" data-act="cal" data-n="1">›</button></div>
    <div class="cal"><span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span><span>S</span>${cells}</div>
    <div class="legend"><span><i class="lg lift"></i>Lift</span><span><i class="lg cls"></i>Class</span><span><i class="lg dzl"></i>Dizzy</span></div></section>`;
}

// =========================================================== RECOVERY
function viewRecovery() {
  const rec = recovery();
  const color = m => recColor(rec[m] ? rec[m].pct : null);
  let h = `<header class="hero"><h1>Recovery</h1><div class="muted">Based on muscles trained and hours since (≈48 h small/secondary, 72 h big compound).</div></header>
    <section class="card bodies">${bodySvg('front', color)}${bodySvg('back', color)}
    <div class="legend"><span><i class="lg" style="background:#ff3b30"></i>Fatigued</span><span><i class="lg" style="background:#ff8a00"></i>Recovering</span><span><i class="lg" style="background:#ffd60a"></i>Almost</span><span><i class="lg" style="background:#30d158"></i>Fresh</span></div></section>`;
  const nxt = upcomingWorkout();
  if (nxt) {
    const ms = [...new Set(nxt.exercises.flatMap(x => exercise(x.ex).primary))];
    const avg = ms.reduce((a, m) => a + (rec[m] ? rec[m].pct : 1), 0) / (ms.length || 1);
    h += `<section class="card"><div class="row between"><h3>Next: ${esc(nxt.name)}</h3><span class="chip ${avg >= 0.9 ? 'ok' : 'warn'}">${Math.round(avg * 100)}% ready</span></div>
      <div class="muted sm">Targets: ${ms.map(m => MUSCLES[m]).join(', ')}</div></section>`;
  }
  h += weeklySetsCard();
  const rows = Object.keys(MUSCLES).map(m => ({ m, r: rec[m] })).sort((a, b) => (a.r ? a.r.pct : 2) - (b.r ? b.r.pct : 2));
  h += `<section class="card"><h3>Muscles</h3><ul class="reclist">${rows.map(({ m, r }) => `<li><span class="dot" style="background:${recColor(r ? r.pct : null)}"></span><span class="grow">${MUSCLES[m]}</span>
    <small>${r ? `${Math.round(r.hours)} h ago` : 'not trained recently'}</small><b>${r ? Math.round(r.pct * 100) : 100}%</b></li>`).join('')}</ul></section>`;
  return h;
}

function weeklySetsCard() {
  const mon = mondayOf(new Date()); const from = ymd(mon), to = ymd(addDays(mon, 6));
  const lastFrom = ymd(addDays(mon, -7)), lastTo = ymd(addDays(mon, -1));
  const rows = volumeRows(setsPerMuscle(doneSessions(), from, to), plannedPerMuscle(state.program), setsPerMuscle(doneSessions(), lastFrom, lastTo));
  const f = n => (n % 1 ? n.toFixed(1) : String(n));
  return `<section class="card wsets"><div class="row between"><h3>Sets per muscle · this week</h3><span class="chip">Mon–Sun</span></div>
    <p class="muted sm">Working sets done vs Coach Dre's full week (secondary muscles count ½).</p>
    <ul class="vlist">${rows.map(r => `<li><span class="vname">${esc(r.name)}</span><span class="vbar"><i style="width:${r.planned ? Math.min(100, r.done / r.planned * 100) : 0}%"></i></span><b>${f(r.done)}<small>/${f(r.planned)}</small></b><small class="vlast">last wk ${f(r.last)}</small></li>`).join('')}</ul></section>`;
}

function upcomingWorkout() {
  const doneToday = new Set(doneSessions().filter(x => x.date === ymd()).map(x => x.workoutId));
  for (let i = 0; i < 7; i++) {
    const sc = scheduleFor(addDays(new Date(), i));
    if (sc.type === 'lift' && !(i === 0 && doneToday.has(sc.workout))) return workoutById(sc.workout);
  }
  return nextInRotation();
}

// =========================================================== DAILY
function viewDaily() {
  const k = ui.dailyDate; const d = day(k); const t = state.settings.targets;
  const dt = parseYmd(k); const sch = scheduleFor(dt);
  const isToday = k === ymd();
  let h = `<header class="hero"><div class="row between"><button class="icon" data-act="dday" data-n="-1">‹</button>
    <div class="center"><div class="eyebrow">${isToday ? 'Today' : WD_LONG[dt.getDay()]}</div><h1>${dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</h1></div>
    <button class="icon" data-act="dday" data-n="1" ${isToday ? 'disabled' : ''}>›</button></div></header>`;
  syncDay(d);
  h += foodDayCard(k, d, t);
  h += proteinHero(k, d, t);
  h += `<section class="card"><div class="row between"><h3>Protein · last 7 days</h3><span class="muted sm">goal ${t.protein} g</span></div>${protein7(k)}</section>`;
  h += suppCard(k, d);
  h += injectionCard(false);
  h += `<section class="card targets"><div class="eyebrow accent">Coach Dre targets</div><div class="macros">
    <div><b>${fmtNum(t.kcal)}</b><small>kcal</small></div><div><b>${t.protein}g</b><small>protein</small></div><div><b>~${t.fat}g</b><small>fat</small></div><div><b>~${t.carbs}g</b><small>carbs</small></div></div>
    <p class="muted sm">Protein first at every meal to hold onto muscle. If appetite is low on tirzepatide, use shakes / Greek yogurt and smaller, more frequent meals.</p></section>`;
  h += `<section class="card"><div class="row between"><h3>Water</h3><span class="muted">${d.waterOz} / ${t.waterOz} oz · ${Math.round(d.waterOz / 8)} glasses</span></div>${bar(d.waterOz, t.waterOz, '#3aa0ff')}
    <div class="quick"><button class="btn" data-act="addW" data-n="8">+8 oz</button><button class="btn" data-act="addW" data-n="16">+16 oz</button><button class="btn" data-act="addW" data-n="24">+24 oz</button><button class="btn ghost sm" data-act="addW" data-n="-8">−8</button></div></section>`;
  h += `<section class="card"><div class="row between"><h3>Steps</h3><span class="muted">${sch.type === 'steps' ? `Steps day · ${fmtNum(t.stepsMin)}–${fmtNum(t.stepsMax)}` : `goal ${fmtNum(t.steps)}`}</span></div>${bar(d.steps, t.steps, '#30d158')}
    <div class="quick"><input class="inp" type="number" inputmode="numeric" data-change="setSteps" value="${d.steps}" aria-label="Steps"><button class="btn" data-act="steps" data-n="1000">+1k</button><button class="btn" data-act="steps" data-n="2500">+2.5k</button></div></section>`;
  h += `<section class="card"><div class="row between"><h3>Sleep</h3><span class="muted">hours last night</span></div>
    <div class="stepper big"><button data-act="sleep" data-n="-0.5" aria-label="Sleep minus half hour">−</button><input type="number" inputmode="decimal" step="0.5" data-change="setSleep" aria-label="Sleep hours" value="${d.sleep ?? ''}" placeholder="—"><button data-act="sleep" data-n="0.5" aria-label="Sleep plus half hour">+</button></div></section>`;
  h += `<section class="card"><h3>Dizziness today?</h3><div class="seg"><button class="${d.dizzy === false ? 'on' : ''}" data-act="dz" data-v="no">No</button><button class="${d.dizzy === true ? 'on danger' : ''}" data-act="dz" data-v="yes">Yes</button></div>
    ${d.dizzy ? `<textarea class="inp" data-change="dzNote" aria-label="Dizziness note" rows="2" placeholder="When? What were you doing? Had you eaten?">${esc(d.dizzyNote)}</textarea>
    <p class="muted sm">If dizziness keeps happening, tell your prescriber/doctor. Fainting, chest pain, or confusion → call 911.</p>` : ''}</section>`;
  return h;
}

function fmtTime(ts) { return ts ? new Date(ts).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : '—'; }
function shortDate(dt) { return dt.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }); }


function syncDay(d) {
  if (!d) return;
  if (!Array.isArray(d.foodLog)) d.foodLog = [];
  if (!Array.isArray(d.proteinLog)) d.proteinLog = [];
  if (!d.foodLog.length) {
    const ids = new Set();
    for (const e of d.proteinLog) {
      if (!e?.id || ids.has(e.id) || e.fromFood || !(+e.g > 0)) continue;
      d.foodLog.push({
        id: e.id, ts: e.ts, meal: 'snacks', name: e.label || 'Protein',
        qty: 1, grams: 0, servingGrams: 0, servingLabel: `+${e.g} g`,
        kcal: Math.round((+e.g || 0) * 4), protein: +e.g || 0, fat: 0, carbs: 0,
        source: 'quick',
      });
      ids.add(e.id);
    }
    const usedK = d.foodLog.reduce((acc, e) => acc + (+e.kcal || 0), 0);
    const leftoverK = Math.max(0, Math.round((+d.kcal || 0) - usedK));
    if (leftoverK > 0) {
      d.foodLog.push({
        id: uid(), ts: null, meal: 'snacks', name: 'Logged calories',
        qty: 1, grams: 0, servingGrams: 0, servingLabel: `+${leftoverK} kcal`,
        kcal: leftoverK, protein: 0, fat: 0, carbs: 0, source: 'quick',
      });
    }
  }
  d.proteinLog = proteinEntriesFromFood(d);
  applySyncedTotals(d);
}
function addFoodEntry(d, entry) {
  if (!Array.isArray(d.foodLog)) d.foodLog = [];
  d.foodLog.push(entry);
  if (entry.source !== 'quick') state.recentFoods = rememberRecent(state.recentFoods, entry);
  syncDay(d);
}
function fmtQty(e) {
  if (e.grams && e.servingGrams && Math.abs(e.grams - e.servingGrams) > 0.5) return `${e.grams} g`;
  if (e.qty && e.qty !== 1) return `${e.qty} × ${e.servingLabel || 'serving'}`;
  return e.servingLabel || `${e.grams || ''} g`;
}
function foodDayCard(k, d, t) {
  const tot = syncedTotals(d);
  const rem = remaining(tot, t);
  const cell = (lbl, have, goal, left, unit) => `<div><small>${lbl}</small><b>${have}${unit}</b><span class="muted sm ${left < 0 ? 'accent' : ''}">${left < 0 ? `${Math.abs(Math.round(left))}${unit} over` : `${Math.round(left)}${unit} left`}</span></div>`;
  let h = `<section class="card food-day"><div class="row between"><div><div class="eyebrow accent">Food</div><h2>${fmtNum(tot.kcal)} / ${fmtNum(t.kcal)} kcal</h2></div><span class="chip">${tot.n} item${tot.n === 1 ? '' : 's'}</span></div>
    <div class="macros rem">${cell('Calories', tot.kcal, t.kcal, rem.kcal, '')}${cell('Protein', Math.round(tot.protein), t.protein, rem.protein, ' g')}${cell('Fat', Math.round(tot.fat), t.fat, rem.fat, ' g')}${cell('Carbs', Math.round(tot.carbs), t.carbs, rem.carbs, ' g')}</div>
    <div class="quick"><button class="btn" data-act="foodCopyY">Copy yesterday</button><button class="btn" data-act="foodQuick">Quick add</button><button class="btn ghost" data-act="foodMeals">Saved meals</button></div>
    <div class="quick"><button class="btn sm" data-act="addK" data-n="100">+100</button><button class="btn sm" data-act="addK" data-n="250">+250</button><button class="btn sm" data-act="addK" data-n="500">+500</button></div>`;
  for (const [id, label] of MEALS) {
    const items = (d.foodLog || []).filter(e => e.meal === id);
    const mt = totals(items);
    h += `<div class="meal" data-meal="${id}"><div class="row between"><h3>${label}</h3><small class="muted">${items.length ? `${mt.kcal} kcal · P ${Math.round(mt.protein)}` : ''}</small></div>
      <ul class="flog">${items.map(foodRow).join('')}</ul>
      <button class="btn ghost wide" data-act="foodSearch" data-meal="${id}">+ Add</button></div>`;
  }
  return h + '</section>';
}
function foodRow(e) {
  const fav = isFavorite(state.favorites, e);
  return `<li class="food-entry swipe" data-swipe="delFood" data-id="${e.id}"><button class="grow food-main" data-act="foodEdit" data-id="${e.id}"><b>${esc(e.name)}</b><small>${fmtQty(e)} · ${e.kcal} kcal · P ${Math.round(e.protein)}</small></button>
    <button class="icon ${fav ? 'on' : ''}" data-act="foodFav" data-id="${e.id}" aria-label="${fav ? 'Unfavorite' : 'Favorite'}">★</button>
    <button class="del" data-act="delFood" data-id="${e.id}" data-act-alias="delP" aria-label="Delete entry">✕</button></li>`;
}

function foodItem(f, meal) {
  const id = f.id || f.foodId || '';
  return `<li data-act="foodPick" data-id="${esc(id)}" data-meal="${meal}" data-src="${esc(f.source || 'builtin')}"><b>${esc(f.name)}</b><small>${esc(f.servingLabel || '')} · ${Math.round(f.kcal)} kcal · P ${Math.round(f.protein)}</small></li>`;
}

async function foodSearchSheet(meal, { q = '', results = null, needsSignal = false, searching = false } = {}) {
  ui.food = { ...(ui.food || {}), meal, q, results, needsSignal, searching };
  const rec = state.recentFoods || [];
  const fav = state.favorites || [];
  const builtinBlock = (results && q) ? [] : null;
  let list = '';
  if (searching) list = '<p class="muted">Searching…</p>';
  else if (results) {
    if (needsSignal) list += `<div class="banner warn">Needs signal — showing foods on this phone.</div>`;
    list += results.length ? `<ul class="picker food-pick">${results.map(f => foodItem(f, meal)).join('')}</ul>` : '<p class="muted">No matches. Try a shorter name, or log it manually.</p>';
  } else {
    if (fav.length) list += `<h3>Favorites</h3><ul class="picker food-pick">${fav.map(f => foodItem(f, meal)).join('')}</ul>`;
    if (rec.length) list += `<h3>Recents</h3><ul class="picker food-pick">${rec.map(f => foodItem(f, meal)).join('')}</ul>`;
    list += `<h3>Common foods</h3><ul class="picker food-pick">${BUILTIN_FOODS.map(f => foodItem(f, meal)).join('')}</ul>`;
  }
  const pool = [...(results || []), ...(state.recentFoods || []), ...(state.favorites || []), ...BUILTIN_FOODS];
  ui.foodIndex = Object.fromEntries(pool.map(f => [f.id || f.foodId, f]));
  const mealLabel = (MEALS.find(([id]) => id === meal) || [meal, 'Meal'])[1];
  sheet(`<div class="eyebrow accent">Add food</div><h2>${esc(mealLabel)}</h2>
    <div class="row gap"><input id="foodQ" class="inp grow" type="search" placeholder="Search foods" value="${esc(q)}" aria-label="Search foods" enterkeyhint="search">
      <button class="btn primary" data-act="foodDoSearch">Search</button></div>
    <div class="quick"><button class="btn" data-act="foodScan" data-meal="${meal}">Scan barcode</button><button class="btn ghost" data-act="foodManual" data-meal="${meal}">Manual entry</button></div>
    ${list}
    <button class="btn ghost wide" data-act="closeSheet">Close</button>`);
  const inp = $('#foodQ');
  if (inp) {
    inp.focus();
    inp.setSelectionRange?.(q.length, q.length);
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); actions.foodDoSearch(); } });
  }
}

function foodPickFromUi(id, src) {
  const pool = [...(ui.food?.results || []), ...(state.recentFoods || []), ...(state.favorites || [])];
  let f = pool.find(x => (x.id || x.foodId) === id);
  if (!f) f = BUILTIN_BY_ID[id];
  return f;
}

function foodEntrySheet(meal, food, { existing = null } = {}) {
  const base = existing
    ? { ...food, servingGrams: existing.servingGrams, servingLabel: existing.servingLabel, kcal: (existing.kcal / (existing.grams || 1)) * (existing.servingGrams || 100), protein: (existing.protein / (existing.grams || 1)) * (existing.servingGrams || 100), fat: (existing.fat / (existing.grams || 1)) * (existing.servingGrams || 100), carbs: (existing.carbs / (existing.grams || 1)) * (existing.servingGrams || 100), name: existing.name, foodId: existing.foodId, source: existing.source, barcode: existing.barcode, id: food?.id }
    : food;
  const grams0 = existing ? existing.grams : (base.servingGrams || 100);
  const qty0 = existing ? existing.qty : 1;
  ui.foodPick = { meal, food: base, existing };
  const scaled = () => scaleFood(base, { grams: parseFloat($('#fGrams')?.value) || grams0 });
  sheet(`<div class="eyebrow accent">${existing ? 'Edit food' : 'Log food'}</div><h2>${esc(base.name)}</h2>
    <p class="muted sm">${esc(base.servingLabel || '')}${base.barcode ? ` · ${esc(base.barcode)}` : ''}${base.source && base.source !== 'builtin' ? ` · ${esc(base.source === 'off' ? 'Open Food Facts' : base.source === 'usda' ? 'USDA' : base.source)}` : ''}</p>
    <div class="frow"><label>Meal</label><select id="fMeal" class="inp" aria-label="Meal">${MEALS.map(([id, l]) => `<option value="${id}" ${id === meal ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
    <div class="frow"><label>Servings</label><input id="fQty" class="inp num" type="number" inputmode="decimal" step="any" min="0" value="${qty0}" aria-label="Servings"></div>
    <div class="frow"><label>Grams</label><input id="fGrams" class="inp num" type="number" inputmode="decimal" step="any" min="0" value="${grams0}" aria-label="Grams"><span class="unit">g</span></div>
    <div class="macros rem" id="fPreview"></div>
    <button class="btn primary xl" data-act="foodLog">${existing ? 'Save' : 'Log food'}</button>
    <button class="btn ghost wide" data-act="foodFavPick">${isFavorite(state.favorites, base) ? 'Remove favorite' : 'Save favorite'}</button>
    ${existing ? '<button class="btn danger wide" data-act="delFood" data-id="' + existing.id + '">Delete</button>' : ''}
    <button class="btn ghost wide" data-act="closeSheet">Cancel</button>`);
  const prev = () => {
    const el = $('#fPreview'); if (!el) return;
    const s = scaleFood(base, { grams: parseFloat($('#fGrams')?.value) || 0 });
    el.innerHTML = `<div><small>kcal</small><b>${s.kcal}</b></div><div><small>P</small><b>${s.protein} g</b></div><div><small>F</small><b>${s.fat} g</b></div><div><small>C</small><b>${s.carbs} g</b></div>`;
  };
  const syncQty = from => {
    const sg = base.servingGrams || 100;
    if (from === 'qty') { const q = parseFloat($('#fQty').value); if (q >= 0) $('#fGrams').value = +(q * sg).toFixed(1); }
    else { const g = parseFloat($('#fGrams').value); if (g >= 0) $('#fQty').value = +(g / sg).toFixed(2); }
    prev();
  };
  $('#fQty')?.addEventListener('input', () => syncQty('qty'));
  $('#fGrams')?.addEventListener('input', () => syncQty('grams'));
  prev();
}

function foodQuickSheet() {
  sheet(`<div class="eyebrow accent">Quick add</div><h2>Calories &amp; macros</h2>
    <p class="muted sm">Log a chunk without a food name. Lands in Snacks.</p>
    <div class="frow"><label>Calories</label><input id="qKcal" class="inp num" type="number" inputmode="numeric" value="" placeholder="0" aria-label="Calories"></div>
    <div class="frow"><label>Protein (g)</label><input id="qP" class="inp num" type="number" inputmode="decimal" value="" placeholder="0" aria-label="Protein"></div>
    <div class="frow"><label>Fat (g)</label><input id="qF" class="inp num" type="number" inputmode="decimal" value="" placeholder="0" aria-label="Fat"></div>
    <div class="frow"><label>Carbs (g)</label><input id="qC" class="inp num" type="number" inputmode="decimal" value="" placeholder="0" aria-label="Carbs"></div>
    <input id="qName" class="inp" type="text" placeholder="Label (optional)" aria-label="Label" style="margin-top:8px">
    <button class="btn primary xl" data-act="foodQuickLog">Add</button>
    <button class="btn ghost wide" data-act="closeSheet">Cancel</button>`);
}

function foodManualSheet(meal) {
  sheet(`<div class="eyebrow accent">Manual entry</div><h2>Log a food</h2>
    <input id="mName" class="inp" type="text" placeholder="Food name" aria-label="Food name">
    <div class="frow"><label>Meal</label><select id="mMeal" class="inp">${MEALS.map(([id, l]) => `<option value="${id}" ${id === meal ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
    <div class="frow"><label>Grams</label><input id="mGrams" class="inp num" type="number" inputmode="decimal" value="100" aria-label="Grams"><span class="unit">g</span></div>
    <div class="frow"><label>Calories</label><input id="mKcal" class="inp num" type="number" inputmode="numeric" aria-label="Calories"></div>
    <div class="frow"><label>Protein (g)</label><input id="mP" class="inp num" type="number" inputmode="decimal" aria-label="Protein"></div>
    <div class="frow"><label>Fat (g)</label><input id="mF" class="inp num" type="number" inputmode="decimal" aria-label="Fat"></div>
    <div class="frow"><label>Carbs (g)</label><input id="mC" class="inp num" type="number" inputmode="decimal" aria-label="Carbs"></div>
    <button class="btn primary xl" data-act="foodManualLog">Log food</button>
    <button class="btn ghost wide" data-act="closeSheet">Cancel</button>`);
}

function foodMealsSheet() {
  const meals = state.savedMeals || [];
  sheet(`<div class="eyebrow accent">Saved meals</div><h2>Reuse a meal</h2>
    ${meals.length ? `<ul class="picker">${meals.map(m => `<li><div class="grow" data-act="foodMealApply" data-id="${m.id}"><b>${esc(m.name)}</b><small>${m.items.length} foods · ${m.items.reduce((a, i) => a + (+i.kcal || 0), 0)} kcal</small></div><button class="del" data-act="foodMealDel" data-id="${m.id}" aria-label="Delete meal">✕</button></li>`).join('')}</ul>` : '<p class="muted">No saved meals yet.</p>'}
    <p class="muted sm">Save today’s foods as a meal from the button below (uses what’s already logged today).</p>
    <button class="btn primary wide" data-act="foodMealSave">Save today’s foods as a meal</button>
    <button class="btn ghost wide" data-act="closeSheet">Close</button>`);
}

async function foodScanSheet(meal) {
  ui.food = { ...(ui.food || {}), meal };
  const can = typeof BarcodeDetector !== 'undefined';
  sheet(`<div class="eyebrow accent">Barcode</div><h2>Scan or type</h2>
    ${can ? `<video id="scanVid" class="scan-vid" playsinline autoplay muted></video><p class="muted sm">Point the camera at the barcode.</p>` : `<p class="muted sm">This browser can’t scan. Type the barcode below.</p>`}
    <div class="row gap"><input id="barcodeIn" class="inp grow" type="text" inputmode="numeric" placeholder="Type the barcode" aria-label="Barcode">
      <button class="btn primary" data-act="foodBarcodeGo">Look up</button></div>
    <p class="muted sm" id="scanMsg"></p>
    <button class="btn ghost wide" data-act="closeSheet">Close</button>`);
  if (!can) return;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    const vid = $('#scanVid');
    if (!vid) { stream.getTracks().forEach(t => t.stop()); return; }
    vid.srcObject = stream;
    await vid.play();
    const det = new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'] });
    ui.scan = { stream, running: true };
    const tick = async () => {
      if (!ui.scan?.running) return;
      try {
        const codes = await det.detect(vid);
        if (codes && codes[0]?.rawValue) { $('#barcodeIn').value = codes[0].rawValue; await actions.foodBarcodeGo(); return; }
      } catch (e) { }
      ui.scan.raf = requestAnimationFrame(tick);
    };
    ui.scan.raf = requestAnimationFrame(tick);
  } catch (e) {
    const msg = $('#scanMsg'); if (msg) msg.textContent = 'Camera unavailable — type the barcode instead.';
  }
}

function stopScan() {
  if (!ui.scan) return;
  ui.scan.running = false;
  if (ui.scan.raf) cancelAnimationFrame(ui.scan.raf);
  ui.scan.stream?.getTracks().forEach(t => t.stop());
  ui.scan = null;
}

function proteinHero(k, d, t) {
  const left = Math.max(0, t.protein - d.protein);
  const log = [...d.proteinLog].sort((a, b) => String(b.ts).localeCompare(String(a.ts)));
  return `<section class="card hero-card"><div class="row between"><div><div class="eyebrow accent">Protein</div><h2>${left ? `${left} g to go` : 'Goal hit 💪'}</h2></div><span class="chip">${d.proteinLog.length} entries</span></div>
    <div class="hero-ring">${ring(d.protein, t.protein, 'big')}<div class="hero-num"><b>${d.protein}</b><small>/ ${t.protein} g</small></div></div>
    <div class="quick"><button class="btn primary" data-act="addP" data-n="10">+10 g</button><button class="btn primary" data-act="addP" data-n="25">+25 g</button><button class="btn primary" data-act="addP" data-n="40">+40 g</button></div>
    ${state.quickFoods.length ? `<div class="foods">${state.quickFoods.map(f => `<button class="food" data-act="addFood" data-id="${f.id}"><b>${esc(f.name)}</b><small>+${f.g} g</small></button>`).join('')}</div>` : ''}
    <div class="row custom"><input id="pG" class="inp" type="number" inputmode="numeric" placeholder="g" aria-label="Custom grams"><input id="pLabel" class="inp" type="text" placeholder="label (e.g. chicken)" aria-label="Label"><button class="btn primary" data-act="addCustomP">Add</button></div>
    <ul class="plog">${log.length ? log.map(e => `<li class="swipe" data-swipe="delP" data-id="${e.id}"><span class="ptime">${fmtTime(e.ts)}</span><span class="grow">${esc(e.label || 'Protein')}</span><b>+${e.g} g</b><button class="del" data-act="delP" data-id="${e.id}" aria-label="Delete entry">✕</button></li>`).join('') : '<li class="muted empty">No entries yet — tap a button above.</li>'}</ul>
    ${log.length ? '<p class="muted sm hint">Swipe left or tap ✕ to delete an entry.</p>' : ''}</section>`;
}
function protein7(endKey) {
  const end = parseYmd(endKey); const bars = [];
  for (let i = 6; i >= 0; i--) { const dt = addDays(end, -i); const k = ymd(dt); const v = state.daily[k] ? state.daily[k].protein || 0 : 0; bars.push({ label: WD[dt.getDay()].slice(0, 2), value: v, highlight: i === 0 }); }
  const avg = Math.round(bars.reduce((a, b) => a + b.value, 0) / 7); const hit = bars.filter(b => b.value >= state.settings.targets.protein).length;
  return `${barChart(bars, { goal: state.settings.targets.protein })}<div class="muted sm">7-day avg <b class="accent">${avg} g</b> · goal hit ${hit}/7 days</div>`;
}
function suppCard(k, d) {
  const list = state.supplements; const inj = injLine(k);
  if (!list.length && !inj) return `<section class="card"><h3>Supplements</h3><p class="muted">No supplements set up.</p><button class="btn ghost" data-act="go" data-tab="settings">Add in Settings</button></section>`;
  const a = suppAdherence(k);
  const groups = SUPP_TIMINGS.map(([tk, tl]) => [tl, list.filter(x => x.timing === tk)]).filter(([, xs]) => xs.length);
  const end = parseYmd(k); let hist = '';
  for (let i = 6; i >= 0; i--) { const dt = addDays(end, -i); const ad = suppAdherence(ymd(dt)); const p = ad ? ad.pct : 0;
    hist += `<div class="sh ${p >= 1 ? 'full' : p > 0 ? 'part' : ''} ${i === 0 ? 'cur' : ''}"><span>${WD[dt.getDay()][0]}</span><b>${Math.round(p * 100)}%</b></div>`; }
  const st = suppStreak();
  return `<section class="card"><div class="row between"><div><div class="eyebrow accent">Supplements</div><h2>${a.n}/${a.total} taken</h2></div>${ring(a.n, a.total, 'sm', '#30d158')}</div>
    ${inj ? `<div class="sgroup"><div class="lbl">Weekly injection</div><button class="supp inj-line ${inj.done ? 'on' : ''}" data-act="suppInj">
      <span class="tick">${inj.done ? '✓' : ''}</span><span class="grow"><b>💉 Tirzepatide</b><small>${inj.done ? (inj.logged ? 'logged' : 'done this week') : `due ${WD_LONG[state.settings.injectionDay]}–${WD_LONG[(state.settings.injectionDay + (state.settings.injectionWindowDays || 2) - 1) % 7]}`}${state.settings.injectionDose ? ' · ' + esc(state.settings.injectionDose) : ''}</small></span>
      <small class="stime">${inj.logged ? fmtTime(inj.logged.ts) : inj.done ? 'done' : 'tap when taken'}</small></button></div>` : ''}
    ${groups.map(([tl, xs]) => `<div class="sgroup"><div class="lbl">${tl}</div>${xs.map(x => { const ts = d.supps[x.id]; return `<button class="supp ${ts ? 'on' : ''}" data-act="supp" data-id="${x.id}">
      <span class="tick">${ts ? '✓' : ''}</span><span class="grow"><b>${esc(x.name)}</b><small>${esc(x.dose)}${x.proteinG ? ` · +${x.proteinG} g protein` : ''}</small></span><small class="stime">${ts ? fmtTime(ts) : 'tap when taken'}</small></button>`; }).join('')}</div>`).join('')}
    <div class="row between"><h3 class="mt">Last 7 days</h3><span class="chip">🔥 ${st}-day streak</span></div><div class="shist">${hist}</div>
    </section>`;
}
function injectionCard(onToday) {
  const st = injectionStatus(); const s = state.settings;
  const dayName = WD_LONG[s.injectionDay]; const winEnd = WD_LONG[(s.injectionDay + (s.injectionWindowDays || 2) - 1) % 7];
  const head = { done: ['ok', '✓ Done this week'], due: ['warn', 'Due now'], overdue: ['danger', 'Overdue'], unknown: ['', 'Not logged yet'] }[st.status];
  let msg;
  if (st.status === 'done') msg = `Logged ${shortDate(new Date(st.last.ts))}${st.last.site ? ' · ' + esc(st.last.site) : ''}. Next due <b>${shortDate(st.nextDue)}</b>.`;
  else if (st.status === 'due') msg = `Weekly tirzepatide due <b>${shortDate(st.lastDue)}</b> (window ${dayName}–${winEnd}).`;
  else if (st.status === 'overdue') msg = `Was due <b>${shortDate(st.lastDue)}</b> (${dayName}–${winEnd} window). If you missed it, follow your prescriber's missed-dose instructions.`;
  else msg = `Injection day is ${dayName} (due ${dayName}–${winEnd}). Log this week's shot to start tracking.`;
  const sites = ['Abdomen L', 'Abdomen R', 'Thigh L', 'Thigh R', 'Arm L', 'Arm R'];
  const hist = [...state.injections].sort((a, b) => b.ts.localeCompare(a.ts)).slice(0, 4);
  return `<section class="card inj ${st.status}"><div class="row between"><div><div class="eyebrow accent">💉 Tirzepatide</div><h2>${head[1]}</h2></div><span class="chip ${head[0]}">${dayName}</span></div>
    <p class="muted">${msg}</p>
    ${st.status !== 'done' ? `${onToday ? '' : `<select id="injSite" class="inp" aria-label="Injection site"><option value="">Site (optional)</option>${sites.map(x => `<option>${x}</option>`).join('')}</select>`}
      <div class="quick"><button class="btn primary" data-act="logInj">Log injection now</button>${st.daysSinceDue > 0 ? `<button class="btn" data-act="logInj" data-back="1">Took it ${WD[st.lastDue.getDay()]} ${st.lastDue.getDate()}</button>` : ''}</div>` : ''}
    ${!onToday && hist.length ? `<ul class="mini">${hist.map(i => `<li><span>${shortDate(new Date(i.ts))}</span><b>${esc([i.dose, i.site].filter(Boolean).join(' · ') || 'logged')}</b><button class="link" data-act="delInj" data-id="${i.id}">✕</button></li>`).join('')}</ul>` : ''}
    ${st.last && st.last.site && !onToday ? `<p class="muted sm">Last site: ${esc(st.last.site)} — rotate sites.</p>` : ''}</section>`;
}

function bar(v, max, color) { const p = Math.min(100, (v / (max || 1)) * 100); return `<div class="bar"><i style="width:${p}%;${color ? `background:${color}` : ''}"></i></div>`; }
function ring(v, max, size = '', color = '#ff4d1a') {
  const r = 40, c = 2 * Math.PI * r, p = Math.min(1, v / (max || 1));
  const id = 'r' + Math.random().toString(36).slice(2, 7);
  return `<svg class="ring ${size}" viewBox="0 0 100 100"><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${color === '#ff4d1a' ? '#ff7a3d' : color}"/><stop offset="1" stop-color="${color}"/></linearGradient></defs>
    <circle cx="50" cy="50" r="${r}" stroke="#26262c" stroke-width="${size === 'big' ? 9 : 11}" fill="none"/>
    <circle cx="50" cy="50" r="${r}" stroke="url(#${id})" stroke-width="${size === 'big' ? 9 : 11}" fill="none" stroke-linecap="round" stroke-dasharray="${c * p} ${c}" transform="rotate(-90 50 50)"/>
    ${size === 'big' ? '' : `<text x="50" y="57" text-anchor="middle" font-size="22" font-weight="800" fill="#fff">${Math.round(p * 100)}%</text>`}</svg>`;
}

// =========================================================== SETTINGS
function viewSettings() {
  const s = state.settings; const t = s.targets;
  const wopts = state.program.workouts;
  const schedOpt = (v) => [...wopts.map(w => [`lift:${w.id}`, `Lift — ${w.name}`]), ['steps', 'Steps day'], ['class', 'Class / other training'], ['rest', 'Rest']]
    .map(([val, lbl]) => `<option value="${val}" ${val === v ? 'selected' : ''}>${lbl}</option>`).join('');
  const order = [1, 2, 3, 4, 5, 6, 0];
  let h = `<header class="hero"><h1>Settings</h1></header>`;
  h += `<section class="card"><h3>Weekly schedule</h3><p class="muted sm">Swap lifts for grappling/strength classes any time — classes count toward the streak.</p>
    ${order.map(i => { const x = s.schedule[i]; const v = x.type === 'lift' ? `lift:${x.workout}` : x.type; return `<div class="frow"><label>${WD_LONG[i]}</label><select class="inp" data-change="sched" data-d="${i}" aria-label="${WD_LONG[i]} plan">${schedOpt(v)}</select></div>`; }).join('')}
    <div class="frow"><label>Streak target (days/week)</label><input class="inp num" type="number" min="1" max="7" data-change="weeklyTarget" aria-label="Streak target days per week" value="${s.weeklyTarget}"></div></section>`;
  const pw = programWeek();
  h += `<section class="card"><h3>Program cycle</h3><p class="muted sm">Currently week ${pw.week} of ${pw.of}${pw.deload ? ' (deload)' : ''}. Week ${state.program.deloadWeek} is a deload.</p>
    <div class="frow"><label>Week 1 started</label><input class="inp" type="date" data-change="cycleStart" aria-label="Program week 1 start date" value="${s.cycleStart}"></div>
    <label class="toggle"><input type="checkbox" data-change="deloadEnabled" ${s.deloadEnabled ? 'checked' : ''}><span></span>Deload on week ${state.program.deloadWeek}</label>
    <button class="btn ghost" data-act="newCycle">Start new cycle this week</button></section>`;
  h += `<section class="card"><h3>Rest timer</h3>
    <div class="frow"><label>First lift <b>${fmtSec(s.rest.first)}</b></label><input type="range" min="120" max="180" step="15" data-change="restFirst" aria-label="First lift rest seconds" value="${s.rest.first}"></div>
    <div class="frow"><label>Other lifts <b>${fmtSec(s.rest.other)}</b></label><input type="range" min="45" max="180" step="15" data-change="restOther" aria-label="Other lifts rest seconds" value="${s.rest.other}"></div>
    <label class="toggle"><input type="checkbox" data-change="sound" ${s.sound ? 'checked' : ''}><span></span>Sound at end</label>
    <label class="toggle"><input type="checkbox" data-change="vibrate" ${s.vibrate ? 'checked' : ''}><span></span>Vibrate at end</label>
    <label class="toggle"><input type="checkbox" data-change="voice" ${s.voice !== false ? 'checked' : ''}><span></span>Voice: “Rest over, next set”</label>
    <label class="toggle"><input type="checkbox" data-change="voiceWarn" ${s.voiceWarn !== false ? 'checked' : ''}><span></span>Voice: “10 seconds” warning</label>
    <label class="toggle"><input type="checkbox" data-change="restNotify" ${s.restNotify ? 'checked' : ''}><span></span>Notify me when rest ends if I leave the app</label>
    <p class="muted sm">Keeps the screen awake during a workout so the timer can speak and vibrate. If you switch apps, a phone notification tells you when rest is over.</p>
    <button class="btn ghost sm" data-act="testAlarm">Test alarm</button></section>`;
  h += `<section class="card"><h3>Barbell / trap bar</h3><p class="muted sm">Used by the plate calculator on barbell lifts (LA Fitness plates: 45 / 35 / 25 / 10 / 5 / 2.5).</p>
    <div class="frow"><label>Olympic bar</label><input class="inp num" type="number" inputmode="decimal" step="any" data-change="barWeight" aria-label="Olympic bar weight" value="${s.barWeight ?? 45}"><span class="unit">lb</span></div>
    <div class="frow"><label>Trap / hex bar</label><input class="inp num" type="number" inputmode="decimal" step="any" data-change="trapBarWeight" aria-label="Trap bar weight" value="${s.trapBarWeight ?? 45}"><span class="unit">lb</span></div></section>`;
  const tf = [['kcal', 'Calories (kcal)'], ['protein', 'Protein (g)'], ['fat', 'Fat (g)'], ['carbs', 'Carbs (g)'], ['steps', 'Steps goal'], ['stepsMin', 'Steps-day min'], ['stepsMax', 'Steps-day max'], ['waterOz', 'Water (oz)']];
  h += `<section class="card"><h3>Daily targets</h3>${tf.map(([k, l]) => `<div class="frow"><label>${l}</label><input class="inp num" type="number" inputmode="numeric" data-change="target" data-k="${k}" aria-label="${l}" value="${t[k]}"></div>`).join('')}
    <div class="frow"><label>Goal bodyweight (lb)</label><input class="inp num" type="number" data-change="goalWeight" aria-label="Goal bodyweight" value="${s.goalWeight}"></div></section>`;
  const incIds = [...new Set([...state.program.workouts.flatMap(w => w.exercises.map(x => x.ex)), ...doneSessions().flatMap(x => x.exercises.map(e => e.exId))])];
  h += `<section class="card"><h3>Weight steps</h3><p class="muted sm">Smallest jump your gym allows per exercise (± buttons and progression use it). Dumbbells are per hand: the +10 lb lower rule becomes +5/hand.</p>
    ${incIds.map(id => { const ex = exercise(id); return `<div class="frow"><label>${esc(ex.name)}<small class="muted"> · ${EQUIP_LABEL[equipOf(ex)] || ''}</small></label><input class="inp num" type="number" inputmode="decimal" step="any" min="0.5" data-change="inc" data-id="${id}" value="${incFor(id)}" aria-label="${esc(ex.name)} weight step"><span class="unit">lb</span></div>`; }).join('')}</section>`;
  h += `<section class="card"><h3>Program — ${esc(state.program.name)}</h3><p class="muted sm">Edit exercises, sets, and rep ranges. Default lives in <code>src/program.js</code>.</p>
    ${state.program.workouts.map((w, wi) => `<div class="pw"><input class="inp title" data-change="wname" data-w="${wi}" aria-label="Workout name" value="${esc(w.name)}">
      ${w.exercises.map((x, xi) => `<div class="pslot"><select class="inp" data-change="pex" data-w="${wi}" data-x="${xi}" aria-label="${esc(w.name)} exercise ${xi + 1}">${EXERCISES.map(e => `<option value="${e.id}" ${e.id === x.ex ? 'selected' : ''}>${esc(e.name)}</option>`).join('')}</select>
        <div class="row gap"><label class="mini-l">Sets<input class="inp num" type="number" min="1" max="6" data-change="psets" data-w="${wi}" data-x="${xi}" aria-label="Sets" value="${x.sets}"></label>
        <label class="mini-l">Reps<input class="inp num" type="number" data-change="plo" data-w="${wi}" data-x="${xi}" aria-label="Reps min" value="${x.reps[0]}"></label>–
        <label class="mini-l"><input class="inp num" type="number" data-change="phi" data-w="${wi}" data-x="${xi}" aria-label="Reps max" value="${x.reps[1]}"></label></div></div>`).join('')}</div>`).join('')}
    <button class="btn ghost" data-act="resetProgram">Reset program to Coach Dre default</button></section>`;
  h += `<section class="card"><h3>Supplements</h3><p class="muted sm">Daily checklist on the Daily tab. Reorder with ↑ ↓. Tirzepatide is added automatically on injection due days (see below).</p>
    <div id="suppEditor">${state.supplements.map((x, i) => `<div class="pslot sedit" data-id="${x.id}"><div class="row gap">
      <input class="inp grow" data-change="suppName" data-id="${x.id}" value="${esc(x.name)}" placeholder="Name" aria-label="Supplement name">
</div>
      <div class="row gap"><input class="inp sdose" data-change="suppDose" data-id="${x.id}" value="${esc(x.dose)}" placeholder="Dose" aria-label="Dose">
      <select class="inp stiming" data-change="suppTiming" data-id="${x.id}" aria-label="Timing">${SUPP_TIMINGS.map(([v, l]) => `<option value="${v}" ${v === x.timing ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
      <div class="row gap"><label class="mini-l grow">Offer to add protein when checked</label><input class="inp num" type="number" inputmode="numeric" data-change="suppProt" data-id="${x.id}" value="${x.proteinG || ''}" placeholder="0" aria-label="Protein grams"><span class="unit">g</span></div>
      <div class="row gap sbtns"><button class="icon" data-act="suppMove" data-id="${x.id}" data-n="-1" ${i === 0 ? 'disabled' : ''} aria-label="Move up">↑</button><button class="icon" data-act="suppMove" data-id="${x.id}" data-n="1" ${i === state.supplements.length - 1 ? 'disabled' : ''} aria-label="Move down">↓</button>
      <span class="grow"></span><button class="btn ghost sm" data-act="suppDel" data-id="${x.id}">Remove</button></div></div>`).join('') || '<p class="muted">No supplements.</p>'}</div>
    <button class="btn primary wide" data-act="suppAdd">+ Add supplement</button></section>`;
  h += `<section class="card"><h3>Protein quick foods</h3><p class="muted sm">One-tap presets on the Daily tab.</p>
    ${state.quickFoods.map(f => `<div class="row gap qfrow"><input class="inp grow" data-change="qfName" data-id="${f.id}" value="${esc(f.name)}" aria-label="Food name"><input class="inp num" type="number" inputmode="numeric" data-change="qfG" data-id="${f.id}" value="${f.g}" aria-label="Grams"><span class="unit">g</span><button class="icon" data-act="qfDel" data-id="${f.id}" aria-label="Remove">✕</button></div>`).join('')}
    <button class="btn ghost wide" data-act="qfAdd">+ Add quick food</button></section>`;
  h += `<section class="card"><h3>Tirzepatide injection</h3><p class="muted sm">Weekly reminder on Today/Daily. Due on the injection day, still "due" the next day, then overdue.</p>
    <div class="frow"><label>Injection day</label><select class="inp" data-change="injDay" aria-label="Injection day">${WD_LONG.map((n, i) => `<option value="${i}" ${i === s.injectionDay ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
    <div class="frow"><label>Due window (days)</label><input class="inp num" type="number" min="1" max="4" data-change="injWin" aria-label="Due window days" value="${s.injectionWindowDays}"></div>
    <div class="frow"><label>Dose label (optional)</label><input class="inp num wide2" data-change="injDose" aria-label="Dose label" value="${esc(s.injectionDose)}" placeholder="e.g. 5 mg"></div></section>`;
  h += `<section class="card"><h3>Import from Renpho</h3><p class="muted sm">In the Renpho app, use its data export option and save the CSV, then choose it here. Weight (lb or kg), body fat % and muscle mass are detected automatically; you'll see a preview before anything is saved.</p>
    <button class="btn wide" data-act="renphoPick">⇪ Choose Renpho CSV</button></section>`;
  h += `<section class="card"><h3>Backup &amp; data</h3>
    <p class="muted sm">Everything is stored only on this phone. Last backed up: <b>${esc(formatLastBackup(s.lastBackupAt))}</b>.</p>
    <button class="btn primary wide" data-act="backupShare">Backup to Drive / Files</button>
    <p class="muted sm">Opens your phone’s share sheet — pick <b>Drive</b> (or Files) to save the JSON. Falls back to a download if sharing isn’t available.</p>
    <div class="quick"><button class="btn" data-act="export">Download JSON</button><button class="btn" data-act="import">Import JSON</button></div>
    <input type="file" id="importFile" accept="application/json,.json" hidden>
    <button class="btn danger wide" data-act="resetAll">Erase all data</button>
    <p class="muted sm">${doneSessions().length} sessions · ${state.bodyweight.length} weigh-ins · ${state.dizzyEvents.length} dizziness events · ${state.injections.length} injections · ${state.supplements.length} supplements</p></section>`;
  h += `<section class="card"><h3>Safety</h3><p class="muted sm">Don't lift fasted. Eat carbs + protein 1–2 h before, drink water/electrolytes. If dizzy or lightheaded: stop, sit or lie down, sip fluids, have some fast carbs. Fainting, chest pain, or confusion → call 911. Tell your prescriber about repeated dizziness.</p>
    <p class="muted sm">Rep v1.8.0 · personal use</p></section>`;
  return h;
}

// =========================================================== sheets
function sheet(html, { lock = false } = {}) {
  const m = $('#sheet');
  m.innerHTML = `<div class="backdrop" ${lock ? '' : 'data-act="closeSheet"'}></div><div class="panel"><div class="grab"></div>${html}</div>`;
  m.classList.add('open');
  document.querySelectorAll('main, .tabbar, #timer').forEach(e => { e.inert = true; });
}
function closeSheet() { stopScan(); $('#sheet').classList.remove('open'); $('#sheet').innerHTML = ''; document.querySelectorAll('main, .tabbar, #timer').forEach(e => { e.inert = false; }); }

function infoSheet(id) {
  const ex = exercise(id);
  const col = m => ex.primary.includes(m) ? '#ff4d1a' : ex.secondary.includes(m) ? '#ff9a73' : null;
  sheet(`<div class="eyebrow accent">${esc(ex.equipment)}</div><h2>${esc(ex.name)}</h2>
    <div class="minibody">${bodySvg('front', col, { cls: 'sm' })}${bodySvg('back', col, { cls: 'sm' })}</div>
    <div class="chips">${ex.primary.map(m => `<span class="chip accent">${MUSCLES[m]}</span>`).join('')}${ex.secondary.map(m => `<span class="chip">${MUSCLES[m]}</span>`).join('')}</div>
    <h3>Form cues</h3><ol class="cues">${ex.cues.map(c => `<li>${esc(c)}</li>`).join('')}<li><b>RIR 2:</b> stop each set with ~2 good reps left.</li></ol>
    <button class="btn primary wide" data-act="demo" data-ex="${ex.id}">▶ Demo</button>
    <button class="btn wide" data-act="exHist" data-ex="${ex.id}">📈 History &amp; PRs</button>
    <button class="btn ghost wide" data-act="closeSheet">Close</button>`);
}

function demoSheet(id) {
  const ex = exercise(id);
  const online = typeof navigator === 'undefined' || navigator.onLine !== false;
  const embed = embedUrl(ex);
  const yt = watchUrl(ex);
  let media;
  if (!embed) media = `<p class="muted sm">No saved demo — search on YouTube, or use the cues below.</p>`;
  else if (!online) media = `<div class="demo-offline" role="status">Video needs signal — cues below</div>`;
  else media = `<div class="demo-wrap"><iframe class="demo-frame" src="${embed}" title="${esc(ex.video.title)}" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowfullscreen playsinline></iframe></div>
    <p class="muted sm">${esc(ex.video.channel)} · ${esc(ex.video.title)}</p>`;
  sheet(`<div class="eyebrow accent">Demo</div><h2>${esc(ex.name)}</h2>
    ${media}
    <h3>Form cues</h3><ol class="cues">${ex.cues.map(c => `<li>${esc(c)}</li>`).join('')}<li><b>RIR 2:</b> stop each set with ~2 good reps left.</li></ol>
    <a class="btn ghost wide" href="${yt}" target="_blank" rel="noopener">Open in YouTube</a>
    <button class="btn ghost wide" data-act="closeSheet">Close</button>`);
  const frame = document.querySelector('.demo-frame');
  if (frame) frame.addEventListener('error', () => {
    const wrap = document.querySelector('.demo-wrap');
    if (wrap) wrap.outerHTML = `<div class="demo-offline" role="status">Video needs signal — cues below</div>`;
  });
}

function swapSheet(i) {
  const a = state.active; const cur = visible(a)[i].e;
  const { ranked } = swapAlternatives(cur.exId);
  const item = (e, n) => {
    const hasHist = historyFor(e.id).length > 0;
    const tag = e.tag ? `<span class="chip sm warn">${esc(e.tag)}</span>` : '';
    return `<li data-act="doSwap" data-i="${i}" data-ex="${e.id}"><span class="exnum">${n}</span><div class="grow"><b>${esc(e.name)}</b><small>${esc(e.equipment)}${hasHist ? ' · own history' : ' · pick starting weight'}</small>${tag}</div></li>`;
  };
  sheet(`<div class="eyebrow accent">Coach Dre swaps</div><h2>Swap ${esc(exercise(cur.exId).name)}</h2>
    <p class="muted sm">Same reps · 3 sets · RIR 2. Each swap logs its own weight. Today only unless you make it permanent.</p>
    <label class="toggle"><input type="checkbox" id="swapSave"><span></span>Make permanent in the plan</label>
    <ul class="picker">${ranked.map((e, n) => item(e, n + 1)).join('') || '<li class="muted">No swaps listed</li>'}</ul>
    <button class="btn ghost wide" data-act="closeSheet">Cancel</button>`);
}

function chooseSheet() {
  const nx = nextInRotation(); const sch = scheduleFor(new Date());
  sheet(`<h2>Choose workout</h2><ul class="picker">${state.program.workouts.map(w => `<li data-act="pick" data-w="${w.id}"><b>${esc(w.name)}${w.id === nx.id ? ' <span class="chip accent sm">next in rotation</span>' : ''}${sch.type === 'lift' && sch.workout === w.id ? ' <span class="chip sm">scheduled</span>' : ''}</b>
    <small>${w.exercises.map(x => exercise(x.ex).name).join(' · ')}</small></li>`).join('')}</ul>
    <button class="btn ghost wide" data-act="closeSheet">Cancel</button>`);
}

function precheckSheet(wid) {
  ui.pre = ui.pre && ui.pre.w === wid ? ui.pre : { w: wid, ate: null, water: null, ok: null };
  const p = ui.pre;
  const q = (k, label) => `<div class="pq"><span>${label}</span><div class="seg sm"><button class="${p[k] === true ? 'on ok' : ''}" data-act="pq" data-k="${k}" data-v="1">Yes</button><button class="${p[k] === false ? 'on danger' : ''}" data-act="pq" data-k="${k}" data-v="0">No</button></div></div>`;
  let warn = '';
  if (p.ate === false) warn += `<div class="banner danger"><b>Don't lift fasted.</b> You nearly passed out last time. Have a quick carb + protein snack first — e.g. banana + protein shake, Greek yogurt + fruit, or a protein bar + juice — then wait ~30–60 min.</div>`;
  if (p.water === false) warn += `<div class="banner warn">Drink water with electrolytes (e.g. an electrolyte packet) before you start, and keep a bottle with you.</div>`;
  if (p.ok === false) warn += `<div class="banner warn">Not feeling right? Consider skipping today or turning on <b>Bad day</b> mode (2 lifts × 2 sets). If you're dizzy, short of breath, or have chest pain — don't train.</div>`;
  const all = p.ate !== null && p.water !== null && p.ok !== null;
  const clean = p.ate && p.water && p.ok;
  sheet(`<div class="eyebrow accent">Pre-workout check</div><h2>Ready to lift?</h2>
    ${q('ate', 'Ate carbs + protein 1–2 h ago?')}${q('water', 'Had electrolytes / water?')}${q('ok', 'Feeling OK?')}${warn}
    ${p.ok === false ? `<label class="toggle"><input type="checkbox" data-change="badDayPre" ${ui.badDay ? 'checked' : ''}><span></span>Bad day mode</label>` : ''}
    ${p.ate === false ? `<button class="btn primary xl" data-act="closeSheet">OK — I'll eat first</button><button class="btn ghost wide" data-act="start" ${all ? '' : 'disabled'}>Start anyway (not advised)</button>`
      : `<button class="btn primary xl" data-act="start" ${all ? '' : 'disabled'}>${clean || !all ? 'Start workout' : 'Start anyway'}</button><button class="btn ghost wide" data-act="closeSheet">Cancel</button>`}`, { lock: false });
}

function dizzySheet() {
  sheet(`<div class="dizzy-head">🛑</div><h2>Stop. Sit down. Sip fluids.</h2>
    <ol class="cues"><li>Rack or set down the weight now and <b>sit or lie down</b> (legs up if you can).</li>
    <li>Sip water with <b>electrolytes</b>; have fast carbs (juice, banana, candy) + some protein.</li>
    <li>Wait until you feel completely normal — at least 10–15 min. Don't drive while dizzy.</li>
    <li><b>Fainting, chest pain, trouble breathing, or confusion → call 911.</b></li>
    <li>Tell your prescriber about this episode (you're on tirzepatide).</li></ol>
    <textarea id="dzNote" aria-label="Dizziness note" class="inp" rows="2" placeholder="Optional note (what you ate, which set…)"></textarea>
    <button class="btn primary xl" data-act="dizzyEnd">End session &amp; save</button>
    <button class="btn ghost wide" data-act="dizzyResume">I feel completely fine — resume</button>`, { lock: true });
}

// =========================================================== actions
function startSession() {
  const w = workoutById(ui.pre.w); const pw = programWeek();
  state.active = {
    id: 's' + Date.now(), workoutId: w.id, workoutName: w.name, start: new Date().toISOString(), date: ymd(),
    week: pw.week, cycle: pw.cycle, deload: pw.deload, badDay: ui.badDay, paused: false, dizzy: false,
    precheck: { ate: ui.pre.ate, water: ui.pre.water, ok: ui.pre.ok },
    exercises: w.exercises.map(slot => buildEx(slot, pw.deload)),
  };
  ui.pre = null; ui.choice = null; save(); closeSheet(); wake(true); render(); window.scrollTo(0, 0);
}
function buildEx(slot, deload) {
  const sg = suggest(slot, { deload });
  return { exId: slot.ex, reps: slot.reps, note: slot.note || '', suggestion: sg,
    sets: Array.from({ length: sg.sets }, (_, j) => ({ weight: sg.weights[j] ?? '', reps: sg.targets[j] ?? '', done: false, rir: null })) };
}
function finishSession(status = 'done') {
  const a = state.active;
  const exs = visible(a).map(({ e, sets }) => ({ exId: e.exId, reps: e.reps, sets: sets.filter(s => s.done).map(s => {
    const o = { weight: +s.weight || 0, reps: +s.reps, rir: s.rir ?? null }; if (s.pr && s.pr.length) o.pr = s.pr; return o; }) }));
  const prCount = exs.reduce((n, e) => n + e.sets.filter(s => s.pr).length, 0);
  const total = exs.reduce((n, e) => n + e.sets.length, 0);
  if (!total && status === 'done') { if (!confirm('No sets checked off. Discard this workout?')) return; state.active = null; stopTimer(); save(); wake(false); render(); return; }
  const rec = { ...a, end: new Date().toISOString(), status, exercises: exs };
  delete rec.paused;
  state.sessions.push(rec); state.active = null; stopTimer(); save(); wake(false);
  render(); window.scrollTo(0, 0);
  summarySheet(rec.id, { fresh: true });
}

function sessionSummary(id) {
  const rec = state.sessions.find(x => x.id === id); if (!rec) return null;
  const prevSame = doneSessions().filter(x => x.workoutId === rec.workoutId && x.id !== rec.id && x.start < rec.start).sort((a, b) => b.start.localeCompare(a.start))[0] || null;
  const prevOf = exId => { const h = historyFor(exId).find(x => x.session.id !== rec.id && x.session.start < rec.start); return h ? h.ex.sets : null; };
  return summarize(rec, { prevOf, prevSame });
}
function summarySheet(id, { fresh = false } = {}) {
  const sm = sessionSummary(id); if (!sm) return;
  const rec = state.sessions.find(x => x.id === id);
  const pct = v => v == null ? '' : `<span class="cmp ${v > 0 ? 'up' : v < 0 ? 'down' : 'same'}">${v > 0 ? '+' : ''}${v}%</span>`;
  sheet(`<div class="dizzy-head">${rec.status === 'ended' ? '🛑' : '💪'}</div><div class="eyebrow accent center">${esc(sm.date)}${sm.deload ? ' · deload' : ''}${sm.badDay ? ' · bad day' : ''}</div>
    <h2 class="center">${fresh ? (rec.status === 'ended' ? 'Session ended &amp; saved' : 'Workout complete') : esc(sm.name)}</h2>
    <div class="stats"><div><small>Sets</small><b>${sm.sets}</b></div><div><small>Volume</small><b>${fmtNum(sm.volume)}</b></div><div><small>Minutes</small><b>${sm.mins ?? '—'}</b></div></div>
    ${sm.volDeltaPct != null ? `<p class="muted sm center">Volume ${pct(sm.volDeltaPct)} vs your last ${esc(sm.name)}</p>` : ''}
    <ul class="sumlifts">${sm.lifts.map(l => `<li><span class="grow"><b>${esc(l.name)}</b><small>Best ${esc(l.top)} · e1RM ${l.e1rm}</small></span>${l.dE != null ? pct(l.dE) : '<span class="chip sm">first</span>'}</li>`).join('')}</ul>
    ${sm.prs.length ? `<div class="banner pr-banner">🏆 <b>${sm.prs.length} PR set${sm.prs.length > 1 ? 's' : ''}:</b> ${sm.prs.map(p => `${esc(p.name)} ${fmtW0(p.weight)}×${p.reps}`).join(', ')}. Strength held on a cut is a win.</div>` : ''}
    ${fresh ? `<p class="muted">Next up: protein (${day().protein}/${state.settings.targets.protein} g), water, and steps.</p>` : ''}
    <div class="quick"><button class="btn" data-act="summaryShare" data-id="${esc(id)}">Share</button><button class="btn primary" data-act="closeSheet">Done</button></div>`);
}

function exNoteSheet(exId) {
  const ex = exercise(exId); const cur = (state.exNotes || {})[exId] || '';
  sheet(`<div class="eyebrow accent">Setup note · shows every time</div><h2>${esc(ex.name)}</h2>
    <textarea id="exNoteText" class="inp" rows="3" maxlength="140" aria-label="Setup note" placeholder="e.g. Seat 4, safeties on 5, grip 1 finger outside rings">${esc(cur)}</textarea>
    <button class="btn primary xl" data-act="exNoteSave" data-ex="${exId}">Save note</button>
    ${cur ? `<button class="btn ghost wide" data-act="exNoteClear" data-ex="${exId}">Clear note</button>` : ''}
    <button class="btn ghost wide" data-act="closeSheet">Cancel</button>`);
  setTimeout(() => $('#exNoteText')?.focus(), 50);
}

function celebrate(s, exId, prior) {
  const ex = exercise(exId); const el = $('#pr');
  const lines = [];
  if (s.pr.includes('e1rm')) lines.push(`Est. 1RM <b>${Math.round(epley(+s.weight, +s.reps))} lb</b>`);
  if (s.pr.includes('weight')) lines.push(`Heaviest ever <b>${fmtW0(s.weight)} lb</b>`);
  if (s.pr.includes('reps')) lines.push(`Rep PR <b>${s.reps} reps @ ${fmtW0(s.weight)}</b>`);
  el.innerHTML = `<div class="pr-card" role="status"><div class="pr-trophy">🏆</div><div class="pr-title">NEW PR</div><div class="pr-ex">${esc(ex.name)}</div>${lines.map(l => `<div class="pr-line">${l}</div>`).join('')}</div>
    ${Array.from({ length: 26 }, (_, k) => `<i class="cf" style="left:${(k * 37) % 100}%;animation-delay:${(k % 7) * 0.06}s;background:${['#ff4d1a', '#ffd60a', '#30d158', '#3aa0ff', '#fff'][k % 5]}"></i>`).join('')}`;
  el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  if (navigator.vibrate && state.settings.vibrate) navigator.vibrate([60, 40, 60, 40, 160]);
  clearTimeout(celebrate.t); celebrate.t = setTimeout(() => el.classList.remove('show'), 2800);
}

function exHistSheet(exId) {
  const ex = exercise(exId); const st = exStats(exId); const m = ui.histMetric;
  const pts = st.pts.map(p => ({ x: p.t, y: m === 'e1rm' ? Math.round(p.e1rm) : m === 'top' ? p.top : p.rel != null ? +p.rel.toFixed(3) : null })).filter(p => p.y != null);
  const first = st.pts[0], last = st.pts[st.pts.length - 1];
  const slot = state.program.workouts.flatMap(w => w.exercises).find(x => x.ex === exId);
  const next = slot ? suggest(slot, { deload: programWeek().deload }) : null;
  let trend = '';
  if (first && last && st.pts.length > 1) {
    const dE = (last.e1rm - first.e1rm) / first.e1rm * 100; const dBw = first.bw && last.bw ? last.bw - first.bw : 0;
    trend = `<p class="muted sm">Since ${first.date}: est. 1RM <b class="${dE >= 0 ? 'okc' : 'accent'}">${dE >= 0 ? '+' : ''}${dE.toFixed(1)}%</b>${dBw ? ` while bodyweight ${dBw < 0 ? '−' : '+'}${Math.abs(dBw).toFixed(1)} lb` : ''}.${dBw < 0 && dE > -2 ? ' Holding strength while cutting = a win.' : ''}</p>`;
  }
  const rows = [...st.pts].reverse().map(p => `<li><div class="row between"><b>${p.date}</b><span>${p.session.deload ? '<span class="chip sm warn">deload</span>' : ''}${p.session.badDay ? '<span class="chip sm">bad day</span>' : ''}<span class="chip sm">e1RM ${Math.round(p.e1rm)}</span></span></div>
    <div class="hsets">${p.ex.sets.map(s => `<span class="hs ${s.pr ? 'pr' : ''}">${fmtW0(s.weight)}×${s.reps}${s.rir != null ? `<small>@${s.rir === 3 ? '3+' : s.rir}</small>` : ''}${s.pr ? ' 🏆' : ''}</span>`).join('')}</div></li>`).join('');
  sheet(`<div class="eyebrow accent">History &amp; PRs</div><h2>${esc(ex.name)}</h2>
    ${st.pts.length ? `<div class="stats four"><div><small>Best e1RM</small><b>${Math.round(st.bestE)}</b></div><div><small>Heaviest</small><b>${fmtW0(st.heaviest)}</b></div>
      <div><small>Best set</small><b>${st.bestSet ? `${fmtW0(st.bestSet.weight)}×${st.bestSet.reps}` : '—'}</b></div><div><small>× BW</small><b>${last && last.rel ? last.rel.toFixed(2) : '—'}</b></div></div>
    <div class="seg">${[['e1rm', 'Est. 1RM'], ['top', 'Top set'], ['rel', '× BW']].map(([k, l]) => `<button class="${m === k ? 'on' : ''}" data-act="histMetric" data-ex="${exId}" data-m="${k}">${l}</button>`).join('')}</div>
    ${lineChart(pts, { unit: m === 'rel' ? '×' : ' lb', label: 'Trend' })}${trend}` : '<p class="muted">No sessions logged yet.</p>'}
    ${next ? `<div class="suggest k-${next.kind}"><span class="sg-ico">${KIND_ICON[next.kind] || '→'}</span><span><b>Next time:</b> ${esc(next.text)}</span></div>` : ''}
    ${rows ? `<h3>Sessions</h3><ul class="hlist">${rows}</ul>` : ''}
    <button class="btn ghost wide" data-act="closeSheet">Close</button>`);
}

function checkInSheet() {
  const c = buildCheckIn(new Date());
  sheet(`<div class="eyebrow accent">Coach Dre</div><h2>Weekly check-in</h2>
    <p class="muted sm">${c.from} → ${c.to}</p>
    <pre class="checkin-text" id="checkInText">${esc(c.text)}</pre>
    <div class="quick"><button class="btn primary" data-act="checkInCopy">Copy</button><button class="btn" data-act="checkInShare">Share</button></div>
    <p class="muted sm">Paste this into a text to Coach Dre. Numbers come from your last week of logs.</p>
    <button class="btn ghost wide" data-act="closeSheet">Close</button>`);
}

const actions = {
  go: el => go(el.dataset.tab),
  closeSheet: () => closeSheet(),
  choose: () => chooseSheet(),
  pick: el => { ui.choice = el.dataset.w; closeSheet(); render(); },
  info: el => infoSheet(el.dataset.ex),
  demo: el => demoSheet(el.dataset.ex),
  precheck: el => precheckSheet(el.dataset.w),
  pq: el => { ui.pre[el.dataset.k] = el.dataset.v === '1'; precheckSheet(ui.pre.w); },
  start: () => startSession(),
  step: el => {
    const s = visible(state.active)[+el.dataset.i].sets[+el.dataset.j]; const f = el.dataset.f; const d = +el.dataset.d;
    const v = Math.max(0, (s[f] === '' || s[f] == null ? 0 : +s[f]) + d); s[f] = +v.toFixed(2);
    // propagate weight to later un-done sets
    if (f === 'weight') visible(state.active)[+el.dataset.i].sets.forEach((x, k) => { if (k > +el.dataset.j && !x.done) x.weight = s.weight; });
    save(); render();
  },
  toggleSet: el => {
    const a = state.active; const i = +el.dataset.i, j = +el.dataset.j; const vis = visible(a); const s = vis[i].sets[j];
    if (!s.done) {
      if (s.reps === '' || +s.reps <= 0) return toast('Enter reps first');
      if (s.weight === '') return toast('Enter weight (0 for bodyweight)');
      s.done = true;
      const prior = [...priorSets(vis[i].e.exId), ...vis[i].sets.filter((x, k) => k !== j && x.done)];
      s.pr = detectPRs(prior, s);
      if (s.pr.length) celebrate(s, vis[i].e.exId, prior);
      vis[i].sets.forEach((x, k) => { if (k > j && !x.done && x.weight === '') x.weight = s.weight; });
      const last = i === vis.length - 1 && vis[i].sets.every(x => x.done);
      if (last) { state.timer = null; toast('All sets done — tap Finish 💪'); }
      else if (!a.paused) startTimer(i === 0 ? state.settings.rest.first : state.settings.rest.other, exercise(vis[i].e.exId).name);
      if (navigator.vibrate && state.settings.vibrate) navigator.vibrate(30);
    } else { s.done = false; s.pr = []; s.rir = null; }
    save(); render();
  },
  rir: el => { const s = visible(state.active)[+el.dataset.i].sets[+el.dataset.j]; const v = +el.dataset.v; s.rir = s.rir === v ? null : v; save(); render(); },
  exHist: el => exHistSheet(el.dataset.ex),
  histMetric: el => { ui.histMetric = el.dataset.m; exHistSheet(el.dataset.ex); },
  swap: el => swapSheet(+el.dataset.i),
  doSwap: el => {
    const i = +el.dataset.i; const a = state.active; const entry = visible(a)[i].e; const idx = a.exercises.indexOf(entry);
    const fromId = entry.exId; const toId = el.dataset.ex;
    const saveProg = $('#swapSave')?.checked;
    const w = workoutById(a.workoutId);
    const base = w?.exercises[idx] || { sets: 3, reps: entry.reps };
    const slot = { sets: 3, reps: entry.reps || base.reps, note: entry.note || base.note || '', ex: toId };
    const sg = swapSuggestion(fromId, toId, slot, { deload: a.deload, badDay: a.badDay });
    a.exercises[idx] = {
      exId: toId, reps: slot.reps, note: slot.note || '', suggestion: sg, swappedFrom: fromId,
      sets: Array.from({ length: sg.sets }, (_, j) => ({ weight: sg.weights[j] ?? '', reps: sg.targets[j] ?? '', done: false, rir: null })),
    };
    if (saveProg && w) { w.exercises[idx].ex = toId; w.exercises[idx].sets = 3; w.exercises[idx].reps = slot.reps; }
    save(); closeSheet(); render();
    toast(saveProg ? `Permanent → ${exercise(toId).name}` : `Today: ${exercise(toId).name}`);
  },
  finish: () => finishSession('done'),
  discard: () => { if (confirm('Discard this workout? Logged sets will be lost.')) { state.active = null; stopTimer(); save(); wake(false); render(); } },
  dizzy: () => {
    const a = state.active; a.paused = true; a.dizzy = true; stopTimer();
    state.dizzyEvents.push({ ts: new Date().toISOString(), sessionId: a.id, workout: a.workoutName, note: '' });
    const d = day(); d.dizzy = true; save(); render(); dizzySheet();
    if (navigator.vibrate && state.settings.vibrate) navigator.vibrate([200, 100, 200]);
  },
  dizzyEnd: () => {
    const note = $('#dzNote')?.value || ''; const ev = state.dizzyEvents[state.dizzyEvents.length - 1];
    if (ev && note) { ev.note = note; const d = day(); d.dizzyNote = (d.dizzyNote ? d.dizzyNote + '\n' : '') + note; }
    closeSheet(); finishSession('ended');
  },
  dizzyResume: () => {
    const note = $('#dzNote')?.value || ''; const ev = state.dizzyEvents[state.dizzyEvents.length - 1];
    if (ev && note) ev.note = note;
    if (state.active) state.active.paused = false; save(); closeSheet(); render();
  },
  cls: () => { const d = day(); d.cls = !d.cls; save(); render(); toast(d.cls ? 'Class logged — counts toward streak' : 'Class removed'); },
  steps: el => { const d = day(tab === 'daily' ? ui.dailyDate : ymd()); d.steps = Math.max(0, (+d.steps || 0) + +el.dataset.n); save(); render(); },
  addP: el => addProtein(+el.dataset.n, ''),
  addFood: el => { const f = state.quickFoods.find(x => x.id === el.dataset.id); if (f) addProtein(f.g, f.name); },
  addCustomP: () => { const g = parseFloat($('#pG').value); if (!(g > 0)) return toast('Enter grams'); addProtein(g, $('#pLabel').value.trim()); },
  delP: el => delProtein(el.dataset.id),
  delFood: el => delProtein(el.dataset.id),
  foodSearch: el => { foodSearchSheet(el.dataset.meal || 'snacks'); },
  foodDoSearch: async () => {
    const q = $('#foodQ')?.value || '';
    const meal = ui.food?.meal || 'snacks';
    await foodSearchSheet(meal, { q, searching: true });
    const r = await searchFoods(q, { online: navigator.onLine });
    await foodSearchSheet(meal, { q, results: r.results, needsSignal: r.needsSignal });
  },
  foodPick: el => {
    const f = (ui.foodIndex && ui.foodIndex[el.dataset.id]) || foodPickFromUi(el.dataset.id);
    if (!f) return toast('Food not found');
    foodEntrySheet(el.dataset.meal || ui.food?.meal || 'snacks', f);
  },
  foodEdit: el => {
    const d = day(ui.dailyDate);
    const e = (d.foodLog || []).find(x => x.id === el.dataset.id);
    if (!e) return;
    const base = {
      name: e.name, id: e.foodId || e.id, foodId: e.foodId, source: e.source, barcode: e.barcode,
      servingLabel: e.servingLabel, servingGrams: e.servingGrams || e.grams || 100,
      kcal: e.servingGrams && e.grams ? e.kcal / e.grams * e.servingGrams : e.kcal,
      protein: e.servingGrams && e.grams ? e.protein / e.grams * e.servingGrams : e.protein,
      fat: e.servingGrams && e.grams ? e.fat / e.grams * e.servingGrams : e.fat,
      carbs: e.servingGrams && e.grams ? e.carbs / e.grams * e.servingGrams : e.carbs,
    };
    foodEntrySheet(e.meal, base, { existing: e });
  },
  foodLog: () => {
    const pick = ui.foodPick; if (!pick) return;
    const meal = $('#fMeal')?.value || pick.meal;
    const grams = parseFloat($('#fGrams')?.value);
    if (!Number.isFinite(grams) || grams < 0) return toast('Enter an amount');
    const s = scaleFood(pick.food, { grams });
    const d = day(ui.dailyDate);
    if (pick.existing) {
      Object.assign(pick.existing, s, { meal, id: pick.existing.id, ts: pick.existing.ts, fromSupp: pick.existing.fromSupp, source: pick.existing.source || s.source });
      if (s.source !== 'quick') state.recentFoods = rememberRecent(state.recentFoods, pick.existing);
      syncDay(d);
    } else {
      addFoodEntry(d, { id: uid(), ts: nowFor(ui.dailyDate), meal, ...s });
    }
    closeSheet(); save(); render(); toast(pick.existing ? 'Saved' : 'Logged');
  },
  foodFav: el => {
    const d = day(ui.dailyDate);
    const e = (d.foodLog || []).find(x => x.id === el.dataset.id) || (ui.foodIndex && ui.foodIndex[el.dataset.id]);
    if (!e) return;
    state.favorites = toggleFavorite(state.favorites, e);
    save(); render();
    toast(isFavorite(state.favorites, e) ? 'Favorited' : 'Removed favorite');
  },
  foodFavPick: () => {
    if (!ui.foodPick) return;
    state.favorites = toggleFavorite(state.favorites, ui.foodPick.food);
    save();
    foodEntrySheet(ui.foodPick.meal, ui.foodPick.food, { existing: ui.foodPick.existing });
  },
  foodManual: el => foodManualSheet(el.dataset.meal || ui.food?.meal || 'snacks'),
  foodManualLog: () => {
    const name = $('#mName')?.value.trim();
    if (!name) return toast('Enter a name');
    const grams = parseFloat($('#mGrams')?.value) || 100;
    const kcal = parseFloat($('#mKcal')?.value) || 0;
    const protein = parseFloat($('#mP')?.value) || 0;
    const fat = parseFloat($('#mF')?.value) || 0;
    const carbs = parseFloat($('#mC')?.value) || 0;
    const meal = $('#mMeal')?.value || 'snacks';
    const d = day(ui.dailyDate);
    addFoodEntry(d, { id: uid(), ts: nowFor(ui.dailyDate), meal, name, foodId: '', source: 'manual', barcode: '', servingLabel: grams + ' g', servingGrams: grams, grams, qty: 1, kcal, protein, fat, carbs });
    closeSheet(); save(); render(); toast('Logged');
  },
  foodQuick: () => foodQuickSheet(),
  foodQuickLog: () => {
    const kcal = parseFloat($('#qKcal')?.value) || 0;
    const protein = parseFloat($('#qP')?.value) || 0;
    const fat = parseFloat($('#qF')?.value) || 0;
    const carbs = parseFloat($('#qC')?.value) || 0;
    if (!(kcal || protein || fat || carbs)) return toast('Enter calories or macros');
    const name = ($('#qName')?.value.trim()) || 'Quick add';
    const d = day(ui.dailyDate);
    addFoodEntry(d, { id: uid(), ts: nowFor(ui.dailyDate), meal: 'snacks', name, foodId: '', source: 'quick', barcode: '', servingLabel: 'quick add', servingGrams: 0, grams: 0, qty: 1, kcal, protein, fat, carbs });
    closeSheet(); save(); render(); toast('Logged');
  },
  foodCopyY: () => {
    const y = ymd(addDays(parseYmd(ui.dailyDate), -1));
    const src = state.daily[y];
    if (!src?.foodLog?.length) return toast('Nothing logged yesterday');
    const d = day(ui.dailyDate);
    for (const e of src.foodLog) {
      const { fromSupp, ...rest } = e;
      addFoodEntry(d, { ...rest, id: uid(), ts: nowFor(ui.dailyDate) });
    }
    save(); render(); toast("Copied yesterday's foods");
  },
  foodMeals: () => foodMealsSheet(),
  foodMealSave: () => {
    const n = (day(ui.dailyDate).foodLog || []).length;
    if (!n) return toast('Log some foods first');
    sheet(`<div class="eyebrow accent">Save meal</div><h2>Name this meal</h2>
      <input id="mealName" class="inp" type="text" value="Saved meal" aria-label="Meal name">
      <p class="muted sm">${n} food${n === 1 ? '' : 's'} from today will be saved.</p>
      <button class="btn primary xl" data-act="foodMealSaveGo">Save meal</button>
      <button class="btn ghost wide" data-act="closeSheet">Cancel</button>`);
  },
  foodMealSaveGo: () => {
    const name = ($('#mealName')?.value.trim()) || 'Saved meal';
    const items = (day(ui.dailyDate).foodLog || []).map(e => { const { id, fromSupp, ts, ...rest } = e; return rest; });
    if (!items.length) return toast('Log some foods first');
    state.savedMeals = [{ id: uid(), name, items }, ...(state.savedMeals || [])].slice(0, 20);
    save(); closeSheet(); toast('Meal saved');
  },
  foodMealApply: el => {
    const m = (state.savedMeals || []).find(x => x.id === el.dataset.id);
    if (!m) return;
    const d = day(ui.dailyDate);
    for (const e of m.items) addFoodEntry(d, { ...e, id: uid(), ts: nowFor(ui.dailyDate) });
    closeSheet(); save(); render(); toast(`Added ${m.name}`);
  },
  foodMealDel: el => {
    state.savedMeals = (state.savedMeals || []).filter(m => m.id !== el.dataset.id);
    save(); foodMealsSheet();
  },
  foodScan: el => { foodScanSheet(el.dataset.meal || ui.food?.meal || 'snacks'); },
  foodBarcodeGo: async () => {
    const code = $('#barcodeIn')?.value || '';
    const meal = ui.food?.meal || 'snacks';
    const msg = $('#scanMsg');
    if (!navigator.onLine) { if (msg) msg.textContent = 'Needs signal'; return; }
    if (msg) msg.textContent = 'Looking up…';
    try {
      stopScan();
      const food = await lookupBarcode(code);
      closeSheet();
      foodEntrySheet(meal, food);
    } catch (err) {
      if (msg) msg.textContent = (err && err.message ? err.message : 'Lookup failed') + ' — try manual entry.';
    }
  },
  supp: el => {
    const d = day(ui.dailyDate); const id = el.dataset.id; const x = state.supplements.find(y => y.id === id);
    d.suppProtein = d.suppProtein || {};
    if (d.supps[id]) { // uncheck: also remove the linked food / protein entry (once)
      delete d.supps[id];
      if (d.suppProtein[id]) { delProtein(d.suppProtein[id], { toastOff: true }); return; }
      syncDay(d); save(); render(); return;
    }
    d.supps[id] = nowFor(ui.dailyDate); save(); render();
    if (x && x.proteinG) sheet(`<div class="eyebrow accent">${esc(x.name)} ✓</div><h2>Add to protein tracker?</h2>
      <div class="row custom"><input id="spG" class="inp big" type="number" inputmode="numeric" value="${x.proteinG}" aria-label="Grams"><span class="unit">g protein</span></div>
      <button class="btn primary xl" data-act="suppAddP" data-id="${id}">Add protein</button><button class="btn ghost wide" data-act="closeSheet">Just check it off</button>`);
  },
  suppAddP: el => {
    const id = el.dataset.id; const x = state.supplements.find(y => y.id === id); const g = parseFloat($('#spG').value);
    closeSheet(); if (!(g > 0)) return;
    const d = day(ui.dailyDate);
    const shake = BUILTIN_BY_ID['protein-shake'];
    const eid = uid();
    const qty = shake && shake.protein ? g / shake.protein : 1;
    const s = shake ? scaleFood(shake, { qty }) : { name: x ? x.name : 'Shake', kcal: Math.round(g * 4), protein: g, fat: 0, carbs: 0, qty: 1, grams: 0, servingGrams: 0, servingLabel: '1 shake', foodId: 'protein-shake', source: 'builtin' };
    addFoodEntry(d, { id: eid, ts: d.supps[id] || nowFor(ui.dailyDate), meal: 'snacks', ...s, name: x ? x.name : s.name, fromSupp: id });
    d.suppProtein = d.suppProtein || {}; d.suppProtein[id] = eid;
    save(); render(); toast(`+${g} g protein`);
  },
  suppInj: () => {
    const k = ui.dailyDate; const inj = injLine(k);
    if (inj && inj.logged) { if (confirm('Remove the tirzepatide injection logged for this day?')) { state.injections = state.injections.filter(i => i !== inj.logged); save(); render(); } return; }
    if (inj && inj.done) return toast('Already logged this week');
    const ts = nowFor(k); state.injections.push({ id: uid(), ts, date: k, dose: state.settings.injectionDose || '', site: '' });
    save(); render(); toast('Injection logged');
  },
  suppAdd: () => { state.supplements.push({ id: uid(), name: 'New supplement', dose: '', timing: 'morning' }); save(); render(); const els = document.querySelectorAll('[data-change=suppName]'); const el = els[els.length - 1]; if (el) { el.focus(); el.select(); } },
  suppDel: el => { const x = state.supplements.find(y => y.id === el.dataset.id); if (x && confirm(`Remove ${x.name}?`)) { state.supplements = state.supplements.filter(y => y !== x); save(); render(); } },
  suppMove: el => { const L = state.supplements; const i = L.findIndex(y => y.id === el.dataset.id); const j = i + +el.dataset.n; if (i < 0 || j < 0 || j >= L.length) return; [L[i], L[j]] = [L[j], L[i]]; save(); render(); },
  qfAdd: () => { state.quickFoods.push({ id: uid(), name: 'New food', g: 20 }); save(); render(); },
  qfDel: el => { state.quickFoods = state.quickFoods.filter(f => f.id !== el.dataset.id); save(); render(); },
  logInj: el => {
    const st = injectionStatus(); const back = el.dataset.back === '1';
    const dt = back ? new Date(st.lastDue.getFullYear(), st.lastDue.getMonth(), st.lastDue.getDate(), 9) : new Date();
    state.injections.push({ id: uid(), ts: dt.toISOString(), date: ymd(dt), dose: state.settings.injectionDose || '', site: $('#injSite')?.value || '' });
    save(); render(); toast('Injection logged');
  },
  delInj: el => { if (confirm('Delete this injection log?')) { state.injections = state.injections.filter(i => i.id !== el.dataset.id); save(); render(); } },
  addK: el => {
    const n = +el.dataset.n; const d = day(ui.dailyDate);
    addFoodEntry(d, { id: uid(), ts: nowFor(ui.dailyDate), meal: 'snacks', name: 'Quick calories', qty: 1, grams: 0, servingGrams: 0, servingLabel: `+${n} kcal`, kcal: n, protein: 0, fat: 0, carbs: 0, source: 'quick' });
    save(); render();
  },
  addW: el => { const d = day(ui.dailyDate); d.waterOz = Math.max(0, d.waterOz + +el.dataset.n); save(); render(); },
  sleep: el => { const d = day(ui.dailyDate); d.sleep = Math.max(0, Math.min(14, (d.sleep ?? 7) + (d.sleep == null ? 0 : +el.dataset.n))); save(); render(); },
  dz: el => { const d = day(ui.dailyDate); d.dizzy = el.dataset.v === 'yes'; if (d.dizzy) state.dizzyEvents.push({ ts: new Date().toISOString(), sessionId: null, note: 'daily log' }); save(); render(); },
  dday: el => { const nd = addDays(parseYmd(ui.dailyDate), +el.dataset.n); if (nd > new Date()) return; ui.dailyDate = ymd(nd); render(); },
  weighIn: () => { const v = parseFloat($('#wiVal').value); if (!(v > 50)) return toast('Enter your weight'); addBw(ymd(), v); },
  addBw: () => { const v = parseFloat($('#bwVal').value); const dt = $('#bwDate').value; if (!(v > 50) || !dt) return toast('Enter date and weight'); addBw(dt, v); },
  delBw: el => { if (confirm('Delete this weigh-in?')) { state.bodyweight = state.bodyweight.filter(b => b.date !== el.dataset.d); save(); render(); } },
  delSession: el => { if (confirm('Delete this session?')) { state.sessions = state.sessions.filter(s => s.id !== el.dataset.id); save(); render(); } },
  metric: el => { ui.metric = el.dataset.m; render(); },
  cal: el => { ui.calMonth = new Date(ui.calMonth.getFullYear(), ui.calMonth.getMonth() + +el.dataset.n, 1); render(); },
  newCycle: () => { state.settings.cycleStart = ymd(mondayOf(new Date())); save(); render(); toast('Week 1 starts this week'); },
  testAlarm: () => alarm(),
  summary: el => summarySheet(el.dataset.id),
  summaryShare: async el => {
    const sm = sessionSummary(el.dataset.id); if (!sm) return; const text = summaryText(sm);
    if (navigator.share) { try { await navigator.share({ title: 'Rep workout', text }); return; } catch (err) { if (err && err.name === 'AbortError') return; } }
    try { await navigator.clipboard.writeText(text); toast('Summary copied'); } catch { toast('Copy failed'); }
  },
  exNote: el => exNoteSheet(el.dataset.ex),
  exNoteSave: el => { const v = ($('#exNoteText')?.value || '').trim(); if (v) state.exNotes[el.dataset.ex] = v.slice(0, 140); else delete state.exNotes[el.dataset.ex]; save(); closeSheet(); render(); toast(v ? 'Note saved' : 'Note cleared'); },
  exNoteClear: el => { delete state.exNotes[el.dataset.ex]; save(); closeSheet(); render(); toast('Note cleared'); },
  resetProgram: () => { if (confirm('Reset program to Coach Dre default? Your logs are kept.')) { resetProgram(); render(); } },
  backupShare: async () => {
    const r = await shareOrDownloadBackup(state);
    if (r === 'aborted') return toast('Backup cancelled');
    state.settings.lastBackupAt = new Date().toISOString(); save(); render();
    toast(r === 'shared' ? 'Shared — pick Drive in the sheet' : 'Backup downloaded');
  },
  checkIn: () => checkInSheet(),
  checkInCopy: async () => {
    const c = buildCheckIn(new Date());
    try { await navigator.clipboard.writeText(c.text); toast('Copied — paste to Coach Dre'); }
    catch { checkInSheet(); toast('Open check-in to copy'); }
  },
  checkInShare: async () => {
    const c = buildCheckIn(new Date());
    if (navigator.share) {
      try { await navigator.share({ title: 'Rep weekly check-in', text: c.text }); toast('Shared'); return; }
      catch (err) { if (err && err.name === 'AbortError') return; }
    }
    try { await navigator.clipboard.writeText(c.text); toast('Copied — paste to Coach Dre'); } catch { toast('Copy failed'); }
  },
  export: async () => {
    const r = await shareOrDownloadBackup(state);
    if (r === 'aborted') return;
    state.settings.lastBackupAt = new Date().toISOString(); save(); render();
    toast(r === 'shared' ? 'Shared — pick Drive in the sheet' : 'Backup downloaded');
  },
  import: () => $('#importFile').click(),
  renphoPick: () => $('#renphoFile').click(),
  renphoUnit: el => { ui.renpho.unit = el.dataset.u; renphoSheet(); },
  renphoMode: el => { ui.renpho.mode = el.dataset.m; renphoSheet(); },
  renphoImport: () => {
    const R = ui.renpho; const p = parseRenpho(R.text, { unit: R.unit || undefined }); if (!p.ok) return;
    const m = mergeBodyweight(state.bodyweight, p.rows, R.mode, { bodyComp: R.comp });
    state.bodyweight = m.list; save(); closeSheet(); ui.renpho = null; render();
    toast(`Imported ${m.added} new day${m.added === 1 ? '' : 's'}${m.updated ? `, ${m.updated} updated` : ''}${m.kept ? `, ${m.kept} kept` : ''}`);
  },
  resetAll: () => { if (confirm('Erase ALL data on this device? Export a backup first.') && confirm('Really erase everything?')) { resetAll(); stopTimer(); render(); toast('All data erased'); } },
  timerAdd: el => { if (state.timer) { state.timer.end += +el.dataset.n * 1000; state.timer.total += +el.dataset.n; save(); renderTimer(); } },
  timerSkip: () => stopTimer(),
};

function mealNow(h = new Date().getHours()) { return h < 10 ? 'breakfast' : h < 15 ? 'lunch' : h < 21 ? 'dinner' : 'snacks'; }
function nowFor(k) { return k === ymd() ? new Date().toISOString() : new Date(parseYmd(k).getTime() + 12 * 3600000).toISOString(); }
function addProtein(g, label) {
  const d = day(ui.dailyDate);
  const grams = Math.round(+g);
  if (!(grams > 0)) return;
  addFoodEntry(d, {
    id: uid(), ts: nowFor(ui.dailyDate), meal: 'snacks', name: label || 'Protein',
    qty: 1, grams: 0, servingGrams: 0, servingLabel: `+${grams} g`,
    kcal: grams * 4, protein: grams, fat: 0, carbs: 0, source: 'quick',
  });
  save(); render();
  toast(`+${grams} g${label ? ' · ' + label : ''}`);
}
function delProtein(id, { toastOff = false } = {}) {
  const d = day(ui.dailyDate);
  d.foodLog = (d.foodLog || []).filter(e => e.id !== id);
  d.proteinLog = (d.proteinLog || []).filter(e => e.id !== id);
  if (d.suppProtein) for (const [k, v] of Object.entries(d.suppProtein)) if (v === id) delete d.suppProtein[k];
  syncDay(d); save(); render();
  if (!toastOff) toast('Entry deleted');
}

function addBw(date, lb) {
  state.bodyweight = state.bodyweight.filter(b => b.date !== date); state.bodyweight.push({ date, lb });
  state.bodyweight.sort((a, b) => a.date.localeCompare(b.date)); save(); render(); toast(`Saved ${lb} lb`);
}

const changes = {
  renphoComp: el => { ui.renpho.comp = el.checked; },
  inc: el => { const v = parseFloat(el.value); const def = defaultIncrement(exercise(el.dataset.id)); if (v > 0 && v !== def) state.settings.increments[el.dataset.id] = v; else delete state.settings.increments[el.dataset.id]; save(); toast('Weight step saved'); },
  badDayPre: el => { ui.badDay = el.checked; if (ui.pre && $('#sheet').classList.contains('open')) precheckSheet(ui.pre.w); else render(); },
  badDay: el => { state.active.badDay = el.checked; save(); render(); },
  progEx: el => { ui.progEx = el.value; render(); },
  suppName: el => { const x = state.supplements.find(y => y.id === el.dataset.id); if (x) { x.name = el.value; delete x.example; save(); } },
  suppProt: el => { const x = state.supplements.find(y => y.id === el.dataset.id); if (x) { const g = Math.max(0, +el.value || 0); if (g) x.proteinG = g; else delete x.proteinG; save(); } },
  suppDose: el => { const x = state.supplements.find(y => y.id === el.dataset.id); if (x) { x.dose = el.value; delete x.example; save(); } },
  suppTiming: el => { const x = state.supplements.find(y => y.id === el.dataset.id); if (x) { x.timing = el.value; delete x.example; save(); render(); } },
  qfName: el => { const f = state.quickFoods.find(y => y.id === el.dataset.id); if (f) { f.name = el.value; save(); } },
  qfG: el => { const f = state.quickFoods.find(y => y.id === el.dataset.id); if (f) { f.g = Math.max(0, +el.value || 0); save(); } },
  injDay: el => { state.settings.injectionDay = +el.value; save(); toast('Injection day saved'); },
  injWin: el => { state.settings.injectionWindowDays = Math.max(1, Math.min(4, +el.value || 2)); save(); },
  injDose: el => { state.settings.injectionDose = el.value; save(); },
  setK: el => { /* kcal is derived from the food log */ },
  setSteps: el => { day(ui.dailyDate).steps = Math.max(0, +el.value || 0); save(); render(); },
  setSleep: el => { day(ui.dailyDate).sleep = el.value === '' ? null : +el.value; save(); render(); },
  dzNote: el => { day(ui.dailyDate).dizzyNote = el.value; save(); },
  sched: el => { const v = el.value; state.settings.schedule[+el.dataset.d] = v.startsWith('lift:') ? { type: 'lift', workout: v.slice(5) } : { type: v }; save(); toast('Schedule saved'); },
  weeklyTarget: el => { state.settings.weeklyTarget = Math.max(1, Math.min(7, +el.value || 4)); save(); },
  cycleStart: el => { if (el.value) { state.settings.cycleStart = el.value; save(); render(); } },
  deloadEnabled: el => { state.settings.deloadEnabled = el.checked; save(); render(); },
  restFirst: el => { state.settings.rest.first = +el.value; save(); render(); },
  restOther: el => { state.settings.rest.other = +el.value; save(); render(); },
  sound: el => { state.settings.sound = el.checked; save(); },
  vibrate: el => { state.settings.vibrate = el.checked; save(); },
  voice: el => { state.settings.voice = el.checked; save(); },
  voiceWarn: el => { state.settings.voiceWarn = el.checked; save(); },
  restNotify: async el => {
    if (!el.checked) { state.settings.restNotify = false; save(); return; }
    if (!('Notification' in window)) { el.checked = false; return toast('Notifications not supported here'); }
    const p = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
    state.settings.restNotify = p === 'granted'; el.checked = state.settings.restNotify; save();
    toast(p === 'granted' ? 'Rest notifications on' : 'Notifications blocked — allow them in Chrome site settings');
  },
  barWeight: el => { state.settings.barWeight = Math.max(0, +el.value || 45); save(); toast('Bar weight saved'); },
  trapBarWeight: el => { state.settings.trapBarWeight = Math.max(0, +el.value || 45); save(); toast('Trap bar weight saved'); },
  target: el => { state.settings.targets[el.dataset.k] = Math.max(0, +el.value || 0); save(); toast('Saved'); },
  goalWeight: el => { state.settings.goalWeight = +el.value || 200; save(); },
  wname: el => { state.program.workouts[+el.dataset.w].name = el.value; save(); },
  pex: el => { state.program.workouts[+el.dataset.w].exercises[+el.dataset.x].ex = el.value; save(); toast('Program updated'); },
  psets: el => { state.program.workouts[+el.dataset.w].exercises[+el.dataset.x].sets = Math.max(1, Math.min(6, +el.value || 3)); save(); },
  plo: el => { state.program.workouts[+el.dataset.w].exercises[+el.dataset.x].reps[0] = Math.max(1, +el.value || 1); save(); },
  phi: el => { state.program.workouts[+el.dataset.w].exercises[+el.dataset.x].reps[1] = Math.max(1, +el.value || 1); save(); },
};

// =========================================================== timer / audio / wake lock
let actx = null;
function unlockAudio() { try { if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === 'suspended') actx.resume(); } catch (e) { } }
function beep(t0, f, dur) { const o = actx.createOscillator(), g = actx.createGain(); o.type = 'square'; o.frequency.value = f; g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.35, t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur); o.connect(g).connect(actx.destination); o.start(t0); o.stop(t0 + dur + 0.02); }
function speak(text) {
  try {
    if (!('speechSynthesis' in window)) return;
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1; u.pitch = 1; u.volume = 1;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  } catch (e) { }
}
function alarm() {
  if (state.settings.vibrate && navigator.vibrate) navigator.vibrate([400, 150, 400, 150, 400]);
  if (state.settings.sound) { unlockAudio(); if (actx) { const t = actx.currentTime; beep(t, 880, 0.18); beep(t + 0.25, 880, 0.18); beep(t + 0.5, 1320, 0.4); } }
  if (state.settings.voice !== false) speak('Rest over, next set');
}
function startTimer(sec, label) { state.timer = { end: Date.now() + sec * 1000, total: sec, label, warned: false, fired: false }; save(); renderTimer(); }
function stopTimer() { state.timer = null; save(); renderTimer(); }
function renderTimer() {
  const el = $('#timer'); const t = state.timer;
  if (!t || !state.active) { el.classList.remove('show'); el.innerHTML = ''; return; }
  const left = Math.max(0, Math.ceil((t.end - Date.now()) / 1000));
  if (!el.classList.contains('show') || !el.querySelector('.tleft')) {
    el.innerHTML = `<div class="tbar"><i></i></div><div class="trow"><button class="tbtn" data-act="timerAdd" data-n="-15">−15</button>
      <div class="tmid"><small>REST · next set</small><b class="tleft"></b></div><button class="tbtn" data-act="timerAdd" data-n="15">+15</button><button class="tbtn skip" data-act="timerSkip">Skip</button></div>`;
    el.classList.add('show');
  }
  el.querySelector('.tleft').textContent = left ? fmtSec(left) : 'GO!';
  el.querySelector('.tbar i').style.width = `${(left / t.total) * 100}%`;
  el.classList.toggle('done', !left);
}
function tick() {
  const t = state.timer;
  if (t) {
    const left = Math.ceil((t.end - Date.now()) / 1000);
    if (!t.warned && left > 0 && left <= 10 && state.settings.voiceWarn !== false) {
      t.warned = true; save();
      speak('10 seconds');
      if (state.settings.vibrate && navigator.vibrate) navigator.vibrate([80, 60, 80]);
    }
    if (!t.fired && Date.now() >= t.end) { t.fired = true; save(); alarm(); if (document.hidden) notifyRest(t); setTimeout(() => { if (state.timer && state.timer.fired) stopTimer(); }, 4000); }
    renderTimer();
  }
  const e = $('#elapsed'); if (e && state.active) e.textContent = fmtSec((Date.now() - new Date(state.active.start)) / 1000);
}
// Rest-over notification when the app is in the background (Strong / Hevy style).
let notifyT = null;
async function notifyRest(t) {
  if (!state.settings.restNotify || t.notified || typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  t.notified = true; save();
  const opts = { body: `Next set${t.label ? ' · ' + t.label : ''}. Leave 2 in the tank.`, tag: 'rep-rest', renotify: true, vibrate: [400, 150, 400], icon: 'icons/icon-192.png', badge: 'icons/icon-192.png' };
  try { const reg = await navigator.serviceWorker?.getRegistration(); if (reg) return reg.showNotification('Rest over 💪', opts); new Notification('Rest over 💪', opts); } catch (e) { }
}
function scheduleRestNotify() {
  clearTimeout(notifyT); notifyT = null;
  const t = state.timer;
  if (!document.hidden || !t || t.fired || !state.active || !state.settings.restNotify) return;
  notifyT = setTimeout(() => { const cur = state.timer; if (cur && document.hidden && !cur.notified) notifyRest(cur); }, Math.max(0, t.end - Date.now()));
}
async function clearRestNotify() { try { const reg = await navigator.serviceWorker?.getRegistration(); (await reg?.getNotifications({ tag: 'rep-rest' }) || []).forEach(n => n.close()); } catch (e) { } }

let wl = null;
async function wake(on) { try { if (on && 'wakeLock' in navigator) wl = await navigator.wakeLock.request('screen'); else if (!on && wl) { await wl.release(); wl = null; } } catch (e) { } }

let toastT;
function toast(msg) { const el = $('#toast'); el.textContent = msg; el.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('show'), 1800); }

// =========================================================== wiring
document.addEventListener('click', e => {
  const t = e.target.closest('[data-tab]');
  if (t && t.closest('.tabbar')) return go(t.dataset.tab);
  const el = e.target.closest('[data-act]');
  if (el && !el.disabled && actions[el.dataset.act]) { e.preventDefault(); actions[el.dataset.act](el, e); }
});
document.addEventListener('change', e => { const el = e.target.closest('[data-change]'); if (el && changes[el.dataset.change]) changes[el.dataset.change](el); });
document.addEventListener('input', e => {
  const el = e.target; if (el.dataset.input !== 'set' || !state.active) return;
  const s = visible(state.active)[+el.dataset.i].sets[+el.dataset.j]; s[el.dataset.f] = el.value === '' ? '' : +el.value; save();
});
document.addEventListener('pointerdown', unlockAudio, { once: true });
let sw = null;
document.addEventListener('pointerdown', e => { const row = e.target.closest('.swipe'); if (row && !e.target.closest('button')) sw = { row, x: e.clientX, y: e.clientY, dx: 0 }; });
document.addEventListener('pointermove', e => {
  if (!sw) return; sw.dx = Math.min(0, e.clientX - sw.x);
  if (Math.abs(e.clientY - sw.y) > 30 && Math.abs(sw.dx) < 20) { sw.row.style.transform = ''; sw = null; return; }
  sw.row.style.transform = `translateX(${sw.dx}px)`; sw.row.classList.toggle('arm', sw.dx < -90);
});
const endSwipe = () => { if (!sw) return; const { row, dx } = sw; sw = null; if (dx < -90) { row.style.transform = 'translateX(-110%)'; setTimeout(() => delProtein(row.dataset.id), 150); } else { row.style.transform = ''; row.classList.remove('arm'); } };
document.addEventListener('pointerup', endSwipe); document.addEventListener('pointercancel', endSwipe);
document.addEventListener('change', e => {
  if (e.target.id === 'renphoFile') {
    const f = e.target.files[0]; if (!f) return; const rd = new FileReader();
    rd.onload = () => { ui.renpho = { text: String(rd.result), name: f.name, unit: null, mode: 'keep', comp: true }; e.target.value = ''; renphoSheet(); };
    rd.readAsText(f); return;
  }
  if (e.target.id !== 'importFile') return; const f = e.target.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    try { const j = JSON.parse(r.result); const data = j.data || j; if (!Array.isArray(data.sessions)) throw new Error('bad file');
      if (confirm(`Restore backup with ${data.sessions.length} sessions? This replaces data on this device.`)) { replaceState(data); render(); toast('Backup restored'); }
    } catch (err) { toast('Not a valid Rep backup'); }
  };
  r.readAsText(f);
});
document.addEventListener('visibilitychange', () => { if (!document.hidden) { clearRestNotify(); if (state.active) wake(true); } scheduleRestNotify(); tick(); });
window.addEventListener('hashchange', () => { const h = location.hash.slice(1); if (TABS.includes(h) && h !== tab) { closeSheet(); tab = h; render(); } });

setInterval(tick, 250);
// Home-screen shortcuts (long-press the Rep icon): ?go=workout | food | weigh
const shortcut = new URLSearchParams(location.search).get('go');
if (shortcut) {
  history.replaceState(null, '', location.pathname + (shortcut === 'food' ? '#daily' : shortcut === 'weigh' ? '#progress' : '#today'));
  tab = shortcut === 'food' ? 'daily' : shortcut === 'weigh' ? 'progress' : 'today';
}
render();
if (shortcut === 'food') { ui.dailyDate = ymd(); foodSearchSheet(mealNow()); }
else if (shortcut === 'weigh') setTimeout(() => { const el = $('#bwVal'); if (el) { el.scrollIntoView({ block: 'center' }); el.focus(); } }, 60);
else if (shortcut === 'workout' && !state.active) { const sc = scheduleFor(new Date()); const w = sc.type === 'lift' ? sc.workout : nextInRotation().id; if (!doneSessions().some(x => x.date === ymd() && x.workoutId === w)) precheckSheet(w); }
if (state.active) wake(true);
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  const hadController = !!navigator.serviceWorker.controller; let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController && !refreshing) { refreshing = true; location.reload(); } });
  navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(() => { });
}

// test hook (used by scripts/e2e.mjs)
window.__rep = {
  get state() { return state; }, render, injectionStatus, suppAdherence, injLine,
  buildCheckIn, estimateExpenditure, sessionSummary, summarySheet, compareSet, plateBreakdown, formatPlates, wantsPlates, barFor,
  lossRate, projectGoal, muscleRiskFlag, movingAverage, needsBackupReminder,
  swapSuggestion, shareOrDownloadBackup, embedUrl, watchUrl, demoUrl,
  searchFoods, lookupBarcode, syncedTotals, scaleFood, goDaily: k => { ui.dailyDate = k; tab = 'daily'; location.hash = 'daily'; render(); },
};
