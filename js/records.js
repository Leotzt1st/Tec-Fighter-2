import { getRank } from './modes.js'
import { CHARACTERS } from './characters.js'
export const RECORDS_KEY = 'tec-fighters-2:infinite-records:v1'
const integer = n => Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0
const ids = new Set(CHARACTERS.map(c => c.id))
const compare = (a, b) => b.wins - a.wins || b.score - a.score || b.date.localeCompare(a.date)
function attempt(value) {
  if (!value || typeof value !== 'object' || !ids.has(value.character)) return null
  const wins = integer(value.wins)
  const date = typeof value.date === 'string' && Number.isFinite(Date.parse(value.date)) ? new Date(value.date).toISOString() : null
  if (!date) return null
  return { id: typeof value.id === 'string' ? value.id.slice(0, 120) : date,
    wins, score: integer(value.score), rank: getRank(wins), character: value.character, date,
    maxCombo: integer(value.maxCombo), elapsed: Number.isFinite(value.elapsed) ? Math.max(0, value.elapsed) : 0 }
}
function bestOf(history) {
  if (!history.length) return { wins: 0, score: 0, rank: getRank(0), character: null, date: null }
  const streak = [...history].sort(compare)[0]
  return { ...streak, score: Math.max(...history.map(row => row.score)) }
}

export class Records {
  constructor(storage) {
    try { this.storage = storage === undefined ? globalThis.localStorage : storage } catch { this.storage = null }
    let raw
    try { raw = JSON.parse(this.storage?.getItem(RECORDS_KEY) || 'null') } catch { raw = null }
    this.history = Array.isArray(raw?.history) ? raw.history.map(attempt).filter(Boolean).sort(compare).slice(0, 20) : []
    this.best = bestOf(this.history)
    // The independent score record survives pruning the twenty best streaks.
    if (raw?.best && Number.isFinite(raw.best.score)) this.best.score = Math.max(this.best.score, integer(raw.best.score))
  }
  get() { return { best: { ...this.best }, history: this.history.map(row => ({ ...row })) } }
  save(summary) {
    if (summary?.mode !== 'infinite') return { ...this.get(), newRecord: false }
    const row = attempt({ ...summary, date: summary.date || new Date().toISOString() })
    if (!row || this.history.some(item => item.id === row.id)) return { ...this.get(), newRecord: false }
    const previous = this.best
    const newRecord = row.wins > previous.wins || row.score > previous.score || !previous.character
    this.history = [...this.history, row].sort(compare).slice(0, 20)
    this.best = bestOf(this.history)
    this.best.score = Math.max(previous.score, row.score, this.best.score)
    try { this.storage?.setItem(RECORDS_KEY, JSON.stringify({ best: this.best, history: this.history })) } catch { /* Still valid in memory. */ }
    return { ...this.get(), newRecord }
  }
}
