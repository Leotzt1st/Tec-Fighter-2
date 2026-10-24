export class Camera {
  constructor() { this.zoom = 1; this.shake = 0; this.cinematic = 0; this.focusX = 640; }
  impact(strength) { this.shake = Math.max(this.shake, strength === 'special' ? 12 : strength === 'heavy' ? 6 : 2); }
  special(x) { this.cinematic = .65; this.focusX = x; this.shake = 5; }
  update(dt) {
    this.cinematic = Math.max(0, this.cinematic - dt);
    const target = this.cinematic > .3 ? 1.06 : 1;
    this.zoom += (target - this.zoom) * Math.min(1, dt * 12);
    this.shake *= Math.exp(-dt * 15);
  }
  apply(c, settings, combat) {
    let z = settings.extraEffects ? this.zoom : 1;
    if (combat) {
      const edgeSpace = Math.min(...combat.fighters.map(f => Math.min(f.x - 100, 1280 - f.x - 100)));
      z = Math.min(z, 1 + Math.max(0, edgeSpace) / 640);
    }
    // A modest center zoom keeps both fighters safely within the arena.
    c.translate(640, 360); c.scale(z, z); c.translate(-640, -360);
    if (settings.shake) c.translate((Math.random() - .5) * this.shake, (Math.random() - .5) * this.shake);
  }
}
