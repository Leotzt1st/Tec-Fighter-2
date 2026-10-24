import { CHARACTERS } from './characters.js';
import { Settings } from './settings.js';
import { Input } from './input.js';
import { AudioManager } from './audio.js';
import { Assets } from './assets.js';
import { Renderer } from './renderer.js';
import { Game } from './game.js';
import { UI } from './ui.js';

const settings = new Settings();
const audio = new AudioManager(settings);
let game, input;
const ui = new UI({ characters: CHARACTERS, settings, onAction: (action, payload) => {
  audio.unlock();
  if (action === 'navigate') { audio.play('nav'); return; }
  audio.play('confirm');
  switch (action) {
    case 'retry': window.location.reload(); break;
    case 'play': game?.menu(); ui.show('modes'); break;
    case 'choose-mode': game?.select(payload.mode, payload.difficulty); break;
    case 'start': game?.start(payload); break;
    case 'menu': game?.menu(); break;
    case 'select': game?.select(); break;
    case 'pause': game?.pause(); break;
    case 'resume': game?.resume(); break;
    case 'rematch': game?.rematch(); break;
    case 'next-battle': game?.nextBattle(); break;
    case 'records': ui.showRecords(game.records.get()); break;
    case 'capture-pad': input.capturePad(payload.player, button => ui.padBindingResult(settings.bindPad(payload.player, payload.action, button))); break;
    case 'cancel-pad-capture': input?.cancelPadCapture(); break;
    case 'fullscreen': toggleFullscreen(); break;
  }
}});
async function toggleFullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
    else ui.toast('Este navegador não oferece tela cheia. Use o modo de janela.');
  } catch { ui.toast('Não foi possível ativar a tela cheia. Tente novamente pelo botão.'); }
}
input = new Input(settings, {
  onPause: () => {
    // Escape must close a settings/controls panel before resuming a paused fight.
    if (game?.paused && ui.screen === 'pause') game.resume();
    else if (ui.screen === 'game') game?.pause();
  },
  onFullscreen: toggleFullscreen,
  onBlur: () => game?.pause(),
  onNavigate: (action, player) => { audio.unlock(); audio.play('nav'); ui.navigatePad(action, player); },
  onDevices: devices => ui.setDevices(devices)
});
input.enabled = false;
ui.show('loading');
const assets = new Assets();
try {
  await assets.load(CHARACTERS);
  const renderer = new Renderer(document.getElementById('gameCanvas'), assets, settings);
  game = new Game({ input, renderer, ui, audio });
  // Read-only access to the running components is useful for diagnostics and local regression tests.
  window.tecFighters = { game, settings, input, ui, audio, records: game.records };
  ui.show('menu'); audio.setScene('menu');
} catch (error) {
  ui.error(error.message);
  const retry = document.querySelector('#panelBody [data-action="menu"]');
  if (retry) { retry.dataset.action = 'retry'; retry.textContent = 'TENTAR NOVAMENTE'; }
  console.error(error);
}
document.addEventListener('pointerdown', () => audio.unlock(), { once: true });
document.addEventListener('keydown', () => audio.unlock(), { once: true });
