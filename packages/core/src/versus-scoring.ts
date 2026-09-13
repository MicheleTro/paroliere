import { baseWordValue } from './scoring.js';

/**
 * Una riga per partecipante: `groupId` è l'unità con cui si valuta
 * l'unicità di una parola (RF-24) — coincide con `participantId` in
 * modalità individuale, con l'id della squadra in modalità a squadre.
 */
export interface VersusEntry {
  participantId: string;
  groupId: string;
  words: readonly string[];
}

/**
 * RF-24: ogni parola vale il doppio del valore base se trovata da un solo
 * gruppo (partecipante o squadra), il valore base se trovata da almeno due.
 * Il punteggio di una squadra è la somma dei punteggi individuali dei suoi
 * membri (SPEC.md §9): se più membri della stessa squadra trovano la
 * stessa parola, ciascuno la conta per intero nel proprio punteggio.
 */
export function computeVersusScores(entries: readonly VersusEntry[]): Record<string, number> {
  const wordsByGroup = new Map<string, Set<string>>();
  for (const entry of entries) {
    const words = wordsByGroup.get(entry.groupId) ?? new Set<string>();
    for (const word of entry.words) words.add(word);
    wordsByGroup.set(entry.groupId, words);
  }

  const groupCountByWord = new Map<string, number>();
  for (const words of wordsByGroup.values()) {
    for (const word of words) {
      groupCountByWord.set(word, (groupCountByWord.get(word) ?? 0) + 1);
    }
  }

  const scores: Record<string, number> = {};
  for (const entry of entries) {
    let total = 0;
    for (const word of new Set(entry.words)) {
      const groupCount = groupCountByWord.get(word) ?? 0;
      total += groupCount === 1 ? baseWordValue(word) * 2 : baseWordValue(word);
    }
    scores[entry.participantId] = total;
  }
  return scores;
}
