/** Fixed simulation rate. One step is one frame. */
export const FPS = 60;
export const DT = 1 / FPS;

export const COLS = 64;
export const ROWS = 40;
export const PLAYER_COUNT = 4;

export const ROUND_SECONDS = 90;
export const ROUND_FRAMES = ROUND_SECONDS * FPS;
export const ROUNDS_TO_WIN = 3;
export const ROUND_END_FRAMES = 150;

export const RESPAWN_SECONDS = 2;
export const RESPAWN_FRAMES = RESPAWN_SECONDS * FPS;
export const STUN_SECONDS = 1;
export const STUN_FRAMES = STUN_SECONDS * FPS;
export const INVULN_FRAMES = 30;

export const DASH_COOLDOWN_SECONDS = 4;
export const DASH_COOLDOWN_FRAMES = DASH_COOLDOWN_SECONDS * FPS;
export const DASH_FRAMES = 16;
export const DASH_SPEED = 16.5;
export const DASH_PAINT_R = 2.25;

export const INKSTORM_SECONDS = 5;
export const INKSTORM_FRAMES = INKSTORM_SECONDS * FPS;
export const STORM_PAINT_R = 1.75;

export const SPEED_SECONDS = 5;
export const SPEED_FRAMES = SPEED_SECONDS * FPS;
export const SPEED_MUL = 1.6;

export const SHOT_COOLDOWN_FRAMES = 27;
export const PROJ_SPEED = 14;
export const PROJ_LIFE_FRAMES = 48;
export const SPLASH_R = 1.9;
export const DIRECT_HIT_R = 0.62;

export const BOMB_R = 4.3;
export const BOMB_KO_R = 3.4;

export const BASE_SPEED = 6.4;
export const OWN_MUL = 1.45;
export const ENEMY_MUL = 0.6;

export const PLAYER_R = 0.34;
export const PICKUP_R = 0.7;
export const PICKUP_EVERY_FRAMES = 7 * FPS;
export const MAX_PICKUPS = 4;

export function formatClock(frames) {
  const seconds = Math.max(0, Math.ceil(frames / FPS));
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
