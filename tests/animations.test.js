import test from 'node:test';
import assert from 'node:assert/strict';
import { ANIMATIONS, poseFor, animationFrame } from '../js/animations.js';
import { CHARACTERS } from '../js/characters.js';
import { Camera } from '../js/camera.js';

test('every combat state has a finite foot-anchored procedural pose for every character', () => {
  for (const char of CHARACTERS) for (const state of Object.keys(ANIMATIONS)) for (const stateTime of [0, .1, .5, 3]) {
    const pose = poseFor({ char, state, stateTime }, 1);
    for (const value of Object.values(pose)) assert.ok(Number.isFinite(value), `${char.id} ${state}`);
    assert.ok(pose.sx > 0 && pose.sy > 0);
    assert.ok(pose.alpha >= 0 && pose.alpha <= 1);
  }
});

test('attack artwork follows anticipation, active contact and recovery without looping', () => {
  const fighter = { state: 'light', stateTime: 0, move: { elapsed: 0, startup: .075, active: .09 } };
  const sheet = { frames: 3 };
  assert.equal(animationFrame(fighter, sheet), 0);
  fighter.move.elapsed = .08;
  assert.equal(animationFrame(fighter, sheet), 2);
  fighter.move.elapsed = .2;
  assert.equal(animationFrame(fighter, sheet), 1);
});

test('replacement artwork uses its own frames and speed and walking loops', () => {
  assert.equal(animationFrame({ state: 'victory', stateTime: .3 }, { frames: 8, fps: 10, override: true }), 3);
  assert.equal(animationFrame({ state: 'victory', stateTime: 4 }, { frames: 8, fps: 10, override: true }), 7);
  assert.equal(animationFrame({ state: 'walk', stateTime: 1 }, { frames: 4 }), 3);
});

test('special camera does not zoom at stage edges and returns smoothly to normal', () => {
  const camera = new Camera(); camera.special(40); camera.update(.2);
  let scale;
  const c = { translate() {}, scale(x) { scale = x; } };
  camera.apply(c, { extraEffects: true, shake: false }, { fighters: [{ x: 40 }, { x: 1100 }] });
  assert.equal(scale, 1);
  camera.apply(c, { extraEffects: true, shake: false }, { fighters: [{ x: 390 }, { x: 890 }] });
  assert.ok(scale > 1 && scale <= 1.06);
  for (let i = 0; i < 100; i++) camera.update(1 / 60);
  assert.ok(Math.abs(camera.zoom - 1) < .0001);
});
