// Prova la conversione dei dati della versione precedente (migrazione 0003 + ricalcolo delle vecchie sfide): crea un
// database temporaneo fermo alla 0002, ci mette storico, statistiche e sfide nel formato di allora, applica le
// migrazioni e controlla che nulla vada perso. Il database temporaneo si cancella da solo. Uso:
//   pnpm --filter @paroliere/server exec tsx --env-file=.env scripts/prova-conversione.ts
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { generateGrid, type GameConfig } from '@paroliere/core';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

const url = new URL(process.env.DATABASE_URL!);
const scratchName = `paroliere_conversione_${Date.now().toString(36)}`;
const scratchUrl = Object.assign(new URL(url), { pathname: `/${scratchName}` }).toString();
const migrationsFolder = fileURLToPath(new URL('../drizzle', import.meta.url));

const admin = postgres(Object.assign(new URL(url), { pathname: '/postgres' }).toString(), {
  max: 1,
});
await admin.unsafe(`CREATE DATABASE ${scratchName}`);

let failures = 0;
function check(name: string, ok: boolean, detail?: unknown): void {
  console.log(`${ok ? 'ok  ' : 'KO  '} ${name}${ok ? '' : ` -> ${JSON.stringify(detail)}`}`);
  if (!ok) failures++;
}

const oldFolder = mkdtempSync(join(tmpdir(), 'paroliere-0002-'));
try {
  // 1. Database com'è oggi in produzione: solo le migrazioni fino alla 0002
  cpSync(migrationsFolder, oldFolder, { recursive: true });
  const journalPath = join(oldFolder, 'meta', '_journal.json');
  const journal = JSON.parse(readFileSync(journalPath, 'utf-8')) as { entries: { idx: number }[] };
  journal.entries = journal.entries.filter((e) => e.idx <= 2);
  writeFileSync(journalPath, JSON.stringify(journal));
  const client = postgres(scratchUrl, { max: 1, onnotice: () => {} });
  await migrate(drizzle(client), { migrationsFolder: oldFolder });

  // 2. Dati nel formato di allora: partite con parole vere della loro griglia, statistiche, sfide
  process.env.DATABASE_URL = scratchUrl;
  const { loadDictionary } = await import('../src/dictionary.js');
  const dictionary = loadDictionary();
  const configOf = (seed: number, size: 4 | 5): GameConfig => ({
    seed,
    size,
    durationMs: 120000,
    minWordLength: 3,
    minWords: 50,
    scoring: 'classic',
    pointMode: 'standard',
    positionBonus: false,
    generatorVersion: 1,
    dictionaryVersion: dictionary.dictionaryVersion,
  });
  const solutionsOf = (config: GameConfig) => generateGrid(config, dictionary.index).solutions;

  await client.unsafe(
    `INSERT INTO users (id, username) VALUES ('u-ale', 'ale'), ('u-bea', 'bea'), ('u-zero', 'zero')`,
  );
  const insertConfig = async (c: GameConfig, scoring = 'classic'): Promise<string> =>
    (
      await client.unsafe(
        `INSERT INTO game_configs (size, duration_ms, min_word_length, min_words, scoring, generator_version, dictionary_version)
         VALUES ($1, $2, 3, 50, $3, 1, $4) RETURNING id`,
        [c.size, c.durationMs, scoring, c.dictionaryVersion],
      )
    )[0]!.id as string;

  // Due partite di ale (la seconda ripete una parola della prima) e una di bea
  const games = [
    { user: 'u-ale', config: configOf(11, 4), take: 12, at: '2026-11-01T10:00:00Z' },
    { user: 'u-ale', config: configOf(12, 5), take: 20, at: '2026-11-02T10:00:00Z' },
    { user: 'u-bea', config: configOf(13, 4), take: 5, at: '2026-11-03T10:00:00Z' },
  ];
  const aleWords = new Set<string>();
  let aleScore = 0;
  let aleLongest = '';
  for (const g of games) {
    const words = solutionsOf(g.config)
      .slice(0, g.take)
      .map((s) => ({ word: s.word, path: s.path, points: s.word.length - 2 }));
    const score = words.reduce((a, w) => a + w.points, 0);
    if (g.user === 'u-ale') {
      words.forEach((w) => aleWords.add(w.word));
      aleScore += score;
      for (const w of words) if (w.word.length > aleLongest.length) aleLongest = w.word;
    }
    const configId = await insertConfig(g.config);
    await client.unsafe(
      `INSERT INTO games (user_id, config_id, seed, started_at, score, words, source) VALUES ($1, $2, $3, $4, $5, $6, 'local')`,
      [g.user, configId, g.config.seed, g.at, score, JSON.stringify(words) as never],
    );
  }
  await client.unsafe(
    `INSERT INTO player_word_stats (user_id, grid_size, duration_ms, games_played, total_words, longest_word, longest_word_length, max_words_in_game)
     VALUES ('u-ale', 4, 120000, 1, 12, 'precipitevolissimevolmente', 26, 40)`,
  );

  // Sfida conclusa (ale 9 parole, bea 4), sfida in corso con un solo risultato, sfida iniziata e non inviata, invito
  const duelConfig = configOf(21, 4);
  const duelSolutions = solutionsOf(duelConfig);
  const duelConfigId = await insertConfig(duelConfig, 'versus');
  const newDuel = async (status: string, seed: number) =>
    (
      await client.unsafe(
        `INSERT INTO duels (challenger_id, opponent_id, config_id, seed, status, responded_at) VALUES ('u-ale', 'u-bea', $1, $2, $3, now()) RETURNING id`,
        [duelConfigId, seed, status],
      )
    )[0]!.id as string;
  const completed = await newDuel('completed', 21);
  const open = await newDuel('in_progress', 21);
  const startedOnly = await newDuel('in_progress', 21);
  const invited = await newDuel('invited', 21);
  const paths = (n: number, from = 0) =>
    JSON.stringify([...duelSolutions.slice(from, from + n).map((s) => s.path), [0, 0, 0]]) as never;
  await client.unsafe(
    `INSERT INTO duel_results (duel_id, user_id, paths, score) VALUES ($1, 'u-ale', $2, 30), ($1, 'u-bea', $3, 8), ($4, 'u-ale', $5, NULL)`,
    [completed, paths(9), paths(4, 2), open, paths(6)],
  );
  await client.unsafe(
    `INSERT INTO duel_starts (duel_id, user_id, started_at) VALUES ($1, 'u-ale', now() - interval '1 hour'), ($2, 'u-bea', now() - interval '1 day')`,
    [completed, startedOnly],
  );

  // 3. Migrazioni nuove e ricalcolo delle vecchie sfide, come all'avvio del server
  await migrate(drizzle(client), { migrationsFolder });
  const { regradeLegacyDuelPlays } = await import('../src/plays/legacy.js');
  await regradeLegacyDuelPlays();
  await regradeLegacyDuelPlays(); // la seconda volta non deve fare nulla

  const one = async (sql: string, params: unknown[] = []) =>
    (await client.unsafe(sql, params as never[]))[0]!;
  const n = async (sql: string, params: unknown[] = []) => Number((await one(sql, params)).n);

  check(
    'archivio: le vecchie tabelle ci sono ancora',
    (await n(`SELECT count(*) AS n FROM legacy_games`)) === 3,
  );
  check(
    'archivio: statistiche',
    (await n(`SELECT count(*) AS n FROM legacy_player_word_stats`)) === 1,
  );
  check(
    'archivio: risultati delle sfide',
    (await n(`SELECT count(*) AS n FROM legacy_duel_results`)) === 3,
  );
  check(
    '3 partite di Gioca',
    (await n(`SELECT count(*) AS n FROM plays WHERE mode = 'gioca' AND status = 'finished'`)) === 3,
  );
  check(
    'parole di Gioca',
    (await n(
      `SELECT count(*) AS n FROM play_words w JOIN plays p ON p.id = w.play_id WHERE p.mode = 'gioca'`,
    )) === 37,
    await n(`SELECT count(*) AS n FROM play_words`),
  );
  const ale = await one(`SELECT * FROM profiles WHERE user_id = 'u-ale'`);
  const aleDuelWords = await n(
    `SELECT count(*) AS n FROM play_words w JOIN plays p ON p.id = w.play_id WHERE p.duel_id = $1 AND p.user_id = 'u-ale'`,
    [completed],
  );
  check(
    'sfida conclusa: parole ricalcolate dai percorsi (il percorso non valido no)',
    aleDuelWords === 9,
    aleDuelWords,
  );
  check(
    'sfida conclusa: punteggio ufficiale di allora',
    (await n(`SELECT score AS n FROM plays WHERE duel_id = $1 AND user_id = 'u-ale'`, [
      completed,
    ])) === 30,
  );
  const duelWordSet = new Set(duelSolutions.slice(0, 9).map((s) => s.word));
  const expectedFound = new Set([...aleWords, ...duelWordSet]).size;
  check(
    'collezione di ale: parole di Gioca e della sfida, senza doppioni',
    (await n(`SELECT count(*) AS n FROM found_words WHERE user_id = 'u-ale'`)) === expectedFound,
    {
      got: await n(`SELECT count(*) AS n FROM found_words WHERE user_id = 'u-ale'`),
      expectedFound,
    },
  );
  check('XP di ale: punteggi di Gioca + sfida conclusa', Number(ale.total_xp) === aleScore + 30, {
    xp: ale.total_xp,
    aleScore,
  });
  check('partite di ale: 2 di Gioca + 1 sfida conclusa', ale.games_played === 3, ale.games_played);
  check(
    'record di ale dalle vecchie statistiche',
    ale.max_words_in_game === 40 && ale.longest_word_length === 26,
    ale,
  );
  const open1 = await one(
    `SELECT status, word_count, score, config FROM plays WHERE duel_id = $1`,
    [open],
  );
  check(
    'sfida aperta: partita inviata con le parole, punteggio alla chiusura',
    open1.status === 'finished' && open1.word_count === 6 && open1.score === 0,
    open1,
  );
  check(
    'segno di ricalcolo tolto',
    (await n(`SELECT count(*) AS n FROM plays WHERE config ? 'legacyRegrade'`)) === 0,
  );
  check(
    'sfida iniziata e non inviata: partita iniziata',
    (await one(`SELECT status FROM plays WHERE duel_id = $1`, [startedOnly])).status === 'started',
  );
  check(
    'invito: resta, con la configurazione',
    (await one(`SELECT config->>'scoring' AS s, status FROM duels WHERE id = $1`, [invited])).s ===
      'versus',
  );
  check('nessuna sfida persa', (await n(`SELECT count(*) AS n FROM duels`)) === 4);
  check(
    'utente senza partite: nessun profilo finto',
    (await n(`SELECT count(*) AS n FROM profiles WHERE user_id = 'u-zero'`)) === 0,
  );
  await client.end();
  const { db } = await import('../src/db/client.js');
  await (db.$client as { end: () => Promise<void> }).end();
} catch (error) {
  failures++;
  console.error(error);
} finally {
  rmSync(oldFolder, { recursive: true, force: true });
  await admin.unsafe(`DROP DATABASE IF EXISTS ${scratchName} WITH (FORCE)`);
  await admin.end();
}

console.log(failures === 0 ? '\nTutto ok' : `\n${failures} controlli falliti`);
process.exit(failures === 0 ? 0 : 1);
