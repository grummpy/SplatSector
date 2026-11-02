import { COLS, ROWS } from "./constants.js";

function wallAt(match, x, y) {
  const c = Math.floor(x);
  const r = Math.floor(y);
  if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return true;
  return match.walls[r * COLS + c] === 1;
}

function nearestInk(match, p) {
  const hereC = Math.floor(p.x);
  const hereR = Math.floor(p.y);
  let best = null;
  let bestScore = Infinity;
  for (let r = hereR - 12; r <= hereR + 12; r++) {
    for (let c = hereC - 12; c <= hereC + 12; c++) {
      if (c < 1 || r < 1 || c >= COLS - 1 || r >= ROWS - 1) continue;
      if (c === hereC && r === hereR) continue;
      const i = r * COLS + c;
      if (match.walls[i]) continue;
      const v = match.paint[i];
      if (v === p.index + 1) continue;
      const x = c + 0.5;
      const y = r + 0.5;
      const d = Math.hypot(x - p.x, y - p.y);
      if (d < 1.1) continue;
      const score = d - (v > 0 ? 2 : 0);
      if (score < bestScore) {
        bestScore = score;
        best = { x, y };
      }
    }
  }
  return best;
}

function nearestEnemy(match, p) {
  let best = null;
  let bestD = Infinity;
  for (const o of match.players) {
    if (o.index === p.index || !o.active || !o.alive) continue;
    const d = Math.hypot(o.x - p.x, o.y - p.y);
    if (d < bestD) {
      bestD = d;
      best = o;
    }
  }
  return best ? { player: best, dist: bestD } : null;
}

function wallBetween(match, a, b) {
  const dist = Math.hypot(b.x - a.x, b.y - a.y);
  const steps = Math.max(1, Math.ceil(dist / 0.45));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (wallAt(match, a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t)) return true;
  }
  return false;
}

function nearestPickup(match, p) {
  let best = null;
  let bestD = 11;
  for (const it of match.pickups) {
    const d = Math.hypot(it.x - p.x, it.y - p.y);
    if (d < bestD) {
      bestD = d;
      best = it;
    }
  }
  return best ? { item: best, dist: bestD } : null;
}

const EMPTY = { moveX: 0, moveY: 0, action: false, secondary: false, aimX: 0, aimY: 0 };

/** One input per player. Human slots are left empty; the sim fills bots only. */
export function decideBots(match) {
  const inputs = [EMPTY, EMPTY, EMPTY, EMPTY].map((e) => ({ ...e }));
  for (const p of match.players) {
    if (!p.active || !p.isBot || !p.alive || p.stun > 0) continue;
    const input = inputs[p.index];
    p.markAge += 1;
    if (p.markAge >= 15) {
      const moved = Math.hypot(p.x - p.markX, p.y - p.markY);
      p.stuck = moved < 0.75 ? p.stuck + 1 : 0;
      p.markX = p.x;
      p.markY = p.y;
      p.markAge = 0;
    }
    if (p.stuck > 1) {
      p.heading = match.rng() * Math.PI * 2;
      p.waypoint = null;
      p.wpLife = 0;
      p.stuck = 0;
    }

    let tx = null;
    let ty = null;
    const pickup = nearestPickup(match, p);
    if (pickup) {
      tx = pickup.item.x;
      ty = pickup.item.y;
    } else if (p.waypoint && p.wpLife > 0 && Math.hypot(p.waypoint.x - p.x, p.waypoint.y - p.y) > 0.7) {
      tx = p.waypoint.x;
      ty = p.waypoint.y;
      p.wpLife -= 1;
    } else {
      const ink = nearestInk(match, p);
      if (ink) {
        p.waypoint = ink;
        p.wpLife = 45;
        tx = ink.x;
        ty = ink.y;
      } else {
        if (p.heading == null) p.heading = match.rng() * Math.PI * 2;
        tx = p.x + Math.cos(p.heading) * 4;
        ty = p.y + Math.sin(p.heading) * 4;
      }
    }
    let dx = tx - p.x;
    let dy = ty - p.y;
    let m = Math.hypot(dx, dy) || 1;
    dx /= m;
    dy /= m;
    if (wallAt(match, p.x + dx * 0.7, p.y + dy * 0.7)) {
      const turn = match.rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
      const fx = dx * Math.cos(turn) - dy * Math.sin(turn);
      const fy = dx * Math.sin(turn) + dy * Math.cos(turn);
      dx = fx;
      dy = fy;
      p.heading = Math.atan2(dy, dx);
    }
    input.moveX = dx;
    input.moveY = dy;

    const enemy = nearestEnemy(match, p);
    if (enemy && enemy.dist < 12 && p.shotCooldown === 0 && !wallBetween(match, p, enemy.player)) {
      input.action = true;
      input.aimX = (enemy.player.x - p.x) / enemy.dist;
      input.aimY = (enemy.player.y - p.y) / enemy.dist;
    }
    if (p.dashCooldown === 0 && p.dash === 0 && enemy && enemy.dist < 7 && match.rng() < 0.04) {
      input.secondary = true;
    }
  }
  return inputs;
}
