import { ANIMATIONS, animationFrame, poseFor } from './animations.js';
import { Camera } from './camera.js';

const WIDTH = 1280, HEIGHT = 720, GROUND = 590;
export class Renderer {
  constructor(canvas, assets, settings) {
    this.canvas = canvas; this.c = canvas.getContext('2d'); this.assets = assets; this.settings = settings;
    this.camera = new Camera(); this.particles = []; this.rings = []; this.trails = [];
    this.time = 0; this.specialTitle = null;
    this.resize = this.resize.bind(this);
    window.addEventListener('resize', this.resize);
    this.renderScale = settings.values.renderScale;
    this.unsubscribe = settings.subscribe(values => {
      if (values.renderScale !== this.renderScale) { this.renderScale = values.renderScale; this.resize(); }
    });
    this.resize();
  }
  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio || 1, 2) * this.settings.values.renderScale;
    this.canvas.width = Math.max(1, Math.round(rect.width * ratio));
    this.canvas.height = Math.max(1, Math.round(rect.height * ratio));
  }
  clear() { this.particles.length = 0; this.rings.length = 0; this.trails.length = 0; this.specialTitle = null; this.camera = new Camera(); }
  event(event, combat) {
    const options = this.settings.values;
    if (event.type === 'special') {
      this.camera.special(event.x);
      const f = combat.fighters[event.player];
      if (f) this.specialTitle = { name: f.char.special.name, color: f.char.color, life: 1.1, side: event.player };
    }
    if (!['hit', 'block', 'parry', 'special'].includes(event.type)) return;
    const x = event.x ?? 640, y = event.y ?? 470;
    const color = event.type === 'block' || event.type === 'parry' ? '#b8f6ff' : event.color || '#ffd791';
    if (event.type === 'hit' || event.type === 'special') this.camera.impact(event.strength);
    if (options.extraEffects) this.rings.push({ x, y, color, life: .3, max: .3, strength: event.strength });
    if (!options.particles) return;
    const count = options.effectsQuality === 'low' ? 8 : event.strength === 'special' ? 36 : 18;
    for (let i = 0; i < count && this.particles.length < 160; i++) {
      const angle = Math.random() * Math.PI * 2, speed = 75 + Math.random() * 320;
      this.particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 80, life: .2 + Math.random() * .35, color, size: 2 + Math.random() * 5 });
    }
  }
  update(dt, combat) {
    this.time += dt; this.camera.update(dt);
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]; p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 500 * dt;
      if (p.life <= 0) this.particles.splice(i, 1);
    }
    for (let i = this.rings.length - 1; i >= 0; i--) { this.rings[i].life -= dt; if (this.rings[i].life <= 0) this.rings.splice(i, 1); }
    for (let i = this.trails.length - 1; i >= 0; i--) { this.trails[i].life -= dt; if (this.trails[i].life <= 0) this.trails.splice(i, 1); }
    if (this.specialTitle && (this.specialTitle.life -= dt) <= 0) this.specialTitle = null;
    if (combat && this.settings.values.extraEffects && Math.floor(this.time * 25) !== Math.floor((this.time - dt) * 25)) {
      for (const fighter of combat.fighters) if (fighter.state === 'special' || fighter.state === 'dodge') {
        this.trails.push({ fighter: { ...fighter }, life: .18 });
      }
    }
  }
  render(combat, paused = false) {
    const { c, canvas } = this;
    // Fit a logical arena into any viewport without stretching sprites or hitboxes.
    c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = '#090c10'; c.fillRect(0, 0, canvas.width, canvas.height);
    const scale = Math.min(canvas.width / WIDTH, canvas.height / HEIGHT);
    c.setTransform(scale, 0, 0, scale, (canvas.width - WIDTH * scale) / 2, (canvas.height - HEIGHT * scale) / 2);
    c.save(); c.beginPath(); c.rect(0, 0, WIDTH, HEIGHT); c.clip();
    this.camera.apply(c, this.settings.values, combat);
    this.drawStage(c);
    if (combat) {
      if (this.camera.cinematic > 0 && this.settings.values.extraEffects) { c.fillStyle = 'rgba(3,8,16,.52)'; c.fillRect(0, 0, WIDTH, HEIGHT); }
      if (this.settings.values.extraEffects) for (const trail of this.trails) this.drawFighter(c, trail.fighter, trail.life * 1.4, true);
      for (const fighter of combat.fighters) this.drawFighter(c, fighter);
      this.drawEffects(c);
    }
    c.restore();
    if (this.specialTitle && this.settings.values.extraEffects) {
      c.save(); c.globalAlpha = Math.min(1, this.specialTitle.life * 4); c.font = 'italic 900 28px sans-serif';
      c.fillStyle = this.specialTitle.color; c.textAlign = this.specialTitle.side ? 'right' : 'left';
      c.fillText(this.specialTitle.name.toUpperCase(), this.specialTitle.side ? 1210 : 70, 216); c.restore();
    }
    if (paused) { c.fillStyle = 'rgba(4,7,12,.3)'; c.fillRect(0, 0, WIDTH, HEIGHT); }
  }
  drawStage(c) {
    const image = this.assets.background;
    if (image) {
      const cover = Math.max(WIDTH / image.width, HEIGHT / image.height);
      const width = image.width * cover, height = image.height * cover;
      c.drawImage(image, (WIDTH - width) / 2, (HEIGHT - height) / 2, width, height);
      c.fillStyle = 'rgba(5,12,24,.30)'; c.fillRect(0, 0, WIDTH, HEIGHT);
    }
    const shade = c.createLinearGradient(0, 0, 0, HEIGHT);
    shade.addColorStop(0, 'rgba(3,8,18,.75)'); shade.addColorStop(.5, 'rgba(3,8,18,0)'); shade.addColorStop(1, 'rgba(3,8,18,.8)');
    c.fillStyle = shade; c.fillRect(0, 0, WIDTH, HEIGHT);
    c.fillStyle = '#0b1018'; c.fillRect(0, GROUND + 10, WIDTH, HEIGHT - GROUND);
    c.fillStyle = '#28343e'; c.fillRect(0, GROUND + 10, WIDTH, 3);
    c.strokeStyle = 'rgba(179,207,215,.1)'; c.lineWidth = 1;
    for (let x = -600; x < 2000; x += 140) { c.beginPath(); c.moveTo(640 + (x - 640) * .8, GROUND + 14); c.lineTo(x, HEIGHT); c.stroke(); }
    c.fillStyle = '#53616b'; c.font = 'bold 11px monospace'; c.textAlign = 'center';
    c.fillText('TEC DISTRICT  /  ARENA 02', 640, 676);
    if (this.settings.values.extraEffects) {
      for (let i = 0; i < 9; i++) {
        const x = (i * 173 + this.time * (7 + i)) % WIDTH;
        const y = 100 + (i * 71) % 470 + Math.sin(this.time + i) * 14;
        c.fillStyle = `rgba(210,227,203,${.1 + Math.sin(this.time + i) * .06})`; c.fillRect(x, y, 2, 2);
      }
    }
  }
  drawFighter(c, fighter, opacity = 1, trail = false) {
    const sheets = this.assets.characters.get(fighter.char.id); if (!sheets) return;
    const animation = ANIMATIONS[fighter.state] || ANIMATIONS.idle;
    const sheet = sheets[fighter.state] || sheets[animation.sheet] || sheets.idle;
    const frame = animationFrame(fighter, sheet);
    const pose = poseFor(fighter, this.time);
    const knocked = fighter.state === 'ko' || fighter.state === 'defeat';
    if (!trail) {
      c.save(); c.globalAlpha = .4; c.fillStyle = '#000'; c.beginPath();
      c.ellipse(fighter.x, GROUND + 3, knocked ? 72 : 48, 10, 0, 0, Math.PI * 2); c.fill(); c.restore();
    }
    c.save(); c.globalAlpha = opacity * pose.alpha;
    c.translate(fighter.x + pose.x, fighter.y + pose.y);
    c.scale(fighter.facing, 1); c.rotate(pose.rotation); c.scale(pose.sx, pose.sy);
    if (fighter.state === 'special' && this.settings.values.extraEffects) this.drawSpecial(c, fighter);
    const frameWidth = sheet.image.width / sheet.frames;
    // Original art is 450x550 with transparent headroom and faces left.
    const spriteScale = .72, w = frameWidth * spriteScale, h = sheet.image.height * spriteScale;
    c.scale(-1, 1);
    if ((fighter.state === 'hurt' || fighter.state === 'special') && this.settings.values.extraEffects) {
      c.shadowColor = fighter.state === 'hurt' ? '#ffffff' : fighter.char.color;
      c.shadowBlur = this.settings.values.effectsQuality === 'high' ? 20 : 0;
    }
    c.drawImage(sheet.image, frame * frameWidth, 0, frameWidth, sheet.image.height, -w / 2, -h, w, h);
    c.restore();
    if (fighter.state === 'guard') {
      c.save(); c.strokeStyle = '#b0e7f5'; c.lineWidth = 3; c.globalAlpha = .65;
      c.beginPath(); c.ellipse(fighter.x + fighter.facing * 43, fighter.y - 100, 18, 74, 0, -Math.PI / 2, Math.PI / 2); c.stroke(); c.restore();
    }
  }
  drawSpecial(c, fighter) {
    const t = fighter.stateTime || 0, kind = fighter.char.special.kind;
    c.save(); c.strokeStyle = fighter.char.color; c.fillStyle = fighter.char.color; c.lineWidth = 4;
    c.globalAlpha *= .65;
    switch (kind) {
      case 'cyclone':
        for (let i = 0; i < 3; i++) { c.beginPath(); c.ellipse(10, -45 - i * 60, 100 + i * 12, 18, t * 8, 0, Math.PI * 1.6); c.stroke(); } break;
      case 'rise':
        for (let i = 0; i < 5; i++) { c.beginPath(); c.moveTo(-50 + i * 23, 0); c.lineTo(i * 20, -180 - Math.sin(t * 12 + i) * 40); c.stroke(); } break;
      case 'crush':
        c.lineWidth = 9; c.beginPath(); c.arc(0, -70, 100, -Math.PI + t * 4, t * 4); c.stroke(); break;
      case 'pulse': case 'wave':
        for (let i = 0; i < 3; i++) { c.beginPath(); c.ellipse(55 + i * 35, -100, 24 + Math.sin(t * 15 + i) * 10, 65 - i * 12, -.2, -Math.PI / 2, Math.PI / 2); c.stroke(); } break;
      case 'flurry':
        for (let i = 0; i < 5; i++) { const y = -160 + i * 24; c.fillRect(40 + Math.sin(t * 40 + i) * 20, y, 55, 3); } break;
      case 'blink':
        c.setLineDash([12, 12]); c.lineDashOffset = -t * 160; c.strokeRect(-65, -220, 130, 220); break;
      default:
        for (let i = 0; i < 5; i++) { c.beginPath(); c.moveTo(-160 - i * 10, -50 - i * 30); c.lineTo(50, -80 - i * 20); c.stroke(); }
    }
    c.restore();
  }
  drawEffects(c) {
    if (this.settings.values.extraEffects) for (const ring of this.rings) {
      const progress = 1 - ring.life / ring.max;
      c.save(); c.translate(ring.x, ring.y); c.strokeStyle = ring.color; c.lineWidth = 4 * (1 - progress); c.globalAlpha = 1 - progress;
      c.beginPath(); c.arc(0, 0, 8 + progress * (ring.strength === 'special' ? 110 : 60), 0, Math.PI * 2); c.stroke();
      for (let i = 0; i < 8; i++) { c.rotate(Math.PI / 4); c.fillStyle = ring.color; c.fillRect(12 + progress * 24, -2, 15 * (1 - progress), 4); } c.restore();
    }
    if (this.settings.values.particles) for (const p of this.particles) { c.globalAlpha = Math.min(1, p.life * 4); c.fillStyle = p.color; c.fillRect(p.x, p.y, p.size, p.size); }
    c.globalAlpha = 1;
  }
  destroy() { window.removeEventListener('resize', this.resize); this.unsubscribe(); }
}
