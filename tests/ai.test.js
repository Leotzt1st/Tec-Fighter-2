import test from 'node:test'
import assert from 'node:assert/strict'
import { AIController } from '../js/ai.js'
import { Combat } from '../js/combat.js'
const DT = 1 / 60
const seeded = (seed = 5) => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296)
function combat() { const c = new Combat(['leo', 'caio']); c.phase = 'fight'; return c }

test('Difficulties use delayed decisions with bounded progression and no combat mutations', () => {
  for (const [level, delay] of [['easy', .32], ['normal', .18], ['hard', .09], [7, .09]]) {
    const c = combat(), ai = new AIController(level, () => .5)
    assert.ok(Math.abs(ai.reaction - delay) < .0001)
    const snapshot = JSON.stringify(c)
    for (let frame = 0; frame < Math.floor(delay / DT) - 1; frame++) assert.equal(ai.sample(DT, c).left, false)
    const next = ai.sample(delay, c)
    assert.equal(next.left, true, 'approach player after reaction delay')
    assert.equal(JSON.stringify(c), snapshot, 'AI emits input without mutating positions, health, energy or stats')
  }
})

test('AI reads distance, defenses and meter to approach, retreat, block, dodge and counter', () => {
  const c = combat(), self = c.fighters[1], enemy = c.fighters[0]
  const ai = new AIController('hard', () => .5)
  let input = ai.sample(1, c); assert.equal(input.left, true)
  self.x = enemy.x + 100; enemy.move = { reach: 124, elapsed: .05, startup: .2, active: .12 }
  input = ai.sample(1, c); assert.equal(input.guard, true)
  const dodge = new AIController('hard', () => .83)
  input = dodge.sample(1, c); assert.equal(input.dodge, true)
  const retreat = new AIController('easy', () => .02)
  input = retreat.sample(1, c); assert.equal(input.right, true)
  enemy.move = null; self.energy = 100; self.counterReady = .5
  input = ai.sample(1, c); assert.equal(input.special, true)
  self.energy = 0
  input = ai.sample(1, c); assert.equal(input.special, false); assert.equal(input.heavy, true)
})

test('All three AI difficulties can fight and defeat a passive player through actual combat rules', () => {
  for (const level of ['easy', 'normal', 'hard']) {
    const c = combat(), ai = new AIController(level, seeded())
    const events = []; c.onEvent = e => events.push(e)
    for (let tick = 0; tick < 3600 && c.phase === 'fight'; tick++) c.update(DT, [{}, ai.sample(DT, c)])
    assert.equal(c.fighters[0].health, 0, level)
    assert.equal(c.fighters[1].health, c.fighters[1].maxHealth, 'no environmental stat changes')
    assert.ok(events.some(e => e.type === 'hit' && e.player === 1 && e.combo >= 2), `${level} combos`)
    assert.ok(events.some(e => e.type === 'special' && e.player === 1), `${level} special`)
  }
})

test('Attack commands are fresh edges and inactive phases release every command', () => {
  const c = combat(); c.fighters[1].x = c.fighters[0].x + 100
  const ai = new AIController('normal', () => .5)
  const pressed = ai.sample(.3, c)
  assert.ok(pressed.light || pressed.heavy)
  const next = ai.sample(DT, c)
  assert.equal(next.light, false); assert.equal(next.heavy, false)
  c.phase = 'matchOver'
  assert.ok(Object.values(ai.sample(.5, c)).every(value => value === false))
})
