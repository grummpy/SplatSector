import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { defaultBindings } from "../src/core/inputmap.js";
import { defaultSettings, sanitizeSettings } from "../src/core/settings.js";

describe("settings", () => {
  it("falls back to defaults for garbage and clamps the knobs", () => {
    const fresh = defaultSettings();
    assert.equal(fresh.roundsToWin, 3);
    assert.equal(fresh.volume, 0.8);
    assert.equal(fresh.muted, false);
    assert.deepEqual(fresh.bindings, defaultBindings());

    const bad = sanitizeSettings(null);
    assert.deepEqual(bad.bindings, defaultBindings());

    const clamped = sanitizeSettings({ volume: 4, roundsToWin: 40, muted: 1, bindings: [] });
    assert.equal(clamped.volume, 1);
    assert.equal(clamped.roundsToWin, 9);
    assert.equal(clamped.muted, true);

    const low = sanitizeSettings({ volume: -2, roundsToWin: 0 });
    assert.equal(low.volume, 0);
    assert.equal(low.roundsToWin, 1);
  });

  it("keeps a complete remap and drops a partial one", () => {
    const custom = defaultBindings();
    custom[0] = { ...custom[0], action: "KeyZ" };
    const saved = sanitizeSettings({ bindings: custom });
    assert.equal(saved.bindings[0].action, "KeyZ");
    assert.equal(saved.bindings[1].action, "Slash");

    const broken = defaultBindings();
    broken[2] = { ...broken[2], secondary: "" };
    const kept = sanitizeSettings({ bindings: broken });
    assert.equal(kept.bindings[2].secondary, "Quote");
  });
});
