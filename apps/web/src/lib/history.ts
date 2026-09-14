import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { FoundWord, GameConfig, SessionSummary } from '@paroliere/core';

import { apiRequest } from './api.js';

export interface GameRecord {
  id: string;
  config: GameConfig;
  score: number;
  maxScore: number;
  totalWords: number;
  foundWords: readonly FoundWord[];
  playedAt: number;
}

interface ParoliereDB extends DBSchema {
  games: {
    key: string;
    value: GameRecord;
    indexes: { 'by-playedAt': number };
  };
}

const DB_NAME = 'paroliere';
const DB_VERSION = 1;
const STORE_NAME = 'games';

let dbPromise: Promise<IDBPDatabase<ParoliereDB>> | undefined;

function getDb(): Promise<IDBPDatabase<ParoliereDB>> {
  dbPromise ??= openDB<ParoliereDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      store.createIndex('by-playedAt', 'playedAt');
    },
  });
  return dbPromise;
}

export async function saveGame(config: GameConfig, summary: SessionSummary, playedAt: number): Promise<GameRecord> {
  const db = await getDb();
  const record: GameRecord = {
    id: crypto.randomUUID(),
    // config/foundWords possono essere Proxy reattivi Svelte ($state): un
    // giro JSON li rende oggetti semplici, cloneabili da IndexedDB.
    config: JSON.parse(JSON.stringify(config)),
    score: summary.score,
    maxScore: summary.maxScore,
    totalWords: summary.totalWords,
    foundWords: JSON.parse(JSON.stringify(summary.foundWords)),
    playedAt,
  };
  await db.put(STORE_NAME, record);
  return record;
}

/**
 * Invia la partita al server (RF-24 statistiche): il salvataggio locale
 * resta la fonte primaria dello storico, questa chiamata alimenta solo le
 * statistiche per tipologia (`player_word_stats`), best-effort.
 */
export function syncGame(game: GameRecord): Promise<void> {
  return apiRequest('/users/me/history/sync', {
    method: 'POST',
    body: JSON.stringify({
      games: [
        {
          id: game.id,
          config: game.config,
          score: game.score,
          foundWords: game.foundWords,
          playedAt: game.playedAt,
        },
      ],
    }),
  });
}

export async function listGames(): Promise<GameRecord[]> {
  const db = await getDb();
  const games = await db.getAllFromIndex(STORE_NAME, 'by-playedAt');
  return games.reverse();
}

export async function getPersonalBest(): Promise<number> {
  const games = await listGames();
  return games.reduce((best, game) => Math.max(best, game.score), 0);
}
