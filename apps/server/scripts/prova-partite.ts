/* eslint-disable @typescript-eslint/no-explicit-any -- script di prova: le risposte JSON sono lette in modo libero */
// Prova end-to-end di Gioca e delle sfide contro un Postgres reale, senza browser: usa l'app Fastify in memoria.
// Richiede Postgres migrato, il dizionario generato (dist/dictionary) e DEV_LOGIN=true. Uso:
//   pnpm --filter @paroliere/server exec tsx --env-file=.env scripts/prova-partite.ts
// Crea utenti "dev-prova*" e li cancella alla fine.
import { generateGrid, type GameConfig } from '@paroliere/core';
import { eq, like } from 'drizzle-orm';

import { buildApp } from '../src/app.js';
import { db } from '../src/db/client.js';
import * as schema from '../src/db/schema.js';
import { loadDictionary } from '../src/dictionary.js';
import { grantItem } from '../src/items/service.js';
import { gradeSubmission } from '../src/plays/grading.js';
import { recordPlayStarted } from '../src/progress/service.js';

let failures = 0;
function check(name: string, ok: boolean, detail?: unknown): void {
  console.log(`${ok ? 'ok  ' : 'KO  '} ${name}${ok ? '' : ` -> ${JSON.stringify(detail)?.slice(0, 400)}`}`);
  if (!ok) failures++;
}

const app = buildApp();
const suffix = Date.now().toString(36);
const alice = `prova${suffix}a`;
const bruno = `prova${suffix}b`;

async function login(user: string, extra = ''): Promise<string> {
  const response = await app.inject({ method: 'GET', url: `/api/auth/dev?user=${user}${extra}` });
  const cookie = String(response.headers['set-cookie']).split(';')[0]!;
  return cookie;
}

async function call(cookie: string, method: 'GET' | 'POST', url: string, body?: unknown) {
  const response = await app.inject({
    method,
    url: `/api${url}`,
    headers: { cookie, 'content-type': 'application/json' },
    ...(body === undefined ? {} : { payload: JSON.stringify(body) }),
  });
  return { status: response.statusCode, body: response.body ? (JSON.parse(response.body) as Record<string, any>) : {} };
}

/** Le prime `n` parole valide della griglia di una partita, con tempi crescenti. */
function someWords(config: GameConfig, n: number, stepMs = 1_000) {
  const { solutions } = generateGrid(config, loadDictionary().index);
  return solutions.slice(0, n).map((s, i) => ({ path: s.path, atMs: (i + 1) * stepMs }));
}

try {
  // Le sfide si sbloccano al livello 5: gli utenti di prova partono con XP sufficienti
  const a = await login(alice, '&xp=2000');

  // --- Gioca: inizio, ripresa, chiusura ---
  const started = await call(a, 'POST', '/plays', { mode: 'gioca' });
  check('avvio partita', started.status === 201 && started.body.config?.size === 5 && started.body.durationMs === 90_000, started);
  const resumed = await call(a, 'POST', '/plays', { mode: 'gioca' });
  check('la partita in corso si riprende', resumed.status === 200 && resumed.body.id === started.body.id, resumed);

  const words = someWords(started.body.config as GameConfig, 6);
  const finished = await call(a, 'POST', `/plays/${started.body.id}/finish`, { words });
  check('chiusura partita', finished.status === 200 && finished.body.words?.length === 6, finished);
  const sum = (finished.body.words as { points: number }[]).reduce((s, w) => s + w.points, 0);
  check('punteggio = somma dei punti', finished.body.score === sum && sum > 0, finished.body.score);
  const bonusXp = finished.body.starBonus?.xp ?? 0;
  check('XP = punteggio + bonus stella', finished.body.xp === finished.body.score + bonusXp, { xp: finished.body.xp, score: finished.body.score, bonus: finished.body.starBonus });
  check('il bonus stella segue le soglie 20/50/80', (finished.body.score < 20) === (finished.body.starBonus === null), finished.body.starBonus);
  check('tutte le parole sono nuove', finished.body.newWords?.length === 6, finished.body.newWords);
  check(
    'medaglie di inizio',
    ['prima-parola', 'prima-partita'].every((id) => (finished.body.newMedals as { id: string }[]).some((m) => m.id === id)),
    finished.body.newMedals,
  );

  const twice = await call(a, 'POST', `/plays/${started.body.id}/finish`, { words });
  check('non si chiude due volte', twice.status === 409, twice);

  // Seconda partita con le stesse parole di un seed diverso: quelle in comune non sono nuove
  const second = await call(a, 'POST', '/plays', { mode: 'gioca' });
  const secondWords = someWords(second.body.config as GameConfig, 4);
  const secondDone = await call(a, 'POST', `/plays/${second.body.id}/finish`, { words: secondWords, abandoned: true });
  check('abbandono conta come partita', secondDone.status === 200, secondDone);

  // Dati salvati: partita, parole, collezione
  const me = await call(a, 'GET', '/me');
  check('profilo: parole e partite', me.body.gamesPlayed === 2 && me.body.words >= 6, me.body);
  const savedWords = await db.select().from(schema.playWords);
  check('parole salvate una per riga', savedWords.filter((w) => w.playId === started.body.id).length === 6, savedWords.length);
  const [savedPlay] = (await db.select().from(schema.plays)).filter((p) => p.id === started.body.id);
  check('partita salvata con modalità, config e percorsi', savedPlay !== undefined && savedPlay.mode === 'gioca' && savedPlay.submission !== null, savedPlay);

  // Percorsi falsi e parole inventate non contano
  const third = await call(a, 'POST', '/plays', { mode: 'gioca' });
  const cheat = await call(a, 'POST', `/plays/${third.body.id}/finish`, { words: [{ path: [0, 24], atMs: 10 }, { path: [0, 0, 0], atMs: 20 }, { path: [99], atMs: 30 }] });
  check('percorsi non validi ignorati', cheat.status === 200 && cheat.body.score === 0 && cheat.body.words.length === 0, cheat.body);

  // --- Regole delle varianti: bonus caselle e combo (valutazione server) ---
  const base: GameConfig = {
    ...(started.body.config as GameConfig),
    seed: 12345,
    size: 4,
    minWords: 20,
    durationMs: 120_000,
  };
  const { index } = loadDictionary();
  const plain = someWords(base, 3, 10_000);
  const plainScore = gradeSubmission(base, index, plain).reduce((s, w) => s + w.points, 0);
  const bonusConfig: GameConfig = { ...base, bonusCells: [3, 2] };
  const bonusScore = gradeSubmission(bonusConfig, index, someWords(bonusConfig, 3, 10_000)).reduce((s, w) => s + w.points, 0);
  check('caselle bonus non diminuiscono il punteggio', bonusScore >= plainScore, { plainScore, bonusScore });
  const comboConfig: GameConfig = { ...base, combo: true };
  const quick = gradeSubmission(comboConfig, index, someWords(comboConfig, 4, 1_000));
  const slow = gradeSubmission(comboConfig, index, someWords(comboConfig, 4, 10_000));
  const points = (ws: { points: number }[]) => ws.reduce((s, w) => s + w.points, 0);
  check('combo: parole ravvicinate valgono di più', points(quick) > points(slow) && quick.map((w) => w.combo).join() === '1,2,3,4', {
    quick: quick.map((w) => w.combo),
    q: points(quick),
    s: points(slow),
  });

  // --- Sfida 1 contro 1 tra due amici di sviluppo ---
  const b = await login(bruno, '&xp=2000');
  await call(b, 'GET', '/me'); // b esiste nel gioco
  const create = await call(a, 'POST', '/challenges', {
    opponentId: `dev-${bruno}`,
    config: { size: 4, durationMs: 30_000, minWordLength: 3, minWords: 20, scoring: 'versus', pointMode: 'standard', positionBonus: false },
  });
  check('sfida creata', create.status === 201, create);
  const duelId = create.body.id as string;
  check('accettazione', (await call(b, 'POST', `/challenges/${duelId}/respond`, { accept: true })).status === 200);

  const noHelp = await call(a, 'POST', `/challenges/${duelId}/start`, { help: true });
  check('aiuto non disponibile → rifiutato', noHelp.status === 409, noHelp);
  // Un aiuto guadagnato (qui accreditato a mano) si spende all'avvio: +10 s, e resta nel registro
  await db.transaction((tx) => grantItem(tx, `dev-${alice}`, 'aiuto-10s', 1, 'admin', { note: 'prova' }));
  const startA = await call(a, 'POST', `/challenges/${duelId}/start`, { help: true });
  check('con aiuto: +10 s e segnato nella partita', startA.status === 201 && startA.body.durationMs === 40_000 && startA.body.helpUsed === true, startA.body);
  const ledger = await db.select().from(schema.itemLedger).where(eq(schema.itemLedger.userId, `dev-${alice}`));
  check('registro: +1 accredito e -1 spesa legata alla partita', ledger.length === 2 && ledger.some((l) => l.delta === -1 && l.reason === 'used' && l.playId !== null), ledger);
  const [bal] = await db.select().from(schema.userItems).where(eq(schema.userItems.userId, `dev-${alice}`));
  check('saldo a zero dopo la spesa', bal?.quantity === 0, bal);
  const startB = await call(b, 'POST', `/challenges/${duelId}/start`, {});
  check('avvio dei due giocatori', startA.status === 201 && startB.status === 201 && startA.body.seed === startB.body.seed, { startA, startB });

  const duelConfig = (await call(a, 'GET', `/challenges/${duelId}`)).body.config as GameConfig;
  const duelWords = someWords({ ...duelConfig, seed: startA.body.seed as number }, 6);
  const sendA = await call(a, 'POST', `/challenges/${duelId}/results`, { words: duelWords.slice(0, 4) });
  check('primo invio: non ancora chiusa', sendA.status === 200 && sendA.body.settled === false, sendA);
  const sendB = await call(b, 'POST', `/challenges/${duelId}/results`, { words: duelWords.slice(2, 6) });
  check('secondo invio: sfida chiusa con progresso', sendB.status === 200 && sendB.body.settled === true && sendB.body.progress?.xp > 0, sendB);

  const detail = await call(a, 'GET', `/challenges/${duelId}`);
  const scores = detail.body.scores as { score: number; xp: number }[];
  check('esito con i due punteggi e gli XP', detail.body.status === 'completed' && scores.length === 2 && scores.every((s) => s.xp === s.score), detail.body);
  const duelPlays = await db.select().from(schema.plays);
  check('le partite della sfida sono salvate come "sfida"', duelPlays.filter((p) => p.mode === 'sfida' && p.duelId === duelId).length === 2);
  const resend = await call(a, 'POST', `/challenges/${duelId}/results`, { words: duelWords });
  check('niente secondo invio', resend.status === 409, resend);

  // Dieci giorni di fila: il ciclo dà un aiuto che finisce nell'inventario con il suo motivo
  // (bruno ha già giocato oggi con la sfida: i nove giorni successivi chiudono il ciclo)
  for (let i = 1; i <= 9; i++) {
    await db.transaction((tx) => recordPlayStarted(tx, `dev-${bruno}`, new Date(Date.now() + i * 86_400_000)));
  }
  const bruno10 = await db.select().from(schema.itemLedger).where(eq(schema.itemLedger.userId, `dev-${bruno}`));
  check('il ciclo di serie accredita un aiuto', bruno10.length === 1 && bruno10[0]!.reason === 'streak_cycle' && bruno10[0]!.delta === 1, bruno10);
  check('inventario nel profilo', ((await call(b, 'GET', '/me')).body.items as { itemId: string; quantity: number }[]).some((i) => i.itemId === 'aiuto-10s' && i.quantity === 1));
} finally {
  await db.delete(schema.users).where(like(schema.users.id, `dev-prova${suffix}%`));
  await app.close();
}

console.log(failures === 0 ? '\nTutto ok' : `\n${failures} controlli falliti`);
process.exit(failures === 0 ? 0 : 1);
