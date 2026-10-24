import { Combat } from './combat.js';
import { CHARACTERS } from './characters.js';

/** A single loop lives for the application lifetime; matches contain no timers/listeners. */
export class Game {
  constructor({ input, renderer, ui, audio }) {
    this.input = input; this.renderer = renderer; this.ui = ui; this.audio = audio;
    this.combat = null; this.paused = false; this.running = false; this.ids = ['leo', 'caio'];
    this.previous = 0; this.accumulator = 0; this.fpsTime = 0; this.fpsFrames = 0; this.resultShown = false;
    this.frame = this.frame.bind(this); this.raf = requestAnimationFrame(this.frame);
  }
  start(ids = this.ids) {
    this.ids = [...ids]; this.input.clear(); this.renderer.clear();
    this.combat = new Combat(ids, event => this.onEvent(event));
    this.paused = false; this.running = true; this.resultShown = false; this.accumulator = 0;
    this.input.enabled = true; this.ui.show('game'); this.ui.update(this.combat);
    this.renderer.resize(); this.audio.setScene('battle');
  }
  onEvent(event) {
    this.renderer.event(event, this.combat);
    const sound = event.type === 'attack' ? event.strength || 'light' : event.type;
    this.audio.play(sound, event.type === 'special' ? CHARACTERS.findIndex(c => c.id === this.combat?.fighters[event.player]?.char.id) : event.player);
  }
  pause() {
    if (!this.running || this.paused || this.combat?.phase === 'matchOver') return;
    this.paused = true; this.input.enabled = false; this.input.clear(); this.accumulator = 0;
    this.audio.setScene('silent'); this.ui.show('pause');
  }
  resume() {
    if (!this.running || !this.paused) return;
    this.paused = false; this.input.clear(); this.input.enabled = true; this.accumulator = 0;
    this.audio.setScene('battle'); this.ui.show('game');
  }
  menu() {
    this.running = false; this.paused = false; this.input.enabled = false; this.input.clear();
    this.combat = null; this.renderer.clear(); this.audio.setScene('menu'); this.ui.show('menu');
  }
  select() { this.menu(); this.ui.show('select'); }
  frame(timestamp) {
    this.input.pollGamepads();
    const elapsed = this.previous ? Math.min((timestamp - this.previous) / 1000, .1) : 0;
    this.previous = timestamp;
    if (this.running && !this.paused && this.combat) {
      this.accumulator += elapsed;
      let simulated = false;
      while (this.accumulator >= 1 / 60 && !this.paused) {
        simulated = true;
        this.combat.update(1 / 60, this.input.sample());
        this.accumulator -= 1 / 60;
      }
      this.renderer.update(elapsed, this.combat);
      if (simulated) this.ui.update(this.combat);
      if (this.combat.phase === 'matchOver' && !this.resultShown) {
        this.resultShown = true; this.input.enabled = false; this.input.clear();
        this.ui.result(this.combat); this.audio.setScene('silent');
      }
    } else if (!this.paused) this.renderer.update(elapsed, this.combat);
    this.renderer.render(this.combat, this.paused);
    this.fpsTime += elapsed; this.fpsFrames++;
    if (this.fpsTime >= .5) { this.ui.setFPS(Math.round(this.fpsFrames / this.fpsTime)); this.fpsTime = 0; this.fpsFrames = 0; }
    this.raf = requestAnimationFrame(this.frame);
  }
  destroy() { cancelAnimationFrame(this.raf); this.input.destroy(); this.renderer.destroy(); this.audio.destroy(); }
}
