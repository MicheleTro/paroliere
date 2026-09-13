const MUTE_KEY = 'paroliere.sound-muted';

// Scala pentatonica maggiore: qualsiasi sequenza di note suona comunque
// gradevole, senza dover armonizzare esplicitamente ogni intervallo.
const SCALE_HZ = [261.63, 293.66, 329.63, 392.0, 440.0];

let audioCtx: AudioContext | undefined;

function getContext(): AudioContext {
  audioCtx ??= new AudioContext();
  if (audioCtx.state === 'suspended') void audioCtx.resume();
  return audioCtx;
}

export function isSoundMuted(): boolean {
  return localStorage.getItem(MUTE_KEY) === '1';
}

export function setSoundMuted(muted: boolean): void {
  localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
}

interface ToneOptions {
  duration?: number;
  type?: OscillatorType;
  gain?: number;
  delay?: number;
}

function tone(freq: number, { duration = 0.12, type = 'sine', gain = 0.15, delay = 0 }: ToneOptions = {}): void {
  if (isSoundMuted()) return;

  const ctx = getContext();
  const osc = ctx.createOscillator();
  const gainNode = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;

  const start = ctx.currentTime + delay;
  gainNode.gain.setValueAtTime(0, start);
  gainNode.gain.linearRampToValueAtTime(gain, start + 0.01);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  osc.connect(gainNode);
  gainNode.connect(ctx.destination);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

/** Nota della scala che sale a ogni lettera aggiunta al percorso corrente (1-based). */
export function playPathTone(letterIndex: number): void {
  const octave = Math.floor(letterIndex / SCALE_HZ.length);
  const freq = SCALE_HZ[letterIndex % SCALE_HZ.length]! * 2 ** octave;
  tone(freq, { duration: 0.1, type: 'sine', gain: 0.12 });
}

/** Accordo "premio" alla conferma di una parola valida. */
export function playWordAccepted(): void {
  const root = SCALE_HZ[0]!;
  tone(root, { duration: 0.18, gain: 0.16 });
  tone(root * 1.25, { duration: 0.18, gain: 0.14, delay: 0.06 });
  tone(root * 1.5, { duration: 0.26, gain: 0.16, delay: 0.12 });
}

/** Parola già trovata: tono neutro, né premio né errore. */
export function playAlreadyFound(): void {
  tone(220, { duration: 0.15, type: 'triangle', gain: 0.1 });
}

/** Parola non valida, troppo corta o percorso non valido. */
export function playRejected(): void {
  tone(180, { duration: 0.12, type: 'square', gain: 0.08 });
  tone(120, { duration: 0.16, type: 'square', gain: 0.08, delay: 0.08 });
}
