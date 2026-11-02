import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { COLS, ROUND_FRAMES, ROUND_SECONDS, ROUNDS_TO_WIN } from "../src/core/constants.js";
import { createMatch, paintTotals, step } from "../src/core/sim.js";

function giveCells(match, owner, n, row) {
  let painted = 0;
  for (let c = 1; c < COLS - 1 && painted < n; c++) {
    const i = row * COLS + c;
    if (match.walls[i]) continue;
    match.paint[i] = owner;
    painted += 1;
  }
  return painted;
}

describe("scoring, rounds, and match win", () => {
  it("uses a 90 second round and first to 3 by default", () => {
    const match = createMatch({ seed: 1, spawnPickups: false });
    assert.equal(ROUND_SECONDS, 90);
    assert.equal(match.roundFrames, ROUND_FRAMES);
    assert.equal(match.roundsToWin, ROUNDS_TO_WIN);
    assert.equal(ROUNDS_TO_WIN, 3);
    assert.equal(match.timeLeft, ROUND_FRAMES);
    assert.equal(match.round, 1);
  });

  it("counts painted cells and keeps them inside the paintable arena", () => {
    const match = createMatch({ seed: 1, spawnPickups: false });
    const { counts, paintable } = paintTotals(match);
    assert.ok(paintable > 2000);
    const sum = counts.reduce((a, b) => a + b, 0);
    assert.ok(sum > 0 && sum <= paintable);
    assert.ok(counts.every((c) => c > 0));
  });

  it("awards the round to the player with the most ink", () => {
    const match = createMatch({ seed: 1, spawnPickups: false, roundEndFrames: 30 });
    match.paint.fill(0);
    assert.equal(giveCells(match, 1, 10, 5), 10);
    assert.equal(giveCells(match, 2, 28, 6), 28);
    match.timeLeft = 1;
    step(match);
    assert.equal(match.phase, "roundend");
    assert.equal(match.roundWinner, 1);
    assert.equal(match.players[1].roundsWon, 1);
    assert.equal(match.players[0].roundsWon, 0);
  });

  it("breaks paint ties by fewest KOs, then lowest index", () => {
    const tied = createMatch({ seed: 1, spawnPickups: false });
    tied.paint.fill(0);
    giveCells(tied, 1, 12, 5);
    giveCells(tied, 2, 12, 6);
    tied.players[0].kos = 2;
    tied.players[1].kos = 0;
    tied.timeLeft = 1;
    step(tied);
    assert.equal(tied.roundWinner, 1);

    const index = createMatch({ seed: 1, spawnPickups: false });
    index.paint.fill(0);
    giveCells(index, 1, 12, 5);
    giveCells(index, 2, 12, 6);
    index.timeLeft = 1;
    step(index);
    assert.equal(index.roundWinner, 0);
  });

  it("ignores inactive players when choosing a winner", () => {
    const match = createMatch({
      seed: 1,
      spawnPickups: false,
      active: [true, false, false, false],
    });
    match.paint.fill(0);
    giveCells(match, 2, 40, 6);
    giveCells(match, 1, 4, 5);
    match.timeLeft = 1;
    step(match);
    assert.equal(match.roundWinner, 0);
    assert.equal(match.players[1].roundsWon, 0);
  });

  it("starts the next round after the banner and keeps round wins", () => {
    const match = createMatch({ seed: 1, spawnPickups: false, roundEndFrames: 1, roundsToWin: 3 });
    match.paint.fill(0);
    giveCells(match, 1, 15, 5);
    match.timeLeft = 1;
    step(match);
    assert.equal(match.phase, "roundend");
    assert.equal(match.round, 1);
    step(match);
    assert.equal(match.phase, "playing");
    assert.equal(match.round, 2);
    assert.equal(match.players[0].roundsWon, 1);
    assert.equal(match.timeLeft, match.roundFrames);
  });

  it("ends the match at the configured number of round wins", () => {
    const match = createMatch({ seed: 2, spawnPickups: false, roundEndFrames: 1, roundsToWin: 3 });
    for (let i = 0; i < 3; i++) {
      assert.equal(match.phase, "playing");
      match.paint.fill(0);
      giveCells(match, 3, 20, 5);
      match.timeLeft = 1;
      step(match);
      if (i < 2) {
        assert.equal(match.phase, "roundend");
        step(match);
      }
    }
    assert.equal(match.phase, "matchend");
    assert.equal(match.champion, 2);
    assert.equal(match.players[2].roundsWon, 3);
    const wins = match.players[2].roundsWon;
    step(match);
    step(match);
    assert.equal(match.phase, "matchend");
    assert.equal(match.players[2].roundsWon, wins);
    assert.equal(match.round, 3);
  });
});
