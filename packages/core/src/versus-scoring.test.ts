import { describe, expect, it } from 'vitest';
import { computeVersusScores, type VersusEntry } from './versus-scoring.js';

describe('computeVersusScores — RF-24', () => {
  it('raddoppia il valore base di una parola trovata da un solo partecipante', () => {
    const entries: VersusEntry[] = [
      { participantId: 'a', groupId: 'a', words: ['casa'] }, // 4 lettere -> base 1
      { participantId: 'b', groupId: 'b', words: [] },
    ];
    expect(computeVersusScores(entries)).toEqual({ a: 2, b: 0 });
  });

  it('assegna il valore base a una parola trovata da almeno due partecipanti', () => {
    const entries: VersusEntry[] = [
      { participantId: 'a', groupId: 'a', words: ['casa'] },
      { participantId: 'b', groupId: 'b', words: ['casa'] },
    ];
    expect(computeVersusScores(entries)).toEqual({ a: 1, b: 1 });
  });

  it('somma i valori delle parole distinte trovate da un partecipante', () => {
    const entries: VersusEntry[] = [
      { participantId: 'a', groupId: 'a', words: ['casa', 'abcdefgh'] }, // base 1 (unica) + base 11 (unica)
      { participantId: 'b', groupId: 'b', words: [] },
    ];
    expect(computeVersusScores(entries)).toEqual({ a: 1 * 2 + 11 * 2, b: 0 });
  });

  it('ignora i duplicati della stessa parola nello stesso partecipante', () => {
    const entries: VersusEntry[] = [{ participantId: 'a', groupId: 'a', words: ['casa', 'casa'] }];
    expect(computeVersusScores(entries)).toEqual({ a: 2 });
  });

  it('in modalità a squadre valuta l\'unicità a livello di squadra (groupId), non di singolo membro', () => {
    const entries: VersusEntry[] = [
      { participantId: 'a1', groupId: 'team-a', words: ['casa'] },
      { participantId: 'a2', groupId: 'team-a', words: ['casa'] },
      { participantId: 'b1', groupId: 'team-b', words: [] },
    ];
    // "casa" trovata da un solo gruppo (team-a) -> doppio, applicato a ciascun membro che l'ha trovata
    expect(computeVersusScores(entries)).toEqual({ a1: 2, a2: 2, b1: 0 });
  });

  it('somma i punteggi individuali per ottenere il punteggio di squadra', () => {
    const entries: VersusEntry[] = [
      { participantId: 'a1', groupId: 'team-a', words: ['casa'] },
      { participantId: 'a2', groupId: 'team-a', words: ['moto'] },
    ];
    const scores = computeVersusScores(entries);
    const teamScore = scores.a1! + scores.a2!;
    expect(teamScore).toBe(4);
  });
});
