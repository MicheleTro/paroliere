import { randomInt } from 'node:crypto';

import { computeVersusScores, type GameConfig, type VersusEntry, type WordIndex } from '@paroliere/core';
import { and, eq, inArray } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { requireAuth } from '../auth/require-auth.js';
import { db } from '../db/client.js';
import { isUniqueViolation } from '../db/errors.js';
import * as schema from '../db/schema.js';
import { loadDictionary } from '../dictionary.js';
import { gradeSubmission } from './grading.js';

const MAX_SEED = 2 ** 31 - 1;

const gameConfigInputSchema = z.object({
  size: z.union([z.literal(4), z.literal(5), z.literal(6)]),
  durationMs: z.number().int().positive(),
  minWordLength: z.number().int().min(1),
  minWords: z.number().int().min(1),
  scoring: z.enum(['classic', 'versus']),
});

const createChallengeSchema = z.object({
  config: gameConfigInputSchema,
  mode: z.enum(['individual', 'team']),
  maxParticipants: z.number().int().positive().optional(),
  bestOf: z.number().int().min(1).max(20),
  teams: z.array(z.object({ name: z.string().min(1).max(64) })).optional(),
});

const joinSchema = z.object({ teamId: z.string().uuid().optional() });

const submitResultsSchema = z.object({
  paths: z.array(z.array(z.number().int().nonnegative())),
});

const idParamsSchema = z.object({ id: z.string().uuid() });
const matchParamsSchema = z.object({ id: z.string().uuid(), matchIndex: z.coerce.number().int().min(0) });

type ChallengeRow = typeof schema.challenges.$inferSelect;
type ChallengeMatchRow = typeof schema.challengeMatches.$inferSelect;
type GameConfigRow = typeof schema.gameConfigs.$inferSelect;

function toGameConfig(row: GameConfigRow, seed: number): GameConfig {
  return {
    seed,
    size: row.size as 4 | 5 | 6,
    durationMs: row.durationMs,
    minWordLength: row.minWordLength,
    minWords: row.minWords,
    scoring: row.scoring,
    generatorVersion: 1,
    dictionaryVersion: row.dictionaryVersion,
  };
}

/**
 * Prova a settlare un match: scatta solo quando tutti i gruppi richiesti
 * (partecipanti in modalità individuale, squadre in modalità a squadre)
 * hanno inviato un risultato (SPEC.md §9). Nessun meccanismo di abbandono:
 * un partecipante che non gioca mai blocca la sfida a tempo indefinito
 * (RF-23), per scelta esplicita.
 */
async function trySettleMatch(
  challenge: ChallengeRow,
  match: ChallengeMatchRow,
  configRow: GameConfigRow,
  index: WordIndex,
): Promise<boolean> {
  const participants = await db
    .select()
    .from(schema.challengeParticipants)
    .where(eq(schema.challengeParticipants.challengeId, challenge.id));
  const results = await db.select().from(schema.matchResults).where(eq(schema.matchResults.challengeMatchId, match.id));

  if (participants.length === 0) return false;

  const submittedUserIds = new Set(results.map((r) => r.userId));
  const ready =
    challenge.mode === 'team'
      ? [...new Set(participants.map((p) => p.teamId).filter((t): t is string => t !== null))].every((teamId) =>
          participants.some((p) => p.teamId === teamId && submittedUserIds.has(p.userId)),
        )
      : participants.every((p) => submittedUserIds.has(p.userId));

  if (!ready) return false;

  const gameConfig = toGameConfig(configRow, match.seed);
  const gradedByUser = new Map(results.map((r) => [r.userId, gradeSubmission(gameConfig, index, r.paths)]));
  const teamIdByUser = new Map(participants.map((p) => [p.userId, p.teamId]));

  let scoreByUser: Map<string, number>;
  if (configRow.scoring === 'versus') {
    const entries: VersusEntry[] = [...gradedByUser.entries()].map(([userId, graded]) => ({
      participantId: userId,
      groupId: teamIdByUser.get(userId) ?? userId,
      words: graded.map((g) => g.word),
    }));
    scoreByUser = new Map(Object.entries(computeVersusScores(entries)));
  } else {
    scoreByUser = new Map(
      [...gradedByUser.entries()].map(([userId, graded]) => [userId, graded.reduce((sum, g) => sum + g.points, 0)]),
    );
  }

  await db.transaction(async (tx) => {
    for (const result of results) {
      const score = scoreByUser.get(result.userId) ?? 0;
      const graded = gradedByUser.get(result.userId) ?? [];
      await tx.update(schema.matchResults).set({ score }).where(eq(schema.matchResults.id, result.id));
      await tx.insert(schema.games).values({
        userId: result.userId,
        configId: challenge.configId,
        seed: match.seed,
        startedAt: result.submittedAt,
        score,
        words: graded,
        source: 'challenge',
      });
    }

    await tx.update(schema.challengeMatches).set({ settledAt: new Date() }).where(eq(schema.challengeMatches.id, match.id));

    const allMatches = await tx
      .select()
      .from(schema.challengeMatches)
      .where(eq(schema.challengeMatches.challengeId, challenge.id));
    const allSettled = allMatches.every((m) => m.id === match.id || m.settledAt !== null);
    if (allSettled) {
      await tx.update(schema.challenges).set({ status: 'completed' }).where(eq(schema.challenges.id, challenge.id));
    }
  });

  return true;
}

export function registerChallengeRoutes(app: FastifyInstance): void {
  app.post('/challenges', { preHandler: requireAuth }, async (request, reply) => {
    const body = createChallengeSchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ error: body.error.flatten() });
    }
    const { config, mode, maxParticipants, bestOf, teams } = body.data;

    if (mode === 'team' && (!teams || teams.length < 2)) {
      return reply.code(400).send({ error: 'Una sfida a squadre richiede almeno 2 squadre' });
    }
    if (mode === 'individual' && teams) {
      return reply.code(400).send({ error: 'teams non è valido in modalità individuale' });
    }

    const { dictionaryVersion } = loadDictionary();

    const created = await db.transaction(async (tx) => {
      const [configRow] = await tx
        .insert(schema.gameConfigs)
        .values({ ...config, generatorVersion: 1, dictionaryVersion })
        .returning();

      const [challengeRow] = await tx
        .insert(schema.challenges)
        .values({
          creatorUserId: request.userId!,
          configId: configRow!.id,
          mode,
          maxParticipants: maxParticipants ?? null,
          bestOf,
        })
        .returning();

      const teamRows =
        mode === 'team'
          ? await tx
              .insert(schema.teams)
              .values(teams!.map((team) => ({ challengeId: challengeRow!.id, name: team.name })))
              .returning()
          : [];

      const matchRows = await tx
        .insert(schema.challengeMatches)
        .values(
          Array.from({ length: bestOf }, (_, matchIndex) => ({
            challengeId: challengeRow!.id,
            matchIndex,
            seed: randomInt(0, MAX_SEED),
          })),
        )
        .returning();

      return { challenge: challengeRow!, config: configRow!, teams: teamRows, matches: matchRows };
    });

    return reply.code(201).send(created);
  });

  app.post('/challenges/:id/join', { preHandler: requireAuth }, async (request, reply) => {
    const params = idParamsSchema.safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: 'id non valido' });
    const body = joinSchema.safeParse(request.body ?? {});
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });

    const [challenge] = await db.select().from(schema.challenges).where(eq(schema.challenges.id, params.data.id)).limit(1);
    if (!challenge) return reply.code(404).send({ error: 'Sfida non trovata' });
    if (challenge.status !== 'open') return reply.code(409).send({ error: 'Sfida non più aperta' });

    if (challenge.mode === 'team') {
      if (!body.data.teamId) return reply.code(400).send({ error: 'teamId obbligatorio per una sfida a squadre' });
      const [team] = await db
        .select()
        .from(schema.teams)
        .where(and(eq(schema.teams.id, body.data.teamId), eq(schema.teams.challengeId, challenge.id)))
        .limit(1);
      if (!team) return reply.code(400).send({ error: 'Squadra non valida per questa sfida' });
    } else if (body.data.teamId) {
      return reply.code(400).send({ error: 'teamId non valido in modalità individuale' });
    }

    if (challenge.maxParticipants !== null) {
      const existing = await db
        .select()
        .from(schema.challengeParticipants)
        .where(eq(schema.challengeParticipants.challengeId, challenge.id));
      if (existing.length >= challenge.maxParticipants) return reply.code(409).send({ error: 'Sfida al completo' });
    }

    try {
      const [participant] = await db
        .insert(schema.challengeParticipants)
        .values({ challengeId: challenge.id, userId: request.userId!, teamId: body.data.teamId ?? null })
        .returning();
      return reply.code(201).send(participant);
    } catch (error) {
      if (isUniqueViolation(error)) return reply.code(409).send({ error: 'Hai già aderito a questa sfida' });
      throw error;
    }
  });

  app.get('/challenges/:id', { preHandler: requireAuth }, async (request, reply) => {
    const params = idParamsSchema.safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: 'id non valido' });

    const [challenge] = await db.select().from(schema.challenges).where(eq(schema.challenges.id, params.data.id)).limit(1);
    if (!challenge) return reply.code(404).send({ error: 'Sfida non trovata' });

    const participants = await db
      .select({
        id: schema.challengeParticipants.id,
        challengeId: schema.challengeParticipants.challengeId,
        userId: schema.challengeParticipants.userId,
        username: schema.users.username,
        teamId: schema.challengeParticipants.teamId,
        joinedAt: schema.challengeParticipants.joinedAt,
      })
      .from(schema.challengeParticipants)
      .innerJoin(schema.users, eq(schema.users.id, schema.challengeParticipants.userId))
      .where(eq(schema.challengeParticipants.challengeId, challenge.id));
    const isParticipant = participants.some((p) => p.userId === request.userId);
    if (!isParticipant && challenge.creatorUserId !== request.userId) {
      return reply.code(403).send({ error: 'Non hai accesso a questa sfida' });
    }
    const usernameByUserId = new Map(participants.map((p) => [p.userId, p.username]));

    const [configRow] = await db.select().from(schema.gameConfigs).where(eq(schema.gameConfigs.id, challenge.configId)).limit(1);
    const teamRows =
      challenge.mode === 'team'
        ? await db.select().from(schema.teams).where(eq(schema.teams.challengeId, challenge.id))
        : [];
    const matches = await db
      .select()
      .from(schema.challengeMatches)
      .where(eq(schema.challengeMatches.challengeId, challenge.id))
      .orderBy(schema.challengeMatches.matchIndex);

    const matchesWithResults = await Promise.all(
      matches.map(async (match) => {
        if (!match.settledAt) {
          return { id: match.id, matchIndex: match.matchIndex, seed: match.seed, status: 'waiting' as const };
        }
        const results = await db.select().from(schema.matchResults).where(eq(schema.matchResults.challengeMatchId, match.id));
        return {
          id: match.id,
          matchIndex: match.matchIndex,
          seed: match.seed,
          status: 'completed' as const,
          scores: results.map((r) => ({ userId: r.userId, username: usernameByUserId.get(r.userId), score: r.score })),
        };
      }),
    );

    return reply.send({
      id: challenge.id,
      mode: challenge.mode,
      status: challenge.status,
      bestOf: challenge.bestOf,
      maxParticipants: challenge.maxParticipants,
      config: configRow,
      teams: teamRows,
      participants,
      matches: matchesWithResults,
    });
  });

  app.post('/challenges/:id/matches/:matchIndex/results', { preHandler: requireAuth }, async (request, reply) => {
    const params = matchParamsSchema.safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: 'Parametri non validi' });
    const body = submitResultsSchema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });

    const [challenge] = await db.select().from(schema.challenges).where(eq(schema.challenges.id, params.data.id)).limit(1);
    if (!challenge) return reply.code(404).send({ error: 'Sfida non trovata' });

    const [participant] = await db
      .select()
      .from(schema.challengeParticipants)
      .where(and(eq(schema.challengeParticipants.challengeId, challenge.id), eq(schema.challengeParticipants.userId, request.userId!)))
      .limit(1);
    if (!participant) return reply.code(403).send({ error: 'Non partecipi a questa sfida' });

    const [match] = await db
      .select()
      .from(schema.challengeMatches)
      .where(and(eq(schema.challengeMatches.challengeId, challenge.id), eq(schema.challengeMatches.matchIndex, params.data.matchIndex)))
      .limit(1);
    if (!match) return reply.code(404).send({ error: 'Match non trovato' });
    if (match.settledAt) return reply.code(409).send({ error: 'Match già concluso' });

    const [configRow] = await db.select().from(schema.gameConfigs).where(eq(schema.gameConfigs.id, challenge.configId)).limit(1);
    const { index } = loadDictionary();
    const graded = gradeSubmission(toGameConfig(configRow!, match.seed), index, body.data.paths);

    try {
      await db.insert(schema.matchResults).values({
        challengeMatchId: match.id,
        userId: request.userId!,
        paths: body.data.paths,
      });
    } catch (error) {
      if (isUniqueViolation(error)) return reply.code(409).send({ error: 'Hai già inviato un risultato per questo match' });
      throw error;
    }

    const settled = await trySettleMatch(challenge, match, configRow!, index);

    return reply.send({ found: graded, settled });
  });

  app.get('/users/me/challenges', { preHandler: requireAuth }, async (request, reply) => {
    const created = await db.select().from(schema.challenges).where(eq(schema.challenges.creatorUserId, request.userId!));
    const participantRows = await db
      .select({ challengeId: schema.challengeParticipants.challengeId })
      .from(schema.challengeParticipants)
      .where(eq(schema.challengeParticipants.userId, request.userId!));
    const participantChallengeIds = participantRows.map((p) => p.challengeId);
    const participating =
      participantChallengeIds.length > 0
        ? await db.select().from(schema.challenges).where(inArray(schema.challenges.id, participantChallengeIds))
        : [];

    const byId = new Map<string, ChallengeRow>();
    for (const challenge of [...created, ...participating]) byId.set(challenge.id, challenge);

    return reply.send([...byId.values()]);
  });
}
