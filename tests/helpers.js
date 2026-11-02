import { COLS } from "../src/core/constants.js";

export function right(extra = {}) {
  return { moveX: 1, moveY: 0, action: false, secondary: false, aimX: 0, aimY: 0, ...extra };
}

export function blank() {
  return { moveX: 0, moveY: 0, action: false, secondary: false, aimX: 0, aimY: 0 };
}

export function inputs(p0, p1 = blank(), p2 = blank(), p3 = blank()) {
  return [p0, p1, p2, p3];
}

export function paintRow(match, row, owner) {
  for (let c = 0; c < COLS; c++) {
    const i = row * COLS + c;
    if (!match.walls[i]) match.paint[i] = owner;
  }
}

export function clearPaint(match) {
  match.paint.fill(0);
}

export function place(p, x, y) {
  p.x = x;
  p.y = y;
  p.prevC = Math.floor(x);
  p.prevR = Math.floor(y);
}
