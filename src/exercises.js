// ============================================================================
//  EXERCISE LIBRARY — LA Fitness-friendly equipment.
//  region: 'upper' | 'lower'  (drives +5 / +10 lb progression)
//  pattern: movement pattern · swaps: Coach Dre ranked lists in DRE_SWAPS
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
     'Press up and slightly back. Use a spotter or safety arms.'], { equip: 'barbell' }),
  E('smith_bench_press', 'Smith Machine Bench Press', 'Smith machine', 'upper', 'h_push',
    ['chest'], ['front_delts', 'triceps'],
    ['Set bench so bar touches lower chest.', 'Set the safety stops just above chest height.',
     'Shoulder blades pinned; controlled 2-sec lowering.', 'Press to just short of lockout.'], { equip: 'smith' }),
  E('db_bench_press', 'Dumbbell Bench Press', 'Dumbbells + flat bench', 'upper', 'h_push',
    ['chest'], ['front_delts', 'triceps'],
    ['Kick DBs up from thighs as you lie back.', 'Lower to chest level, elbows ~45°.',
     'Press up, bring DBs together without clanking.'], { perHand: true , equip: 'db' }),
  E('machine_chest_press', 'Hammer Strength / Machine Chest Press', 'Hammer Strength / chest press machine', 'upper', 'h_push',
    ['chest'], ['front_delts', 'triceps'],
    ['Seat so handles line up with mid-chest.', 'Back flat on pad, shoulders down.', 'Smooth press; control the return.'], { equip: 'machine' }),
  // ---- Incline push
  E('incline_db_press', 'Incline Dumbbell Press', 'Dumbbells + incline bench (30°)', 'upper', 'h_push',
    ['chest', 'front_delts'], ['triceps'],
    ['Bench at ~30°, not steeper.', 'Shoulder blades back; slight arch.',
     'Lower DBs to upper chest, elbows slightly tucked.', 'Press up and in over the upper chest.'], { perHand: true , equip: 'db' }),
  E('incline_smith_press', 'Incline Smith Press', 'Smith machine + incline bench', 'upper', 'h_push',
    ['chest', 'front_delts'], ['triceps'],
    ['Bench ~30°; bar path to upper chest.', 'Set safeties.', 'Control down, press up without bouncing.'], { equip: 'smith' }),
  // ---- Vertical push
  E('seated_db_shoulder_press', 'Seated DB Shoulder Press', 'Dumbbells + upright bench', 'upper', 'v_push',
    ['front_delts'], ['side_delts', 'triceps'],
    ['Back against the pad (~80–90°).', 'Start DBs at ear height, palms forward or slightly in.',
     'Press up without flaring ribs; don’t arch off the pad.', 'Lower under control to ear/chin level.'], { perHand: true , equip: 'db' }),
  E('machine_shoulder_press', 'Machine Shoulder Press', 'Shoulder press machine', 'upper', 'v_push',
    ['front_delts'], ['side_delts', 'triceps'],
    ['Handles start around shoulder/chin height.', 'Brace core, keep back on pad.', 'Press smoothly, control down.'], { equip: 'machine' }),
  E('smith_shoulder_press', 'Smith Seated Shoulder Press', 'Smith machine + upright bench', 'upper', 'v_push',
    ['front_delts'], ['side_delts', 'triceps'],
    ['Bench slightly in front of bar so it clears your face.', 'Lower to chin level.', 'Press without arching.'], { equip: 'smith' }),
  // ---- Horizontal pull
  E('chest_supported_row', 'Chest-Supported Row', 'Chest-supported row machine (or incline bench + DBs)', 'upper', 'h_pull',
    ['upper_back', 'lats'], ['rear_delts', 'biceps'],
    ['Chest stays on the pad the whole set.', 'Start with arms long, shoulders slightly forward.',
     'Pull elbows back toward hips; squeeze shoulder blades.', 'Pause 1 sec, lower slowly.'], { equip: 'machine' }),
  E('incline_db_row', 'Incline Bench DB Row', 'Dumbbells + incline bench', 'upper', 'h_pull',
    ['upper_back', 'lats'], ['rear_delts', 'biceps'],
    ['Lie face-down on a 30–45° bench.', 'Row DBs toward lower ribs.', 'No bouncing off the pad.'], { perHand: true , equip: 'db' }),
  E('seated_cable_row', 'Seated Cable Row', 'Cable row station', 'upper', 'h_pull',
    ['upper_back', 'lats'], ['rear_delts', 'biceps'],
    ['Tall chest, slight knee bend.', 'Pull handle to belly button.', 'Don’t rock the torso; control the stretch.'], { equip: 'cable' }),
  E('one_arm_db_row', 'One-Arm DB Row', 'Dumbbell + flat bench', 'upper', 'h_pull',
    ['lats', 'upper_back'], ['rear_delts', 'biceps'],
    ['Hand and knee on bench, flat back.', 'Pull DB toward your hip.', 'Full stretch at bottom.'], { perHand: true , equip: 'db' }),
  // ---- Vertical pull
  E('lat_pulldown', 'Lat Pulldown', 'Lat pulldown machine', 'upper', 'v_pull',
    ['lats'], ['upper_back', 'biceps', 'rear_delts'],
    ['Thighs locked under pad; grip slightly wider than shoulders.', 'Lean back slightly, chest up.',
     'Drive elbows down to your sides; bar to upper chest.', 'Control up to a full stretch.'], { equip: 'machine' }),
  E('assisted_pullup', 'Assisted Pull-Up', 'Assisted pull-up/dip machine', 'upper', 'v_pull',
    ['lats'], ['upper_back', 'biceps'],
    ['More assistance weight = easier.', 'Full hang to chin over bar.', 'Shoulders down, no kipping.'], { equip: 'machine', assisted: true }),
  E('cable_pulldown_neutral', 'Neutral-Grip Cable Pulldown', 'Cable + V-handle', 'upper', 'v_pull',
    ['lats'], ['upper_back', 'biceps'],
    ['Pull handle to upper chest.', 'Elbows drive down & back.', 'Full stretch each rep.'], { equip: 'cable' }),
  // ---- Lateral raise
  E('cable_lateral_raise', 'Cable Lateral Raise', 'Cable (low pulley) + D-handle', 'upper', 'lat_raise',
    ['side_delts'], ['traps'],
    ['Stand side-on to the low pulley; handle in far hand.', 'Slight forward lean, soft elbow.',
     'Raise out to the side to shoulder height — lead with elbow.', 'Slow 2–3 sec lowering; no shrugging.'], { isolation: true , equip: 'cable' }),
  E('db_lateral_raise', 'Dumbbell Lateral Raise', 'Dumbbells', 'upper', 'lat_raise',
    ['side_delts'], ['traps'],
    ['Slight bend in elbows.', 'Raise to shoulder height, pinkies level with thumbs.', 'Control down; no swinging.'],
    { perHand: true, isolation: true , equip: 'db' }),
  E('machine_lateral_raise', 'Machine Lateral Raise', 'Lateral raise machine', 'upper', 'lat_raise',
    ['side_delts'], [], ['Pads on outside of elbows.', 'Raise to shoulder height.', 'Pause, lower slowly.'], { isolation: true , equip: 'machine' }),
  // ---- Squat
  E('box_squat', 'Box Squat', 'Barbell + squat rack + box/bench', 'lower', 'squat',
    ['quads', 'glutes'], ['adductors', 'lower_back'],
    ['Box/bench height so thighs are about parallel.', 'Bar on upper back, brace hard (big breath).',
     'Sit back and down under control; touch the box — don’t crash.', 'Stay tight, drive up through mid-foot.',
     'Set safety pins just below bar height at the bottom.'], { equip: 'barbell' }),
  E('smith_box_squat', 'Smith Machine Box Squat', 'Smith machine + bench', 'lower', 'squat',
    ['quads', 'glutes'], ['adductors'],
    ['Feet slightly forward of the bar.', 'Sit to the bench lightly, then drive up.', 'Set safety stops.'], { equip: 'smith' }),
  E('hack_squat', 'Hack Squat Machine', 'Hack squat machine', 'lower', 'squat',
    ['quads', 'glutes'], ['adductors'],
    ['Feet shoulder width, mid-platform.', 'Lower until thighs ~parallel or below.', 'Press through whole foot.'], { equip: 'machine' }),
  E('goblet_squat', 'Goblet Squat', 'Dumbbell', 'lower', 'squat',
    ['quads', 'glutes'], ['adductors', 'abs'],
    ['Hold DB at chest, elbows down.', 'Sit between your heels, chest tall.', 'Drive up through mid-foot.'], { equip: 'db' }),
  // ---- Hinge
  E('romanian_deadlift', 'Romanian Deadlift', 'Barbell (or dumbbells)', 'lower', 'hinge',
    ['hamstrings', 'glutes'], ['lower_back', 'forearms'],
    ['Start standing, soft knees, bar against thighs.', 'Push hips BACK; bar slides down the thighs.',
     'Keep back flat; stop when hamstrings are stretched (~mid-shin).', 'Squeeze glutes to stand tall.'], { equip: 'barbell' }),
  E('db_romanian_deadlift', 'Dumbbell RDL', 'Dumbbells', 'lower', 'hinge',
    ['hamstrings', 'glutes'], ['lower_back', 'forearms'],
    ['DBs close to legs.', 'Hips back, flat back.', 'Stand by squeezing glutes.'], { perHand: true , equip: 'db' }),
  E('trap_bar_deadlift', 'Trap-Bar Deadlift', 'Trap/hex bar', 'lower', 'hinge',
    ['glutes', 'quads', 'hamstrings'], ['lower_back', 'traps', 'forearms'],
    ['Stand centered in the bar, feet hip width.', 'Hips down, chest up, grab handles; arms long.',
     'Brace, push the floor away.', 'Stand tall — don’t lean back. Lower under control.'], { equip: 'barbell' }),
  E('db_deadlift', 'Dumbbell Deadlift', 'Dumbbells', 'lower', 'hinge',
    ['glutes', 'quads', 'hamstrings'], ['lower_back', 'forearms'],
    ['DBs at your sides.', 'Hips back & down, chest up.', 'Drive up, stand tall.'], { perHand: true , equip: 'db' }),
  E('smith_deadlift', 'Smith Machine Deadlift', 'Smith machine', 'lower', 'hinge',
    ['glutes', 'hamstrings'], ['quads', 'lower_back'],
    ['Bar over mid-foot.', 'Flat back, brace.', 'Stand tall; control down.'], { equip: 'smith' }),
  E('lying_leg_curl', 'Lying/Seated Leg Curl', 'Leg curl machine', 'lower', 'ham_iso',
    ['hamstrings'], ['calves'], ['Knees line up with machine pivot.', 'Curl fully, pause.', 'Slow lowering.'], { isolation: true , equip: 'machine' }),
  // ---- Leg press / quad
  E('leg_press', 'Leg Press', 'Leg press machine', 'lower', 'squat',
    ['quads', 'glutes'], ['adductors'],
    ['Feet shoulder width, mid-platform.', 'Lower until knees ~90° — low back stays on the pad.',
     'Press through whole foot; don’t lock knees hard.', 'Control every rep.'], { equip: 'machine' }),
  E('leg_extension', 'Leg Extension', 'Leg extension machine', 'lower', 'quad_iso',
    ['quads'], [], ['Knee aligned with pivot.', 'Extend fully, squeeze 1 sec.', 'Slow down.'], { isolation: true , equip: 'machine' }),
  // ---- Lunge
  E('split_squat', 'Split Squat (per leg)', 'Dumbbells (or Smith machine)', 'lower', 'lunge',
    ['quads', 'glutes'], ['adductors', 'hamstrings'],
    ['Long split stance; hold DBs at sides (hold a rack for balance if needed).',
     'Drop the back knee straight down toward the floor.', 'Front foot flat; drive up through front heel/mid-foot.',
     'All reps on one leg, then switch. Log reps per leg.'], { perHand: true , equip: 'db' }),
  E('bulgarian_split_squat', 'Bulgarian Split Squat', 'Dumbbells + bench', 'lower', 'lunge',
    ['quads', 'glutes'], ['adductors'],
    ['Back foot on bench.', 'Drop straight down.', 'Drive through front foot.'], { perHand: true , equip: 'db' }),
  E('smith_split_squat', 'Smith Split Squat', 'Smith machine', 'lower', 'lunge',
    ['quads', 'glutes'], ['adductors'],
    ['Bar on upper back, long stance.', 'Back knee straight down.', 'Drive up through front foot.'], { equip: 'smith' }),
  E('walking_lunge', 'DB Walking Lunge', 'Dumbbells', 'lower', 'lunge',
    ['quads', 'glutes'], ['adductors', 'hamstrings'],
    ['Long steps.', 'Back knee toward floor.', 'Stay upright.'], { perHand: true , equip: 'db' }),
  // ---- Glute
  E('hip_thrust', 'Barbell Hip Thrust', 'Barbell + bench (pad on bar)', 'lower', 'glute',
    ['glutes'], ['hamstrings'],
    ['Upper back on bench edge, bar padded over hips.', 'Feet flat, shins vertical at the top.',
     'Tuck chin, drive hips up until torso is flat.', 'Squeeze glutes 1 sec; don’t over-arch the low back.'], { equip: 'barbell' }),
  E('smith_hip_thrust', 'Smith Hip Thrust', 'Smith machine + bench', 'lower', 'glute',
    ['glutes'], ['hamstrings'], ['Bar padded over hips.', 'Drive up to flat torso.', 'Squeeze 1 sec.'], { equip: 'smith' }),
  E('glute_drive_machine', 'Hip Thrust Machine', 'Glute drive / hip thrust machine', 'lower', 'glute',
    ['glutes'], ['hamstrings'], ['Belt over hips.', 'Drive up, squeeze.', 'Control down.'], { equip: 'machine' }),
  // ---- Dre swap additions
  E('chest_supported_tbar_row', 'Chest-Supported T-Bar Row', 'T-bar / chest-supported row', 'upper', 'h_pull',
    ['upper_back', 'lats'], ['rear_delts', 'biceps'],
    ['Chest glued to the pad.', 'Pull elbows back toward hips.', 'Squeeze at the top; control the stretch.'], { equip: 'machine' }),
  E('machine_row', 'Hammer Strength / Machine Row', 'Hammer Strength / plate-loaded row', 'upper', 'h_pull',
    ['upper_back', 'lats'], ['rear_delts', 'biceps'],
    ['Chest on pad, neutral grip if available.', 'Pull handles to lower ribs.', 'Don’t shrug; control the return.'], { equip: 'machine' }),
  E('landmine_press', 'Standing Landmine Press', 'Landmine / barbell in corner', 'upper', 'v_push',
    ['front_delts'], ['chest', 'triceps', 'abs'],
    ['Bar in landmine or corner; hold end at shoulder.', 'Press up and slightly forward.', 'Brace core; don’t lean back hard.'], { equip: 'barbell', perHand: true }),
  E('goblet_box_squat', 'Goblet Squat to Box', 'Dumbbell + box/bench', 'lower', 'squat',
    ['quads', 'glutes'], ['adductors', 'abs'],
    ['Hold DB at chest.', 'Sit lightly to the box — don’t crash.', 'Drive up through mid-foot, chest tall.'], { equip: 'db' }),
  E('smith_rdl', 'Smith Romanian Deadlift', 'Smith machine', 'lower', 'hinge',
    ['hamstrings', 'glutes'], ['lower_back'],
    ['Bar against thighs, soft knees.', 'Hips back; bar slides down legs.', 'Flat back; squeeze glutes to stand.'], { equip: 'smith' }),
  E('back_extension_45', 'Loaded 45° Back Extension', '45-degree back extension + plate/DB', 'lower', 'hinge',
    ['hamstrings', 'glutes', 'lower_back'], [],
    ['Pad at hip crease.', 'Hinge down with flat back.', 'Squeeze glutes to rise; don’t hyperextend.'], { equip: 'machine' }),
  E('smith_squat', 'Smith Squat', 'Smith machine', 'lower', 'squat',
    ['quads', 'glutes'], ['adductors'],
    ['Feet slightly forward of the bar.', 'Lower to about parallel.', 'Drive up; set safeties.'], { equip: 'smith' }),
  E('belt_squat', 'Belt Squat', 'Belt squat machine (if available)', 'lower', 'squat',
    ['quads', 'glutes'], ['adductors'],
    ['Belt snug on hips.', 'Stand tall, sit between your feet.', 'Drive up through mid-foot.'], { equip: 'machine' }),
  E('machine_pulldown', 'Machine Pulldown', 'Plate-loaded / Hammer Strength pulldown', 'upper', 'v_pull',
    ['lats'], ['upper_back', 'biceps'],
    ['Thighs locked; chest up.', 'Pull handles to upper chest.', 'Control the stretch at the top.'], { equip: 'machine' }),
  E('single_arm_cable_pulldown', 'Single-Arm Cable Pulldown', 'Cable + D-handle (high)', 'upper', 'v_pull',
    ['lats'], ['upper_back', 'biceps'],
    ['Pull one arm from overhead to lower ribs.', 'Elbow drives down & back.', 'Switch sides; no torso twist.'], { perHand: true, equip: 'cable' }),
  E('incline_machine_press', 'Incline Machine Press', 'Incline chest press machine', 'upper', 'h_push',
    ['chest', 'front_delts'], ['triceps'],
    ['Seat so handles meet upper chest.', 'Shoulder blades back.', 'Press smoothly; control down.'], { equip: 'machine' }),
  E('incline_bb_press', 'Incline Barbell Press', 'Barbell + incline bench (~30°)', 'upper', 'h_push',
    ['chest', 'front_delts'], ['triceps'],
    ['Bench ~30°.', 'Bar to upper chest, elbows slightly tucked.', 'Press up; use safeties or a spotter.'], { equip: 'barbell' }),
  E('leaning_db_lateral', 'Leaning Single-Arm DB Lateral', 'Dumbbell + rack support', 'upper', 'lat_raise',
    ['side_delts'], ['traps'],
    ['Hold a rack and lean away.', 'Raise the free DB to shoulder height.', 'Slow lower; no shrug.'], { perHand: true, isolation: true, equip: 'db' }),
  E('bb_deadlift_blocks', 'Barbell Deadlift from Blocks', 'Barbell + blocks/pins (above floor)', 'lower', 'hinge',
    ['glutes', 'hamstrings', 'quads'], ['lower_back', 'traps', 'forearms'],
    ['Bar starts on blocks/pins around mid-shin.', 'Hips down, chest up, brace.', 'Push floor away; stand tall; control down to blocks.'],
    { equip: 'barbell', tag: 'Likely default — many LA Fitness locations have no trap bar' }),
  E('db_reverse_lunge', 'DB Reverse Lunge', 'Dumbbells', 'lower', 'lunge',
    ['quads', 'glutes'], ['adductors', 'hamstrings'],
    ['Step back into a long lunge.', 'Front knee tracks over mid-foot.', 'Drive through front foot; alternate or finish one side.'], { perHand: true, equip: 'db' }),
  E('single_leg_db_hip_thrust', 'Single-Leg DB Hip Thrust', 'Dumbbell + bench', 'lower', 'glute',
    ['glutes'], ['hamstrings'],
    ['Upper back on bench; one foot planted.', 'DB on working hip.', 'Drive hips up; squeeze; switch legs. Start light.'], { perHand: true, equip: 'db' }),
  // ---- Extras
  E('cable_triceps_pushdown', 'Cable Triceps Pushdown', 'Cable + rope/bar', 'upper', 'arms',
    ['triceps'], [], ['Elbows pinned at sides.', 'Push down to full lockout.', 'Control up.'], { isolation: true , equip: 'cable' }),
  E('cable_curl', 'Cable Curl', 'Cable + bar', 'upper', 'arms',
    ['biceps'], ['forearms'], ['Elbows at sides.', 'Curl up, squeeze.', 'Slow down.'], { isolation: true , equip: 'cable' }),
  E('face_pull', 'Cable Face Pull', 'Cable + rope', 'upper', 'h_pull',
    ['rear_delts'], ['upper_back', 'traps'], ['Rope at face height.', 'Pull to forehead, elbows high.', 'Squeeze rear delts.'], { isolation: true , equip: 'cable' }),
  E('calf_raise', 'Standing Calf Raise', 'Calf raise machine / Smith', 'lower', 'calf',
    ['calves'], [], ['Full stretch at bottom.', 'Rise high, pause.', 'Slow lowering.'], { isolation: true , equip: 'machine' }),
];

export const EX_BY_ID = Object.fromEntries(EXERCISES.map(e => [e.id, e]));

export function exercise(id) {
  return EX_BY_ID[id] || { id, name: id, equipment: '', region: 'upper', pattern: 'other', primary: [], secondary: [], cues: [] };
}

export function demoUrl(ex) {
  const q = `${ex.name} proper form tutorial`;
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
}

// Coach Dre's ranked swap lists (exactly 3, in order) for each primary lift.
export const DRE_SWAPS = {
  bench_press: ['db_bench_press', 'smith_bench_press', 'machine_chest_press'],
  chest_supported_row: ['chest_supported_tbar_row', 'seated_cable_row', 'machine_row'],
  seated_db_shoulder_press: ['machine_shoulder_press', 'smith_shoulder_press', 'landmine_press'],
  box_squat: ['smith_box_squat', 'hack_squat', 'goblet_box_squat'],
  romanian_deadlift: ['db_romanian_deadlift', 'smith_rdl', 'back_extension_45'],
  leg_press: ['hack_squat', 'smith_squat', 'belt_squat'],
  lat_pulldown: ['machine_pulldown', 'assisted_pullup', 'single_arm_cable_pulldown'],
  incline_db_press: ['incline_smith_press', 'incline_machine_press', 'incline_bb_press'],
  cable_lateral_raise: ['db_lateral_raise', 'machine_lateral_raise', 'leaning_db_lateral'],
  trap_bar_deadlift: ['bb_deadlift_blocks', 'db_deadlift', 'smith_deadlift'],
  split_squat: ['smith_split_squat', 'db_reverse_lunge', 'bulgarian_split_squat'],
  hip_thrust: ['smith_hip_thrust', 'glute_drive_machine', 'single_leg_db_hip_thrust'],
};

/** Dre's ranked swaps for a primary lift (exactly 3). Empty if not a primary. */
export function alternatives(id) {
  const ids = DRE_SWAPS[id] || [];
  return ids.map(exercise);
}
