import { describe, expect, it } from 'vitest';

import {
  addDays,
  applyPlay,
  calendarDay,
  daysBetween,
  effectiveStreakDays,
  INITIAL_STREAK,
  weekdayIndex,
  weekStart,
  type StreakState,
} from './streak.js';

describe('giorni di calendario', () => {
  it('calcola le differenze anche a cavallo di mese, anno e febbraio bisestile', () => {
    expect(daysBetween('2026-11-12', '2026-11-13')).toBe(1);
    expect(daysBetween('2026-12-31', '2027-01-01')).toBe(1);
    expect(daysBetween('2028-02-28', '2028-03-01')).toBe(2);
    expect(daysBetween('2026-11-13', '2026-11-12')).toBe(-1);
  });

  it('somma giorni', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('lunedì è 0 e domenica è 6, e la settimana parte da lunedì', () => {
    expect(weekdayIndex('2026-11-09')).toBe(0); // lunedì
    expect(weekdayIndex('2026-11-15')).toBe(6); // domenica
    expect(weekStart('2026-11-15')).toBe('2026-11-09');
    expect(weekStart('2026-11-09')).toBe('2026-11-09');
  });

  it('rifiuta formati non validi', () => {
    expect(() => daysBetween('13/11/2026', '2026-11-14')).toThrow(RangeError);
  });
});

describe('calendarDay (Europe/Rome)', () => {
  it('usa il giorno di Roma, non quello UTC', () => {
    // 23:30 UTC del 12 novembre sono le 00:30 del 13 a Roma (ora solare, UTC+1)
    expect(calendarDay(new Date('2026-11-12T23:30:00Z'))).toBe('2026-11-13');
    expect(calendarDay(new Date('2026-11-12T22:30:00Z'))).toBe('2026-11-12');
  });

  it("segue l'ora legale", () => {
    // 22:30 UTC del 10 luglio sono le 00:30 dell'11 a Roma (ora legale, UTC+2)
    expect(calendarDay(new Date('2026-07-10T22:30:00Z'))).toBe('2026-07-11');
    expect(calendarDay(new Date('2026-07-10T21:30:00Z'))).toBe('2026-07-10');
  });

  it('nel giorno del cambio ora il giorno resta quello di calendario', () => {
    // 29 marzo 2026: alle 02:00 si passa alle 03:00
    expect(calendarDay(new Date('2026-03-28T23:30:00Z'))).toBe('2026-03-29');
    expect(calendarDay(new Date('2026-03-29T21:59:00Z'))).toBe('2026-03-29');
    expect(calendarDay(new Date('2026-03-29T22:00:00Z'))).toBe('2026-03-30');
  });
});

describe('applyPlay', () => {
  it('la prima partita avvia la serie a 1', () => {
    const update = applyPlay(INITIAL_STREAK, '2026-11-13');
    expect(update.state).toEqual({ days: 1, lastDay: '2026-11-13', cycles: 0, helps: 0 });
    expect(update.extendedToday).toBe(true);
    expect(update.cycleCompleted).toBe(false);
  });

  it('più partite nello stesso giorno non cambiano nulla', () => {
    const first = applyPlay(INITIAL_STREAK, '2026-11-13').state;
    const second = applyPlay(first, '2026-11-13');
    expect(second.state).toEqual(first);
    expect(second.extendedToday).toBe(false);
  });

  it('giorni consecutivi fanno salire la serie', () => {
    let state: StreakState = INITIAL_STREAK;
    for (const day of ['2026-11-13', '2026-11-14', '2026-11-15']) state = applyPlay(state, day).state;
    expect(state.days).toBe(3);
  });

  it('un giorno saltato riporta la serie a 1 senza premio', () => {
    const state: StreakState = { days: 7, lastDay: '2026-11-10', cycles: 0, helps: 0 };
    const update = applyPlay(state, '2026-11-12');
    expect(update.state).toEqual({ days: 1, lastDay: '2026-11-12', cycles: 0, helps: 0 });
  });

  it('il decimo giorno consegna un aiuto e riparte da zero', () => {
    const state: StreakState = { days: 9, lastDay: '2026-11-12', cycles: 0, helps: 0 };
    const update = applyPlay(state, '2026-11-13');
    expect(update.cycleCompleted).toBe(true);
    expect(update.state).toEqual({ days: 0, lastDay: '2026-11-13', cycles: 1, helps: 1 });
  });

  it('dopo il ciclo, il giorno dopo riparte da 1 e gli aiuti si accumulano', () => {
    let state: StreakState = { days: 9, lastDay: '2026-11-12', cycles: 1, helps: 1 };
    state = applyPlay(state, '2026-11-13').state; // chiude il secondo ciclo
    expect(state).toMatchObject({ days: 0, cycles: 2, helps: 2 });
    state = applyPlay(state, '2026-11-14').state;
    expect(state.days).toBe(1);
  });

  it('un ciclo completo di 10 giorni consecutivi da zero', () => {
    let state: StreakState = INITIAL_STREAK;
    let completed = 0;
    for (let i = 0; i < 10; i++) {
      const update = applyPlay(state, addDays('2026-11-01', i));
      if (update.cycleCompleted) completed++;
      state = update.state;
    }
    expect(completed).toBe(1);
    expect(state).toMatchObject({ days: 0, cycles: 1, helps: 1 });
  });

  it('rifiuta un giorno precedente a quello registrato', () => {
    const state: StreakState = { days: 2, lastDay: '2026-11-13', cycles: 0, helps: 0 };
    expect(() => applyPlay(state, '2026-11-12')).toThrow(RangeError);
  });
});

describe('effectiveStreakDays', () => {
  const state: StreakState = { days: 4, lastDay: '2026-11-12', cycles: 0, helps: 0 };

  it('oggi e ieri la serie è valida', () => {
    expect(effectiveStreakDays(state, '2026-11-12')).toBe(4);
    expect(effectiveStreakDays(state, '2026-11-13')).toBe(4);
  });

  it('dopo un giorno intero senza partite è azzerata', () => {
    expect(effectiveStreakDays(state, '2026-11-14')).toBe(0);
  });

  it('senza partite è zero', () => {
    expect(effectiveStreakDays(INITIAL_STREAK, '2026-11-14')).toBe(0);
  });
});
