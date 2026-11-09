# Rep — Boss's workout app (v1)

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
- **Progression**: all sets at top of range → +5 lb upper / +10 lb lower; otherwise same weight, +1 rep target. Deload week: 2 sets at ~90%.
- **Rest timer**: auto-starts after each set (lift 1: 150 s, adjustable 2–3 min; others 90 s), ±15 s, skip, vibration + beep, survives reload.
- **Recovery map**: front/back SVG body, colored by hours since each muscle was trained (72 h compounds, 48 h isolation/secondary) + readiness of the next workout.
- **Progress**: bodyweight chart with goal line (seeded 255 lb on 2026-10-23, goal 200), est. 1RM (Epley) / top-set chart per exercise, calendar (lifts, classes, dizzy days), session history.
- **Daily**: Coach Dre targets (1,800 kcal / 210 g P / ~55 g F / ~125 g C), protein quick-add (+10/+25/+40), optional kcal, water, steps (7,000 default; 6–8k on steps days), sleep, dizziness yes/no + note. Any past day can be edited.
- **Protein tracker** (Daily hero card): big ring toward 210 g, +10/+25/+40, saved quick foods (editable presets), custom grams + label, today's timed log (swipe left or tap ✕ to delete), 7-day bar chart vs goal (Daily + Progress).
- **Supplements**: daily checklist grouped by timing, tap to mark taken (time stamped), adherence %, 7-day history + 100%-day streak. Defaults: Creatine 5 g (Morning) and Protein shake (Post-workout — checking it off offers to add 50 g, editable, to the protein tracker; unchecking removes that entry). Tirzepatide appears as a checklist line only on injection due days (Sat–Sun by default), linked to the same injection log, and only counts toward adherence on those days. Electrolytes live in the pre-workout check. Edit/add/reorder/remove in Settings.
- **Tirzepatide injection reminder**: default Saturday; due Sat–Sun, overdue from Monday until logged (window and day editable). Log now or back-date to the injection day; optional dose label and site with rotation hint.
- **Settings**: schedule per weekday (lift A/B/C/D, steps, class/other training, rest), streak target, cycle start / deload, rest timers, sound/vibration, targets, program editor, Export / Import / Erase.
- **Offline**: service worker caches the app shell.

## Layout
```
index.html  styles.css  manifest.json  sw.js
icons/            icon.svg, icon-192.png, icon-512.png, maskable-512.png
src/program.js    ← Coach Dre's program, schedule, targets, rules (edit me)
src/exercises.js  exercise library: equipment, muscles, cues, demo links, swap groups
src/store.js      localStorage state, dates, migrations
src/logic.js      progression, program week/deload, rotation, recovery, streak
src/body.js       front/back body SVG
src/charts.js     tiny SVG line chart
src/app.js        UI (views, actions, timer, safety flows)
scripts/          build.mjs, e2e.mjs
screenshots/      e2e screenshots (sample data)
```

## Notes / limits
- Demos link out to a YouTube search for the exercise (no hotlinked/copyrighted media); each exercise sheet also shows a highlighted muscle diagram + text cues.
- Data lives in this browser only — clearing site data or uninstalling deletes it. Export backups.
- Not medical advice. Repeated dizziness → tell the prescriber; fainting/chest pain → 911.
