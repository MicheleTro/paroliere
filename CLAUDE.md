# Paroliere — CLAUDE.md

Gioco di parole stile Paroliere/Boggle, PWA Svelte + monorepo pnpm. Specifica completa: `docs/SPEC.md`.

## Passo corrente
**Passo 5a — Utenza obbligatoria**, in corso. `apps/server` scaffoldato (Fastify + Drizzle + Postgres, vedi SPEC.md §9): schema `users`, migrazione generata (`apps/server/drizzle/0000_flimsy_mimic.sql`), route `POST /auth/register`, `POST /auth/login`, `GET /auth/me` (JWT via `jose`, hash password via `argon2`). `pnpm typecheck` passa (root + apps/server).

**Non ancora verificato**: la migrazione non è mai stata applicata e le route non sono state testate contro un DB reale — Docker Desktop, su questa macchina, dava "access is denied" sulla named pipe (`dockerDesktopLinuxEngine`) nell'ultima sessione, quindi `docker compose up -d` in `apps/server` non è mai riuscito. Prima di continuare: verificare che Docker Desktop sia "Engine running" e che l'utente Windows sia nel gruppo `docker-users` (serve logout/login per applicare), poi da `apps/server`: `docker compose up -d`, `pnpm db:migrate`, `pnpm dev`, e provare `/health`, `/auth/register`, `/auth/login`, `/auth/me` con curl.

Ancora non fatto (Passo 4, non bloccante): test PWA su device reali Android e hosting con brotli.

## Passo 5 — Backend e sfide (design completo, implementazione in corso)
Design in SPEC.md §9, in due parti:
- **Passo 5a — Utenza obbligatoria** (IN CORSO, vedi sopra): login (username/email/password) richiesto per usare l'app anche in singolo giocatore (RF-19); supera la decisione "nessun backend nell'MVP" dei Passi 1–4. Manca ancora: verifica end-to-end (blocco Docker), poi il gate lato client in `apps/web` (route guard, pagina login/registrazione, persistenza JWT) — non ancora iniziato.
- **Passo 5b — Sfide come entità** (NON iniziato): si costruisce sopra il 5a. Sfida = serie di N match (`bestOf`) sulla stessa config, partecipanti individuali o a squadre, nessuna scadenza — il punteggio di un match si calcola solo quando tutti hanno giocato. Regola di punteggio `versus` (RF-24): parola unica = doppio del valore base, parola in comune (≥2 partecipanti) = valore base.

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
- Passo 5a (`apps/server`): `fastify`, `drizzle-orm`, `drizzle-kit` (dev), `postgres`, `argon2`, `jose`, `zod`.
