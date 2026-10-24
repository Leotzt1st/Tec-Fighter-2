import { DEFAULT_PAD_BINDINGS } from './settings.js'

const ACTIONS = ['left', 'right', 'jump', 'light', 'heavy', 'special', 'guard', 'dodge']
const HELD = new Set(['left', 'right', 'guard'])
const empty = () => Object.fromEntries(ACTIONS.map(action => [action, false]))
const editable = target => target?.matches?.('input, select, textarea, [contenteditable="true"]')

export class Input {
  constructor(settings, { onPause = () => {}, onFullscreen = () => {}, onBlur = () => {}, onNavigate = () => {}, onDevices = () => {}, now = () => performance.now() } = {}) {
    this.settings = settings
    this.down = new Set()
    this.pressed = new Set()
    this._enabled = false
    this._menuEnabled = false
    this.onPause = onPause
    this.onBlur = onBlur
    this.onNavigate = onNavigate
    this.onDevices = onDevices
    this.now = now
    this.deviceSlots = new Map()
    this.padStates = new Map()
    this.padEdges = [new Set(), new Set()]
    this.devices = []
    this.deviceSignature = ''
    this.capture = null
    this.handlers = {
      keydown: event => {
        if (editable(event.target)) return
        if (event.code === 'F10' && !event.repeat) { event.preventDefault(); onFullscreen(); return }
        if (['Escape', 'KeyP'].includes(event.code) && !event.repeat) { onPause(); this.clear(); return }
        if (!this.enabled || this.capture) return
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
    this.unsubscribe = settings.subscribe(() => { this.clear(); this.publishDevices() })
  }
  get enabled() { return this._enabled }
  set enabled(value) { if (this._enabled !== !!value) this.clear(); this._enabled = !!value }
  get menuEnabled() { return this._menuEnabled }
  set menuEnabled(value) { if (this._menuEnabled !== !!value) this.clear(); this._menuEnabled = !!value }
  clear() {
    this.down.clear(); this.pressed.clear()
    this.padEdges.forEach(edges => edges.clear())
    // Raw button states intentionally survive pauses, scene changes and remaps.
    // A held confirm/pause cannot turn into a fresh gameplay action after transition.
  }
  capturePad(player, callback) {
    this.clear()
    if (![0, 1].includes(player) || typeof callback !== 'function') return false
    this.capture = { player, callback }
    return true
  }
  cancelPadCapture() { this.capture = null; this.clear() }
  publishDevices() {
    const devices = this.devices.map(device => ({ ...device, player: this.settings.values.padPlayers?.[device.slot] ?? device.slot }))
    const signature = JSON.stringify(devices)
    if (signature !== this.deviceSignature) { this.deviceSignature = signature; this.onDevices(devices) }
  }
  // Call every animation frame, including menus and pause. The same method is safe
  // to call again from sample(): input edges accumulate until sampled exactly once.
  pollGamepads() {
    let pads = []
    try { pads = Array.from(navigator.getGamepads?.() || []).filter(pad => pad?.connected).slice(0, 2) } catch { /* Browser may restrict Gamepad API. */ }
    const connected = new Set(pads.map((pad, i) => pad.index ?? i))
    let lostAssignedDevice = false
    for (const [id] of this.deviceSlots) if (!connected.has(id)) {
      this.deviceSlots.delete(id); this.padStates.delete(id); lostAssignedDevice = true
    }
    if (lostAssignedDevice) { this.clear(); if (this.enabled) this.onBlur() }
    this.devices = []
    const time = this.now()
    for (const [i, pad] of pads.entries()) {
      const id = pad.index ?? i
      if (!this.deviceSlots.has(id)) {
        const used = new Set(this.deviceSlots.values())
        this.deviceSlots.set(id, used.has(0) ? 1 : 0)
      }
      const slot = this.deviceSlots.get(id)
      const player = this.settings.values.padPlayers?.[slot] ?? slot
      const binding = this.settings.values.padBindings?.[player] || DEFAULT_PAD_BINDINGS[player]
      const buttons = pad.buttons.map(button => !!button?.pressed)
      const pressed = number => !!buttons[number]
      const axes = pad.axes || []
      const directions = {
        left: pressed(14) || (axes[0] || 0) < -.4,
        right: pressed(15) || (axes[0] || 0) > .4,
        up: pressed(12) || (axes[1] || 0) < -.4,
        down: pressed(13) || (axes[1] || 0) > .4
      }
      this.devices.push({ slot, index: id, id: String(pad.id || `Controle ${slot + 1}`), mapping: pad.mapping || 'personalizado', player })
      let previous = this.padStates.get(id)
      if (!previous) {
        // Connection may be discovered by the first button press. Latch it; don't
        // attack, leave a screen or spend a special merely by reconnecting.
        previous = { buttons: [...buttons], directions: { ...directions }, nextRepeat: {} }
        this.padStates.set(id, previous)
      }
      const fresh = number => pressed(number) && !previous.buttons[number]
      const captured = this.capture && this.capture.player === player
      if (captured) {
        const button = buttons.findIndex((held, index) => held && !previous.buttons[index])
        if (button >= 0) {
          const callback = this.capture.callback
          this.capture = null
          callback(button)
          this.clear()
        }
      } else if (!this.capture) {
        if (fresh(binding.pause)) { this.clear(); this.onPause() }
        if (this.menuEnabled) {
          for (const [direction, held] of Object.entries(directions)) {
            if (held && (!previous.directions[direction] || time >= (previous.nextRepeat[direction] ?? Infinity))) {
              this.onNavigate(direction, player)
              previous.nextRepeat[direction] = time + (previous.directions[direction] ? 170 : 360)
            }
            if (!held) delete previous.nextRepeat[direction]
          }
          if (fresh(binding.jump)) this.onNavigate('confirm', player)
          if (fresh(binding.dodge)) this.onNavigate('back', player)
        } else if (this.enabled) {
          for (const action of ACTIONS) if (!HELD.has(action) && fresh(binding[action])) this.padEdges[player].add(action)
          if (fresh(12)) this.padEdges[player].add('jump')
        }
      }
      previous.buttons = buttons
      previous.directions = directions
      previous.pad = pad
      previous.slot = slot
      previous.player = player
    }
    this.publishDevices()
    return pads
  }
  sample() {
    this.pollGamepads()
    if (!this.enabled || this.menuEnabled || this.capture) return [empty(), empty()]
    const samples = this.settings.values.bindings.map((bindings, player) => {
      const sample = empty()
      for (const action of ACTIONS) sample[action] = (HELD.has(action) ? this.down : this.pressed).has(bindings[action]) || this.padEdges[player].has(action)
      for (const state of this.padStates.values()) {
        if (state.player !== player) continue
        const binding = this.settings.values.padBindings?.[player] || DEFAULT_PAD_BINDINGS[player]
        sample.left ||= state.directions.left
        sample.right ||= state.directions.right
        sample.guard ||= !!state.buttons[binding.guard]
      }
      return sample
    })
    this.pressed.clear(); this.padEdges.forEach(edges => edges.clear())
    return samples
  }
  destroy() {
    for (const name of ['keydown', 'keyup', 'blur']) window.removeEventListener(name, this.handlers[name])
    document.removeEventListener('visibilitychange', this.handlers.visibilitychange)
    this.unsubscribe(); this.cancelPadCapture(); this.deviceSlots.clear(); this.padStates.clear()
  }
}
