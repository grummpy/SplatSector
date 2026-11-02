import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  COLS,
  DASH_COOLDOWN_FRAMES,
  DASH_COOLDOWN_SECONDS,
  DASH_FRAMES,
  DIRECT_HIT_R,
  RESPAWN_FRAMES,
  RESPAWN_SECONDS,
  SHOT_COOLDOWN_FRAMES,
  SPLASH_R,
  STUN_FRAMES,
  STUN_SECONDS,
} from "../src/core/constants.js";
import { createMatch, step } from "../src/core/sim.js";
import { blank, clearPaint, inputs, place, right } from "./helpers.js";

function openMatch() {
  return createMatch({ seed: 1, spawnPickups: false, roundFrames: 60 * 30 });
}

function at(row, col) {
  return row * COLS + col;
}

describe("shots, stuns, dashes, and elimination", () => {
  it("knocks an enemy out with a direct hit and respawns them after 2 seconds", () => {
    assert.equal(RESPAWN_SECONDS, 2);
    assert.equal(RESPAWN_FRAMES, 120);
    const match = openMatch();
    const a = match.players[0];
    const b = match.players[1];
    place(a, 8.5, 5.5);
    place(b, 16.5, 5.5);
    a.facingX = 1;
    a.facingY = 0;
    step(match, inputs({ moveX: 0, moveY: 0, action: true }));
    assert.equal(a.shotCooldown, SHOT_COOLDOWN_FRAMES);
    assert.ok(match.projectiles.length >= 1);
    for (let i = 0; i < 50 && b.alive; i++) step(match, inputs(blank()));
    assert.equal(b.alive, false);
    assert.equal(b.respawn, RESPAWN_FRAMES);
    assert.equal(b.x, b.cornerX);
    assert.equal(b.y, b.cornerY);
    assert.equal(b.kos, 1);
    assert.equal(a.alive, true);
    for (let i = 0; i < 119; i++) step(match, inputs(blank()));
    assert.equal(b.alive, false);
    step(match, inputs(blank()));
    assert.equal(b.alive, true);
    assert.equal(b.x, b.cornerX);
    assert.equal(b.y, b.cornerY);
    assert.ok(b.invuln > 0);
  });

  it("stuns enemies in the splash for 1 second without eliminating them", () => {
    assert.equal(STUN_SECONDS, 1);
    assert.equal(STUN_FRAMES, 60);
    const match = openMatch();
    const b = match.players[1];
    place(b, 21.3, 5.5);
    b.invuln = 0;
    const x0 = b.x;
    match.projectiles.push({
      x: 20,
      y: 5.5,
      vx: 0,
      vy: 0,
      owner: 0,
      life: 1,
    });
    const dist = Math.hypot(b.x - 20, b.y - 5.5);
    assert.ok(dist > DIRECT_HIT_R && dist <= SPLASH_R);
    step(match, inputs(blank()));
    assert.equal(b.alive, true);
    assert.equal(b.stun, STUN_FRAMES);
    for (let i = 0; i < 59; i++) step(match, inputs(blank(), right()));
    assert.equal(b.x, x0);
    assert.ok(b.stun > 0);
    step(match, inputs(blank(), right()));
    assert.ok(b.x > x0);
    assert.equal(b.stun, 0);
  });

  it("does not hurt the owner or an invulnerable player", () => {
    const match = openMatch();
    const a = match.players[0];
    place(a, 20.5, 5.5);
    a.invuln = 0;
    match.projectiles.push({ x: a.x, y: a.y, vx: 0, vy: 0, owner: 0, life: 1 });
    step(match, inputs(blank()));
    assert.equal(a.alive, true);
    assert.equal(a.stun, 0);

    const b = match.players[1];
    place(b, 12.5, 5.5);
    b.invuln = 10;
    match.projectiles.push({ x: b.x, y: b.y, vx: 0, vy: 0, owner: 0, life: 1 });
    step(match, inputs(blank()));
    assert.equal(b.alive, true);
  });

  it("dashes a wide trail on a 4 second cooldown", () => {
    assert.equal(DASH_COOLDOWN_SECONDS, 4);
    assert.equal(DASH_COOLDOWN_FRAMES, 240);
    const match = openMatch();
    clearPaint(match);
    const p = match.players[0];
    place(p, 20.5, 5.5);
    p.facingX = 1;
    p.facingY = 0;
    step(match, inputs({ moveX: 1, moveY: 0, action: false, secondary: true }));
    assert.equal(p.dash, DASH_FRAMES);
    assert.equal(p.dashCooldown, DASH_COOLDOWN_FRAMES);
    assert.equal(match.paint[at(7, 20)], 1);
    assert.equal(match.paint[at(3, 20)], 1);

    const walked = openMatch();
    clearPaint(walked);
    const w = walked.players[0];
    place(w, 10.1, 5.5);
    for (let i = 0; i < 20; i++) step(walked, inputs(right()));
    assert.equal(walked.paint[at(7, 10)], 0);
    assert.equal(walked.paint[at(4, 10)], 1);

    for (let i = 0; i < 239; i++) step(match, inputs(blank()));
    assert.ok(p.dashCooldown > 0);
    step(match, inputs(blank()));
    assert.equal(p.dashCooldown, 0);
    step(match, inputs({ moveX: 1, moveY: 0, secondary: true }));
    assert.equal(p.dash, DASH_FRAMES);
  });
});
