import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = resolve(fileURLToPath(new URL('../', import.meta.url)));
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.ico': 'image/x-icon', '.svg': 'image/svg+xml' };
const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const path = resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
    if (path !== root && !path.startsWith(root + sep)) {
      res.writeHead(403).end();
      return;
    }
    const body = await readFile(path);
    res.writeHead(200, { 'Content-Type': types[extname(path)] || 'application/octet-stream', 'Cache-Control': 'no-store' }).end(body);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const url = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined), headless: true, args: ['--no-sandbox'] });
const errors = [];
const failedRequests = [];
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
page.on('pageerror', error => errors.push(error.message));
page.on('response', response => { if (response.status() >= 400) failedRequests.push(`${response.status()} ${response.url()}`); });
page.on('requestfailed', request => failedRequests.push(`${request.failure()?.errorText} ${request.url()}`));
const check = name => console.log(`PASS ${name}`);

const tap = async key => { await page.keyboard.down(key); await page.waitForTimeout(35); await page.keyboard.up(key); };
const resetCombat = async () => page.evaluate(() => {
  const c = window.tecFighters.game.combat;
  c.phase = 'fight'; c.phaseTime = 0; c.timeLeft = 60; c.hitstop = 0; c.wins = [0, 0];
  c.fighters.forEach((f, i) => f.reset(500 + i * 120));
  window.tecFighters.input.clear();
});
try {
  await page.goto(url);
  await page.waitForFunction(() => !!window.tecFighters);
  await page.locator('#mainMenu').waitFor({ state: 'visible' });
  assert.equal(await page.title(), 'TEC-FIGHTERS 2');
  await page.waitForTimeout(350);
  await page.screenshot({ path: '/tmp/tec-fighters-menu.png' });
  check('menu and all original assets load');

  await page.locator('#mainMenu [data-action="fullscreen"]').click();
  await page.waitForFunction(() => !!document.fullscreenElement);
  await page.locator('#mainMenu [data-action="fullscreen"]').click();
  await page.waitForFunction(() => !document.fullscreenElement);
  check('fullscreen enters and exits through an actual user action');

  await page.locator('[data-action="play"]').click();
  await page.locator('[data-action="choose-mode"][data-mode="versus"]').click();
  await page.locator('#selectionP1 [data-action="confirm"]').click();
  await page.locator('#selectionP2 [data-action="confirm"]').click();
  await page.locator('#startFight').click();
  await page.waitForFunction(() => window.tecFighters.game.combat?.phase === 'fight');
  await resetCombat();
  const initialHP = await page.evaluate(() => window.tecFighters.game.combat.fighters[1].health);
  await tap('Space');
  await page.waitForFunction(hp => window.tecFighters.game.combat.fighters[1].health < hp, initialHP);
  const afterHit = await page.evaluate(() => window.tecFighters.game.combat.fighters[1].health);
  await page.waitForTimeout(500);
  assert.equal(await page.evaluate(() => window.tecFighters.game.combat.fighters[1].health), afterHit, 'one hit per normal attack');
  assert.ok(await page.evaluate(() => window.tecFighters.game.combat.fighters.every(f => f.energy > 0)), 'both players build energy');
  check('keyboard attack damages once and fills independent energy meters');

  await resetCombat();
  await page.keyboard.down('a');
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(180);
  assert.ok(await page.evaluate(() => {
    const [a, b] = window.tecFighters.game.combat.fighters;
    return a.x < 500 && b.x > 620;
  }), 'both players can move at once');
  await page.keyboard.up('a');
  await page.keyboard.up('ArrowRight');
  await page.keyboard.down('w');
  await page.keyboard.down('ArrowUp');
  await page.waitForFunction(() => window.tecFighters.game.combat.fighters.every(f => f.y < 580));
  await page.keyboard.up('w');
  await page.keyboard.up('ArrowUp');
  await page.waitForFunction(() => window.tecFighters.game.combat.fighters.every(f => f.y === 590 && f.vy === 0));
  check('both players move and jump simultaneously, then land on the floor');

  await resetCombat();
  await page.keyboard.down('Numpad0');
  await page.waitForTimeout(180);
  await tap('Space');
  await page.waitForTimeout(350);
  await page.keyboard.up('Numpad0');
  assert.equal(await page.evaluate(() => window.tecFighters.game.combat.fighters[1].health), initialHP, 'held guard blocks light damage');
  check('second player guard blocks a real keyboard attack');

  await resetCombat();
  await tap('g');
  await page.waitForTimeout(300);
  assert.equal(await page.evaluate(() => window.tecFighters.game.combat.fighters[1].health), initialHP, 'special requires full meter');
  assert.equal(await page.evaluate(() => window.tecFighters.game.combat.fighters[0].move), null, 'invalid special does not execute');
  await page.evaluate(() => { window.tecFighters.game.combat.fighters[0].energy = 100; });
  await tap('g');
  await page.waitForFunction(() => window.tecFighters.game.combat.fighters[0].energy === 0);
  await page.waitForFunction(hp => window.tecFighters.game.combat.fighters[1].health < hp, initialHP);
  await page.screenshot({ path: '/tmp/tec-fighters-special.png' });
  check('special rejects empty meter, consumes full meter and connects');

  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.tecFighters.game.paused);
  const pausedTime = await page.evaluate(() => window.tecFighters.game.combat.timeLeft);
  await page.waitForTimeout(250);
  assert.equal(await page.evaluate(() => window.tecFighters.game.combat.timeLeft), pausedTime, 'timer freezes while paused');
  await page.locator('[data-action="resume"]').click();
  await page.waitForFunction(() => !window.tecFighters.game.paused);
  await page.keyboard.down('d');
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await page.waitForFunction(() => window.tecFighters.game.paused);
  assert.equal(await page.evaluate(() => window.tecFighters.input.down.size), 0, 'blur releases held keys');
  await page.keyboard.up('d');
  await page.locator('[data-action="resume"]').click();
  await resetCombat();
  check('pause freezes match and focus loss clears held inputs');

  await page.evaluate(() => {
    const c = window.tecFighters.game.combat;
    c.wins = [1, 0]; c.fighters[1].health = 1;
  });
  await tap('Space');
  await page.waitForFunction(() => window.tecFighters.game.combat.phase === 'matchOver');
  await page.locator('[data-action="rematch"]').waitFor({ state: 'visible' });
  assert.equal(await page.evaluate(() => window.tecFighters.game.combat.winner), 0);
  await page.locator('[data-action="rematch"]').click();
  assert.deepEqual(await page.evaluate(() => window.tecFighters.game.combat.wins), [0, 0]);
  assert.ok(await page.evaluate(() => window.tecFighters.game.combat.fighters.every(f => f.health === f.maxHealth && f.energy === 0)));
  check('actual KO ends best-of-three match and rematch resets state');

  await page.keyboard.press('Escape');
  await page.locator('[data-action="menu"]:visible').first().click();
  await page.locator('[data-action="select"]:visible').click();
  assert.equal(await page.locator('#roster .character-card').count(), 8);
  await page.locator('[data-character="dantas"]').click();
  await page.locator('#selectionP1 [data-action="confirm"]').click();
  await page.locator('[data-character="vini"]').click();
  await page.locator('#selectionP2 [data-action="confirm"]').click();
  assert.equal(await page.locator('#startFight').isEnabled(), true);
  await page.locator('#startFight').click();
  assert.deepEqual(await page.evaluate(() => window.tecFighters.game.combat.fighters.map(f => f.id)), ['dantas', 'vini']);
  await page.waitForTimeout(150);
  await page.keyboard.press('Escape');
  await page.locator('[data-action="menu"]:visible').first().click();
  check('independent character selection starts the requested fighters');

  await page.locator('[data-action="settings"]:visible').first().click();
  await page.locator('[data-setting="masterVolume"]').evaluate(el => { el.value = '0.2'; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); });
  await page.locator('[data-setting="showFPS"]').check();
  const oldWidth = await page.locator('#gameCanvas').evaluate(el => el.width);
  await page.locator('[data-setting="renderScale"]').selectOption('0.5');
  const newWidth = await page.locator('#gameCanvas').evaluate(el => el.width);
  assert.ok(newWidth < oldWidth, 'render scale changes canvas backing resolution');
  await page.locator('[data-bind-player="0"][data-bind-action="heavy"]').click();
  await page.keyboard.press('a');
  assert.match(await page.locator('#bindingNotice').innerText(), /[Cc]onflito/);
  await page.locator('[data-bind-player="0"][data-bind-action="heavy"]').click();
  await page.keyboard.press('h');
  assert.equal(await page.evaluate(() => window.tecFighters.settings.values.bindings[0].heavy), 'KeyH');
  await page.reload();
  await page.waitForFunction(() => !!window.tecFighters);
  const persisted = await page.evaluate(() => window.tecFighters.settings.values);
  assert.equal(persisted.masterVolume, .2);
  assert.equal(persisted.showFPS, true);
  assert.equal(persisted.renderScale, .5);
  assert.equal(persisted.bindings[0].heavy, 'KeyH');
  check('settings affect rendering, reject conflicts and persist after reload');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(100);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no horizontal overflow on phone viewport');
  await page.locator('[data-action="select"]:visible').click();
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'selection has no horizontal overflow');
  await page.waitForTimeout(350);
  await page.screenshot({ path: '/tmp/tec-fighters-mobile.png', fullPage: true });
  check('mobile menu and selection preserve viewport width');

  assert.deepEqual(errors, [], 'browser exceptions');
  assert.deepEqual(failedRequests, [], 'missing or failed resources');
  check('all flows complete without browser exceptions or missing assets');
} catch (error) {
  await page.screenshot({ path: '/tmp/tec-fighters-failure.png', fullPage: true }).catch(() => {});
  console.error('Runtime at failure:', await page.evaluate(() => ({
    screen: window.tecFighters?.ui.screen, bodyHidden: document.body.hidden,
    phase: window.tecFighters?.game.combat?.phase, paused: window.tecFighters?.game.paused
  })).catch(() => null));
  throw error;
} finally {
  await context.close();
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
