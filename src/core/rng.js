/**
 * Mulberry32. Same seed always yields the same stream.
 * A seed of 0 is remapped so the generator does not stick at zero.
 */
export function makeRng(seed) {
  let a = seed >>> 0;
  if (a === 0) a = 0x6d2b79f5;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function rngInt(rng, max) {
  return Math.floor(rng() * max);
}
