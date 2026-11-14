// Strumento di sviluppo: cancella le griglie della settimana in corso (e le partite giocate su di esse) e le ricrea
// con il piano settimanale attuale. XP, parole e medaglie già assegnati NON si toccano. Uso:
//   pnpm --filter @paroliere/server exec tsx --env-file=.env scripts/ricrea-settimana.ts
import { eq, inArray } from 'drizzle-orm';

import { db } from '../src/db/client.js';
import * as schema from '../src/db/schema.js';
import { ensureGrid, weekClock } from '../src/week/service.js';

const clock = weekClock();
console.log(`Settimana ${clock.weekStart}, oggi è il giorno ${clock.todayIndex}`);

const grids = await db.select({ id: schema.weeklyGrids.id }).from(schema.weeklyGrids).where(eq(schema.weeklyGrids.weekStart, clock.weekStart));
const ids = grids.map((g) => g.id);
if (ids.length > 0) {
  const removedPlays = await db.delete(schema.plays).where(inArray(schema.plays.gridId, ids)).returning({ id: schema.plays.id });
  const removedGrids = await db.delete(schema.weeklyGrids).where(inArray(schema.weeklyGrids.id, ids)).returning({ id: schema.weeklyGrids.id });
  console.log(`Cancellate ${removedGrids.length} griglie e ${removedPlays.length} partite`);
}

for (let day = 0; day < 7; day++) {
  const grid = await ensureGrid(clock.weekStart, day);
  const [preset] = await db.select().from(schema.gamePresets).where(eq(schema.gamePresets.id, grid.presetId));
  console.log(
    `giorno ${day}: ${preset?.name} ${grid.config.size}×${grid.config.size} ${grid.config.durationMs / 1000}s${grid.config.pointMode === 'speciale' ? ' speciale' : ''}${grid.config.positionBonus ? ' posizione' : ''}${grid.config.combo ? ' combo' : ''} · ${grid.solutions.length} parole`,
  );
}
process.exit(0);
