import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createMatch, paintTotals, step } from "../src/core/sim.js";

function paintSum(match) {
  return paintTotals(match).counts.reduce((a, b) => a + b, 0);
}

function run(seed) {
  const match = createMatch({
    seed,
    bots: [true, true, true, true],
    roundFrames: 180,
    roundsToWin: 1,
    roundEndFrames: 5,
    spawnPickups: true,
  });
  const start = paintSum(match);
  let guard = 0;
  while (match.phase !== "matchend" && guard < 1000) {
    step(match);
    guard += 1;
  }
  return { match, start, guard };
}

describe("bots", () => {
  it("plays a full short match and covers more of the arena", () => {
    const { match, start, guard } = run(7);
    assert.equal(match.phase, "matchend");
    assert.ok(guard < 1000);
    assert.ok(match.champion >= 0 && match.champion <= 3);
    assert.equal(match.players[match.champion].roundsWon, 1);
    assert.ok(paintSum(match) > start + 20, `paint ${paintSum(match)} from ${start}`);
    assert.ok(match.players.every((p) => p.isBot && p.active));
  });

  it("is deterministic for a seed", () => {
    const a = run(4);
    const b = run(4);
    assert.equal(a.match.champion, b.match.champion);
    assert.deepEqual(Array.from(a.match.paint), Array.from(b.match.paint));
    assert.deepEqual(
      a.match.players.map((p) => p.roundsWon),
      b.match.players.map((p) => p.roundsWon),
    );
  });
});
