import { createRng } from './rng.js';

/**
 * Caselle moltiplicatrici (variante "Bonus"): un moltiplicatore per ogni valore di `spec` (es. [3, 2] = una casella ×3
 * e una ×2), su caselle distinte. Le posizioni derivano dal seed con un PRNG **separato** da quello della griglia
 * (sale diverso), così la griglia di un seed non cambia mai se si attiva il bonus: le fixture del generatore restano valide.
 *
 * Restituisce un moltiplicatore per ogni casella (1 dove non c'è bonus), in ordine di indice.
 */
const BONUS_SALT = 0x5bd1e995;

export function drawBonusMultipliers(seed: number, size: number, spec: readonly number[]): number[] {
  const cells = size * size;
  if (spec.length > cells) throw new RangeError(`drawBonusMultipliers: ${spec.length} bonus non entrano in ${cells} caselle`);
  const multipliers = new Array<number>(cells).fill(1);
  const rng = createRng((seed ^ BONUS_SALT) >>> 0);

  for (const multiplier of spec) {
    if (!Number.isInteger(multiplier) || multiplier < 2) {
      throw new RangeError(`drawBonusMultipliers: moltiplicatore non valido (${multiplier})`);
    }
    let index = rng.nextInt(cells);
    // Collisione: si scorre alla prima casella libera, in modo deterministico.
    while (multipliers[index] !== 1) index = (index + 1) % cells;
    multipliers[index] = multiplier;
  }
  return multipliers;
}

/** Prodotto dei moltiplicatori delle caselle attraversate dal percorso. */
export function pathMultiplier(path: readonly number[], multipliers: readonly number[] | undefined): number {
  if (!multipliers) return 1;
  let product = 1;
  for (const index of path) product *= multipliers[index] ?? 1;
  return product;
}
