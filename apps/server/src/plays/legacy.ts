import type { GameConfig } from '@paroliere/core';
import { and, eq, sql } from 'drizzle-orm';

import { db } from '../db/client.js';
import * as schema from '../db/schema.js';
import { loadDictionary } from '../dictionary.js';
import { gradeSubmission } from './grading.js';

/**
 * Le sfide della versione precedente avevano solo i percorsi inviati, non le parole: la migrazione 0003 le converte in
 * partite con il segno `legacyRegrade` nella configurazione, e qui (all'avvio, una volta sola) il server ricalcola le
 * parole valide come faceva allora (dizionario di base, senza aggiunte). Il punteggio delle sfide concluse resta quello
 * ufficiale di allora; quelle ancora aperte lo calcolano alla chiusura, dalle parole. Se il dizionario è cambiato la
 * griglia non sarebbe più la stessa: la partita resta senza parole (il punteggio non cambia).
 */
export async function regradeLegacyDuelPlays(
  log: (message: string) => void = console.log,
): Promise<void> {
  const pending = await db
    .select()
    .from(schema.plays)
    .where(sql`${schema.plays.config} ? 'legacyRegrade'`);
  if (pending.length === 0) return;

  const dictionary = loadDictionary();
  let regraded = 0;
  for (const play of pending) {
    const config = { ...play.config } as GameConfig & { legacyRegrade?: boolean };
    delete config.legacyRegrade;
    const sameDictionary = config.dictionaryVersion === dictionary.dictionaryVersion;
    const words =
      sameDictionary && play.submission?.length
        ? gradeSubmission(config, dictionary.index, play.submission)
        : [];

    await db.transaction(async (tx) => {
      if (words.length > 0) {
        await tx
          .insert(schema.playWords)
          .values(
            words.map((w) => ({
              playId: play.id,
              userId: play.userId,
              word: w.word,
              path: w.path,
              points: w.points,
            })),
          )
          .onConflictDoNothing();
      }
      await tx
        .update(schema.plays)
        .set({ config, wordCount: words.length })
        .where(eq(schema.plays.id, play.id));

      // Sfida già conclusa: le parole entrano subito nella collezione e nei record (le aperte lo faranno alla chiusura)
      const [duel] = play.duelId
        ? await tx.select().from(schema.duels).where(eq(schema.duels.id, play.duelId))
        : [];
      if (duel?.status !== 'completed' || words.length === 0) return;
      const inserted = await tx
        .insert(schema.foundWords)
        .values(
          words.map((w) => ({
            userId: play.userId,
            word: w.word,
            firstFoundAt: play.startedAt,
            firstPlayId: play.id,
          })),
        )
        .onConflictDoNothing()
        .returning({ word: schema.foundWords.word });
      for (const { word } of inserted) {
        await tx
          .update(schema.playWords)
          .set({ isNew: true })
          .where(and(eq(schema.playWords.playId, play.id), eq(schema.playWords.word, word)));
      }
      const longest = words.reduce((a, b) => (b.word.length > a.word.length ? b : a));
      await tx.insert(schema.profiles).values({ userId: play.userId }).onConflictDoNothing();
      await tx
        .update(schema.profiles)
        .set({
          maxWordsInGame: sql`GREATEST(${schema.profiles.maxWordsInGame}, ${words.length})`,
          longestWord: sql`CASE WHEN ${longest.word.length} > ${schema.profiles.longestWordLength} THEN ${longest.word} ELSE ${schema.profiles.longestWord} END`,
          longestWordLength: sql`GREATEST(${schema.profiles.longestWordLength}, ${longest.word.length})`,
        })
        .where(eq(schema.profiles.userId, play.userId));
    });
    if (words.length > 0) regraded++;
    if (!sameDictionary)
      log(
        `Sfida ${play.duelId}: dizionario cambiato, parole non ricalcolate (punteggio invariato)`,
      );
  }
  log(
    `Sfide della versione precedente: ${pending.length} partite convertite, ${regraded} con parole ricalcolate`,
  );
}
