// ============================================================================
//  PROGRAM FILE — Coach Dre's locked program for Boss.
//  Edit this file to change the default program, schedule, targets, and rules.
//  (Exercise ids refer to entries in src/exercises.js.)
//  In-app edits (Settings → Program / Schedule / Targets) are saved on the
//  device and override these defaults; "Reset program to default" restores this.
// ============================================================================

export const PROGRAM = {
  id: 'dre-ul4-v1',
  name: "Coach Dre — Upper/Lower x4",
  rir: 2,                 // leave 2 reps in reserve on every working set
  cycleWeeks: 6,          // program weeks per cycle
  deloadWeek: 6,          // week 6 of every cycle is a deload
  workouts: [
    {
      id: 'U1', name: 'Upper 1', short: 'U1',
      exercises: [
        { ex: 'bench_press',          sets: 3, reps: [6, 8] },
        { ex: 'chest_supported_row',  sets: 3, reps: [8, 10] },
        { ex: 'seated_db_shoulder_press', sets: 3, reps: [8, 10] },
      ],
    },
    {
      id: 'L1', name: 'Lower 1', short: 'L1',
      exercises: [
        { ex: 'box_squat',            sets: 3, reps: [6, 8] },
        { ex: 'romanian_deadlift',    sets: 3, reps: [8, 10] },
        { ex: 'leg_press',            sets: 3, reps: [10, 12] },
      ],
    },
    {
      id: 'U2', name: 'Upper 2', short: 'U2',
      exercises: [
        { ex: 'lat_pulldown',         sets: 3, reps: [8, 12] },
        { ex: 'incline_db_press',     sets: 3, reps: [8, 12] },
        { ex: 'cable_lateral_raise',  sets: 3, reps: [12, 15] },
      ],
    },
    {
      id: 'L2', name: 'Lower 2', short: 'L2',
      exercises: [
        { ex: 'trap_bar_deadlift',    sets: 3, reps: [6, 8] },
        { ex: 'split_squat',          sets: 3, reps: [8, 10], note: 'per leg' },
        { ex: 'hip_thrust',           sets: 3, reps: [10, 12] },
      ],
    },
  ],
};

// Weekly schedule, indexed by JS weekday (0 = Sunday … 6 = Saturday).
// type: 'lift' (with workout id) | 'steps' | 'class' (class / other training) | 'rest'
export const DEFAULT_SCHEDULE = [
  { type: 'steps' },                    // Sun
  { type: 'lift', workout: 'U1' },      // Mon
  { type: 'steps' },                    // Tue
  { type: 'lift', workout: 'L1' },      // Wed
  { type: 'steps' },                    // Thu
  { type: 'lift', workout: 'U2' },      // Fri
  { type: 'lift', workout: 'L2' },      // Sat
];

// Daily targets from Coach Dre (editable in Settings).
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
