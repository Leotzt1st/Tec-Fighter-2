import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { CHARACTERS } from '../js/characters.js';
import { ANIMATIONS, poseFor, animationFrame } from '../js/animations.js';

const root = new URL('../', import.meta.url);
async function pngDimensions(path) {
  const bytes = await readFile(new URL(path, root));
  assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10], `${path} must be a PNG`);
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

test('all eight original characters have loadable portraits and consistent spritesheet cells', async () => {
  assert.deepEqual(CHARACTERS.map(c => c.id).sort(), ['caio', 'dantas', 'eduardo', 'gui', 'leo', 'rodolfo', 'thales', 'vini']);
  await Promise.all(CHARACTERS.map(async character => {
    await access(new URL(character.portrait, root));
    for (const [suffix, frames] of [['Parado', 1], ['Andando', 4], ['Atacando', character.id === 'dantas' ? 4 : 3]]) {
      const path = `img/sprites/${character.sprite}${suffix}.png`;
      const size = await pngDimensions(path);
      assert.equal(size.width, 450 * frames, `${path}: each horizontal cell must be 450px`);
      assert.equal(size.height, 550, `${path}: feet alignment requires 550px height`);
    }
  }));
  // The original background has a .png suffix but JPEG contents; browsers decode it correctly.
  await access(new URL('img/fundo_rua.png', root));
});

test('all combat states produce finite procedural poses and valid animation frames', () => {
  const states = ['idle', 'walk', 'jump', 'fall', 'land', 'light', 'heavy', 'special', 'guard', 'hurt', 'dodge', 'ko', 'victory', 'defeat'];
  for (const char of CHARACTERS) for (const state of states) {
    assert.ok(ANIMATIONS[state], `missing animation ${state}`);
    for (const stateTime of [0, .05, .2, .5, 3]) {
      const fighter = { char, state, stateTime };
      const pose = poseFor(fighter, stateTime);
      for (const value of Object.values(pose)) assert.ok(Number.isFinite(value), `${char.id}/${state} has invalid pose`);
      for (const frames of [1, 3, 4]) {
        const frame = animationFrame(fighter, { frames });
        assert.ok(Number.isInteger(frame) && frame >= 0 && frame < frames, `${char.id}/${state} invalid frame ${frame}/${frames}`);
      }
    }
  }
});

