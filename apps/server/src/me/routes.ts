import { and, asc, eq, gte, isNull, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { requireAuth } from '../auth/require-auth.js';
import { db } from '../db/client.js';
import * as schema from '../db/schema.js';

/**
 * Impostazioni personali: una riga per chiave in `user_settings`. Per aggiungerne una basta una riga qui (chiave,
 * regola di validazione, valore predefinito): niente migrazioni. Il valore predefinito vale finché l'utente non
 * sceglie.
 */
const SETTINGS = {
  sound: { schema: z.boolean(), default: true as boolean },
  vibration: { schema: z.boolean(), default: true as boolean },
  /** Promemoria della serie: si salva la scelta, ma le notifiche push non sono ancora attive. */
  reminder: { schema: z.boolean(), default: false as boolean },
  sky: { schema: z.enum(['auto', 'giorno', 'notte']), default: 'auto' as string },
  season: { schema: z.enum(['auto', 'autunno', 'inverno', 'primavera', 'estate']), default: 'auto' as string },
} as const;

type SettingKey = keyof typeof SETTINGS;
const SETTING_KEYS = Object.keys(SETTINGS) as SettingKey[];

async function loadSettings(userId: string): Promise<Record<string, unknown>> {
  const rows = await db.select().from(schema.userSettings).where(eq(schema.userSettings.userId, userId));
  const stored = new Map(rows.map((r) => [r.key, r.value]));
  const result: Record<string, unknown> = {};
  for (const key of SETTING_KEYS) {
    const parsed = SETTINGS[key].schema.safeParse(stored.get(key));
    result[key] = parsed.success ? parsed.data : SETTINGS[key].default;
  }
  return result;
}

const wordsQuery = z.object({
  length: z.enum(['tutte', '3', '4', '5', '6', '7+']).default('tutte'),
});

export function registerMeRoutes(app: FastifyInstance): void {
  app.get('/me/settings', { preHandler: requireAuth }, async (request, reply) => {
    return reply.header('Cache-Control', 'no-store').send({
      settings: await loadSettings(request.userId!),
      // Cosa è già attivo lato server: il promemoria non ancora
      available: { reminder: false },
    });
  });

  // Aggiorna solo le chiavi inviate; le sconosciute sono respinte
  app.put('/me/settings', { preHandler: requireAuth }, async (request, reply) => {
    const body = z.record(z.string(), z.unknown()).safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: 'Richiesta non valida' });
    const me = request.userId!;

    const updates: { key: SettingKey; value: unknown }[] = [];
    for (const [key, value] of Object.entries(body.data)) {
      if (!(key in SETTINGS)) return reply.code(400).send({ error: `Impostazione sconosciuta: ${key}` });
      const parsed = SETTINGS[key as SettingKey].schema.safeParse(value);
      if (!parsed.success) return reply.code(400).send({ error: `Valore non valido per ${key}` });
      updates.push({ key: key as SettingKey, value: parsed.data });
    }

    if (updates.length > 0) {
      await db
        .insert(schema.userSettings)
        .values(updates.map((u) => ({ userId: me, key: u.key, value: u.value })))
        .onConflictDoUpdate({
          target: [schema.userSettings.userId, schema.userSettings.key],
          set: { value: sql`excluded.value`, updatedAt: new Date() },
        });
    }
    return reply.send({ settings: await loadSettings(me), available: { reminder: false } });
  });

  // Fine della prima partita guidata (si segna una volta sola)
  app.post('/me/onboarded', { preHandler: requireAuth }, async (request, reply) => {
    const me = request.userId!;
    await db.insert(schema.profiles).values({ userId: me }).onConflictDoNothing();
    await db
      .update(schema.profiles)
      .set({ onboardedAt: new Date() })
      .where(and(eq(schema.profiles.userId, me), isNull(schema.profiles.onboardedAt)));
    return reply.code(204).send();
  });

  // La collezione: le parole trovate almeno una volta, con filtro per lunghezza
  app.get('/me/words', { preHandler: requireAuth }, async (request, reply) => {
    const query = wordsQuery.safeParse(request.query);
    if (!query.success) return reply.code(400).send({ error: 'Richiesta non valida' });
    const me = request.userId!;
    const length = query.data.length;

    const conditions = [eq(schema.foundWords.userId, me)];
    if (length === '7+') conditions.push(gte(sql`length(${schema.foundWords.word})`, 7));
    else if (length !== 'tutte') conditions.push(eq(sql`length(${schema.foundWords.word})`, Number(length)));

    const rows = await db
      .select({ word: schema.foundWords.word })
      .from(schema.foundWords)
      .where(and(...conditions))
      .orderBy(asc(schema.foundWords.word))
      .limit(5000);
    const [totalRow] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(schema.foundWords)
      .where(eq(schema.foundWords.userId, me));

    return reply.header('Cache-Control', 'no-store').send({ total: totalRow?.total ?? 0, length, words: rows.map((r) => r.word) });
  });

  // Tutte le medaglie del catalogo, con la data se ottenute
  app.get('/me/medals', { preHandler: requireAuth }, async (request, reply) => {
    const me = request.userId!;
    const definitions = await db
      .select()
      .from(schema.medalDefinitions)
      .where(eq(schema.medalDefinitions.active, true))
      .orderBy(asc(schema.medalDefinitions.sortOrder), asc(schema.medalDefinitions.id));
    const owned = await db.select().from(schema.medals).where(eq(schema.medals.userId, me));
    const earnedAt = new Map(owned.map((m) => [m.medalId, m.earnedAt]));

    return reply.header('Cache-Control', 'no-store').send({
      medals: definitions.map((d) => ({
        id: d.id,
        name: d.name,
        description: d.description,
        kind: d.kind,
        earnedAt: earnedAt.get(d.id) ?? null,
      })),
    });
  });
}
