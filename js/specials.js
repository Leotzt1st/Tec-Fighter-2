// All specials cost one full meter. Timings are in seconds and world units.
export const SPECIALS = {
  leo: { name: 'Rastro elétrico', kind: 'dash', damage: 29, startup: .16, active: .22, recovery: .38, reach: 118, speed: 640, lift: 0 },
  vini: { name: 'Ascensão violeta', kind: 'rise', damage: 28, startup: .18, active: .25, recovery: .35, reach: 104, speed: 150, lift: -680 },
  rodolfo: { name: 'Onda sísmica', kind: 'pulse', damage: 31, startup: .30, active: .18, recovery: .40, reach: 200, speed: 0, lift: -240 },
  eduardo: { name: 'Sequência esmeralda', kind: 'flurry', damage: 10, startup: .14, active: .36, recovery: .36, reach: 132, speed: 130, hits: 3, lift: 0 },
  gui: { name: 'Passo fantasma', kind: 'blink', damage: 27, startup: .12, active: .20, recovery: .44, reach: 104, speed: 880, lift: 0 },
  dantas: { name: 'Corte de energia', kind: 'wave', damage: 28, startup: .24, active: .18, recovery: .42, reach: 260, speed: 0, lift: 0 },
  caio: { name: 'Ciclone rubro', kind: 'cyclone', damage: 28, startup: .20, active: .28, recovery: .40, reach: 150, speed: 280, lift: -410 },
  thales: { name: 'Martelo solar', kind: 'crush', damage: 34, startup: .38, active: .15, recovery: .46, reach: 140, speed: 100, lift: -300 }
}

export function specialMove(character) {
  return { ...character.special, type: 'special', cost: 100, priority: 3, elapsed: 0, hitSlots: new Set(), connected: false,
    duration: character.special.startup + character.special.active + character.special.recovery }
}
