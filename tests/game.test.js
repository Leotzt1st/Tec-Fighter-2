import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../js/game.js';
import { Combat } from '../js/combat.js';
import { Records } from '../js/records.js';

globalThis.requestAnimationFrame = () => 1;
globalThis.cancelAnimationFrame = () => {};
function fixture(mode) {
  const ui = { screen: 'menu', setMode() {}, show(screen) { this.screen = screen; }, update() {}, result() { this.screen = 'result'; }, showIntermission() { this.screen = 'intermission'; }, setFPS() {} };
  const input = { clear() {}, pollGamepads() {}, sample: () => [{}, {}] };
  const renderer = { clear() {}, resize() {}, update() {}, render() {}, event() {}, camera: { celebrate() {} } };
  const game = new Game({ ui, input, renderer, audio: { setScene() {}, play() {} }, records: new Records(null) });
  game.start({ ids: ['leo', 'caio'], mode });
  return game;
}
function step(game, seconds) { for (let i = 0; i < Math.ceil(seconds * 60); i++) game.frame((game.previous || 1000) + 1000 / 60 + .0001); }
function win(game, health = 37, energy = 64) {
  game.ai = null;
  game.combat.phase = 'fight'; game.combat.fighters[0].health = health; game.combat.fighters[0].energy = energy;
  game.combat.fighters[1].health = 0;
  step(game, .05);
}

test('infinite single-round lifecycle preserves exact health/energy across actual match transitions', () => {
  const game = fixture('infinite');
  assert.equal(game.combat.roundsToWin, 1);
  win(game);
  assert.equal(game.combat.phase, 'roundOver');
  assert.equal(game.input.enabled, true); // model locks all actions while endings play
  const x = game.combat.fighters[1].x;
  step(game, 2.3);
  assert.notEqual(game.ui.screen, 'intermission');
  assert.equal(game.combat.fighters[1].x, x);
  step(game, .5);
  assert.equal(game.ui.screen, 'intermission');
  assert.equal(game.input.enabled, false);
  assert.equal(game.session.wins, 1);
  assert.equal(game.nextBattle(), true);
  assert.equal(game.combat.fighters[0].health, 37);
  assert.equal(game.combat.fighters[0].energy, 64);
  assert.equal(game.combat.fighters[1].health, game.combat.fighters[1].maxHealth);
});

test('arcade restores health/energy, rematch starts a new attempt, versus keeps best of three', () => {
  const game = fixture('arcade'); win(game); step(game, 2.8); game.nextBattle();
  assert.equal(game.combat.fighters[0].health, 100);
  assert.equal(game.combat.fighters[0].energy, 0);
  game.rematch(); assert.equal(game.session.wins, 0); assert.equal(game.mode, 'arcade');
  const versus = fixture('versus'); assert.equal(versus.ai, null); assert.equal(versus.combat.roundsToWin, 2);
});

test('infinite timeout draw replay preserves both fighters and never heals the player', () => {
  const combat = new Combat(['leo', 'caio'], () => {}, { roundsToWin: 1, preserveOnDraw: true });
  combat.phase = 'fight'; combat.fighters.forEach(f => { f.health = 27; f.energy = 61; }); combat.timeLeft = 0;
  combat.update(1 / 60);
  for (let i = 0; i < 160; i++) combat.update(1 / 60);
  assert.equal(combat.phase, 'intro');
  for (const f of combat.fighters) { assert.equal(f.health, 27); assert.equal(f.energy, 61); }
});

test('solo AI replaces P2 commands and pausing freezes campaign time', () => {
  const game = fixture('single'); game.combat.phase = 'fight';
  game.input.sample = () => [{}, { left: true, light: true }];
  game.ai.sample = () => ({});
  const x = game.combat.fighters[1].x; step(game, .5);
  assert.equal(game.combat.fighters[1].x, x); assert.equal(game.combat.fighters[1].move, null);
  game.pause(); const elapsed = game.session.elapsed; step(game, 1);
  assert.equal(game.session.elapsed, elapsed);
});

test('promotion must finish before advancement and losing attempts save only once', () => {
  const game = fixture('infinite'); game.session.wins = 4;
  win(game); step(game, 2.8);
  assert.equal(game.session.summary().rank.id, 'silver');
  assert.equal(game.nextBattle(), false, 'cannot skip the promotion');
  step(game, 1.8); assert.equal(game.nextBattle(), true);
  game.ai = null; game.combat.phase = 'fight'; game.combat.fighters[0].health = 0;
  step(game, 2.8);
  assert.equal(game.session.over, true); assert.equal(game.nextBattle(), false);
  assert.equal(game.records.get().history.length, 1);
  assert.equal(game.records.get().best.wins, 5);
  assert.ok(game.combat.fighters[0].stateTime >= 2.4, 'defeat holds completed fall frame');
  step(game, 3); assert.equal(game.records.get().history.length, 1);
});
