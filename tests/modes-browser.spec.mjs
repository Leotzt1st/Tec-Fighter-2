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
await context.addInitScript(() => {
  window.__pads = [];
  Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => window.__pads });
});
const page = await context.newPage();
page.on('pageerror', error => errors.push(error.message));
page.on('response', response => { if (response.status() >= 400) failedRequests.push(`${response.status()} ${response.url()}`); });
page.on('requestfailed', request => failedRequests.push(`${request.failure()?.errorText} ${request.url()}`));
const check = name => console.log(`PASS ${name}`);

const boot = async () => {
  await page.goto(url);
  await page.waitForFunction(() => !!window.tecFighters);
};
const selectMode = async (mode, character = 'leo', difficulty = 'normal') => {
  await page.evaluate(() => window.tecFighters.game.menu());
  await page.locator('[data-action="play"]').click();
  await page.locator('#difficulty').selectOption(difficulty);
  await page.locator(`[data-action="choose-mode"][data-mode="${mode}"]`).click();
  await page.locator(`[data-character="${character}"]`).click();
  await page.locator('#selectionP1 [data-action="confirm"]').click();
  if (mode === 'versus') await page.locator('#selectionP2 [data-action="confirm"]').click();
  await page.locator('#startFight').click();
  await page.waitForFunction(() => window.tecFighters.game.combat?.phase === 'fight');
};
const prepareWinner = async (winner = 0, health = 47, energy = 63, fast = true) => {
  await page.evaluate(({winner,health,energy,fast}) => {
    const game = window.tecFighters.game, combat = game.combat;
    combat.phase = 'fight'; combat.phaseTime = 0; combat.timeLeft = 40; combat.hitstop = 0;
    combat.fighters.forEach((f,i) => { f.reset(500 + i * 120); });
    combat.fighters[winner].health = health; combat.fighters[winner].energy = energy;
    combat.fighters[1-winner].health = 0;
    if (combat.roundsToWin !== 1) combat.wins[winner] = 1;
    combat.endRound();
    // Preserve the final animation delay, but skip the already-covered round result wait.
    if (fast) combat.phaseTime = 3;
  }, {winner,health,energy,fast});
  if (fast) await page.waitForFunction(() => window.tecFighters.game.combat.phase === 'matchOver');
};
const waitResult = async () => page.waitForFunction(() => ['intermission','campaignResult','result'].includes(window.tecFighters.ui.screen));
const nextBattle = async () => {
  await page.locator('[data-action="next-battle"]').click();
  await page.waitForFunction(() => window.tecFighters.game.combat.phase === 'intro');
};
try {
  await boot();
  await selectMode('single','dantas','hard');
  assert.equal(await page.evaluate(() => window.tecFighters.game.session.mode), 'single');
  assert.equal(await page.evaluate(() => window.tecFighters.game.combat.fighters[0].id), 'dantas');
  assert.notEqual(await page.evaluate(() => window.tecFighters.game.combat.fighters[1].id), 'dantas');
  const beforeAI = await page.evaluate(() => window.tecFighters.game.combat.fighters[1].x);
  await page.waitForTimeout(700);
  assert.notEqual(await page.evaluate(() => window.tecFighters.game.combat.fighters[1].x), beforeAI, 'AI actually approaches without human input');
  await page.evaluate(() => {
    const game=window.tecFighters.game;
    game.__aiSample=game.ai.sample;
    game.ai.sample=()=>({});
    const f=game.combat.fighters[1];f.x=900;f.vx=0;f.move=null;f.stun=0;
  });
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(200);
  await page.keyboard.up('ArrowRight');
  assert.equal(await page.evaluate(() => window.tecFighters.game.combat.fighters[1].x), 900, 'P2 keyboard is ignored for CPU opponent');
  check('Single Player chooses a CPU opponent, uses AI and isolates P2 keyboard');

  await prepareWinner(0,47,63,false);
  const animationStart = Date.now();
  assert.equal(await page.evaluate(() => window.tecFighters.ui.screen), 'game', 'result waits for victory animation');
  const endingState = await page.evaluate(() => window.tecFighters.game.combat.fighters.map(f=>({state:f.state,health:f.health,x:f.x})));
  await page.keyboard.press('Space');await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(800);
  assert.equal(await page.evaluate(() => window.tecFighters.ui.screen), 'game');
  assert.deepEqual(await page.evaluate(() => window.tecFighters.game.combat.fighters.map(f=>({state:f.state,health:f.health,x:f.x}))), endingState, 'endings reject movement and attacks');
  await waitResult();
  assert.ok(Date.now()-animationStart>=2400, 'victory pose receives its full presentation interval');
  await page.screenshot({path:'/tmp/tec-modes-result.png'});
  check('exclusive endings finish before result options and freeze combat inputs');

  await selectMode('arcade','leo','easy');
  const seen=[];
  const total=await page.evaluate(()=>window.tecFighters.game.session.total);
  assert.equal(total,7);
  for(let battle=0;battle<total;battle++) {
    const opponent=await page.evaluate(()=>window.tecFighters.game.combat.fighters[1].id);
    assert.notEqual(opponent,'leo');assert.ok(!seen.includes(opponent));seen.push(opponent);
    await prepareWinner(0,43,77);await waitResult();
    if(battle+1<total) {
      assert.equal(await page.evaluate(()=>window.tecFighters.ui.screen),'intermission');
      await nextBattle();
      assert.ok(await page.evaluate(()=>{const f=window.tecFighters.game.combat.fighters[0];return f.health===f.maxHealth&&f.energy===0;}),'Arcade restores resources');
    }
  }
  assert.equal(await page.evaluate(()=>window.tecFighters.ui.screen),'campaignResult');
  assert.equal(await page.evaluate(()=>window.tecFighters.game.session.complete),true);
  assert.match(await page.locator('#panelBody').innerText(),/ARCADE COMPLETED/);
  check('Arcade completes all seven distinct opponents, excludes self and resets resources');

  await selectMode('infinite','gui','normal');
  await prepareWinner(0,37,81);await waitResult();await nextBattle();
  const transfer=await page.evaluate(()=>{const f=window.tecFighters.game.combat.fighters[0];return {health:f.health,maxHealth:f.maxHealth,energy:f.energy};});
  assert.equal(transfer.health,Math.min(transfer.maxHealth,37+transfer.maxHealth*.35));
  assert.equal(transfer.energy,81);
  check('Infinite heals 35% of maximum health after a win and transfers special energy');

  for(const [wins,rank] of [[4,'silver'],[9,'gold'],[19,'diamond'],[29,'legend']]) {
    await page.evaluate(wins=>{window.tecFighters.game.session.wins=wins;},wins);
    await prepareWinner(0,37,81);await waitResult();
    assert.equal(await page.evaluate(()=>window.tecFighters.game.session.summary().rank.id),rank);
    assert.equal(await page.evaluate(()=>window.tecFighters.ui.screen),'intermission');
    assert.match(await page.locator('#panelBody').innerText(),/CLASSIFICAÇÃO AUMENTADA/);
    const badge=await page.locator('#panelBody img').first().getAttribute('src');assert.ok(badge.includes(rank));
    if(rank!=='legend') await nextBattle();
  }
  check('all four rank promotions display their exclusive emblem at exact streak thresholds');
  await nextBattle();
  await page.evaluate(()=>{window.tecFighters.game.session.maxCombo=6;});
  await prepareWinner(1,75,0);await waitResult();
  assert.equal(await page.evaluate(()=>window.tecFighters.ui.screen),'campaignResult');
  assert.match(await page.locator('#panelBody').innerText(),/GAME OVER/);
  const saved=await page.evaluate(()=>window.tecFighters.records.get());
  assert.ok(saved.best.wins>=30);assert.equal(saved.history[0].maxCombo,6);assert.equal(saved.best.rank.id,'legend');
  await page.reload();await page.waitForFunction(()=>!!window.tecFighters);
  assert.equal(await page.evaluate(()=>window.tecFighters.records.get().best.wins),saved.best.wins);
  await page.evaluate(()=>window.tecFighters.ui.showRecords(window.tecFighters.records.get()));
  assert.match(await page.locator('#panelBody').innerText(),/GUI|Gui/);
  check('Infinite defeat saves score, streak, rank, character and combo history across reload');

  await page.evaluate(() => {
    const app=window.tecFighters;
    app.game.menu();
    window.__pads=[{connected:true,index:0,id:'QA Standard Gamepad',mapping:'standard',axes:[0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))}];
  });
  await page.waitForTimeout(100);
  await page.locator('[data-action="play"]').focus();
  await page.evaluate(()=>{window.__pads[0].buttons[0]={pressed:true,value:1};});
  await page.waitForFunction(()=>window.tecFighters.ui.screen==='modes');
  await page.evaluate(()=>{window.__pads[0].buttons[0]={pressed:false,value:0};});
  await page.evaluate(()=>{
    window.tecFighters.settings.setPadPlayer(0,1);
    window.tecFighters.game.start(['leo','caio']);
  });
  await page.waitForFunction(()=>window.tecFighters.game.combat.phase==='fight');
  await page.keyboard.down('a');
  await page.evaluate(()=>{window.__pads[0].axes[0]=1;});
  await page.waitForTimeout(200);
  assert.ok(await page.evaluate(()=>{const [a,b]=window.tecFighters.game.combat.fighters;return a.x<390&&b.x>890;}),'keyboard P1 and assigned gamepad P2 move independently');
  await page.keyboard.up('a');
  await page.evaluate(()=>{window.__pads[0].axes[0]=0;window.__pads=[];});
  await page.waitForFunction(()=>window.tecFighters.game.paused);
  check('gamepad confirms menus, supports mixed keyboard/P2 assignment and pauses on disconnect');
  await page.locator('[data-action="settings"]:visible').click();
  await page.evaluate(()=>{window.__pads=[{connected:true,index:0,id:'QA Standard Gamepad',mapping:'standard',axes:[0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))}];});
  await page.waitForTimeout(100);
  await page.locator('[data-pad-bind-player="1"][data-pad-bind-action="light"]').click();
  await page.evaluate(()=>{window.__pads[0].buttons[6]={pressed:true,value:1};});
  await page.waitForFunction(()=>window.tecFighters.settings.values.padBindings[1].light===6);
  await page.evaluate(()=>{window.__pads[0].buttons[6]={pressed:false,value:0};});
  await page.keyboard.press('Escape');
  await page.locator('[data-action="resume"]').click();
  await page.evaluate(()=>{
    const c=window.tecFighters.game.combat;c.phase='fight';c.hitstop=0;
    c.fighters.forEach((f,i)=>f.reset(500+i*120));
  });
  await page.waitForTimeout(100);
  await page.evaluate(()=>{window.__pads[0].buttons[6]={pressed:true,value:1};});
  await page.waitForFunction(()=>{const f=window.tecFighters.game.combat.fighters[0];return f.health<f.maxHealth;});
  await page.evaluate(()=>{window.__pads[0].buttons[6]={pressed:false,value:0};});
  check('physical button remapping through settings produces the requested in-game attack');

  assert.deepEqual(errors,[],'no browser exceptions');
  assert.deepEqual(failedRequests,[],'no missing resources');
  check('new modes complete without browser exceptions or asset failures');
} catch(error) {
  await page.screenshot({path:'/tmp/tec-modes-failure.png',fullPage:true}).catch(()=>{});
  console.error('Modes runtime at failure:',await page.evaluate(()=>({screen:window.tecFighters?.ui.screen,phase:window.tecFighters?.game.combat?.phase,session:window.tecFighters?.game.session?.summary()})).catch(()=>null));
  throw error;
} finally {
  await context.close();await browser.close();await new Promise(resolve=>server.close(resolve));
}
