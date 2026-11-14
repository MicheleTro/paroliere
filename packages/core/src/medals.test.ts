import { describe, expect, it } from 'vitest';

import { DEFAULT_MEDALS, getMedal, medalsEarned, newMedals, type MedalDefinition, type MedalSnapshot } from './medals.js';

const EMPTY: MedalSnapshot = {
  totalWords: 0,
  gamesPlayed: 0,
  longestWordLength: 0,
  maxWordsInGame: 0,
  level: 1,
  weeklyGridsPlayed: 0,
  bestWeekGridsPlayed: 0,
  bestWeekOnTime: 0,
  variantsPlayed: 0,
  variantsTotal: 7,
  streakCycles: 0,
};

describe('catalogo', () => {
  it('ha 14 medaglie con id unici', () => {
    expect(DEFAULT_MEDALS).toHaveLength(14);
    expect(new Set(DEFAULT_MEDALS.map((m) => m.id)).size).toBe(14);
  });

  it('non contiene "Primo posto" (rimossa per ora)', () => {
    expect(getMedal('primo-posto')).toBeUndefined();
  });
});

describe('medalsEarned', () => {
  it('uno stato vuoto non assegna nulla', () => {
    expect(medalsEarned(EMPTY)).toEqual([]);
  });

  it('la prima partita con una parola dà le due medaglie di inizio', () => {
    expect(medalsEarned({ ...EMPTY, totalWords: 1, gamesPlayed: 1 })).toEqual(['prima-parola', 'prima-partita']);
  });

  it.each([
    ['cento-parole', { totalWords: 99 }, { totalWords: 100 }],
    ['mille-parole', { totalWords: 999 }, { totalWords: 1_000 }],
    ['diecimila-parole', { totalWords: 9_999 }, { totalWords: 10_000 }],
    ['settebello', { longestWordLength: 6 }, { longestWordLength: 7 }],
    ['nove-lettere', { longestWordLength: 8 }, { longestWordLength: 9 }],
    ['raccolto', { maxWordsInGame: 29 }, { maxWordsInGame: 30 }],
    ['livello-10', { level: 9 }, { level: 10 }],
    ['prima-settimana', { weeklyGridsPlayed: 0 }, { weeklyGridsPlayed: 1 }],
    ['settimana-piena', { bestWeekGridsPlayed: 6 }, { bestWeekGridsPlayed: 7 }],
    ['puntuale', { bestWeekOnTime: 6 }, { bestWeekOnTime: 7 }],
    ['tuttofare', { variantsPlayed: 6 }, { variantsPlayed: 7 }],
    ['ciclo-completo', { streakCycles: 0 }, { streakCycles: 1 }],
  ] as const)('%s scatta alla soglia', (id, below, at) => {
    expect(medalsEarned({ ...EMPTY, ...below })).not.toContain(id);
    expect(medalsEarned({ ...EMPTY, ...at })).toContain(id);
  });

  it('"Tuttofare" segue il catalogo: se le varianti cambiano, cambia la soglia', () => {
    expect(medalsEarned({ ...EMPTY, variantsPlayed: 5, variantsTotal: 5 })).toContain('tuttofare');
    expect(medalsEarned({ ...EMPTY, variantsPlayed: 5, variantsTotal: 6 })).not.toContain('tuttofare');
  });

  it('"Tuttofare" non scatta con un catalogo vuoto', () => {
    expect(medalsEarned({ ...EMPTY, variantsPlayed: 0, variantsTotal: 0 })).not.toContain('tuttofare');
  });
});

describe('newMedals', () => {
  it('restituisce solo quelle non ancora possedute', () => {
    const snapshot = { ...EMPTY, totalWords: 100, gamesPlayed: 3 };
    const nuove = newMedals(snapshot, ['prima-parola', 'prima-partita']);
    expect(nuove.map((m) => m.id)).toEqual(['cento-parole']);
  });

  it('niente di nuovo se le ha già tutte', () => {
    const snapshot = { ...EMPTY, totalWords: 1, gamesPlayed: 1 };
    expect(newMedals(snapshot, ['prima-parola', 'prima-partita'])).toEqual([]);
  });
});

describe('definizioni personalizzate (dal database)', () => {
  const custom: MedalDefinition[] = [
    { id: 'duemila', name: 'Duemila', description: '2.000 parole', kind: 'parole', metric: 'totalWords', threshold: 2_000 },
    { id: 'quindici', name: 'Quindici', description: 'Livello 15', kind: 'livello', metric: 'level', threshold: 15 },
  ];

  it('valutano soglie e metriche a piacere, senza toccare il codice', () => {
    expect(medalsEarned({ ...EMPTY, totalWords: 2_000 }, custom)).toEqual(['duemila']);
    expect(newMedals({ ...EMPTY, totalWords: 2_000, level: 15 }, ['duemila'], custom).map((m) => m.id)).toEqual(['quindici']);
  });

  it('con un catalogo vuoto non assegnano nulla', () => {
    expect(medalsEarned({ ...EMPTY, totalWords: 99_999 }, [])).toEqual([]);
  });
});
