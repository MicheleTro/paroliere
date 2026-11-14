/**
 * Medaglie (SPEC.md §11.6): premi unici, non ricorrenti. Le definizioni stanno nel database (tabella
 * `medal_definitions`, modificabile e ampliabile senza rilasciare); questo modulo contiene il catalogo di partenza
 * (`DEFAULT_MEDALS`, che inizializza il database e i test) e la valutazione. Una medaglia è una soglia su una metrica
 * calcolata dallo stato del giocatore. "Primo posto" è stata rimossa per ora (decisione whoru #29): sono 14.
 */

export type MedalMetric =
  | 'totalWords'
  | 'gamesPlayed'
  | 'longestWordLength'
  | 'maxWordsInGame'
  | 'level'
  | 'weeklyGridsPlayed'
  | 'bestWeekGridsPlayed'
  | 'bestWeekOnTime'
  /** Percentuale (0..100) delle varianti del catalogo giocate almeno una volta. */
  | 'variantsCoverage'
  | 'streakCycles';

export const MEDAL_METRICS: readonly MedalMetric[] = [
  'totalWords',
  'gamesPlayed',
  'longestWordLength',
  'maxWordsInGame',
  'level',
  'weeklyGridsPlayed',
  'bestWeekGridsPlayed',
  'bestWeekOnTime',
  'variantsCoverage',
  'streakCycles',
];

export interface MedalDefinition {
  id: string;
  name: string;
  description: string;
  /** Gruppo per mostrarle (parole, partite, livello, settimana, serie…): testo libero, si può ampliare. */
  kind: string;
  /** La medaglia scatta quando `metric >= threshold`. */
  metric: MedalMetric;
  threshold: number;
}

/** Catalogo di partenza: i dati iniziali del database. */
export const DEFAULT_MEDALS: readonly MedalDefinition[] = [
  { id: 'prima-parola', name: 'Prima parola', description: 'Trova la tua prima parola', kind: 'parole', metric: 'totalWords', threshold: 1 },
  { id: 'prima-partita', name: 'Prima partita', description: 'Finisci la tua prima partita', kind: 'partite', metric: 'gamesPlayed', threshold: 1 },
  { id: 'cento-parole', name: 'Cento parole', description: '100 parole trovate', kind: 'parole', metric: 'totalWords', threshold: 100 },
  { id: 'mille-parole', name: 'Mille parole', description: '1.000 parole trovate', kind: 'parole', metric: 'totalWords', threshold: 1_000 },
  { id: 'diecimila-parole', name: 'Diecimila parole', description: '10.000 parole trovate', kind: 'parole', metric: 'totalWords', threshold: 10_000 },
  { id: 'settebello', name: 'Settebello', description: 'Una parola di 7 lettere o più', kind: 'parole', metric: 'longestWordLength', threshold: 7 },
  { id: 'nove-lettere', name: 'Nove lettere', description: 'Una parola di 9 lettere o più', kind: 'parole', metric: 'longestWordLength', threshold: 9 },
  { id: 'raccolto', name: 'Raccolto', description: '30 parole in una sola partita', kind: 'partite', metric: 'maxWordsInGame', threshold: 30 },
  { id: 'livello-10', name: 'Livello 10', description: 'Raggiungi il livello 10', kind: 'livello', metric: 'level', threshold: 10 },
  { id: 'prima-settimana', name: 'Prima settimana', description: 'Gioca la tua prima griglia della Settimana', kind: 'settimana', metric: 'weeklyGridsPlayed', threshold: 1 },
  { id: 'settimana-piena', name: 'Settimana piena', description: 'Gioca tutte e 7 le griglie di una settimana', kind: 'settimana', metric: 'bestWeekGridsPlayed', threshold: 7 },
  { id: 'puntuale', name: 'Puntuale', description: 'Gioca tutte e 7 le griglie di una settimana, ognuna nel suo giorno', kind: 'settimana', metric: 'bestWeekOnTime', threshold: 7 },
  { id: 'tuttofare', name: 'Tuttofare', description: 'Gioca almeno una griglia per ciascuna variante', kind: 'settimana', metric: 'variantsCoverage', threshold: 100 },
  { id: 'ciclo-completo', name: 'Ciclo completo', description: 'Completa una serie di 10 giorni', kind: 'serie', metric: 'streakCycles', threshold: 1 },
];

/** Griglie di una settimana (una al giorno). */
export const WEEK_DAYS = 7;

/**
 * Quello che serve per decidere quali medaglie spettano. Lo costruisce il server dopo ogni partita, dentro la stessa
 * transazione, sui dati già aggiornati (compresa la partita appena chiusa).
 */
export interface MedalSnapshot {
  /** Parole distinte nella collezione dell'utente. */
  totalWords: number;
  /** Partite finite o abbandonate, in qualsiasi modalità. */
  gamesPlayed: number;
  /** Lunghezza in lettere della parola più lunga mai trovata. */
  longestWordLength: number;
  /** Massimo numero di parole in una sola partita. */
  maxWordsInGame: number;
  level: number;
  /** Griglie della Settimana giocate in totale. */
  weeklyGridsPlayed: number;
  /** Massimo di griglie giocate in una singola settimana. */
  bestWeekGridsPlayed: number;
  /** Massimo di griglie giocate *nel proprio giorno* in una singola settimana. */
  bestWeekOnTime: number;
  /** Varianti distinte giocate, e quante ne esistono nel catalogo attivo. */
  variantsPlayed: number;
  variantsTotal: number;
  streakCycles: number;
}

/** Valore di una metrica per lo stato dato. */
export function metricValue(snapshot: MedalSnapshot, metric: MedalMetric): number {
  switch (metric) {
    case 'totalWords':
      return snapshot.totalWords;
    case 'gamesPlayed':
      return snapshot.gamesPlayed;
    case 'longestWordLength':
      return snapshot.longestWordLength;
    case 'maxWordsInGame':
      return snapshot.maxWordsInGame;
    case 'level':
      return snapshot.level;
    case 'weeklyGridsPlayed':
      return snapshot.weeklyGridsPlayed;
    case 'bestWeekGridsPlayed':
      return snapshot.bestWeekGridsPlayed;
    case 'bestWeekOnTime':
      return snapshot.bestWeekOnTime;
    case 'variantsCoverage':
      return snapshot.variantsTotal > 0 ? Math.floor((snapshot.variantsPlayed * 100) / snapshot.variantsTotal) : 0;
    case 'streakCycles':
      return snapshot.streakCycles;
  }
}

/** Medaglie soddisfatte dallo stato, tutte (anche quelle già ottenute). */
export function medalsEarned(snapshot: MedalSnapshot, definitions: readonly MedalDefinition[] = DEFAULT_MEDALS): string[] {
  return definitions.filter((m) => metricValue(snapshot, m.metric) >= m.threshold).map((m) => m.id);
}

/** Medaglie nuove: soddisfatte ora e non ancora possedute. */
export function newMedals(
  snapshot: MedalSnapshot,
  alreadyOwned: Iterable<string>,
  definitions: readonly MedalDefinition[] = DEFAULT_MEDALS,
): MedalDefinition[] {
  const owned = new Set(alreadyOwned);
  const earned = new Set(medalsEarned(snapshot, definitions));
  return definitions.filter((m) => earned.has(m.id) && !owned.has(m.id));
}

export function getMedal(id: string, definitions: readonly MedalDefinition[] = DEFAULT_MEDALS): MedalDefinition | undefined {
  return definitions.find((m) => m.id === id);
}
