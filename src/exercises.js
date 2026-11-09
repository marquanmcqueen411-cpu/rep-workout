// ============================================================================
//  EXERCISE LIBRARY — LA Fitness-friendly equipment.
//  region: 'upper' | 'lower'  (drives +5 / +10 lb progression)
//  pattern: used to suggest swaps (same pattern = sensible substitute)
//  primary/secondary: muscle ids used by the recovery map
//  demo: YouTube search query (we link out; no hotlinked/copyrighted media)
// ============================================================================

export const MUSCLES = {
  chest: 'Chest', front_delts: 'Front delts', side_delts: 'Side delts', rear_delts: 'Rear delts',
  biceps: 'Biceps', triceps: 'Triceps', forearms: 'Forearms', abs: 'Abs', obliques: 'Obliques',
  traps: 'Traps', upper_back: 'Upper back', lats: 'Lats', lower_back: 'Lower back',
  glutes: 'Glutes', quads: 'Quads', hamstrings: 'Hamstrings', adductors: 'Adductors', calves: 'Calves',
};

const E = (id, name, equipment, region, pattern, primary, secondary, cues, extra = {}) =>
  ({ id, name, equipment, region, pattern, primary, secondary, cues, ...extra });

export const EXERCISES = [
  // ---- Horizontal push
  E('bench_press', 'Barbell Bench Press', 'Barbell + flat bench', 'upper', 'h_push',
    ['chest'], ['front_delts', 'triceps'],
    ['Eyes under the bar, feet planted, slight arch.', 'Squeeze shoulder blades back and down.',
     'Grip just outside shoulder width; wrists stacked over elbows.', 'Lower to mid/lower chest, elbows ~45°.',
     'Press up and slightly back. Use a spotter or safety arms.']),
  E('smith_bench_press', 'Smith Machine Bench Press', 'Smith machine', 'upper', 'h_push',
    ['chest'], ['front_delts', 'triceps'],
    ['Set bench so bar touches lower chest.', 'Set the safety stops just above chest height.',
     'Shoulder blades pinned; controlled 2-sec lowering.', 'Press to just short of lockout.']),
  E('db_bench_press', 'Dumbbell Bench Press', 'Dumbbells + flat bench', 'upper', 'h_push',
    ['chest'], ['front_delts', 'triceps'],
    ['Kick DBs up from thighs as you lie back.', 'Lower to chest level, elbows ~45°.',
     'Press up, bring DBs together without clanking.'], { perHand: true }),
  E('machine_chest_press', 'Machine Chest Press', 'Chest press machine', 'upper', 'h_push',
    ['chest'], ['front_delts', 'triceps'],
    ['Seat so handles line up with mid-chest.', 'Back flat on pad, shoulders down.', 'Smooth press; control the return.']),
  // ---- Incline push
  E('incline_db_press', 'Incline Dumbbell Press', 'Dumbbells + incline bench (30°)', 'upper', 'h_push',
    ['chest', 'front_delts'], ['triceps'],
    ['Bench at ~30°, not steeper.', 'Shoulder blades back; slight arch.',
     'Lower DBs to upper chest, elbows slightly tucked.', 'Press up and in over the upper chest.'], { perHand: true }),
  E('incline_smith_press', 'Incline Smith Press', 'Smith machine + incline bench', 'upper', 'h_push',
    ['chest', 'front_delts'], ['triceps'],
    ['Bench ~30°; bar path to upper chest.', 'Set safeties.', 'Control down, press up without bouncing.']),
  // ---- Vertical push
  E('seated_db_shoulder_press', 'Seated DB Shoulder Press', 'Dumbbells + upright bench', 'upper', 'v_push',
    ['front_delts'], ['side_delts', 'triceps'],
    ['Back against the pad (~80–90°).', 'Start DBs at ear height, palms forward or slightly in.',
     'Press up without flaring ribs; don’t arch off the pad.', 'Lower under control to ear/chin level.'], { perHand: true }),
  E('machine_shoulder_press', 'Machine Shoulder Press', 'Shoulder press machine', 'upper', 'v_push',
    ['front_delts'], ['side_delts', 'triceps'],
    ['Handles start around shoulder/chin height.', 'Brace core, keep back on pad.', 'Press smoothly, control down.']),
  E('smith_shoulder_press', 'Smith Seated Shoulder Press', 'Smith machine + upright bench', 'upper', 'v_push',
    ['front_delts'], ['side_delts', 'triceps'],
    ['Bench slightly in front of bar so it clears your face.', 'Lower to chin level.', 'Press without arching.']),
  // ---- Horizontal pull
  E('chest_supported_row', 'Chest-Supported Row', 'Chest-supported row machine (or incline bench + DBs)', 'upper', 'h_pull',
    ['upper_back', 'lats'], ['rear_delts', 'biceps'],
    ['Chest stays on the pad the whole set.', 'Start with arms long, shoulders slightly forward.',
     'Pull elbows back toward hips; squeeze shoulder blades.', 'Pause 1 sec, lower slowly.']),
  E('incline_db_row', 'Incline Bench DB Row', 'Dumbbells + incline bench', 'upper', 'h_pull',
    ['upper_back', 'lats'], ['rear_delts', 'biceps'],
    ['Lie face-down on a 30–45° bench.', 'Row DBs toward lower ribs.', 'No bouncing off the pad.'], { perHand: true }),
  E('seated_cable_row', 'Seated Cable Row', 'Cable row station', 'upper', 'h_pull',
    ['upper_back', 'lats'], ['rear_delts', 'biceps'],
    ['Tall chest, slight knee bend.', 'Pull handle to belly button.', 'Don’t rock the torso; control the stretch.']),
  E('one_arm_db_row', 'One-Arm DB Row', 'Dumbbell + flat bench', 'upper', 'h_pull',
    ['lats', 'upper_back'], ['rear_delts', 'biceps'],
    ['Hand and knee on bench, flat back.', 'Pull DB toward your hip.', 'Full stretch at bottom.'], { perHand: true }),
  // ---- Vertical pull
  E('lat_pulldown', 'Lat Pulldown', 'Lat pulldown machine', 'upper', 'v_pull',
    ['lats'], ['upper_back', 'biceps', 'rear_delts'],
    ['Thighs locked under pad; grip slightly wider than shoulders.', 'Lean back slightly, chest up.',
     'Drive elbows down to your sides; bar to upper chest.', 'Control up to a full stretch.']),
  E('assisted_pullup', 'Assisted Pull-Up', 'Assisted pull-up/dip machine', 'upper', 'v_pull',
    ['lats'], ['upper_back', 'biceps'],
    ['More assistance weight = easier.', 'Full hang to chin over bar.', 'Shoulders down, no kipping.']),
  E('cable_pulldown_neutral', 'Neutral-Grip Cable Pulldown', 'Cable + V-handle', 'upper', 'v_pull',
    ['lats'], ['upper_back', 'biceps'],
    ['Pull handle to upper chest.', 'Elbows drive down & back.', 'Full stretch each rep.']),
  // ---- Lateral raise
  E('cable_lateral_raise', 'Cable Lateral Raise', 'Cable (low pulley) + D-handle', 'upper', 'lat_raise',
    ['side_delts'], ['traps'],
    ['Stand side-on to the low pulley; handle in far hand.', 'Slight forward lean, soft elbow.',
     'Raise out to the side to shoulder height — lead with elbow.', 'Slow 2–3 sec lowering; no shrugging.'], { isolation: true }),
  E('db_lateral_raise', 'Dumbbell Lateral Raise', 'Dumbbells', 'upper', 'lat_raise',
    ['side_delts'], ['traps'],
    ['Slight bend in elbows.', 'Raise to shoulder height, pinkies level with thumbs.', 'Control down; no swinging.'],
    { perHand: true, isolation: true }),
  E('machine_lateral_raise', 'Machine Lateral Raise', 'Lateral raise machine', 'upper', 'lat_raise',
    ['side_delts'], [], ['Pads on outside of elbows.', 'Raise to shoulder height.', 'Pause, lower slowly.'], { isolation: true }),
  // ---- Squat
  E('box_squat', 'Box Squat', 'Barbell + squat rack + box/bench', 'lower', 'squat',
    ['quads', 'glutes'], ['adductors', 'lower_back'],
    ['Box/bench height so thighs are about parallel.', 'Bar on upper back, brace hard (big breath).',
     'Sit back and down under control; touch the box — don’t crash.', 'Stay tight, drive up through mid-foot.',
     'Set safety pins just below bar height at the bottom.']),
  E('smith_box_squat', 'Smith Machine Box Squat', 'Smith machine + bench', 'lower', 'squat',
    ['quads', 'glutes'], ['adductors'],
    ['Feet slightly forward of the bar.', 'Sit to the bench lightly, then drive up.', 'Set safety stops.']),
  E('hack_squat', 'Hack Squat Machine', 'Hack squat machine', 'lower', 'squat',
    ['quads', 'glutes'], ['adductors'],
    ['Feet shoulder width, mid-platform.', 'Lower until thighs ~parallel or below.', 'Press through whole foot.']),
  E('goblet_squat', 'Goblet Squat', 'Dumbbell', 'lower', 'squat',
    ['quads', 'glutes'], ['adductors', 'abs'],
    ['Hold DB at chest, elbows down.', 'Sit between your heels, chest tall.', 'Drive up through mid-foot.']),
  // ---- Hinge
  E('romanian_deadlift', 'Romanian Deadlift', 'Barbell (or dumbbells)', 'lower', 'hinge',
    ['hamstrings', 'glutes'], ['lower_back', 'forearms'],
    ['Start standing, soft knees, bar against thighs.', 'Push hips BACK; bar slides down the thighs.',
     'Keep back flat; stop when hamstrings are stretched (~mid-shin).', 'Squeeze glutes to stand tall.']),
  E('db_romanian_deadlift', 'Dumbbell RDL', 'Dumbbells', 'lower', 'hinge',
    ['hamstrings', 'glutes'], ['lower_back', 'forearms'],
    ['DBs close to legs.', 'Hips back, flat back.', 'Stand by squeezing glutes.'], { perHand: true }),
  E('trap_bar_deadlift', 'Trap-Bar Deadlift', 'Trap/hex bar', 'lower', 'hinge',
    ['glutes', 'quads', 'hamstrings'], ['lower_back', 'traps', 'forearms'],
    ['Stand centered in the bar, feet hip width.', 'Hips down, chest up, grab handles; arms long.',
     'Brace, push the floor away.', 'Stand tall — don’t lean back. Lower under control.']),
  E('db_deadlift', 'Dumbbell Deadlift', 'Dumbbells', 'lower', 'hinge',
    ['glutes', 'quads', 'hamstrings'], ['lower_back', 'forearms'],
    ['DBs at your sides.', 'Hips back & down, chest up.', 'Drive up, stand tall.'], { perHand: true }),
  E('smith_deadlift', 'Smith Machine Deadlift', 'Smith machine', 'lower', 'hinge',
    ['glutes', 'hamstrings'], ['quads', 'lower_back'],
    ['Bar over mid-foot.', 'Flat back, brace.', 'Stand tall; control down.']),
  E('lying_leg_curl', 'Lying/Seated Leg Curl', 'Leg curl machine', 'lower', 'ham_iso',
    ['hamstrings'], ['calves'], ['Knees line up with machine pivot.', 'Curl fully, pause.', 'Slow lowering.'], { isolation: true }),
  // ---- Leg press / quad
  E('leg_press', 'Leg Press', 'Leg press machine', 'lower', 'squat',
    ['quads', 'glutes'], ['adductors'],
    ['Feet shoulder width, mid-platform.', 'Lower until knees ~90° — low back stays on the pad.',
     'Press through whole foot; don’t lock knees hard.', 'Control every rep.']),
  E('leg_extension', 'Leg Extension', 'Leg extension machine', 'lower', 'quad_iso',
    ['quads'], [], ['Knee aligned with pivot.', 'Extend fully, squeeze 1 sec.', 'Slow down.'], { isolation: true }),
  // ---- Lunge
  E('split_squat', 'Split Squat (per leg)', 'Dumbbells (or Smith machine)', 'lower', 'lunge',
    ['quads', 'glutes'], ['adductors', 'hamstrings'],
    ['Long split stance; hold DBs at sides (hold a rack for balance if needed).',
     'Drop the back knee straight down toward the floor.', 'Front foot flat; drive up through front heel/mid-foot.',
     'All reps on one leg, then switch. Log reps per leg.'], { perHand: true }),
  E('bulgarian_split_squat', 'Bulgarian Split Squat', 'Dumbbells + bench', 'lower', 'lunge',
    ['quads', 'glutes'], ['adductors'],
    ['Back foot on bench.', 'Drop straight down.', 'Drive through front foot.'], { perHand: true }),
  E('smith_split_squat', 'Smith Split Squat', 'Smith machine', 'lower', 'lunge',
    ['quads', 'glutes'], ['adductors'],
    ['Bar on upper back, long stance.', 'Back knee straight down.', 'Drive up through front foot.']),
  E('walking_lunge', 'DB Walking Lunge', 'Dumbbells', 'lower', 'lunge',
    ['quads', 'glutes'], ['adductors', 'hamstrings'],
    ['Long steps.', 'Back knee toward floor.', 'Stay upright.'], { perHand: true }),
  // ---- Glute
  E('hip_thrust', 'Barbell Hip Thrust', 'Barbell + bench (pad on bar)', 'lower', 'glute',
    ['glutes'], ['hamstrings'],
    ['Upper back on bench edge, bar padded over hips.', 'Feet flat, shins vertical at the top.',
     'Tuck chin, drive hips up until torso is flat.', 'Squeeze glutes 1 sec; don’t over-arch the low back.']),
  E('smith_hip_thrust', 'Smith Hip Thrust', 'Smith machine + bench', 'lower', 'glute',
    ['glutes'], ['hamstrings'], ['Bar padded over hips.', 'Drive up to flat torso.', 'Squeeze 1 sec.']),
  E('glute_drive_machine', 'Hip Thrust Machine', 'Glute drive / hip thrust machine', 'lower', 'glute',
    ['glutes'], ['hamstrings'], ['Belt over hips.', 'Drive up, squeeze.', 'Control down.']),
  // ---- Extras
  E('cable_triceps_pushdown', 'Cable Triceps Pushdown', 'Cable + rope/bar', 'upper', 'arms',
    ['triceps'], [], ['Elbows pinned at sides.', 'Push down to full lockout.', 'Control up.'], { isolation: true }),
  E('cable_curl', 'Cable Curl', 'Cable + bar', 'upper', 'arms',
    ['biceps'], ['forearms'], ['Elbows at sides.', 'Curl up, squeeze.', 'Slow down.'], { isolation: true }),
  E('face_pull', 'Cable Face Pull', 'Cable + rope', 'upper', 'h_pull',
    ['rear_delts'], ['upper_back', 'traps'], ['Rope at face height.', 'Pull to forehead, elbows high.', 'Squeeze rear delts.'], { isolation: true }),
  E('calf_raise', 'Standing Calf Raise', 'Calf raise machine / Smith', 'lower', 'calf',
    ['calves'], [], ['Full stretch at bottom.', 'Rise high, pause.', 'Slow lowering.'], { isolation: true }),
];

export const EX_BY_ID = Object.fromEntries(EXERCISES.map(e => [e.id, e]));

export function exercise(id) {
  return EX_BY_ID[id] || { id, name: id, equipment: '', region: 'upper', pattern: 'other', primary: [], secondary: [], cues: [] };
}

export function demoUrl(ex) {
  const q = `${ex.name} proper form tutorial`;
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
}

export function alternatives(id) {
  const ex = exercise(id);
  return EXERCISES.filter(e => e.id !== id && e.pattern === ex.pattern);
}
