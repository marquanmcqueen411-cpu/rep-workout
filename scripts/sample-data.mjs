// Sample data used by e2e + QA (runs inside the page via page.evaluate). Cleared after tests.
export function seedSample() {
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
  const bw = [
    ['2026-10-24', 254.8], ['2026-10-26', 254.2], ['2026-10-27', 253.9], ['2026-10-28', 254.0],
    ['2026-10-30', 253.6], ['2026-10-31', 253.2], ['2026-11-01', 253.1], ['2026-11-02', 253.0],
    ['2026-11-03', 252.6], ['2026-11-04', 252.4], ['2026-11-05', 252.8], ['2026-11-06', 252.1],
    ['2026-11-07', 251.8],
  ];
  for (const [date, lb] of bw) s.bodyweight.push({ date, lb });
  s.daily[ymd(iso(1, 12))] = { protein: 205, kcal: 1780, waterOz: 96, sleep: 7, steps: 7400, dizzy: false, dizzyNote: '', cls: true };
  // past 6 days of protein + supplements
  const pv = [212, 168, 190, 225, 150, 205];
  pv.forEach((g, i) => { const k = ymd(iso(i + 1, 12)); const d = s.daily[k] || (s.daily[k] = { protein: 0, kcal: 0, waterOz: 0, sleep: null, steps: 0, dizzy: null, dizzyNote: '', cls: false });
    d.protein = g; d.proteinLog = [{ id: 'p' + i, ts: iso(i + 1, 13).toISOString(), g, label: 'seed' }];
    d.supps = {}; s.supplements.forEach((x, j) => { if (i < 3 || j < 2) d.supps[x.id] = iso(i + 1, 8).toISOString(); }); });
  localStorage.setItem('rep-workout.v1', JSON.stringify(s));
}
