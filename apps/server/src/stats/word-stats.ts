import { and, eq } from 'drizzle-orm';

import { db } from '../db/client.js';
import * as schema from '../db/schema.js';
import type { GameWordEntry } from '../db/schema.js';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Aggiorna le statistiche parole per giocatore e tipologia (dimensione
 * griglia + durata) dopo una partita conclusa. Mantiene i totali grezzi
 * (`totalWords`, `totalWordLengthSum`) invece della media già calcolata,
 * così la media resta ricalcolabile esattamente ad ogni partita.
 */
export async function updatePlayerWordStats(
  tx: Tx,
  userId: string,
  gridSize: number,
  durationMs: number,
  words: GameWordEntry[],
  playedAt: Date,
): Promise<void> {
  const [existing] = await tx
    .select()
    .from(schema.playerWordStats)
    .where(
      and(
        eq(schema.playerWordStats.userId, userId),
        eq(schema.playerWordStats.gridSize, gridSize),
        eq(schema.playerWordStats.durationMs, durationMs),
      ),
    )
    .limit(1);

  const longestInGame = words.reduce<GameWordEntry | null>(
    (longest, w) => (!longest || w.word.length > longest.word.length ? w : longest),
    null,
  );
  const wordLengthSum = words.reduce((sum, w) => sum + w.word.length, 0);

  if (!existing) {
    await tx.insert(schema.playerWordStats).values({
      userId,
      gridSize,
      durationMs,
      gamesPlayed: 1,
      totalWords: words.length,
      totalWordLengthSum: wordLengthSum,
      longestWord: longestInGame?.word ?? null,
      longestWordLength: longestInGame?.word.length ?? 0,
      maxWordsInGame: words.length,
      lastPlayedAt: playedAt,
    });
    return;
  }

  const useNewLongest = !!longestInGame && longestInGame.word.length > existing.longestWordLength;

  await tx
    .update(schema.playerWordStats)
    .set({
      gamesPlayed: existing.gamesPlayed + 1,
      totalWords: existing.totalWords + words.length,
      totalWordLengthSum: existing.totalWordLengthSum + wordLengthSum,
      longestWord: useNewLongest ? longestInGame!.word : existing.longestWord,
      longestWordLength: useNewLongest ? longestInGame!.word.length : existing.longestWordLength,
      maxWordsInGame: Math.max(existing.maxWordsInGame, words.length),
      lastPlayedAt: !existing.lastPlayedAt || playedAt > existing.lastPlayedAt ? playedAt : existing.lastPlayedAt,
    })
    .where(eq(schema.playerWordStats.id, existing.id));
}
