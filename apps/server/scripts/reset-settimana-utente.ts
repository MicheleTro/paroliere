// Strumento di sviluppo: cancella le partite che un utente ha giocato sulle griglie della settimana in corso, così
// può rigiocarle. Le griglie restano; XP, parole, serie e medaglie già assegnati non si toccano. Uso:
//   pnpm --filter @paroliere/server exec tsx --env-file=.env scripts/reset-settimana-utente.ts mario dev
import { and, eq, inArray } from 'drizzle-orm';

import { db } from '../src/db/client.js';
import * as schema from '../src/db/schema.js';
import { weekClock } from '../src/week/service.js';

const names = process.argv.slice(2);
if (names.length === 0) {
  console.error('Indica almeno un nome utente di sviluppo (es. mario)');
  process.exit(1);
}

const clock = weekClock();
const grids = await db.select({ id: schema.weeklyGrids.id }).from(schema.weeklyGrids).where(eq(schema.weeklyGrids.weekStart, clock.weekStart));
const gridIds = grids.map((g) => g.id);

for (const name of names) {
  const userId = `dev-${name}`;
  const [user] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.id, userId));
  if (!user) {
    console.log(`${userId}: non esiste`);
    continue;
  }
  const removed =
    gridIds.length === 0
      ? []
      : await db
          .delete(schema.plays)
          .where(and(eq(schema.plays.userId, userId), inArray(schema.plays.gridId, gridIds)))
          .returning({ id: schema.plays.id });
  console.log(`${userId}: ${removed.length} partite della settimana ${clock.weekStart} cancellate`);
}
process.exit(0);
