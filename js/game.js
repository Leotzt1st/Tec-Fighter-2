import { Combat } from './combat.js';
import { CHARACTERS } from './characters.js';
import { ModeSession } from './modes.js';
import { AIController } from './ai.js';
import { Records } from './records.js';

/** One loop for every mode; campaign transitions never create extra timers or listeners. */
export class Game {
  constructor({ input, renderer, ui, audio, records = new Records() }) {
    Object.assign(this, { input, renderer, ui, audio, records });
    this.combat = null; this.session = null; this.ai = null;
    this.paused = false; this.running = false; this.ids = ['leo', 'caio'];
    this.mode = 'versus'; this.difficulty = 'normal'; this.awaitingNext = false;
    this.previous = 0; this.accumulator = 0; this.fpsTime = 0; this.fpsFrames = 0; this.resultShown = false;
    this.frame = this.frame.bind(this); this.raf = requestAnimationFrame(this.frame);
  }
  start(config = this.ids) {
    const data = Array.isArray(config) ? { ids: config, mode: 'versus' } : config || {};
    const ids = data.ids || this.ids;
    this.mode = data.mode || this.mode; this.difficulty = data.difficulty || this.difficulty;
    this.session = new ModeSession({ mode: this.mode, difficulty: this.difficulty, character: ids[0], opponent: ids[1] });
    this.ui.setMode?.(this.mode, this.difficulty);
    this.beginBattle();
  }
  beginBattle() {
    this.ids = [...this.session.ids]; this.input.clear(); this.renderer.clear();
    this.combat = new Combat(this.ids, event => this.onEvent(event), {
      roundsToWin: ['arcade', 'infinite'].includes(this.mode) ? 1 : 2,
      preserveOnDraw: this.mode === 'infinite'
    });
    if (this.mode === 'infinite' && this.session.carry) {
      const f = this.combat.fighters[0];
      f.health = Math.min(f.maxHealth, Math.max(0, this.session.carry.health));
      f.energy = Math.min(100, Math.max(0, this.session.carry.energy));
    }
    this.ai = this.mode === 'versus' ? null : new AIController(this.session.difficulty);
    this.paused = false; this.running = true; this.resultShown = false; this.awaitingNext = false; this.accumulator = 0;
    this.input.enabled = true; this.input.menuEnabled = false;
    this.ui.show('game'); this.ui.update(this.combat, this.session);
    this.renderer.resize(); this.audio.setScene('battle');
  }
  rematch() { this.start({ ids: [this.session?.character || this.ids[0], this.ids[1]], mode: this.mode, difficulty: this.difficulty }); }
  onEvent(event) {
    this.session?.recordEvent(event, this.combat);
    this.renderer.event(event, this.combat);
    // The camera and victory sting accompany the actual poses, before result options.
    if (event.type === 'ko' && !event.draw && this.combat) {
      this.renderer.camera.celebrate?.(this.combat.fighters[this.combat.roundWinner].x);
      this.audio.play('victory');
    }
    const sound = event.type === 'attack' ? event.strength || 'light' : event.type;
    if (event.type === 'victory') return;
    this.audio.play(sound, event.type === 'special' ? CHARACTERS.findIndex(c => c.id === this.combat?.fighters[event.player]?.char.id) : event.player);
  }
  finishBattle() {
    this.resultShown = true; this.input.enabled = false; this.input.clear(); this.audio.setScene('silent');
    const result = this.session.finish(this.combat);
    if (result.continue) {
      this.awaitingNext = true; this.promotionElapsed = 0;
      this.ui.showIntermission(this.session.summary(), result.promotion);
      if (result.promotion) this.audio.play('promotion');
    } else {
      const record = this.mode === 'infinite' ? this.records.save(this.session.summary()) : null;
      this.ui.result(this.combat, this.session, record);
    }
  }
  nextBattle() {
    if (!this.awaitingNext || (this.session.promotion && this.promotionElapsed < 1.8)) return false;
    if (!this.session.next()) return false;
    this.beginBattle(); return true;
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
    this.running = false; this.paused = false; this.awaitingNext = false;
    this.input.enabled = false; this.input.clear(); this.input.menuEnabled = true;
    this.combat = null; this.renderer.clear(); this.audio.setScene('menu'); this.ui.show('menu');
  }
  select(mode = this.mode, difficulty = this.difficulty) {
    this.menu(); this.mode = mode; this.difficulty = difficulty;
    this.ui.setMode?.(mode, difficulty); this.ui.show('select');
  }
  frame(timestamp) {
    this.input.menuEnabled = this.ui.screen !== 'game';
    this.input.pollGamepads();
    const elapsed = this.previous ? Math.min((timestamp - this.previous) / 1000, .1) : 0;
    this.previous = timestamp;
    if (this.awaitingNext) this.promotionElapsed += elapsed;
    if (this.running && !this.paused && this.combat) {
      this.accumulator += elapsed;
      let simulated = false;
      while (this.accumulator >= 1 / 60 && !this.paused) {
        simulated = true;
        const commands = this.input.sample();
        if (this.ai) commands[1] = this.ai.sample(1 / 60, this.combat, 1);
        if (this.combat.phase === 'fight' && !this.combat.hitstop) this.session.tick(1 / 60);
        this.combat.update(1 / 60, commands);
        this.accumulator -= 1 / 60;
      }
      this.renderer.update(elapsed, this.combat);
      if (simulated) this.ui.update(this.combat, this.session);
      if (this.combat.phase === 'matchOver' && !this.resultShown) this.finishBattle();
    } else if (!this.paused) this.renderer.update(elapsed, this.combat);
    this.renderer.render(this.combat, this.paused);
    this.fpsTime += elapsed; this.fpsFrames++;
    if (this.fpsTime >= .5) { this.ui.setFPS(Math.round(this.fpsFrames / this.fpsTime)); this.fpsTime = 0; this.fpsFrames = 0; }
    this.raf = requestAnimationFrame(this.frame);
  }
  destroy() { cancelAnimationFrame(this.raf); this.input.destroy(); this.renderer.destroy(); this.audio.destroy(); this.ui.destroy?.(); }
}
