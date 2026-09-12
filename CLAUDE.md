# Paroliere — CLAUDE.md

Gioco di parole stile Paroliere/Boggle, PWA Svelte + monorepo pnpm. Specifica completa: `docs/SPEC.md`.

## Passo corrente
**Passo 3 — Partita completa** chiuso lato codice (SPEC.md §9, `apps/web`); non ancora committato. Timer reale, schermate Home/Config/Partita/Riepilogo, seed casuale, riepilogo con percorsi, vibrazione sul feedback, test per `apps/web/src/lib`, lint estesa ai `.svelte`. `pnpm typecheck && pnpm lint && pnpm test` passano. Prossimo passo: Passo 4 (PWA, persistenza reale IndexedDB, eventuale DAWG) — non anticiparlo prima di deciderlo esplicitamente.

## Passo 5 — Sfide asincrone (solo progettazione)
Design in SPEC.md §9: backend Node/TS in `apps/server`, riusa `@paroliere/core`, Postgres, auth device-id + upgrade email opzionale. Non implementare finché Passo 3/4 non sono chiusi.

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

## Dipendenze ammesse
- Passo 1 (solo dev): `typescript`, `tsx`, `vitest`, `@types/node`, `eslint`, `typescript-eslint`, `prettier`.
- Passo 2: `svelte`, `vite`, `@sveltejs/vite-plugin-svelte`.
