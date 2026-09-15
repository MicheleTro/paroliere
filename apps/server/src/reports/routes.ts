import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { desc, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { requireAdmin } from '../admin/require-admin.js';
import { requireAuth } from '../auth/require-auth.js';
import { db } from '../db/client.js';
import * as schema from '../db/schema.js';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
// apps/server/src/reports -> risale alla radice del monorepo.
const ADD_OVERRIDES_PATH = path.resolve(currentDir, '../../../../tools/dict-builder/overrides/add.txt');

const reportSchema = z.object({ word: z.string().min(1).max(64) });

function normalizeWord(word: string): string {
  return word.trim().toLowerCase();
}

function appendToOverrides(word: string): void {
  const existing = fs.existsSync(ADD_OVERRIDES_PATH) ? fs.readFileSync(ADD_OVERRIDES_PATH, 'utf-8') : '';
  const lines = existing
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.includes(word)) return;

  const separator = existing.length > 0 && !existing.endsWith('\n') ? '\n' : '';
  fs.appendFileSync(ADD_OVERRIDES_PATH, `${separator}${word}\n`);
}

export function registerReportRoutes(app: FastifyInstance): void {
  app.post('/reports/words', { preHandler: requireAuth }, async (request, reply) => {
    const body = reportSchema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });

    const word = normalizeWord(body.data.word);
    const [existing] = await db.select().from(schema.reportedWords).where(eq(schema.reportedWords.word, word));

    if (!existing) {
      await db.insert(schema.reportedWords).values({ word, firstReportedByUserId: request.userId! });
    } else if (existing.status === 'pending') {
      await db
        .update(schema.reportedWords)
        .set({ reportCount: existing.reportCount + 1 })
        .where(eq(schema.reportedWords.id, existing.id));
    } else if (existing.status === 'rejected') {
      await db
        .update(schema.reportedWords)
        .set({ status: 'pending', reportCount: existing.reportCount + 1, decidedAt: null })
        .where(eq(schema.reportedWords.id, existing.id));
    }
    // Se già 'approved' non serve fare nulla: è già stata aggiunta al dizionario.

    return reply.code(204).send();
  });

  app.get('/admin/reported-words', { preHandler: requireAdmin }, async (_request, reply) => {
    const rows = await db
      .select()
      .from(schema.reportedWords)
      .where(eq(schema.reportedWords.status, 'pending'))
      .orderBy(desc(schema.reportedWords.reportCount), schema.reportedWords.createdAt);
    return reply.send(rows);
  });

  app.post('/admin/reported-words/:id/approve', { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const [row] = await db
      .update(schema.reportedWords)
      .set({ status: 'approved', decidedAt: new Date() })
      .where(eq(schema.reportedWords.id, id))
      .returning();
    if (!row) return reply.code(404).send({ error: 'Parola non trovata' });

    appendToOverrides(row.word);
    return reply.code(204).send();
  });

  app.post('/admin/reported-words/:id/discard', { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const [row] = await db
      .update(schema.reportedWords)
      .set({ status: 'rejected', decidedAt: new Date() })
      .where(eq(schema.reportedWords.id, id))
      .returning();
    if (!row) return reply.code(404).send({ error: 'Parola non trovata' });

    return reply.code(204).send();
  });
}
