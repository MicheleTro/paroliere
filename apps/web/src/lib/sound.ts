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

interface WhistleOptions {
  from: number;
  to: number;
  duration: number;
  delay: number;
  gain: number;
}

/** Sibilo che sale di tono, come il lancio di un razzo pirotecnico. */
function whistleUp(ctx: AudioContext, { from, to, duration, delay, gain }: WhistleOptions): void {
  const osc = ctx.createOscillator();
  const gainNode = ctx.createGain();
  osc.type = 'sine';

  const start = ctx.currentTime + delay;
  osc.frequency.setValueAtTime(from, start);
  osc.frequency.exponentialRampToValueAtTime(to, start + duration);

  gainNode.gain.setValueAtTime(0, start);
  gainNode.gain.linearRampToValueAtTime(gain, start + duration * 0.6);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  osc.connect(gainNode);
  gainNode.connect(ctx.destination);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

interface NoiseBurstOptions {
  duration: number;
  delay: number;
  gain: number;
  filterFreq: number;
  filterType: BiquadFilterType;
}

/** Scoppio di rumore bianco filtrato: lo "crack" di un fuoco d'artificio. */
function noiseBurst(ctx: AudioContext, { duration, delay, gain, filterFreq, filterType }: NoiseBurstOptions): void {
  const start = ctx.currentTime + delay;
  const sampleCount = Math.max(1, Math.floor(ctx.sampleRate * duration));
  const buffer = ctx.createBuffer(1, sampleCount, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < sampleCount; i++) data[i] = Math.random() * 2 - 1;

  const noise = ctx.createBufferSource();
  noise.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = filterType;
  filter.frequency.value = filterFreq;

  const gainNode = ctx.createGain();
  gainNode.gain.setValueAtTime(0, start);
  gainNode.gain.linearRampToValueAtTime(gain, start + 0.005);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  noise.connect(filter);
  filter.connect(gainNode);
  gainNode.connect(ctx.destination);
  noise.start(start);
  noise.stop(start + duration + 0.02);
}

/**
 * Mini fuoco d'artificio: sibilo di lancio, scoppio (crack + boom) e scintille
 * che scrocchiano a intervalli casuali mentre si spengono.
 */
function playFireworks(): void {
  if (isSoundMuted()) return;
  const ctx = getContext();

  whistleUp(ctx, { from: 500, to: 1600, duration: 0.16, delay: 0, gain: 0.07 });
  noiseBurst(ctx, { duration: 0.22, delay: 0.15, gain: 0.28, filterFreq: 2800, filterType: 'highpass' });
  noiseBurst(ctx, { duration: 0.3, delay: 0.15, gain: 0.16, filterFreq: 350, filterType: 'lowpass' });

  const sparkleCount = 6;
  for (let i = 0; i < sparkleCount; i++) {
    const delay = 0.22 + Math.random() * 0.3;
    const freq = 1800 + Math.random() * 1800;
    tone(freq, { duration: 0.05 + Math.random() * 0.05, type: 'triangle', gain: 0.06, delay });
  }
}

/** Nota della scala che sale a ogni lettera aggiunta al percorso corrente (1-based). */
export function playPathTone(letterIndex: number): void {
  const octave = Math.floor(letterIndex / SCALE_HZ.length);
  const freq = SCALE_HZ[letterIndex % SCALE_HZ.length]! * 2 ** octave;
  tone(freq, { duration: 0.1, type: 'sine', gain: 0.12 });
}

/**
 * Accordo "premio" alla conferma di una parola valida. Dalle 6 lettere in su
 * (bonus di punteggio, vedi baseWordValue) si aggiunge un mini fuoco d'artificio
 * per festeggiare la parola lunga.
 */
export function playWordAccepted(wordLength: number): void {
  const root = SCALE_HZ[0]!;
  tone(root, { duration: 0.18, gain: 0.16 });
  tone(root * 1.25, { duration: 0.18, gain: 0.14, delay: 0.06 });
  tone(root * 1.5, { duration: 0.26, gain: 0.16, delay: 0.12 });
  if (wordLength >= 6) {
    playFireworks();
  }
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
