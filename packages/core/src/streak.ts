/**
 * Serie: giorni consecutivi con almeno una partita (SPEC.md §11.1). Cicli da 10 giorni: al decimo si riceve un aiuto
 * e la serie riparte da zero. Un giorno senza partite azzera senza premio. I giorni sono date di calendario
 * `YYYY-MM-DD` già calcolate nel fuso del gioco (vedi `calendarDay`), così l'ora legale non sposta nulla.
 */

export const STREAK_CYCLE_DAYS = 10;

export interface StreakState {
  /** Giorni consecutivi nel ciclo corrente, 0..9. */
  days: number;
  /** Ultimo giorno con una partita, o null. */
  lastDay: string | null;
  /** Cicli da 10 giorni completati. */
  cycles: number;
  /** Aiuti (+10 s) disponibili. */
  helps: number;
}

export interface StreakUpdate {
  state: StreakState;
  /** Vero se questa partita ha chiuso un ciclo da 10 giorni (aiuto assegnato). */
  cycleCompleted: boolean;
  /** Vero se è il primo giorno in cui si gioca da quando la serie era a 0 o interrotta. */
  extendedToday: boolean;
}

export const INITIAL_STREAK: StreakState = { days: 0, lastDay: null, cycles: 0, helps: 0 };

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function dayToUtcMs(day: string): number {
  if (!DAY_PATTERN.test(day)) throw new RangeError(`giorno non valido: "${day}" (atteso YYYY-MM-DD)`);
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  return Date.UTC(y, m - 1, d);
}

/** Differenza in giorni di calendario `b − a`. */
export function daysBetween(a: string, b: string): number {
  return Math.round((dayToUtcMs(b) - dayToUtcMs(a)) / 86_400_000);
}

/** Giorno di calendario, `YYYY-MM-DD`, di un istante nel fuso indicato (default Europe/Rome). */
export function calendarDay(instant: Date | number, timeZone = 'Europe/Rome'): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant);
  const get = (type: string): string => parts.find((p) => p.type === type)!.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** Aggiunge `n` giorni a un giorno di calendario. */
export function addDays(day: string, n: number): string {
  return new Date(dayToUtcMs(day) + n * 86_400_000).toISOString().slice(0, 10);
}

/** Giorno della settimana, 0 = lunedì … 6 = domenica. */
export function weekdayIndex(day: string): number {
  return (new Date(dayToUtcMs(day)).getUTCDay() + 6) % 7;
}

/** Lunedì della settimana che contiene `day`. */
export function weekStart(day: string): string {
  return addDays(day, -weekdayIndex(day));
}

/**
 * Serie da mostrare in un dato giorno: se l'ultima partita non è di oggi né di ieri, la serie è già interrotta
 * (la scrittura sul database avviene pigramente, alla partita successiva).
 */
export function effectiveStreakDays(state: StreakState, today: string): number {
  if (state.lastDay === null) return 0;
  const gap = daysBetween(state.lastDay, today);
  return gap <= 1 ? state.days : 0;
}

/** Registra una partita iniziata nel giorno `today` (anche abbandonata: conta come finita). */
export function applyPlay(state: StreakState, today: string): StreakUpdate {
  if (state.lastDay !== null) {
    const gap = daysBetween(state.lastDay, today);
    if (gap < 0) throw new RangeError(`applyPlay: ${today} precede l'ultimo giorno registrato ${state.lastDay}`);
    if (gap === 0) return { state, cycleCompleted: false, extendedToday: false };
  }

  const continues = state.lastDay !== null && daysBetween(state.lastDay, today) === 1;
  const days = (continues ? state.days : 0) + 1;

  if (days >= STREAK_CYCLE_DAYS) {
    return {
      state: { days: 0, lastDay: today, cycles: state.cycles + 1, helps: state.helps + 1 },
      cycleCompleted: true,
      extendedToday: true,
    };
  }
  return { state: { ...state, days, lastDay: today }, cycleCompleted: false, extendedToday: true };
}
