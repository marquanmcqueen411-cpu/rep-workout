// End-to-end smoke test in a mobile viewport (412x915). Usage:
//   npm start   (in another shell; serves http://localhost:5173)
//   CHROME=/usr/bin/google-chrome npm run e2e
import { chromium } from 'playwright-core';
import { mkdirSync, readFileSync } from 'node:fs';

const APP_URL = process.env.URL || 'http://localhost:5173/';
const SHOTS = new URL('../screenshots/', import.meta.url).pathname;
mkdirSync(SHOTS, { recursive: true });
const log = (...a) => console.log('•', ...a);
const assert = (c, m) => { if (!c) throw new Error('ASSERT: ' + m); log('ok -', m); };

const browser = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, acceptDownloads: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

await page.goto(APP_URL);
await page.waitForSelector('.hero');
assert(await page.locator('text=Week 1 of 6').count(), 'program week shown');

// ---- seed some past history (sample data) so charts/recovery have shape
await page.evaluate(() => {
  const s = window.__rep.state; const iso = (d, h) => { const x = new Date(); x.setDate(x.getDate() - d); x.setHours(h, 0, 0, 0); return x; };
  const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const mk = (wid, name, daysAgo, exs) => { const st = iso(daysAgo, 18); const en = new Date(st.getTime() + 55 * 60000);
    return { id: 'seed' + wid + daysAgo, workoutId: wid, workoutName: name, start: st.toISOString(), end: en.toISOString(), date: ymd(st), week: 1, deload: false, badDay: false, status: 'done', exercises: exs.map(([exId, reps, w, rs]) => ({ exId, reps, sets: rs.map(r => ({ weight: w, reps: r })) })) }; };
  s.sessions.push(
    mk('U1', 'Upper 1', 21, [['bench_press', [6, 8], 175, [8, 7, 6]], ['chest_supported_row', [8, 10], 140, [10, 9, 9]], ['seated_db_shoulder_press', [8, 10], 50, [9, 8, 8]]]),
    mk('U1', 'Upper 1', 14, [['bench_press', [6, 8], 175, [8, 8, 8]], ['chest_supported_row', [8, 10], 140, [10, 10, 10]], ['seated_db_shoulder_press', [8, 10], 50, [10, 9, 9]]]),
    mk('U1', 'Upper 1', 7, [['bench_press', [6, 8], 180, [8, 8, 8]], ['chest_supported_row', [8, 10], 145, [10, 10, 9]], ['seated_db_shoulder_press', [8, 10], 50, [10, 10, 10]]]),
    mk('L1', 'Lower 1', 5, [['box_squat', [6, 8], 205, [8, 7, 7]], ['romanian_deadlift', [8, 10], 185, [10, 9, 9]], ['leg_press', [10, 12], 360, [12, 12, 11]]]),
    mk('U2', 'Upper 2', 3, [['lat_pulldown', [8, 12], 160, [12, 11, 10]], ['incline_db_press', [8, 12], 60, [10, 10, 9]], ['cable_lateral_raise', [12, 15], 15, [15, 14, 13]]]),
    mk('L2', 'Lower 2', 2, [['trap_bar_deadlift', [6, 8], 245, [8, 8, 7]], ['split_squat', [8, 10], 40, [10, 9, 9]], ['hip_thrust', [10, 12], 225, [12, 12, 12]]]),
  );
  const bw = [['2026-10-26', 254.2], ['2026-10-30', 253.6], ['2026-11-02', 253.0], ['2026-11-05', 252.8]];
  for (const [date, lb] of bw) s.bodyweight.push({ date, lb });
  s.daily[ymd(iso(1, 12))] = { protein: 205, kcal: 1780, waterOz: 96, sleep: 7, steps: 7400, dizzy: false, dizzyNote: '', cls: true };
  // past 6 days of protein + supplements
  const pv = [212, 168, 190, 225, 150, 205];
  pv.forEach((g, i) => { const k = ymd(iso(i + 1, 12)); const d = s.daily[k] || (s.daily[k] = { protein: 0, kcal: 0, waterOz: 0, sleep: null, steps: 0, dizzy: null, dizzyNote: '', cls: false });
    d.protein = g; d.proteinLog = [{ id: 'p' + i, ts: iso(i + 1, 13).toISOString(), g, label: 'seed' }];
    d.supps = {}; s.supplements.forEach((x, j) => { if (i < 3 || j < 2) d.supps[x.id] = iso(i + 1, 8).toISOString(); }); });
  localStorage.setItem('rep-workout.v1', JSON.stringify(s)); location.reload();
});
await page.waitForSelector('.hero');
page.on('dialog', d => d.accept().catch(() => {}));
assert(await page.locator('.inj >> text=Tirzepatide').count(), 'injection card on Today (not logged yet)');

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
await page.click('[data-act=precheck]');
await page.click('[data-act=pq][data-k=ate][data-v="0"]');
assert(await page.locator("text=Don't lift fasted").count(), 'fasted warning shown');
await page.screenshot({ path: SHOTS + '05-precheck-warning.png' });
await page.click('[data-act=pq][data-k=ate][data-v="1"]');
await page.click('[data-act=pq][data-k=water][data-v="1"]');
await page.click('[data-act=pq][data-k=ok][data-v="1"]');
await page.click('[data-act=start]');
await page.waitForSelector('.safety');
assert(await page.locator('text=Dizzy or lightheaded?').count(), 'persistent dizzy reminder');

// lift 1: bench — check prefilled values
const w0 = await page.inputValue('input[data-i="0"][data-j="0"][data-f="weight"]');
assert(w0 === '185', 'bench weight prefilled 185');
// bump reps on set 1 via stepper, then check off
await page.click('[data-act=step][data-i="0"][data-j="0"][data-f="reps"][data-d="1"]');
await page.click('[data-act=toggleSet][data-i="0"][data-j="0"]');
await page.waitForSelector('#timer.show');
const t = await page.textContent('.tleft');
assert(/^2:(2|3)\d$/.test(t), `first-lift rest timer ~150 s (${t})`);
await page.click('[data-act=toggleSet][data-i="0"][data-j="1"]');
await page.waitForTimeout(500);
await page.screenshot({ path: SHOTS + '01-today-workout-logging.png' });

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
for (const i of [1, 2]) for (const j of [0, 1, 2]) await page.click(`[data-act=toggleSet][data-i="${i}"][data-j="${j}"]`);
const lastTimer = await page.evaluate(() => window.__rep.state.timer);
assert(lastTimer === null, 'no rest timer after final set');
await page.click('[data-act=finish]');
await page.waitForSelector('text=Workout complete');
await page.click('.panel [data-act=closeSheet]');
const sess = await page.evaluate(() => window.__rep.state.sessions.at(-1));
await page.evaluate(() => window.scrollTo(0, 0));
await page.screenshot({ path: SHOTS + '07-today-done.png' });
assert(sess.exercises.length === 3 && sess.exercises.every(e => e.sets.length === 3), 'session saved with 3×3 sets');
assert(sess.exercises[0].sets[0].reps === 7 && sess.exercises[0].sets[0].weight === 185, 'stepper edit saved (185×7)');

// ---- Recovery
await page.waitForTimeout(2000); // let toast clear
await page.click('.tabbar [data-tab=recovery]');
await page.waitForSelector('svg.body');
await page.screenshot({ path: SHOTS + '02-recovery-map.png' });

// ---- Progress
await page.click('.tabbar [data-tab=progress]');
await page.selectOption('select[data-change=progEx]', 'bench_press');
assert(await page.locator('svg.chart').count() >= 2, 'bodyweight + strength charts render');
await page.screenshot({ path: SHOTS + '03-progress.png', fullPage: false });
await page.evaluate(() => document.querySelector('.cal').scrollIntoView({ block: 'center' }));
await page.screenshot({ path: SHOTS + '06-progress-calendar.png' });

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

// ---- Settings: schedule edit + export/import round trip
await page.click('.tabbar [data-tab=settings]');
await page.selectOption('select[data-change=sched][data-d="3"]', 'class');
assert((await page.evaluate(() => window.__rep.state.settings.schedule[3].type)) === 'class', 'schedule editable (Wed → class)');
await page.selectOption('select[data-change=sched][data-d="3"]', 'lift:L1');
const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-act=export]')]);
const path = SHOTS + '../.e2e-backup.json'; await dl.saveAs(path);
const backup = JSON.parse(readFileSync(path, 'utf8'));
assert(backup.data.sessions.length === 7, 'export contains sessions');
assert(backup.data.supplements.length === 2 && backup.data.injections.length === 1 && backup.data.quickFoods.length === 4, 'export contains supplements, injections, quick foods');
await page.evaluate(() => localStorage.clear());
await page.setInputFiles('#importFile', path);
await page.waitForFunction(() => window.__rep.state.sessions.length === 7 && window.__rep.state.supplements.length === 2);
log('ok - import restored backup');

// ---- offline: service worker serves app shell
await page.reload(); await page.waitForFunction(() => navigator.serviceWorker.controller);
await ctx.setOffline(true); await page.reload(); await page.waitForSelector('.tabbar');
log('ok - loads offline via service worker'); await ctx.setOffline(false);

// ---- clear sample data
await page.evaluate(() => { localStorage.clear(); });
await page.reload(); await page.waitForSelector('.hero');
const fresh = await page.evaluate(() => ({ s: window.__rep.state.sessions.length, bw: window.__rep.state.bodyweight, sup: window.__rep.state.supplements, inj: window.__rep.state.injections.length }));
assert(JSON.stringify(fresh.sup.map(x => x.name)) === '["Creatine","Protein shake"]' && !fresh.sup.some(x => x.example) && fresh.inj === 0, 'fresh state: Creatine + Protein shake (no examples), no injections');
assert(fresh.s === 0 && fresh.bw.length === 1 && fresh.bw[0].lb === 255, 'fresh state after clear (only seed 255 lb on 2026-10-23)');
await page.evaluate(() => localStorage.clear());

assert(errors.length === 0, 'no console/page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
await browser.close();
console.log('\nE2E PASSED');
