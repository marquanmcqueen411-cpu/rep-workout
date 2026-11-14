// Open Food Facts (no key) + USDA FDC (free DEMO_KEY). Failures are soft.
import { searchBuiltin, scaleFood } from './foods.js';

export const USDA_DEMO_KEY = 'DEMO_KEY';
const OFF_SEARCH = 'https://world.openfoodfacts.org/cgi/search.pl';
const OFF_PRODUCT = 'https://world.openfoodfacts.org/api/v0/product/';
const USDA_SEARCH = 'https://api.nal.usda.gov/fdc/v1/foods/search';

const timeout = (ms, ctrl) => setTimeout(() => ctrl.abort(), ms);

function num(...vals) {
  for (const v of vals) { const n = parseFloat(v); if (Number.isFinite(n)) return n; }
  return null;
}

function parseServingGrams(s) {
  if (!s) return null;
  const m = String(s).replace(',', '.').match(/(\d+(?:\.\d+)?)\s*(kg|g|oz|ml|l)\b/i);
  if (!m) { const n = parseFloat(s); return Number.isFinite(n) && n > 0 && n <= 2000 ? n : null; }
  const n = parseFloat(m[1]); const u = m[2].toLowerCase();
  if (u === 'kg' || u === 'l') return n * 1000;
  if (u === 'oz') return n * 28.35;
  return n;
}

export function normalizeOff(p) {
  const n = p.nutriments || {};
  const kcal100 = num(n['energy-kcal_100g'], n.energy_kcal_100g, n['energy-kcal'], n.energy_100g != null ? n.energy_100g / 4.184 : null);
  const p100 = num(n.proteins_100g, n.protein_100g);
  const f100 = num(n.fat_100g);
  const c100 = num(n.carbohydrates_100g);
  if (kcal100 == null && p100 == null) return null;
  const servingG = parseServingGrams(p.serving_size) || 100;
  const food = {
    id: 'off-' + (p.code || p._id || p.id || Math.random().toString(36).slice(2, 8)),
    name: [p.product_name, p.brands].filter(Boolean).join(' · ') || 'Untitled food',
    brand: p.brands || '',
    source: 'off',
    barcode: String(p.code || ''),
    servingLabel: p.serving_size || (servingG + ' g'),
    servingGrams: 100,
    kcal: kcal100 ?? 0,
    protein: p100 ?? 0,
    fat: f100 ?? 0,
    carbs: c100 ?? 0,
  };
  // nutriments are per 100 g — scale to serving, then treat that as 1 serving
  const s = scaleFood(food, { grams: servingG });
  s.id = food.id;
  s.servingGrams = servingG;
  s.qty = 1;
  s.servingLabel = food.servingLabel;
  s.barcode = food.barcode;
  return s;
}

function usdaNutrient(food, names) {
  const list = food.foodNutrients || [];
  for (const n of list) {
    const nm = (n.nutrientName || n.nutrient?.name || '').toLowerCase();
    const id = n.nutrientId || n.nutrientNumber || n.nutrient?.id;
    if (names.includes(nm) || names.includes(String(id))) return num(n.value, n.amount);
  }
  return null;
}

export function normalizeUsda(f) {
  // Foundation/SR values are typically per 100 g
  const kcal = usdaNutrient(f, ['energy', 'energy (atwater general factors)', '1008', '208']);
  const protein = usdaNutrient(f, ['protein', '1003', '203']);
  const fat = usdaNutrient(f, ['total lipid (fat)', 'fat', '1004', '204']);
  const carbs = usdaNutrient(f, ['carbohydrate, by difference', 'carbohydrate', '1005', '205']);
  if (kcal == null && protein == null) return null;
  const servingG = 100;
  return {
    id: 'usda-' + f.fdcId,
    name: f.description || 'USDA food',
    brand: f.brandOwner || f.brandName || '',
    source: 'usda',
    barcode: '',
    servingLabel: '100 g',
    servingGrams: servingG,
    kcal: kcal ?? 0,
    protein: protein ?? 0,
    fat: fat ?? 0,
    carbs: carbs ?? 0,
  };
}

async function getJson(url, { ms = 8000, headers = {} } = {}) {
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const t = ctrl ? timeout(ms, ctrl) : null;
  try {
    const res = await fetch(url, { signal: ctrl?.signal, headers: { Accept: 'application/json', ...headers } });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
  } finally { if (t) clearTimeout(t); }
}

export async function searchOpenFoodFacts(q) {
  const url = `${OFF_SEARCH}?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=12`;
  const data = await getJson(url);
  const products = data.products || data.hits || [];
  return products.map(normalizeOff).filter(Boolean);
}

export async function lookupBarcode(code) {
  const barcode = String(code || '').replace(/\D/g, '');
  if (!barcode) throw new Error('Enter a barcode');
  const data = await getJson(`${OFF_PRODUCT}${barcode}.json`);
  if (!data || data.status !== 1 || !data.product) throw new Error('No product found for that barcode');
  const food = normalizeOff(data.product);
  if (!food) throw new Error('That product has no nutrition facts');
  food.barcode = barcode;
  return food;
}

export async function searchUsda(q, key = USDA_DEMO_KEY) {
  const url = `${USDA_SEARCH}?api_key=${encodeURIComponent(key)}&query=${encodeURIComponent(q)}&pageSize=8&dataType=Foundation,SR Legacy,Survey%20(FNDDS)`;
  const data = await getJson(url);
  return (data.foods || []).map(normalizeUsda).filter(Boolean);
}

/**
 * Search built-in first, then OFF, then USDA. Offline → builtin only + needsSignal.
 * USDA DEMO_KEY failures (rate limit / blocked) are ignored.
 */
export async function searchFoods(q, { online = typeof navigator === 'undefined' ? true : navigator.onLine } = {}) {
  const query = String(q || '').trim();
  const builtin = searchBuiltin(query);
  if (!query) return { ok: true, results: builtin, builtin, remote: [], needsSignal: false };
  if (online === false) return { ok: true, results: builtin, builtin, remote: [], needsSignal: true };
  const remote = [];
  try { remote.push(...await searchOpenFoodFacts(query)); } catch { /* soft */ }
  try { remote.push(...await searchUsda(query)); } catch { /* DEMO_KEY may 429/403 */ }
  const seen = new Set(builtin.map(f => f.name.toLowerCase()));
  const merged = [...builtin];
  for (const f of remote) {
    const k = f.name.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    merged.push(f);
  }
  return { ok: true, results: merged, builtin, remote, needsSignal: false };
}
