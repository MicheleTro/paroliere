// Elenco degli utenti nel database locale con quante partite hanno (per ripulire quelli di prova). Solo lettura.
import { count, eq } from 'drizzle-orm';

import { db } from '../src/db/client.js';
import * as schema from '../src/db/schema.js';

const rows = await db
  .select({ id: schema.users.id, username: schema.users.username, plays: count(schema.plays.id) })
  .from(schema.users)
  .leftJoin(schema.plays, eq(schema.plays.userId, schema.users.id))
  .groupBy(schema.users.id, schema.users.username)
  .orderBy(schema.users.id);
for (const r of rows) console.log(`${r.id}\t${r.username}\t${r.plays} partite`);
console.log(`Totale: ${rows.length}`);
process.exit(0);
