export const overlaps = (a, b) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y

export function attackBox(fighter) {
  const move = fighter.move
  if (!move || move.elapsed < move.startup || move.elapsed >= move.startup + move.active) return null
  const reach = move.reach * fighter.char.stats.reach
  return {
    x: fighter.facing > 0 ? fighter.x + 12 : fighter.x - reach - 12,
    y: fighter.y - (move.kind === 'rise' || move.kind === 'cyclone' ? 220 : 152),
    width: reach,
    height: move.kind === 'rise' || move.kind === 'cyclone' ? 220 : 104
  }
}

export function separateBodies(a, b) {
  // Airborne fighters may cross above the opponent; grounded bodies cannot overlap.
  if (Math.abs(a.y - b.y) > 125) return
  const distance = Math.abs(a.x - b.x)
  if (distance >= 64) return
  const direction = a.x <= b.x ? -1 : 1
  const push = (64 - distance) / 2
  a.x += direction * push
  b.x -= direction * push
  // Redistribute the displacement at stage edges instead of squeezing a fighter out.
  if (a.x < 40) { b.x += 40 - a.x; a.x = 40 }
  if (b.x < 40) { a.x += 40 - b.x; b.x = 40 }
  if (a.x > 1240) { b.x -= a.x - 1240; a.x = 1240 }
  if (b.x > 1240) { a.x -= b.x - 1240; b.x = 1240 }
}
