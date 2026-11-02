import { FPS, DT } from "../core/constants.js";
import { createMatch, paintTotals, step } from "../core/sim.js";
import { BIND_FIELDS, gamepadLevel, keyboardLevel } from "../core/inputmap.js";
import { defaultSettings, sanitizeSettings } from "../core/settings.js";
import { createAudio } from "./audio.js";
import { draw } from "./render.js";

const STORAGE_KEY = "splatsector.settings";

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultSettings();
    return sanitizeSettings(JSON.parse(raw));
  } catch {
    return defaultSettings();
  }
}

function saveSettings(settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    /* private mode */
  }
}

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const audio = createAudio();
const settings = loadSettings();
audio.setVolume(settings.volume);
audio.setMuted(settings.muted);

const params = new URLSearchParams(location.search);
const held = new Set();
const queued = new Set();
let mode = "title";
let match = null;
let slots = ["bot", "bot", "bot", "bot"];
let menuIndex = 0;
let settingsReturn = "pause";
let remap = { player: 0, field: 0, capturing: false };
let toast = "";
let toastUntil = 0;
let menuStick = { x: 0, y: 0 };
let frame = 0;
let last = performance.now();
let acc = 0;
let blink = 0;
const prevGp = [null, null, null, null];

const cover = new Image();
cover.src = "assets/cover.jpg";
const icon = new Image();
icon.src = "assets/icon.jpg";

function showToast(text) {
  toast = text;
  toastUntil = performance.now() + 1600;
}

function readPads() {
  const pads = [null, null, null, null];
  if (!navigator.getGamepads) return pads;
  let list = [];
  try {
    list = navigator.getGamepads() || [];
  } catch {
    return pads;
  }
  for (let i = 0; i < 4; i++) {
    const pad = list[i];
    if (pad && pad.connected) pads[i] = pad;
  }
  return pads;
}

function playerEdges(pads, queue) {
  return [0, 1, 2, 3].map((i) => {
    const binding = settings.bindings[i];
    const gp = gamepadLevel(pads[i]);
    if (gp) {
      const prev = prevGp[i] || { action: false, secondary: false, start: false };
      prevGp[i] = gp;
      return {
        moveX: gp.moveX,
        moveY: gp.moveY,
        action: gp.action && !prev.action,
        secondary: gp.secondary && !prev.secondary,
        start: gp.start && !prev.start,
        connected: true,
      };
    }
    prevGp[i] = null;
    const move = keyboardLevel(binding, held);
    return {
      moveX: move.moveX,
      moveY: move.moveY,
      action: queue.has(binding.action),
      secondary: queue.has(binding.secondary),
      start: false,
      connected: false,
    };
  });
}

function startMatch(seed) {
  if (!slots.some((slot) => slot !== "off")) {
    showToast("Need at least 1 player");
    return;
  }
  match = createMatch({
    seed: seed ?? ((Math.random() * 0x7fffffff) >>> 0),
    active: slots.map((slot) => slot !== "off"),
    bots: slots.map((slot) => slot === "bot"),
    roundsToWin: settings.roundsToWin,
  });
  mode = "play";
  audio.startTheme();
  audio.ui();
}

function snapshot(state) {
  return {
    phase: state.phase,
    sec: Math.ceil(state.timeLeft / FPS),
    alive: state.players.map((p) => p.alive),
    shot: state.players.map((p) => p.shotCooldown),
    dash: state.players.map((p) => p.dash),
    speed: state.players.map((p) => p.speed),
    ink: state.players.map((p) => p.inkstorm),
  };
}

function react(before, state) {
  if (before.phase === "playing" && state.phase === "matchend") audio.fanfare();
  else if (before.phase === "playing" && state.phase === "roundend") audio.round();
  const sec = Math.ceil(state.timeLeft / FPS);
  if (state.phase === "playing" && sec >= 1 && sec <= 5 && sec < before.sec) audio.tick();
  state.players.forEach((p, i) => {
    if (before.alive[i] && !p.alive) audio.ko();
    if (p.shotCooldown > before.shot[i]) audio.shot();
    if (before.dash[i] === 0 && p.dash > 0) audio.dash();
    if (p.speed > before.speed[i] || p.inkstorm > before.ink[i]) audio.pickup();
  });
}

function assignBinding(code) {
  const player = remap.player;
  const field = BIND_FIELDS[remap.field];
  const previous = settings.bindings[player][field];
  for (const other of BIND_FIELDS) {
    if (other !== field && settings.bindings[player][other] === code) {
      settings.bindings[player][other] = previous;
    }
  }
  settings.bindings[player][field] = code;
  saveSettings(settings);
  remap.capturing = false;
  remap.field = (remap.field + 1) % BIND_FIELDS.length;
  audio.ui();
}

function menuDelta(queue, edges) {
  let dy = 0;
  let dx = 0;
  if (queue.has("ArrowUp") || queue.has("KeyW")) dy -= 1;
  if (queue.has("ArrowDown") || queue.has("KeyS")) dy += 1;
  if (queue.has("ArrowLeft") || queue.has("KeyA")) dx -= 1;
  if (queue.has("ArrowRight") || queue.has("KeyD")) dx += 1;
  const pad = edges[0];
  let sx = 0;
  let sy = 0;
  if (pad && pad.connected) {
    if (pad.moveY < -0.5) sy = -1;
    else if (pad.moveY > 0.5) sy = 1;
    if (pad.moveX < -0.5) sx = -1;
    else if (pad.moveX > 0.5) sx = 1;
    if (sy !== 0 && menuStick.y === 0) dy += sy;
    if (sx !== 0 && menuStick.x === 0) dx += sx;
  }
  menuStick = { x: sx, y: sy };
  return { dx, dy };
}

function handle(queue, edges) {
  const confirm = queue.has("Enter") || queue.has("Space") || queue.has("NumpadEnter") || edges.some((e) => e.start);
  const back = queue.has("Escape");
  if (queue.has("KeyM") && !remap.capturing) {
    settings.muted = audio.toggleMuted();
    saveSettings(settings);
  }

  if (mode === "title") {
    if (confirm || edges.some((e) => e.action) || queue.has("Tab")) {
      if (queue.has("Tab")) {
        settingsReturn = "title";
        menuIndex = 0;
        mode = "settings";
      } else {
        mode = "join";
        audio.ui();
      }
    }
    return;
  }

  if (mode === "join") {
    edges.forEach((edge, i) => {
      if (edge.action) slots[i] = "human";
      else if (edge.secondary) slots[i] = slots[i] === "bot" ? "off" : "bot";
    });
    if (queue.has("Tab")) {
      settingsReturn = "join";
      menuIndex = 0;
      mode = "settings";
      return;
    }
    if (back) {
      mode = "title";
      return;
    }
    if (confirm) startMatch();
    return;
  }

  if (mode === "play") {
    if (back || edges.some((e) => e.start)) {
      mode = "pause";
      menuIndex = 0;
      audio.ui();
    }
    return;
  }

  if (mode === "pause") {
    const count = 3;
    const { dy } = menuDelta(queue, edges);
    if (dy !== 0) menuIndex = (menuIndex + dy + count) % count;
    const choose = confirm || edges.some((e) => e.action);
    if (back) {
      mode = "play";
      return;
    }
    if (choose) {
      if (menuIndex === 0) mode = "play";
      else if (menuIndex === 1) {
        settingsReturn = "pause";
        menuIndex = 0;
        mode = "settings";
      } else {
        match = null;
        mode = "title";
        audio.stopTheme();
      }
      audio.ui();
    }
    return;
  }

  if (mode === "settings") {
    const count = 4;
    const { dx, dy } = menuDelta(queue, edges);
    if (dy !== 0) menuIndex = (menuIndex + dy + count) % count;
    if (menuIndex === 0 && dx !== 0) {
      settings.volume = Math.min(1, Math.max(0, Math.round((settings.volume + dx * 0.1) * 10) / 10));
      audio.setVolume(settings.volume);
      saveSettings(settings);
    }
    if (menuIndex === 1 && dx !== 0) {
      settings.roundsToWin = Math.min(9, Math.max(1, settings.roundsToWin + dx));
      saveSettings(settings);
    }
    const choose = confirm || edges.some((e) => e.action);
    if (back) {
      mode = settingsReturn;
      menuIndex = 0;
      return;
    }
    if (choose && menuIndex === 2) {
      mode = "remap";
      remap = { player: 0, field: 0, capturing: false };
      audio.ui();
    } else if (choose && menuIndex === 3) {
      mode = settingsReturn;
      menuIndex = 0;
      audio.ui();
    }
    return;
  }

  if (mode === "remap") {
    if (remap.capturing) return;
    const { dx, dy } = menuDelta(queue, edges);
    if (dy !== 0) remap.field = (remap.field + dy + BIND_FIELDS.length) % BIND_FIELDS.length;
    if (dx !== 0) remap.player = (remap.player + dx + 4) % 4;
    if (back) {
      mode = "settings";
      menuIndex = 2;
      return;
    }
    if (confirm || edges.some((e) => e.action)) {
      remap.capturing = true;
      audio.ui();
    }
    return;
  }

  if (mode === "matchend") {
    if (confirm || edges.some((e) => e.action)) startMatch();
    else if (back) {
      match = null;
      mode = "title";
      audio.stopTheme();
    }
  }
}

function bootAutostart() {
  if (!params.has("autostart")) return;
  const seconds = Number(params.get("round"));
  const wins = Number(params.get("wins"));
  const seed = Number(params.get("seed"));
  slots = ["bot", "bot", "bot", "bot"];
  match = createMatch({
    seed: Number.isFinite(seed) ? seed : 1,
    active: [true, true, true, true],
    bots: [true, true, true, true],
    roundFrames: Number.isFinite(seconds) && seconds > 0 ? Math.max(1, Math.round(seconds * FPS)) : undefined,
    roundsToWin: Number.isFinite(wins) && wins > 0 ? Math.round(wins) : settings.roundsToWin,
  });
  mode = "play";
}

window.addEventListener("keydown", (event) => {
  if (event.repeat) return;
  audio.unlock();
  if (mode === "remap" && remap.capturing) {
    event.preventDefault();
    if (event.code === "Escape") remap.capturing = false;
    else if (event.code !== "KeyM") assignBinding(event.code);
    return;
  }
  held.add(event.code);
  queued.add(event.code);
  event.preventDefault();
});

window.addEventListener("keyup", (event) => {
  held.delete(event.code);
});

window.addEventListener("blur", () => held.clear());
canvas.addEventListener("pointerdown", () => {
  canvas.focus();
  audio.unlock();
});

bootAutostart();
canvas.focus();

function frameInputs(edges, first) {
  return edges.map((edge) => ({
    moveX: edge.moveX,
    moveY: edge.moveY,
    action: first && edge.action,
    secondary: first && edge.secondary,
    aimX: 0,
    aimY: 0,
  }));
}

function tick(now) {
  const delta = Math.min(0.1, (now - last) / 1000);
  last = now;
  blink = (Math.sin(now / 280) + 1) / 2;
  if (toast && now > toastUntil) toast = "";

  const queue = new Set(queued);
  queued.clear();
  const pads = readPads();
  const edges = playerEdges(pads, queue);
  const modeBefore = mode;
  handle(queue, edges);

  if (mode === "play" && match) {
    if (modeBefore === "play") {
      acc += delta;
      let steps = 0;
      let first = true;
      while (acc >= DT && steps < 6) {
        const before = snapshot(match);
        step(match, frameInputs(edges, first));
        react(before, match);
        first = false;
        acc -= DT;
        steps += 1;
      }
    } else {
      acc = 0;
    }
    if (match.phase === "matchend") mode = "matchend";
  } else {
    acc = 0;
  }

  audio.update();
  frame += 1;

  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = window.innerWidth;
  const h = window.innerHeight;
  if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  draw(ctx, {
    w,
    h,
    mode,
    cover,
    icon,
    blink,
    slots,
    pads: pads.map(Boolean),
    match,
    totals: match ? paintTotals(match) : { counts: [0, 0, 0, 0], paintable: 1 },
    settings,
    menuIndex,
    remap,
    toast,
    muted: settings.muted,
    bindings: settings.bindings,
  });

  const totals = match ? paintTotals(match) : null;
  window.__splat = {
    mode,
    phase: match ? match.phase : null,
    round: match ? match.round : 0,
    timeLeft: match ? match.timeLeft : 0,
    scores: match ? match.players.map((p) => p.roundsWon) : [],
    champion: match ? match.champion : -1,
    paintSum: totals ? totals.counts.reduce((a, b) => a + b, 0) : 0,
    frame,
    bots: match ? match.players.map((p) => p.isBot) : [],
    active: match ? match.players.map((p) => p.active) : [],
  };

  requestAnimationFrame(tick);
}

requestAnimationFrame(tick);
