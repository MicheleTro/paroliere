import { defineConfig } from '@playwright/test';

// I test e2e girano contro un'app GIÀ avviata (server con DEV_LOGIN=true + Vite, vedi CLAUDE.md):
//   pnpm --filter @paroliere/server dev     e     pnpm --filter @paroliere/web dev
// Indirizzo diverso con E2E_URL. Gli utenti sono quelli di sviluppo (/api/auth/dev?user=...).
export default defineConfig({
  testDir: 'e2e',
  testMatch: '**/*.e2e.ts',
  timeout: 150_000,
  use: { baseURL: process.env.E2E_URL ?? 'http://localhost:5173' },
});
