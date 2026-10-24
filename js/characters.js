import { SPECIALS } from './specials.js'

const roster = [
  ['leo', 'Leo', 'Leo', '#54dcff', 'Versátil · avanço rápido', 100, 320, 1, 1],
  ['vini', 'Vini', 'Vini', '#c5a0ff', 'Ágil · pressão aérea', 96, 345, .98, .98],
  ['rodolfo', 'Rodolfo', 'Rodolfo', '#ffb85b', 'Resistente · controle de espaço', 106, 295, 1.02, 1.02],
  ['eduardo', 'Eduardo', 'Edu', '#5ff3ae', 'Técnico · sequências rápidas', 98, 335, .96, 1],
  ['gui', 'Gui', 'Gui', '#ff88c2', 'Móvel · aproximação evasiva', 96, 350, .97, .98],
  ['dantas', 'Dantas', 'Dantas', '#73a6ff', 'Preciso · alcance superior', 100, 305, .98, 1.09],
  ['caio', 'Caio', 'Caio', '#ff756a', 'Ofensivo · ataques giratórios', 100, 325, 1.01, .98],
  ['thales', 'Thales', 'Thales', '#f5dc74', 'Potente · golpes de impacto', 104, 290, 1.07, 1.02]
]

export const CHARACTERS = roster.map(([id, name, portrait, color, description, health, speed, damage, reach]) => ({
  id, name, color, description, sprite: id,
  portrait: `./seleçãoPersonagem/${portrait}.png`,
  stats: { health, speed, damage, reach },
  special: SPECIALS[id]
}))

export function getCharacter(id) {
  return CHARACTERS.find(character => character.id === id) || CHARACTERS[0]
}
