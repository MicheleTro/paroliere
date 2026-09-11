export interface Rng {
  nextUint32(): number;
  /** Richiede 1 <= n <= 2^20: il prodotto resta intero esatto in un double. */
  nextInt(n: number): number;
}

export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  return {
    nextUint32(): number {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return (t ^ (t >>> 14)) >>> 0;
    },
    nextInt(n: number): number {
      return Math.floor((this.nextUint32() * n) / 4294967296);
    },
  };
}
