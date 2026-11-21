// The plop. A short sine drop, synthesized so there are no audio files to load.
// Browsers only allow sound after a user gesture, so the context starts lazily.
let ctx: AudioContext | null = null;
let muted = false;

export function setMuted(value: boolean) {
  muted = value;
}

export function plopSound(pitch = 1) {
  if (muted || typeof window === "undefined") return;
  try {
    ctx ??= new AudioContext();
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(520 * pitch, t);
    osc.frequency.exponentialRampToValueAtTime(80 * pitch, t + 0.13);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.22, t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.18);
  } catch {
    // No audio here; the app works the same without it.
  }
}
