import { bigint, integer, jsonb, pgEnum, pgTable, timestamp, unique, uuid, varchar } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  username: varchar('username', { length: 32 }).notNull().unique(),
  email: varchar('email', { length: 254 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 256 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const scoringEnum = pgEnum('scoring', ['classic', 'versus']);
export const challengeModeEnum = pgEnum('challenge_mode', ['individual', 'team']);
export const challengeStatusEnum = pgEnum('challenge_status', ['open', 'in_progress', 'completed', 'cancelled']);
export const gameSourceEnum = pgEnum('game_source', ['local', 'challenge']);

export const gameConfigs = pgTable('game_configs', {
  id: uuid('id').primaryKey().defaultRandom(),
  size: integer('size').notNull(),
  durationMs: integer('duration_ms').notNull(),
  minWordLength: integer('min_word_length').notNull(),
  minWords: integer('min_words').notNull(),
  scoring: scoringEnum('scoring').notNull(),
  generatorVersion: integer('generator_version').notNull(),
  dictionaryVersion: varchar('dictionary_version', { length: 64 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const challenges = pgTable('challenges', {
  id: uuid('id').primaryKey().defaultRandom(),
  creatorUserId: uuid('creator_user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  configId: uuid('config_id')
    .notNull()
    .references(() => gameConfigs.id),
  mode: challengeModeEnum('mode').notNull(),
  maxParticipants: integer('max_participants'),
  playersPerTeam: integer('players_per_team'),
  bestOf: integer('best_of').notNull(),
  status: challengeStatusEnum('status').notNull().default('open'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const teams = pgTable('teams', {
  id: uuid('id').primaryKey().defaultRandom(),
  challengeId: uuid('challenge_id')
    .notNull()
    .references(() => challenges.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 64 }).notNull(),
});

export const challengeParticipants = pgTable(
  'challenge_participants',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    challengeId: uuid('challenge_id')
      .notNull()
      .references(() => challenges.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    teamId: uuid('team_id').references(() => teams.id, { onDelete: 'cascade' }),
    joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique().on(table.challengeId, table.userId)],
);

export const challengeMatches = pgTable(
  'challenge_matches',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    challengeId: uuid('challenge_id')
      .notNull()
      .references(() => challenges.id, { onDelete: 'cascade' }),
    matchIndex: integer('match_index').notNull(),
    seed: bigint('seed', { mode: 'number' }).notNull(),
    settledAt: timestamp('settled_at', { withTimezone: true }),
  },
  (table) => [unique().on(table.challengeId, table.matchIndex)],
);

export const matchResults = pgTable(
  'match_results',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    challengeMatchId: uuid('challenge_match_id')
      .notNull()
      .references(() => challengeMatches.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    paths: jsonb('paths').notNull().$type<number[][]>(),
    score: integer('score'),
    submittedAt: timestamp('submitted_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique().on(table.challengeMatchId, table.userId)],
);

export const challengeMatchStarts = pgTable(
  'challenge_match_starts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    challengeMatchId: uuid('challenge_match_id')
      .notNull()
      .references(() => challengeMatches.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique().on(table.challengeMatchId, table.userId)],
);

export interface GameWordEntry {
  word: string;
  path: number[];
  points: number;
}

export const games = pgTable('games', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  configId: uuid('config_id')
    .notNull()
    .references(() => gameConfigs.id),
  seed: bigint('seed', { mode: 'number' }).notNull(),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
  score: integer('score').notNull(),
  words: jsonb('words').notNull().$type<GameWordEntry[]>(),
  source: gameSourceEnum('source').notNull(),
});

/**
 * Statistiche aggregate per giocatore, per "tipologia" di partita (dimensione
 * griglia + durata). Normalizzato: si mantengono i totali (`totalWords`,
 * `totalWordLengthSum`) invece della media già calcolata, per poter
 * ricalcolare la media esatta a ogni nuova partita senza rileggere `games`.
 */
export const playerWordStats = pgTable(
  'player_word_stats',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    gridSize: integer('grid_size').notNull(),
    durationMs: integer('duration_ms').notNull(),
    gamesPlayed: integer('games_played').notNull().default(0),
    totalWords: integer('total_words').notNull().default(0),
    totalWordLengthSum: bigint('total_word_length_sum', { mode: 'number' }).notNull().default(0),
    longestWord: varchar('longest_word', { length: 64 }),
    longestWordLength: integer('longest_word_length').notNull().default(0),
    lastPlayedAt: timestamp('last_played_at', { withTimezone: true }),
  },
  (table) => [unique().on(table.userId, table.gridSize, table.durationMs)],
);
