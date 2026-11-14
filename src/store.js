// Local-only persistence (localStorage). Export/Import lives in Settings.
import { exercise } from './exercises.js';
import { PROGRAM, LEGACY_PROGRAM_V1, LEGACY_PROGRAM_V2, DEFAULT_SCHEDULE, DEFAULT_TARGETS, DEFAULT_REST, BODYWEIGHT, DEFAULT_SUPPLEMENTS, DEFAULT_QUICK_FOODS } from './program.js';

const KEY = 'rep-workout.v1';
export const clone = o => JSON.parse(JSON.stringify(o));

export function ymd(d = new Date()) {
  const z = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}
export function parseYmd(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
export function mondayOf(d = new Date()) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const wd = (x.getDay() + 6) % 7; x.setDate(x.getDate() - wd); return x;
}
export function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }

function defaults() {
  return {
    version: 1,
    createdAt: new Date().toISOString(),
    program: clone(PROGRAM),
    settings: {
      schedule: clone(DEFAULT_SCHEDULE),
      targets: clone(DEFAULT_TARGETS),
      rest: clone(DEFAULT_REST),
      sound: true,
      vibrate: true,
      weeklyTarget: 4,
      cycleStart: ymd(mondayOf(new Date())),
      deloadEnabled: true,
      goalWeight: BODYWEIGHT.goal,
      injectionDay: 6,       // tirzepatide: Saturday (window Sat–Sun, overdue after)
      injectionWindowDays: 2,
      injectionDose: '',
      increments: {},        // per-exercise weight step overrides (lb)
      voice: true,           // speak "Rest over, next set" when timer ends
      voiceWarn: true,       // speak "10 seconds" with 10 s left
      barWeight: 45,         // Olympic barbell (lb)
      trapBarWeight: 45,     // trap/hex bar (lb)
      lastBackupAt: null,    // ISO timestamp of last successful backup share/download
      restNotify: false,     // phone notification when rest ends while the app is in the background
      earlyDeload: null,     // { from, reason } — early deload (7 days), see deload.js
      deloadDismissed: null, // { date, key } — 'Not now' on the deload prompt
      deloadLog: [],         // finished early deloads
    },
    supplements: clone(DEFAULT_SUPPLEMENTS),
    quickFoods: clone(DEFAULT_QUICK_FOODS),
    injections: [],
    sessions: [],
    active: null,
    daily: {},
    bodyweight: [clone(BODYWEIGHT.start)],
    dizzyEvents: [],
    timer: null,
    favorites: [],
    savedMeals: [],
    recentFoods: [],
    exNotes: {},           // sticky per-exercise setup notes (seat height, pins, grip)
    oneTime: { baseline20261113: { skipped: 'fresh install' }, cleanupEmpty20261113: { skipped: 'fresh install' } }, // one-time setups already handled (see applyOneTime)
  };
}

function migrate(s) {
  const d = defaults();
  const out = { ...d, ...s };
  out.settings = { ...d.settings, ...(s.settings || {}) };
  out.settings.targets = { ...d.settings.targets, ...((s.settings || {}).targets || {}) };
  out.settings.rest = { ...d.settings.rest, ...((s.settings || {}).rest || {}) };
  if (!out.settings.increments || typeof out.settings.increments !== 'object') out.settings.increments = {};
  if (!Array.isArray(out.settings.schedule) || out.settings.schedule.length !== 7) out.settings.schedule = d.settings.schedule;
  for (const k of ['sessions', 'bodyweight', 'dizzyEvents', 'supplements', 'quickFoods', 'injections', 'favorites', 'savedMeals', 'recentFoods']) if (!Array.isArray(out[k])) out[k] = d[k];
  if (!out.program || !Array.isArray(out.program.workouts)) out.program = d.program;
  else if (out.program.id !== PROGRAM.id) migratePlan(out, d);
  if (out.program && typeof out.program.name === 'string') out.program.name = out.program.name.replace(/Coach Dre\b/g, 'Coach Brooke'); // coach renamed
  if (!out.daily || typeof out.daily !== 'object') out.daily = {};
  if (!Array.isArray(out.settings.deloadLog)) out.settings.deloadLog = [];
  out.oneTime = s.oneTime && typeof s.oneTime === 'object' && !Array.isArray(s.oneTime) ? { ...s.oneTime } : {}; // saved data only — never the fresh-install default
  applyOneTime(out);
  if (!out.exNotes || typeof out.exNotes !== 'object' || Array.isArray(out.exNotes)) out.exNotes = {};
  // v1.1 shipped placeholder "example" supplements — swap them for the real defaults
  if (out.supplements.length && out.supplements.every(x => x.example)) out.supplements = d.supplements;
  return out;
}

/**
 * Plan upgrades (v1 3-lift → v1.9 5-lift → v2.0 final plan with supersets).
 * Keeps every logged session, weight, rest setting and the cycle start (same workout + exercise ids).
 * A permanent swap is carried onto the new slot that has the same default lift
 * (lifts removed from the plan — seated cable row, hip thrust — keep their history; their swap is listed in droppedSwaps).
 * Tuesday is always rest; an untouched old schedule becomes the new default.
 */
const LEGACY = { 'dre-ul4-v1': LEGACY_PROGRAM_V1, 'dre-ul4-v2': LEGACY_PROGRAM_V2 };
export function migratePlan(out, d = defaults()) {
  const old = out.program; const fromId = old.id || 'unknown';
  const longDays = (old.workouts || []).some(w => (w.exercises || []).length > 3);
  const legacyPlan = LEGACY[fromId] || (longDays ? LEGACY_PROGRAM_V2 : LEGACY_PROGRAM_V1);
  const prog = clone(PROGRAM); const kept = []; const dropped = [];
  for (const w of old.workouts || []) {
    const legacy = legacyPlan.workouts[w.id] || [];
    (w.exercises || []).forEach((slot, i) => {
      const def = legacy[i];
      if (!def || !slot || !slot.ex || slot.ex === def) return;
      let hit = false;
      for (const nw of prog.workouts) for (const ns of nw.exercises) if (ns.ex === def) {
        ns.ex = slot.ex; hit = true; kept.push({ from: def, to: slot.ex });
        const sx = exercise(slot.ex);
        if (sx && sx.swapReps) { ns.reps = [...sx.swapReps]; ns.note = sx.swapNote || ''; }
      }
      if (!hit) dropped.push({ from: def, to: slot.ex });
    });
  }
  out.program = prog;
  const sig = (out.settings.schedule || []).map(x => (x && x.type === 'lift' ? `lift:${x.workout}` : x && x.type)).join();
  if (sig === LEGACY_PROGRAM_V1.schedule.join() || sig === LEGACY_PROGRAM_V2.schedule.join()) out.settings.schedule = clone(d.settings.schedule);
  else if (Array.isArray(out.settings.schedule) && out.settings.schedule.length === 7) out.settings.schedule[2] = { type: 'rest' }; // Tuesday: always rest
  const rec = { from: fromId, to: PROGRAM.id, at: new Date().toISOString(), keptSwaps: kept, droppedSwaps: dropped };
  out.planMigrations = [...(Array.isArray(out.planMigrations) ? out.planMigrations : out.planMigration ? [out.planMigration] : []), rec];
  out.planMigration = rec;
  return out;
}

/**
 * One-time setups, each guarded by a flag in state.oneTime so it runs once and never overwrites data.
 * baseline20261113 (Marquan asked, v2.0.1): log the Nov 13 Renpho scan as the baseline and start the
 * final v2 plan on Mon Nov 23 (after Detroit).
 */
export const BASELINE_20261113 = {
  date: '2026-11-13', lb: 256.0, bf: 39.6, visceral: 21, skeletalMuscleLb: 99.4, fatFreeLb: 154.6, muscleLb: 147.0, bmr: 1872,
  source: 'renpho', baseline: true,
};
export const PLAN_START_20261123 = '2026-11-23';
/** A session counts only with at least one logged set. */
const setCount = x => (x && Array.isArray(x.exercises) ? x.exercises : []).reduce((n, e) => n + (Array.isArray(e && e.sets) ? e.sets.length : 0), 0);
const MACHINE_MADE = x => !!x && (['migration', 'setup', 'seed', 'sample', 'onetime'].includes(x.source) || x.migrated === true || x.setup === true || x.seeded === true || /^(seed|mig|setup|onetime)/.test(String(x.id || '')));
/**
 * cleanupEmpty20261113 (v2.0.2, once): drop sessions that have ZERO logged sets AND were made by
 * migration/setup/sample code. A session with any logged set is never touched; nor is one the user made.
 */
export function cleanupEmptySessions(out) {
  if (out.oneTime.cleanupEmpty20261113) return out;
  const removed = [];
  out.sessions = (Array.isArray(out.sessions) ? out.sessions : []).filter(x => {
    if (setCount(x) === 0 && MACHINE_MADE(x)) { removed.push(String(x.id)); return false; }
    return true;
  });
  out.oneTime.cleanupEmpty20261113 = { at: new Date().toISOString(), removed };
  return out;
}
export function applyOneTime(out) {
  if (!out.oneTime || typeof out.oneTime !== 'object' || Array.isArray(out.oneTime)) out.oneTime = {};
  cleanupEmptySessions(out);
  if (out.oneTime.baseline20261113) return out;
  const done = { at: new Date().toISOString(), addedBaseline: false, cycleStart: { from: out.settings.cycleStart, to: PLAN_START_20261123 } };
  if (!out.bodyweight.some(b => b && b.date === BASELINE_20261113.date)) {
    out.bodyweight.push(clone(BASELINE_20261113));
    out.bodyweight.sort((a, b) => a.date.localeCompare(b.date));
    done.addedBaseline = true;
  }
  out.settings.cycleStart = PLAN_START_20261123;
  out.oneTime.baseline20261113 = done;
  return out;
}

function load() {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null;
    if (raw) return migrate(JSON.parse(raw));
  } catch (e) { console.warn('load failed', e); }
  return defaults();
}

export let state = load();
export function save() { if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, JSON.stringify(state)); }
try { if (typeof localStorage !== 'undefined' && localStorage.getItem(KEY)) save(); } catch (e) { /* persist one-time setups right away */ }
export function replaceState(obj) { state = migrate(obj); save(); }
export function resetAll() { if (typeof localStorage !== 'undefined') localStorage.removeItem(KEY); state = defaults(); save(); }
export function resetProgram() { state.program = clone(PROGRAM); save(); }

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

export function day(date = ymd()) {
  if (!state.daily[date]) state.daily[date] = { protein: 0, kcal: 0, fat: 0, carbs: 0, waterOz: 0, sleep: null, steps: 0, dizzy: null, dizzyNote: '', cls: false };
  const d = state.daily[date];
  if (!Array.isArray(d.proteinLog)) d.proteinLog = d.protein ? [{ id: uid(), ts: null, g: d.protein, label: 'earlier' }] : [];
  if (!Array.isArray(d.foodLog)) d.foodLog = [];
  if (!d.supps || typeof d.supps !== 'object') d.supps = {};
  return d;
}
export function recalcProtein(d) { d.protein = d.proteinLog.reduce((a, e) => a + (+e.g || 0), 0); }
