import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BASE_SPEED, COLS, DT, ENEMY_MUL, FPS, OWN_MUL, PLAYER_R, ROWS } from "../src/core/constants.js";
import { createMatch, step } from "../src/core/sim.js";
import { blank, clearPaint, inputs, paintRow, place, right } from "./helpers.js";

function travel(owner, frames = FPS) {
  const match = createMatch({ seed: 1, spawnPickups: false });
  clearPaint(match);
  if (owner > 0) paintRow(match, 5, owner);
  const p = match.players[0];
  place(p, 8.5, 5.5);
  p.facingX = 1;
  p.facingY = 0;
  const x0 = p.x;
  for (let i = 0; i < frames; i++) step(match, inputs(right()));
  return p.x - x0;
}

describe("movement and collision", () => {
  it("moves to the right on an open lane", () => {
    const dx = travel(0, 30);
    assert.ok(dx > 2, `expected forward motion, got ${dx}`);
  });

  it("is faster on own ink than neutral, and slower on enemy ink", () => {
    const own = travel(1);
    const neutral = travel(0);
    const enemy = travel(2);
    const expectOwn = BASE_SPEED * OWN_MUL * DT * FPS;
    const expectNeutral = BASE_SPEED * DT * FPS;
    const expectEnemy = BASE_SPEED * ENEMY_MUL * DT * FPS;
    assert.ok(Math.abs(own - expectOwn) < 0.2, `own ${own} ~ ${expectOwn}`);
    assert.ok(Math.abs(neutral - expectNeutral) < 0.2, `neutral ${neutral} ~ ${expectNeutral}`);
    assert.ok(Math.abs(enemy - expectEnemy) < 0.2, `enemy ${enemy} ~ ${expectEnemy}`);
    assert.ok(own > neutral + 1);
    assert.ok(neutral > enemy + 1);
  });

  it("paints a trail behind the roller and not the cell still under it", () => {
    const match = createMatch({ seed: 1, spawnPickups: false });
    clearPaint(match);
    paintRow(match, 5, 2);
    const p = match.players[0];
    place(p, 10.1, 5.5);
    for (let i = 0; i < 20; i++) step(match, inputs(right()));
    assert.equal(match.paint[5 * COLS + 10], 1);
    assert.equal(match.paint[4 * COLS + 10], 1);
    assert.equal(match.paint[6 * COLS + 10], 1);
    assert.equal(match.paint[7 * COLS + 10], 0);
    const occupied = 5 * COLS + Math.floor(p.x);
    assert.equal(match.paint[occupied], 2);
  });

  it("blocks movement into the border wall", () => {
    const match = createMatch({ seed: 1, spawnPickups: false });
    const p = match.players[0];
    place(p, 1.5, 5.5);
    for (let i = 0; i < 40; i++) step(match, inputs({ moveX: -1, moveY: 0 }));
    assert.ok(p.x > 1 + PLAYER_R * 0.5, `sunk into the wall at x=${p.x}`);
    assert.ok(p.x < 1.5);
    assert.equal(match.walls[5 * COLS + 0], 1);
    assert.equal(match.walls[5 * COLS + 10], 0);
  });

  it("slides along a wall instead of sticking", () => {
    const match = createMatch({ seed: 1, spawnPickups: false });
    const p = match.players[0];
    place(p, 8.5, 1.45);
    const x0 = p.x;
    for (let i = 0; i < 20; i++) step(match, inputs({ moveX: 1, moveY: -1 }));
    assert.ok(p.x > x0 + 0.5, `did not slide, x=${p.x}`);
    assert.ok(p.y > 1.1, `crossed the border, y=${p.y}`);
  });

  it("stops at an interior cover block", () => {
    const match = createMatch({ seed: 1, spawnPickups: false });
    const p = match.players[0];
    place(p, 13.2, 10.5);
    assert.equal(match.walls[10 * COLS + 14], 1);
    for (let i = 0; i < 30; i++) step(match, inputs(right()));
    assert.ok(p.x < 14, `entered the block at x=${p.x}`);
    assert.ok(p.x > 13.2);
  });

  it("keeps spawn corners on open floor", () => {
    const match = createMatch({ seed: 1, spawnPickups: false });
    for (const p of match.players) {
      const c = Math.floor(p.cornerX);
      const r = Math.floor(p.cornerY);
      assert.equal(match.walls[r * COLS + c], 0, `corner ${p.index}`);
      assert.ok(c > 0 && c < COLS - 1 && r > 0 && r < ROWS - 1);
    }
    assert.equal(match.players[0].x, match.players[0].cornerX);
    assert.equal(blank().moveX, 0);
  });
});
