import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EXERCISES, VIDEOS, DRE_SWAPS, demoUrl, watchUrl, embedUrl, exercise } from '../src/exercises.js';
import { PROGRAM } from '../src/program.js';

const used = [...new Set([
  ...PROGRAM.workouts.flatMap(w => w.exercises.map(x => x.ex)),
  ...Object.values(DRE_SWAPS).flat(),
])];

test('every exercise has a verified video id or a YouTube search fallback', () => {
  for (const ex of EXERCISES) {
    if (ex.video) {
      assert.match(ex.video.id, /^[\w-]{11}$/, `${ex.id} video id`);
      assert.ok(ex.video.title && ex.video.channel, `${ex.id} needs title+channel`);
      assert.equal(VIDEOS[ex.id]?.id, ex.video.id);
      assert.ok(embedUrl(ex).includes(ex.video.id) && embedUrl(ex).includes('youtube-nocookie.com'));
      assert.equal(watchUrl(ex), `https://www.youtube.com/watch?v=${ex.video.id}`);
    } else {
      assert.match(demoUrl(ex), /youtube\.com\/results\?search_query=/);
      assert.equal(watchUrl(ex), demoUrl(ex));
      assert.equal(embedUrl(ex), null);
    }
  }
});

test('used program + Brooke swap lifts: count verified vs search fallback', () => {
  const verified = used.filter(id => exercise(id).video?.id);
  const fallback = used.filter(id => !exercise(id).video?.id);
  assert.ok(verified.length >= 40, `expected most used lifts to have videos, got ${verified.length}/${used.length}`);
  // known fallbacks: smith variants without a verified exact-match demo, plus single-arm pulldown
  for (const id of fallback) {
    assert.match(demoUrl(exercise(id)), /youtube\.com\/results/);
  }
  console.log(`  used lifts: ${verified.length} verified videos, ${fallback.length} search fallback (${fallback.join(', ') || 'none'})`);
});
