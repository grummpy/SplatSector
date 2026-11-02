import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  defaultBindings,
  gamepadLevel,
  keyboardLevel,
  resolveLevel,
  risingEdges,
} from "../src/core/inputmap.js";

function pad(over = {}) {
  const buttons = Array.from({ length: 16 }, () => ({ pressed: false, value: 0 }));
  return {
    connected: true,
    axes: [0, 0, 0, 0],
    buttons,
    ...over,
  };
}

describe("input mapping", () => {
  it("maps each player's default keyboard cluster", () => {
    const bindings = defaultBindings();
    const cases = [
      { keys: ["KeyW", "KeyD", "KeyF"], moveX: Math.SQRT1_2, moveY: -Math.SQRT1_2, action: true, secondary: false },
      { keys: ["ArrowLeft", "ArrowDown", "Slash"], moveX: -Math.SQRT1_2, moveY: Math.SQRT1_2, action: true, secondary: false },
      { keys: ["KeyJ", "KeyK", "Quote"], moveX: -Math.SQRT1_2, moveY: Math.SQRT1_2, action: false, secondary: true },
      { keys: ["Numpad6", "Numpad8", "Numpad0", "NumpadEnter"], moveX: Math.SQRT1_2, moveY: -Math.SQRT1_2, action: true, secondary: true },
    ];
    cases.forEach((spec, player) => {
      const level = keyboardLevel(bindings[player], new Set(spec.keys));
      assert.ok(Math.abs(level.moveX - spec.moveX) < 1e-9, `p${player} x`);
      assert.ok(Math.abs(level.moveY - spec.moveY) < 1e-9, `p${player} y`);
      assert.equal(level.action, spec.action, `p${player} action`);
      assert.equal(level.secondary, spec.secondary, `p${player} secondary`);
    });
  });

  it("honors a remapped binding", () => {
    const custom = { up: "KeyT", down: "KeyG", left: "KeyF", right: "KeyH", action: "KeyY", secondary: "KeyU" };
    const level = keyboardLevel(custom, new Set(["KeyT", "KeyY"]));
    assert.equal(level.moveY, -1);
    assert.equal(level.moveX, 0);
    assert.equal(level.action, true);
    assert.equal(level.secondary, false);
  });

  it("reads the left stick, face buttons, and start", () => {
    const gp = pad({ axes: [0.9, -0.8, 0, 0] });
    gp.buttons[0] = { pressed: true, value: 1 };
    gp.buttons[9] = { pressed: true, value: 1 };
    const level = gamepadLevel(gp);
    assert.ok(level.moveX > 0.5);
    assert.ok(level.moveY < -0.5);
    assert.equal(level.action, true);
    assert.equal(level.secondary, false);
    assert.equal(level.start, true);
    assert.ok(Math.hypot(level.moveX, level.moveY) <= 1 + 1e-9);
  });

  it("uses the d-pad when the stick is inside the deadzone", () => {
    const gp = pad({ axes: [0.1, -0.05, 0, 0] });
    gp.buttons[15] = { pressed: true, value: 1 };
    gp.buttons[13] = { pressed: true, value: 1 };
    gp.buttons[1] = { pressed: true, value: 1 };
    const level = gamepadLevel(gp);
    assert.ok(Math.abs(level.moveX - Math.SQRT1_2) < 1e-9);
    assert.ok(Math.abs(level.moveY - Math.SQRT1_2) < 1e-9);
    assert.equal(level.secondary, true);
  });

  it("treats a disconnected pad as absent", () => {
    assert.equal(gamepadLevel(null), null);
    assert.equal(gamepadLevel({ connected: false, axes: [1, 0], buttons: [] }), null);
  });

  it("lets a connected pad override that player's keyboard", () => {
    const binding = defaultBindings()[0];
    const held = new Set(["KeyA", "KeyF"]);
    const gp = pad({ axes: [1, 0, 0, 0] });
    gp.buttons[1] = { pressed: true, value: 1 };
    const kb = resolveLevel(binding, held, null);
    assert.equal(kb.source, "keyboard");
    assert.equal(kb.moveX, -1);
    assert.equal(kb.action, true);
    const over = resolveLevel(binding, held, gp);
    assert.equal(over.source, "gamepad");
    assert.ok(over.moveX > 0.9);
    assert.equal(over.action, false);
    assert.equal(over.secondary, true);
    const back = resolveLevel(binding, held, { connected: false, axes: [1, 0], buttons: [] });
    assert.equal(back.source, "keyboard");
    assert.equal(back.moveX, -1);
  });

  it("emits action, secondary, and start only on the rising edge", () => {
    const held = { moveX: 1, moveY: 0, action: true, secondary: true, start: true, source: "gamepad" };
    const first = risingEdges(held, null);
    assert.equal(first.action, true);
    assert.equal(first.secondary, true);
    assert.equal(first.start, true);
    assert.equal(first.moveX, 1);
    const second = risingEdges(held, held);
    assert.equal(second.action, false);
    assert.equal(second.secondary, false);
    assert.equal(second.start, false);
    assert.equal(second.moveX, 1);
    const released = risingEdges({ ...held, action: false, secondary: false, start: false }, held);
    assert.equal(released.action, false);
    const again = risingEdges(held, released);
    assert.equal(again.action, true);
    assert.equal(again.start, true);
  });
});
