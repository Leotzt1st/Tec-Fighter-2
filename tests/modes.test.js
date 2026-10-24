import test from 'node:test'
import assert from 'node:assert/strict'
import { ModeSession, getRank } from '../js/modes.js'
import { CHARACTERS } from '../js/characters.js'

const battle = (winner = 0, health = 63.4, energy = 47.8) => ({ winner, timeLeft: 37, fighters: [{ health, energy, maxHealth: 100, combo: { count: 3 } }] })

test('Single selects an automatic opponent excluding the chosen character and ends after the match', () => {
  const single = new ModeSession({ mode: 'single', character: 'caio', random: () => .3 })
  assert.equal(single.ids[0], 'caio'); assert.notEqual(single.ids[1], 'caio')
  const result = single.finish(battle())
  assert.equal(result.continue, false); assert.equal(single.complete, true)
  assert.equal(single.next(), false)
  const versus = new ModeSession({ mode: 'versus', character: 'caio', opponent: 'caio' })
  assert.deepEqual(versus.ids, ['caio', 'caio'])
})

test('Arcade includes all other characters once, computes total automatically and completes', () => {
  for (const character of CHARACTERS) {
    const session = new ModeSession({ mode: 'arcade', character: character.id, difficulty: 'easy', random: () => .2 })
    const opponents = [], levels = []
    for (let fight = 0; fight < CHARACTERS.length - 1; fight++) {
      opponents.push(session.ids[1]); levels.push(session.difficulty)
      assert.equal(session.battle, fight + 1)
      assert.equal(session.carry, null, 'arcade relies on fresh full-health combat')
      const result = session.finish(battle())
      if (fight < CHARACTERS.length - 2) { assert.equal(result.continue, true); assert.equal(session.next(), true) }
      else assert.equal(result.continue, false)
    }
    assert.equal(new Set(opponents).size, CHARACTERS.length - 1)
    assert.ok(!opponents.includes(character.id)); assert.equal(session.total, CHARACTERS.length - 1)
    assert.equal(session.complete, true); assert.equal(session.summary().remaining, 0)
    assert.ok(levels.every((value, index) => !index || value >= levels[index - 1]))
    assert.ok(levels.at(-1) > levels[0])
  }
})

test('Campaign ends on loss and cannot accidentally advance or score the same result twice', () => {
  const session = new ModeSession({ mode: 'arcade', character: 'leo' })
  session.tick(5); session.recordEvent({ type: 'hit', player: 0, damage: 7, combo: 3, strength: 'special' })
  assert.equal(session.maxCombo, 3); assert.ok(session.score > 0)
  session.finish(battle(1, 0, 10)); const score = session.score
  session.finish(battle()); session.tick(7)
  assert.equal(session.score, score); assert.equal(session.elapsed, 5)
  assert.equal(session.wins, 0); assert.equal(session.over, true); assert.equal(session.next(), false)
})

test('Infinite preserves exact life and meter, cycles the full opponent bag and caps progression', () => {
  const session = new ModeSession({ mode: 'infinite', character: 'leo', difficulty: 'easy', random: () => .2 })
  const groups = [[], []]
  for (let i = 0; i < 14; i++) {
    groups[Math.floor(i / 7)].push(session.ids[1])
    const health = 94.3 - i * 4.1, energy = (i * 13.7) % 100
    session.finish(battle(0, health, energy))
    assert.deepEqual(session.carry, { health, energy })
    assert.equal(session.complete, false); assert.equal(session.over, false)
    const before = { ...session.carry }; assert.equal(session.next(), true)
    assert.deepEqual(session.carry, before, 'advancing never heals or changes meter')
  }
  for (const group of groups) { assert.equal(new Set(group).size, 7); assert.ok(!group.includes('leo')) }
  for (let i = 0; i < 100; i++) { session.finish(battle()); session.next() }
  assert.equal(session.difficulty, 1)
  session.finish(battle(1, 0, 93)); assert.equal(session.over, true); assert.equal(session.next(), false)
})

test('Ranks follow consecutive wins only and promotions occur exactly at each threshold', () => {
  const expected = [[0, 'bronze'], [4, 'bronze'], [5, 'silver'], [9, 'silver'], [10, 'gold'], [19, 'gold'], [20, 'diamond'], [29, 'diamond'], [30, 'legend'], [500, 'legend']]
  for (const [wins, id] of expected) assert.equal(getRank(wins).id, id)
  const session = new ModeSession({ mode: 'infinite' })
  session.score = 9999999
  assert.equal(session.summary().rank.id, 'bronze')
  const promotions = []
  for (let i = 1; i <= 31; i++) {
    const result = session.finish(battle())
    if (result.promotion) promotions.push([i, result.promotion.id])
    session.next()
  }
  assert.deepEqual(promotions, [[5, 'silver'], [10, 'gold'], [20, 'diamond'], [30, 'legend']])
  assert.equal(session.summary().untilNext, 0); assert.equal(session.summary().nextRank, null)
  const fresh = new ModeSession({ mode: 'infinite' })
  assert.equal(fresh.wins, 0); assert.equal(fresh.summary().rank.id, 'bronze')
})

test('Score includes damage combos specials time and remaining health, ignoring enemy hits', () => {
  const session = new ModeSession({ mode: 'infinite' })
  session.tick(12.5); session.recordEvent({ type: 'hit', player: 1, damage: 99, combo: 5 })
  assert.equal(session.score, 0)
  session.recordEvent({ type: 'hit', player: 0, damage: 7, combo: 1, strength: 'light' })
  session.recordEvent({ type: 'hit', player: 0, damage: 25, combo: 3, strength: 'special' })
  assert.equal(session.score, 70 + 250 + 60 + 250)
  session.finish(battle(0, 50, 20))
  assert.equal(session.score, 630 + 1000 + 370 + 150)
  assert.equal(session.summary().elapsed, 12.5); assert.equal(session.maxCombo, 3)
})
