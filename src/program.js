// ============================================================================
//  PROGRAM FILE — Coach Brooke's locked program for Boss.
//  Edit this file to change the default program, schedule, targets, and rules.
//  (Exercise ids refer to entries in src/exercises.js.)
//  In-app edits (Settings → Program / Schedule / Targets) are saved on the
//  device and override these defaults; "Reset program to default" restores this.
// ============================================================================

export const PROGRAM = {
  id: 'dre-ul4-v2',
  name: "Coach Brooke — Upper/Lower 4-day",
  rir: 2,                 // leave 2 reps in reserve on every working set
  cycleWeeks: 6,          // program weeks per cycle
  deloadWeek: 6,          // week 6 of every cycle is a deload
  // Workout ids stay U1/L1/U2/L2 so logged history and the rotation carry over from v1.
  workouts: [
    {
      id: 'U1', name: 'Upper A', short: 'UA',
      exercises: [
        { ex: 'bench_press',              sets: 3, reps: [6, 8] },
        { ex: 'chest_supported_row',      sets: 3, reps: [8, 10] },
        { ex: 'seated_db_shoulder_press', sets: 3, reps: [8, 10] },
        { ex: 'lat_pulldown',             sets: 3, reps: [10, 12] },
        { ex: 'cable_triceps_pushdown',   sets: 3, reps: [12, 15] },
      ],
    },
    {
      id: 'L1', name: 'Lower A', short: 'LA',
      exercises: [
        { ex: 'box_squat',          sets: 3, reps: [6, 8] },
        { ex: 'romanian_deadlift',  sets: 3, reps: [8, 10] },
        { ex: 'leg_press',          sets: 3, reps: [10, 12] },
        { ex: 'seated_leg_curl',    sets: 3, reps: [10, 12] },
        { ex: 'calf_raise',         sets: 3, reps: [12, 15] },
      ],
    },
    {
      id: 'U2', name: 'Upper B', short: 'UB',
      exercises: [
        { ex: 'incline_db_press',    sets: 3, reps: [8, 10] },
        { ex: 'assisted_pullup',     sets: 3, reps: [6, 10] },
        { ex: 'seated_cable_row',    sets: 3, reps: [10, 12] },
        { ex: 'cable_lateral_raise', sets: 3, reps: [12, 15] },
        { ex: 'db_curl',             sets: 3, reps: [10, 12] },
      ],
    },
    {
      id: 'L2', name: 'Lower B', short: 'LB',
      exercises: [
        { ex: 'trap_bar_deadlift', sets: 3, reps: [6, 8] },
        { ex: 'split_squat',       sets: 3, reps: [8, 10], note: 'per leg' },
        { ex: 'hip_thrust',        sets: 3, reps: [10, 12] },
        { ex: 'leg_extension',     sets: 3, reps: [12, 15] },
        { ex: 'plank',             sets: 3, reps: [30, 45], note: 'seconds' },
      ],
    },
  ],
};

/** The plan before v1.9 (3 lifts per day) — only used to migrate saved plans. */
export const LEGACY_PROGRAM_V1 = {
  id: 'dre-ul4-v1',
  workouts: {
    U1: ['bench_press', 'chest_supported_row', 'seated_db_shoulder_press'],
    L1: ['box_squat', 'romanian_deadlift', 'leg_press'],
    U2: ['lat_pulldown', 'incline_db_press', 'cable_lateral_raise'],
    L2: ['trap_bar_deadlift', 'split_squat', 'hip_thrust'],
  },
  schedule: ['steps', 'lift:U1', 'steps', 'lift:L1', 'steps', 'lift:U2', 'lift:L2'],
};

// Weekly schedule, indexed by JS weekday (0 = Sunday … 6 = Saturday).
// type: 'lift' (with workout id) | 'steps' | 'class' (class / other training) | 'rest'
export const DEFAULT_SCHEDULE = [
  { type: 'steps' },                    // Sun — 6–8k step walk
  { type: 'lift', workout: 'U1' },      // Mon — Upper A
  { type: 'rest' },                     // Tue — always rest
  { type: 'lift', workout: 'L1' },      // Wed — Lower A
  { type: 'steps' },                    // Thu — 6–8k step walk
  { type: 'lift', workout: 'U2' },      // Fri — Upper B
  { type: 'lift', workout: 'L2' },      // Sat — Lower B
];

// Daily targets from Coach Brooke (editable in Settings).
export const DEFAULT_TARGETS = {
  kcal: 1800,
  protein: 210,   // g
  fat: 55,        // g (approx.)
  carbs: 125,     // g (approx.)
  steps: 7000,    // default shown; steps-day range below
  stepsMin: 6000,
  stepsMax: 8000,
  waterOz: 100,
};

// Progression rules.
export const PROGRESSION = {
  upperIncrementLb: 5,    // all sets at top of range → +5 lb (upper)
  lowerIncrementLb: 10,   // all sets at top of range → +10 lb (lower)
  deloadSets: 2,          // deload: 2 sets…
  deloadWeightPct: 0.9,   // …at ~90% of last working weight
  badDayLifts: 2,         // "Bad day": only first 2 lifts…
  badDaySets: 2,          // …2 sets each
};

// Rest timers (seconds).
export const DEFAULT_REST = {
  first: 150,   // first lift of each workout (range 2–3 min)
  other: 90,    // the other two lifts
};

// Bodyweight
export const BODYWEIGHT = {
  start: { date: '2026-10-23', lb: 255 },
  goal: 200,
  weighInDay: 1, // Monday-morning weigh-in prompt
};

// Boss's daily supplements (edit in Settings → Supplements).
// timing: 'morning' | 'pre' | 'post' | 'evening'
// proteinG: checking it off offers to add that many grams to the protein tracker.
// Tirzepatide is NOT listed here: it's the weekly injection (settings.injectionDay) and is
// added to the checklist automatically on due days only. Electrolytes live in the pre-workout check.
export const DEFAULT_SUPPLEMENTS = [
  { id: 'creatine', name: 'Creatine', dose: '5 g', timing: 'morning' },
  { id: 'protein-shake', name: 'Protein shake', dose: '1 shake', timing: 'post', proteinG: 50 },
];
export const SUPP_TIMINGS = [['morning', 'Morning'], ['pre', 'Pre-workout'], ['post', 'Post-workout'], ['evening', 'Evening']];

// Saved quick foods for the protein tracker (editable in Settings → Quick foods).
export const DEFAULT_QUICK_FOODS = [
  { id: 'qf-shake', name: 'Protein shake', g: 50 },
  { id: 'qf-chicken', name: 'Chicken breast (6 oz)', g: 50 },
  { id: 'qf-yogurt', name: 'Greek yogurt cup', g: 18 },
  { id: 'qf-eggs', name: '3 eggs', g: 18 },
];
