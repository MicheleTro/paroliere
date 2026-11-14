// Verifica che le migrazioni, applicate da zero su un database vuoto e temporaneo, producano lo schema e i dati
// iniziali attesi (preset, piano, medaglie, oggetti). Il database temporaneo si crea e si cancella da solo; il
// database di sviluppo non viene toccato. Uso:
//   pnpm --filter @paroliere/server exec tsx --env-file=.env scripts/verifica-migrazioni.ts
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

const url = new URL(process.env.DATABASE_URL!);
const scratchName = `paroliere_verifica_${Date.now().toString(36)}`;

const admin = postgres(Object.assign(new URL(url), { pathname: '/postgres' }).toString(), { max: 1 });
await admin.unsafe(`CREATE DATABASE ${scratchName}`);

let failures = 0;
function check(name: string, ok: boolean, detail?: unknown): void {
  console.log(`${ok ? 'ok  ' : 'KO  '} ${name}${ok ? '' : ` -> ${JSON.stringify(detail)}`}`);
  if (!ok) failures++;
}

try {
  const scratchUrl = Object.assign(new URL(url), { pathname: `/${scratchName}` }).toString();
  const client = postgres(scratchUrl, { max: 1, onnotice: () => {} });
  await migrate(drizzle(client), { migrationsFolder: new URL('../drizzle', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1') });

  const count = async (table: string): Promise<number> => Number((await client.unsafe(`SELECT count(*) AS n FROM ${table}`))[0]!.n);
  check('8 preset iniziali + 3 nuovi', (await count('game_presets')) === 11, await count('game_presets'));
  check('piano di 7 giorni', (await count('week_plan')) === 7);
  check('14 medaglie', (await count('medal_definitions')) === 14, await count('medal_definitions'));
  check('oggetto aiuto', (await count('item_definitions')) >= 1);
  const plan = await client.unsafe(
    'SELECT p.slug FROM week_plan w JOIN game_presets p ON p.id = w.preset_id ORDER BY w.day_index',
  );
  check(
    'giornate: classica, lunghe, speciale, posizione, combo, misto, domenica',
    plan.map((r) => r.slug).join(',') === 'classica,lunghe,speciale,posizione,combo,misto,domenica',
    plan.map((r) => r.slug),
  );
  const gioca = await client.unsafe("SELECT size, duration_ms, min_words FROM game_presets WHERE slug = 'gioca'");
  check('Gioca: 5×5, 90 s, 80 parole', gioca[0]?.size === 5 && gioca[0]?.duration_ms === 90000 && gioca[0]?.min_words === 80, gioca);
  const tables = await client.unsafe("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY 1");
  check(
    'le vecchie tabelle di storico non ci sono',
    !tables.some((t) => ['games', 'game_configs', 'player_word_stats'].includes(t.table_name)),
    tables.map((t) => t.table_name),
  );
  await client.end();
} catch (error) {
  failures++;
  console.error(error);
} finally {
  await admin.unsafe(`DROP DATABASE IF EXISTS ${scratchName}`);
  await admin.end();
}

console.log(failures === 0 ? '\nTutto ok' : `\n${failures} controlli falliti`);
process.exit(failures === 0 ? 0 : 1);
