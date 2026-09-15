export type Tile =
  | 'a'
  | 'b'
  | 'c'
  | 'd'
  | 'e'
  | 'f'
  | 'g'
  | 'h'
  | 'i'
  | 'l'
  | 'm'
  | 'n'
  | 'o'
  | 'p'
  | 'qu'
  | 'r'
  | 's'
  | 't'
  | 'u'
  | 'v'
  | 'z';

/** Ordine normativo delle lettere per pesi di frequenza (SPEC.md §5.3). */
export const TILE_WEIGHTS: ReadonlyArray<readonly [Tile, number]> = [
  ['e', 1179],
  ['a', 1174],
  ['i', 1128],
  ['o', 983],
  ['n', 688],
  ['l', 651],
  ['r', 637],
  ['t', 562],
  ['s', 498],
  ['c', 450],
  ['d', 373],
  ['p', 305],
  ['u', 301],
  ['m', 251],
  ['v', 210],
  ['g', 164],
  ['h', 154],
  ['f', 95],
  ['b', 92],
  ['qu', 51],
  ['z', 49],
];

export const TOTAL_TILE_WEIGHT: number = TILE_WEIGHTS.reduce((sum, [, w]) => sum + w, 0);

/** Valore in punti di ogni lettera per la modalità di punteggio "speciale". */
export const TILE_VALUES: Record<Tile, number> = {
  a: 1,
  b: 4,
  c: 2,
  d: 3,
  e: 2,
  f: 5,
  g: 4,
  h: 10,
  i: 2,
  l: 3,
  m: 3,
  n: 2,
  o: 2,
  p: 3,
  qu: 9,
  r: 1,
  s: 2,
  t: 1,
  u: 5,
  v: 4,
  z: 8,
};

/** Numero di lettere di una casella: `qu` conta come 2 (RF-02). */
export function tileLetterCount(tile: Tile): number {
  return tile === 'qu' ? 2 : 1;
}
