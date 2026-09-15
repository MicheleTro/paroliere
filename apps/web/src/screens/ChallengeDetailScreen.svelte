<script lang="ts">
  import {
    cancelChallenge,
    getChallenge,
    joinChallenge,
    startMatch,
    type ChallengeDetail,
    type ChallengeMatch,
  } from '../lib/challenges.js';

  interface Props {
    challengeId: string;
    currentUserId: string;
    onPlayMatch: (challenge: ChallengeDetail, match: ChallengeMatch, remainingMs: number) => void;
    onBack: () => void;
  }

  let { challengeId, currentUserId, onPlayMatch, onBack }: Props = $props();

  let challenge: ChallengeDetail | undefined = $state();
  let loading = $state(true);
  let error: string | undefined = $state();
  let selectedTeamId: string | undefined = $state();
  let joining = $state(false);
  let cancelling = $state(false);
  let expandedMatchIds = $state(new Set<string>());

  function toggleMatchWords(matchId: string): void {
    const next = new Set(expandedMatchIds);
    if (next.has(matchId)) next.delete(matchId);
    else next.add(matchId);
    expandedMatchIds = next;
  }

  function load(): void {
    loading = true;
    error = undefined;
    getChallenge(challengeId)
      .then((result) => (challenge = result))
      .catch((err) => (error = err instanceof Error ? err.message : 'Errore imprevisto'))
      .finally(() => (loading = false));
  }

  load();

  const isParticipant = $derived(challenge?.participants.some((p) => p.userId === currentUserId) ?? false);

  interface LeaderboardEntry {
    id: string;
    label: string;
    total: number;
    members?: { username: string; total: number }[];
  }

  const leaderboard: LeaderboardEntry[] = $derived.by(() => {
    if (!challenge) return [];

    const totalsByUser = new Map<string, number>();
    for (const p of challenge.participants) totalsByUser.set(p.userId, 0);
    for (const match of challenge.matches) {
      if (match.status !== 'completed') continue;
      for (const score of match.scores ?? []) {
        totalsByUser.set(score.userId, (totalsByUser.get(score.userId) ?? 0) + (score.score ?? 0));
      }
    }

    if (challenge.mode === 'team') {
      const entries = new Map<string, LeaderboardEntry>(
        challenge.teams.map((team) => [team.id, { id: team.id, label: team.name, total: 0, members: [] }]),
      );
      for (const p of challenge.participants) {
        if (!p.teamId) continue;
        const entry = entries.get(p.teamId);
        if (!entry) continue;
        const total = totalsByUser.get(p.userId) ?? 0;
        entry.total += total;
        entry.members!.push({ username: p.username, total });
      }
      return [...entries.values()].sort((a, b) => b.total - a.total);
    }

    return challenge.participants
      .map((p) => ({ id: p.userId, label: p.username, total: totalsByUser.get(p.userId) ?? 0 }))
      .sort((a, b) => b.total - a.total);
  });

  const hasCompletedMatches = $derived(challenge?.matches.some((m) => m.status === 'completed') ?? false);

  async function handleJoin(): Promise<void> {
    if (!challenge) return;
    error = undefined;
    joining = true;
    try {
      await joinChallenge(challenge.id, selectedTeamId);
      load();
    } catch (err) {
      error = err instanceof Error ? err.message : 'Errore imprevisto';
    } finally {
      joining = false;
    }
  }

  function teamName(teamId: string | null): string | undefined {
    return challenge?.teams.find((t) => t.id === teamId)?.name;
  }

  function statusLabel(status: NonNullable<typeof challenge>['status']): string {
    if (status === 'open') return 'aperta';
    if (status === 'in_progress') return 'in corso';
    if (status === 'cancelled') return 'cancellata';
    return 'completata';
  }

  async function handlePlay(match: ChallengeMatch): Promise<void> {
    if (!challenge) return;
    error = undefined;
    try {
      const { startedAt } = await startMatch(challenge.id, match.matchIndex);
      const elapsed = Date.now() - new Date(startedAt).getTime();
      const remainingMs = challenge.config.durationMs - elapsed;
      if (remainingMs <= 0) {
        error = 'Tempo scaduto per questo match.';
        load();
        return;
      }
      onPlayMatch(challenge, match, remainingMs);
    } catch (err) {
      error = err instanceof Error ? err.message : 'Errore imprevisto';
      load();
    }
  }

  async function handleCancel(): Promise<void> {
    if (!challenge) return;
    if (!confirm('Cancellare questa sfida? L\'operazione non si può annullare.')) return;
    error = undefined;
    cancelling = true;
    try {
      await cancelChallenge(challenge.id);
      load();
    } catch (err) {
      error = err instanceof Error ? err.message : 'Errore imprevisto';
    } finally {
      cancelling = false;
    }
  }

  interface WordTable {
    players: { userId: string; label: string }[];
    rows: { word: string; cells: (number | undefined)[] }[];
  }

  function buildWordTable(match: ChallengeMatch): WordTable {
    const scores = [...(match.scores ?? [])].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    const players = scores.map((s) => ({ userId: s.userId, label: s.username ?? s.userId }));

    const words = new Set<string>();
    for (const s of scores) for (const w of s.words ?? []) words.add(w.word);

    const rows = [...words]
      .sort((a, b) => b.length - a.length || a.localeCompare(b))
      .map((word) => ({
        word,
        cells: scores.map((s) => s.words?.find((w) => w.word === word)?.points),
      }));

    return { players, rows };
  }

  function teamParticipantCount(teamId: string): number {
    return challenge?.participants.filter((p) => p.teamId === teamId).length ?? 0;
  }

  function isTeamFull(teamId: string): boolean {
    return challenge !== undefined && teamParticipantCount(teamId) >= challenge.playersPerTeam!;
  }
</script>

<div class="page">
  <h1>Sfida</h1>

  {#if loading}
    <p class="empty-text">Caricamento...</p>
  {:else if error && !challenge}
    <p class="error-text">{error}</p>
  {:else if challenge}
    <div class="summary-row">
      <span class="badge badge-accent">{challenge.mode === 'individual' ? 'Individuale' : 'A squadre'}</span>
      <span class="badge">Al meglio di {challenge.bestOf}</span>
      <span
        class="badge"
        class:badge-warning={challenge.status === 'in_progress'}
        class:badge-success={challenge.status === 'completed'}
      >
        {statusLabel(challenge.status)}
      </span>
    </div>

    <div class="section">
      <p class="section-title">Partecipanti</p>
      <div class="card participants">
        <ul class="plain-list">
          {#each challenge.participants as participant (participant.id)}
            <li>
              {participant.username}{participant.userId === currentUserId ? ' (tu)' : ''}
              {#if teamName(participant.teamId)}
                <span class="team-tag">{teamName(participant.teamId)}</span>
              {/if}
            </li>
          {/each}
        </ul>
      </div>
    </div>

    {#if !isParticipant && challenge.status === 'open'}
      <div class="section">
        <p class="section-title">Partecipa</p>
        <div class="card join">
          {#if challenge.mode === 'team'}
            <div class="chip-group">
              {#each challenge.teams as team (team.id)}
                <button
                  type="button"
                  class="chip"
                  class:selected={selectedTeamId === team.id}
                  disabled={isTeamFull(team.id)}
                  onclick={() => (selectedTeamId = team.id)}
                >
                  {team.name} ({teamParticipantCount(team.id)}/{challenge.playersPerTeam})
                </button>
              {/each}
            </div>
          {/if}
          <button
            type="button"
            class="btn btn-primary btn-block"
            disabled={joining || (challenge.mode === 'team' && !selectedTeamId)}
            onclick={handleJoin}
          >
            {joining ? 'Iscrizione...' : 'Partecipa'}
          </button>
        </div>
      </div>
    {/if}

    {#if error}
      <p class="error-text">{error}</p>
    {/if}

    {#if hasCompletedMatches}
      <div class="section">
        <p class="section-title">Classifica</p>
        <ol class="leaderboard">
          {#each leaderboard as entry, i (entry.id)}
            <li class="card">
              <div class="entry-row">
                <span class="rank">{i + 1}</span>
                <span class="label">{entry.label}</span>
                <span class="total">{entry.total}</span>
              </div>
              {#if entry.members}
                <ul class="members">
                  {#each entry.members as member (member.username)}
                    <li>{member.username}: {member.total}</li>
                  {/each}
                </ul>
              {/if}
            </li>
          {/each}
        </ol>
      </div>
    {/if}

    <div class="section">
      <p class="section-title">Match</p>
      <ul class="matches">
        {#each challenge.matches as match (match.id)}
          <li class="match card">
            <div class="match-head">
              <span class="match-title">Match {match.matchIndex + 1}</span>
              {#if match.status === 'completed'}
                <span class="badge badge-success">Completato</span>
              {/if}
            </div>
            {#if match.status === 'waiting'}
              {#if isParticipant && challenge.status === 'in_progress' && match.submittedByMe}
                <span class="status-text">Hai già giocato, in attesa degli altri</span>
              {:else if isParticipant && challenge.status === 'in_progress'}
                <button type="button" class="btn btn-secondary btn-sm" onclick={() => handlePlay(match)}>
                  {match.startedByMe ? 'Riprendi' : 'Gioca'}
                </button>
              {:else if isParticipant}
                <span class="status-text">In attesa di altri giocatori</span>
              {:else}
                <span class="status-text">In attesa</span>
              {/if}
            {:else}
              <ul class="scores">
                {#each [...(match.scores ?? [])].sort((a, b) => (b.score ?? 0) - (a.score ?? 0)) as score (score.userId)}
                  <li>{score.username ?? score.userId} <span>{score.score}</span></li>
                {/each}
              </ul>
              <button type="button" class="btn btn-ghost btn-sm expand" onclick={() => toggleMatchWords(match.id)}>
                {expandedMatchIds.has(match.id) ? 'Nascondi parole' : 'Mostra parole'}
              </button>
              {#if expandedMatchIds.has(match.id)}
                {@const table = buildWordTable(match)}
                <div class="word-breakdown">
                  {#if table.rows.length > 0}
                    <table class="word-table">
                      <thead>
                        <tr>
                          <th></th>
                          {#each table.players as player (player.userId)}
                            <th>{player.label}</th>
                          {/each}
                        </tr>
                      </thead>
                      <tbody>
                        {#each table.rows as row (row.word)}
                          <tr>
                            <th scope="row">{row.word}</th>
                            {#each row.cells as points, i (table.players[i]!.userId)}
                              <td>{points ?? ''}</td>
                            {/each}
                          </tr>
                        {/each}
                      </tbody>
                    </table>
                  {:else}
                    <p class="empty-text">Nessuna parola trovata</p>
                  {/if}
                </div>
              {/if}
            {/if}
          </li>
        {/each}
      </ul>
    </div>

    {#if challenge.creatorUserId === currentUserId && challenge.status !== 'cancelled'}
      <button type="button" class="btn btn-danger btn-block" disabled={cancelling} onclick={handleCancel}>
        {cancelling ? 'Cancellazione...' : 'Cancella sfida'}
      </button>
    {/if}
  {/if}

  <button type="button" class="btn btn-secondary btn-block" onclick={onBack}>Indietro</button>
</div>

<style>
  .summary-row {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }

  .plain-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
    font-weight: 600;
  }

  .team-tag {
    font-size: 0.78rem;
    font-weight: 600;
    color: var(--color-ink-faint);
  }

  .leaderboard {
    list-style: none;
    padding: 0;
    margin: 0;
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .leaderboard > li {
    padding: 12px 16px;
  }

  .entry-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .rank {
    font-weight: 800;
    color: var(--color-ink-faint);
    width: 1.5em;
  }

  .label {
    flex: 1;
    font-weight: 700;
  }

  .total {
    font-weight: 800;
    color: var(--color-accent);
  }

  .members {
    list-style: none;
    padding: 0 0 0 2.3em;
    margin: 6px 0 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: 0.82rem;
    color: var(--color-ink-soft);
  }

  .matches {
    list-style: none;
    padding: 0;
    margin: 0;
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .match {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
    padding: 14px 16px;
  }

  .match-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
  }

  .match-title {
    font-weight: 700;
  }

  .status-text {
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--color-ink-soft);
  }

  .scores {
    width: 100%;
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: 0.9rem;
  }

  .scores li {
    display: flex;
    justify-content: space-between;
    color: var(--color-ink-soft);
  }

  .scores li span {
    font-weight: 700;
    color: var(--color-ink);
  }

  .join {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .word-breakdown {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding-top: 4px;
    overflow-x: auto;
  }

  .word-table {
    border-collapse: collapse;
    font-size: 0.85rem;
    width: 100%;
  }

  .word-table th,
  .word-table td {
    padding: 6px 10px;
    text-align: center;
    border-bottom: 1px solid var(--color-border);
  }

  .word-table thead th {
    font-weight: 700;
    color: var(--color-ink-faint);
  }

  .word-table tbody th[scope='row'] {
    text-align: left;
    font-weight: 500;
  }

  .word-table td {
    font-weight: 800;
    color: var(--color-accent);
  }
</style>
