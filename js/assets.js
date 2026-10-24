import { SPRITE_OVERRIDES } from './animations.js';

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Não foi possível carregar ${src}. Confira os arquivos do jogo.`));
    image.src = src;
  });
}

export class Assets {
  constructor() { this.characters = new Map(); this.background = null; this.images = new Map(); }
  image(src) {
    if (!this.images.has(src)) this.images.set(src, loadImage(src));
    return this.images.get(src);
  }
  async load(characters) {
    const tasks = characters.map(async character => {
      const entries = await Promise.all([
        ['idle', 'Parado', 1], ['walk', 'Andando', 4], ['attack', 'Atacando', character.id === 'dantas' ? 4 : 3]
      ].map(async ([key, suffix, frames]) => [key, {
        image: await this.image(`./img/sprites/${character.sprite}${suffix}.png`), frames
      }]));
      const sheets = Object.fromEntries(entries);
      for (const [state, spec] of Object.entries(SPRITE_OVERRIDES[character.id] || {})) {
        sheets[state] = { ...spec, override: true, image: await this.image(spec.src) };
      }
      this.characters.set(character.id, sheets);
    });
    tasks.push(this.image('./img/fundo_rua.png').then(image => { this.background = image; }));
    await Promise.all(tasks);
  }
}
