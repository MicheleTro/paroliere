import { describe, expect, it } from 'vitest';
import { computeVersusScores, type VersusEntry } from './versus-scoring.js';

describe('computeVersusScores — RF-24', () => {
  it('raddoppia il valore base di una parola trovata da un solo partecipante', () => {
    const entries: VersusEntry[] = [
      { participantId: 'a', groupId: 'a', words: new Map([['casa', 2]]) }, // 4 lettere -> base 2
      { participantId: 'b', groupId: 'b', words: new Map() },
    ];
    expect(computeVersusScores(entries)).toEqual({ a: 4, b: 0 });
  });

  it('assegna il valore base a una parola trovata da almeno due partecipanti', () => {
    const entries: VersusEntry[] = [
      { participantId: 'a', groupId: 'a', words: new Map([['casa', 2]]) },
      { participantId: 'b', groupId: 'b', words: new Map([['casa', 2]]) },
    ];
    expect(computeVersusScores(entries)).toEqual({ a: 2, b: 2 });
  });

  it('somma i valori delle parole distinte trovate da un partecipante', () => {
    const entries: VersusEntry[] = [
      { participantId: 'a', groupId: 'a', words: new Map([['casa', 2], ['abcdefgh', 9]]) }, // base 2 (unica) + base 9 (unica)
      { participantId: 'b', groupId: 'b', words: new Map() },
    ];
    expect(computeVersusScores(entries)).toEqual({ a: 2 * 2 + 9 * 2, b: 0 });
  });

  it('in modalità a squadre valuta l\'unicità a livello di squadra (groupId), non di singolo membro', () => {
    const entries: VersusEntry[] = [
      { participantId: 'a1', groupId: 'team-a', words: new Map([['casa', 2]]) },
      { participantId: 'a2', groupId: 'team-a', words: new Map([['casa', 2]]) },
      { participantId: 'b1', groupId: 'team-b', words: new Map() },
    ];
    // "casa" trovata da un solo gruppo (team-a) -> doppio, applicato a ciascun membro che l'ha trovata
    expect(computeVersusScores(entries)).toEqual({ a1: 4, a2: 4, b1: 0 });
  });

  it('somma i punteggi individuali per ottenere il punteggio di squadra', () => {
    const entries: VersusEntry[] = [
      { participantId: 'a1', groupId: 'team-a', words: new Map([['casa', 2]]) },
      { participantId: 'a2', groupId: 'team-a', words: new Map([['moto', 2]]) },
    ];
    const scores = computeVersusScores(entries);
    const teamScore = scores.a1! + scores.a2!;
    expect(teamScore).toBe(8);
  });

  it('usa il valore base già calcolato per la parola (coerente con speciale/Bonus Posizione)', () => {
    const entries: VersusEntry[] = [
      { participantId: 'a', groupId: 'a', words: new Map([['zar', 15]]) }, // valore "speciale" già maggiorato
      { participantId: 'b', groupId: 'b', words: new Map() },
    ];
    expect(computeVersusScores(entries)).toEqual({ a: 30, b: 0 });
  });
});
