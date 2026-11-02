/** KeyboardEvent.code bindings for the four local players. */
export function defaultBindings() {
  return [
    { up: "KeyW", down: "KeyS", left: "KeyA", right: "KeyD", action: "KeyF", secondary: "KeyG" },
    { up: "ArrowUp", down: "ArrowDown", left: "ArrowLeft", right: "ArrowRight", action: "Slash", secondary: "Period" },
    { up: "KeyI", down: "KeyK", left: "KeyJ", right: "KeyL", action: "Semicolon", secondary: "Quote" },
    { up: "Numpad8", down: "Numpad5", left: "Numpad4", right: "Numpad6", action: "Numpad0", secondary: "NumpadEnter" },
  ];
}

export const BIND_FIELDS = ["up", "down", "left", "right", "action", "secondary"];

const DEADZONE = 0.28;

function normalize(x, y) {
  const m = Math.hypot(x, y);
  if (m === 0) return { x: 0, y: 0 };
  if (m > 1) return { x: x / m, y: y / m };
  return { x, y };
}

export function keyboardLevel(binding, held) {
  const down = held instanceof Set ? (code) => held.has(code) : (code) => !!held?.[code];
  let x = 0;
  let y = 0;
  if (down(binding.left)) x -= 1;
  if (down(binding.right)) x += 1;
  if (down(binding.up)) y -= 1;
  if (down(binding.down)) y += 1;
  const n = normalize(x, y);
  return {
    moveX: n.x,
    moveY: n.y,
    action: down(binding.action),
    secondary: down(binding.secondary),
    start: false,
  };
}

function buttonPressed(buttons, index) {
  const b = buttons && buttons[index];
  if (b == null) return false;
  if (typeof b === "number") return b > 0.5;
  return !!(b.pressed || (typeof b.value === "number" && b.value > 0.5));
}

/**
 * Standard Gamepad mapping: left stick, D-pad, A, B, Start.
 * Returns null when the pad is missing or disconnected.
 */
export function gamepadLevel(pad) {
  if (!pad || pad.connected === false) return null;
  let x = Number(pad.axes?.[0] ?? 0);
  let y = Number(pad.axes?.[1] ?? 0);
  if (!Number.isFinite(x)) x = 0;
  if (!Number.isFinite(y)) y = 0;
  if (Math.hypot(x, y) < DEADZONE) {
    x = 0;
    y = 0;
  } else {
    const n = normalize(x, y);
    x = n.x;
    y = n.y;
  }
  if (x === 0 && y === 0) {
    if (buttonPressed(pad.buttons, 14)) x -= 1;
    if (buttonPressed(pad.buttons, 15)) x += 1;
    if (buttonPressed(pad.buttons, 12)) y -= 1;
    if (buttonPressed(pad.buttons, 13)) y += 1;
    const n = normalize(x, y);
    x = n.x;
    y = n.y;
  }
  return {
    moveX: x,
    moveY: y,
    action: buttonPressed(pad.buttons, 0),
    secondary: buttonPressed(pad.buttons, 1),
    start: buttonPressed(pad.buttons, 9),
  };
}

/** A connected pad replaces that player's keyboard completely. */
export function resolveLevel(binding, held, pad) {
  const gp = gamepadLevel(pad);
  if (gp) return { ...gp, source: "gamepad" };
  return { ...keyboardLevel(binding, held), source: "keyboard" };
}

export function risingEdges(level, prev) {
  const p = prev || { action: false, secondary: false, start: false };
  return {
    moveX: level.moveX,
    moveY: level.moveY,
    action: !!level.action && !p.action,
    secondary: !!level.secondary && !p.secondary,
    start: !!level.start && !p.start,
    source: level.source || "keyboard",
  };
}
