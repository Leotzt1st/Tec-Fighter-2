const empty = () => ({ left: false, right: false, jump: false, light: false, heavy: false, special: false, guard: false, dodge: false })
const levels = { easy: 0, normal: .5, hard: 1 }

/** Decisions produce the exact same commands as a human; the combat model validates them. */
export class AIController {
  constructor(difficulty = 'normal', random = Math.random) {
    this.level = typeof difficulty === 'number' && Number.isFinite(difficulty) ? Math.max(0, Math.min(1, difficulty)) : levels[difficulty] ?? .5
    this.reaction = this.level <= .5 ? .32 - this.level * .28 : .27 - this.level * .18
    this.random = random
    this.cooldown = this.reaction
    this.held = empty()
  }
  sample(dt, combat, index = 1) {
    if (combat.phase !== 'fight') { this.held = empty(); this.cooldown = this.reaction; return empty() }
    const output = { ...this.held, light: false, heavy: false, special: false, jump: false, dodge: false }
    this.cooldown -= Math.max(0, dt)
    if (this.cooldown > 0) return output
    this.cooldown = Math.max(0, this.cooldown) + this.reaction * (.92 + this.random() * .16)
    const self = combat.fighters[index], other = combat.fighters[1 - index]
    if (!self || !other || self.health <= 0) return empty()
    const action = empty()
    const gap = Math.abs(self.x - other.x)
    const toward = other.x > self.x ? 'right' : 'left'
    const away = toward === 'right' ? 'left' : 'right'
    const reach = 120 * self.char.stats.reach
    const roll = this.random()
    // Occasional mistakes and delay remain even on hard; no frame-perfect input reading.
    const mistake = .24 - this.level * .19
    if (roll < mistake) {
      if (gap < 140 && roll < mistake * .5) action[away] = true
      return this.remember(action)
    }
    const threatening = other.move && gap < (other.move.reach || 130) * other.char.stats.reach + 65
      && other.move.elapsed < other.move.startup + other.move.active
    const canAct = self.stun <= 0 && self.state !== 'dodge'
    if (threatening && canAct && !self.move) {
      const defense = this.random()
      if (defense < .42 + this.level * .34) action.guard = true
      else if (self.dodgeCooldown <= 0 && defense < .70 + this.level * .20) action.dodge = true
      else action[away] = true
      return this.remember(action)
    }
    if (gap > reach - 8) {
      action[toward] = true
      if (gap > 220 && other.move && self.grounded && this.random() < .12 + this.level * .13) action.jump = true
    } else if (gap < 76 && !self.move && this.random() < .12) action[away] = true
    if (!canAct) return this.remember(action)
    const count = self.combo?.count || 0
    const connected = self.move?.connected
    const cancel = connected && self.move.type !== 'special'
    if (self.move && !cancel) return this.remember(action)
    if (self.energy >= 100 && gap < self.char.special.reach + 55
      && (count >= 2 || self.counterReady > 0 || this.random() < .24 + this.level * .4)) {
      action.special = true
    } else if (gap < reach + 24) {
      // Easy mostly uses standalone hits; normal/hard chains after a connection.
      if (cancel && this.level < .25 && this.random() < .8) return this.remember(action)
      const chainHeavy = count >= (this.level > .7 ? 3 : 2)
      action[chainHeavy || self.counterReady > 0 || this.random() < .18 + this.level * .14 ? 'heavy' : 'light'] = true
      if (!self.move && self.grounded && !other.grounded && this.random() < .2 + this.level * .25) action.jump = true
    }
    return this.remember(action)
  }
  remember(action) {
    this.held = { ...empty(), left: action.left, right: action.right, guard: action.guard }
    return action
  }
}
