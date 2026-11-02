import { COLS, FPS, ROWS, formatClock } from "../core/constants.js";
import { BIND_FIELDS } from "../core/inputmap.js";

export const INK = ["#ff3d6e", "#3aa0ff", "#ffd23a", "#2ee59a"];
const INK_DARK = ["#8d183c", "#0e4c86", "#8a6d10", "#0d7a49"];
const FIELD_LABEL = {
  up: "Up",
  down: "Down",
  left: "Left",
  right: "Right",
  action: "Action",
  secondary: "Dash",
};

const FONT = "Trebuchet MS, Verdana, sans-serif";

export function keyName(code) {
  const named = {
    ArrowUp: "Up",
    ArrowDown: "Down",
    ArrowLeft: "Left",
    ArrowRight: "Right",
    Slash: "/",
    Period: ".",
    Semicolon: ";",
    Quote: "'",
    NumpadEnter: "Num Enter",
    NumpadAdd: "Num +",
    Space: "Space",
  };
  if (named[code]) return named[code];
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Numpad")) return "Num " + code.slice(6);
  return code;
}

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function coverImage(ctx, img, w, h) {
  if (!img || !img.complete || !img.naturalWidth) return false;
  const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
  return true;
}

function arenaGeom(w, h) {
  const top = 62;
  const bottom = 112;
  const availW = Math.max(10, w - 20);
  const availH = Math.max(10, h - top - bottom);
  const scale = Math.min(availW / COLS, availH / ROWS);
  return {
    scale,
    ox: (w - COLS * scale) / 2,
    oy: top + (availH - ROWS * scale) / 2,
    top,
  };
}

function drawArena(ctx, match, geom) {
  const { ox, oy, scale } = geom;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const i = r * COLS + c;
      const x = Math.round(ox + c * scale);
      const y = Math.round(oy + r * scale);
      const cw = Math.round(ox + (c + 1) * scale) - x;
      const ch = Math.round(oy + (r + 1) * scale) - y;
      if (match.walls[i]) ctx.fillStyle = "#222a3d";
      else if (match.paint[i] > 0) ctx.fillStyle = INK[match.paint[i] - 1];
      else ctx.fillStyle = (c + r) % 2 === 0 ? "#121722" : "#161c2b";
      ctx.fillRect(x, y, cw, ch);
    }
  }
  ctx.strokeStyle = "#3a4460";
  ctx.lineWidth = 2;
  ctx.strokeRect(ox, oy, COLS * scale, ROWS * scale);

  for (const it of match.pickups) {
    const sx = ox + it.x * scale;
    const sy = oy + it.y * scale;
    const color = it.type === "bomb" ? "#ff5b3a" : it.type === "speed" ? "#7dffe2" : "#d59bff";
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = color;
    const s = Math.max(4, scale * 0.42);
    ctx.fillRect(-s, -s, s * 2, s * 2);
    ctx.restore();
    ctx.fillStyle = "#10131c";
    ctx.font = `700 ${Math.max(8, scale * 0.55)}px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(it.type === "bomb" ? "B" : it.type === "speed" ? "S" : "I", sx, sy + 0.5);
  }

  for (const proj of match.projectiles) {
    ctx.fillStyle = INK[proj.owner];
    ctx.beginPath();
    ctx.arc(ox + proj.x * scale, oy + proj.y * scale, Math.max(3, scale * 0.28), 0, Math.PI * 2);
    ctx.fill();
  }

  for (const p of match.players) {
    if (!p.active) continue;
    const sx = ox + p.x * scale;
    const sy = oy + p.y * scale;
    if (!p.alive) {
      ctx.globalAlpha = 0.45;
      ctx.strokeStyle = INK[p.index];
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(ox + p.cornerX * scale, oy + p.cornerY * scale, scale * 0.55, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#fff";
      ctx.font = `700 ${Math.max(10, scale * 0.7)}px ${FONT}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(Math.max(1, Math.ceil(p.respawn / FPS))), ox + p.cornerX * scale, oy + p.cornerY * scale);
      continue;
    }
    ctx.fillStyle = INK[p.index];
    ctx.beginPath();
    ctx.arc(sx, sy, scale * 0.42, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.beginPath();
    ctx.arc(sx + p.facingX * scale * 0.22, sy + p.facingY * scale * 0.22, scale * 0.14, 0, Math.PI * 2);
    ctx.fill();
    if (p.stun > 0) {
      ctx.strokeStyle = "#ffe14a";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(sx, sy, scale * 0.62, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (p.inkstorm > 0) {
      ctx.strokeStyle = "rgba(213,155,255,0.9)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(sx, sy, scale * 1.5, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}

function padIcon(ctx, x, y, on) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = on ? "#d7ffe8" : "#667";
  ctx.fillStyle = on ? "#123" : "#1a1e28";
  ctx.lineWidth = 1.5;
  roundRect(ctx, 0, 0, 22, 14, 4);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = on ? "#7dffe2" : "#556";
  ctx.beginPath();
  ctx.arc(7, 7, 1.6, 0, Math.PI * 2);
  ctx.arc(16, 5.5, 1.4, 0, Math.PI * 2);
  ctx.arc(16, 9, 1.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function hud(ctx, view, w) {
  const match = view.match;
  const totals = view.totals;
  ctx.fillStyle = "#f4f7ff";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.font = `700 15px ${FONT}`;
  ctx.fillText(`ROUND ${match.round}`, 16, 28);
  ctx.textAlign = "center";
  ctx.font = `800 28px ${FONT}`;
  const urgent = match.phase === "playing" && match.timeLeft <= 5 * FPS;
  ctx.fillStyle = urgent ? "#ff5b6a" : "#ffffff";
  ctx.fillText(formatClock(match.timeLeft), w / 2, 30);
  ctx.textAlign = "right";
  ctx.font = `700 14px ${FONT}`;
  ctx.fillStyle = view.muted ? "#ffb4c0" : "#9aa4bd";
  ctx.fillText(view.muted ? "MUTE" : "M mute", w - 16, 28);

  const barW = Math.min(220, (w - 96) / 4);
  const gap = 20;
  const total = barW * 4 + gap * 3;
  let x = (w - total) / 2;
  const y = view.h - 96;
  for (let i = 0; i < 4; i++) {
    const p = match.players[i];
    const raw = totals.paintable ? (totals.counts[i] / totals.paintable) * 100 : 0;
    const label = raw >= 10 ? `${Math.round(raw)}%` : `${raw.toFixed(1)}%`;
    ctx.fillStyle = p.active ? INK[i] : "#667";
    ctx.textAlign = "left";
    ctx.font = `700 13px ${FONT}`;
    ctx.textBaseline = "top";
    ctx.fillText(p.active ? `P${i + 1}` : `P${i + 1} OFF`, x, y);
    ctx.fillStyle = "#d5def2";
    ctx.fillText(p.active ? label : "", x + 28, y);
    padIcon(ctx, x + barW - 22, y, !!view.pads[i]);
    ctx.fillStyle = "#2c354c";
    roundRect(ctx, x, y + 20, barW, 12, 4);
    ctx.fill();
    if (p.active && raw > 0) {
      ctx.fillStyle = INK[i];
      roundRect(ctx, x, y + 20, Math.max(3, (barW * raw) / 100), 12, 4);
      ctx.fill();
    }
    ctx.fillStyle = "#9aa4bd";
    ctx.textAlign = "left";
    ctx.font = `600 12px ${FONT}`;
    const wins = p.active ? `${p.roundsWon} win${p.roundsWon === 1 ? "" : "s"}` : "—";
    ctx.fillText(wins, x, y + 38);
    if (p.active && p.isBot) {
      ctx.fillStyle = INK_DARK[i];
      ctx.fillText("BOT", x + 52, y + 38);
    }
    x += barW + gap;
  }
}

function panel(ctx, w, h, title) {
  ctx.fillStyle = "rgba(7,9,15,0.72)";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#121826";
  ctx.strokeStyle = "#3a4460";
  ctx.lineWidth = 2;
  const pw = Math.min(560, w - 40);
  const ph = Math.min(420, h - 40);
  const x = (w - pw) / 2;
  const y = (h - ph) / 2;
  roundRect(ctx, x, y, pw, ph, 16);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `800 28px ${FONT}`;
  ctx.fillText(title, w / 2, y + 42);
  return { x, y, pw, ph };
}

export function draw(ctx, view) {
  const { w, h } = view;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#07090f";
  ctx.fillRect(0, 0, w, h);

  if (view.mode === "title") drawTitle(ctx, view);
  else if (view.mode === "join") drawJoin(ctx, view);
  else if (view.mode === "settings") drawSettings(ctx, view);
  else if (view.mode === "remap") drawRemap(ctx, view);
  else if (view.mode === "matchend") drawMatchEnd(ctx, view);
  else drawPlay(ctx, view);

  if (view.toast) {
    ctx.fillStyle = "rgba(8,10,16,0.85)";
    ctx.font = `700 16px ${FONT}`;
    const tw = ctx.measureText(view.toast).width + 28;
    roundRect(ctx, (w - tw) / 2, h - 36, tw, 28, 8);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(view.toast, w / 2, h - 22);
  }
}

function drawTitle(ctx, view) {
  const { w, h } = view;
  if (!coverImage(ctx, view.cover, w, h)) {
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, "#2a1030");
    g.addColorStop(1, "#102033");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
  const wash = ctx.createLinearGradient(0, h * 0.15, 0, h);
  wash.addColorStop(0, "rgba(7,9,15,0.15)");
  wash.addColorStop(1, "rgba(7,9,15,0.82)");
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `800 ${Math.max(42, Math.min(92, w * 0.08))}px ${FONT}`;
  ctx.fillStyle = "#ff3d6e";
  ctx.fillText("SPLAT SECTOR", w / 2 + 4, h * 0.48 + 4);
  ctx.fillStyle = "#3aa0ff";
  ctx.fillText("SPLAT SECTOR", w / 2 - 3, h * 0.48 - 2);
  ctx.fillStyle = "#fff";
  ctx.fillText("SPLAT SECTOR", w / 2, h * 0.48);
  ctx.font = `600 ${Math.max(16, w * 0.02)}px ${FONT}`;
  ctx.fillStyle = "#d5def2";
  ctx.fillText("Paint the arena. Own the sector.", w / 2, h * 0.48 + 64);
  ctx.font = `700 20px ${FONT}`;
  ctx.fillStyle = `rgba(255,255,255,${0.45 + view.blink * 0.55})`;
  ctx.fillText("Press Enter", w / 2, h * 0.48 + 112);
  ctx.font = `600 14px ${FONT}`;
  ctx.fillStyle = "#9aa4bd";
  ctx.fillText("4 players  ·  one keyboard  ·  gamepads welcome", w / 2, h - 36);
}

function drawJoin(ctx, view) {
  const { w, h } = view;
  ctx.globalAlpha = 0.35;
  coverImage(ctx, view.cover, w, h);
  ctx.globalAlpha = 1;
  ctx.fillStyle = "rgba(7,9,15,0.72)";
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#fff";
  ctx.font = `800 36px ${FONT}`;
  ctx.fillText("Choose rollers", w / 2, 54);
  ctx.font = `600 15px ${FONT}`;
  ctx.fillStyle = "#c5cee3";
  ctx.fillText("Action joins  ·  Secondary toggles bot / off  ·  Enter starts", w / 2, 92);

  const cardW = Math.min(240, (w - 80) / 4);
  const gap = 16;
  const total = cardW * 4 + gap * 3;
  let x = (w - total) / 2;
  const y = Math.max(120, h * 0.22);
  for (let i = 0; i < 4; i++) {
    const slot = view.slots[i];
    ctx.fillStyle = slot === "off" ? "#171c28" : "#121826";
    ctx.strokeStyle = slot === "off" ? "#2c3344" : INK[i];
    ctx.lineWidth = 3;
    roundRect(ctx, x, y, cardW, 220, 14);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = INK[i];
    ctx.fillRect(x, y, cardW, 8);
    ctx.fillStyle = "#fff";
    ctx.font = `800 28px ${FONT}`;
    ctx.fillText(`P${i + 1}`, x + cardW / 2, y + 48);
    ctx.font = `700 16px ${FONT}`;
    ctx.fillStyle = slot === "human" ? INK[i] : slot === "bot" ? "#d5def2" : "#66788a";
    ctx.fillText(slot === "human" ? "READY" : slot === "bot" ? "BOT" : "OFF", x + cardW / 2, y + 84);
    const b = view.bindings[i];
    ctx.font = `600 13px ${FONT}`;
    ctx.fillStyle = "#9aa4bd";
    ctx.fillText(`${keyName(b.up)} ${keyName(b.left)} ${keyName(b.down)} ${keyName(b.right)}`, x + cardW / 2, y + 124);
    ctx.fillText(`Shot ${keyName(b.action)}`, x + cardW / 2, y + 148);
    ctx.fillText(`Dash ${keyName(b.secondary)}`, x + cardW / 2, y + 170);
    if (view.pads[i]) {
      ctx.fillStyle = "#7dffe2";
      ctx.fillText("Gamepad", x + cardW / 2, y + 198);
    }
    x += cardW + gap;
  }
  ctx.fillStyle = "#9aa4bd";
  ctx.font = `600 14px ${FONT}`;
  ctx.fillText("Tab opens settings  ·  Esc returns to the title", w / 2, h - 36);
}

function drawPlay(ctx, view) {
  const geom = arenaGeom(view.w, view.h);
  drawArena(ctx, view.match, geom);
  hud(ctx, view, view.w);
  if (view.match.phase === "roundend") {
    const name = view.match.roundWinner >= 0 ? `P${view.match.roundWinner + 1}` : "Nobody";
    ctx.fillStyle = "rgba(7,9,15,0.45)";
    ctx.fillRect(0, view.h / 2 - 46, view.w, 92);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `800 36px ${FONT}`;
    ctx.fillStyle = view.match.roundWinner >= 0 ? INK[view.match.roundWinner] : "#fff";
    ctx.fillText(`${name} takes the sector`, view.w / 2, view.h / 2);
  }
  if (view.mode === "pause") {
    const box = panel(ctx, view.w, view.h, "Paused");
    const items = ["Resume", "Settings", "Quit to title"];
    items.forEach((label, i) => {
      const y = box.y + 110 + i * 56;
      ctx.fillStyle = i === view.menuIndex ? "#24304a" : "transparent";
      roundRect(ctx, box.x + 40, y - 22, box.pw - 80, 44, 8);
      ctx.fill();
      ctx.fillStyle = i === view.menuIndex ? "#fff" : "#c5cee3";
      ctx.font = `700 20px ${FONT}`;
      ctx.textAlign = "center";
      ctx.fillText(label, view.w / 2, y);
    });
  }
  const intro = view.match.roundFrames - view.match.timeLeft;
  if (view.match.phase === "playing" && intro < FPS * 1.2) {
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `800 42px ${FONT}`;
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.fillText(`ROUND ${view.match.round}`, view.w / 2, geom.oy + (ROWS * geom.scale) / 2);
  }
}

function drawSettings(ctx, view) {
  const box = panel(ctx, view.w, view.h, "Settings");
  const rows = [
    `Volume   ${Math.round(view.settings.volume * 100)}%`,
    `Rounds to win   ${view.settings.roundsToWin}`,
    "Controls",
    "Back",
  ];
  rows.forEach((label, i) => {
    const y = box.y + 110 + i * 56;
    ctx.fillStyle = i === view.menuIndex ? "#24304a" : "transparent";
    roundRect(ctx, box.x + 36, y - 22, box.pw - 72, 44, 8);
    ctx.fill();
    ctx.fillStyle = i === view.menuIndex ? "#fff" : "#c5cee3";
    ctx.font = `700 20px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, view.w / 2, y);
  });
  ctx.font = `600 13px ${FONT}`;
  ctx.fillStyle = "#9aa4bd";
  ctx.fillText("Left / Right to change  ·  Enter to open  ·  Esc back", view.w / 2, box.y + box.ph - 28);
}

function drawRemap(ctx, view) {
  const box = panel(ctx, view.w, view.h, `P${view.remap.player + 1} controls`);
  ctx.fillStyle = INK[view.remap.player];
  ctx.fillRect(box.x + box.pw / 2 - 40, box.y + 68, 80, 4);
  BIND_FIELDS.forEach((field, i) => {
    const y = box.y + 110 + i * 40;
    const selected = i === view.remap.field;
    ctx.fillStyle = selected ? "#24304a" : "transparent";
    roundRect(ctx, box.x + 36, y - 16, box.pw - 72, 34, 8);
    ctx.fill();
    ctx.font = `700 16px ${FONT}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillStyle = selected ? "#fff" : "#c5cee3";
    ctx.fillText(FIELD_LABEL[field], box.x + 56, y);
    ctx.textAlign = "right";
    const waiting = selected && view.remap.capturing;
    ctx.fillStyle = waiting ? "#ffd23a" : INK[view.remap.player];
    const code = view.bindings[view.remap.player][field];
    ctx.fillText(waiting ? "Press a key" : keyName(code), box.x + box.pw - 56, y);
  });
  ctx.textAlign = "center";
  ctx.font = `600 13px ${FONT}`;
  ctx.fillStyle = "#9aa4bd";
  ctx.fillText("Enter rebinds  ·  Left / Right change player  ·  Esc back", view.w / 2, box.y + box.ph - 28);
}

function drawMatchEnd(ctx, view) {
  const match = view.match;
  const box = panel(ctx, view.w, view.h, "Sector claimed");
  const champ = match.champion;
  ctx.font = `800 26px ${FONT}`;
  ctx.textAlign = "center";
  ctx.fillStyle = champ >= 0 ? INK[champ] : "#fff";
  ctx.fillText(champ >= 0 ? `P${champ + 1} wins the match` : "Draw", view.w / 2, box.y + 86);
  const rows = match.players
    .filter((p) => p.active)
    .slice()
    .sort((a, b) => b.roundsWon - a.roundsWon || view.totals.counts[b.index] - view.totals.counts[a.index] || a.index - b.index);
  rows.forEach((p, i) => {
    const y = box.y + 140 + i * 42;
    ctx.fillStyle = INK[p.index];
    ctx.font = `700 18px ${FONT}`;
    ctx.textAlign = "left";
    ctx.fillText(`${i + 1}.  P${p.index + 1}`, box.x + 70, y);
    ctx.textAlign = "right";
    ctx.fillStyle = "#d5def2";
    ctx.fillText(`${p.roundsWon} rounds`, box.x + box.pw - 70, y);
  });
  ctx.textAlign = "center";
  ctx.font = `600 15px ${FONT}`;
  ctx.fillStyle = "#9aa4bd";
  ctx.fillText("Enter rematch  ·  Esc title", view.w / 2, box.y + box.ph - 32);
}
