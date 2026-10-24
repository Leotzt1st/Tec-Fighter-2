import test from 'node:test'
import assert from 'node:assert/strict'
import { Records, RECORDS_KEY } from '../js/records.js'
const storage = () => { const data = new Map(); return { getItem: key => data.get(key), setItem: (key, value) => data.set(key, value) } }
const attempt = (wins, score, id = `${wins}-${score}`) => ({ id, mode: 'infinite', character: 'leo', wins, score, maxCombo: 4, elapsed: 123, date: '2026-10-24T09:00:00Z' })

test('Records persist streaks, independently highest score, rank and sorted comparable history', () => {
  const store = storage(), records = new Records(store)
  assert.equal(records.save(attempt(24, 48500)).newRecord, true)
  assert.equal(records.save(attempt(27, 40000)).newRecord, true)
  assert.equal(records.save(attempt(5, 100000)).newRecord, true)
  const result = new Records(store).get()
  assert.equal(result.best.wins, 27); assert.equal(result.best.score, 100000)
  assert.equal(result.best.rank.id, 'diamond'); assert.equal(result.best.character, 'leo')
  assert.deepEqual(result.history.map(row => row.wins), [27, 24, 5])
  assert.equal(result.history[2].rank.id, 'silver', 'points cannot upgrade a rank')
  assert.equal(result.history[0].date, '2026-10-24T09:00:00.000Z')
})

test('Duplicate save is ignored, non-survival scores ignored and history is bounded', () => {
  const records = new Records(storage())
  records.save(attempt(2, 500)); records.save(attempt(2, 500))
  assert.equal(records.get().history.length, 1)
  records.save({ ...attempt(99, 999999), mode: 'arcade' })
  assert.equal(records.get().best.wins, 2)
  for (let i = 0; i < 35; i++) records.save(attempt(i, i * 100, `attempt-${i}`))
  assert.equal(records.get().history.length, 20); assert.equal(records.get().best.wins, 34)
})

test('Corrupt or unavailable localStorage does not break records and ranks are recomputed', () => {
  const store = storage(); store.setItem(RECORDS_KEY, '{invalid')
  assert.deepEqual(new Records(store).get().history, [])
  store.setItem(RECORDS_KEY, JSON.stringify({ history: [attempt(4, 99999), { ...attempt(50, 5), character: 'bad' }] }))
  assert.equal(new Records(store).get().history.length, 1)
  const records = new Records({ getItem() { throw Error() }, setItem() { throw Error() } })
  assert.doesNotThrow(() => records.save(attempt(6, 1000)))
  assert.equal(records.get().best.rank.id, 'silver')
  assert.equal(records.save(attempt(3, 1)).newRecord, false)
})
