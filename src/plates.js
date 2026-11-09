// Plate calculator for LA Fitness-style bars and plates.
// Default bar 45 lb (Olympic / trap bar). Plates per side: 45 / 35 / 25 / 10 / 5 / 2.5.

export const LA_PLATES = [45, 35, 25, 10, 5, 2.5];

/** Split total loaded weight into bar + per-side plates. */
export function plateBreakdown(totalLb, barLb = 45, plates = LA_PLATES) {
  const bar = Math.max(0, +barLb || 0);
  const total = Math.max(0, +totalLb || 0);
  if (total < bar) {
    return { bar, total, perSide: 0, plates: [], remainder: +(total - bar).toFixed(2), exact: total === 0 };
  }
  let rem = +(total - bar).toFixed(2);
  const perSideLoad = rem / 2;
  const out = [];
  let left = perSideLoad;
  for (const p of plates) {
    const n = Math.floor((left + 1e-9) / p);
    if (n > 0) { out.push({ weight: p, count: n }); left = +(left - n * p).toFixed(4); }
  }
  const remTotal = +(left * 2).toFixed(2);
  return {
    bar,
    total,
    perSide: +perSideLoad.toFixed(2),
    plates: out,
    remainder: remTotal,
    exact: Math.abs(remTotal) < 0.05,
  };
}

/** Human-readable "each side: 45 + 10 + 2.5" (or "bar only"). */
export function formatPlates(bd) {
  if (!bd || bd.total <= 0) return '';
  if (bd.total <= bd.bar) return `Bar only (${bd.bar} lb)`;
  if (!bd.plates.length) return `${bd.perSide} lb/side (no matching plates)`;
  const parts = bd.plates.flatMap(p => Array(p.count).fill(String(p.weight)));
  let s = `Each side: ${parts.join(' + ')}`;
  if (!bd.exact && Math.abs(bd.remainder) >= 0.05) s += ` · ~${Math.abs(bd.remainder).toFixed(1)} lb short`;
  return s;
}

/** True for barbell / trap-bar style lifts where a plate math card is useful. */
export function wantsPlates(ex) {
  if (!ex) return false;
  if (ex.perHand) return false;
  const eq = ex.equip || '';
  if (eq === 'barbell') return true;
  const t = `${ex.name} ${ex.equipment}`.toLowerCase();
  return t.includes('barbell') || t.includes('trap') || t.includes('hex') || (t.includes('hip thrust') && !t.includes('machine') && !t.includes('smith'));
}

export function barFor(ex, settings = {}) {
  const t = `${ex?.name || ''} ${ex?.equipment || ''}`.toLowerCase();
  if (t.includes('trap') || t.includes('hex')) return +(settings.trapBarWeight ?? 45);
  return +(settings.barWeight ?? 45);
}
