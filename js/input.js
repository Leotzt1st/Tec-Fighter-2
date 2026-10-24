const ACTIONS = ['left', 'right', 'jump', 'light', 'heavy', 'special', 'guard', 'dodge']
const HELD = new Set(['left', 'right', 'guard'])
const empty = () => Object.fromEntries(ACTIONS.map(action => [action, false]))
const editable = target => target?.matches?.('input, select, textarea, [contenteditable="true"]')

export class Input {
  constructor(settings, { onPause = () => {}, onFullscreen = () => {}, onBlur = () => {} } = {}) {
    this.settings = settings
    this.down = new Set()
    this.pressed = new Set()
    this.previousPads = [empty(), empty()]
    this._enabled = false
    this.onPause = onPause
    this.padPauseHeld = new Map()
    this.handlers = {
      keydown: event => {
        if (editable(event.target)) return
        if (event.code === 'F10' && !event.repeat) { event.preventDefault(); onFullscreen(); return }
        if (['Escape', 'KeyP'].includes(event.code) && !event.repeat) { onPause(); this.clear(); return }
        if (!this.enabled) return
        if (this.settings.values.bindings.some(bindings => Object.values(bindings).includes(event.code))) event.preventDefault()
        if (!this.down.has(event.code)) this.pressed.add(event.code)
        this.down.add(event.code)
      },
      keyup: event => { this.down.delete(event.code) },
      blur: () => { this.clear(); onBlur() },
      visibilitychange: () => { if (document.hidden) { this.clear(); onBlur() } }
    }
    for (const name of ['keydown', 'keyup', 'blur']) window.addEventListener(name, this.handlers[name])
    document.addEventListener('visibilitychange', this.handlers.visibilitychange)
    this.unsubscribe = settings.subscribe(() => this.clear())
  }
  get enabled() { return this._enabled }
  set enabled(value) { if (this._enabled !== !!value) this.clear(); this._enabled = !!value }
  clear() { this.down.clear(); this.pressed.clear(); this.previousPads = [empty(), empty()] }
  // Call from the application frame even while paused so Start can also resume.
  pollGamepads() {
    let pads = []
    try { pads = Array.from(navigator.getGamepads?.() || []).filter(pad => pad?.connected).slice(0, 2) } catch { /* Gamepad API may be disabled. */ }
    const connected = new Set()
    let pauseEdge = false
    pads.forEach((pad, index) => {
      const id = pad.index ?? index
      connected.add(id)
      const held = !!pad.buttons[9]?.pressed
      if (held && !this.padPauseHeld.get(id)) pauseEdge = true
      this.padPauseHeld.set(id, held)
    })
    for (const id of this.padPauseHeld.keys()) if (!connected.has(id)) this.padPauseHeld.delete(id)
    if (pauseEdge) { this.clear(); this.onPause() }
    return pads
  }
  sample() {
    const pads = this.pollGamepads()
    if (!this.enabled) return [empty(), empty()]
    const samples = this.settings.values.bindings.map((bindings, index) => {
      const sample = empty()
      for (const action of ACTIONS) sample[action] = (HELD.has(action) ? this.down : this.pressed).has(bindings[action])
      const pad = pads[index]
      const button = number => !!pad?.buttons[number]?.pressed
      const padSample = {
        left: button(14) || (pad?.axes[0] || 0) < -0.4,
        right: button(15) || (pad?.axes[0] || 0) > 0.4,
        jump: button(0) || button(12), light: button(2), heavy: button(3),
        special: button(1), guard: button(4) || button(6), dodge: button(5) || button(7)
      }
      for (const action of ACTIONS) sample[action] ||= padSample[action] && (HELD.has(action) || !this.previousPads[index][action])
      this.previousPads[index] = padSample
      return sample
    })
    this.pressed.clear()
    return samples
  }
  destroy() {
    for (const name of ['keydown', 'keyup', 'blur']) window.removeEventListener(name, this.handlers[name])
    document.removeEventListener('visibilitychange', this.handlers.visibilitychange)
    this.unsubscribe()
    this.clear()
  }
}
