import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createRng } from './rng.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesPath = join(__dirname, '..', '..', '..', 'fixtures', 'prng.json');

interface PrngFixture {
  seed: number;
  nextUint32: number[];
  nextInt: number[];
}

const fixtures: PrngFixture[] = JSON.parse(readFileSync(fixturesPath, 'utf-8'));
const N_VALUES = [1, 2, 3, 5, 10, 100, 1000, 999999, 1048576];

describe('createRng (Mulberry32)', () => {
  it.each(fixtures)('produce i valori delle fixture per seed=$seed', (fixture) => {
    const rngForUint32 = createRng(fixture.seed);
    const nextUint32 = fixture.nextUint32.map(() => rngForUint32.nextUint32());
    expect(nextUint32).toEqual(fixture.nextUint32);

    const rngForInt = createRng(fixture.seed);
    const nextInt = fixture.nextInt.map((_, i) => rngForInt.nextInt(N_VALUES[i % N_VALUES.length]!));
    expect(nextInt).toEqual(fixture.nextInt);
  });

  it('e deterministico: stesso seed produce la stessa sequenza', () => {
    const a = createRng(7);
    const b = createRng(7);
    for (let i = 0; i < 10; i++) {
      expect(a.nextUint32()).toBe(b.nextUint32());
    }
  });

  it('nextUint32 resta un uint32 valido', () => {
    const rng = createRng(123);
    for (let i = 0; i < 100; i++) {
      const v = rng.nextUint32();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(0xffffffff);
      expect(Number.isInteger(v)).toBe(true);
    }
  });

  it('nextInt(n) resta in [0, n)', () => {
    const rng = createRng(999);
    for (let i = 0; i < 200; i++) {
      const v = rng.nextInt(21);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(21);
    }
  });
});
