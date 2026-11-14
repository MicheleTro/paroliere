import type { Tile } from './tile.js';

export interface GameConfig {
  seed: number;
  size: 4 | 5 | 6;
  durationMs: number;
  minWordLength: number;
  minWords: number;
  scoring: 'classic' | 'versus';
  pointMode: 'standard' | 'speciale';
  positionBonus: boolean;
  generatorVersion: 1;
  dictionaryVersion: string;
  /** Variante "Bonus": moltiplicatori da assegnare a caselle distinte, es. [3, 2]. Assente = nessun bonus. */
  bonusCells?: readonly number[];
  /** Variante "Combo": una parola entro `COMBO_WINDOW_MS` dalla precedente fa salire la combo e vale di più. */
  combo?: boolean;
}

export interface Grid {
  size: number;
  tiles: Tile[];
  /** Moltiplicatore per casella (1 = nessun bonus), in ordine di indice. Presente solo con `config.bonusCells`. */
  multipliers?: number[];
}

export interface Solution {
  word: string;
  path: number[];
}
