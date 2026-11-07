/**
 * Synthesizes crisp, energetic UI & notification chimes using Web Audio API
 * (Zero external audio file dependencies — works offline on PC, iOS, and Android).
 */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctx) return null;
  if (!audioCtx) {
    audioCtx = new Ctx();
  }
  if (audioCtx.state === 'suspended') {
    void audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

function playTone(
  ctx: AudioContext,
  freq: number,
  startOffset: number,
  duration: number,
  type: OscillatorType = 'sine',
  gainPeak = 0.16
): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime + startOffset);

  gain.gain.setValueAtTime(0.0001, ctx.currentTime + startOffset);
  gain.gain.exponentialRampToValueAtTime(
    gainPeak,
    ctx.currentTime + startOffset + 0.02
  );
  gain.gain.exponentialRampToValueAtTime(
    0.0001,
    ctx.currentTime + startOffset + duration
  );

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(ctx.currentTime + startOffset);
  osc.stop(ctx.currentTime + startOffset + duration + 0.02);
}

export function playCompleteSound(enabled = true): void {
  if (!enabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  playTone(ctx, 587.33, 0, 0.11, 'triangle', 0.14); // D5
  playTone(ctx, 880.0, 0.08, 0.18, 'triangle', 0.16); // A5
}

export function playReminderSound(
  kind: 'todo' | 'submission' | 'meeting' | 'briefing' | 'test' = 'todo',
  enabled = true
): void {
  if (!enabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  if (kind === 'submission') {
    // Urgent upbeat triple chime for Submissions / Deadlines
    playTone(ctx, 659.25, 0, 0.14, 'triangle', 0.22); // E5
    playTone(ctx, 880.0, 0.14, 0.14, 'triangle', 0.22); // A5
    playTone(ctx, 1046.5, 0.28, 0.28, 'sine', 0.25); // C6
    playTone(ctx, 1046.5, 0.62, 0.28, 'sine', 0.22); // C6 repeat
    return;
  }

  // Pleasant two-step marimba-like chime
  playTone(ctx, 523.25, 0, 0.16, 'sine', 0.18); // C5
  playTone(ctx, 783.99, 0.15, 0.26, 'sine', 0.2); // G5
}
