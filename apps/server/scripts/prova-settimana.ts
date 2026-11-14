/* eslint-disable @typescript-eslint/no-explicit-any -- script di prova: le risposte JSON sono lette in modo libero */
// Prova della Settimana, del profilo e delle impostazioni contro un Postgres reale, senza browser.
// Richiede Postgres migrato, il dizionario generato (dist/dictionary) e DEV_LOGIN=true. Uso:
//   pnpm --filter @paroliere/server exec tsx --env-file=.env scripts/prova-settimana.ts
// Crea utenti "dev-prova*" e li cancella alla fine (le griglie della settimana restano: sono dati veri).
import { addDays } from '@paroliere/core';
import { like } from 'drizzle-orm';

import { buildApp } from '../src/app.js';
import { db } from '../src/db/client.js';
import * as schema from '../src/db/schema.js';
import { ensureGrid, weekClock } from '../src/week/service.js';

let failures = 0;
function check(name: string, ok: boolean, detail?: unknown): void {
  console.log(`${ok ? 'ok  ' : 'KO  '} ${name}${ok ? '' : ` -> ${JSON.stringify(detail)?.slice(0, 500)}`}`);
  if (!ok) failures++;
}

const app = buildApp();
const suffix = Date.now().toString(36);
const alice = `prova${suffix}a`;
const bruno = `prova${suffix}b`;

async function login(user: string, extra = ''): Promise<string> {
  const response = await app.inject({ method: 'GET', url: `/api/auth/dev?user=${user}${extra}` });
  return String(response.headers['set-cookie']).split(';')[0]!;
}

async function call(cookie: string, method: 'GET' | 'POST' | 'PUT', url: string, body?: unknown) {
  const response = await app.inject({
    method,
    url: `/api${url}`,
    headers: { cookie, 'content-type': 'application/json' },
    ...(body === undefined ? {} : { payload: JSON.stringify(body) }),
  });
  return { status: response.statusCode, body: response.body ? (JSON.parse(response.body) as Record<string, any>) : {} };
}

try {
  const clock = weekClock();
  console.log(`Settimana ${clock.weekStart}, oggi è il giorno ${clock.todayIndex} (${clock.today})`);

  // --- Tutte le varianti si generano (anche la 6×6 e le parole lunghe) ---
  for (let day = 0; day < 7; day++) {
    const started = Date.now();
    try {
      const grid = await ensureGrid(clock.weekStart, day);
      const cells = grid.config.size * grid.config.size;
      check(
        `griglia del giorno ${day} (${grid.config.size}×${grid.config.size}${grid.config.combo ? ', combo' : ''}${grid.config.bonusCells ? ', bonus' : ''}): ${grid.solutions.length} parole in ${Date.now() - started} ms`,
        grid.tiles.length === cells && grid.solutions.length >= grid.config.minWords && (grid.config.bonusCells ? grid.multipliers?.length === cells : true),
      );
    } catch (error) {
      check(`griglia del giorno ${day}`, false, String(error));
    }
  }
  const again = await ensureGrid(clock.weekStart, 0);
  const again2 = await ensureGrid(clock.weekStart, 0);
  check('la griglia si crea una volta sola e resta uguale', again.id === again2.id && again.config.seed === again2.config.seed);

  const a = await login(alice);
  const b = await login(bruno);

  // --- Panoramica ---
  const week = await call(a, 'GET', '/week');
  const days = week.body.days as { dayIndex: number; state: string; preset: { name: string } | null }[];
  check('panoramica con 7 giorni e i preset', week.status === 200 && days.length === 7 && days.every((d) => d.preset), week.body);
  check(
    'i giorni futuri sono bloccati, oggi è aperto',
    days.filter((d) => d.dayIndex > clock.todayIndex).every((d) => d.state === 'locked') &&
      days[clock.todayIndex]!.state === (clock.todayIndex === 0 ? 'open' : 'blocked'),
    days.map((d) => d.state),
  );
  if (clock.todayIndex < 6) {
    const locked = await call(a, 'POST', `/week/${clock.todayIndex + 1}/start`, {});
    check('un giorno futuro non si può iniziare', locked.status === 403, locked);
  }

  // --- Ogni giornata si sblocca solo giocando la precedente ---
  const today = clock.todayIndex;
  if (today > 0) {
    const early = await call(a, 'POST', `/week/${today}/start`, {});
    check('oggi è bloccato finché non si gioca ieri', early.status === 403, early);
    const detailBlocked = await call(a, 'GET', `/week/${today}`);
    check('il dettaglio dice "blocked"', detailBlocked.body.state === 'blocked', detailBlocked.body);
    for (let day = 0; day < today; day++) {
      const s0 = await call(a, 'POST', `/week/${day}/start`, {});
      check(`giorno ${day} recuperabile in ordine`, s0.status === 201, s0);
      const sol = (s0.body.solutions as { path: number[] }[]).slice(0, 2).map((x, i) => ({ path: x.path, atMs: (i + 1) * 1000 }));
      await call(a, 'POST', `/plays/${s0.body.id}/finish`, { words: sol });
    }
    const after = await call(a, 'GET', '/week');
    check('dopo aver giocato i giorni passati oggi è aperto', after.body.days[today].state === 'open', after.body.days.map((d: any) => d.state));
  }

  // --- Una partita sulla griglia di oggi ---
  const start = await call(a, 'POST', `/week/${today}/start`, {});
  check('avvio: griglia congelata e soluzioni', start.status === 201 && start.body.grid?.tiles?.length > 0 && start.body.solutions?.length >= 50, { status: start.status, keys: Object.keys(start.body) });
  const resumed = await call(a, 'POST', `/week/${today}/start`, {});
  check('il tentativo in corso si riprende', resumed.status === 200 && resumed.body.id === start.body.id);

  const solutions = start.body.solutions as { word: string; path: number[] }[];
  const words = solutions.slice(0, 8).map((s, i) => ({ path: s.path, atMs: (i + 1) * 1500 }));
  const finished = await call(a, 'POST', `/plays/${start.body.id}/finish`, { words });
  check('chiusura e punteggio', finished.status === 200 && finished.body.score > 0 && finished.body.xp === finished.body.score, finished.body);
  const earned = await call(a, 'GET', '/me/medals');
  check('prima settimana tra le medaglie ottenute', earned.body.medals.some((m: any) => m.id === 'prima-settimana' && m.earnedAt), earned.body);

  const second = await call(a, 'POST', `/week/${today}/start`, {});
  check('un solo tentativo per griglia', second.status === 409, second);

  // --- Classifica del giorno e della settimana ---
  for (let day = 0; day < today; day++) {
    const s0 = await call(b, 'POST', `/week/${day}/start`, {});
    await call(b, 'POST', `/plays/${s0.body.id}/finish`, { words: [] });
  }
  const bStart = await call(b, 'POST', `/week/${today}/start`, {});
  const bWords = solutions.slice(2, 5).map((s, i) => ({ path: s.path, atMs: (i + 1) * 1000 }));
  const bBeforeDetail = await call(b, 'GET', `/week/${today}`);
  check('chi non ha giocato vede i punteggi ma non le parole', bBeforeDetail.body.wordsVisible === false && bBeforeDetail.body.leaderboard.length >= 1 && bBeforeDetail.body.leaderboard.every((r: any) => r.words === undefined), bBeforeDetail.body);
  await call(b, 'POST', `/plays/${bStart.body.id}/finish`, { words: bWords });
  const detail = await call(a, 'GET', `/week/${today}`);
  const board = detail.body.leaderboard as { username: string; score: number; me: boolean; words?: string[] }[];
  check('classifica del giorno ordinata, con le parole dopo aver giocato', board.length >= 2 && board.every((r, i) => i === 0 || board[i - 1]!.score >= r.score) && detail.body.wordsVisible === true && Array.isArray(board[0]!.words) && board.some((r) => r.me), detail.body);
  const ranking = await call(a, 'GET', '/week/ranking');
  check('classifica della settimana', ranking.status === 200 && ranking.body.rows.length >= 2 && ranking.body.rows.some((r: any) => r.me) && ranking.body.rows.some((r: any) => r.userId === `dev-${bruno}`), ranking.body);
  const friends = await call(a, 'GET', '/week/ranking?scope=amici');
  check('classifica amici bloccata sotto il livello 5', friends.body.locked === true, friends.body);

  // --- Recupero: un giorno passato non giocato si recupera, ma solo in ordine ---
  if (today > 1) {
    const c = await login(`${alice}c`);
    const skip = await call(c, 'POST', `/week/1/start`, {});
    check('non si salta un giorno', skip.status === 403, skip);
    const first = await call(c, 'POST', `/week/0/start`, {});
    check('il lunedì si recupera sempre', first.status === 201, first);
    const overview = await call(c, 'GET', '/week');
    check('stato "in corso" per il tentativo iniziato', overview.body.days[0].state === 'in_progress', overview.body.days[0]);
    check('il giorno dopo resta bloccato finché il primo non è chiuso', overview.body.days[1].state === 'blocked', overview.body.days[1]);
  }

  // --- Aiuto sulla Settimana ---
  const helper = `${alice}h`;
  const h = await login(helper, '&xp=2000');
  const noHelp = await call(h, 'POST', `/week/0/start`, { help: true });
  check('senza aiuti la richiesta è rifiutata', noHelp.status === 409, noHelp);

  // --- Profilo: parole, medaglie, serie ---
  const me = await call(a, 'GET', '/me');
  check('profilo con serie e inventario', me.status === 200 && me.body.streak?.days >= 1 && me.body.streak?.playedToday === true && Array.isArray(me.body.items), me.body);
  const myWords = await call(a, 'GET', '/me/words');
  check('collezione di parole', myWords.body.total === myWords.body.words.length && myWords.body.total >= 8, myWords.body);
  const sevenPlus = await call(a, 'GET', '/me/words?length=7%2B');
  check('filtro per lunghezza (7+)', (sevenPlus.body.words as string[]).every((w) => w.length >= 7), sevenPlus.body);
  const medals = await call(a, 'GET', '/me/medals');
  check('catalogo medaglie con quelle ottenute', medals.body.medals.length === 14 && medals.body.medals.some((m: any) => m.id === 'prima-parola' && m.earnedAt), medals.body);

  // --- Impostazioni ---
  const defaults = await call(a, 'GET', '/me/settings');
  check('impostazioni predefinite', defaults.body.settings.sound === true && defaults.body.settings.sky === 'auto' && defaults.body.available.reminder === false, defaults.body);
  const saved = await call(a, 'PUT', '/me/settings', { sound: false, sky: 'notte' });
  check('salvataggio parziale', saved.status === 200 && saved.body.settings.sound === false && saved.body.settings.sky === 'notte' && saved.body.settings.vibration === true, saved.body);
  check('chiave sconosciuta rifiutata', (await call(a, 'PUT', '/me/settings', { colore: 'rosso' })).status === 400);
  check('valore non valido rifiutato', (await call(a, 'PUT', '/me/settings', { sky: 'pioggia' })).status === 400);
  check('le impostazioni restano', (await call(a, 'GET', '/me/settings')).body.settings.sound === false);

  // --- Amministrazione: preset e piano ---
  const admin = await login(`${alice}x`, '&admin=1');
  check('i giocatori non vedono i preset', (await call(a, 'GET', '/admin/presets')).status === 403);
  const presets = await call(admin, 'GET', '/admin/presets');
  const gioca = (presets.body as unknown as { slug: string; id: string }[]).find((p) => p.slug === 'gioca')!;
  check('elenco preset', presets.status === 200 && (presets.body as unknown as unknown[]).length >= 8, presets.body);
  check('il preset della partita libera non si disattiva', (await call(admin, 'PUT', `/admin/presets/${gioca.id}`, { active: false })).status === 400);
  const created = await call(admin, 'POST', '/admin/presets', { slug: `prova-${suffix}`, name: 'Prova', description: '', size: 4, durationMs: 60_000, minWordLength: 3, minWords: 30, bonusCells: [], combo: false, pointMode: 'standard', positionBonus: false, active: true });
  check('nuovo preset', created.status === 201, created);
  const plan = await call(admin, 'GET', '/admin/week-plan');
  check('piano settimanale con 7 giorni', plan.status === 200 && (plan.body as unknown as unknown[]).length === 7, plan.body);
  const badPlan = await call(admin, 'PUT', '/admin/week-plan', (plan.body as unknown as { dayIndex: number }[]).slice(0, 6));
  check('piano incompleto rifiutato', badPlan.status === 400);
  const goodPlan = await call(admin, 'PUT', '/admin/week-plan', plan.body);
  check('piano riscritto uguale', goodPlan.status === 204, goodPlan);
  await db.delete(schema.gamePresets).where(like(schema.gamePresets.slug, `prova-${suffix}`));

  console.log(`\nFinestra: ${clock.weekStart} → ${addDays(clock.weekStart, 6)}`);
} finally {
  await db.delete(schema.users).where(like(schema.users.id, `dev-prova${suffix}%`));
  await app.close();
}

console.log(failures === 0 ? '\nTutto ok' : `\n${failures} controlli falliti`);
process.exit(failures === 0 ? 0 : 1);
