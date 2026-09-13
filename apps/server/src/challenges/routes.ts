import { randomInt } from 'node:crypto';

import { computeVersusScores, type GameConfig, type VersusEntry, type WordIndex } from '@paroliere/core';
import { and, desc, eq, isNull } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { requireAuth } from '../auth/require-auth.js';
import { db } from '../db/client.js';
import { isUniqueViolation } from '../db/errors.js';
import * as schema from '../db/schema.js';
import { loadDictionary } from '../dictionary.js';
import { gradeSubmission } from './grading.js';

const MAX_SEED = 2 ** 31 - 1;
const MATCH_TIMEOUT_MARGIN_MS = 15_000;

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
  maxParticipants: z.number().int().min(2).optional(),
  playersPerTeam: z.number().int().min(2).optional(),
  bestOf: z.number().int().min(1).max(20),
  teams: z.array(z.object({ name: z.string().min(1).max(64) })).optional(),
  creatorTeamIndex: z.number().int().min(0).optional(),
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
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

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
  if (match.settledAt) return false;

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

/**
 * Fa partire la sfida (open -> in_progress) quando il numero di giocatori
 * richiesto in fase di creazione è stato raggiunto: tutti i partecipanti in
 * modalità individuale, oppure ogni squadra piena in modalità a squadre.
 * Prima di questo passaggio i match non sono giocabili (evita che una sfida
 * si concluda con un solo giocatore su due).
 */
async function maybeStartChallenge(tx: Tx, challenge: ChallengeRow): Promise<void> {
  if (challenge.status !== 'open') return;

  const participants = await tx
    .select()
    .from(schema.challengeParticipants)
    .where(eq(schema.challengeParticipants.challengeId, challenge.id));

  let ready: boolean;
  if (challenge.mode === 'team') {
    const teamRows = await tx.select().from(schema.teams).where(eq(schema.teams.challengeId, challenge.id));
    ready = teamRows.every(
      (team) => participants.filter((p) => p.teamId === team.id).length >= challenge.playersPerTeam!,
    );
  } else {
    ready = participants.length >= challenge.maxParticipants!;
  }

  if (ready) {
    await tx.update(schema.challenges).set({ status: 'in_progress' }).where(eq(schema.challenges.id, challenge.id));
  }
}

/**
 * Un match che un giocatore ha iniziato (POST .../start) ma non ha mai
 * inviato scade dopo durationMs + margine: gli viene assegnato un risultato
 * a zero punti (nessuna parola trovata), così il match può settlare senza
 * aspettare all'infinito chi ha abbandonato o ricaricato la pagina per
 * ricominciare il timer da capo. Il controllo è pigro (eseguito quando la
 * sfida viene letta o quando arriva un invio), non un job in background.
 */
async function expireStaleMatchStarts(challenge: ChallengeRow): Promise<void> {
  if (challenge.status !== 'in_progress') return;

  const [configRow] = await db.select().from(schema.gameConfigs).where(eq(schema.gameConfigs.id, challenge.configId)).limit(1);
  if (!configRow) return;

  const matches = await db
    .select()
    .from(schema.challengeMatches)
    .where(and(eq(schema.challengeMatches.challengeId, challenge.id), isNull(schema.challengeMatches.settledAt)));

  for (const match of matches) {
    const starts = await db
      .select()
      .from(schema.challengeMatchStarts)
      .where(eq(schema.challengeMatchStarts.challengeMatchId, match.id));
    if (starts.length === 0) continue;

    const results = await db.select().from(schema.matchResults).where(eq(schema.matchResults.challengeMatchId, match.id));
    const submittedUserIds = new Set(results.map((r) => r.userId));
    const deadline = configRow.durationMs + MATCH_TIMEOUT_MARGIN_MS;

    for (const start of starts) {
      if (submittedUserIds.has(start.userId)) continue;
      if (Date.now() - start.startedAt.getTime() < deadline) continue;

      try {
        await db.insert(schema.matchResults).values({ challengeMatchId: match.id, userId: start.userId, paths: [], score: 0 });
      } catch (error) {
        if (!isUniqueViolation(error)) throw error;
      }
    }
  }

  const { index } = loadDictionary();
  for (const match of matches) {
    await trySettleMatch(challenge, match, configRow, index);
  }
}

export function registerChallengeRoutes(app: FastifyInstance): void {
  app.post('/challenges', { preHandler: requireAuth }, async (request, reply) => {
    const body = createChallengeSchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ error: body.error.flatten() });
    }
    const { config, mode, maxParticipants, playersPerTeam, bestOf, teams, creatorTeamIndex } = body.data;

    if (mode === 'team' && (!teams || teams.length < 2)) {
      return reply.code(400).send({ error: 'Una sfida a squadre richiede almeno 2 squadre' });
    }
    if (mode === 'individual' && teams) {
      return reply.code(400).send({ error: 'teams non è valido in modalità individuale' });
    }
    if (mode === 'individual' && maxParticipants === undefined) {
      return reply.code(400).send({ error: 'maxParticipants obbligatorio in modalità individuale' });
    }
    if (mode === 'team' && playersPerTeam === undefined) {
      return reply.code(400).send({ error: 'playersPerTeam obbligatorio in modalità a squadre' });
    }
    if (mode === 'team' && (creatorTeamIndex === undefined || creatorTeamIndex >= teams!.length)) {
      return reply.code(400).send({ error: 'creatorTeamIndex non valido' });
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
          maxParticipants: mode === 'individual' ? maxParticipants : null,
          playersPerTeam: mode === 'team' ? playersPerTeam : null,
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

      await tx.insert(schema.challengeParticipants).values({
        challengeId: challengeRow!.id,
        userId: request.userId!,
        teamId: mode === 'team' ? teamRows[creatorTeamIndex!]!.id : null,
      });

      await maybeStartChallenge(tx, challengeRow!);

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

      const teamParticipants = await db
        .select()
        .from(schema.challengeParticipants)
        .where(eq(schema.challengeParticipants.teamId, team.id));
      if (teamParticipants.length >= challenge.playersPerTeam!) {
        return reply.code(409).send({ error: 'Squadra al completo' });
      }
    } else if (body.data.teamId) {
      return reply.code(400).send({ error: 'teamId non valido in modalità individuale' });
    } else {
      const existing = await db
        .select()
        .from(schema.challengeParticipants)
        .where(eq(schema.challengeParticipants.challengeId, challenge.id));
      if (existing.length >= challenge.maxParticipants!) return reply.code(409).send({ error: 'Sfida al completo' });
    }

    try {
      const participant = await db.transaction(async (tx) => {
        const [inserted] = await tx
          .insert(schema.challengeParticipants)
          .values({ challengeId: challenge.id, userId: request.userId!, teamId: body.data.teamId ?? null })
          .returning();
        await maybeStartChallenge(tx, challenge);
        return inserted!;
      });
      return reply.code(201).send(participant);
    } catch (error) {
      if (isUniqueViolation(error)) return reply.code(409).send({ error: 'Hai già aderito a questa sfida' });
      throw error;
    }
  });

  app.post('/challenges/:id/matches/:matchIndex/start', { preHandler: requireAuth }, async (request, reply) => {
    const params = matchParamsSchema.safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: 'Parametri non validi' });

    const [challenge] = await db.select().from(schema.challenges).where(eq(schema.challenges.id, params.data.id)).limit(1);
    if (!challenge) return reply.code(404).send({ error: 'Sfida non trovata' });
    if (challenge.status !== 'in_progress') {
      return reply.code(409).send({ error: 'La sfida non è ancora iniziata: mancano ancora giocatori' });
    }

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

    const [existingResult] = await db
      .select()
      .from(schema.matchResults)
      .where(and(eq(schema.matchResults.challengeMatchId, match.id), eq(schema.matchResults.userId, request.userId!)))
      .limit(1);
    if (existingResult) return reply.code(409).send({ error: 'Hai già inviato un risultato per questo match' });

    try {
      const [start] = await db
        .insert(schema.challengeMatchStarts)
        .values({ challengeMatchId: match.id, userId: request.userId! })
        .returning();
      return reply.code(201).send({ startedAt: start!.startedAt });
    } catch (error) {
      if (isUniqueViolation(error)) {
        const [existing] = await db
          .select()
          .from(schema.challengeMatchStarts)
          .where(and(eq(schema.challengeMatchStarts.challengeMatchId, match.id), eq(schema.challengeMatchStarts.userId, request.userId!)))
          .limit(1);
        return reply.send({ startedAt: existing!.startedAt });
      }
      throw error;
    }
  });

  app.post('/challenges/:id/cancel', { preHandler: requireAuth }, async (request, reply) => {
    const params = idParamsSchema.safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: 'id non valido' });

    const [challenge] = await db.select().from(schema.challenges).where(eq(schema.challenges.id, params.data.id)).limit(1);
    if (!challenge) return reply.code(404).send({ error: 'Sfida non trovata' });
    if (challenge.creatorUserId !== request.userId) {
      return reply.code(403).send({ error: 'Solo chi ha creato la sfida può cancellarla' });
    }
    if (challenge.status === 'cancelled') return reply.code(409).send({ error: 'Sfida già cancellata' });

    await db.update(schema.challenges).set({ status: 'cancelled' }).where(eq(schema.challenges.id, challenge.id));
    return reply.send({ status: 'cancelled' });
  });

  app.get('/challenges/:id', { preHandler: requireAuth }, async (request, reply) => {
    const params = idParamsSchema.safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: 'id non valido' });

    const [challenge] = await db.select().from(schema.challenges).where(eq(schema.challenges.id, params.data.id)).limit(1);
    if (!challenge) return reply.code(404).send({ error: 'Sfida non trovata' });

    await expireStaleMatchStarts(challenge);
    const [refreshedChallenge] = await db.select().from(schema.challenges).where(eq(schema.challenges.id, challenge.id)).limit(1);
    Object.assign(challenge, refreshedChallenge);

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
          const [myResult] = await db
            .select()
            .from(schema.matchResults)
            .where(and(eq(schema.matchResults.challengeMatchId, match.id), eq(schema.matchResults.userId, request.userId!)))
            .limit(1);
          const [myStart] = await db
            .select()
            .from(schema.challengeMatchStarts)
            .where(and(eq(schema.challengeMatchStarts.challengeMatchId, match.id), eq(schema.challengeMatchStarts.userId, request.userId!)))
            .limit(1);
          return {
            id: match.id,
            matchIndex: match.matchIndex,
            seed: match.seed,
            status: 'waiting' as const,
            submittedByMe: myResult !== undefined,
            startedByMe: myStart?.startedAt ?? null,
          };
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
      creatorUserId: challenge.creatorUserId,
      mode: challenge.mode,
      status: challenge.status,
      bestOf: challenge.bestOf,
      maxParticipants: challenge.maxParticipants,
      playersPerTeam: challenge.playersPerTeam,
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
    if (challenge.status !== 'in_progress') {
      return reply.code(409).send({ error: 'La sfida non è ancora iniziata: mancano ancora giocatori' });
    }

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

    const [start] = await db
      .select()
      .from(schema.challengeMatchStarts)
      .where(and(eq(schema.challengeMatchStarts.challengeMatchId, match.id), eq(schema.challengeMatchStarts.userId, request.userId!)))
      .limit(1);
    if (start && Date.now() - start.startedAt.getTime() > configRow!.durationMs + MATCH_TIMEOUT_MARGIN_MS) {
      await expireStaleMatchStarts(challenge);
      return reply.code(409).send({ error: 'Tempo scaduto per questo match' });
    }

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

  app.get('/challenges', { preHandler: requireAuth }, async (request, reply) => {
    const rows = await db
      .select({
        id: schema.challenges.id,
        mode: schema.challenges.mode,
        status: schema.challenges.status,
        bestOf: schema.challenges.bestOf,
        maxParticipants: schema.challenges.maxParticipants,
        playersPerTeam: schema.challenges.playersPerTeam,
        createdAt: schema.challenges.createdAt,
        creatorUserId: schema.challenges.creatorUserId,
        creatorUsername: schema.users.username,
        config: {
          size: schema.gameConfigs.size,
          durationMs: schema.gameConfigs.durationMs,
          minWordLength: schema.gameConfigs.minWordLength,
          scoring: schema.gameConfigs.scoring,
        },
      })
      .from(schema.challenges)
      .innerJoin(schema.users, eq(schema.users.id, schema.challenges.creatorUserId))
      .innerJoin(schema.gameConfigs, eq(schema.gameConfigs.id, schema.challenges.configId))
      .orderBy(desc(schema.challenges.createdAt));

    const allParticipants = await db
      .select({ challengeId: schema.challengeParticipants.challengeId, userId: schema.challengeParticipants.userId })
      .from(schema.challengeParticipants);
    const participantCountByChallengeId = new Map<string, number>();
    const myChallengeIds = new Set<string>();
    for (const p of allParticipants) {
      participantCountByChallengeId.set(p.challengeId, (participantCountByChallengeId.get(p.challengeId) ?? 0) + 1);
      if (p.userId === request.userId) myChallengeIds.add(p.challengeId);
    }

    const visible = rows
      .filter((row) => row.status === 'open' || myChallengeIds.has(row.id))
      .map((row) => ({ ...row, participantCount: participantCountByChallengeId.get(row.id) ?? 0 }));

    return reply.send(visible);
  });
}
