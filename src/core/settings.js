import { BIND_FIELDS, defaultBindings } from "./inputmap.js";
import { ROUNDS_TO_WIN } from "./constants.js";

export function defaultSettings() {
  return {
    volume: 0.8,
    muted: false,
    roundsToWin: ROUNDS_TO_WIN,
    bindings: defaultBindings(),
  };
}

export function sanitizeSettings(raw) {
  const base = defaultSettings();
  if (!raw || typeof raw !== "object") return base;
  const volume = Number(raw.volume);
  if (Number.isFinite(volume)) base.volume = Math.min(1, Math.max(0, volume));
  base.muted = !!raw.muted;
  const rounds = Number(raw.roundsToWin);
  if (Number.isInteger(rounds)) base.roundsToWin = Math.min(9, Math.max(1, rounds));
  if (Array.isArray(raw.bindings)) {
    for (let i = 0; i < 4; i++) {
      const b = raw.bindings[i];
      if (!b || typeof b !== "object") continue;
      const next = { ...base.bindings[i] };
      let ok = true;
      for (const field of BIND_FIELDS) {
        const value = b[field];
        if (typeof value !== "string" || value.length === 0 || value.length > 32) {
          ok = false;
          break;
        }
        next[field] = value;
      }
      if (ok) base.bindings[i] = next;
    }
  }
  return base;
}
