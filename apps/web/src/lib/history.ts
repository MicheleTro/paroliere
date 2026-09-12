import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { FoundWord, GameConfig, SessionSummary } from '@paroliere/core';

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

export async function saveGame(config: GameConfig, summary: SessionSummary, playedAt: number): Promise<void> {
  const db = await getDb();
  const record: GameRecord = {
    id: crypto.randomUUID(),
    config,
    score: summary.score,
    maxScore: summary.maxScore,
    totalWords: summary.totalWords,
    foundWords: summary.foundWords,
    playedAt,
  };
  await db.put(STORE_NAME, record);
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
