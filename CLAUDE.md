# Paroliere — CLAUDE.md

Gioco di parole stile Paroliere/Boggle, PWA Svelte + monorepo pnpm. Specifica completa: `docs/SPEC.md`.

## Passo corrente
**Passo 5a — Utenza obbligatoria**, completato. `apps/server` (Fastify + Drizzle + Postgres, vedi SPEC.md §9): schema `users`, migrazione applicata, route `POST /auth/register`, `POST /auth/login` (body: `identifier` — username o email — e `password`), `GET /auth/me` (JWT via `jose`, hash password via `argon2`), CORS abilitato via `CORS_ORIGIN` (default `http://localhost:5173`, richiede `@fastify/cors`). Verificato end-to-end contro Postgres reale via Docker.

`apps/web`: gate lato client in `App.svelte` — al caricamento verifica il JWT salvato (`localStorage`) contro `/auth/me` (`src/lib/auth.svelte.ts`); se assente/non valido mostra `LoginScreen.svelte` (login + registrazione), altrimenti procede alla home (con azione di logout). Testato manualmente nel browser: login, registrazione, gate attivo.

Setup locale necessario: `apps/server/.env` e `apps/web/.env` da copiare dai rispettivi `.env.example` (non versionati). `pnpm typecheck`, `pnpm lint`, `pnpm test` passano su tutto il monorepo.

**Passo 5b — Sfide come entità**, implementato sia lato server che lato client. Server (`apps/server`): schema Drizzle (`game_configs`, `challenges`, `teams`, `challenge_participants`, `challenge_matches`, `match_results`, `games`) e route (`POST /challenges`, `POST /challenges/:id/join`, `GET /challenges/:id`, `POST /challenges/:id/matches/:matchIndex/results`, `GET /users/me/challenges`, `GET/POST /users/me/history(/sync)`) come da SPEC.md §9. `packages/core` esteso con `scoring: 'classic' | 'versus'` e `computeVersusScores` (RF-24). Verificato end-to-end contro Postgres reale: creazione sfida, join, settle di un match `versus` con punteggi corretti, sync storico locale.

Client (`apps/web`): pagina "Sfide" (`ChallengesScreen`, `CreateChallengeScreen`, `ChallengeDetailScreen`, `ChallengeMatchSummaryScreen`), raggiungibile dalla Home. Gioca un match riusando `PlayScreen` esistente con seed dal server invece di `crypto.getRandomValues`; al termine invia solo i percorsi grezzi (RF-22). Guardia: se `dictionaryVersion` del client non coincide con quella del server, il match non parte (altrimenti griglie diverse per lo stesso seed). Estratto `apps/web/src/lib/api.ts` (fetch + header auth + parsing errori) condiviso tra `auth.svelte.ts` e il nuovo `challenges.ts`.

Verificato manualmente su dispositivo reale (smartphone in rete locale, richiede `CORS_ORIGIN` con l'IP LAN del PC oltre a `localhost` e `VITE_API_URL` puntato allo stesso IP). Scoperta e risolta una lacuna: non esisteva modo per un secondo giocatore di scoprire l'esistenza di una sfida creata da altri (solo "le mie sfide"). Per ora, scelta deliberatamente semplice: `GET /challenges` elenca a chiunque sia autenticato tutte le sfide `open`, più quelle `in_progress`/`completed` a cui l'utente partecipa (nessun meccanismo di invito/link privato per ora — eventuale evoluzione futura, non richiesta).

Bug corretto: il numero di partecipanti richiesti non era fissato in fase di creazione, quindi un match si "settlava" (e la sfida si chiudeva) appena i pochi partecipanti effettivamente iscritti avevano giocato, anche se altri giocatori attesi non si erano ancora iscritti. Fix: nuovo stato sfida `open → in_progress → completed`. In creazione si fissa `maxParticipants` (individuale) o `playersPerTeam` (a squadre, uguale per tutte le squadre, minimo 2 — altrimenti sarebbe individuale); il creatore si iscrive automaticamente (in modalità a squadre scegliendo la propria squadra in fase di creazione). La sfida passa a `in_progress` solo quando il numero richiesto è raggiunto (tutti i partecipanti per l'individuale, ogni squadra piena per le squadre); l'iscrizione a una singola squadra piena viene rifiutata (le altre squadre restano disponibili) mentre l'intera sfida resta apribile finché non è `in_progress`. I risultati di un match si possono inviare solo quando la sfida è `in_progress`. Le sfide `in_progress` non sono più visibili a chi non partecipa (come le `completed`). Verificato end-to-end (individuale e a squadre) con uno script disposable.

Bug corretto: un giocatore poteva rigiocare un match già inviato (il bottone "Gioca" restava attivo finché il match non era `settled`, cioè finché anche l'avversario non aveva giocato). Fix: `GET /challenges/:id` ora indica per ogni match in attesa `submittedByMe`; il client nasconde "Gioca" e mostra "Hai già giocato, in attesa degli altri" una volta inviato un risultato (il server rifiutava già il doppio invio con 409, ma ora il client non lo propone nemmeno).

Bug corretto (anti-cheat): ricaricando la pagina durante un match si poteva rigiocarlo da capo con il timer resettato, perché il tempo era tenuto solo lato client. Fix: nuova tabella `challenge_match_starts` e route `POST /challenges/:id/matches/:matchIndex/start`, chiamata dal client subito prima di avviare la griglia; è idempotente (ricaricare la pagina e rientrare restituisce lo stesso `startedAt`, non lo resetta) e il client calcola il tempo rimanente da lì (`durationMs - elapsed`) invece di riavviare da `durationMs` pieno. Se il tempo residuo è già scaduto, il client lo segnala e non fa partire il match. Un match iniziato ma mai inviato entro `durationMs` + 15s di margine viene chiuso automaticamente con punteggio zero — controllo pigro (senza job in background), eseguito quando la sfida viene letta (`GET /challenges/:id`) o quando arriva un invio per un altro match della stessa sfida.

Aggiunta: il creatore di una sfida può cancellarla in qualsiasi stato (`POST /challenges/:id/cancel`, con popup di conferma lato client), nuovo stato `cancelled` — non più unibile né giocabile, ma resta visibile a chi vi partecipava (come `completed`), invisibile agli altri.

Ancora non fatto (Passo 4, non bloccante): test PWA su device reali Android e hosting con brotli.

## Passo 5 — Backend e sfide (design completo, implementazione in corso)
Design in SPEC.md §9, in due parti:
- **Passo 5a — Utenza obbligatoria** (COMPLETATO, vedi sopra): login (username/email/password) richiesto per usare l'app anche in singolo giocatore (RF-19); supera la decisione "nessun backend nell'MVP" dei Passi 1–4.
- **Passo 5b — Sfide come entità** (backend completato, gate client non iniziato, vedi sopra): si costruisce sopra il 5a. Sfida = serie di N match (`bestOf`) sulla stessa config, partecipanti individuali o a squadre, nessuna scadenza — il punteggio di un match si calcola solo quando tutti hanno giocato. Regola di punteggio `versus` (RF-24): parola unica = doppio del valore base, parola in comune (≥2 partecipanti) = valore base.

Backend Node/TS in `apps/server`, riusa `@paroliere/core`, Postgres+Drizzle (già in uso, non solo progettato).

## Convenzioni (SPEC.md §10)
- Node LTS 20+, pnpm workspaces, TypeScript strict con `noUncheckedIndexedAccess`.
- Identificatori, nomi file, commit message: inglese. Documentazione e UI: italiano.
- Commit piccoli, Conventional Commits. Non fare push.
- Non committare `dist/`, dizionario sorgente o generato senza decisione esplicita.
- `packages/core`: zero dipendenze runtime, niente DOM/fs/rete/`Date.now()`/`Math.random()`.

## Comandi principali
- `pnpm install`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm build:dict --source <file> [--out dist/dictionary]`
- `pnpm fixtures`
- `pnpm cli grid --seed 42 --dict <file>`
- `pnpm cli bench --grids 1000 --dict <file>`
- `pnpm dev` (avvia `apps/web`)
- `apps/server`: `docker compose up -d` (Postgres locale), `pnpm db:generate` (nuova migrazione da schema), `pnpm db:migrate` (applica), `pnpm dev` (Fastify con watch), `pnpm start`.

## Dipendenze ammesse
- Passo 1 (solo dev): `typescript`, `tsx`, `vitest`, `@types/node`, `eslint`, `typescript-eslint`, `prettier`.
- Passo 2: `svelte`, `vite`, `@sveltejs/vite-plugin-svelte`.
- Passo 4: `idb`, `vite-plugin-pwa`.
- Passo 5a (`apps/server`): `fastify`, `@fastify/cors`, `drizzle-orm`, `drizzle-kit` (dev), `postgres`, `argon2`, `jose`, `zod`.
