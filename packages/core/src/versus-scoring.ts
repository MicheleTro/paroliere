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
 * Conta per ogni parola in quanti gruppi (partecipanti o squadre) distinti
 * è stata trovata — usato sia per il punteggio ufficiale (RF-24) sia per
 * mostrare il valore effettivo di ogni singola parola nel riepilogo di un
 * match.
 */
export function wordGroupCounts(entries: readonly VersusEntry[]): Map<string, number> {
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
  return groupCountByWord;
}

/** RF-24: doppio del valore base se la parola è di un solo gruppo, altrimenti il valore base. */
export function versusWordValue(word: string, groupCount: number): number {
  return groupCount === 1 ? baseWordValue(word) * 2 : baseWordValue(word);
}

/**
 * RF-24: ogni parola vale il doppio del valore base se trovata da un solo
 * gruppo (partecipante o squadra), il valore base se trovata da almeno due.
 * Il punteggio di una squadra è la somma dei punteggi individuali dei suoi
 * membri (SPEC.md §9): se più membri della stessa squadra trovano la
 * stessa parola, ciascuno la conta per intero nel proprio punteggio.
 */
export function computeVersusScores(entries: readonly VersusEntry[]): Record<string, number> {
  const groupCountByWord = wordGroupCounts(entries);

  const scores: Record<string, number> = {};
  for (const entry of entries) {
    let total = 0;
    for (const word of new Set(entry.words)) {
      total += versusWordValue(word, groupCountByWord.get(word) ?? 0);
    }
    scores[entry.participantId] = total;
  }
  return scores;
}
