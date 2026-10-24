import test from 'node:test'
import assert from 'node:assert/strict'
import { Settings } from '../js/settings.js'
import { Input } from '../js/input.js'

function harness(t) {
  const previous = Object.fromEntries(['window', 'document', 'navigator'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
  const handlers = {}
  const removed = []
  const add = (name, fn) => { handlers[name] = fn }
  const remove = (name, fn) => { assert.equal(handlers[name], fn); removed.push(name); delete handlers[name] }
  const doc = { hidden: false, addEventListener: add, removeEventListener: remove }
  let pads = []
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { addEventListener: add, removeEventListener: remove } })
  Object.defineProperty(globalThis, 'document', { configurable: true, value: doc })
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { getGamepads: () => pads } })
  const settings = new Settings(null)
  let pauses = 0, blurs = 0, fullscreen = 0, prevented = 0
  const input = new Input(settings, { onPause: () => pauses++, onBlur: () => blurs++, onFullscreen: () => fullscreen++ })
  const key = (name, code, extra = {}) => handlers[name]({ code, repeat: false, target: null, preventDefault() { prevented++ }, ...extra })
  t.after(() => {
    if (Object.keys(handlers).length) input.destroy()
    for (const [key, descriptor] of Object.entries(previous)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else delete globalThis[key]
    }
  })
  return { input, settings, handlers, doc, key, removed, setPads(value) { pads = value }, get pauses() { return pauses }, get blurs() { return blurs }, get fullscreen() { return fullscreen }, get prevented() { return prevented } }
}
const gamepad = (index = 0) => ({ index, connected: true, axes: [0, 0], buttons: Array.from({ length: 16 }, () => ({ pressed: false })) })

test('two keyboard players move simultaneously and attacks consume exactly one edge', t => {
  const h = harness(t)
  h.input.enabled = true
  h.key('keydown', 'KeyD'); h.key('keydown', 'ArrowLeft')
  h.key('keydown', 'Space'); h.key('keydown', 'Space', { repeat: true })
  h.key('keydown', 'ArrowDown')
  const first = h.input.sample()
  assert.equal(first[0].right, true); assert.equal(first[1].left, true)
  assert.equal(first[0].light, true); assert.equal(first[1].light, true)
  const second = h.input.sample()
  assert.equal(second[0].right, true); assert.equal(second[1].left, true)
  assert.equal(second[0].light, false); assert.equal(second[1].light, false)
  h.key('keyup', 'Space'); h.key('keydown', 'Space')
  assert.equal(h.input.sample()[0].light, true)
  h.key('keyup', 'KeyD'); h.key('keyup', 'ArrowLeft')
  assert.equal(h.input.sample()[0].right, false); assert.equal(h.input.sample()[1].left, false)
})

test('blur, visibility loss, binding changes and disabling clear held and buffered input', t => {
  const h = harness(t)
  h.input.enabled = true
  h.key('keydown', 'KeyA'); h.key('keydown', 'Space')
  h.handlers.blur()
  assert.equal(h.blurs, 1)
  assert.equal(h.input.sample()[0].left, false); assert.equal(h.input.sample()[0].light, false)
  h.key('keydown', 'KeyA'); h.doc.hidden = true; h.handlers.visibilitychange()
  assert.equal(h.blurs, 2); assert.equal(h.input.sample()[0].left, false)
  h.key('keydown', 'KeyD'); h.settings.bind(0, 'right', 'KeyL')
  assert.equal(h.input.sample()[0].right, false)
  h.key('keydown', 'KeyL'); assert.equal(h.input.sample()[0].right, true)
  h.input.enabled = false
  assert.equal(h.input.sample()[0].right, false)
  h.input.enabled = true
  assert.equal(h.input.sample()[0].right, false)
})

test('UI fields are untouched, bound gameplay keys prevent scroll only while enabled, global shortcuts use fresh presses', t => {
  const h = harness(t)
  h.key('keydown', 'ArrowDown'); assert.equal(h.prevented, 0)
  h.input.enabled = true
  h.key('keydown', 'ArrowDown', { target: { matches: () => true } })
  assert.equal(h.prevented, 0); assert.equal(h.input.sample()[1].light, false)
  h.key('keydown', 'ArrowDown'); assert.equal(h.prevented, 1)
  h.key('keydown', 'Escape'); h.key('keydown', 'Escape', { repeat: true })
  assert.equal(h.pauses, 1)
  h.key('keydown', 'F10'); assert.equal(h.fullscreen, 1)
  h.key('keydown', 'F10', { repeat: true }); assert.equal(h.fullscreen, 1)
})

test('standard gamepads map two independent players with attack edges, dead zone and disconnect cleanup', t => {
  const h = harness(t), p1 = gamepad(), p2 = gamepad(1)
  h.setPads([p1, null, p2]); h.input.enabled = true
  p1.axes[0] = -0.8; p1.buttons[2].pressed = true; p1.buttons[4].pressed = true
  p2.buttons[15].pressed = true; p2.buttons[1].pressed = true
  let sample = h.input.sample()
  assert.equal(sample[0].left, true); assert.equal(sample[0].light, true); assert.equal(sample[0].guard, true)
  assert.equal(sample[1].right, true); assert.equal(sample[1].special, true)
  sample = h.input.sample(); assert.equal(sample[0].light, false); assert.equal(sample[1].special, false)
  assert.equal(sample[0].guard, true)
  p1.axes[0] = 0.2; p1.buttons[2].pressed = false; h.input.sample()
  p1.buttons[2].pressed = true; assert.equal(h.input.sample()[0].light, true)
  h.setPads([]); sample = h.input.sample()
  assert.equal(sample[0].left, false); assert.equal(sample[0].guard, false); assert.equal(sample[1].right, false)
})

test('gamepad Start pauses and resumes on fresh presses while disabled without held-button toggling', t => {
  const h = harness(t), pad = gamepad()
  h.setPads([pad]); h.input.enabled = true
  pad.buttons[9].pressed = true; h.input.sample()
  assert.equal(h.pauses, 1)
  h.input.enabled = false; h.input.clear()
  h.input.pollGamepads(); h.input.pollGamepads(); assert.equal(h.pauses, 1)
  pad.buttons[9].pressed = false; h.input.pollGamepads()
  pad.buttons[9].pressed = true; h.input.pollGamepads(); assert.equal(h.pauses, 2)
  h.input.enabled = true; h.input.sample(); assert.equal(h.pauses, 2)
})

test('destroy removes each listener and detaches settings subscriptions', t => {
  const h = harness(t)
  h.input.destroy()
  assert.deepEqual(h.removed.sort(), ['blur', 'keydown', 'keyup', 'visibilitychange'])
  assert.equal(Object.keys(h.handlers).length, 0)
  h.settings.reset()
})
