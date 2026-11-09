import { state, save, ymd, parseYmd, mondayOf, addDays, day, replaceState, resetAll, resetProgram, clone, uid, recalcProtein } from './store.js';
import { EXERCISES, MUSCLES, exercise, demoUrl, alternatives } from './exercises.js';
import { PROGRESSION, BODYWEIGHT, SUPP_TIMINGS } from './program.js';
import { WD, WD_LONG, workoutById, doneSessions, programWeek, scheduleFor, nextInRotation, suggest, fmtW,
  historyFor, e1rm, recovery, recColor, streak, trainingDays, round, suppAdherence, suppStreak, injectionStatus } from './logic.js';
import { bodySvg } from './body.js';
import { lineChart, barChart } from './charts.js';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtNum = n => Number(n || 0).toLocaleString();
const TABS = ['today', 'progress', 'recovery', 'daily', 'settings'];

let tab = TABS.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'today';
let ui = { choice: null, badDay: false, dailyDate: ymd(), progEx: null, metric: 'e1rm', calMonth: new Date(), pre: null, swap: null };

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
  if (injectionStatus().status !== 'done') h += injectionCard(true);

  const doneToday = doneSessions().filter(s => s.date === ymd());
  const wid = ui.choice || (sch.type === 'lift' ? sch.workout : null);
  if (doneToday.length && !ui.choice) {
    h += `<section class="card done-card"><div class="row between"><h2>✓ ${esc(doneToday.map(s => s.workoutName).join(' + '))} done</h2></div>
      <p class="muted">${doneToday.map(s => `${s.exercises.reduce((a, e) => a + e.sets.length, 0)} sets`).join(', ')} logged. Nice work, Boss. Hit protein and steps.</p>
      <button class="btn ghost" data-act="choose">Train another workout</button></section>`;
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
    <div class="row"><input id="wiVal" class="inp big" type="number" inputmode="decimal" step="0.1" placeholder="${last ? last.lb : 255}"><span class="unit">lb</span>
    <button class="btn primary" data-act="weighIn">Save</button></div></section>`;
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
  let h = `<div class="safety"><span>⚠️ Dizzy or lightheaded? <b>Stop, sit down, sip fluids.</b></span><button class="btn danger sm" data-act="dizzy">I feel dizzy</button></div>`;
  h += `<header class="hero tight"><div class="eyebrow">Week ${a.week}${a.deload ? ' · DELOAD' : ''} · RIR 2</div>
    <div class="row between"><h1>${esc(a.workoutName)}</h1><span class="clock" id="elapsed">0:00</span></div>
    <label class="toggle"><input type="checkbox" data-change="badDay" ${a.badDay ? 'checked' : ''}><span></span>Bad day <small>(2 lifts × 2 sets)</small></label></header>`;
  if (a.deload) h += `<div class="banner deload"><b>Deload:</b> 2 sets at ~90% weight. Smooth reps, no grinding.</div>`;
  if (a.paused) h += `<div class="banner danger"><b>Session paused</b> — dizziness logged. Only resume once fully recovered. <button class="btn sm" data-act="dizzyResume">Resume</button></div>`;
  visible(a).forEach(({ e, sets }, i) => {
    const ex = exercise(e.exId); const sg = e.suggestion;
    const rest = i === 0 ? state.settings.rest.first : state.settings.rest.other;
    h += `<section class="card ex"><div class="row between top"><div><div class="eyebrow">Lift ${i + 1} · rest ${fmtSec(rest)}</div>
      <h2>${esc(ex.name)}</h2><div class="muted sm">${esc(ex.equipment)}${ex.perHand ? ' · weight per dumbbell' : ''}</div></div>
      <div class="exbtns"><button class="icon" data-act="info" data-ex="${e.exId}" aria-label="Form cues">ⓘ</button><button class="icon" data-act="swap" data-i="${i}" aria-label="Swap">⇄</button></div></div>
      <div class="chips"><span class="chip accent">${e.reps[0]}–${e.reps[1]} reps${e.note ? ' ' + esc(e.note) : ''}</span><span class="chip">RIR 2</span>${sg.last ? `<span class="chip">Last: ${esc(sg.last)}</span>` : ''}</div>
      <div class="suggest ${sg.up ? 'up' : ''}">${sg.up ? '▲ ' : ''}${esc(sg.text)}</div>
      <div class="sethead"><span>Set</span><span>Weight (lb)</span><span>Reps</span><span></span></div>
      ${sets.map((s, j) => setRow(i, j, s)).join('')}</section>`;
  });
  h += `<div class="finish"><button class="btn primary xl" data-act="finish">Finish workout</button><button class="btn ghost" data-act="discard">Discard</button></div>`;
  return h;
}
function setRow(i, j, s) {
  return `<div class="set ${s.done ? 'done' : ''}">
    <div class="setn">${j + 1}</div>
    <div class="stepper"><button data-act="step" data-i="${i}" data-j="${j}" data-f="weight" data-d="-5">−</button>
      <input data-input="set" data-i="${i}" data-j="${j}" data-f="weight" type="number" inputmode="decimal" step="2.5" value="${s.weight}" placeholder="lb">
      <button data-act="step" data-i="${i}" data-j="${j}" data-f="weight" data-d="5">+</button></div>
    <div class="stepper reps"><button data-act="step" data-i="${i}" data-j="${j}" data-f="reps" data-d="-1">−</button>
      <input data-input="set" data-i="${i}" data-j="${j}" data-f="reps" type="number" inputmode="numeric" value="${s.reps}" placeholder="reps">
      <button data-act="step" data-i="${i}" data-j="${j}" data-f="reps" data-d="1">+</button></div>
    <button class="check" data-act="toggleSet" data-i="${i}" data-j="${j}" aria-label="Complete set">✓</button></div>`;
}
const fmtSec = s => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;

// =========================================================== PROGRESS
function viewProgress() {
  const st = streak();
  let h = `<header class="hero"><h1>Progress</h1></header>`;
  h += `<section class="card streak"><div class="flame">🔥</div><div><div class="big">${st.weeks}-week streak</div><div class="muted">This week ${st.thisWeek}/${st.target} training days (lifts + classes)</div></div></section>`;
  h += `<section class="card"><div class="row between"><h3>Protein · last 7 days</h3><span class="chip">goal ${state.settings.targets.protein} g</span></div>${protein7(ymd())}</section>`;
  // bodyweight
  const bw = [...state.bodyweight].sort((a, b) => a.date.localeCompare(b.date));
  const goal = state.settings.goalWeight;
  const first = bw[0], cur = bw[bw.length - 1];
  h += `<section class="card"><div class="row between"><h3>Bodyweight</h3><span class="chip">Goal ${goal} lb</span></div>
    <div class="stats"><div><small>Start</small><b>${first ? first.lb : '—'}</b></div><div><small>Current</small><b>${cur ? cur.lb : '—'}</b></div>
    <div><small>Lost</small><b class="accent">${first && cur ? (first.lb - cur.lb).toFixed(1) : '0'}</b></div><div><small>To go</small><b>${cur ? Math.max(0, cur.lb - goal).toFixed(1) : '—'}</b></div></div>
    ${lineChart(bw.map(b => ({ x: parseYmd(b.date).getTime(), y: +b.lb })), { goal, unit: ' lb', label: 'Bodyweight' })}
    <div class="row bwrow"><input id="bwDate" class="inp" type="date" value="${ymd()}"><input id="bwVal" class="inp" type="number" inputmode="decimal" step="0.1" placeholder="lb"><button class="btn primary" data-act="addBw">Add</button></div>
    <ul class="mini">${bw.slice(-6).reverse().map(b => `<li><span>${b.date}</span><b>${b.lb} lb</b><button class="link" data-act="delBw" data-d="${b.date}">✕</button></li>`).join('')}</ul></section>`;
  // exercise chart
  const used = new Set(doneSessions().flatMap(s => s.exercises.map(e => e.exId)));
  const prog = state.program.workouts.flatMap(w => w.exercises.map(x => x.ex));
  const opts = [...new Set([...prog, ...used])];
  if (!ui.progEx || !opts.includes(ui.progEx)) ui.progEx = opts.find(id => used.has(id)) || opts[0];
  const hist = historyFor(ui.progEx).reverse();
  const pts = hist.map(hh => {
    const top = hh.ex.sets.reduce((b, s) => (+s.weight > +b.weight ? s : b), hh.ex.sets[0]);
    const best = Math.max(...hh.ex.sets.map(s => e1rm(+s.weight, +s.reps)));
    return { x: new Date(hh.session.start).getTime(), y: ui.metric === 'e1rm' ? Math.round(best) : +top.weight, top };
  });
  const best = pts.length ? Math.max(...pts.map(p => p.y)) : null;
  h += `<section class="card"><h3>Strength</h3>
    <select class="inp" data-change="progEx">${opts.map(id => `<option value="${id}" ${id === ui.progEx ? 'selected' : ''}>${esc(exercise(id).name)}${used.has(id) ? '' : ' (no data)'}</option>`).join('')}</select>
    <div class="seg"><button class="${ui.metric === 'e1rm' ? 'on' : ''}" data-act="metric" data-m="e1rm">Est. 1RM</button><button class="${ui.metric === 'top' ? 'on' : ''}" data-act="metric" data-m="top">Top set</button></div>
    ${best != null ? `<div class="muted sm">Best ${ui.metric === 'e1rm' ? 'est. 1RM' : 'top set'}: <b class="accent">${best} lb</b> · ${pts.length} session${pts.length > 1 ? 's' : ''}</div>` : ''}
    ${lineChart(pts, { unit: ' lb', label: 'Strength' })}
    ${hist.length ? `<ul class="mini">${hist.slice(-5).reverse().map(hh => `<li><span>${hh.session.date}</span><b>${hh.ex.sets.map(s => `${s.weight}×${s.reps}`).join('  ')}</b></li>`).join('')}</ul>` : ''}</section>`;
  h += calendar();
  // history
  const ss = doneSessions().sort((a, b) => b.start.localeCompare(a.start)).slice(0, 12);
  h += `<section class="card"><h3>Recent sessions</h3>${ss.length ? `<ul class="hist">${ss.map(s => `<li><div><b>${esc(s.workoutName)}</b>${s.badDay ? ' <span class="chip sm">bad day</span>' : ''}${s.deload ? ' <span class="chip sm warn">deload</span>' : ''}${s.dizzy ? ' <span class="chip sm danger">dizzy</span>' : ''}
    <small>${s.date} · ${s.exercises.reduce((a, e) => a + e.sets.length, 0)} sets · ${Math.round((new Date(s.end) - new Date(s.start)) / 60000)} min</small></div><button class="link" data-act="delSession" data-id="${s.id}">✕</button></li>`).join('')}</ul>` : '<p class="muted">No sessions yet.</p>'}</section>`;
  return h;
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
    cells += `<div class="cd ${cls}">${d.getDate()}${dizzy.has(k) ? '<i class="dz"></i>' : ''}</div>`;
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
  const rows = Object.keys(MUSCLES).map(m => ({ m, r: rec[m] })).sort((a, b) => (a.r ? a.r.pct : 2) - (b.r ? b.r.pct : 2));
  h += `<section class="card"><h3>Muscles</h3><ul class="reclist">${rows.map(({ m, r }) => `<li><span class="dot" style="background:${recColor(r ? r.pct : null)}"></span><span class="grow">${MUSCLES[m]}</span>
    <small>${r ? `${Math.round(r.hours)} h ago` : 'not trained recently'}</small><b>${r ? Math.round(r.pct * 100) : 100}%</b></li>`).join('')}</ul></section>`;
  return h;
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
  h += proteinHero(k, d, t);
  h += `<section class="card"><div class="row between"><h3>Protein · last 7 days</h3><span class="muted sm">goal ${t.protein} g</span></div>${protein7(k)}</section>`;
  h += suppCard(k, d);
  h += injectionCard(false);
  h += `<section class="card targets"><div class="eyebrow accent">Coach Dre targets</div><div class="macros">
    <div><b>${fmtNum(t.kcal)}</b><small>kcal</small></div><div><b>${t.protein}g</b><small>protein</small></div><div><b>~${t.fat}g</b><small>fat</small></div><div><b>~${t.carbs}g</b><small>carbs</small></div></div>
    <p class="muted sm">Protein first at every meal to hold onto muscle. If appetite is low on tirzepatide, use shakes / Greek yogurt and smaller, more frequent meals.</p></section>`;
  h += `<section class="card"><div class="row between"><h3>Calories <small class="muted">(optional)</small></h3><span class="muted">${fmtNum(d.kcal)} / ${fmtNum(t.kcal)}</span></div>${bar(d.kcal, t.kcal)}
    <div class="quick"><button class="btn" data-act="addK" data-n="100">+100</button><button class="btn" data-act="addK" data-n="250">+250</button><button class="btn" data-act="addK" data-n="500">+500</button><input class="inp sm" type="number" inputmode="numeric" data-change="setK" value="${d.kcal}" aria-label="Calories"></div></section>`;
  h += `<section class="card"><div class="row between"><h3>Water</h3><span class="muted">${d.waterOz} / ${t.waterOz} oz · ${Math.round(d.waterOz / 8)} glasses</span></div>${bar(d.waterOz, t.waterOz, '#3aa0ff')}
    <div class="quick"><button class="btn" data-act="addW" data-n="8">+8 oz</button><button class="btn" data-act="addW" data-n="16">+16 oz</button><button class="btn" data-act="addW" data-n="24">+24 oz</button><button class="btn ghost sm" data-act="addW" data-n="-8">−8</button></div></section>`;
  h += `<section class="card"><div class="row between"><h3>Steps</h3><span class="muted">${sch.type === 'steps' ? `Steps day · ${fmtNum(t.stepsMin)}–${fmtNum(t.stepsMax)}` : `goal ${fmtNum(t.steps)}`}</span></div>${bar(d.steps, t.steps, '#30d158')}
    <div class="quick"><input class="inp" type="number" inputmode="numeric" data-change="setSteps" value="${d.steps}" aria-label="Steps"><button class="btn" data-act="steps" data-n="1000">+1k</button><button class="btn" data-act="steps" data-n="2500">+2.5k</button></div></section>`;
  h += `<section class="card"><div class="row between"><h3>Sleep</h3><span class="muted">hours last night</span></div>
    <div class="stepper big"><button data-act="sleep" data-n="-0.5">−</button><input type="number" inputmode="decimal" step="0.5" data-change="setSleep" value="${d.sleep ?? ''}" placeholder="—"><button data-act="sleep" data-n="0.5">+</button></div></section>`;
  h += `<section class="card"><h3>Dizziness today?</h3><div class="seg"><button class="${d.dizzy === false ? 'on' : ''}" data-act="dz" data-v="no">No</button><button class="${d.dizzy === true ? 'on danger' : ''}" data-act="dz" data-v="yes">Yes</button></div>
    ${d.dizzy ? `<textarea class="inp" data-change="dzNote" rows="2" placeholder="When? What were you doing? Had you eaten?">${esc(d.dizzyNote)}</textarea>
    <p class="muted sm">If dizziness keeps happening, tell your prescriber/doctor. Fainting, chest pain, or confusion → call 911.</p>` : ''}</section>`;
  return h;
}

function fmtTime(ts) { return ts ? new Date(ts).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : '—'; }
function shortDate(dt) { return dt.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }); }

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
  const list = state.supplements;
  if (!list.length) return `<section class="card"><h3>Supplements</h3><p class="muted">No supplements set up.</p><button class="btn ghost" data-act="go" data-tab="settings">Add in Settings</button></section>`;
  const a = suppAdherence(k);
  const groups = SUPP_TIMINGS.map(([tk, tl]) => [tl, list.filter(x => x.timing === tk)]).filter(([, xs]) => xs.length);
  const end = parseYmd(k); let hist = '';
  for (let i = 6; i >= 0; i--) { const dt = addDays(end, -i); const ad = suppAdherence(ymd(dt)); const p = ad ? ad.pct : 0;
    hist += `<div class="sh ${p >= 1 ? 'full' : p > 0 ? 'part' : ''} ${i === 0 ? 'cur' : ''}"><span>${WD[dt.getDay()][0]}</span><b>${Math.round(p * 100)}%</b></div>`; }
  const st = suppStreak();
  return `<section class="card"><div class="row between"><div><div class="eyebrow accent">Supplements</div><h2>${a.n}/${a.total} taken</h2></div>${ring(a.n, a.total, 'sm', '#30d158')}</div>
    ${groups.map(([tl, xs]) => `<div class="sgroup"><div class="lbl">${tl}</div>${xs.map(x => { const ts = d.supps[x.id]; return `<button class="supp ${ts ? 'on' : ''}" data-act="supp" data-id="${x.id}">
      <span class="tick">${ts ? '✓' : ''}</span><span class="grow"><b>${esc(x.name)}</b>${x.example ? ' <span class="chip sm warn">example</span>' : ''}<small>${esc(x.dose)}</small></span><small class="stime">${ts ? fmtTime(ts) : 'tap when taken'}</small></button>`; }).join('')}</div>`).join('')}
    <div class="row between"><h3 class="mt">Last 7 days</h3><span class="chip">🔥 ${st}-day streak</span></div><div class="shist">${hist}</div>
    ${list.some(x => x.example) ? '<p class="muted sm">Items marked <b>example</b> are starters — edit or remove them in Settings → Supplements.</p>' : ''}</section>`;
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
    ${st.status !== 'done' ? `${onToday ? '' : `<select id="injSite" class="inp"><option value="">Site (optional)</option>${sites.map(x => `<option>${x}</option>`).join('')}</select>`}
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
    ${order.map(i => { const x = s.schedule[i]; const v = x.type === 'lift' ? `lift:${x.workout}` : x.type; return `<div class="frow"><label>${WD_LONG[i]}</label><select class="inp" data-change="sched" data-d="${i}">${schedOpt(v)}</select></div>`; }).join('')}
    <div class="frow"><label>Streak target (days/week)</label><input class="inp num" type="number" min="1" max="7" data-change="weeklyTarget" value="${s.weeklyTarget}"></div></section>`;
  const pw = programWeek();
  h += `<section class="card"><h3>Program cycle</h3><p class="muted sm">Currently week ${pw.week} of ${pw.of}${pw.deload ? ' (deload)' : ''}. Week ${state.program.deloadWeek} is a deload.</p>
    <div class="frow"><label>Week 1 started</label><input class="inp" type="date" data-change="cycleStart" value="${s.cycleStart}"></div>
    <label class="toggle"><input type="checkbox" data-change="deloadEnabled" ${s.deloadEnabled ? 'checked' : ''}><span></span>Deload on week ${state.program.deloadWeek}</label>
    <button class="btn ghost" data-act="newCycle">Start new cycle this week</button></section>`;
  h += `<section class="card"><h3>Rest timer</h3>
    <div class="frow"><label>First lift <b>${fmtSec(s.rest.first)}</b></label><input type="range" min="120" max="180" step="15" data-change="restFirst" value="${s.rest.first}"></div>
    <div class="frow"><label>Other lifts <b>${fmtSec(s.rest.other)}</b></label><input type="range" min="45" max="180" step="15" data-change="restOther" value="${s.rest.other}"></div>
    <label class="toggle"><input type="checkbox" data-change="sound" ${s.sound ? 'checked' : ''}><span></span>Sound at end</label>
    <label class="toggle"><input type="checkbox" data-change="vibrate" ${s.vibrate ? 'checked' : ''}><span></span>Vibrate at end</label>
    <button class="btn ghost sm" data-act="testAlarm">Test alarm</button></section>`;
  const tf = [['kcal', 'Calories (kcal)'], ['protein', 'Protein (g)'], ['fat', 'Fat (g)'], ['carbs', 'Carbs (g)'], ['steps', 'Steps goal'], ['stepsMin', 'Steps-day min'], ['stepsMax', 'Steps-day max'], ['waterOz', 'Water (oz)']];
  h += `<section class="card"><h3>Daily targets</h3>${tf.map(([k, l]) => `<div class="frow"><label>${l}</label><input class="inp num" type="number" inputmode="numeric" data-change="target" data-k="${k}" value="${t[k]}"></div>`).join('')}
    <div class="frow"><label>Goal bodyweight (lb)</label><input class="inp num" type="number" data-change="goalWeight" value="${s.goalWeight}"></div></section>`;
  h += `<section class="card"><h3>Program — ${esc(state.program.name)}</h3><p class="muted sm">Edit exercises, sets, and rep ranges. Default lives in <code>src/program.js</code>.</p>
    ${state.program.workouts.map((w, wi) => `<div class="pw"><input class="inp title" data-change="wname" data-w="${wi}" value="${esc(w.name)}">
      ${w.exercises.map((x, xi) => `<div class="pslot"><select class="inp" data-change="pex" data-w="${wi}" data-x="${xi}">${EXERCISES.map(e => `<option value="${e.id}" ${e.id === x.ex ? 'selected' : ''}>${esc(e.name)}</option>`).join('')}</select>
        <div class="row gap"><label class="mini-l">Sets<input class="inp num" type="number" min="1" max="6" data-change="psets" data-w="${wi}" data-x="${xi}" value="${x.sets}"></label>
        <label class="mini-l">Reps<input class="inp num" type="number" data-change="plo" data-w="${wi}" data-x="${xi}" value="${x.reps[0]}"></label>–
        <label class="mini-l"><input class="inp num" type="number" data-change="phi" data-w="${wi}" data-x="${xi}" value="${x.reps[1]}"></label></div></div>`).join('')}</div>`).join('')}
    <button class="btn ghost" data-act="resetProgram">Reset program to Coach Dre default</button></section>`;
  h += `<section class="card"><h3>Supplements</h3><p class="muted sm">Daily checklist on the Daily tab. Reorder with ↑ ↓.</p>
    <div id="suppEditor">${state.supplements.map((x, i) => `<div class="pslot sedit" data-id="${x.id}"><div class="row gap">
      <input class="inp grow" data-change="suppName" data-id="${x.id}" value="${esc(x.name)}" placeholder="Name" aria-label="Supplement name">
      ${x.example ? '<span class="chip sm warn">example</span>' : ''}</div>
      <div class="row gap"><input class="inp sdose" data-change="suppDose" data-id="${x.id}" value="${esc(x.dose)}" placeholder="Dose" aria-label="Dose">
      <select class="inp stiming" data-change="suppTiming" data-id="${x.id}" aria-label="Timing">${SUPP_TIMINGS.map(([v, l]) => `<option value="${v}" ${v === x.timing ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
      <div class="row gap sbtns"><button class="icon" data-act="suppMove" data-id="${x.id}" data-n="-1" ${i === 0 ? 'disabled' : ''} aria-label="Move up">↑</button><button class="icon" data-act="suppMove" data-id="${x.id}" data-n="1" ${i === state.supplements.length - 1 ? 'disabled' : ''} aria-label="Move down">↓</button>
      <span class="grow"></span><button class="btn ghost sm" data-act="suppDel" data-id="${x.id}">Remove</button></div></div>`).join('') || '<p class="muted">No supplements.</p>'}</div>
    <button class="btn primary wide" data-act="suppAdd">+ Add supplement</button></section>`;
  h += `<section class="card"><h3>Protein quick foods</h3><p class="muted sm">One-tap presets on the Daily tab.</p>
    ${state.quickFoods.map(f => `<div class="row gap qfrow"><input class="inp grow" data-change="qfName" data-id="${f.id}" value="${esc(f.name)}" aria-label="Food name"><input class="inp num" type="number" inputmode="numeric" data-change="qfG" data-id="${f.id}" value="${f.g}" aria-label="Grams"><span class="unit">g</span><button class="icon" data-act="qfDel" data-id="${f.id}" aria-label="Remove">✕</button></div>`).join('')}
    <button class="btn ghost wide" data-act="qfAdd">+ Add quick food</button></section>`;
  h += `<section class="card"><h3>Tirzepatide injection</h3><p class="muted sm">Weekly reminder on Today/Daily. Due on the injection day, still "due" the next day, then overdue.</p>
    <div class="frow"><label>Injection day</label><select class="inp" data-change="injDay">${WD_LONG.map((n, i) => `<option value="${i}" ${i === s.injectionDay ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
    <div class="frow"><label>Due window (days)</label><input class="inp num" type="number" min="1" max="4" data-change="injWin" value="${s.injectionWindowDays}"></div>
    <div class="frow"><label>Dose label (optional)</label><input class="inp num wide2" data-change="injDose" value="${esc(s.injectionDose)}" placeholder="e.g. 5 mg"></div></section>`;
  h += `<section class="card"><h3>Data</h3><p class="muted sm">Everything is stored only on this phone. Export a backup regularly.</p>
    <div class="quick"><button class="btn primary" data-act="export">Export JSON</button><button class="btn" data-act="import">Import JSON</button></div>
    <input type="file" id="importFile" accept="application/json,.json" hidden>
    <button class="btn danger wide" data-act="resetAll">Erase all data</button>
    <p class="muted sm">${doneSessions().length} sessions · ${state.bodyweight.length} weigh-ins · ${state.dizzyEvents.length} dizziness events · ${state.injections.length} injections · ${state.supplements.length} supplements</p></section>`;
  h += `<section class="card"><h3>Safety</h3><p class="muted sm">Don't lift fasted. Eat carbs + protein 1–2 h before, drink water/electrolytes. If dizzy or lightheaded: stop, sit or lie down, sip fluids, have some fast carbs. Fainting, chest pain, or confusion → call 911. Tell your prescriber about repeated dizziness.</p>
    <p class="muted sm">Rep v1 · personal use</p></section>`;
  return h;
}

// =========================================================== sheets
function sheet(html, { lock = false } = {}) {
  const m = $('#sheet');
  m.innerHTML = `<div class="backdrop" ${lock ? '' : 'data-act="closeSheet"'}></div><div class="panel"><div class="grab"></div>${html}</div>`;
  m.classList.add('open');
}
function closeSheet() { $('#sheet').classList.remove('open'); $('#sheet').innerHTML = ''; }

function infoSheet(id) {
  const ex = exercise(id);
  const col = m => ex.primary.includes(m) ? '#ff4d1a' : ex.secondary.includes(m) ? '#ff9a73' : null;
  sheet(`<div class="eyebrow accent">${esc(ex.equipment)}</div><h2>${esc(ex.name)}</h2>
    <div class="minibody">${bodySvg('front', col, { cls: 'sm' })}${bodySvg('back', col, { cls: 'sm' })}</div>
    <div class="chips">${ex.primary.map(m => `<span class="chip accent">${MUSCLES[m]}</span>`).join('')}${ex.secondary.map(m => `<span class="chip">${MUSCLES[m]}</span>`).join('')}</div>
    <h3>Form cues</h3><ol class="cues">${ex.cues.map(c => `<li>${esc(c)}</li>`).join('')}<li><b>RIR 2:</b> stop each set with ~2 good reps left.</li></ol>
    <a class="btn primary wide" href="${demoUrl(ex)}" target="_blank" rel="noopener">▶ Watch demo videos (YouTube)</a>
    <button class="btn ghost wide" data-act="closeSheet">Close</button>`);
}

function swapSheet(i) {
  const a = state.active; const cur = visible(a)[i].e;
  const alts = alternatives(cur.exId); const rest = EXERCISES.filter(e => e.id !== cur.exId && !alts.includes(e));
  const item = e => `<li data-act="doSwap" data-i="${i}" data-ex="${e.id}"><b>${esc(e.name)}</b><small>${esc(e.equipment)}</small></li>`;
  sheet(`<h2>Swap ${esc(exercise(cur.exId).name)}</h2>
    <label class="toggle"><input type="checkbox" id="swapSave"><span></span>Also save to program</label>
    <h3>Same movement</h3><ul class="picker">${alts.map(item).join('') || '<li class="muted">None</li>'}</ul>
    <details><summary>All exercises</summary><ul class="picker">${rest.map(item).join('')}</ul></details>
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
    <textarea id="dzNote" class="inp" rows="2" placeholder="Optional note (what you ate, which set…)"></textarea>
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
    sets: Array.from({ length: sg.sets }, (_, j) => ({ weight: sg.weight ?? '', reps: sg.reps[j] ?? '', done: false })) };
}
function finishSession(status = 'done') {
  const a = state.active;
  const exs = visible(a).map(({ e, sets }) => ({ exId: e.exId, reps: e.reps, sets: sets.filter(s => s.done).map(s => ({ weight: +s.weight || 0, reps: +s.reps })) }));
  const total = exs.reduce((n, e) => n + e.sets.length, 0);
  if (!total && status === 'done') { if (!confirm('No sets checked off. Discard this workout?')) return; state.active = null; stopTimer(); save(); wake(false); render(); return; }
  const rec = { ...a, end: new Date().toISOString(), status, exercises: exs };
  delete rec.paused;
  state.sessions.push(rec); state.active = null; stopTimer(); save(); wake(false);
  const vol = exs.reduce((n, e) => n + e.sets.reduce((m, s) => m + s.weight * s.reps, 0), 0);
  const mins = Math.round((new Date(rec.end) - new Date(rec.start)) / 60000);
  render(); window.scrollTo(0, 0);
  sheet(`<div class="dizzy-head">${status === 'done' ? '💪' : '🛑'}</div><h2>${status === 'done' ? 'Workout complete' : 'Session ended & saved'}</h2>
    <div class="stats"><div><small>Sets</small><b>${total}</b></div><div><small>Volume</small><b>${fmtNum(vol)}</b></div><div><small>Minutes</small><b>${mins}</b></div></div>
    <p class="muted">Next up: protein (${day().protein}/${state.settings.targets.protein} g), water, and steps.</p>
    <button class="btn primary wide" data-act="closeSheet">Done</button>`);
}

const actions = {
  go: el => go(el.dataset.tab),
  closeSheet: () => closeSheet(),
  choose: () => chooseSheet(),
  pick: el => { ui.choice = el.dataset.w; closeSheet(); render(); },
  info: el => infoSheet(el.dataset.ex),
  precheck: el => precheckSheet(el.dataset.w),
  pq: el => { ui.pre[el.dataset.k] = el.dataset.v === '1'; precheckSheet(ui.pre.w); },
  start: () => startSession(),
  step: el => {
    const s = visible(state.active)[+el.dataset.i].sets[+el.dataset.j]; const f = el.dataset.f; const d = +el.dataset.d;
    let v = s[f] === '' || s[f] == null ? (f === 'weight' ? (d > 0 ? 0 : 0) : (d > 0 ? 0 : 0)) : +s[f];
    v = Math.max(0, v + d); s[f] = f === 'weight' ? round(v) || v : v;
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
      vis[i].sets.forEach((x, k) => { if (k > j && !x.done && x.weight === '') x.weight = s.weight; });
      const last = i === vis.length - 1 && vis[i].sets.every(x => x.done);
      if (last) { state.timer = null; toast('All sets done — tap Finish 💪'); }
      else if (!a.paused) startTimer(i === 0 ? state.settings.rest.first : state.settings.rest.other, exercise(vis[i].e.exId).name);
      if (navigator.vibrate && state.settings.vibrate) navigator.vibrate(30);
    } else s.done = false;
    save(); render();
  },
  swap: el => swapSheet(+el.dataset.i),
  doSwap: el => {
    const i = +el.dataset.i; const a = state.active; const entry = visible(a)[i].e; const idx = a.exercises.indexOf(entry);
    const saveProg = $('#swapSave')?.checked;
    const w = workoutById(a.workoutId); const slot = { ...(w?.exercises[idx] || { sets: 3, reps: entry.reps }), ex: el.dataset.ex };
    a.exercises[idx] = buildEx(slot, a.deload);
    if (saveProg && w) w.exercises[idx].ex = el.dataset.ex;
    save(); closeSheet(); render(); toast(saveProg ? 'Swapped & saved to program' : 'Swapped for today');
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
  supp: el => { const d = day(ui.dailyDate); const id = el.dataset.id; if (d.supps[id]) delete d.supps[id]; else d.supps[id] = nowFor(ui.dailyDate); save(); render(); },
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
  addK: el => { const d = day(ui.dailyDate); d.kcal = Math.max(0, d.kcal + +el.dataset.n); save(); render(); },
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
  resetProgram: () => { if (confirm('Reset program to Coach Dre default? Your logs are kept.')) { resetProgram(); render(); } },
  export: () => {
    const blob = new Blob([JSON.stringify({ app: 'rep-workout', exportedAt: new Date().toISOString(), data: state }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `rep-backup-${ymd()}.json`; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000); toast('Backup downloaded');
  },
  import: () => $('#importFile').click(),
  resetAll: () => { if (confirm('Erase ALL data on this device? Export a backup first.') && confirm('Really erase everything?')) { resetAll(); stopTimer(); render(); toast('All data erased'); } },
  timerAdd: el => { if (state.timer) { state.timer.end += +el.dataset.n * 1000; state.timer.total += +el.dataset.n; save(); renderTimer(); } },
  timerSkip: () => stopTimer(),
};

function nowFor(k) { return k === ymd() ? new Date().toISOString() : new Date(parseYmd(k).getTime() + 12 * 3600000).toISOString(); }
function addProtein(g, label) {
  const d = day(ui.dailyDate); d.proteinLog.push({ id: uid(), ts: nowFor(ui.dailyDate), g, label }); recalcProtein(d); save(); render();
  toast(`+${g} g${label ? ' · ' + label : ''}`);
}
function delProtein(id) { const d = day(ui.dailyDate); d.proteinLog = d.proteinLog.filter(e => e.id !== id); recalcProtein(d); save(); render(); toast('Entry deleted'); }

function addBw(date, lb) {
  state.bodyweight = state.bodyweight.filter(b => b.date !== date); state.bodyweight.push({ date, lb });
  state.bodyweight.sort((a, b) => a.date.localeCompare(b.date)); save(); render(); toast(`Saved ${lb} lb`);
}

const changes = {
  badDayPre: el => { ui.badDay = el.checked; if (ui.pre && $('#sheet').classList.contains('open')) precheckSheet(ui.pre.w); else render(); },
  badDay: el => { state.active.badDay = el.checked; save(); render(); },
  progEx: el => { ui.progEx = el.value; render(); },
  suppName: el => { const x = state.supplements.find(y => y.id === el.dataset.id); if (x) { x.name = el.value; delete x.example; save(); } },
  suppDose: el => { const x = state.supplements.find(y => y.id === el.dataset.id); if (x) { x.dose = el.value; delete x.example; save(); } },
  suppTiming: el => { const x = state.supplements.find(y => y.id === el.dataset.id); if (x) { x.timing = el.value; delete x.example; save(); render(); } },
  qfName: el => { const f = state.quickFoods.find(y => y.id === el.dataset.id); if (f) { f.name = el.value; save(); } },
  qfG: el => { const f = state.quickFoods.find(y => y.id === el.dataset.id); if (f) { f.g = Math.max(0, +el.value || 0); save(); } },
  injDay: el => { state.settings.injectionDay = +el.value; save(); toast('Injection day saved'); },
  injWin: el => { state.settings.injectionWindowDays = Math.max(1, Math.min(4, +el.value || 2)); save(); },
  injDose: el => { state.settings.injectionDose = el.value; save(); },
  setK: el => { day(ui.dailyDate).kcal = Math.max(0, +el.value || 0); save(); render(); },
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
function alarm() {
  if (state.settings.vibrate && navigator.vibrate) navigator.vibrate([400, 150, 400, 150, 400]);
  if (state.settings.sound) { unlockAudio(); if (actx) { const t = actx.currentTime; beep(t, 880, 0.18); beep(t + 0.25, 880, 0.18); beep(t + 0.5, 1320, 0.4); } }
}
function startTimer(sec, label) { state.timer = { end: Date.now() + sec * 1000, total: sec, label }; save(); renderTimer(); }
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
  if (t && !t.fired && Date.now() >= t.end) { t.fired = true; save(); alarm(); setTimeout(() => { if (state.timer && state.timer.fired) stopTimer(); }, 4000); }
  if (t) renderTimer();
  const e = $('#elapsed'); if (e && state.active) e.textContent = fmtSec((Date.now() - new Date(state.active.start)) / 1000);
}
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
  if (e.target.id !== 'importFile') return; const f = e.target.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    try { const j = JSON.parse(r.result); const data = j.data || j; if (!Array.isArray(data.sessions)) throw new Error('bad file');
      if (confirm(`Restore backup with ${data.sessions.length} sessions? This replaces data on this device.`)) { replaceState(data); render(); toast('Backup restored'); }
    } catch (err) { toast('Not a valid Rep backup'); }
  };
  r.readAsText(f);
});
document.addEventListener('visibilitychange', () => { if (!document.hidden && state.active) wake(true); tick(); });
window.addEventListener('hashchange', () => { const h = location.hash.slice(1); if (TABS.includes(h) && h !== tab) { closeSheet(); tab = h; render(); } });

setInterval(tick, 250);
render();
if (state.active) wake(true);
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('./sw.js').catch(() => { });

// test hook (used by scripts/e2e.mjs)
window.__rep = { get state() { return state; }, render, injectionStatus, suppAdherence };
