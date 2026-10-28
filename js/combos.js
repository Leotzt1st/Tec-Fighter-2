export const COMBO_WINDOW = .85
export const INPUT_BUFFER = .20
export const MAX_COMBO = 6

export function normalMove(type, airborne = false) {
  const heavy = type === 'heavy'
  const startup = heavy ? .20 : .075
  const active = heavy ? .12 : .09
  const recovery = heavy ? .30 : .21
  return { type, startup, active, recovery, duration: startup + active + recovery,
    damage: heavy ? 14 : 7, reach: heavy ? 124 : 92, priority: heavy ? 2 : 1,
    elapsed: 0, connected: false, hitSlots: new Set(), airborne }
}

export function canCancel(move, next) {
  if (!move?.connected || move.type === 'special') return false
  if (move.elapsed < move.startup + move.active * .45) return false
  if (next === 'special') return true
  return move.type === 'light' || (move.airborne && next === 'light')
}

export const comboScale = count => Math.max(.42, 1 - count * .12)
