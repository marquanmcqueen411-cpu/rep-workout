# Rep — Boss's workout app (v1.6.0)

Personal, mobile-first PWA (not a Fernholt product). Plain static site: vanilla JS ES modules, no framework, no backend, no accounts. All data stays on the phone (localStorage) with JSON Export/Import in Settings.

## Run locally
```bash
npm start            # python3 -m http.server 5173 → http://localhost:5173
npm run build        # copies the static app into dist/
npm i && npm run e2e # Playwright (playwright-core + system Chrome) mobile smoke test, writes screenshots/
```

## Deploy (later)
Host the `dist/` folder (or the repo root) on Cloudflare Pages or GitHub Pages — no build command needed beyond `npm run build`. HTTPS is required for the service worker / "Install app". On Android Chrome: open the URL → ⋮ → **Add to Home screen / Install app**. Bump `VERSION` in `sw.js` when you change files so phones pick up updates.

## Change the program
Everything Coach Dre controls lives in **`src/program.js`**: workouts, starter supplements, protein quick foods, (exercise id, sets, rep range), weekly schedule, daily targets, progression increments, deload rules, rest timers, bodyweight start/goal. Exercise ids, form cues, muscles and swap groups are in **`src/exercises.js`**.
In-app edits (Settings → Schedule / Program / Targets) are stored on the device and override the file; "Reset program to Coach Dre default" reloads `program.js`.

## Features
- **Today**: scheduled workout (Mon U1 / Wed L1 / Fri U2 / Sat L2; Tue/Thu/Sun steps days), choose any workout (shows next in rotation), program week (week 6 = deload banner), Bad-day mode (first 2 lifts × 2 sets), class / other-training logging, Monday weigh-in prompt, weekly strip + streak.
- **Pre-workout safety check** (ate carbs+protein 1–2 h ago? electrolytes/water? feeling OK?) with a clear don't-lift-fasted warning; persistent "Dizzy or lightheaded? Stop, sit down, sip fluids." bar and **I feel dizzy** button that logs the event, pauses, and shows guidance (end & save or resume).
- **Set logging**: big ± steppers, tap-to-type, check-off. First session: empty fields. After that: prefilled with the suggestion and "Last: …" chip. RIR 2 cue everywhere.
- **Progressive overload engine** (`src/progression.js`, unit-tested): per-set double progression (each set gets its own "→ target"); all sets at top of range → jump (+5 lb upper / +10 lb lower; dumbbells step per hand, machines to the next stack step; per-exercise steps editable in Settings → Weight steps). RIR chips (0/1/2/3+) per set: all-top at RIR 0 → hold and own it, all-top at RIR ≥3 → double jump. Missed the bottom of the range twice → −5–10%; stall (3 sessions same weight, no rep gain) → reset −10% and a "Swap variation" button. Week 6 deload = 2 sets at ~90%, then "Back from deload → return to W". Bad-day and deload sessions never drive progression. Warm-up ramp on lift 1, first-session guidance, one-line explanation per lift ("Hit 8,8,8 at 185 last time → 190 today (+5 lb)").
- **PRs & history**: e1RM / top-set / rep PRs detected live (badge on the set + celebration), per-exercise history sheet with e1RM / top set / × BW chart, trend vs bodyweight and next-time suggestion. Relative strength (e1RM ÷ bodyweight) on Progress.
- **Import from Renpho** (Settings, or the shortcut on the Progress bodyweight card): in the Renpho app, use its data export option and save the CSV, then choose it here. Tolerant parser (comma/semicolon/tab, quoted fields, decimal commas; ISO, M/D/Y, D/M/Y, "Oct 23, 2026" dates, with times) auto-detects date, weight (kg → lb), body fat % and muscle mass columns. Preview (days, date range, unit with kg/lb override, columns, sample rows) before anything is saved; one reading per day (earliest); existing manual weigh-ins are kept unless you pick "Use Renpho". Body-composition card on Progress (body fat %, lean mass, fat mass, lean-mass trend, % of loss from lean). Included in Export/Import.
- **Rest timer**: auto-starts after each set (lift 1: 150 s, adjustable 2–3 min; others 90 s), ±15 s, skip, vibration + beep, survives reload.
- **Recovery map**: front/back SVG body, colored by hours since each muscle was trained (72 h compounds, 48 h isolation/secondary) + readiness of the next workout.
- **Progress**: bodyweight chart with goal line (seeded 255 lb on 2026-10-23, goal 200), est. 1RM (Epley) / top-set chart per exercise, calendar (lifts, classes, dizzy days), session history.
- **Daily**: Coach Dre targets (1,800 kcal / 210 g P / ~55 g F / ~125 g C), protein quick-add (+10/+25/+40), optional kcal, water, steps (7,000 default; 6–8k on steps days), sleep, dizziness yes/no + note. Any past day can be edited.
- **Protein tracker** (Daily hero card): big ring toward 210 g, +10/+25/+40, saved quick foods (editable presets), custom grams + label, today's timed log (swipe left or tap ✕ to delete), 7-day bar chart vs goal (Daily + Progress).
- **Supplements**: daily checklist grouped by timing, tap to mark taken (time stamped), adherence %, 7-day history + 100%-day streak. Defaults: Creatine 5 g (Morning) and Protein shake (Post-workout — checking it off offers to add 50 g, editable, to the protein tracker; unchecking removes that entry). Tirzepatide appears as a checklist line only on injection due days (Sat–Sun by default), linked to the same injection log, and only counts toward adherence on those days. Electrolytes live in the pre-workout check. Edit/add/reorder/remove in Settings.
- **Tirzepatide injection reminder**: default Saturday; due Sat–Sun, overdue from Monday until logged (window and day editable). Log now or back-date to the injection day; optional dose label and site with rotation hint.
- **Settings**: schedule per weekday (lift A/B/C/D, steps, class/other training, rest), streak target, cycle start / deload, rest timers, sound/vibration, targets, program editor, Export / Import / Erase.
- **Backup to Drive (free)**: Settings → **Backup to Drive / Files** (also a Sunday / 7-day reminder card on Today). Uses the Web Share API so Android’s share sheet can offer Drive; falls back to a JSON download. Shows “Last backed up” in Settings. No Google Cloud project or OAuth.
- **Weekly check-in for Coach Dre**: Monday card on Today + button on Progress. Builds a plain-text summary (7-day avg weight & change, sessions done/planned, top set + e1RM change per lift, PRs, deload/stall notes, protein vs 210 g, kcal, Tue/Thu/Sun steps vs 6–8k, supplements / tirzepatide, dizziness/sleep/water). **Copy** and **Share** — paste it to Dre.
- **Plate calculator**: on barbell / trap-bar sets, shows per-side LA Fitness plates (45/35/25/10/5/2.5) for a 45 lb bar (trap bar separately editable in Settings).
- **Voice + vibration rest timer**: speaks “Rest over, next set” (and a “10 seconds” warning) via `speechSynthesis`, plus vibration; toggles in Settings. Screen wake lock keeps the timer alive during a workout.
- **Exercise swap**: ⇄ on each lift shows Coach Dre’s ranked 3 alternatives (exact list in `DRE_SWAPS`). Same rep range · 3 sets · RIR 2. Today-only by default, or **Make permanent in the plan**. Each swap logs its own weight — no carry-over from the original lift; first time = pick a starting weight for the bottom of the range at RIR 2.
- **Smarter fat-loss tracking**: bodyweight chart overlays a 7-day moving average; shows lb/wk and % bodyweight/week, projected date to 200 lb, and a gentle flag if loss is faster than ~1.5% BW/week for 2+ weeks or several e1RMs are dropping (check protein, tell Coach Dre). No medical claims.
- **Offline**: service worker caches the app shell.

## Layout
```
index.html  styles.css  manifest.json  sw.js
icons/            icon.svg, icon-192.png, icon-512.png, maskable-512.png
src/program.js    ← Coach Dre's program, schedule, targets, rules (edit me)
src/exercises.js  exercise library: equipment, muscles, cues, demo links, swap groups
src/store.js      localStorage state, dates, migrations
src/progression.js pure overload engine (targets, jumps, stalls, deloads, PRs, warm-ups, rel. strength)
src/renpho.js     Renpho CSV parser + bodyweight merge
src/plates.js     LA Fitness plate calculator
src/fatloss.js    7-day MA, loss rate, goal projection, muscle-risk flag
src/checkin.js    Coach Dre weekly plain-text summary
src/backup.js     Web Share / download backup + reminder
src/swap.js       Swap alternatives + weight conversion
src/logic.js      engine glue, program week/deload, rotation, recovery, streak
src/body.js       front/back body SVG
src/charts.js     tiny SVG line chart
src/app.js        UI (views, actions, timer, safety flows)
tests/            node --test unit tests (+ fixtures/renpho-*.csv)
scripts/          build.mjs, e2e.mjs, qa.mjs (axe, tap targets, installability), sample-data.mjs
.github/workflows/deploy-pages.yml  GitHub Pages deploy (runs tests first)
screenshots/      e2e screenshots (sample data)
```

## Notes / limits
- Demos: tap **Demo** on an exercise for an in-app youtube-nocookie embed (verified form videos from coaching channels). Offline or failed embed shows “Video needs signal — cues below,” plus an Open in YouTube link. Lifts without a verified video still get a YouTube search link. Videos are not cached by the service worker.
- Renpho: if a CSV has no unit in the header, kg vs lb is guessed from the values (median < 150 → kg); the preview lets you flip it. Body fat % from a scale is an estimate.
- Data lives in this browser only — clearing site data or uninstalling deletes it. Use **Backup to Drive / Files** (or Export) regularly; pick Drive in the Android share sheet.
- Not medical advice. Repeated dizziness → tell the prescriber; fainting/chest pain → 911.
