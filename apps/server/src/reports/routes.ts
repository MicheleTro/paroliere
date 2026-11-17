import { desc, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { requireAdmin, requireAuth } from '../auth/require-auth.js';
import { db } from '../db/client.js';
import * as schema from '../db/schema.js';
import { loadAdditions, reloadAdditions } from '../dictionary.js';

// Segnalazione di parole mancanti nel dizionario: i giocatori segnalano, gli admin approvano o rifiutano.
// Le parole approvate stanno nel database e valgono subito (vedi dictionary.ts, loadAdditions).

/** Come si scrivono le parole sulla griglia: solo lettere a-z ("qu" è due lettere). */
const reportSchema = z.object({ word: z.string().trim().toLowerCase().regex(/^[a-z]{2,64}$/, 'Parola non valida') });
const idParams = z.object({ id: z.string().uuid() });

/**
 * Segnalazione delle parole mancanti da parte dei giocatori (riattivata il 2026-11-17 insieme all'approvazione
 * degli admin e alle aggiunte che valgono subito); con false si disattiva di nuovo.
 */
const USER_REPORTS_ENABLED = true;

export function registerReportRoutes(app: FastifyInstance): void {
  app.post('/reports/words', { preHandler: requireAuth }, async (request, reply) => {
    if (!USER_REPORTS_ENABLED) return reply.code(403).send({ error: 'Segnalazione non disponibile' });
    const body = reportSchema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });

    const { word } = body.data;
    const [existing] = await db.select().from(schema.reportedWords).where(eq(schema.reportedWords.word, word));

    if (!existing) {
      await db
        .insert(schema.reportedWords)
        .values({ word, firstReportedByUserId: request.userId! })
        .onConflictDoNothing({ target: schema.reportedWords.word });
    } else if (existing.status === 'pending') {
      await db
        .update(schema.reportedWords)
        .set({ reportCount: existing.reportCount + 1 })
        .where(eq(schema.reportedWords.id, existing.id));
    } else if (existing.status === 'rejected') {
      // Rifiutata in passato: torna in coda, l'admin la rivede
      await db
        .update(schema.reportedWords)
        .set({ status: 'pending', reportCount: existing.reportCount + 1, decidedAt: null })
        .where(eq(schema.reportedWords.id, existing.id));
    }
    // Se già 'approved' non serve fare nulla: è già nel dizionario.

    return reply.code(204).send();
  });

  // Parole aggiunte al dizionario dopo la sua pubblicazione: il browser le carica insieme al dizionario
  app.get('/dictionary/additions', { preHandler: requireAuth }, async (_request, reply) => {
    const { words } = await loadAdditions();
    return reply.header('Cache-Control', 'no-cache').send({ words });
  });

  app.get('/admin/reported-words', { preHandler: requireAdmin }, async (_request, reply) => {
    const rows = await db
      .select()
      .from(schema.reportedWords)
      .where(eq(schema.reportedWords.status, 'pending'))
      .orderBy(desc(schema.reportedWords.reportCount), schema.reportedWords.createdAt);
    return reply.header('Cache-Control', 'no-store').send(rows);
  });

  app.post('/admin/reported-words/:id/approve', { preHandler: requireAdmin }, async (request, reply) => {
    const params = idParams.safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: 'id non valido' });
    const [row] = await db
      .update(schema.reportedWords)
      .set({ status: 'approved', decidedAt: new Date() })
      .where(eq(schema.reportedWords.id, params.data.id))
      .returning();
    if (!row) return reply.code(404).send({ error: 'Parola non trovata' });

    await reloadAdditions();
    return reply.code(204).send();
  });

  app.post('/admin/reported-words/:id/discard', { preHandler: requireAdmin }, async (request, reply) => {
    const params = idParams.safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: 'id non valido' });
    const [row] = await db
      .update(schema.reportedWords)
      .set({ status: 'rejected', decidedAt: new Date() })
      .where(eq(schema.reportedWords.id, params.data.id))
      .returning();
    if (!row) return reply.code(404).send({ error: 'Parola non trovata' });

    return reply.code(204).send();
  });
}
