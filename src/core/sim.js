import {
  BASE_SPEED,
  BOMB_KO_R,
  BOMB_R,
  COLS,
  DASH_COOLDOWN_FRAMES,
  DASH_FRAMES,
  DASH_PAINT_R,
  DASH_SPEED,
  DIRECT_HIT_R,
  DT,
  ENEMY_MUL,
  FPS,
  INKSTORM_FRAMES,
  INVULN_FRAMES,
  MAX_PICKUPS,
  OWN_MUL,
  PICKUP_EVERY_FRAMES,
  PICKUP_R,
  PLAYER_COUNT,
  PLAYER_R,
  PROJ_LIFE_FRAMES,
  PROJ_SPEED,
  RESPAWN_FRAMES,
  ROUND_END_FRAMES,
  ROUND_FRAMES,
  ROUNDS_TO_WIN,
  ROWS,
  SHOT_COOLDOWN_FRAMES,
  SPEED_FRAMES,
  SPEED_MUL,
  SPLASH_R,
  STORM_PAINT_R,
  STUN_FRAMES,
} from "./constants.js";
import { decideBots } from "./bots.js";
import { makeRng } from "./rng.js";

const PICKUP_TYPES = ["bomb", "speed", "inkstorm"];

const CORNERS = [
  { x: 2.5, y: 2.5 },
  { x: COLS - 2.5, y: 2.5 },
  { x: 2.5, y: ROWS - 2.5 },
  { x: COLS - 2.5, y: ROWS - 2.5 },
];

function buildWalls() {
  const w = new Uint8Array(COLS * ROWS);
  const set = (c, r) => {
    if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return;
    w[r * COLS + c] = 1;
  };
  for (let c = 0; c < COLS; c++) {
    set(c, 0);
    set(c, ROWS - 1);
  }
  for (let r = 0; r < ROWS; r++) {
    set(0, r);
    set(COLS - 1, r);
  }
  const box = (c0, r0, c1, r1) => {
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) set(c, r);
    }
  };
  // Cover that stays off row 5 and column 5 so tests have open lanes.
  box(14, 8, 18, 13);
  box(COLS - 1 - 18, 8, COLS - 1 - 14, 13);
  box(14, ROWS - 1 - 13, 18, ROWS - 1 - 8);
  box(COLS - 1 - 18, ROWS - 1 - 13, COLS - 1 - 14, ROWS - 1 - 8);
  box(30, 8, 33, 14);
  box(30, ROWS - 1 - 14, 33, ROWS - 1 - 8);
  box(22, 18, 27, 21);
  box(36, 18, 41, 21);
  box(31, 15, 32, 17);
  box(31, 22, 32, 24);
  return w;
}

function paintCell(match, c, r, owner) {
  if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return;
  const i = r * COLS + c;
  if (match.walls[i]) return;
  match.paint[i] = owner;
}

function paintCircle(match, x, y, radius, owner) {
  const r2 = radius * radius;
  const c0 = Math.max(0, Math.floor(x - radius));
  const c1 = Math.min(COLS - 1, Math.floor(x + radius));
  const r0 = Math.max(0, Math.floor(y - radius));
  const r1 = Math.min(ROWS - 1, Math.floor(y + radius));
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      const dx = c + 0.5 - x;
      const dy = r + 0.5 - y;
      if (dx * dx + dy * dy <= r2) paintCell(match, c, r, owner);
    }
  }
}

function paintPad(match, x, y, owner) {
  const c0 = Math.floor(x);
  const r0 = Math.floor(y);
  for (let r = r0 - 1; r <= r0 + 1; r++) {
    for (let c = c0 - 1; c <= c0 + 1; c++) paintCell(match, c, r, owner);
  }
}

/** Paint the cell just left, plus a one-cell perpendicular smear. Never the cell now occupied. */
function paintTrail(match, oldC, oldR, newC, newR, owner) {
  paintCell(match, oldC, oldR, owner);
  if (newC !== oldC && newR === oldR) {
    paintCell(match, oldC, oldR - 1, owner);
    paintCell(match, oldC, oldR + 1, owner);
  } else if (newR !== oldR && newC === oldC) {
    paintCell(match, oldC - 1, oldR, owner);
    paintCell(match, oldC + 1, oldR, owner);
  }
}

function wallAt(match, x, y) {
  const c = Math.floor(x);
  const r = Math.floor(y);
  if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return true;
  return match.walls[r * COLS + c] === 1;
}

function hitsWall(match, x, y, radius) {
  if (wallAt(match, x, y)) return true;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    if (wallAt(match, x + Math.cos(a) * radius, y + Math.sin(a) * radius)) return true;
  }
  return false;
}

function tryMove(match, p, dx, dy) {
  if (!hitsWall(match, p.x + dx, p.y, PLAYER_R)) p.x += dx;
  if (!hitsWall(match, p.x, p.y + dy, PLAYER_R)) p.y += dy;
}

function cellValue(match, x, y) {
  const c = Math.floor(x);
  const r = Math.floor(y);
  if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return 0;
  const i = r * COLS + c;
  if (match.walls[i]) return 0;
  return match.paint[i];
}

function speedFor(match, p) {
  const owner = cellValue(match, p.x, p.y);
  let mul = 1;
  if (owner === p.index + 1) mul = OWN_MUL;
  else if (owner > 0) mul = ENEMY_MUL;
  if (p.inkstorm > 0) mul = Math.max(mul, OWN_MUL);
  if (p.speed > 0) mul *= SPEED_MUL;
  return BASE_SPEED * mul;
}

function makePlayer(corner, index, active, isBot) {
  const dx = COLS / 2 - corner.x;
  const dy = ROWS / 2 - corner.y;
  const m = Math.hypot(dx, dy) || 1;
  return {
    index,
    active,
    isBot,
    x: corner.x,
    y: corner.y,
    cornerX: corner.x,
    cornerY: corner.y,
    facingX: dx / m,
    facingY: dy / m,
    alive: active,
    stun: 0,
    respawn: 0,
    invuln: 0,
    dash: 0,
    dashCooldown: 0,
    speed: 0,
    inkstorm: 0,
    shotCooldown: 0,
    roundsWon: 0,
    kos: 0,
    prevC: Math.floor(corner.x),
    prevR: Math.floor(corner.y),
    heading: null,
    botCool: 0,
    stuck: 0,
    markX: corner.x,
    markY: corner.y,
    markAge: 0,
    waypoint: null,
    wpLife: 0,
  };
}

function revive(match, p) {
  p.alive = true;
  p.invuln = INVULN_FRAMES;
  p.stun = 0;
  p.dash = 0;
  p.x = p.cornerX;
  p.y = p.cornerY;
  p.prevC = Math.floor(p.x);
  p.prevR = Math.floor(p.y);
  paintPad(match, p.x, p.y, p.index + 1);
}

function ko(match, p) {
  if (!p.alive || p.invuln > 0) return;
  p.alive = false;
  p.respawn = RESPAWN_FRAMES;
  p.stun = 0;
  p.dash = 0;
  p.kos += 1;
  p.x = p.cornerX;
  p.y = p.cornerY;
  p.prevC = Math.floor(p.x);
  p.prevR = Math.floor(p.y);
}

function canAffect(p, owner) {
  return p.active && p.alive && p.invuln <= 0 && p.index !== owner;
}

function explode(match, x, y, owner, splash, koRadius) {
  paintCircle(match, x, y, splash, owner + 1);
  for (const p of match.players) {
    if (!canAffect(p, owner)) continue;
    const d = Math.hypot(p.x - x, p.y - y);
    if (d <= koRadius) ko(match, p);
    else if (d <= splash) {
      p.stun = Math.max(p.stun, STUN_FRAMES);
      p.dash = 0;
    }
  }
}

function fire(match, p, input) {
  let fx = input.aimX || 0;
  let fy = input.aimY || 0;
  if (fx === 0 && fy === 0) {
    fx = p.facingX;
    fy = p.facingY;
  }
  const m = Math.hypot(fx, fy) || 1;
  fx /= m;
  fy /= m;
  p.facingX = fx;
  p.facingY = fy;
  p.shotCooldown = SHOT_COOLDOWN_FRAMES;
  match.projectiles.push({
    x: p.x + fx * 0.6,
    y: p.y + fy * 0.6,
    vx: fx * PROJ_SPEED,
    vy: fy * PROJ_SPEED,
    owner: p.index,
    life: PROJ_LIFE_FRAMES,
  });
}

function applyPickup(match, p, type) {
  if (type === "speed") p.speed = SPEED_FRAMES;
  else if (type === "inkstorm") p.inkstorm = INKSTORM_FRAMES;
  else if (type === "bomb") explode(match, p.x, p.y, p.index, BOMB_R, BOMB_KO_R);
}

function collectAll(match) {
  if (match.pickups.length === 0) return;
  const remaining = [];
  for (const it of match.pickups) {
    let taken = false;
    for (const p of match.players) {
      if (!p.active || !p.alive || p.stun > 0) continue;
      if (Math.hypot(it.x - p.x, it.y - p.y) <= PICKUP_R) {
        applyPickup(match, p, it.type);
        taken = true;
        break;
      }
    }
    if (!taken) remaining.push(it);
  }
  match.pickups = remaining;
}

function spawnPickup(match) {
  for (let n = 0; n < 40; n++) {
    const c = 1 + Math.floor(match.rng() * (COLS - 2));
    const r = 1 + Math.floor(match.rng() * (ROWS - 2));
    if (match.walls[r * COLS + c]) continue;
    const x = c + 0.5;
    const y = r + 0.5;
    let crowded = false;
    for (const p of match.players) {
      if (!p.active) continue;
      if (Math.hypot(p.x - x, p.y - y) < 5) crowded = true;
    }
    for (const it of match.pickups) {
      if (Math.hypot(it.x - x, it.y - y) < 3) crowded = true;
    }
    if (crowded) continue;
    const type = PICKUP_TYPES[Math.floor(match.rng() * PICKUP_TYPES.length)];
    match.pickups.push({ x, y, type });
    return;
  }
}

function updateProjectiles(match) {
  const next = [];
  for (const proj of match.projectiles) {
    const nx = proj.x + proj.vx * DT;
    const ny = proj.y + proj.vy * DT;
    proj.life -= 1;
    const hitWall = wallAt(match, nx, ny);
    if (hitWall || proj.life <= 0) {
      explode(match, hitWall ? proj.x : nx, hitWall ? proj.y : ny, proj.owner, SPLASH_R, DIRECT_HIT_R);
      continue;
    }
    proj.x = nx;
    proj.y = ny;
    let boom = false;
    for (const p of match.players) {
      if (!canAffect(p, proj.owner)) continue;
      if (Math.hypot(p.x - proj.x, p.y - proj.y) <= DIRECT_HIT_R) {
        boom = true;
        break;
      }
    }
    if (boom) explode(match, proj.x, proj.y, proj.owner, SPLASH_R, DIRECT_HIT_R);
    else next.push(proj);
  }
  match.projectiles = next;
}

function emptyInput() {
  return { moveX: 0, moveY: 0, action: false, secondary: false, aimX: 0, aimY: 0 };
}

function normalizeInput(raw) {
  if (!raw) return emptyInput();
  let x = Number(raw.moveX) || 0;
  let y = Number(raw.moveY) || 0;
  const m = Math.hypot(x, y);
  if (m > 1) {
    x /= m;
    y /= m;
  }
  return {
    moveX: x,
    moveY: y,
    action: !!raw.action,
    secondary: !!raw.secondary,
    aimX: Number(raw.aimX) || 0,
    aimY: Number(raw.aimY) || 0,
  };
}

function updatePlayers(match, inputs) {
  for (const p of match.players) {
    if (!p.active) continue;
    if (p.shotCooldown > 0) p.shotCooldown -= 1;
    if (p.dashCooldown > 0) p.dashCooldown -= 1;
    if (p.speed > 0) p.speed -= 1;
    if (p.inkstorm > 0) p.inkstorm -= 1;
    if (p.stun > 0) p.stun -= 1;
    if (p.invuln > 0) p.invuln -= 1;
    if (p.dash > 0) p.dash -= 1;

    if (!p.alive) {
      if (p.respawn > 0) p.respawn -= 1;
      if (p.respawn <= 0) revive(match, p);
      continue;
    }
    if (p.stun > 0) continue;

    const input = inputs[p.index];
    if (input.secondary && p.dashCooldown === 0 && p.dash === 0) {
      let dx = input.moveX;
      let dy = input.moveY;
      if (dx === 0 && dy === 0) {
        dx = p.facingX;
        dy = p.facingY;
      }
      const m = Math.hypot(dx, dy) || 1;
      p.facingX = dx / m;
      p.facingY = dy / m;
      p.dash = DASH_FRAMES;
      p.dashCooldown = DASH_COOLDOWN_FRAMES;
    }
    if ((input.moveX || input.moveY) && p.dash === 0) {
      const m = Math.hypot(input.moveX, input.moveY) || 1;
      p.facingX = input.moveX / m;
      p.facingY = input.moveY / m;
    }
    if (input.action && p.shotCooldown === 0) fire(match, p, input);

    const oldC = Math.floor(p.x);
    const oldR = Math.floor(p.y);
    if (p.dash > 0) {
      tryMove(match, p, p.facingX * DASH_SPEED * DT, p.facingY * DASH_SPEED * DT);
      paintCircle(match, p.x, p.y, DASH_PAINT_R, p.index + 1);
    } else {
      const spd = speedFor(match, p) * DT;
      tryMove(match, p, input.moveX * spd, input.moveY * spd);
      const c = Math.floor(p.x);
      const r = Math.floor(p.y);
      if (c !== oldC || r !== oldR) paintTrail(match, oldC, oldR, c, r, p.index + 1);
    }
  }
  collectAll(match);
  for (const p of match.players) {
    if (!p.active || !p.alive || p.stun > 0) continue;
    if (p.inkstorm > 0) paintCircle(match, p.x, p.y, STORM_PAINT_R, p.index + 1);
  }
}

export function paintTotals(match) {
  const counts = [0, 0, 0, 0];
  let paintable = 0;
  for (let i = 0; i < match.paint.length; i++) {
    if (match.walls[i]) continue;
    paintable += 1;
    const v = match.paint[i];
    if (v > 0 && v <= PLAYER_COUNT) counts[v - 1] += 1;
  }
  return { counts, paintable };
}

function ranked(match) {
  return match.players
    .filter((p) => p.active)
    .slice()
    .sort((a, b) => b.roundsWon - a.roundsWon || a.kos - b.kos || a.index - b.index);
}

function endRound(match) {
  const { counts } = paintTotals(match);
  let best = -1;
  const candidates = [];
  for (const p of match.players) {
    if (!p.active) continue;
    const c = counts[p.index];
    if (c > best) {
      best = c;
      candidates.length = 0;
      candidates.push(p);
    } else if (c === best) candidates.push(p);
  }
  candidates.sort((a, b) => a.kos - b.kos || a.index - b.index);
  const winner = candidates[0];
  match.roundWinner = winner ? winner.index : -1;
  if (winner) winner.roundsWon += 1;
  if (match.players.some((p) => p.active && p.roundsWon >= match.roundsToWin)) {
    match.phase = "matchend";
    match.champion = ranked(match)[0].index;
  } else {
    match.phase = "roundend";
    match.roundEndTimer = match.roundEndFrames;
  }
}

function startRound(match, first) {
  if (!first) match.round += 1;
  match.phase = "playing";
  match.timeLeft = match.roundFrames;
  match.projectiles = [];
  match.pickups = [];
  match.paint.fill(0);
  match.pickupTimer = PICKUP_EVERY_FRAMES;
  match.roundWinner = -1;
  for (const p of match.players) {
    p.x = p.cornerX;
    p.y = p.cornerY;
    p.alive = p.active;
    p.stun = 0;
    p.respawn = 0;
    p.invuln = INVULN_FRAMES;
    p.dash = 0;
    p.dashCooldown = 0;
    p.speed = 0;
    p.inkstorm = 0;
    p.shotCooldown = 0;
    p.kos = 0;
    p.prevC = Math.floor(p.x);
    p.prevR = Math.floor(p.y);
    p.heading = null;
    p.stuck = 0;
    p.markX = p.x;
    p.markY = p.y;
    p.markAge = 0;
    p.waypoint = null;
    p.wpLife = 0;
    const dx = COLS / 2 - p.x;
    const dy = ROWS / 2 - p.y;
    const m = Math.hypot(dx, dy) || 1;
    p.facingX = dx / m;
    p.facingY = dy / m;
    if (p.active) paintPad(match, p.x, p.y, p.index + 1);
  }
  if (match.spawnPickups) {
    for (let i = 0; i < 3; i++) spawnPickup(match);
  }
}

export function createMatch(opts = {}) {
  const active = opts.active ?? [true, true, true, true];
  const bots = opts.bots ?? [false, false, false, false];
  const match = {
    seed: opts.seed ?? 1,
    rng: makeRng(opts.seed ?? 1),
    walls: buildWalls(),
    paint: new Uint8Array(COLS * ROWS),
    projectiles: [],
    pickups: [],
    phase: "playing",
    round: 1,
    roundFrames: opts.roundFrames ?? ROUND_FRAMES,
    roundsToWin: opts.roundsToWin ?? ROUNDS_TO_WIN,
    roundEndFrames: opts.roundEndFrames ?? ROUND_END_FRAMES,
    timeLeft: ROUND_FRAMES,
    roundWinner: -1,
    champion: -1,
    spawnPickups: opts.spawnPickups !== false,
    pickupTimer: PICKUP_EVERY_FRAMES,
    players: CORNERS.map((corner, i) => makePlayer(corner, i, active[i] !== false, !!bots[i])),
  };
  startRound(match, true);
  return match;
}

/**
 * Advance the match by one fixed 60 Hz step.
 * `inputs` is length 4. Bot slots ignore the provided input.
 */
export function step(match, inputs = []) {
  if (match.phase === "matchend") return match;
  if (match.phase === "roundend") {
    match.roundEndTimer -= 1;
    if (match.roundEndTimer <= 0) startRound(match, false);
    return match;
  }
  const botIns = decideBots(match);
  const resolved = [];
  for (let i = 0; i < PLAYER_COUNT; i++) {
    const p = match.players[i];
    if (!p.active) resolved.push(emptyInput());
    else if (p.isBot) resolved.push(botIns[i]);
    else resolved.push(normalizeInput(inputs[i]));
  }
  updatePlayers(match, resolved);
  updateProjectiles(match);
  if (match.spawnPickups) {
    match.pickupTimer -= 1;
    if (match.pickupTimer <= 0) {
      match.pickupTimer = PICKUP_EVERY_FRAMES;
      if (match.pickups.length < MAX_PICKUPS) spawnPickup(match);
    }
  }
  match.timeLeft -= 1;
  if (match.timeLeft <= 0) endRound(match);
  return match;
}

export { FPS };
