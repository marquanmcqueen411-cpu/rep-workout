// End-to-end smoke test in a mobile viewport (412x915). Usage:
//   npm start   (in another shell; serves http://localhost:5173)
//   CHROME=/usr/bin/google-chrome npm run e2e
import { chromium } from 'playwright-core';
import { mkdirSync, readFileSync } from 'node:fs';
import { seedSample } from './sample-data.mjs';

const APP_URL = process.env.URL || 'http://localhost:5173/';
const SHOTS = new URL('../screenshots/', import.meta.url).pathname;
mkdirSync(SHOTS, { recursive: true });
const log = (...a) => console.log('•', ...a);
const assert = (c, m) => { if (!c) throw new Error('ASSERT: ' + m); log('ok -', m); };

const browser = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, acceptDownloads: true, timezoneId: 'America/Los_Angeles' });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

await page.goto(APP_URL);
await page.waitForSelector('.hero');
assert(await page.locator('text=Week 1 of 6').count(), 'program week shown');

// ---- seed some past history (sample data) so charts/recovery have shape
await page.evaluate(seedSample); await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForSelector('.hero');
page.on('dialog', d => d.accept().catch(() => {}));
assert(await page.locator('.inj >> text=Tirzepatide').count(), 'injection card on Today (not logged yet)');

// Keep progression assertions weekday-stable (Wed = L1, etc.)
if (!(await page.locator('.workout-card >> text=Upper A').count())) {
  await page.click('[data-act=choose]');
  await page.click('[data-act=pick][data-w=U1]');
  await page.waitForSelector('.workout-card >> text=Upper A');
}
// ---- v2.0: Coach Brooke final plan — Upper A: bench 4×, then A1/A2 pushdown + curl superset
assert((await page.locator('.workout-card .exlist li').count()) === 6, 'Upper A preview lists 6 exercises');
assert(await page.locator('.workout-card >> text=6 exercises · 19 sets').count(), 'preview copy: 6 exercises · 19 sets');
assert(await page.locator('.workout-card >> text=compounds RIR 2, isolation RIR 1–2').count(), 'preview shows RIR rules');
for (const n of ['Lat Pulldown', 'Cable Triceps Pushdown', 'Dumbbell Curl']) assert(await page.locator(`.workout-card >> text=${n}`).count(), `Upper A includes ${n}`);
assert(JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('.workout-card .exlist .exnum')].map(e => e.textContent))) === JSON.stringify(['1', '2', '3', '4', 'A1', 'A2']), 'superset numbered A1/A2');
assert(await page.locator('.workout-card li[data-ex=bench_press] >> text=4 × 6–8').count(), 'bench 4 × 6–8');
await page.evaluate(() => { document.querySelector('.workout-card').scrollIntoView({ block: 'start' }); window.scrollBy(0, -8); });
await page.waitForTimeout(300);
await page.screenshot({ path: SHOTS + '32-upper-a-preview.png' });
await page.evaluate(() => window.scrollTo(0, 0));

// ---- injection due-window logic (default Saturday, due Sat–Sun, overdue Mon)
const inj = await page.evaluate(() => {
  const R = window.__rep, s = R.state, saved = s.injections;
  s.injections = [{ id: 't', ts: new Date(2026, 9, 31, 9).toISOString(), date: '2026-10-31' }];
  const r = { fri: R.injectionStatus(new Date(2026, 10, 6)).status, sat: R.injectionStatus(new Date(2026, 10, 7)).status, sun: R.injectionStatus(new Date(2026, 10, 8)).status, mon: R.injectionStatus(new Date(2026, 10, 9)).status };
  s.injections.push({ id: 't2', ts: new Date(2026, 10, 8, 9).toISOString(), date: '2026-11-08' });
  r.monAfter = R.injectionStatus(new Date(2026, 10, 9)).status;
  s.injections = saved; return r;
});
assert(inj.fri === 'done' && inj.sat === 'due' && inj.sun === 'due' && inj.mon === 'overdue' && inj.monAfter === 'done', 'injection window: Sat due, Sun due, Mon overdue, Sun-logged = done ' + JSON.stringify(inj));

// ---- Monday weigh-in prompt (only shows on Mondays)
if (new Date().getDay() === 1) {
  assert(await page.locator('text=Monday weigh-in').count(), 'Monday weigh-in prompt visible');
  await page.fill('#wiVal', '252.4'); await page.click('[data-act=weighIn]');
}

// ---- workout preview: progression suggestion for bench (hit 8/8/8 @180 → +5 = 185)
assert(await page.locator('.workout-card >> text=185 lb').count(), 'bench suggestion +5 lb (185)');

// Built-in demo (lazy iframe, youtube-nocookie)
await page.click('.exlist [data-act=info][data-ex=bench_press]');
await page.waitForSelector('.panel >> text=Form cues');
await page.click('.panel [data-act=demo]');
await page.waitForSelector('.panel .demo-frame, .panel .demo-offline');
assert(await page.locator('.panel iframe.demo-frame').count(), 'demo sheet renders an iframe');
assert((await page.locator('.panel iframe.demo-frame').getAttribute('src') || '').includes('youtube-nocookie.com/embed/BYKScL2sgCs'), 'embed uses verified nocookie URL');
await page.waitForTimeout(400);
await page.screenshot({ path: SHOTS + '24-demo-video.png' });
await page.click('.panel [data-act=closeSheet]');

await page.click('[data-act=precheck]');
await page.click('[data-act=pq][data-k=ate][data-v="0"]');
assert(await page.locator("text=Don't lift fasted").count(), 'fasted warning shown');
await page.screenshot({ path: SHOTS + '05-precheck-warning.png' });
await page.click('[data-act=pq][data-k=ate][data-v="1"]');
await page.click('[data-act=pq][data-k=water][data-v="1"]');
await page.click('[data-act=pq][data-k=ok][data-v="1"]');
await page.click('[data-act=start]');
await page.waitForSelector('.safety');
assert(await page.locator('.safety >> text=Dizzy?').count() && await page.locator('.safety >> text=I feel dizzy').count(), 'persistent dizzy reminder');

// lift 1: bench — check prefilled values
const w0 = await page.inputValue('input[data-i="0"][data-j="0"][data-f="weight"]');
assert(w0 === '185', 'bench weight prefilled 185');
const sgText = i => page.textContent(`section.card.ex:nth-of-type(${i}) .suggest`);
const cards = page.locator('section.card.ex');
assert((await cards.nth(0).locator('.suggest').textContent()).includes('Hit 8,8,8 at 180 last time → 185 today (+5 lb).'), 'bench explanation: Hit 8,8,8 at 180 → 185 (+5 lb)');
assert((await cards.nth(0).locator('.targets').textContent()).includes('185×6'), 'per-set targets shown (185×6)');
assert((await cards.nth(0).locator('.warm').textContent()).includes('45×10'), 'warm-up ramp shown for first lift (bar 45×10 …)');
assert((await cards.nth(1).locator('.suggest').textContent()).includes('Hit 10,10,9 at 145 → stay at 145, aim 10,10,10.'), 'row double progression per set (10,10,10)');
assert((await cards.nth(2).locator('.suggest').textContent()).includes('→ 55 today (+5 lb/hand (next DB up))'), 'DB shoulder press +5/hand');
// bump reps on set 1 via stepper, then check off → PR (185×7 beats 180×8 e1RM; heaviest ever)
await page.click('[data-act=step][data-i="0"][data-j="0"][data-f="reps"][data-d="1"]');
await page.click('[data-act=toggleSet][data-i="0"][data-j="0"]');
await page.waitForSelector('#pr.show >> text=NEW PR');
log('ok - PR celebration shown');
await page.waitForTimeout(450);
await page.screenshot({ path: SHOTS + '11-pr-celebration.png' });
await page.waitForSelector('#timer.show');
const t = await page.textContent('.tleft');
assert(/^2:(2|3)\d$/.test(t), `first-lift rest timer ~150 s (${t})`);
await page.click('[data-act=rir][data-i="0"][data-j="0"][data-v="2"]');
await page.click('[data-act=toggleSet][data-i="0"][data-j="1"]');
await page.click('[data-act=rir][data-i="0"][data-j="1"][data-v="1"]');
assert((await page.evaluate(() => window.__rep.state.active.exercises[0].sets.map(s => s.rir))).join() === '2,1,,', 'RIR chips saved per set (4 bench sets)');
await page.waitForTimeout(2600);
await page.evaluate(() => { document.querySelector('section.card.ex').scrollIntoView({ block: 'start' }); window.scrollBy(0, -50); });
await page.screenshot({ path: SHOTS + '01-today-workout-logging.png' });

// ---- v1.8: last time per set + comparison, sticky setup note
assert((await cards.nth(0).locator('.prev').count()) === 4, 'last-time line under every bench set (4 sets)');
assert((await cards.nth(0).locator('.prev').first().textContent()).includes('Last time 180×8'), 'last time shows 180×8');
assert(await cards.nth(0).locator('.prev .cmp').count() >= 1, 'completed set shows comparison vs last time');
await page.click('[data-act=exNote][data-ex=bench_press]');
await page.fill('#exNoteText', 'Safeties on 5 · grip pinky on rings');
await page.click('[data-act=exNoteSave]');
assert((await page.evaluate(() => window.__rep.state.exNotes.bench_press)) === 'Safeties on 5 · grip pinky on rings', 'setup note saved');
assert((await cards.nth(0).locator('.exnote.has').textContent()).includes('Safeties on 5'), 'setup note shown on the lift');
await page.waitForTimeout(2000);
await page.evaluate(() => { document.querySelector('section.card.ex').scrollIntoView({ block: 'start' }); window.scrollBy(0, -60); });
await page.screenshot({ path: SHOTS + '28-last-time-and-setup-note.png' });
// v1.9: banded push-up home swap for bench (after Brooke's ranked 3)
await page.click('[data-act=swap][data-i="0"]');
await page.waitForSelector('.panel >> text=Coach Brooke swaps');
const benchSwaps = await page.evaluate(() => [...document.querySelectorAll('.panel [data-act=doSwap]')].map(e => e.dataset.ex));
assert(JSON.stringify(benchSwaps) === JSON.stringify(['db_bench_press', 'smith_bench_press', 'machine_chest_press', 'banded_pushup']), 'bench swaps: Brooke 3 + banded push-up (home) ' + JSON.stringify(benchSwaps));
assert(await page.locator('.panel >> text=Home').count(), 'banded push-up tagged Home');
await page.click('.panel [data-act=closeSheet]');

// timer end → GO!
await page.evaluate(() => { window.__rep.state.timer.end = Date.now() + 600; });
await page.waitForFunction(() => document.querySelector('.tleft')?.textContent === 'GO!', null, { timeout: 4000 });
log('ok - rest timer fires at end (GO!)');

// dizzy button → pause → resume
await page.click('[data-act=dizzy]');
assert(await page.locator('text=Stop. Sit down. Sip fluids.').count(), 'dizzy guidance sheet');
await page.click('.panel [data-act=dizzyResume]');
assert((await page.evaluate(() => window.__rep.state.dizzyEvents.length)) === 1, 'dizziness event logged');

// finish remaining sets
await page.click('[data-act=toggleSet][data-i="0"][data-j="2"]');
await page.click('[data-act=toggleSet][data-i="0"][data-j="3"]');
// v2.0 superset: A1 set → 60 s rest, next = A2 (alternate sets)
for (const [i, j] of [[4, 0]]) {
  const wSel = `input[data-i="${i}"][data-j="${j}"][data-f="weight"]`, rSel = `input[data-i="${i}"][data-j="${j}"][data-f="reps"]`;
  if (!(await page.inputValue(wSel))) await page.fill(wSel, '50');
  if (!(await page.inputValue(rSel))) await page.fill(rSel, '12');
  await page.click(`[data-act=toggleSet][data-i="${i}"][data-j="${j}"]`);
}
await page.waitForSelector('#timer.show');
const ssT = await page.evaluate(() => ({ total: window.__rep.state.timer.total, label: document.querySelector('#timer .tlabel').textContent }));
assert(ssT.total === 60 && /A2 Dumbbell Curl · set 1/.test(ssT.label), 'superset A1 → 60 s rest, next A2 set 1: ' + JSON.stringify(ssT));
assert(await page.locator('.ssgroup[data-ss=A] section.card.ex').count() === 2 && await page.locator('.ssgroup .sshead >> text=Superset A').count(), 'A1/A2 grouped in the workout');
for (const i of [1, 2, 3, 4, 5]) for (const j of [0, 1, 2]) {
  if (await page.locator(`[data-act=toggleSet][data-i="${i}"][data-j="${j}"].on, [data-act=toggleSet][data-i="${i}"][data-j="${j}"][aria-pressed=true]`).count()) continue;
  if (await page.evaluate(([i, j]) => window.__rep.state.active.exercises[i].sets[j].done, [i, j])) continue;
  // first-ever lifts (no history) need a starting weight + reps
  const wSel = `input[data-i="${i}"][data-j="${j}"][data-f="weight"]`, rSel = `input[data-i="${i}"][data-j="${j}"][data-f="reps"]`;
  if (await page.locator(wSel).count() && !(await page.inputValue(wSel))) await page.fill(wSel, '50');
  if (!(await page.inputValue(rSel))) await page.fill(rSel, '12');
  await page.click(`[data-act=toggleSet][data-i="${i}"][data-j="${j}"]`);
}
const lastTimer = await page.evaluate(() => window.__rep.state.timer);
assert(lastTimer === null, 'no rest timer after final set');
await page.click('[data-act=finish]');
await page.waitForSelector('text=Workout complete');
assert((await page.locator('.panel .sumlifts li').count()) === 6, 'summary lists all 6 exercises');
assert(await page.locator('.panel .sumlifts .cmp').count() >= 1, 'summary shows e1RM change vs last time');
assert(await page.locator('.panel .pr-banner >> text=Barbell Bench Press').count(), 'summary names the PR lift');
await page.evaluate(() => { document.getElementById('pr').classList.remove('show'); document.getElementById('toast').classList.remove('show'); });
await page.waitForTimeout(600);
await page.screenshot({ path: SHOTS + '29-workout-summary.png' });
await page.evaluate(() => { window.__shared = null; navigator.share = async d => { window.__shared = d; }; });
await page.click('.panel [data-act=summaryShare]');
await page.waitForFunction(() => window.__shared);
assert((await page.evaluate(() => window.__shared.text)).includes('Upper A') , 'summary share text built');
await page.click('.panel [data-act=closeSheet]');
await page.click('[data-act=summary]');
await page.waitForSelector('.panel .sumlifts');
log('ok - summary reopens from Today');
await page.click('.panel [data-act=closeSheet]');
const sess = await page.evaluate(() => window.__rep.state.sessions.at(-1));
await page.evaluate(() => window.scrollTo(0, 0));
await page.screenshot({ path: SHOTS + '07-today-done.png' });
assert(sess.exercises.length === 6 && sess.exercises[0].sets.length === 4 && sess.exercises.slice(1).every(e => e.sets.length === 3), 'session saved: bench 4 sets + 5 × 3');
assert(sess.exercises[0].sets[0].reps === 7 && sess.exercises[0].sets[0].weight === 185, 'stepper edit saved (185×7)');
assert(sess.exercises[0].sets[0].rir === 2 && sess.exercises[0].sets[0].pr.includes('e1rm') && sess.exercises[0].sets[0].pr.includes('weight'), 'saved set keeps RIR + PR flags');

// ---- Recovery
await page.waitForTimeout(2000); // let toast clear
await page.click('.tabbar [data-tab=recovery]');
await page.waitForSelector('svg.body');
await page.screenshot({ path: SHOTS + '02-recovery-map.png' });
assert(await page.locator('.wsets .vlist li').count() >= 6, 'sets-per-muscle card lists trained muscles');
assert(parseFloat(await page.locator('.wsets li:has-text("Chest") b').textContent()) >= 3, 'chest: today\'s 3 bench sets counted this week');
await page.evaluate(() => { document.querySelector('.wsets').scrollIntoView({ block: 'start' }); window.scrollBy(0, -10); });
await page.screenshot({ path: SHOTS + '30-sets-per-muscle.png' });

// ---- Progress
await page.click('.tabbar [data-tab=progress]');
assert(await page.locator('.energy >> text=learning').count(), 'energy card asks for more data first');
// v1.8: 3 weeks of full food days + weigh-ins → MacroFactor-style estimate (restored afterwards)
await page.evaluate(() => {
  const s = window.__rep.state; window.__stash = JSON.stringify({ daily: s.daily, bw: s.bodyweight });
  const k = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  s.bodyweight = [];
  for (let i = 21; i >= 1; i--) { const d = new Date(); d.setDate(d.getDate() - i); const key = k(d);
    s.daily[key] = { ...(s.daily[key] || {}), foodLog: [{ id: 'e' + i, meal: 'lunch', name: 'seed', kcal: 1650 + (i % 3) * 100, protein: 200, fat: 50, carbs: 120 }], kcal: 1650 + (i % 3) * 100 };
    s.bodyweight.push({ date: key, lb: +(255 - (21 - i) * 0.33 + ((i % 4) - 1.5) * 0.4).toFixed(1) }); }
  window.__rep.render();
});
assert(await page.locator('.energy >> text=You burn').count(), 'energy estimate shown with enough data');
const en = await page.evaluate(() => { const s = window.__rep.state; return window.__rep.estimateExpenditure({ bodyweight: s.bodyweight, daily: s.daily, targets: s.settings.targets }); });
assert(en.ok && en.expenditure > 2500 && en.expenditure < 3200, 'expenditure ≈ intake + trend (' + en.expenditure + ')');
assert((await page.evaluate(() => window.__rep.state.settings.targets.kcal)) === 1800, 'targets untouched (suggestion only)');
await page.evaluate(() => { document.querySelector('.energy').scrollIntoView({ block: 'start' }); window.scrollBy(0, -10); });
await page.waitForTimeout(300);
await page.screenshot({ path: SHOTS + '31-energy-estimate.png' });
await page.evaluate(() => { const s = window.__rep.state; const o = JSON.parse(window.__stash); s.daily = o.daily; s.bodyweight = o.bw; window.__rep.render(); });
await page.selectOption('select[data-change=progEx]', 'bench_press');
assert(await page.locator('svg.chart').count() >= 2, 'bodyweight + strength charts render');
await page.screenshot({ path: SHOTS + '03-progress.png', fullPage: false });
await page.evaluate(() => document.querySelector('.cal').scrollIntoView({ block: 'center' }));
await page.screenshot({ path: SHOTS + '06-progress-calendar.png' });
// relative strength + strength-on-the-cut
await page.click('[data-act=metric][data-m=rel]');
assert(await page.locator('text=Strength on the cut').count(), 'strength-on-the-cut card');
assert(/× BW/.test(await page.textContent('.seg >> text=× BW')), 'relative strength metric');
await page.evaluate(() => { const h = [...document.querySelectorAll('.card h3')].find(x => x.textContent === 'Strength'); h.closest('.card').scrollIntoView({ block: 'start' }); window.scrollBy(0, -10); });
await page.screenshot({ path: SHOTS + '13-progress-relative-strength.png' });
// Renpho import (kg export → lb) with preview, keep-mine default, body comp card
await page.click('[data-act=renphoPick] >> nth=0');
await page.setInputFiles('#renphoFile', new URL('../tests/fixtures/renpho-kg.csv', import.meta.url).pathname);
await page.waitForSelector('.panel >> text=8 days found');
assert((await page.textContent('.panel')).includes('2026-10-23 → 2026-11-08'), 'Renpho preview shows date range');
assert(await page.locator('.panel [data-act=renphoUnit].on[data-u=kg]').count(), 'Renpho kg detected');
assert(await page.locator('.panel >> text=Keep mine').count(), 'conflict choice offered');
await page.waitForTimeout(400);
await page.screenshot({ path: SHOTS + '14-renpho-preview.png' });
const bwBefore = await page.evaluate(() => window.__rep.state.bodyweight.find(b => b.date === '2026-10-23').lb);
await page.click('[data-act=renphoImport]');
const bwAfter = await page.evaluate(() => window.__rep.state.bodyweight);
assert(bwAfter.find(b => b.date === '2026-10-23').lb === bwBefore && bwAfter.find(b => b.date === '2026-10-23').bf === 34.1, 'keep-mine preserves manual weight, adds body fat');
assert(bwAfter.find(b => b.date === '2026-11-08').source === 'renpho' && new Set(bwAfter.map(b => b.date)).size === bwAfter.length, 'Renpho rows imported, one per day');
assert(await page.locator('text=Body composition').count() && await page.locator('text=of weight lost came from lean mass').count(), 'body composition card with lean-mass trend');
await page.evaluate(() => { const h = [...document.querySelectorAll('.card h3')].find(x => x.textContent === 'Body composition'); h.closest('.card').scrollIntoView({ block: 'start' }); window.scrollBy(0, -16); });
await page.waitForTimeout(3000); // let toast clear
await page.screenshot({ path: SHOTS + '15-body-composition.png' });
// exercise history / trend sheet
await page.click('[data-act=exHist][data-ex=bench_press]');
await page.waitForSelector('.panel >> text=History & PRs');
assert(await page.locator('.panel .hs.pr').count() >= 1, 'history marks PR sets');
assert((await page.textContent('.panel')).includes('Next time:'), 'history shows next-time suggestion');
await page.waitForTimeout(300);
await page.screenshot({ path: SHOTS + '12-exercise-history.png' });
await page.click('.panel [data-act=histMetric][data-m=rel]');
await page.click('.panel [data-act=closeSheet]');
await page.click('[data-act=metric][data-m=e1rm]');

// ---- Daily: protein hero
await page.click('.tabbar [data-tab=daily]');
const P = () => page.evaluate(() => { const d = window.__rep.state.daily[Object.keys(window.__rep.state.daily).sort().at(-1)]; return { g: d.protein, n: d.proteinLog.length }; });
await page.click('[data-act=addP][data-n="40"]');
await page.click('.food:has-text("Protein shake")');
await page.fill('#pG', '32'); await page.fill('#pLabel', 'chicken'); await page.click('[data-act=addCustomP]');
let pr = await P(); assert(pr.g === 122 && pr.n === 3, `protein log 40 + shake 50 + chicken 32 = 122 g (${pr.g})`);
assert(await page.locator('.plog >> text=chicken').count(), 'labelled entry shows in today log');
await page.click('.plog li:has-text("+40 g") [data-act=delP]');
pr = await P(); assert(pr.g === 82 && pr.n === 2, 'tap ✕ deletes entry (82 g)');
// swipe left on the chicken row
const row = page.locator('.plog li:has-text("chicken")'); const bb = await row.boundingBox();
await page.mouse.move(bb.x + bb.width - 80, bb.y + bb.height / 2); await page.mouse.down();
for (let k = 1; k <= 8; k++) await page.mouse.move(bb.x + bb.width - 80 - k * 25, bb.y + bb.height / 2);
await page.mouse.up(); await page.waitForTimeout(400);
pr = await P(); assert(pr.g === 50 && pr.n === 1, 'swipe-left deletes entry (50 g)');
// rebuild a realistic day for the screenshot
await page.click('.food:has-text("Greek yogurt")');
await page.fill('#pG', '45'); await page.fill('#pLabel', 'chicken'); await page.click('[data-act=addCustomP]');
await page.click('[data-act=addP][data-n="25"]');
pr = await P(); assert(pr.g === 138, 'protein total 138 g');
assert(await page.locator('svg.chart').count() >= 1, '7-day protein chart renders');
// supplements (Mon = not an injection day → only Creatine + Protein shake count)
assert(!(await page.locator('.inj-line').count()), 'no tirzepatide line on non-due day');
await page.click('.supp:has-text("Creatine")');
let ad = await page.evaluate(() => window.__rep.suppAdherence(Object.keys(window.__rep.state.daily).sort().at(-1)));
assert(ad.n === 1 && ad.total === 2, 'adherence 1/2 on non-due day');
await page.click('.supp:has-text("Protein shake")');
await page.waitForSelector('text=Add to protein tracker?');
assert((await page.inputValue('#spG')) === '50', 'shake offers 50 g (editable)');
await page.fill('#spG', '45'); await page.click('[data-act=suppAddP]');
pr = await P(); assert(pr.g === 183, 'shake check-off added 45 g (183 g)');
await page.click('.supp:has-text("Protein shake")'); // uncheck removes linked entry
pr = await P(); assert(pr.g === 138, 'unchecking shake removes its protein entry');
await page.click('.supp:has-text("Protein shake")'); await page.click('[data-act=suppAddP]');
pr = await P(); assert(pr.g === 188, 'shake re-checked with default 50 g (188 g)');
ad = await page.evaluate(() => window.__rep.suppAdherence(Object.keys(window.__rep.state.daily).sort().at(-1)));
assert(ad.n === 2 && ad.total === 2, 'adherence 2/2');
assert(await page.locator('.supp.on .stime').first().textContent() !== 'tap when taken', 'taken time recorded');
// other daily fields
await page.click('[data-act=addW][data-n="16"]'); await page.click('[data-act=addW][data-n="8"]');
await page.click('[data-act=addK][data-n="500"]');
await page.fill('input[data-change=setSteps]', '5400'); await page.press('input[data-change=setSteps]', 'Enter'); await page.locator('h1').click();
await page.click('[data-act=sleep][data-n="0.5"]');
await page.waitForTimeout(1900);
await page.evaluate(() => window.scrollTo(0, 0));
await page.screenshot({ path: SHOTS + '04-daily-protein-hero.png' });
await page.evaluate(() => document.querySelector('.plog').scrollIntoView({ block: 'start' }));
await page.evaluate(() => window.scrollBy(0, -12));
await page.screenshot({ path: SHOTS + '08-daily-protein-log-7day.png' });
// go back to Saturday (injection due day): tirzepatide line appears, linked to the injection log
const satBack = (new Date().getDay() + 1) % 7; // days back to last Saturday
for (let k = 0; k < satBack; k++) await page.click('[data-act=dday][data-n="-1"]');
assert(await page.locator('.inj-line').count(), 'tirzepatide line shown on due day (Sat)');
let satAd = await page.evaluate(() => { const R = window.__rep; const d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 1) % 7)); const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; return { k, a: R.suppAdherence(k) }; });
assert(satAd.a.total === 3 && satAd.a.n === 2, 'Sat adherence counts tirzepatide (2/3 before logging)');
await page.click('.inj-line');
assert((await page.evaluate(() => window.__rep.state.injections.map(i => i.date))).includes(satAd.k), 'checking tirzepatide line logs the injection for Sat');
assert((await page.evaluate(() => window.__rep.injectionStatus().status)) === 'done', 'injection card now done (same log)');
await page.waitForTimeout(1900);
await page.evaluate(() => { const el = [...document.querySelectorAll('.card')].find(c => c.querySelector('.supp')); el.scrollIntoView({ block: 'start' }); window.scrollBy(0, -12); });
await page.screenshot({ path: SHOTS + '09-daily-supplements.png' });
for (let k = 0; k < satBack; k++) await page.click('[data-act=dday][data-n="1"]');

// ---- Settings: supplement editor (add / edit / reorder / remove)
await page.click('.tabbar [data-tab=settings]');
await page.click('[data-act=suppAdd]');
const nm = page.locator('[data-change=suppName]').last();
await nm.fill('Fish oil'); await nm.press('Tab');
await page.locator('[data-change=suppDose]').last().fill('2 caps'); await page.locator('[data-change=suppDose]').last().press('Tab');
await page.locator('[data-change=suppTiming]').last().selectOption('evening');
const fid = await page.evaluate(() => window.__rep.state.supplements.at(-1).id);
await page.click(`[data-act=suppMove][data-id="${fid}"][data-n="-1"]`);
let sl = await page.evaluate(() => window.__rep.state.supplements.map(x => `${x.name}|${x.dose}|${x.timing}`));
assert(JSON.stringify(sl) === JSON.stringify(['Creatine|5 g|morning', 'Fish oil|2 caps|evening', 'Protein shake|1 shake|post']), 'supplement add/edit/reorder ' + JSON.stringify(sl));
await page.evaluate(() => { const h = [...document.querySelectorAll('.card h3')].find(x => x.textContent === 'Supplements'); h.scrollIntoView({ block: 'start' }); window.scrollBy(0, -12); });
await page.waitForTimeout(2000);
await page.screenshot({ path: SHOTS + '10-settings-supplements.png' });
await page.click(`[data-act=suppDel][data-id="${fid}"]`);
sl = await page.evaluate(() => window.__rep.state.supplements.map(x => x.name));
assert(JSON.stringify(sl) === '["Creatine","Protein shake"]', 'supplement remove');

// ---- Settings: per-exercise weight step
await page.fill('input[data-change=inc][data-id=lat_pulldown]', '5'); await page.press('input[data-change=inc][data-id=lat_pulldown]', 'Tab');
assert((await page.evaluate(() => window.__rep.state.settings.increments.lat_pulldown)) === 5, 'per-exercise weight step editable');

// ---- Settings: schedule edit + export/import round trip
await page.click('.tabbar [data-tab=settings]');
await page.selectOption('select[data-change=sched][data-d="3"]', 'class');
assert((await page.evaluate(() => window.__rep.state.settings.schedule[3].type)) === 'class', 'schedule editable (Wed → class)');
await page.selectOption('select[data-change=sched][data-d="3"]', 'lift:L1');
// week plan (unchanged in v2.0): Mon UA · Tue rest · Wed LA · Thu steps · Fri UB · Sat LB · Sun steps
assert(JSON.stringify(await page.evaluate(() => window.__rep.state.settings.schedule.map(x => x.type === 'lift' ? x.workout : x.type))) === JSON.stringify(['steps', 'U1', 'rest', 'L1', 'steps', 'U2', 'L2']), 'week plan: Tue rest, Thu/Sun steps');
await page.evaluate(() => { const h = [...document.querySelectorAll('section.card h3')].find(x => x.textContent.includes('Weekly schedule')); h.closest('section').scrollIntoView({ block: 'start' }); window.scrollBy(0, -8); });
await page.evaluate(() => document.getElementById('toast').classList.remove('show'));
await page.waitForTimeout(400);
await page.screenshot({ path: SHOTS + '34-week-plan.png' });
// v2.0 week plan on Today (weekly strip) + per-day lifts in Choose
await page.click('.tabbar [data-tab=today]');
await page.waitForSelector('.weekstrip');
assert(JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('.weekstrip .wd b')].map(b => b.textContent))) === JSON.stringify(['UA', '–', 'LA', '👟', 'UB', 'LB', '👟']), 'week strip: Mon UA, Tue rest, Wed LA, Thu walk, Fri UB, Sat LB, Sun walk');
await page.click('[data-act=choose]');
await page.waitForSelector('.panel .picker');
const pickTxt = await page.evaluate(() => [...document.querySelectorAll('.panel .picker li')].map(li => li.textContent));
assert(pickTxt.length === 4 && /Cable Fly/.test(pickTxt[2]) && /Face Pull/.test(pickTxt[2]) && /Lying Leg Curl/.test(pickTxt[3]) && !pickTxt.join().includes('Hip Thrust') && !pickTxt.join().includes('Seated Cable Row'), 'choose sheet shows the v2 lifts');
await page.evaluate(() => { document.querySelector('.panel').scrollTop = 0; document.getElementById('toast')?.classList.remove('show'); });
await page.waitForTimeout(400);
await page.screenshot({ path: SHOTS + '37-week-plan-v2.png' });
await page.click('.panel [data-act=closeSheet]');
await page.click('.tabbar [data-tab=settings]');
const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-act=export]')]);
const path = SHOTS + '../.e2e-backup.json'; await dl.saveAs(path);
const backup = JSON.parse(readFileSync(path, 'utf8'));
assert(backup.data.sessions.length === 7, 'export contains sessions');
assert(backup.data.bodyweight.some(b => b.bf != null) && backup.data.supplements.length === 2 && backup.data.injections.length === 1 && backup.data.quickFoods.length === 4, 'export contains supplements, injections, quick foods');
await page.evaluate(() => localStorage.clear());
await page.setInputFiles('#importFile', path);
await page.waitForFunction(() => window.__rep.state.sessions.length === 7 && window.__rep.state.supplements.length === 2);
log('ok - import restored backup');

// ---- v1.5: backup reminder, check-in, fat-loss, plates, swap, voice settings
await page.click('.tabbar [data-tab=today]');
await page.waitForSelector('.hero');
// Monday card only shows on Mondays; other days open the same sheet from Progress
const isMon = await page.evaluate(() => new Date().getDay() === 1);
if (isMon) {
  assert(await page.locator('.card.checkin >> text=Coach Brooke check-in').count(), 'Monday check-in card');
  await page.evaluate(() => { const el = document.querySelector('.card.checkin'); el?.scrollIntoView({ block: 'center' }); });
  await page.waitForTimeout(400);
  await page.screenshot({ path: SHOTS + '16-monday-checkin-card.png' });
  await page.click('[data-act=checkIn]');
} else {
  log('ok - skip Monday check-in card (not Monday)');
  await page.click('.tabbar [data-tab=progress]');
  await page.click('[data-act=checkIn]');
}
await page.waitForSelector('.panel >> text=Weekly check-in');
assert(await page.locator('#checkInText').count(), 'check-in plain-text block');
const checkTxt = await page.textContent('#checkInText');
assert(/SESSIONS:/.test(checkTxt) && /Protein avg:/.test(checkTxt) && /sent from Rep/.test(checkTxt), 'check-in text has sections');
await page.waitForTimeout(300);
await page.screenshot({ path: SHOTS + '17-checkin-sheet.png' });
await page.click('.panel [data-act=closeSheet]');

// Progress: fat-loss stats + 7-day avg overlay + check-in button
await page.click('.tabbar [data-tab=progress]');
assert(await page.locator('text=Weekly check-in for Coach Brooke').count(), 'Progress check-in button');
assert(await page.locator('text=7-day avg').count(), '7-day avg fat-loss stat');
assert(await page.locator('text=lb / wk').count(), 'lb/wk rate');
const fatOk = await page.evaluate(() => {
  const r = window.__rep.lossRate(window.__rep.state.bodyweight);
  const p = window.__rep.projectGoal(window.__rep.state.bodyweight, window.__rep.state.settings.goalWeight);
  return !!(r && r.lbPerWeek != null && p);
});
assert(fatOk, 'lossRate + projectGoal available on seeded data');
await page.evaluate(() => { const h = [...document.querySelectorAll('.card h3')].find(x => x.textContent === 'Bodyweight'); h.closest('.card').scrollIntoView({ block: 'start' }); window.scrollBy(0, -12); });
await page.waitForTimeout(400);
await page.screenshot({ path: SHOTS + '18-fatloss-trend.png' });

// Settings: voice toggles, bar weights, backup
await page.click('.tabbar [data-tab=settings]');
assert(await page.locator('text=Voice: “Rest over, next set”').count(), 'voice toggle');
assert(await page.locator('text=Voice: “10 seconds” warning').count(), '10s warning toggle');
assert(await page.locator('input[data-change=barWeight]').count() && await page.locator('input[data-change=trapBarWeight]').count(), 'bar weight inputs');
await page.fill('input[data-change=barWeight]', '45');
await page.fill('input[data-change=trapBarWeight]', '55');
await page.locator('input[data-change=trapBarWeight]').press('Tab');
assert((await page.evaluate(() => window.__rep.state.settings.trapBarWeight)) === 55, 'trap bar weight saved');
await page.evaluate(() => { const h = [...document.querySelectorAll('.card h3')].find(x => x.textContent === 'Rest timer'); h.scrollIntoView({ block: 'start' }); window.scrollBy(0, -12); });
await page.waitForTimeout(300);
await page.screenshot({ path: SHOTS + '19-settings-voice-bars.png' });
await page.evaluate(() => { const h = [...document.querySelectorAll('.card h3')].find(x => /Backup/.test(x.textContent)); h.scrollIntoView({ block: 'start' }); window.scrollBy(0, -12); });
assert(await page.locator('[data-act=backupShare]').count(), 'Backup to Drive / Files button');
assert(await page.locator('text=Last backed up').count(), 'last backed up label');
await page.waitForTimeout(300);
await page.screenshot({ path: SHOTS + '20-settings-backup.png' });
// Mark backup done via download path
const [dl2] = await Promise.all([page.waitForEvent('download'), page.click('[data-act=backupShare]')]);
await dl2.saveAs(SHOTS + '../.e2e-backup2.json');
assert((await page.evaluate(() => !!window.__rep.state.settings.lastBackupAt)), 'lastBackupAt stamped after backup');

// Plate calculator + swap during a fresh workout
await page.click('.tabbar [data-tab=today]');
// If done-card from earlier session, choose another workout
if (await page.locator('[data-act=choose]').count()) {
  await page.click('[data-act=choose]');
  await page.click('.picker [data-act=pick][data-w=L2]');
}
await page.click('[data-act=precheck]');
await page.click('[data-act=pq][data-k=ate][data-v="1"]');
await page.click('[data-act=pq][data-k=water][data-v="1"]');
await page.click('[data-act=pq][data-k=ok][data-v="1"]');
await page.click('[data-act=start]');
await page.waitForSelector('.safety');
// Trap-bar deadlift is lift 1 on L2 — should show plates
const plateTxt = await page.evaluate(() => {
  const el = document.querySelector('.plates');
  return el ? el.textContent : '';
});
assert(/Each side:/.test(plateTxt) || /Bar only/.test(plateTxt), 'plate breakdown shown on trap-bar set: ' + plateTxt);
await page.evaluate(() => { document.querySelector('.plates')?.scrollIntoView({ block: 'center' }); window.scrollBy(0, -40); });
await page.waitForTimeout(300);
await page.screenshot({ path: SHOTS + '21-plate-calculator.png' });
// v2.0: Lower B = 6 exercises (A1 seated calf raise / A2 plank); plank is time-based
assert((await page.locator('section.card.ex').count()) === 6, 'Lower B workout shows 6 exercises');
assert(await page.locator('.ssgroup[data-ss=A] >> text=Seated Calf Raise').count() && await page.locator('.ssgroup[data-ss=A] >> text=Plank').count(), 'Lower B superset: seated calf raise + plank');
assert(!(await page.locator('section.card.ex >> text=Barbell Hip Thrust').count()), 'hip thrust removed from Lower B');
const plankCard = page.locator('section.card.ex').filter({ has: page.locator('h2', { hasText: /^Plank$/ }) });
assert(await plankCard.locator('.bwcell').count() === 3 && await plankCard.locator('.sethead >> text=Seconds').count(), 'plank logs seconds (no weight stepper)');
assert((await plankCard.locator('input[data-f=reps]').first().inputValue()) === '30', 'plank first time: aim 30 s');
await page.click('[data-act=step][data-i="5"][data-j="0"][data-f=reps][data-d="5"]');
assert((await plankCard.locator('input[data-f=reps]').first().inputValue()) === '35', 'plank ± steps by 5 s');
await page.evaluate(() => { const c = [...document.querySelectorAll('section.card.ex')]; c[5].scrollIntoView({ block: 'start' }); window.scrollBy(0, -70); });
await page.waitForTimeout(300);
await page.screenshot({ path: SHOTS + '33-lower-b-plank-seconds.png' });
await page.evaluate(() => window.scrollTo(0, 0));
// Dizzy stop always visible (compact)
assert(await page.locator('.safety >> text=I feel dizzy').count(), 'dizzy stop on every workout');
assert(await page.locator('.safety >> text=Dizzy?').count(), 'compact dizzy rule line');

// Swap sheet — Brooke's ranked 3 only (trap-bar → blocks / DB / Smith)
await page.click('[data-act=swap][data-i="0"]');
await page.waitForSelector('.panel >> text=Coach Brooke swaps');
assert(await page.locator('.panel >> text=Make permanent in the plan').count(), 'permanent swap toggle');
assert(!(await page.locator('.panel >> text=All LA Fitness exercises').count()), 'no all-exercises fluff');
const swapIds = await page.evaluate(() => [...document.querySelectorAll('.panel [data-act=doSwap]')].map(e => e.dataset.ex));
assert(JSON.stringify(swapIds) === JSON.stringify(['bb_deadlift_blocks', 'db_deadlift', 'smith_deadlift']), 'Brooke ranked 3 for trap-bar: ' + JSON.stringify(swapIds));
assert(await page.locator('.panel >> text=Likely default').count(), 'blocks tagged as likely default');
await page.waitForTimeout(300);
await page.screenshot({ path: SHOTS + '22-exercise-swap.png' });
await page.click('.panel [data-act=doSwap][data-ex=bb_deadlift_blocks]');
const swapped = await page.evaluate(() => window.__rep.state.active.exercises[0]);
assert(swapped.exId === 'bb_deadlift_blocks' && swapped.swappedFrom === 'trap_bar_deadlift', 'swap applied for today with from-id');
assert(swapped.suggestion && swapped.suggestion.source === 'fresh', 'no history → first-session guidance, no weight carry');
assert(swapped.suggestion.weight == null && /RIR 2/i.test(swapped.suggestion.text), 'empty weight + RIR 2 first-session text');
assert(JSON.stringify(swapped.reps) === JSON.stringify([6, 8]) && swapped.sets.length === 3, 'same rep range, 3 sets');
await page.waitForTimeout(400);
await page.screenshot({ path: SHOTS + '23-swap-applied.png' });
// v1.9: Brooke's swaps for the new lifts — leg extension (home item tagged), plank (own targets)
await page.click('[data-act=swap][data-i="3"]');
await page.waitForSelector('.panel >> text=Coach Brooke swaps');
const legExtSwaps = await page.evaluate(() => [...document.querySelectorAll('.panel [data-act=doSwap]')].map(e => e.dataset.ex));
assert(JSON.stringify(legExtSwaps) === JSON.stringify(['spanish_squat', 'heels_elevated_goblet_squat', 'band_leg_extension']), 'Brooke leg-extension swaps: ' + JSON.stringify(legExtSwaps));
assert(await page.locator('.panel [data-ex=band_leg_extension] >> text=Home').count(), 'band leg extension tagged Home');
await page.click('[data-act=closeSheet]');
await page.waitForTimeout(250);
await page.click('[data-act=swap][data-i="5"]');
await page.waitForSelector('.panel >> text=Coach Brooke swaps');
const plankSwaps = await page.evaluate(() => [...document.querySelectorAll('.panel [data-act=doSwap]')].map(e => e.dataset.ex));
assert(JSON.stringify(plankSwaps) === JSON.stringify(['dead_bug', 'pallof_press', 'side_plank']), 'Brooke plank swaps: ' + JSON.stringify(plankSwaps));
await page.click('.panel [data-act=doSwap][data-ex=side_plank]');
const sp = await page.evaluate(() => window.__rep.state.active.exercises[5]);
assert(sp.exId === 'side_plank' && JSON.stringify(sp.reps) === '[20,30]' && sp.note === 'per side', 'side plank keeps its own 20–30 s/side target: ' + JSON.stringify(sp.reps) + sp.note);
const spCard = page.locator('section.card.ex').filter({ has: page.locator('h2', { hasText: /^Side Plank$/ }) });
assert(await spCard.locator('.bwcell').count() === 3 && await spCard.locator('.sethead >> text=Seconds').count(), 'side plank logs seconds');
assert(await spCard.locator('.chip >> text=20–30 s hold per side').count(), 'side plank chip shows 20–30 s hold per side');
await page.waitForTimeout(300);
await page.evaluate(() => { const c = [...document.querySelectorAll('section.card.ex')]; c[5].scrollIntoView({ block: 'start' }); window.scrollBy(0, -70); document.querySelector('#toast')?.classList.remove('show'); });
await page.waitForTimeout(300);
await page.screenshot({ path: SHOTS + '35-side-plank-swap.png' });
await page.click('[data-act=swap][data-i="5"]');
await page.waitForSelector('.panel >> text=Coach Brooke swaps');
const back = await page.evaluate(() => [...document.querySelectorAll('.panel [data-act=doSwap]')].map(e => e.dataset.ex));
assert(JSON.stringify(back) === JSON.stringify(['plank', 'dead_bug', 'pallof_press']), 'swap sheet offers the way back to plank + other Brooke swaps: ' + JSON.stringify(back));
await page.click('.panel [data-act=doSwap][data-ex=plank]');
const pk = await page.evaluate(() => window.__rep.state.active.exercises[5]);
assert(pk.exId === 'plank' && JSON.stringify(pk.reps) === '[30,45]' && !pk.swappedFrom, 'back to plank restores 30–45 s');
await page.evaluate(() => window.scrollTo(0, 0));
await page.click('[data-act=discard]');
// dialog auto-accepted by page.on('dialog')

// ---- v2.0: Upper B — two supersets (A1 lateral raise / A2 face pull, B1 overhead ext / B2 cable curl)
await page.waitForSelector('[data-act=choose]');
await page.click('[data-act=choose]');
await page.click('.picker [data-act=pick][data-w=U2]');
assert(JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('.workout-card .exlist .exnum')].map(e => e.textContent))) === JSON.stringify(['1', '2', '3', 'A1', 'A2', 'B1', 'B2']), 'Upper B numbered 1–3 + A1/A2 + B1/B2');
await page.click('[data-act=precheck]');
await page.click('[data-act=pq][data-k=ate][data-v="1"]');
await page.click('[data-act=pq][data-k=water][data-v="1"]');
await page.click('[data-act=pq][data-k=ok][data-v="1"]');
await page.click('[data-act=start]');
await page.waitForSelector('.ssgroup[data-ss=B]');
assert((await page.locator('section.card.ex').count()) === 7, 'Upper B: 7 exercise cards');
assert(await page.locator('.ssgroup[data-ss=A] >> text=Cable Lateral Raise').count() && await page.locator('.ssgroup[data-ss=A] >> text=Cable Face Pull').count(), 'superset A = lateral raise + face pull');
assert(await page.locator('.ssgroup[data-ss=B] >> text=Overhead Cable Triceps Extension').count() && await page.locator('.ssgroup[data-ss=B] >> text=Cable Curl').count(), 'superset B = overhead ext + cable curl');
assert(await page.locator('section.card.ex').filter({ has: page.locator('h2', { hasText: /^Cable Fly$/ }) }).locator('.chip >> text=RIR 1–2').count(), 'isolation shows RIR 1–2');
assert(await page.locator('section.card.ex').filter({ has: page.locator('h2', { hasText: /^Incline Dumbbell Press$/ }) }).locator('.chip >> text=RIR 2').count(), 'compound shows RIR 2');
assert(await page.locator('.safety >> text=I feel dizzy').count(), 'dizzy stop on Upper B');
// A2 → back to A1 next set
await page.fill('input[data-i="4"][data-j="0"][data-f="weight"]', '40'); await page.fill('input[data-i="4"][data-j="0"][data-f="reps"]', '15');
await page.click('[data-act=toggleSet][data-i="4"][data-j="0"]');
await page.waitForSelector('#timer.show');
const ssB = await page.evaluate(() => ({ total: window.__rep.state.timer.total, label: document.querySelector('#timer .tlabel').textContent }));
assert(ssB.total === 60 && /A1 Cable Lateral Raise · set 1/.test(ssB.label), 'A2 face pull → 60 s → A1 lateral raise: ' + JSON.stringify(ssB));
await page.evaluate(() => { window.__rep.state.timer = null; window.__rep.render(); const g = document.querySelector('.ssgroup[data-ss=A]'); g.scrollIntoView({ block: 'start' }); window.scrollBy(0, -60); document.getElementById('toast')?.classList.remove('show'); document.getElementById('pr')?.classList.remove('show'); });
await page.waitForTimeout(400);
await page.screenshot({ path: SHOTS + '36-upper-b-supersets.png' });
await page.evaluate(() => window.scrollTo(0, 0));
await page.click('[data-act=discard]');

// ---- v2.0: deload prompt (bad sleep) → Start deload → early deload banner, 2 sets / same weight / RIR 3
await page.waitForSelector('.hero');
await page.evaluate(() => {
  const s = window.__rep.state; const k = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  window.__sleepStash = JSON.stringify({ t: s.daily[k(new Date())]?.sleep ?? null, dz: s.dizzyEvents });
  s.dizzyEvents = [];
  const d = new Date(); s.daily[k(d)] = { ...(s.daily[k(d)] || {}), sleep: 4.5 };
  s.settings.earlyDeload = null; s.settings.deloadDismissed = null; window.__rep.save(); window.__rep.render();
});
await page.waitForSelector('#deloadPrompt');
assert(await page.locator('#deloadPrompt >> text=Sleep has tanked').count(), 'deload prompt names the reason');
assert(await page.locator('#deloadPrompt [data-act=startDeload]').count() && await page.locator('#deloadPrompt [data-act=dismissDeload]').count(), 'Start deload + Not now');
await page.evaluate(() => { document.getElementById('deloadPrompt').scrollIntoView({ block: 'start' }); window.scrollBy(0, -12); });
await page.waitForTimeout(400);
await page.screenshot({ path: SHOTS + '38-deload-prompt.png' });
await page.click('#deloadPrompt [data-act=startDeload]');
await page.waitForSelector('.banner.deload >> text=Early deload');
assert(!(await page.locator('#deloadPrompt').count()), 'prompt hidden once the deload is on');
assert(await page.locator('.hero .chip >> text=DELOAD').count(), 'Today shows DELOAD week chip');
const dl0 = await page.evaluate(() => { const R = window.__rep; const w = R.state.program.workouts[0]; return { pw: R.programWeek(), sg: R.suggest(w.exercises[0], { deload: true }) }; });
assert(dl0.pw.early && dl0.sg.sets === 2 && /RIR 3/.test(dl0.sg.text), 'deload suggestion: 2 sets, RIR 3 ' + JSON.stringify(dl0.sg.text));
await page.evaluate(() => { document.querySelector('.banner.deload').scrollIntoView({ block: 'start' }); window.scrollBy(0, -80); document.getElementById('toast')?.classList.remove('show'); });
await page.waitForTimeout(300);
await page.screenshot({ path: SHOTS + '39-early-deload-on.png' });
// restore
await page.evaluate(() => {
  const s = window.__rep.state; const st = JSON.parse(window.__sleepStash); const k = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  s.daily[k(new Date())].sleep = st.t; s.dizzyEvents = st.dz; s.settings.earlyDeload = null; window.__rep.save(); window.__rep.render();
});

// Voice warn flag on timer
await page.evaluate(() => {
  window.__rep.state.timer = { end: Date.now() + 9500, total: 90, label: 'test', warned: false, fired: false };
  window.__rep.render();
});
await page.waitForTimeout(1200);
const warned = await page.evaluate(() => window.__rep.state.timer && window.__rep.state.timer.warned === true);
assert(warned, '10-second voice warning flag set on timer');
await page.evaluate(() => { window.__rep.state.timer = null; window.__rep.state.active = null; });


log('ok - v1.5 features covered');

// ---- v1.7 food tracker (past day, mocked network — do not touch today's protein totals)
await page.route('**/world.openfoodfacts.org/**', async route => {
  const url = route.request().url();
  if (url.includes('/api/v0/product/')) {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      status: 1,
      product: {
        code: '0041500112345',
        product_name: 'Chunk Light Tuna',
        brands: 'Test Brand',
        serving_size: '85 g',
        nutriments: { 'energy-kcal_100g': 116, proteins_100g: 26, fat_100g: 1, carbohydrates_100g: 0 },
      },
    }) });
    return;
  }
  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
    products: [{
      code: '0123456789012',
      product_name: 'Quest Protein Bar',
      brands: 'Quest',
      serving_size: '60 g',
      nutriments: { 'energy-kcal_100g': 300, proteins_100g: 33, fat_100g: 12, carbohydrates_100g: 25 },
    }],
  }) });
});
await page.route('**/api.nal.usda.gov/**', async route => {
  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
    foods: [{ fdcId: 171077, description: 'Chicken, broiler, breast, meat only, cooked, roasted', foodNutrients: [
      { nutrientId: 1008, value: 165 }, { nutrientId: 1003, value: 31 }, { nutrientId: 1004, value: 3.6 }, { nutrientId: 1005, value: 0 },
    ] }],
  }) });
});

await page.click('.tabbar [data-tab=daily]');
await page.evaluate(() => window.__rep.goDaily('2026-11-01'));
await page.waitForSelector('.food-day');

// Log breakfast chicken from built-in list
await page.click('.meal[data-meal=breakfast] [data-act=foodSearch]');
await page.waitForSelector('#foodQ');
await page.click('.food-pick [data-act=foodPick][data-id=chicken-breast]');
await page.waitForSelector('[data-act=foodLog]');
await page.click('[data-act=foodLog]');
await page.waitForSelector('.meal[data-meal=breakfast] .food-entry:has-text("Chicken breast")');

// Search (mocked OFF + USDA)
await page.click('.meal[data-meal=lunch] [data-act=foodSearch]');
await page.waitForSelector('#foodQ');
await page.fill('#foodQ', 'quest');
await page.click('[data-act=foodDoSearch]');
await page.waitForSelector('.food-pick >> text=Quest Protein Bar');
assert(await page.locator('.food-pick >> text=Quest Protein Bar').count(), 'mocked OFF result appears');
assert(await page.locator('.food-pick >> text=Chicken, broiler').count(), 'mocked USDA result appears');
await page.waitForTimeout(2000);
await page.evaluate(() => document.querySelector('.panel')?.scrollTo?.(0, 0));
await page.screenshot({ path: SHOTS + '26-food-search.png' });
await page.click('.food-pick [data-act=foodPick]:has-text("Quest Protein Bar")');
await page.waitForSelector('[data-act=foodLog]');
await page.click('[data-act=foodLog]');

// Barcode type-in (camera is unavailable in this environment)
await page.click('.meal[data-meal=dinner] [data-act=foodSearch]');
await page.click('[data-act=foodScan]');
await page.waitForSelector('#barcodeIn');
await page.fill('#barcodeIn', '0041500112345');
await page.click('[data-act=foodBarcodeGo]');
await page.waitForSelector('text=Chunk Light Tuna');
assert(await page.locator('#fGrams').count(), 'barcode lookup opens amount sheet');
await page.waitForTimeout(2000);
await page.screenshot({ path: SHOTS + '27-food-barcode-or-entry.png' });
await page.click('[data-act=foodLog]');

// Offline search shows Needs signal + builtin
await ctx.setOffline(true);
await page.click('.meal[data-meal=snacks] [data-act=foodSearch]');
await page.fill('#foodQ', 'rice');
await page.click('[data-act=foodDoSearch]');
await page.waitForSelector('text=Needs signal');
assert(await page.locator('.food-pick >> text=White rice').count(), 'builtin rice still shown offline');
await page.click('[data-act=closeSheet]');
await ctx.setOffline(false);

// Fill a realistic cut day for the day screenshot (meals already have chicken / quest / tuna)
await page.evaluate(() => {
  const S = window.__rep.state;
  const k = '2026-11-01';
  const d = S.daily[k];
  const add = (meal, id, qty = 1) => {
    // already logged items stay; add extras by id if missing that meal+food
    const foods = {
      'eggs': { id: 'eggs', name: 'Eggs (3 large)', servingLabel: '3 large', servingGrams: 150, kcal: 210, protein: 18, fat: 15, carbs: 1 },
      'oats': { id: 'oats', name: 'Oats, dry', servingLabel: '½ cup', servingGrams: 40, kcal: 150, protein: 5, fat: 3, carbs: 27 },
      'rice': { id: 'rice', name: 'White rice, cooked', servingLabel: '1 cup', servingGrams: 158, kcal: 205, protein: 4, fat: 0, carbs: 45 },
      'broccoli': { id: 'broccoli', name: 'Broccoli, cooked', servingLabel: '1 cup', servingGrams: 156, kcal: 55, protein: 4, fat: 0, carbs: 11 },
      'salmon': { id: 'salmon', name: 'Salmon', servingLabel: '6 oz cooked', servingGrams: 170, kcal: 280, protein: 39, fat: 14, carbs: 0 },
      'potato': { id: 'potato', name: 'Potato, baked', servingLabel: '1 medium', servingGrams: 173, kcal: 160, protein: 4, fat: 0, carbs: 37 },
      'greek-yogurt': { id: 'greek-yogurt', name: 'Greek yogurt, nonfat', servingLabel: '1 cup', servingGrams: 170, kcal: 100, protein: 18, fat: 0, carbs: 6 },
    };
    const f = foods[id];
    d.foodLog.push({ id: id + '-' + meal, ts: Date.now(), meal, foodId: id, source: 'builtin', barcode: '', qty, grams: f.servingGrams * qty, servingGrams: f.servingGrams, servingLabel: f.servingLabel, name: f.name, kcal: f.kcal * qty, protein: f.protein * qty, fat: f.fat * qty, carbs: f.carbs * qty });
  };
  add('breakfast', 'eggs'); add('breakfast', 'oats');
  add('lunch', 'rice'); add('lunch', 'broccoli');
  add('dinner', 'salmon'); add('dinner', 'potato');
  add('snacks', 'greek-yogurt');
  window.__rep.render();
});
const foodDay = await page.evaluate(() => {
  const d = window.__rep.state.daily['2026-11-01'];
  return window.__rep.syncedTotals(d);
});
assert(foodDay.n >= 8, 'full day has many food items: ' + foodDay.n);
assert(foodDay.protein > 100, 'logged protein feeds daily total');
// protein on this past day should not have emptied today's log
const todayP = await page.evaluate(() => {
  const keys = Object.keys(window.__rep.state.daily).sort();
  const today = keys.filter(k => k !== '2026-11-01').at(-1);
  return window.__rep.state.daily[today].protein;
});
assert(todayP === 188, 'food logging on a past day did not change today protein (' + todayP + ')');

await page.evaluate(() => { window.scrollTo(0, 0); document.querySelector('.food-day')?.scrollIntoView({ block: 'start' }); window.scrollBy(0, -8); });
await page.waitForTimeout(2000);
await page.screenshot({ path: SHOTS + '25-food-day.png' });

// Saved meal + copy yesterday smoke
await page.click('[data-act=foodMeals]');
await page.click('[data-act=foodMealSave]');
await page.fill('#mealName', 'Cut day');
await page.click('[data-act=foodMealSaveGo]');
assert((await page.evaluate(() => window.__rep.state.savedMeals[0].name)) === 'Cut day', 'saved meal stored');

log('ok - v1.7 food tracker');

// ---- v1.8 home-screen shortcuts
await page.goto(APP_URL + '?go=weigh'); await page.waitForSelector('.hero');
assert((await page.evaluate(() => location.search + location.hash)) === '#progress', 'weigh shortcut opens Progress and cleans URL');
await page.goto(APP_URL + '?go=food'); await page.waitForSelector('.panel');
assert((await page.evaluate(() => location.hash)) === '#daily' && await page.locator('.panel input').count(), 'food shortcut opens food search');
await page.click('.panel [data-act=closeSheet] >> nth=0').catch(() => {});
const man = JSON.parse(readFileSync(new URL('../manifest.json', import.meta.url), 'utf8'));
assert(man.shortcuts.length === 3, 'manifest has 3 shortcuts');

// ---- offline: service worker serves app shell
// reload once so the freshly-installed SW controls the page (fallback to goto if the reload stalls)
try { await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 }); }
catch { log('note - reload stalled, retrying via goto'); await page.goto(APP_URL, { waitUntil: 'domcontentloaded' }); }
await page.waitForFunction(() => navigator.serviceWorker.controller);
await ctx.setOffline(true); await page.reload({ waitUntil: 'domcontentloaded' }); await page.waitForSelector('.tabbar');
log('ok - loads offline via service worker'); await ctx.setOffline(false);

// ---- clear sample data
await page.evaluate(() => { localStorage.clear(); });
await page.reload({ waitUntil: 'domcontentloaded' }); await page.waitForSelector('.hero');
const fresh = await page.evaluate(() => ({ s: window.__rep.state.sessions.length, bw: window.__rep.state.bodyweight, sup: window.__rep.state.supplements, inj: window.__rep.state.injections.length }));
assert(JSON.stringify(fresh.sup.map(x => x.name)) === '["Creatine","Protein shake"]' && !fresh.sup.some(x => x.example) && fresh.inj === 0, 'fresh state: Creatine + Protein shake (no examples), no injections');
assert(fresh.s === 0 && fresh.bw.length === 1 && fresh.bw[0].lb === 255, 'fresh state after clear (only seed 255 lb on 2026-10-23)');
await page.evaluate(() => localStorage.clear());

assert(errors.length === 0, 'no console/page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
await browser.close();
console.log('\nE2E PASSED');
