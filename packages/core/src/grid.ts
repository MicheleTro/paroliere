import type { Rng } from './rng.js';
import { TILE_WEIGHTS, TOTAL_TILE_WEIGHT, type Tile } from './tile.js';
import type { Grid } from './types.js';

/** Offset di riga/colonna nell'ordine normativo NW, N, NE, W, E, SW, S, SE. */
const NEIGHBOR_OFFSETS: ReadonlyArray<readonly [number, number]> = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1],
];

export function neighbors(index: number, size: number): number[] {
  const row = Math.floor(index / size);
  const col = index % size;
  const result: number[] = [];
  for (const [dRow, dCol] of NEIGHBOR_OFFSETS) {
    const r = row + dRow;
    const c = col + dCol;
    if (r >= 0 && r < size && c >= 0 && c < size) {
      result.push(r * size + c);
    }
  }
  return result;
}

export function drawTile(rng: Rng): Tile {
  const r = rng.nextInt(TOTAL_TILE_WEIGHT);
  let cumulative = 0;
  for (const [tile, weight] of TILE_WEIGHTS) {
    cumulative += weight;
    if (cumulative > r) return tile;
  }
  // Inarrivabile: la somma dei pesi copre [0, TOTAL_TILE_WEIGHT).
  throw new Error('drawTile: peso non trovato per r=' + r);
}

export function drawGrid(rng: Rng, size: number): Grid {
  const tiles: Tile[] = [];
  for (let i = 0; i < size * size; i++) {
    tiles.push(drawTile(rng));
  }
  return { size, tiles };
}
