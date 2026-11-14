import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BUILTIN_FOODS, BUILTIN_BY_ID, scaleFood, totals, remaining, syncedTotals, applySyncedTotals, proteinEntriesFromFood, searchBuiltin, rememberRecent, toggleFavorite, isFavorite } from '../src/foods.js';
import { searchFoods, lookupBarcode, normalizeOff, normalizeUsda } from '../src/food-api.js';
import { buildCheckIn } from '../src/checkin.js';
import * as store from '../src/store.js';

const shake = BUILTIN_BY_ID['protein-shake'];
const chicken = BUILTIN_BY_ID['chicken-breast'];
const T = { kcal: 1800, protein: 210, fat: 55, carbs: 125 };

test('built-in cut foods cover the staples with per-serving macros', () => {
  const ids = BUILTIN_FOODS.map(f => f.id);
  for (const id of ['chicken-breast', 'eggs', 'egg-whites', 'rice', 'oats', 'greek-yogurt', 'lean-beef', 'lean-turkey', 'salmon', 'tuna', 'potato', 'protein-shake']) {
    assert.ok(ids.includes(id), id);
  }
  assert.equal(shake.protein, 50);
  assert.equal(shake.kcal, 220);
  assert.ok(chicken.protein >= 40);
});

test('scaleFood by grams and servings', () => {
  const half = scaleFood(chicken, { qty: 0.5 });
  assert.equal(half.kcal, 95);
  assert.equal(half.protein, 25);
  assert.equal(half.qty, 0.5);
  assert.equal(half.grams, 85);
  const g = scaleFood(chicken, { grams: 170 });
  assert.equal(g.kcal, 190);
  assert.equal(g.qty, 1);
});

test('meal totals and remaining vs Brooke targets', () => {
  const log = [
    { meal: 'breakfast', ...scaleFood(BUILTIN_BY_ID.eggs, { qty: 1 }), kcal: 210, protein: 18, fat: 15, carbs: 1 },
    { meal: 'lunch', ...scaleFood(chicken, { qty: 1 }) },
  ];
  const tot = totals(log);
  assert.equal(tot.kcal, 210 + 190);
  assert.equal(tot.protein, 68);
  const rem = remaining(tot, T);
  assert.equal(rem.kcal, 1800 - 400);
  assert.equal(rem.protein, 142);
});

test('syncedTotals merges food + leftover protein once (same id is not double-counted)', () => {
  const id = 'shake-1';
  const food = { id, name: 'Protein shake', kcal: 220, protein: 50, fat: 2, carbs: 3 };
  const day = {
    foodLog: [food],
    proteinLog: [{ id, g: 50, label: 'Protein shake' }, { id: 'extra', g: 20, label: 'leftover' }],
  };
  const tot = syncedTotals(day);
  assert.equal(tot.protein, 70); // 50 + 20, not 50+50+20
  assert.equal(tot.kcal, 220 + 80); // leftover 20 g × 4 kcal
  applySyncedTotals(day);
  assert.equal(day.protein, 70);
  assert.equal(day.kcal, 300);
});

test('protein shake check-off is one food entry, not two', () => {
  const id = 'supp-entry';
  const day = {
    foodLog: [{ id, name: 'Protein shake', kcal: 198, protein: 45, fat: 1.8, carbs: 2.7, fromSupp: 'protein-shake' }],
    proteinLog: [{ id, g: 45, label: 'Protein shake' }],
  };
  const tot = syncedTotals(day);
  assert.equal(tot.protein, 45);
  assert.equal(tot.n, 1);
  const view = proteinEntriesFromFood(day);
  assert.equal(view.length, 1);
  assert.equal(view[0].g, 45);
  assert.equal(view[0].fromFood, true);
});

test('searchBuiltin is offline and filters by name', () => {
  const all = searchBuiltin('');
  assert.equal(all.length, BUILTIN_FOODS.length);
  const hits = searchBuiltin('chicken');
  assert.ok(hits.some(f => f.id === 'chicken-breast'));
  assert.ok(hits.every(f => /chicken/i.test(f.name)));
});

test('rememberRecent and favorites store per-serving templates', () => {
  const logged = scaleFood(chicken, { qty: 2 });
  const rec = rememberRecent([], { ...logged, foodId: chicken.id, id: 'log-1' });
  assert.equal(rec[0].id, 'chicken-breast');
  assert.equal(rec[0].kcal, 190);
  let fav = toggleFavorite([], rec[0]);
  assert.equal(isFavorite(fav, chicken), true);
  fav = toggleFavorite(fav, chicken);
  assert.equal(isFavorite(fav, chicken), false);
});

test('searchFoods offline returns builtin + needsSignal; network failures fall back', async () => {
  const off = await searchFoods('rice', { online: false });
  assert.equal(off.needsSignal, true);
  assert.ok(off.results.some(f => f.id === 'rice'));
  assert.equal(off.remote.length, 0);

  const orig = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('offline'); };
  try {
    const r = await searchFoods('oats', { online: true });
    assert.ok(r.results.some(f => f.id === 'oats'));
    assert.equal(r.remote.length, 0);
    assert.equal(r.needsSignal, false);
  } finally { globalThis.fetch = orig; }
});

test('searchFoods merges OFF then USDA, deduped by name', async () => {
  const orig = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.includes('openfoodfacts')) {
      return { ok: true, json: async () => ({ products: [{ code: '111', product_name: 'Oats Off Brand', nutriments: { 'energy-kcal_100g': 380, proteins_100g: 13, fat_100g: 7, carbohydrates_100g: 67 }, serving_size: '40 g' }] }) };
    }
    if (u.includes('api.nal.usda.gov')) {
      return { ok: true, json: async () => ({ foods: [{ fdcId: 99, description: 'Oats, dry', foodNutrients: [
        { nutrientName: 'Energy', nutrientId: 1008, value: 389 },
        { nutrientName: 'Protein', nutrientId: 1003, value: 16.9 },
        { nutrientName: 'Total lipid (fat)', nutrientId: 1004, value: 6.9 },
        { nutrientName: 'Carbohydrate, by difference', nutrientId: 1005, value: 66.3 },
      ] }] }) };
    }
    throw new Error('unexpected ' + u);
  };
  try {
    const r = await searchFoods('oats', { online: true });
    assert.ok(r.results.some(f => f.id === 'oats'), 'builtin first');
    assert.ok(r.results.some(f => f.source === 'off' && /Oats Off/i.test(f.name)));
    // USDA "Oats, dry" vs builtin "Oats, dry" — different exact name, should appear
    assert.ok(r.remote.length >= 2);
  } finally { globalThis.fetch = orig; }
});

test('normalizeOff scales per-100g nutriments to the serving', () => {
  const f = normalizeOff({
    code: '123',
    product_name: 'Test Yogurt',
    serving_size: '170 g',
    nutriments: { 'energy-kcal_100g': 59, proteins_100g: 10, fat_100g: 0, carbohydrates_100g: 3.6 },
  });
  assert.equal(f.servingGrams, 170);
  assert.equal(f.qty, 1);
  assert.equal(f.kcal, 100);
  assert.equal(f.protein, 17);
  assert.equal(f.source, 'off');
});

test('normalizeUsda reads nutrient ids and defaults to 100 g', () => {
  const f = normalizeUsda({
    fdcId: 1,
    description: 'Chicken, breast, cooked',
    foodNutrients: [
      { nutrientId: 1008, value: 165 },
      { nutrientId: 1003, value: 31 },
      { nutrientId: 1004, value: 3.6 },
      { nutrientId: 1005, value: 0 },
    ],
  });
  assert.equal(f.kcal, 165);
  assert.equal(f.protein, 31);
  assert.equal(f.servingGrams, 100);
  assert.equal(f.source, 'usda');
});

test('lookupBarcode uses OFF product API and soft-fails on miss', async () => {
  const orig = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ status: 0 }) });
  try {
    await assert.rejects(() => lookupBarcode('000'), /No product found/);
  } finally { globalThis.fetch = orig; }
});

test('USDA DEMO_KEY 403 is ignored and search still returns builtin', async () => {
  const orig = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.includes('openfoodfacts')) throw new Error('off down');
    if (u.includes('usda')) return { ok: false, status: 403, json: async () => ({}) };
    throw new Error(u);
  };
  try {
    const r = await searchFoods('tuna', { online: true });
    assert.ok(r.results.some(f => f.id === 'tuna'));
  } finally { globalThis.fetch = orig; }
});

test('buildCheckIn includes food-day averages', () => {
  store.resetAll();
  const s = store.state;
  s.daily['2026-11-02'] = {
    protein: 200, kcal: 1700, fat: 50, carbs: 120, foodLog: [{ id: 'a', kcal: 1700, protein: 200, fat: 50, carbs: 120 }],
    proteinLog: [], waterOz: 90, sleep: 7, steps: 0, dizzy: false, dizzyNote: '', cls: false, supps: {},
  };
  s.daily['2026-11-03'] = {
    protein: 220, kcal: 1800, fat: 55, carbs: 125, foodLog: [{ id: 'b', kcal: 1800, protein: 220, fat: 55, carbs: 125 }],
    proteinLog: [], waterOz: 90, sleep: 7, steps: 7000, dizzy: false, dizzyNote: '', cls: false, supps: {},
  };
  const c = buildCheckIn(new Date(2026, 10, 9));
  assert.match(c.text, /Food days logged: 2\/7/);
  assert.match(c.text, /Protein avg: 210 g/);
  assert.match(c.text, /Kcal avg: 1750/);
  assert.match(c.text, /Fat avg: 53 g/);
  assert.match(c.text, /Carbs avg: 123 g/);
});

test('migrate adds favorites / savedMeals / recentFoods and foodLog', () => {
  store.resetAll();
  assert.ok(Array.isArray(store.state.favorites));
  assert.ok(Array.isArray(store.state.savedMeals));
  assert.ok(Array.isArray(store.state.recentFoods));
  const d = store.day('2026-11-01');
  assert.ok(Array.isArray(d.foodLog));
});
