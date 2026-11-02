/** Short Web Audio cues. Everything is synthesized; there are no audio files. */
export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;
  let volume = 0.8;
  let themeOn = false;
  let step = 0;
  let nextAt = 0;
  const melody = [0, 3, 7, 10, 7, 3, 5, 8, 12, 8, 5, 2];

  function ensure() {
    try {
      const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!AC) return false;
      if (!ctx) {
        ctx = new AC();
        master = ctx.createGain();
        master.connect(ctx.destination);
      }
      master.gain.value = muted ? 0 : Math.max(0, Math.min(1, volume)) * 0.35;
      if (ctx.state === "suspended") ctx.resume().catch(() => {});
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, dur, type, gain, delay = 0) {
    if (!ensure() || muted) return;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function noise(dur, gain) {
    if (!ensure() || muted) return;
    const n = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, n, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const g = ctx.createGain();
    src.buffer = buffer;
    filter.type = "highpass";
    filter.frequency.value = 400;
    g.gain.value = gain;
    src.connect(filter);
    filter.connect(g);
    g.connect(master);
    src.start();
  }

  return {
    setVolume(v) {
      volume = v;
      if (master) master.gain.value = muted ? 0 : volume * 0.35;
    },
    setMuted(m) {
      muted = !!m;
      if (master) master.gain.value = muted ? 0 : volume * 0.35;
    },
    get muted() {
      return muted;
    },
    toggleMuted() {
      this.setMuted(!muted);
      return muted;
    },
    unlock() {
      ensure();
    },
    startTheme() {
      themeOn = true;
      nextAt = 0;
    },
    stopTheme() {
      themeOn = false;
    },
    update() {
      if (!themeOn || !ensure() || muted) return;
      const t = ctx.currentTime;
      if (t < nextAt) return;
      const note = melody[step % melody.length];
      tone(196 * 2 ** (note / 12), 0.16, "square", 0.04);
      if (step % 4 === 0) tone(98, 0.18, "triangle", 0.05);
      step += 1;
      nextAt = t + 0.18;
    },
    shot() {
      noise(0.07, 0.18);
      tone(540, 0.09, "sawtooth", 0.05);
    },
    dash() {
      tone(160, 0.14, "square", 0.07);
      tone(240, 0.1, "square", 0.04, 0.04);
    },
    ko() {
      noise(0.18, 0.28);
      tone(120, 0.22, "sine", 0.1);
    },
    pickup() {
      tone(660, 0.07, "square", 0.05);
      tone(880, 0.1, "square", 0.05, 0.06);
    },
    tick() {
      tone(880, 0.08, "square", 0.06);
    },
    round() {
      tone(523, 0.12, "square", 0.06);
      tone(659, 0.14, "square", 0.06, 0.1);
      tone(784, 0.2, "square", 0.06, 0.2);
    },
    fanfare() {
      [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.22, "square", 0.07, i * 0.12));
    },
    ui() {
      tone(440, 0.05, "square", 0.04);
    },
  };
}
