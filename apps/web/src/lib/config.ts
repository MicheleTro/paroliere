/**
 * Modalità offline (build-time): senza backend né database. Restano solo
 * l'allenamento e lo storico locale; niente login, sfide, statistiche per
 * tipologia e segnalazione parole.
 */
export const OFFLINE_MODE = import.meta.env.VITE_OFFLINE_MODE === 'true';
