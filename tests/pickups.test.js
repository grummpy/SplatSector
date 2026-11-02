import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BASE_SPEED,
  BOMB_KO_R,
  DT,
  INKSTORM_FRAMES,
  INKSTORM_SECONDS,
  SPEED_FRAMES,
  SPEED_MUL,
} from "../src/core/constants.js";
import { createMatch, paintTotals, step } from "../src/core/sim.js";
import { blank, clearPaint, inputs, place, right } from "./helpers.js";

function match() {
  return createMatch({ seed: 5, spawnPickups: false, roundFrames: 60 * 40 });
}

describe("pickups", () => {
  it("grants a speed boost that outruns the base roller", () => {
    const boosted = () => {
      const m = match();
      clearPaint(m);
      const p = m.players[0];
      place(p, 8.5, 5.5);
      p.speed = SPEED_FRAMES;
      const x0 = p.x;
      for (let i = 0; i < 30; i++) step(m, inputs(right()));
      return p.x - x0;
    };
    const plain = () => {
      const m = match();
      clearPaint(m);
      const p = m.players[0];
      place(p, 8.5, 5.5);
      const x0 = p.x;
      for (let i = 0; i < 30; i++) step(m, inputs(right()));
      return p.x - x0;
    };
    const fast = boosted();
    const slow = plain();
    const expectFast = BASE_SPEED * SPEED_MUL * DT * 30;
    const expectSlow = BASE_SPEED * DT * 30;
    assert.ok(Math.abs(fast - expectFast) < 0.25, `fast ${fast} ~ ${expectFast}`);
    assert.ok(Math.abs(slow - expectSlow) < 0.25, `slow ${slow} ~ ${expectSlow}`);
    assert.ok(fast > slow + 1);
  });

  it("collects a speed pickup into a full timer", () => {
    const m = match();
    const p = m.players[0];
    place(p, 12.5, 5.5);
    m.pickups.push({ x: p.x, y: p.y, type: "speed" });
    step(m, inputs(blank()));
    assert.equal(m.pickups.length, 0);
    assert.equal(p.speed, SPEED_FRAMES);
  });

  it("runs an inkstorm for 5 seconds and paints while standing still", () => {
    assert.equal(INKSTORM_SECONDS, 5);
    assert.equal(INKSTORM_FRAMES, 300);
    const m = match();
    clearPaint(m);
    const p = m.players[0];
    place(p, 12.5, 5.5);
    m.pickups.push({ x: p.x, y: p.y, type: "inkstorm" });
    step(m, inputs(blank()));
    assert.equal(p.inkstorm, INKSTORM_FRAMES);
    const painted = paintTotals(m).counts[0];
    assert.ok(painted > 8, `storm painted ${painted}`);
    for (let i = 0; i < 299; i++) step(m, inputs(blank()));
    assert.ok(p.inkstorm > 0);
    step(m, inputs(blank()));
    assert.equal(p.inkstorm, 0);
  });

  it("detonates a bomb pickup into a big splash that eliminates nearby enemies", () => {
    const m = match();
    clearPaint(m);
    const a = m.players[0];
    const b = m.players[1];
    place(a, 10.5, 5.5);
    place(b, 13.5, 5.5);
    a.invuln = 0;
    b.invuln = 0;
    assert.ok(Math.hypot(a.x - b.x, a.y - b.y) <= BOMB_KO_R);
    m.pickups.push({ x: a.x, y: a.y, type: "bomb" });
    step(m, inputs(blank()));
    assert.equal(m.pickups.length, 0);
    assert.equal(a.alive, true);
    assert.equal(b.alive, false);
    assert.equal(b.kos, 1);
    assert.ok(paintTotals(m).counts[0] > 40);
  });

  it("spawns the same pickups for the same seed", () => {
    const a = createMatch({ seed: 11, spawnPickups: true });
    const b = createMatch({ seed: 11, spawnPickups: true });
    assert.deepEqual(a.pickups, b.pickups);
    assert.ok(a.pickups.length >= 1);
    const c = createMatch({ seed: 12, spawnPickups: true });
    assert.notDeepEqual(a.pickups, c.pickups);
  });
});
