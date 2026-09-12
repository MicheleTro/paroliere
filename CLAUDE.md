# Paroliere — CLAUDE.md

Gioco di parole stile Paroliere/Boggle, PWA Svelte + monorepo pnpm. Specifica completa: `docs/SPEC.md`.

## Passo corrente
**Passo 4 — PWA e persistenza** chiuso lato codice (SPEC.md §9, `apps/web`). Storico partite e record personale su IndexedDB (`lib/history.ts`), `navigator.storage.persist()`, `vite-plugin-pwa` con precache dell'app shell e caching del dizionario (network-first sul manifest, cache-first sui file versionati), icona placeholder SVG. `pnpm typecheck && pnpm lint && pnpm test` passano; build PWA verificata (`pnpm build` in `apps/web`). Mancano ancora: test su device reali (Chrome Android/Safari iOS, non eseguibile da questo ambiente) e hosting con compressione brotli (nessun host scelto). Prossimo passo naturale: Passo 5 (sfide asincrone, design già in SPEC.md §9) — non avviare `apps/server` senza deciderlo esplicitamente.

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
