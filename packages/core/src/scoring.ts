import type { Grid } from './types.js';

export interface ScoringRule {
  id: string;
  scoreWord(word: string, path: number[], grid: Grid): number;
}

/** RF-12: 3-4 lettere = 1 punto, 5 = 2, 6 = 3, 7 = 5, 8+ = 11. */
export function baseWordValue(word: string): number {
  const length = word.length;
  if (length <= 4) return 1;
  if (length === 5) return 2;
  if (length === 6) return 3;
  if (length === 7) return 5;
  return 11;
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
