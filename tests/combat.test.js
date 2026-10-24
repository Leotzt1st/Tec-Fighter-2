import test from 'node:test'
import assert from 'node:assert/strict'
import { Combat } from '../js/combat.js'
import { CHARACTERS } from '../js/characters.js'
import { GROUND } from '../js/player.js'
import { attackBox } from '../js/collision.js'

const DT = 1 / 60
function ready(ids = ['leo', 'caio']) {
  const events = []
  const game = new Combat(ids, e => events.push(e))
  game.phase = 'fight'
  game.fighters[0].x = 500
  game.fighters[1].x = 620
  return { game, events, a: game.fighters[0], b: game.fighters[1] }
}
function step(game, seconds, inputs = [{}, {}]) {
  for (let frame = 0; frame < Math.ceil(seconds / DT); frame++) game.update(DT, inputs)
}
function press(game, player, command) {
  const inputs = [{}, {}]
  inputs[player][command] = true
  game.update(DT, inputs)
}

test('eight original identities and exclusive specials remain available', () => {
  assert.equal(CHARACTERS.length, 8)
  assert.equal(new Set(CHARACTERS.map(c => c.special.kind)).size, 8)
  for (const c of CHARACTERS) {
    assert.ok(c.stats.health >= 96 && c.stats.health <= 106)
    assert.ok(c.portrait.endsWith('.png'))
  }
})

test('light attacks hit only once, only during active frames, and recover', () => {
  const { game, a, b, events } = ready()
  const initial = b.health
  press(game, 0, 'light')
  assert.equal(b.health, initial)
  assert.equal(attackBox(a), null)
  step(game, .15)
  assert.ok(b.health < initial)
  const after = b.health
  step(game, .5)
  assert.equal(b.health, after)
  assert.equal(events.filter(e => e.type === 'hit').length, 1)
  assert.equal(a.move, null)
  assert.equal(a.state, 'idle')
})

test('player two damage is resolved in the opposite direction', () => {
  const { game, a } = ready()
  press(game, 1, 'light')
  step(game, .2)
  assert.ok(a.health < a.maxHealth)
})

test('no hit out of range or when bodies are vertically separated', () => {
  const { game, a, b } = ready()
  b.x = 1100
  press(game, 0, 'heavy')
  step(game, .8)
  assert.equal(b.health, b.maxHealth)
  b.x = 620
  b.y = 150
  b.vy = -300
  press(game, 0, 'light')
  step(game, .2)
  assert.equal(b.health, b.maxHealth)
  assert.ok(a.energy === 0)
})

test('meter is earned separately and special cannot execute without a full bar', () => {
  const { game, a, b } = ready()
  press(game, 0, 'special')
  assert.equal(a.move, null)
  assert.equal(a.energy, 0)
  press(game, 0, 'light')
  step(game, .2)
  assert.ok(a.energy > 0)
  assert.ok(b.energy > 0)
  const meterB = b.energy
  a.energy = 100
  a.move = null
  a.stun = 0
  press(game, 0, 'special')
  // A hitstop command is buffered, then consumed when simulation resumes.
  step(game, .12)
  assert.equal(a.energy, 0)
  assert.equal(a.move.type, 'special')
  assert.ok(b.energy >= meterB)
})

test('all eight specials execute, have active hitboxes and recover', () => {
  for (const character of CHARACTERS) {
    const { game, a, events } = ready([character.id, 'caio'])
    a.energy = 100
    press(game, 0, 'special')
    assert.equal(a.energy, 0, character.id)
    assert.equal(a.move.kind, character.special.kind)
    step(game, 1.6)
    assert.equal(a.move, null, character.id)
    assert.ok(events.some(e => e.type === 'special' && e.kind === character.special.kind))
    assert.ok(events.some(e => e.type === 'hit'), `${character.id} should reach the nearby target`)
  }
})

test('held guard blocks, a fresh guard parries and enables a counter', () => {
  const { game, a, b, events } = ready()
  // Hold before the strike to leave the parry window.
  step(game, .2, [{}, { guard: true }])
  game.update(DT, [{ light: true }, { guard: true }])
  step(game, .2, [{}, { guard: true }])
  assert.equal(b.health, b.maxHealth)
  assert.ok(events.some(e => e.type === 'block'))
  step(game, .6)
  a.x = 500; b.x = 620
  press(game, 0, 'light')
  step(game, .12, [{}, { guard: true }])
  assert.ok(events.some(e => e.type === 'parry'))
  assert.ok(b.counterReady > 0)
  assert.ok(a.stun > 0)
})

test('dodge invulnerability is temporary and cooldown prevents spamming', () => {
  const { game, a } = ready()
  press(game, 0, 'dodge')
  assert.equal(a.state, 'dodge')
  assert.ok(a.invulnerable > 0)
  const cooldown = a.dodgeCooldown
  step(game, .4)
  assert.equal(a.invulnerable, 0)
  press(game, 0, 'dodge')
  assert.notEqual(a.state, 'dodge')
  assert.ok(a.dodgeCooldown < cooldown)
})

test('light can cancel into a heavy buffered during hitstop', () => {
  const { game, a, b } = ready()
  press(game, 0, 'light')
  step(game, .1)
  assert.ok(game.hitstop > 0)
  press(game, 0, 'heavy')
  assert.equal(a.buffer.type, 'heavy')
  step(game, .08)
  assert.equal(a.move.type, 'heavy')
  // Keep opponent within range so the second strike is a true combo.
  b.x = 620
  step(game, .25)
  assert.equal(a.combo.count, 2)
  assert.ok(a.combo.damage < 21)
})

test('six-hit stun cap forces an escape and clears eventually', () => {
  const { game, a, b, events } = ready()
  for (let hit = 0; hit < 6; hit++) {
    a.move = null
    game.startMove(a, 'light')
    a.move.elapsed = .09
    game.resolveHit({ attacker: a, defender: b, move: a.move, slot: 0 })
  }
  assert.equal(a.combo.count, 6)
  assert.ok(b.invulnerable >= .6)
  assert.ok(b.stun <= .12)
  assert.ok(events.some(e => e.type === 'escape'))
  assert.ok(a.combo.damage < 6 * 7)
  step(game, 1.5)
  assert.equal(a.combo.count, 0)
  assert.equal(b.invulnerable, 0)
})

test('ground, walls, body separation and facing stay valid', () => {
  const { game, a, b } = ready()
  a.x = 40; b.x = 104
  step(game, 1, [{ left: true }, { left: true }])
  assert.ok(a.x >= 40 && b.x >= 40)
  assert.ok(Math.abs(a.x - b.x) >= 63.9)
  a.x = 1240; b.x = 1176
  step(game, 1, [{ right: true }, { right: true }])
  assert.ok(a.x <= 1240 && b.x <= 1240)
  assert.equal(a.facing, -1)
  assert.equal(b.facing, 1)
  press(game, 0, 'jump')
  assert.ok(a.vy < 0)
  step(game, 2)
  assert.equal(a.y, GROUND)
  assert.equal(a.vy, 0)
})

test('timer and rounds stop on KO, best of three ends and rematch is clean', () => {
  const { game, a, b } = ready()
  game.wins[0] = 1
  b.health = 1
  press(game, 0, 'light')
  step(game, .2)
  assert.equal(game.phase, 'roundOver')
  assert.equal(game.wins[0], 2)
  assert.equal(b.health, 0)
  const remaining = game.timeLeft
  step(game, 2.4)
  assert.equal(game.phase, 'matchOver')
  assert.equal(game.timeLeft, remaining)
  assert.equal(game.winner, 0)
  assert.equal(a.state, 'victory')
  assert.equal(b.state, 'defeat')
  const fresh = new Combat(['leo', 'caio'])
  assert.deepEqual(fresh.wins, [0, 0])
  assert.equal(fresh.timeLeft, 60)
  assert.equal(fresh.fighters[0].energy, 0)
  assert.equal(fresh.fighters[1].health, fresh.fighters[1].maxHealth)
})

test('timeout compares remaining health percentage and draws replay the round', () => {
  const { game } = ready(['rodolfo', 'vini'])
  game.timeLeft = .001
  game.update(DT)
  assert.equal(game.roundWinner, null)
  assert.deepEqual(game.wins, [0, 0])
  step(game, 2.3)
  assert.equal(game.round, 1)
  assert.equal(game.phase, 'intro')
  assert.equal(game.timeLeft, 60)
})

test('fixed tick simulation is independent of render frequency', () => {
  const run = renderHz => {
    const { game } = ready()
    game.fighters[1].x = 1200
    let accumulator = 0
    for (let frame = 0; frame < renderHz; frame++) {
      accumulator += 1 / renderHz
      while (accumulator + 1e-10 >= DT) { game.update(DT, [{ right: true }, {}]); accumulator -= DT }
    }
    return game.fighters[0].x
  }
  assert.ok(Math.abs(run(30) - run(60)) < .001)
  assert.ok(Math.abs(run(60) - run(144)) < .001)
})

test('natural repeated press edges produce five-hit chains across close and mid ranges', () => {
  for (const gap of [64, 90, 120]) {
    const { game, a, b, events } = ready()
    b.x = a.x + gap
    for (let tick = 0; tick < 90; tick++) {
      game.update(DT, [[0, 12, 24, 36, 48].includes(tick) ? { light: true } : {}, {}])
    }
    assert.deepEqual(events.filter(e => e.type === 'hit').map(e => e.combo), [1, 2, 3, 4, 5], `gap ${gap}`)
  }
})

test('light-light-heavy-special is a real four-hit aerial finisher for every character', () => {
  for (const character of CHARACTERS) {
    const { game, a, b, events } = ready([character.id, 'caio'])
    b.x = a.x + 90
    a.energy = 100
    const commands = { 0: 'light', 12: 'light', 24: 'heavy', 44: 'special' }
    for (let tick = 0; tick < 140; tick++) {
      const command = commands[tick]
      game.update(DT, [command ? { [command]: true } : {}, {}])
    }
    assert.deepEqual(events.filter(e => e.type === 'hit').slice(0, 4).map(e => e.strength), ['light', 'light', 'heavy', 'special'], character.id)
    assert.ok(events.some(e => e.type === 'hit' && e.combo >= 4), character.id)
    assert.equal(a.energy, 0)
    assert.equal(a.move, null)
  }
})
