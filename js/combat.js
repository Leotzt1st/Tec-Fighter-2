import { getCharacter } from './characters.js'
import { Player, GROUND, WORLD_WIDTH } from './player.js'
import { overlaps, attackBox, separateBodies } from './collision.js'
import { normalMove, canCancel, comboScale, COMBO_WINDOW, INPUT_BUFFER, MAX_COMBO } from './combos.js'
import { specialMove } from './specials.js'

const clamp = (value, min, max) => Math.max(min, Math.min(max, value))
const empty = {}

export class Combat {
  constructor(ids = ['leo', 'caio'], onEvent = () => {}) {
    this.onEvent = onEvent
    this.fighters = ids.map((id, i) => new Player(getCharacter(id), i))
    this.round = 1
    this.wins = [0, 0]
    this.timeLeft = 60
    this.phase = 'intro'
    this.phaseTime = 0
    this.winner = null
    this.roundWinner = null
    this.hitstop = 0
    this.onEvent({ type: 'round', round: 1 })
  }

  emit(type, fighter, extras = {}) {
    this.onEvent({ type, player: fighter?.index, x: fighter?.x ?? 640, y: (fighter?.y ?? 590) - 100,
      color: fighter?.char.color || '#ffffff', ...extras })
  }

  update(dt, inputs = [empty, empty]) {
    if (!(dt > 0)) return
    dt = Math.min(dt, .05)
    this.phaseTime += dt
    if (this.phase === 'matchOver') {
      this.fighters.forEach(f => { f.stateTime += dt })
      return
    }
    if (this.phase === 'intro') {
      this.fighters.forEach(f => { f.stateTime += dt })
      if (this.phaseTime >= 1.8) { this.phase = 'fight'; this.phaseTime = 0 }
      return
    }
    if (this.phase === 'roundOver') {
      this.fighters.forEach(f => { f.stateTime += dt })
      if (this.phaseTime >= 2.2) {
        if (this.wins.some(score => score >= 2)) {
          this.phase = 'matchOver'
          this.phaseTime = 0
          this.winner = this.wins[0] >= 2 ? 0 : 1
          this.fighters.forEach((f, i) => f.setState(i === this.winner ? 'victory' : 'defeat'))
          this.emit('victory', this.fighters[this.winner])
        } else {
          if (this.roundWinner !== null) this.round++
          this.fighters.forEach((f, i) => f.reset(i === 0 ? 390 : 890))
          this.timeLeft = 60
          this.phase = 'intro'
          this.phaseTime = 0
          this.roundWinner = null
          this.hitstop = 0
          this.emit('round', null, { round: this.round })
        }
      }
      return
    }
    if (this.hitstop > 0) {
      // Hitstop pauses simulation, never the command buffer: keep fresh press edges.
      this.fighters.forEach((f, i) => {
        const input = inputs[i] || empty
        const type = input.special ? 'special' : input.heavy ? 'heavy' : input.light ? 'light' : null
        if (type) f.buffer = { type, ttl: INPUT_BUFFER }
      })
      this.hitstop = Math.max(0, this.hitstop - dt)
      return
    }
    this.timeLeft = Math.max(0, this.timeLeft - dt)
    this.fighters.forEach((f, i) => this.updateFighter(f, inputs[i] || empty, this.fighters[1 - i], dt))
    separateBodies(...this.fighters)
    // Resolve simultaneous attacks by priority; equal priorities can trade.
    const pending = this.fighters.map((f, i) => this.pendingHit(f, this.fighters[1 - i])).filter(Boolean)
    pending.sort((a, b) => b.move.priority - a.move.priority)
    const priority = pending[0]?.move.priority
    for (const hit of pending) {
      if (hit.move.priority < priority && hit.attacker.stun > 0) continue
      this.resolveHit(hit)
    }
    this.fighters.forEach(f => { f.health = clamp(f.health, 0, f.maxHealth); f.energy = clamp(f.energy, 0, 100) })
    if (this.fighters.some(f => f.health <= 0) || this.timeLeft <= 0) this.endRound()
  }

  updateFighter(f, input, opponent, dt) {
    f.stateTime += dt
    f.hitFlash = Math.max(0, f.hitFlash - dt)
    f.invulnerable = Math.max(0, f.invulnerable - dt)
    f.dodgeCooldown = Math.max(0, f.dodgeCooldown - dt)
    f.counterReady = Math.max(0, f.counterReady - dt)
    f.landing = Math.max(0, f.landing - dt)
    f.combo.timer = Math.max(0, f.combo.timer - dt)
    if (!f.combo.timer) { f.combo.count = 0; f.combo.damage = 0 }
    f.receivedTimer = Math.max(0, f.receivedTimer - dt)
    if (!f.receivedTimer) f.receivedHits = 0
    if (f.buffer) { f.buffer.ttl -= dt; if (f.buffer.ttl <= 0) f.buffer = null }
    const command = input.special ? 'special' : input.heavy ? 'heavy' : input.light ? 'light' : null
    if (command) f.buffer = { type: command, ttl: INPUT_BUFFER }
    if (!f.move && f.stun <= 0 && f.state !== 'dodge') f.facing = opponent.x >= f.x ? 1 : -1
    const wantsGuard = !!input.guard && f.grounded && !f.move && f.stun <= 0 && f.state !== 'dodge'
    f.guardAge = wantsGuard ? (f.guarding ? f.guardAge + dt : 0) : 1
    f.guarding = wantsGuard

    if (f.stun > 0) {
      f.stun = Math.max(0, f.stun - dt)
      f.setState('hurt')
      f.vx *= Math.pow(.035, dt)
    } else if (f.state === 'dodge' && f.stateTime < .36) {
      f.vx = f.facing * 490
    } else {
      if (f.state === 'dodge') f.setState('idle')
      if (input.dodge && f.grounded && !f.move && f.dodgeCooldown <= 0) {
        f.setState('dodge'); f.invulnerable = .25; f.dodgeCooldown = .95; f.guarding = false; f.vx = f.facing * 490
      } else {
        if (f.buffer && (!f.move || canCancel(f.move, f.buffer.type))) {
          if (this.startMove(f, f.buffer.type)) f.buffer = null
        }
        if (!f.move && input.jump && f.grounded && !f.guarding) f.vy = -740
        if (f.move) {
          f.move.elapsed += dt
          const active = f.move.elapsed >= f.move.startup && f.move.elapsed < f.move.startup + f.move.active
          // A short committed step keeps close-range chains connected without
          // allowing free movement or facing changes during an attack.
          f.vx = active ? f.facing * (f.move.type === 'special' ? f.char.special.speed : f.move.type === 'light' ? 100 : 90) : 0
          if (f.move.type === 'special' && active && f.move.kind === 'blink') f.invulnerable = Math.max(f.invulnerable, .035)
          if (f.move.elapsed >= f.move.duration) { f.move = null; f.setState('idle') }
        } else {
          f.vx = f.guarding ? 0 : ((input.right ? 1 : 0) - (input.left ? 1 : 0)) * f.char.stats.speed
          f.setState(f.guarding ? 'guard' : f.vx ? 'walk' : f.landing ? 'land' : 'idle')
        }
      }
    }
    f.x = clamp(f.x + f.vx * dt, 40, WORLD_WIDTH - 40)
    const wasAirborne = !f.grounded || f.vy < 0
    if (wasAirborne) {
      f.vy += 1900 * dt
      f.y += f.vy * dt
      if (f.y >= GROUND) { f.y = GROUND; f.vy = 0; f.landing = .12 }
    }
    if (!f.move && f.stun <= 0 && f.state !== 'dodge' && !f.grounded) f.setState(f.vy < 0 ? 'jump' : 'fall')
  }

  startMove(f, type) {
    if (type === 'special' && f.energy < 100) return false
    const move = type === 'special' ? specialMove(f.char) : normalMove(type, !f.grounded)
    if (type === 'special') {
      f.energy = 0
      if (move.kind === 'rise' && f.grounded) f.vy = -380
    }
    if (f.counterReady > 0) { move.damage *= 1.18; move.counter = true; f.counterReady = 0 }
    f.move = move
    f.guarding = false
    f.setState(type)
    f.stateTime = 0
    this.emit(type === 'special' ? 'special' : 'attack', f, { strength: type, kind: move.kind, name: f.char.special.name })
    return true
  }

  pendingHit(attacker, defender) {
    const move = attacker.move
    const box = attackBox(attacker)
    if (!box || defender.invulnerable > 0 || defender.health <= 0 || !overlaps(box, defender.body)) return null
    const slot = move.hits ? Math.min(move.hits - 1, Math.floor((move.elapsed - move.startup) / (move.active / move.hits))) : 0
    if (move.hitSlots.has(slot)) return null
    return { attacker, defender, move, slot }
  }

  resolveHit({ attacker, defender, move, slot }) {
    move.hitSlots.add(slot)
    move.connected = true
    const strength = move.type
    const guarding = defender.guarding && defender.facing === -attacker.facing && defender.grounded
    if (guarding && defender.guardAge <= .10) {
      attacker.stun = .26
      attacker.move = null
      attacker.setState('hurt')
      attacker.vx = -attacker.facing * 160
      defender.energy += 9
      defender.counterReady = .6
      this.emit('parry', defender, { strength, x: (attacker.x + defender.x) / 2 })
      this.hitstop = .055
      return
    }
    const scale = comboScale(attacker.combo.count)
    const rawDamage = move.damage * attacker.char.stats.damage * scale
    if (guarding) {
      // Chip damage cannot knock out a guarding player.
      const chip = strength === 'light' ? 0 : Math.min(Math.max(0, defender.health - 1), rawDamage * .12)
      defender.health -= chip
      defender.energy += 5
      attacker.energy += strength === 'special' ? 0 : 3
      defender.x = clamp(defender.x + attacker.facing * (strength === 'light' ? 7 : 15), 40, WORLD_WIDTH - 40)
      this.emit('block', defender, { strength, x: (attacker.x + defender.x) / 2 })
      this.hitstop = .025
      return
    }
    const damage = Math.round(rawDamage * 10) / 10
    defender.health = Math.max(0, defender.health - damage)
    defender.energy += strength === 'special' ? 12 : damage * 1.25
    attacker.energy += strength === 'special' ? 0 : 12 + Math.min(8, attacker.combo.count * 2)
    attacker.combo.count++
    attacker.combo.damage = Math.round((attacker.combo.damage + damage) * 10) / 10
    attacker.combo.timer = COMBO_WINDOW
    defender.receivedHits++
    defender.receivedTimer = COMBO_WINDOW
    defender.hitFlash = .11
    defender.move = null
    defender.buffer = null
    defender.guarding = false
    defender.stun = strength === 'light' ? .25 : strength === 'heavy' ? .34 : .39
    defender.setState('hurt')
    defender.stateTime = 0
    defender.vx = attacker.facing * (strength === 'light' ? 110 : strength === 'heavy' ? 240 : 340)
    if (strength === 'special' && move.lift) defender.vy = move.lift
    if (strength === 'heavy' && (move.airborne || attacker.combo.count >= 3)) defender.vy = -460
    if (defender.receivedHits >= MAX_COMBO) {
      defender.invulnerable = .65
      defender.stun = .12
      defender.vx = attacker.facing * 620
      defender.vy = -260
      defender.receivedHits = 0
      this.emit('escape', defender, { strength })
    }
    this.hitstop = strength === 'light' ? .035 : strength === 'heavy' ? .06 : .085
    this.emit('hit', attacker, { strength, damage, counter: !!move.counter, combo: attacker.combo.count,
      x: defender.x - attacker.facing * 24, y: defender.y - 105 })
  }

  endRound() {
    this.phase = 'roundOver'
    this.phaseTime = 0
    const [a, b] = this.fighters
    // Compare proportions because the roster has slightly different maximum health.
    const difference = a.health / a.maxHealth - b.health / b.maxHealth
    this.roundWinner = Math.abs(difference) < .00001 ? null : difference > 0 ? 0 : 1
    if (this.roundWinner !== null) this.wins[this.roundWinner]++
    this.fighters.forEach((f, i) => {
      f.move = null; f.vx = 0; f.vy = 0; f.y = GROUND; f.guarding = false; f.buffer = null
      f.setState(this.roundWinner === null ? 'idle' : i === this.roundWinner ? 'victory' : 'ko')
    })
    this.emit('ko', this.roundWinner === null ? null : this.fighters[this.roundWinner], { draw: this.roundWinner === null })
  }
}
