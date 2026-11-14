import {
  bigint,
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  timestamp,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import type { GameConfig } from '@paroliere/core';

/**
 * Riga sottile dell'utente: l'identità vive in whoru (decisione whoru #24). La chiave è il `sub` del portale
 * (testo); il nome serve solo per mostrarlo nelle classifiche e si aggiorna a ogni accesso. Nessuna email, nessuna password.
 */
export const users = pgTable('users', {
  id: varchar('id', { length: 64 }).primaryKey(),
  username: varchar('username', { length: 64 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Progresso del giocatore (SPEC.md §11). Il livello NON si salva: deriva da `totalXp` (così la curva si può
 * ritarare senza migrazioni). Una riga per utente, creata alla prima partita.
 */
export const profiles = pgTable('profiles', {
  userId: varchar('user_id', { length: 64 })
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  totalXp: bigint('total_xp', { mode: 'number' }).notNull().default(0),
  /** Giorni consecutivi nel ciclo da 10 (0..9), ultimo giorno giocato (calendario di Roma) e cicli completati. */
  streakDays: integer('streak_days').notNull().default(0),
  streakLastDay: date('streak_last_day', { mode: 'string' }),
  streakCycles: integer('streak_cycles').notNull().default(0),
  /** Contatori per le medaglie e il profilo, aggiornati a ogni partita chiusa. */
  gamesPlayed: integer('games_played').notNull().default(0),
  maxWordsInGame: integer('max_words_in_game').notNull().default(0),
  longestWord: varchar('longest_word', { length: 64 }),
  longestWordLength: integer('longest_word_length').notNull().default(0),
  /** Prima partita guidata completata. */
  onboardedAt: timestamp('onboarded_at', { withTimezone: true }),
  /** Per il segnalino "da leggere" delle notizie. */
  notificationsSeenAt: timestamp('notifications_seen_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/** Medaglie ottenute. Le definizioni stanno in `medal_definitions`. */
export const medals = pgTable(
  'medals',
  {
    userId: varchar('user_id', { length: 64 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    medalId: varchar('medal_id', { length: 64 })
      .notNull()
      .references(() => medalDefinitions.id),
    earnedAt: timestamp('earned_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.medalId] })],
);

export const reportedWordStatusEnum = pgEnum('reported_word_status', ['pending', 'approved', 'rejected']);

/**
 * Parole segnalate dai giocatori come "da aggiungere al dizionario" (RF
 * segnalazione parole mancanti). `word` è unica: segnalazioni ripetute della
 * stessa parola incrementano `reportCount` invece di creare righe duplicate.
 */
export const reportedWords = pgTable('reported_words', {
  id: uuid('id').primaryKey().defaultRandom(),
  word: varchar('word', { length: 64 }).notNull().unique(),
  status: reportedWordStatusEnum('status').notNull().default('pending'),
  reportCount: integer('report_count').notNull().default(1),
  firstReportedByUserId: varchar('first_reported_by_user_id', { length: 64 })
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  decidedAt: timestamp('decided_at', { withTimezone: true }),
});

export interface DuelConfig {
  size: 4 | 5 | 6;
  durationMs: number;
  minWordLength: number;
  minWords: number;
  scoring: 'classic' | 'versus';
  pointMode: 'standard' | 'speciale';
  positionBonus: boolean;
  dictionaryVersion: string;
}

export const duelStatusEnum = pgEnum('duel_status', [
  'invited', // l'avversario non ha ancora risposto
  'in_progress', // accettata: ognuno gioca quando vuole
  'completed', // giocata da entrambi, punteggio calcolato
  'declined', // rifiutata dall'avversario
  'cancelled', // ritirata da chi l'ha lanciata (solo prima della risposta)
  'expired', // nessuna risposta o nessuna partita entro la scadenza
]);

/**
 * Sfida 1 contro 1 su invito (decisione whoru #28): un solo match, un solo seed. Si lancia solo contro un amico
 * del portale (il server lo verifica col portale). Tutti e due giocano la stessa griglia quando vogliono; il
 * punteggio si calcola quando hanno giocato entrambi.
 */
export const duels = pgTable('duels', {
  id: uuid('id').primaryKey().defaultRandom(),
  challengerId: varchar('challenger_id', { length: 64 })
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  opponentId: varchar('opponent_id', { length: 64 })
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  /** Parametri scelti da chi lancia la sfida (le sfide sono l'unica modalità con opzioni): include la versione del dizionario. */
  config: jsonb('config').notNull().$type<DuelConfig>(),
  seed: bigint('seed', { mode: 'number' }).notNull(),
  status: duelStatusEnum('status').notNull().default('invited'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  /** Quando l'avversario ha risposto (accettando o rifiutando). */
  respondedAt: timestamp('responded_at', { withTimezone: true }),
  settledAt: timestamp('settled_at', { withTimezone: true }),
});

/**
 * Definizione di una medaglia (SPEC.md §11.6): una soglia su una metrica calcolata dallo stato del giocatore.
 * Modificabile e ampliabile da amministrazione senza rilasciare; i valori iniziali sono `DEFAULT_MEDALS` (core).
 */
export const medalDefinitions = pgTable('medal_definitions', {
  id: varchar('id', { length: 64 }).primaryKey(),
  name: varchar('name', { length: 64 }).notNull(),
  description: varchar('description', { length: 200 }).notNull(),
  /** Gruppo per mostrarle (parole, partite, livello, settimana, serie…). */
  kind: varchar('kind', { length: 32 }).notNull(),
  /** Una delle metriche di `MEDAL_METRICS` (core). */
  metric: varchar('metric', { length: 32 }).notNull(),
  threshold: integer('threshold').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Impostazioni personali: una riga per chiave, così se ne aggiungono senza migrazioni (suoni, vibrazione, tema,
 * promemoria…). Le chiavi ammesse e il formato dei valori sono validati dal codice.
 */
export const userSettings = pgTable(
  'user_settings',
  {
    userId: varchar('user_id', { length: 64 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    key: varchar('key', { length: 64 }).notNull(),
    value: jsonb('value').notNull().$type<unknown>(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.key] })],
);

/**
 * Preset di partita: l'insieme dei parametri di una modalità o di una variante di griglia. Il preset `gioca` è la
 * partita libera; gli altri si assegnano ai giorni della Settimana (`week_plan`). Modificabili da amministrazione.
 * Non si cancellano: si disattivano (`active`), perché le griglie già create li citano.
 */
export const gamePresets = pgTable('game_presets', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: varchar('slug', { length: 32 }).notNull().unique(),
  name: varchar('name', { length: 64 }).notNull(),
  description: varchar('description', { length: 400 }).notNull().default(''),
  size: integer('size').notNull(),
  durationMs: integer('duration_ms').notNull(),
  minWordLength: integer('min_word_length').notNull().default(3),
  minWords: integer('min_words').notNull().default(80),
  /** Moltiplicatori da assegnare a caselle distinte, es. [3, 2]; vuoto = nessun bonus. */
  bonusCells: jsonb('bonus_cells').notNull().$type<number[]>().default([]),
  combo: boolean('combo').notNull().default(false),
  /** 'speciale' = ogni lettera ha un suo valore in punti. */
  pointMode: varchar('point_mode', { length: 12 }).notNull().$type<'standard' | 'speciale'>().default('standard'),
  /** Bonus posizione: le lettere agli angoli e ai lati valgono di più. */
  positionBonus: boolean('position_bonus').notNull().default(false),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/** Piano settimanale: quale preset in quale giorno (0 = lunedì … 6 = domenica). Vale per le settimane non ancora create. */
export const weekPlan = pgTable('week_plan', {
  dayIndex: integer('day_index').primaryKey(),
  presetId: uuid('preset_id')
    .notNull()
    .references(() => gamePresets.id),
});

/**
 * La griglia di un giorno della Settimana, creata alla prima richiesta e poi congelata: seed, parametri, griglia e
 * soluzioni non cambiano più, anche se il piano o il dizionario cambiano dopo.
 */
export const weeklyGrids = pgTable(
  'weekly_grids',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Lunedì della settimana (calendario di Roma). */
    weekStart: date('week_start', { mode: 'string' }).notNull(),
    dayIndex: integer('day_index').notNull(),
    presetId: uuid('preset_id')
      .notNull()
      .references(() => gamePresets.id),
    /** Parametri di gioco congelati (include il seed e la versione del dizionario). */
    config: jsonb('config').notNull().$type<GameConfig>(),
    tiles: jsonb('tiles').notNull().$type<string[]>(),
    multipliers: jsonb('multipliers').$type<number[] | null>(),
    solutions: jsonb('solutions').notNull().$type<{ word: string; path: number[] }[]>(),
    unlocksAt: timestamp('unlocks_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique().on(table.weekStart, table.dayIndex)],
);

export const playModeEnum = pgEnum('play_mode', ['gioca', 'settimana', 'sfida']);
export const playStatusEnum = pgEnum('play_status', ['started', 'finished', 'abandoned']);

export interface PlaySubmissionEntry {
  path: number[];
  /** Millisecondi dall'inizio della partita dichiarati dal client. */
  atMs: number;
}

/**
 * Ogni partita giocata da un utente, in qualsiasi modalità (Gioca, griglia della Settimana, sfida): una riga a
 * partita, creata all'inizio. Il server decide seed e ora di inizio, quindi ricaricare la pagina non rimette a zero
 * il timer, e un abbandono conta come partita finita per la serie. Le parole sono in `play_words`.
 */
export const plays = pgTable(
  'plays',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: varchar('user_id', { length: 64 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    mode: playModeEnum('mode').notNull(),
    presetId: uuid('preset_id').references(() => gamePresets.id),
    /** Solo Settimana. */
    gridId: uuid('grid_id').references(() => weeklyGrids.id),
    /** Solo sfida. */
    duelId: uuid('duel_id').references(() => duels.id, { onDelete: 'cascade' }),
    seed: bigint('seed', { mode: 'number' }).notNull(),
    /** Parametri di gioco congelati all'inizio (regole, griglia, dizionario). */
    config: jsonb('config').notNull().$type<GameConfig>(),
    status: playStatusEnum('status').notNull().default('started'),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    /** Durata concessa, compreso l'eventuale aiuto di +10 s. */
    durationMs: integer('duration_ms').notNull(),
    /** Oggetto speso per questa partita (es. l'aiuto +10 s), se c'è. */
    usedItemId: varchar('used_item_id', { length: 64 }).references(() => itemDefinitions.id),
    /** Percorsi grezzi inviati dal client, conservati per poter rivalutare la partita. */
    submission: jsonb('submission').$type<PlaySubmissionEntry[] | null>(),
    wordCount: integer('word_count').notNull().default(0),
    score: integer('score').notNull().default(0),
    xpAwarded: integer('xp_awarded').notNull().default(0),
  },
  // Un solo tentativo per griglia della Settimana e per sfida (le righe senza quei riferimenti non sono vincolate)
  (table) => [unique().on(table.userId, table.gridId), unique().on(table.userId, table.duelId)],
);

/** Le parole valide di ogni partita, una riga ciascuna, con percorso, punti e momento. */
export const playWords = pgTable(
  'play_words',
  {
    playId: uuid('play_id')
      .notNull()
      .references(() => plays.id, { onDelete: 'cascade' }),
    word: varchar('word', { length: 64 }).notNull(),
    userId: varchar('user_id', { length: 64 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    path: jsonb('path').notNull().$type<number[]>(),
    /** Punti base della parola nelle regole della partita (nelle sfide Versus il punteggio ufficiale sta in `plays.score`). */
    points: integer('points').notNull(),
    atMs: integer('at_ms').notNull().default(0),
    combo: integer('combo').notNull().default(1),
    /** Vera se questa partita l'ha aggiunta per la prima volta alla collezione. */
    isNew: boolean('is_new').notNull().default(false),
  },
  (table) => [primaryKey({ columns: [table.playId, table.word] }), index('play_words_user_idx').on(table.userId)],
);

/** Collezione: le forme distinte trovate almeno una volta, in qualsiasi modalità. "Parole trovate" = numero di righe. */
export const foundWords = pgTable(
  'found_words',
  {
    userId: varchar('user_id', { length: 64 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    word: varchar('word', { length: 64 }).notNull(),
    firstFoundAt: timestamp('first_found_at', { withTimezone: true }).notNull().defaultNow(),
    firstPlayId: uuid('first_play_id').references(() => plays.id, { onDelete: 'set null' }),
  },
  (table) => [primaryKey({ columns: [table.userId, table.word] })],
);

/**
 * Catalogo degli oggetti che i giocatori possono guadagnare e spendere (aiuti, in futuro altro). Un nuovo oggetto è
 * una riga: se il suo `effect` è di un tipo che il codice sa applicare non serve rilasciare nulla.
 */
export interface ItemEffect {
  /** Tipo di effetto; oggi solo 'extra_time' (millisecondi in più alla durata della partita). */
  type: 'extra_time';
  ms: number;
}

export const itemDefinitions = pgTable('item_definitions', {
  id: varchar('id', { length: 64 }).primaryKey(),
  name: varchar('name', { length: 64 }).notNull(),
  description: varchar('description', { length: 200 }).notNull(),
  kind: varchar('kind', { length: 32 }).notNull(),
  effect: jsonb('effect').notNull().$type<ItemEffect>(),
  /** Quantità massima posseduta insieme; null = nessun limite. */
  maxStack: integer('max_stack'),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/** Quanti oggetti di ogni tipo possiede ora un giocatore (sempre uguale alla somma dei suoi movimenti nel registro). */
export const userItems = pgTable(
  'user_items',
  {
    userId: varchar('user_id', { length: 64 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    itemId: varchar('item_id', { length: 64 })
      .notNull()
      .references(() => itemDefinitions.id),
    quantity: integer('quantity').notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.userId, table.itemId] })],
);

export const itemLedgerReasonEnum = pgEnum('item_ledger_reason', [
  'streak_cycle', // guadagnato completando un ciclo di serie
  'medal', // guadagnato con una medaglia
  'level', // guadagnato salendo di livello
  'used', // speso in una partita
  'admin', // accredito o rettifica manuale
  'migration', // saldo iniziale portato dal vecchio modello
]);

/** Ogni guadagno e ogni spesa di oggetti, con il motivo e (se c'è) la partita: la storia non si cancella. */
export const itemLedger = pgTable(
  'item_ledger',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: varchar('user_id', { length: 64 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    itemId: varchar('item_id', { length: 64 })
      .notNull()
      .references(() => itemDefinitions.id),
    /** Positivo = guadagnato, negativo = speso. */
    delta: integer('delta').notNull(),
    reason: itemLedgerReasonEnum('reason').notNull(),
    playId: uuid('play_id').references(() => plays.id, { onDelete: 'set null' }),
    note: varchar('note', { length: 200 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('item_ledger_user_idx').on(table.userId, table.createdAt)],
);
