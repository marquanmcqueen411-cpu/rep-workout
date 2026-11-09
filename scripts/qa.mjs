// QA sweep: every tab + sheet at phone (412x915) and tablet (800x1280).
// Checks: horizontal overflow, tap targets >= 44px, axe-core WCAG A/AA, console errors,
// PWA installability (Chrome CDP), manifest errors. Writes screenshots/qa/*.png and qa-report.json.
import { chromium } from 'playwright-core';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { seedSample } from './sample-data.mjs';

const APP_URL = process.env.URL || 'http://localhost:5173/';
const OUT = new URL('../screenshots/qa/', import.meta.url).pathname; mkdirSync(OUT, { recursive: true });
const AXE = readFileSync(new URL('../node_modules/axe-core/axe.min.js', import.meta.url), 'utf8');
const VPS = [{ name: 'phone', width: 412, height: 915 }, { name: 'tablet', width: 800, height: 1280 }];
const report = { url: APP_URL, viewports: {}, installability: null, manifestErrors: null };

const browser = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--no-sandbox'] });

async function audit(page, label, vp) {
  await page.waitForTimeout(450); // let sheet/pop animations finish
  const r = await page.evaluate(() => {
    const vis = el => { const b = el.getBoundingClientRect(); const cs = getComputedStyle(el); return b.width > 0 && b.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && !el.closest('[hidden]'); };
    const small = [];
    for (const el of document.querySelectorAll('button, a[href], input:not([type=hidden]):not([type=file]), select, textarea, [data-act]')) {
      if (!vis(el)) continue; if (el.closest('.tabbar') && el.tagName !== 'BUTTON') continue;
      if (el.closest('#timer:not(.show)')) continue;
      const b = el.getBoundingClientRect();
      // inline target inside a larger tappable row is fine
      if ((b.width < 44 || b.height < 44)) small.push({ el: el.tagName.toLowerCase() + (el.dataset.act ? `[data-act=${el.dataset.act}]` : '') + (el.className ? '.' + String(el.className).split(' ')[0] : ''), w: Math.round(b.width), h: Math.round(b.height), text: (el.textContent || el.value || '').trim().slice(0, 24) });
    }
    return { overflow: document.documentElement.scrollWidth > window.innerWidth + 1, scrollWidth: document.documentElement.scrollWidth, small };
  });
  await page.addScriptTag({ content: AXE }).catch(() => {});
  const axe = await page.evaluate(async () => {
    const res = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] } });
    return res.violations.map(v => ({ id: v.id, impact: v.impact, n: v.nodes.length, sample: v.nodes.slice(0, 3).map(n => n.target.join(' ') + (n.any[0]?.message ? ' — ' + n.any[0].message.slice(0, 110) : '')) }));
  });
  await page.screenshot({ path: `${OUT}${vp}-${label}.png`, fullPage: true });
  return { ...r, axe };
}

for (const vp of VPS) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, timezoneId: 'America/Los_Angeles' });
  const page = await ctx.newPage(); const errors = [];
  page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('dialog', d => d.accept().catch(() => {}));
  await page.goto(APP_URL); await page.waitForSelector('.hero');
  await page.evaluate(seedSample); await page.reload(); await page.waitForSelector('.hero');
  const res = {};
  for (const tab of ['today', 'progress', 'recovery', 'daily', 'settings']) {
    await page.click(`.tabbar [data-tab=${tab}]`); await page.waitForTimeout(150);
    res[tab] = await audit(page, tab, vp.name);
  }
  // sheets
  await page.click('.tabbar [data-tab=today]');
  await page.click('.exlist li >> nth=0'); await page.waitForSelector('.panel'); res.sheetInfo = await audit(page, 'sheet-info', vp.name); await page.click('.panel [data-act=closeSheet]');
  await page.click('[data-act=choose] >> nth=0'); res.sheetChoose = await audit(page, 'sheet-choose', vp.name); await page.click('.panel [data-act=closeSheet]');
  await page.click('[data-act=precheck]'); await page.click('[data-act=pq][data-k=ate][data-v="0"]'); res.sheetPrecheck = await audit(page, 'sheet-precheck', vp.name);
  for (const k of ['ate', 'water', 'ok']) await page.click(`[data-act=pq][data-k=${k}][data-v="1"]`);
  await page.click('[data-act=start]'); await page.waitForSelector('.safety');
  await page.click('[data-act=toggleSet][data-i="0"][data-j="0"]'); await page.click('[data-act=rir][data-i="0"][data-j="0"][data-v="2"]');
  await page.waitForTimeout(3000);
  res.workout = await audit(page, 'workout', vp.name);
  await page.click('[data-act=exHist] >> nth=0'); res.sheetHistory = await audit(page, 'sheet-history', vp.name); await page.click('.panel [data-act=closeSheet]');
  await page.click('[data-act=swap] >> nth=0'); res.sheetSwap = await audit(page, 'sheet-swap', vp.name); await page.click('.panel [data-act=closeSheet]');
  await page.click('[data-act=dizzy]'); res.sheetDizzy = await audit(page, 'sheet-dizzy', vp.name); await page.click('.panel [data-act=dizzyResume]');
  await page.click('[data-act=finish]'); await page.waitForSelector('.panel'); res.sheetSummary = await audit(page, 'sheet-summary', vp.name); await page.click('.panel [data-act=closeSheet]');
  await page.click('.tabbar [data-tab=progress]'); await page.click('[data-act=renphoPick] >> nth=0');
  await page.setInputFiles('#renphoFile', new URL('../tests/fixtures/renpho-lb.csv', import.meta.url).pathname); await page.waitForSelector('.panel .ptable');
  res.sheetRenpho = await audit(page, 'sheet-renpho', vp.name); await page.click('[data-act=renphoImport]');
  res.progressBodyComp = await audit(page, 'progress-bodycomp', vp.name);
  await page.click('.tabbar [data-tab=daily]'); await page.click('.supp:has-text("Protein shake")'); res.sheetShake = await audit(page, 'sheet-shake', vp.name); await page.click('.panel [data-act=closeSheet]');
  if (vp.name === 'phone') {
    const cdp = await ctx.newCDPSession(page);
    await page.reload(); await page.waitForFunction(() => navigator.serviceWorker.controller, null, { timeout: 10000 });
    const man = await cdp.send('Page.getAppManifest'); report.manifestErrors = man.errors; report.manifestUrl = man.url;
    report.swScope = await page.evaluate(async () => (await navigator.serviceWorker.getRegistration()).scope);
    report.cacheKeys = await page.evaluate(async () => caches.keys());
  }
  await page.evaluate(() => localStorage.clear());
  res.consoleErrors = errors;
  report.viewports[vp.name] = res;
  await ctx.close();
}
await browser.close();
{
  const { mkdtempSync } = await import('node:fs'); const { tmpdir } = await import('node:os');
  const dir = mkdtempSync(tmpdir() + '/rep-qa-');
  const pctx = await chromium.launchPersistentContext(dir, { executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--no-sandbox'], viewport: { width: 412, height: 915 } });
  const p = pctx.pages()[0] || await pctx.newPage();
  await p.goto(APP_URL); await p.waitForSelector('.hero');
  await p.reload(); await p.waitForFunction(() => navigator.serviceWorker.controller, null, { timeout: 10000 });
  const cdp = await pctx.newCDPSession(p);
  report.installability = (await cdp.send('Page.getInstallabilityErrors')).installabilityErrors;
  await p.evaluate(() => localStorage.clear()); await pctx.close();
}
writeFileSync(new URL('../screenshots/qa/qa-report.json', import.meta.url), JSON.stringify(report, null, 2));
// summary
let issues = 0;
for (const [vp, res] of Object.entries(report.viewports)) {
  for (const [k, v] of Object.entries(res)) {
    if (k === 'consoleErrors') { if (v.length) { issues++; console.log(`[${vp}] console errors:`, v); } continue; }
    if (v.overflow) { issues++; console.log(`[${vp}/${k}] horizontal overflow (${v.scrollWidth}px)`); }
    if (v.small.length) { issues++; console.log(`[${vp}/${k}] small tap targets:`, JSON.stringify(v.small.slice(0, 8))); }
    for (const a of v.axe) { issues++; console.log(`[${vp}/${k}] axe ${a.id} (${a.impact}) ×${a.n}: ${a.sample.join(' | ')}`); }
  }
}
console.log('installability errors:', JSON.stringify(report.installability), 'manifest errors:', JSON.stringify(report.manifestErrors), 'sw scope:', report.swScope, 'caches:', report.cacheKeys);
if (report.installability?.length || report.manifestErrors?.length) issues++;
console.log(issues ? `\nQA: ${issues} issue group(s)` : '\nQA CLEAN');
process.exit(issues ? 1 : 0);
