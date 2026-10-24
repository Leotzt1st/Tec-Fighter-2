import test from 'node:test'
import assert from 'node:assert/strict'
import { Settings, DEFAULT_BINDINGS } from '../js/settings.js'

const memory = (saved = null) => ({ value: saved, getItem() { return this.value }, setItem(key, value) { this.value = value } })

test('preferences persist and clamp volumes', () => {
  const storage = memory()
  const settings = new Settings(storage)
  settings.set('masterVolume', 2)
  settings.set('muted', true)
  settings.set('renderScale', 0.5)
  const restored = new Settings(storage)
  assert.equal(restored.values.masterVolume, 1)
  assert.equal(restored.values.muted, true)
  assert.equal(restored.values.renderScale, 0.5)
})

test('corrupt preferences safely restore defaults', () => {
  assert.deepEqual(new Settings(memory('{invalid')).values.bindings, DEFAULT_BINDINGS)
  const settings = new Settings(memory(JSON.stringify({ masterVolume: 'bad', particles: 'false', renderScale: 99, bindings: [{ left: 'Space' }, {}] })))
  assert.equal(settings.values.particles, true)
  assert.equal(settings.values.renderScale, 1)
  assert.deepEqual(settings.values.bindings, DEFAULT_BINDINGS)
})

test('rebinding identifies conflicts across both players and reserved keys', () => {
  const settings = new Settings(memory())
  assert.equal(settings.bind(0, 'light', 'ArrowDown').ok, false)
  assert.equal(settings.bind(0, 'light', 'Escape').ok, false)
  assert.equal(settings.bind(0, 'light', 'KeyJ').ok, true)
  assert.equal(settings.values.bindings[0].light, 'KeyJ')
  assert.equal(settings.bind(1, 'heavy', 'KeyJ').ok, false)
  settings.resetBindings()
  assert.equal(settings.values.bindings[0].light, 'Space')
})

test('storage restrictions do not break settings and subscribers can detach', () => {
  const settings = new Settings({ getItem() { throw new Error('denied') }, setItem() { throw new Error('denied') } })
  let changes = 0
  const unsubscribe = settings.subscribe(() => changes++)
  settings.set('particles', false)
  assert.equal(changes, 1)
  unsubscribe()
  settings.reset()
  assert.equal(changes, 1)
  assert.equal(settings.values.particles, true)
})
