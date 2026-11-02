import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { makeRng } from "../src/core/rng.js";

function take(seed, n) {
  const rng = makeRng(seed);
  const out = [];
  for (let i = 0; i < n; i++) out.push(rng());
  return out;
}

describe("seeded rng", () => {
  it("repeats the same stream for the same seed", () => {
    assert.deepEqual(take(1, 32), take(1, 32));
    assert.deepEqual(take(99, 32), take(99, 32));
  });

  it("diverges for a different seed", () => {
    assert.notDeepEqual(take(1, 8), take(2, 8));
  });

  it("stays inside [0, 1) and accepts a zero seed", () => {
    for (const seed of [0, 1, 42, 0xffffffff]) {
      for (const value of take(seed, 20)) {
        assert.ok(value >= 0 && value < 1, `${seed} -> ${value}`);
      }
    }
  });
});
