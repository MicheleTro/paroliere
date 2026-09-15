import { cellPosition, POSITION_MULTIPLIER } from './grid.js';
import { TILE_VALUES } from './tile.js';
import type { GameConfig, Grid } from './types.js';

export type ScoringOptions = Pick<GameConfig, 'pointMode' | 'positionBonus'>;

export interface ScoringRule {
  id: string;
  scoreWord(word: string, path: number[], grid: Grid, options: ScoringOptions): number;
}

/**
 * RF-12: punti = lunghezza della parola − 2 (3 lettere = 1 punto, 4 = 2, 5 = 3, ...),
 * con un bonus crescente da 6 lettere in su (+1 a 6, +2 a 7, +3 a 8, ...) per premiare
 * chi cerca le parole più lunghe. Componente sempre presente, sia in "standard" che
 * in "speciale".
 */
export function baseWordValue(word: string): number {
  return word.length - 2 + Math.max(0, word.length - 5);
}

/** Valore "unitario" di una lettera: fisso a 1 in "standard", tabellare in "speciale". */
function letterUnitValue(tile: Grid['tiles'][number], pointMode: ScoringOptions['pointMode']): number {
  return pointMode === 'speciale' ? TILE_VALUES[tile] : 1;
}

/**
 * Punteggio di una parola secondo la configurazione della partita: al valore
 * base (RF-12) si somma, se "speciale", il valore delle lettere, e se
 * "Bonus Posizione" è attivo, l'extra dato dal moltiplicatore di posizione
 * (x1 centro, x2 lato, x3 angolo) applicato al valore unitario di ciascuna
 * lettera del percorso.
 */
export function wordValue(word: string, path: number[], grid: Grid, options: ScoringOptions): number {
  let value = baseWordValue(word);

  if (options.pointMode === 'speciale') {
    for (const index of path) {
      value += TILE_VALUES[grid.tiles[index]!];
    }
  }

  if (options.positionBonus) {
    for (const index of path) {
      const unit = letterUnitValue(grid.tiles[index]!, options.pointMode);
      const multiplier = POSITION_MULTIPLIER[cellPosition(index, grid.size)];
      value += unit * (multiplier - 1);
    }
  }

  return value;
}

export const classicScoring: ScoringRule = {
  id: 'classic',
  scoreWord(word, path, grid, options) {
    return wordValue(word, path, grid, options);
  },
};

/**
 * Punteggio dal vivo per una partita 'versus': mostra il valore base come in
 * 'classic'. Il punteggio ufficiale (RF-24, doppio se unica) si calcola solo
 * a fine match con computeVersusScores, quando il server conosce le parole
 * di tutti i partecipanti.
 */
export const versusScoring: ScoringRule = {
  id: 'versus',
  scoreWord(word, path, grid, options) {
    return wordValue(word, path, grid, options);
  },
};

const registry = new Map<string, ScoringRule>([
  [classicScoring.id, classicScoring],
  [versusScoring.id, versusScoring],
]);

export function registerScoringRule(rule: ScoringRule): void {
  registry.set(rule.id, rule);
}

export function getScoringRule(id: string): ScoringRule {
  const rule = registry.get(id);
  if (!rule) throw new Error(`getScoringRule: regola non registrata "${id}"`);
  return rule;
}

/**
 * Solo le partite con punteggio "standard" e senza "Bonus Posizione"
 * concorrono alle statistiche aggregate: le altre modalità falserebbero i
 * confronti (parole/punteggi non comparabili tra configurazioni diverse).
 */
export function countsTowardStats(config: Pick<GameConfig, 'pointMode' | 'positionBonus'>): boolean {
  return config.pointMode === 'standard' && !config.positionBonus;
}
