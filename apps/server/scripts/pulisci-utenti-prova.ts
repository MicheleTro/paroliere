// Strumento di sviluppo: cancella dal database locale gli utenti creati dalle prove automatiche (nomi con suffisso
// generato: alem*, beam*, dbg*, gr*, lay*, lvl*, nuovo*, probe*, prova*, sh*, vis*, wk*) con tutti i loro dati
// (partite, parole, medaglie, oggetti). Non tocca gli utenti usati a mano (dev, mario, ...). Uso:
//   pnpm --filter @paroliere/server exec tsx --env-file=.env scripts/pulisci-utenti-prova.ts
import { like, or } from 'drizzle-orm';

import { db } from '../src/db/client.js';
import * as schema from '../src/db/schema.js';

const PREFIXES = ['alem', 'beam', 'dbg', 'gr', 'lay', 'lvl', 'nuovo', 'probe', 'prova', 'sh', 'vis', 'wk'];

const removed = await db
  .delete(schema.users)
  .where(or(...PREFIXES.map((p) => like(schema.users.id, `dev-${p}%`))))
  .returning({ id: schema.users.id });
console.log(`Cancellati ${removed.length} utenti di prova`);

const left = await db.select({ id: schema.users.id }).from(schema.users).orderBy(schema.users.id);
console.log(`Restano: ${left.map((u) => u.id).join(', ') || 'nessuno'}`);
process.exit(0);
