// Local-only persistence (localStorage). Export/Import lives in Settings.
import { PROGRAM, DEFAULT_SCHEDULE, DEFAULT_TARGETS, DEFAULT_REST, BODYWEIGHT, DEFAULT_SUPPLEMENTS, DEFAULT_QUICK_FOODS } from './program.js';

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
  for (const k of ['sessions', 'bodyweight', 'dizzyEvents', 'supplements', 'quickFoods', 'injections']) if (!Array.isArray(out[k])) out[k] = d[k];
  if (!out.program || !Array.isArray(out.program.workouts)) out.program = d.program;
  if (!out.daily || typeof out.daily !== 'object') out.daily = {};
  // v1.1 shipped placeholder "example" supplements — swap them for the real defaults
  if (out.supplements.length && out.supplements.every(x => x.example)) out.supplements = d.supplements;
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
export function replaceState(obj) { state = migrate(obj); save(); }
export function resetAll() { if (typeof localStorage !== 'undefined') localStorage.removeItem(KEY); state = defaults(); save(); }
export function resetProgram() { state.program = clone(PROGRAM); save(); }

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

export function day(date = ymd()) {
  if (!state.daily[date]) state.daily[date] = { protein: 0, kcal: 0, waterOz: 0, sleep: null, steps: 0, dizzy: null, dizzyNote: '', cls: false };
  const d = state.daily[date];
  if (!Array.isArray(d.proteinLog)) d.proteinLog = d.protein ? [{ id: uid(), ts: null, g: d.protein, label: 'earlier' }] : [];
  if (!d.supps || typeof d.supps !== 'object') d.supps = {};
  return d;
}
export function recalcProtein(d) { d.protein = d.proteinLog.reduce((a, e) => a + (+e.g || 0), 0); }
