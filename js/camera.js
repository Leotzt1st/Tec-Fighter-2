export class Camera {
  constructor() { this.zoom = 1; this.shake = 0; this.cinematic = 0; this.focusX = 640; this.ending = 0; this.focus = 640; }
  impact(strength) { this.shake = Math.max(this.shake, strength === 'special' ? 12 : strength === 'heavy' ? 6 : 2); }
  special(x) { this.cinematic = .65; this.focusX = x; this.shake = 5; }
  celebrate(x) { this.ending = 2.6; this.focusX = x; }
  update(dt) {
    this.ending = Math.max(0, this.ending - dt);
    this.focus += ((this.ending ? this.focusX : 640) - this.focus) * Math.min(1, dt * 5);
    this.cinematic = Math.max(0, this.cinematic - dt);
    const target = this.ending > 0 ? 1.12 : this.cinematic > .3 ? 1.06 : 1;
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
    const targetX = this.ending > 0 ? this.focus : 640;
    // Clamp translation so the arena remains covered; focus shifts towards the winner.
    const tx = Math.max(1280 * (1 - z), Math.min(0, 640 - targetX * z));
    c.translate(tx, 360 * (1 - z)); c.scale(z, z);
    if (settings.shake) c.translate((Math.random() - .5) * this.shake, (Math.random() - .5) * this.shake);
  }
}
