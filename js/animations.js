/** As poses derivadas usam os sprites originais; substitua sheet/frames para adicionar arte final. */
export const ANIMATIONS = Object.freeze({
  idle: { sheet: 'idle', fps: 6, loop: true },
  walk: { sheet: 'walk', fps: 11, loop: true },
  jump: { sheet: 'idle', fps: 1 },
  fall: { sheet: 'idle', fps: 1 },
  land: { sheet: 'idle', fps: 1 },
  light: { sheet: 'attack', fps: 16 },
  heavy: { sheet: 'attack', fps: 9 },
  special: { sheet: 'attack', fps: 13 },
  guard: { sheet: 'attack', frame: 1 },
  hurt: { sheet: 'idle', fps: 1 },
  dodge: { sheet: 'walk', fps: 16, loop: true },
  ko: { sheet: 'idle', fps: 1 },
  defeat: { sheet: 'idle', fps: 1 },
  victory: { sheet: 'attack', frame: 2 }
});

// Optional per-character final artwork. Keys match a character id and state.
// Example: leo: { victory: { src: './assets/characters/leo/victory.png', frames: 6, fps: 10 } }
export const SPRITE_OVERRIDES = {};

export function poseFor(fighter, time) {
  const t = fighter.stateTime || 0;
  const pose = { x: 0, y: 0, sx: 1, sy: 1, rotation: 0, alpha: 1 };
  switch (fighter.state) {
    case 'idle': pose.sy += Math.sin(time * 3.3) * .014; pose.sx -= Math.sin(time * 3.3) * .007; break;
    case 'walk': pose.y = -Math.abs(Math.sin(t * 17)) * 3; pose.rotation = .025; break;
    case 'jump': pose.sx = .95; pose.sy = 1.045; pose.rotation = -.06; break;
    case 'fall': pose.sx = 1.035; pose.sy = .97; pose.rotation = .055; break;
    case 'land': pose.sx = 1 + Math.max(0, 1 - t / .14) * .13; pose.sy = 1 - Math.max(0, 1 - t / .14) * .13; break;
    case 'light': pose.rotation = Math.sin(Math.min(1, t / .27) * Math.PI) * .09; break;
    case 'heavy': pose.rotation = Math.sin(Math.min(1, t / .48) * Math.PI) * .17; pose.sx = 1.06; break;
    case 'guard': pose.sy = .93; pose.rotation = -.07; break;
    case 'hurt': pose.rotation = -.15; pose.sx = .95; break;
    case 'dodge': pose.sy = .70; pose.sx = 1.13; pose.alpha = .58; pose.rotation = .12; break;
    case 'special': {
      const kind = fighter.char.special.kind;
      pose.rotation = kind === 'cyclone' ? Math.sin(t * 28) * .28 : kind === 'rise' ? -.18 : .12;
      pose.sx = kind === 'crush' ? 1.17 : 1.06;
      pose.sy = kind === 'rise' ? 1.12 : kind === 'crush' ? .93 : 1.03;
      pose.y = kind === 'pulse' || kind === 'wave' ? -Math.abs(Math.sin(t * 12)) * 8 : 0;
      if (kind === 'blink') pose.alpha = .4 + Math.abs(Math.sin(t * 24)) * .6;
      break;
    }
    case 'ko': case 'defeat': pose.rotation = -Math.min(1, t * 3) * Math.PI / 2; pose.y = -6; break;
    case 'victory': pose.y = -Math.abs(Math.sin(t * 5)) * 10; pose.sy = 1.04; break;
  }
  return pose;
}

export function animationFrame(fighter, sheet) {
  const animation = ANIMATIONS[fighter.state] || ANIMATIONS.idle;
  if (sheet.override) {
    const frame = Math.floor((fighter.stateTime || 0) * (sheet.fps || 10));
    return animation.loop || sheet.loop ? frame % sheet.frames : Math.min(frame, sheet.frames - 1);
  }
  if (animation.frame !== undefined) return Math.min(animation.frame, sheet.frames - 1);
  if (fighter.move && ['light', 'heavy', 'special'].includes(fighter.state)) {
    // Anticipation, contact, recovery match the model's exact active window.
    const move = fighter.move;
    if (move.elapsed < move.startup) return 0;
    if (move.elapsed < move.startup + move.active) return Math.min(2, sheet.frames - 1);
    return Math.min(1, sheet.frames - 1);
  }
  const frame = Math.floor((fighter.stateTime || 0) * (sheet.fps || animation.fps || 8));
  return animation.loop ? frame % sheet.frames : Math.min(frame, sheet.frames - 1);
}
