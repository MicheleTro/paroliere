import { fileURLToPath } from 'node:url';

import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';

import { config } from '../config.js';

const queryClient = postgres(config.DATABASE_URL, { max: 1 });
const db = drizzle(queryClient);

await migrate(db, { migrationsFolder: fileURLToPath(new URL('../../drizzle', import.meta.url)) });
await queryClient.end();
