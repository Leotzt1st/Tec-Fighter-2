export const ACTION_LABELS = Object.freeze({
  left: 'Esquerda', right: 'Direita', jump: 'Pular', light: 'Ataque leve',
  heavy: 'Ataque pesado', special: 'Especial', guard: 'Defender', dodge: 'Esquivar'
})
export const DEFAULT_BINDINGS = Object.freeze([
  Object.freeze({ left: 'KeyA', right: 'KeyD', jump: 'KeyW', light: 'Space', heavy: 'KeyF', special: 'KeyG', guard: 'KeyS', dodge: 'KeyQ' }),
  Object.freeze({ left: 'ArrowLeft', right: 'ArrowRight', jump: 'ArrowUp', light: 'ArrowDown', heavy: 'Numpad1', special: 'Numpad2', guard: 'Numpad0', dodge: 'Numpad3' })
])
export const PAD_ACTION_LABELS = Object.freeze({ jump: 'Pular / confirmar', light: 'Ataque leve', heavy: 'Ataque pesado', guard: 'Defender', dodge: 'Esquivar / voltar', special: 'Especial', pause: 'Pausar' })
export const DEFAULT_PAD_BINDINGS = Object.freeze([
  Object.freeze({ jump: 0, light: 2, heavy: 3, guard: 4, dodge: 1, special: 5, pause: 9 }),
  Object.freeze({ jump: 0, light: 2, heavy: 3, guard: 4, dodge: 1, special: 5, pause: 9 })
])
const validPadButton = value => Number.isInteger(value) && value >= 0 && value < 12
const STORAGE_KEY = 'tec-fighters-2:settings:v1'
const BOOLEAN_KEYS = ['muted', 'particles', 'shake', 'showFPS', 'extraEffects']
const VOLUME_KEYS = ['masterVolume', 'musicVolume', 'sfxVolume']
const RESERVED = new Set(['Escape', 'KeyP', 'F10', 'Tab', 'Enter', 'MetaLeft', 'MetaRight', 'ControlLeft', 'ControlRight', 'AltLeft', 'AltRight'])
const validCode = code => typeof code === 'string' && /^(Key[A-Z]|Digit[0-9]|Numpad[0-9]|Arrow(Left|Right|Up|Down)|Space|Shift(Left|Right)|Backquote|Minus|Equal|Bracket(Left|Right)|Backslash|Semicolon|Quote|Comma|Period|Slash)$/.test(code)
const defaults = () => ({
  masterVolume: 0.65, musicVolume: 0.25, sfxVolume: 0.7, muted: false,
  renderScale: 1, effectsQuality: 'high', particles: true, shake: true,
  showFPS: false, extraEffects: true, padPlayers: [0, 1], padBindings: DEFAULT_PAD_BINDINGS.map(pad => ({ ...pad })), bindings: DEFAULT_BINDINGS.map(player => ({ ...player }))
})

function sanitize(raw) {
  const value = defaults()
  if (!raw || typeof raw !== 'object') return value
  for (const key of BOOLEAN_KEYS) if (typeof raw[key] === 'boolean') value[key] = raw[key]
  for (const key of VOLUME_KEYS) if (typeof raw[key] === 'number' && Number.isFinite(raw[key])) value[key] = Math.max(0, Math.min(1, raw[key]))
  if ([0.5, 0.75, 1, 1.5].includes(raw.renderScale)) value.renderScale = raw.renderScale
  if (['low', 'high'].includes(raw.effectsQuality)) value.effectsQuality = raw.effectsQuality
  if (Array.isArray(raw.bindings) && raw.bindings.length === 2) {
    const bindings = raw.bindings.map((player, index) => ({ ...DEFAULT_BINDINGS[index], ...(player && typeof player === 'object' ? player : {}) }))
    const codes = bindings.flatMap(player => Object.keys(ACTION_LABELS).map(action => player[action]))
    if (codes.every(code => validCode(code) && !RESERVED.has(code)) && new Set(codes).size === codes.length) {
      value.bindings = bindings.map(player => Object.fromEntries(Object.keys(ACTION_LABELS).map(action => [action, player[action]])))
    }
  }
  if (Array.isArray(raw.padPlayers) && raw.padPlayers.length === 2 && raw.padPlayers.every(player => player === 0 || player === 1) && raw.padPlayers[0] !== raw.padPlayers[1]) value.padPlayers = [...raw.padPlayers]
  if (Array.isArray(raw.padBindings) && raw.padBindings.length === 2) {
    value.padBindings = raw.padBindings.map((bindings, index) => {
      const merged = { ...DEFAULT_PAD_BINDINGS[index], ...bindings }
      const buttons = Object.keys(PAD_ACTION_LABELS).map(action => merged[action])
      return buttons.every(validPadButton) && new Set(buttons).size === buttons.length
        ? Object.fromEntries(Object.keys(PAD_ACTION_LABELS).map(action => [action, merged[action]]))
        : { ...DEFAULT_PAD_BINDINGS[index] }
    })
  }
  return value
}

export class Settings {
  constructor(storage) {
    this.listeners = new Set()
    // Sandboxed/private browsing contexts can throw even on reading localStorage.
    try { this.storage = storage === undefined ? globalThis.localStorage : storage } catch { this.storage = null }
    let saved
    try { saved = JSON.parse(this.storage?.getItem(STORAGE_KEY) || 'null') } catch { saved = null }
    this.values = sanitize(saved)
  }
  persist() {
    try { this.storage?.setItem(STORAGE_KEY, JSON.stringify(this.values)) } catch { /* Preferences remain available for this session. */ }
    for (const listener of this.listeners) listener(this.values)
  }
  set(key, value) {
    if (['bindings', 'padBindings', 'padPlayers'].includes(key) || !Object.hasOwn(this.values, key)) return false
    this.values = sanitize({ ...this.values, [key]: value })
    this.persist()
    return true
  }
  bind(player, action, code) {
    if (![0, 1].includes(player) || !Object.hasOwn(ACTION_LABELS, action)) return { ok: false, error: 'Comando inválido.' }
    if (!validCode(code) || RESERVED.has(code)) return { ok: false, error: 'Tecla reservada. Escolha uma letra, seta, número ou Shift.' }
    for (let index = 0; index < 2; index++) {
      for (const [name, current] of Object.entries(this.values.bindings[index])) {
        if (current === code && (index !== player || name !== action)) return { ok: false, error: `Conflito: ${ACTION_LABELS[name]} do Jogador ${index + 1} já usa essa tecla.` }
      }
    }
    this.values.bindings[player][action] = code
    this.persist()
    return { ok: true }
  }
  bindPad(player, action, button) {
    if (![0, 1].includes(player) || !Object.hasOwn(PAD_ACTION_LABELS, action)) return { ok: false, error: 'Comando de controle inválido.' }
    if (!validPadButton(button)) return { ok: false, error: 'Botão inválido. O direcional é reservado à movimentação.' }
    for (const [otherAction, current] of Object.entries(this.values.padBindings[player])) {
      if (current === button && otherAction !== action) return { ok: false, error: `Conflito: ${PAD_ACTION_LABELS[otherAction]} já usa o botão ${button}.` }
    }
    this.values.padBindings[player][action] = button
    this.persist()
    return { ok: true }
  }
  resetPadBindings() {
    this.values.padBindings = DEFAULT_PAD_BINDINGS.map(pad => ({ ...pad }))
    this.values.padPlayers = [0, 1]
    this.persist()
  }
  setPadPlayer(slot, player) {
    if (![0, 1].includes(slot) || ![0, 1].includes(player)) return false
    this.values.padPlayers[1 - slot] = 1 - player
    this.values.padPlayers[slot] = player
    this.persist()
    return true
  }
  resetBindings() {
    this.values.bindings = DEFAULT_BINDINGS.map(player => ({ ...player }))
    this.persist()
  }
  reset() { this.values = defaults(); this.persist() }
  subscribe(listener) { this.listeners.add(listener); return () => this.listeners.delete(listener) }
}

export function keyLabel(code) {
  return ({ Space: 'ESPAÇO', ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓', ShiftLeft: 'SHIFT ESQ.', ShiftRight: 'SHIFT DIR.' })[code]
    || code.replace(/^Key/, '').replace(/^Digit/, '').replace(/^Numpad/, 'NUM ')
}
