// Built-in cut foods + diary math. Works fully offline.

export const MEALS = [
  ['breakfast', 'Breakfast'],
  ['lunch', 'Lunch'],
  ['dinner', 'Dinner'],
  ['snacks', 'Snacks'],
];

/** Per-serving macros for common cut foods (cooked / as typically logged). */
export const BUILTIN_FOODS = [
  { id: 'chicken-breast', name: 'Chicken breast', servingLabel: '6 oz cooked', servingGrams: 170, kcal: 190, protein: 50, fat: 4, carbs: 0 },
  { id: 'eggs', name: 'Eggs (3 large)', servingLabel: '3 large', servingGrams: 150, kcal: 210, protein: 18, fat: 15, carbs: 1 },
  { id: 'egg-whites', name: 'Egg whites', servingLabel: '1 cup', servingGrams: 243, kcal: 125, protein: 26, fat: 0, carbs: 2 },
  { id: 'greek-yogurt', name: 'Greek yogurt, nonfat', servingLabel: '1 cup', servingGrams: 170, kcal: 100, protein: 18, fat: 0, carbs: 6 },
  { id: 'cottage-cheese', name: 'Cottage cheese, 1%', servingLabel: '1 cup', servingGrams: 226, kcal: 160, protein: 28, fat: 2, carbs: 6 },
  { id: 'lean-beef', name: 'Lean ground beef (93/7)', servingLabel: '4 oz cooked', servingGrams: 113, kcal: 170, protein: 24, fat: 8, carbs: 0 },
  { id: 'lean-turkey', name: 'Lean ground turkey (99%)', servingLabel: '4 oz cooked', servingGrams: 113, kcal: 150, protein: 28, fat: 3, carbs: 0 },
  { id: 'salmon', name: 'Salmon', servingLabel: '6 oz cooked', servingGrams: 170, kcal: 280, protein: 39, fat: 14, carbs: 0 },
  { id: 'tuna', name: 'Tuna, canned in water', servingLabel: '1 can', servingGrams: 142, kcal: 150, protein: 32, fat: 1, carbs: 0 },
  { id: 'white-fish', name: 'White fish (tilapia)', servingLabel: '6 oz cooked', servingGrams: 170, kcal: 160, protein: 35, fat: 2, carbs: 0 },
  { id: 'protein-shake', name: 'Protein shake', servingLabel: '1 shake', servingGrams: 80, kcal: 220, protein: 50, fat: 2, carbs: 3 },
  { id: 'oats', name: 'Oats, dry', servingLabel: '½ cup', servingGrams: 40, kcal: 150, protein: 5, fat: 3, carbs: 27 },
  { id: 'rice', name: 'White rice, cooked', servingLabel: '1 cup', servingGrams: 158, kcal: 205, protein: 4, fat: 0, carbs: 45 },
  { id: 'potato', name: 'Potato, baked', servingLabel: '1 medium', servingGrams: 173, kcal: 160, protein: 4, fat: 0, carbs: 37 },
  { id: 'broccoli', name: 'Broccoli, cooked', servingLabel: '1 cup', servingGrams: 156, kcal: 55, protein: 4, fat: 0, carbs: 11 },
  { id: 'banana', name: 'Banana', servingLabel: '1 medium', servingGrams: 118, kcal: 105, protein: 1, fat: 0, carbs: 27 },
  { id: 'apple', name: 'Apple', servingLabel: '1 medium', servingGrams: 182, kcal: 95, protein: 0, fat: 0, carbs: 25 },
  { id: 'bread', name: 'Whole-wheat bread', servingLabel: '1 slice', servingGrams: 32, kcal: 80, protein: 4, fat: 1, carbs: 14 },
  { id: 'milk', name: 'Skim milk', servingLabel: '1 cup', servingGrams: 245, kcal: 80, protein: 8, fat: 0, carbs: 12 },
  { id: 'pb', name: 'Peanut butter', servingLabel: '1 tbsp', servingGrams: 16, kcal: 90, protein: 4, fat: 8, carbs: 3 },
];

export const BUILTIN_BY_ID = Object.fromEntries(BUILTIN_FOODS.map(f => [f.id, f]));

const r1 = n => Math.round((+n || 0) * 10) / 10;
const r0 = n => Math.round(+n || 0);

export function scaleFood(food, { qty = null, grams = null } = {}) {
  const baseG = +food.servingGrams || 100;
  const g = grams != null && grams !== '' ? +grams : (qty != null ? +qty * baseG : baseG);
  const factor = baseG ? g / baseG : 0;
  const q = qty != null && qty !== '' ? +qty : (baseG ? g / baseG : 1);
  return {
    name: food.name,
    foodId: food.id || food.foodId || '',
    source: food.source || 'builtin',
    barcode: food.barcode || '',
    servingLabel: food.servingLabel || (baseG + ' g'),
    servingGrams: baseG,
    grams: r1(g),
    qty: r1(q),
    kcal: r0(food.kcal * factor),
    protein: r1(food.protein * factor),
    fat: r1(food.fat * factor),
    carbs: r1(food.carbs * factor),
  };
}

export function searchBuiltin(q) {
  const s = String(q || '').trim().toLowerCase();
  if (!s) return BUILTIN_FOODS.slice();
  return BUILTIN_FOODS.filter(f => f.name.toLowerCase().includes(s) || (f.servingLabel || '').toLowerCase().includes(s));
}

export function mealTotals(log, meal) {
  return totals((log || []).filter(e => e.meal === meal));
}

export function totals(log) {
  const out = { kcal: 0, protein: 0, fat: 0, carbs: 0, n: 0 };
  for (const e of log || []) {
    out.kcal += +e.kcal || 0;
    out.protein += +e.protein || 0;
    out.fat += +e.fat || 0;
    out.carbs += +e.carbs || 0;
    out.n++;
  }
  out.kcal = r0(out.kcal);
  out.protein = r1(out.protein);
  out.fat = r1(out.fat);
  out.carbs = r1(out.carbs);
  return out;
}

export function remaining(tot, targets) {
  return {
    kcal: r0((targets.kcal || 0) - (tot.kcal || 0)),
    protein: r1((targets.protein || 0) - (tot.protein || 0)),
    fat: r1((targets.fat || 0) - (tot.fat || 0)),
    carbs: r1((targets.carbs || 0) - (tot.carbs || 0)),
  };
}

/**
 * One source of truth: foodLog macros + standalone proteinLog entries
 * that are not already represented by a food entry with the same id.
 * Protein-shake supplement check-off should create ONE food entry (same id).
 */
export function syncedTotals(day) {
  const log = day?.foodLog || [];
  const foodIds = new Set(log.map(e => e.id));
  const extra = (day?.proteinLog || []).filter(e => e && e.id && !foodIds.has(e.id));
  const tot = totals(log);
  for (const e of extra) {
    const g = +e.g || 0;
    tot.protein = r1(tot.protein + g);
    tot.kcal += r0(g * 4); // protein-only leftover from older logs
    tot.n++;
  }
  return tot;
}

/** Apply synced totals onto the day record (protein + kcal + fat + carbs). */
export function applySyncedTotals(day) {
  const tot = syncedTotals(day);
  day.protein = tot.protein;
  day.kcal = tot.kcal;
  day.fat = tot.fat;
  day.carbs = tot.carbs;
  return tot;
}

export function proteinEntriesFromFood(day) {
  // Keep proteinLog as a parallel view of food protein + any extras (same ids, no doubles).
  const fromFood = (day.foodLog || []).filter(e => +e.protein > 0).map(e => ({
    id: e.id, ts: e.ts, g: r1(e.protein), label: e.name || 'Food', fromFood: true,
  }));
  const ids = new Set(fromFood.map(e => e.id));
  const extra = (day.proteinLog || []).filter(e => e && !ids.has(e.id) && !e.fromFood);
  return [...fromFood, ...extra];
}

export function rememberRecent(list, food, { max = 16 } = {}) {
  const key = foodKey(food);
  const next = (list || []).filter(f => foodKey(f) !== key);
  const qty = +food.qty || ((food.grams && food.servingGrams) ? food.grams / food.servingGrams : 1) || 1;
  const item = {
    id: food.foodId || food.id || key,
    foodId: food.foodId || food.id || '',
    name: food.name,
    source: food.source || 'builtin',
    barcode: food.barcode || '',
    servingLabel: food.servingLabel,
    servingGrams: food.servingGrams || 100,
    kcal: r0((+food.kcal || 0) / qty),
    protein: r1((+food.protein || 0) / qty),
    fat: r1((+food.fat || 0) / qty),
    carbs: r1((+food.carbs || 0) / qty),
  };
  next.unshift(item);
  return next.slice(0, max);
}

export function foodKey(f) {
  return String(f.foodId || f.id || f.barcode || f.name || '').toLowerCase();
}

export function isFavorite(favs, food) {
  const k = foodKey(food);
  return (favs || []).some(f => foodKey(f) === k);
}

export function toggleFavorite(favs, food) {
  const k = foodKey(food);
  const list = favs || [];
  if (list.some(f => foodKey(f) === k)) return list.filter(f => foodKey(f) !== k);
  const per = scaleFood(food, { grams: food.servingGrams || 100 });
  return [{ ...per, id: food.foodId || food.id || k, foodId: food.foodId || food.id || '', source: food.source || 'builtin', barcode: food.barcode || '' }, ...list].slice(0, 40);
}
