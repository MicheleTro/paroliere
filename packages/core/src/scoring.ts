import type { Grid } from './types.js';

export interface ScoringRule {
  id: string;
  scoreWord(word: string, path: number[], grid: Grid): number;
}

/**
 * RF-12: punti = lunghezza della parola − 2 (3 lettere = 1 punto, 4 = 2, 5 = 3, ...),
 * con un bonus crescente da 6 lettere in su (+1 a 6, +2 a 7, +3 a 8, ...) per premiare
 * chi cerca le parole più lunghe.
 */
export function baseWordValue(word: string): number {
  return word.length - 2 + Math.max(0, word.length - 5);
}

export const classicScoring: ScoringRule = {
  id: 'classic',
  scoreWord(word: string): number {
    return baseWordValue(word);
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
  scoreWord(word: string): number {
    return baseWordValue(word);
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
