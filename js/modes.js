import { CHARACTERS, getCharacter } from './characters.js'

const RANKS = [
  ['bronze', 'BRONZE', 0, 5], ['silver', 'PRATA', 5, 10], ['gold', 'OURO', 10, 20],
  ['diamond', 'DIAMANTE', 20, 30], ['legend', 'LENDA TEC-FIGHTERS', 30, null]
].map(([id, name, threshold, nextThreshold]) => Object.freeze({ id, name, threshold, nextThreshold, badge: `./assets/badges/${id}.svg` }))
export function getRank(wins = 0) {
  const count = Math.max(0, Math.floor(Number(wins) || 0))
  return RANKS.find(rank => rank.nextThreshold === null || count < rank.nextThreshold)
}
export const RANK_LIST = Object.freeze(RANKS)
const levels = { easy: 0, normal: .5, hard: 1 }
let attempts = 0
const shuffle = (values, random) => {
  const result = [...values]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.max(0, Math.min(i, Math.floor(random() * (i + 1))))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

/** Campaign state is independent from the combat model: no health/stat cheats. */
export class ModeSession {
  constructor({ mode = 'versus', character = 'leo', opponent = 'caio', difficulty = 'normal', random = Math.random } = {}) {
    this.id = `attempt-${Date.now()}-${++attempts}`
    this.mode = ['versus', 'single', 'arcade', 'infinite'].includes(mode) ? mode : 'versus'
    this.character = getCharacter(character).id
    this.baseDifficulty = typeof difficulty === 'number' && Number.isFinite(difficulty) ? Math.max(0, Math.min(1, difficulty)) : levels[difficulty] ?? .5
    this.difficultyLabel = typeof difficulty === 'string' && Object.hasOwn(levels, difficulty) ? difficulty : 'normal'
    this.random = random
    this.pool = CHARACTERS.filter(c => c.id !== this.character).map(c => c.id)
    this.queue = shuffle(this.pool, random)
    this.wins = 0; this.battle = 1; this.total = this.mode === 'arcade' ? this.pool.length : 0
    this.score = 0; this.elapsed = 0; this.battleElapsed = 0; this.maxCombo = 0
    this.complete = false; this.over = false; this.promotion = null; this.carry = null
    this.battleDone = false; this.lastResult = null
    this.ids = [this.character, this.mode === 'versus' ? getCharacter(opponent).id : this.queue.shift()]
  }
  get difficulty() {
    if (!['arcade', 'infinite'].includes(this.mode)) return this.baseDifficulty
    const step = this.mode === 'arcade' ? .5 / Math.max(1, this.total - 1) : .035
    return Math.min(1, this.baseDifficulty + this.wins * step)
  }
  tick(dt) {
    if (!this.over && !this.battleDone && Number.isFinite(dt) && dt > 0) {
      this.elapsed += dt; this.battleElapsed += dt
    }
  }
  recordEvent(event, combat) {
    if (this.battleDone || this.over || event?.type !== 'hit' || event.player !== 0) return
    const combo = Math.max(1, Math.floor(event.combo || combat?.fighters?.[0]?.combo?.count || 1))
    this.maxCombo = Math.max(this.maxCombo, combo)
    const damage = Math.max(0, Number(event.damage) || 0)
    this.score += Math.round(damage * 10) + (combo > 1 ? combo * 20 : 0) + (event.strength === 'special' ? 250 : 0)
  }
  finish(combat) {
    if (this.battleDone) return this.lastResult
    this.battleDone = true
    const won = combat.winner === 0
    const fighter = combat.fighters[0]
    const previousRank = getRank(this.wins)
    if (won) {
      this.wins++
      this.score += 1000 + Math.round(Math.max(0, combat.timeLeft || 0) * 10)
        + Math.round(Math.max(0, fighter.health) / fighter.maxHealth * 300)
      if (this.mode === 'infinite') this.carry = { health: fighter.health, energy: fighter.energy }
    }
    const rank = getRank(this.wins)
    this.promotion = this.mode === 'infinite' && rank.id !== previousRank.id ? rank : null
    if (this.mode === 'arcade') {
      this.complete = won && this.wins === this.total
      this.over = !won || this.complete
    } else if (this.mode === 'infinite') this.over = !won
    else { this.over = true; this.complete = won }
    this.lastResult = { continue: !this.over, promotion: this.promotion }
    return this.lastResult
  }
  next() {
    if (this.over || !this.battleDone) return false
    if (!this.queue.length) this.queue = shuffle(this.pool, this.random)
    const opponent = this.queue.shift()
    if (!opponent) return false
    this.ids = [this.character, opponent]
    this.battle++; this.battleDone = false; this.battleElapsed = 0
    this.promotion = null; this.lastResult = null
    return true
  }
  summary() {
    const rank = getRank(this.wins)
    const nextRank = RANKS.find(item => item.threshold === rank.nextThreshold) || null
    return {
      id: this.id, mode: this.mode, character: this.character, opponent: this.ids[1],
      wins: this.wins, battle: this.battle, total: this.total, score: Math.round(this.score),
      elapsed: this.elapsed, maxCombo: this.maxCombo, rank, nextRank,
      remaining: this.mode === 'arcade' ? Math.max(0, this.total - this.wins) : null,
      untilNext: rank.nextThreshold === null ? 0 : Math.max(0, rank.nextThreshold - this.wins),
      complete: this.complete, over: this.over, difficulty: this.difficulty,
      promotion: this.promotion, carry: this.carry ? { ...this.carry } : null
    }
  }
}
