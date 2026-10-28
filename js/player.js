export const GROUND = 590
export const WORLD_WIDTH = 1280

export class Player {
  constructor(character, index) {
    this.char = character
    this.id = character.id
    this.index = index
    this.maxHealth = character.stats.health
    this.reset(index === 0 ? 390 : 890)
  }

  reset(x) {
    this.x = x
    this.y = GROUND
    this.vx = 0
    this.vy = 0
    this.facing = this.index === 0 ? 1 : -1
    this.health = this.maxHealth
    this.energy = 0
    this.state = 'idle'
    this.stateTime = 0
    this.move = null
    this.combo = { count: 0, damage: 0, timer: 0 }
    this.receivedHits = 0
    this.receivedTimer = 0
    this.stun = 0
    this.invulnerable = 0
    this.dodgeCooldown = 0
    this.guardAge = 1
    this.guarding = false
    this.buffer = null
    this.landing = 0
    this.counterReady = 0
    this.hitFlash = 0
  }

  get grounded() { return this.y >= GROUND - .5 }
  get body() { return { x: this.x - 32, y: this.y - 180, width: 64, height: 180 } }

  setState(state) {
    if (this.state !== state) { this.state = state; this.stateTime = 0 }
  }
}
