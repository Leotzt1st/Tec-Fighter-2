import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { CHARACTERS } from '../js/characters.js';
import { SPRITE_OVERRIDES, ENDING_DURATION, animationFrame, poseFor } from '../js/animations.js';

const base = new URL('../', import.meta.url);
test('all eight characters preload dedicated six-frame victory and defeat artwork', async () => {
  const paths = new Set(), contents = new Set();
  for (const character of CHARACTERS) {
    const ending = SPRITE_OVERRIDES[character.id];
    assert.ok(ending);
    assert.equal(ending.ko.src, ending.defeat.src);
    for (const state of ['victory', 'defeat']) {
      const spec = ending[state];
      assert.equal(spec.frames, 6);
      assert.equal(spec.loop, false);
      const svg = await readFile(new URL(spec.src, base), 'utf8');
      assert.match(svg, /width="2700" height="550"/);
      assert.equal((svg.match(/viewBox="0 0 450 550"/g) || []).length, 6);
      assert.match(svg, /shape-rendering="crispEdges"/);
      assert.equal(/<image\b/.test(svg), false, 'own artwork, not original artwork embedded');
      paths.add(spec.src); contents.add(svg);
      assert.notEqual(animationFrame({ state, stateTime: 0 }, { ...spec, override: true }), animationFrame({ state, stateTime: 1.8 }, { ...spec, override: true }));
    }
  }
  assert.equal(paths.size, 16);
  assert.equal(contents.size, 16);
});

test('KO, defeat and victory reach their final cells once, hold and avoid duplicate runtime transforms', () => {
  for (const character of CHARACTERS) for (const state of ['victory', 'defeat', 'ko']) {
    const sheet = { ...SPRITE_OVERRIDES[character.id][state], override: true };
    const fighter = { char: character, state, stateTime: ENDING_DURATION };
    assert.equal(animationFrame(fighter, sheet), 5);
    fighter.stateTime = 1000;
    assert.equal(animationFrame(fighter, sheet), 5);
    assert.deepEqual(poseFor(fighter, 4), { x: 0, y: 0, sx: 1, sy: 1, rotation: 0, alpha: 1 });
    assert.ok(ENDING_DURATION > sheet.frames / sheet.fps);
  }
});
