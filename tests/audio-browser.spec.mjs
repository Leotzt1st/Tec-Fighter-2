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
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.mp3': 'audio/mpeg', '.ico': 'image/x-icon', '.svg': 'image/svg+xml' };
const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const path = resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
    if (path !== root && !path.startsWith(root + sep)) {
      res.writeHead(403).end();
      return;
    }
    const body = await readFile(path);
    res.writeHead(200, { 'Content-Type': types[extname(path)] || 'application/octet-stream', 'Cache-Control': 'no-store', 'Content-Length': body.length }).end(body);
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

try {
  await page.goto(url);
  await page.waitForFunction(() => !!window.tecFighters);
  await page.locator('[data-action="play"]').click();
  const playing = async name => {
    await page.waitForFunction(name => {
      const a = window.tecFighters.audio, e = a.musicElement;
      return e && e.currentSrc.endsWith(name) && !e.paused && e.currentTime > .05 && e.readyState >= 2;
    }, name);
    assert.equal(await page.evaluate(() => window.tecFighters.audio.musicError), null);
  };
  await playing('MenuTF.mp3');
  assert.equal(await page.evaluate(() => window.tecFighters.audio.musicElement.loop), true);
  check('MenuTF decodes and plays after a user gesture');
  for (const mode of ['versus', 'single', 'arcade', 'infinite']) {
    await page.evaluate(mode => window.tecFighters.game.start({ ids: ['leo','caio'], mode }), mode);
    await playing(mode === 'infinite' ? 'TecFightersInfinito.mp3' : 'Storymode.mp3');
    assert.equal(await page.evaluate(() => [...window.tecFighters.audio.tracks.values()].filter(t => !t.element.paused).length), 1);
  }
  check('all four modes select the requested track without overlapping music');
  await page.evaluate(() => window.tecFighters.game.pause());
  const frozen = await page.evaluate(() => window.tecFighters.audio.musicElement.currentTime);
  await page.waitForTimeout(250);
  assert.equal(await page.evaluate(() => window.tecFighters.audio.musicElement.paused), true);
  assert.ok(Math.abs(await page.evaluate(() => window.tecFighters.audio.musicElement.currentTime) - frozen) < .05);
  await page.evaluate(() => window.tecFighters.game.resume());
  await playing('TecFightersInfinito.mp3');
  assert.ok(await page.evaluate(t => window.tecFighters.audio.musicElement.currentTime >= t, frozen));
  check('pause stops playback and resume preserves the playhead and Infinite track');
  await page.evaluate(() => {
    const s = window.tecFighters.settings;
    s.set('masterVolume', .4); s.set('musicVolume', .3); s.set('sfxVolume', .6); s.set('muted', true);
  });
  await page.waitForTimeout(200);
  assert.ok(await page.evaluate(() => window.tecFighters.audio.master.gain.value < .001));
  await page.evaluate(() => { window.tecFighters.settings.set('muted', false); window.tecFighters.audio.play('victory'); });
  await page.waitForTimeout(200);
  const gains = await page.evaluate(() => {
    const a = window.tecFighters.audio;
    return [a.master.gain.value, a.music.gain.value, a.sfx.gain.value];
  });
  for (const [index,expected] of [.4,.3,.6].entries()) assert.ok(Math.abs(gains[index]-expected) < .002, `gain ${index}: ${gains[index]} expected ${expected}`);
  check('master, music, effects and mute controls still operate on the actual audio mixer');
  // Seek close to the end to exercise real HTMLMediaElement looping.
  const duration = await page.evaluate(() => {
    const e = window.tecFighters.audio.musicElement; e.currentTime = e.duration - .15; return e.duration;
  });
  assert.ok(duration > 1);
  await page.waitForFunction(() => window.tecFighters.audio.musicElement.currentTime < 2);
  check('the supplied MP3 loops at its actual end');
  await page.evaluate(() => window.tecFighters.game.menu());
  await playing('MenuTF.mp3');
  // Fast pause/resume must not leave a pending play promise stuck.
  await page.evaluate(() => {
    const g = window.tecFighters.game; g.start({ ids: ['leo','caio'], mode: 'infinite' }); g.pause(); g.resume();
  });
  await playing('TecFightersInfinito.mp3');
  await page.evaluate(() => window.tecFighters.game.menu());
  await playing('MenuTF.mp3');
  assert.equal(await page.evaluate(() => window.tecFighters.audio.tracks.size), 3);
  assert.equal(await page.evaluate(() => [...window.tecFighters.audio.tracks.values()].filter(t => !t.element.paused).length), 1);
  check('rapid transitions reuse exactly three tracks and return to menu music');
  await page.evaluate(() => window.tecFighters.audio.destroy());
  assert.equal(await page.evaluate(() => window.tecFighters.audio.tracks.size), 0);
  assert.deepEqual(errors, []);
  assert.deepEqual(failedRequests, []);
  check('cleanup and all playback checks finish without browser exceptions or missing media');
} finally {
  await context.close(); await browser.close(); await new Promise(resolve => server.close(resolve));
}
