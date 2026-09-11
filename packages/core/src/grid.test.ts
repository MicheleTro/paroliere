import { describe, expect, it } from 'vitest';
import { neighbors, drawTile, drawGrid } from './grid.js';
import { createRng } from './rng.js';
import { TOTAL_TILE_WEIGHT } from './tile.js';

describe('neighbors', () => {
  it('cella d angolo (0,0) ha 3 vicini, in ordine E,S,SE', () => {
    // indice 0 in una griglia 4x4: nessun vicino a ovest/nord
    expect(neighbors(0, 4)).toEqual([1, 4, 5]);
  });

  it('cella centrale ha 8 vicini nell ordine NW,N,NE,W,E,SW,S,SE', () => {
    // indice 5 (riga1,col1) in una griglia 4x4
    expect(neighbors(5, 4)).toEqual([0, 1, 2, 4, 6, 8, 9, 10]);
  });

  it('cella di bordo (non angolo) ha 5 vicini', () => {
    // indice 1 (riga0,col1)
    expect(neighbors(1, 4)).toEqual([0, 2, 4, 5, 6]);
  });

  it('angolo opposto (15) ha 3 vicini, in ordine NW,N,W', () => {
    expect(neighbors(15, 4)).toEqual([10, 11, 14]);
  });
});

describe('drawTile', () => {
  it('estrae sempre una casella valida e coerente con i pesi', () => {
    const rng = createRng(1);
    for (let i = 0; i < 500; i++) {
      const tile = drawTile(rng);
      expect(typeof tile).toBe('string');
    }
  });

  it('e deterministico a parita di seed', () => {
    const a = drawGrid(createRng(42), 4);
    const b = drawGrid(createRng(42), 4);
    expect(a).toEqual(b);
  });

  it('il totale dei pesi e coerente con la tabella (SPEC.md §5.3)', () => {
    expect(TOTAL_TILE_WEIGHT).toBe(
      1179 + 1174 + 1128 + 983 + 688 + 651 + 637 + 562 + 498 + 450 + 373 + 305 + 301 + 251 + 210 +
        164 + 154 + 95 + 92 + 51 + 49,
    );
  });
});

describe('drawGrid', () => {
  it('produce size*size caselle', () => {
    const grid = drawGrid(createRng(5), 4);
    expect(grid.tiles).toHaveLength(16);
    expect(grid.size).toBe(4);
  });
});
