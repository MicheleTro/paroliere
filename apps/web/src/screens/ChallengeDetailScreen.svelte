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

  function teamParticipantCount(teamId: string): number {
    return challenge?.participants.filter((p) => p.teamId === teamId).length ?? 0;
  }

  function isTeamFull(teamId: string): boolean {
    return challenge !== undefined && teamParticipantCount(teamId) >= challenge.playersPerTeam!;
  }
</script>

<div class="detail">
  <h1>Sfida</h1>

  {#if loading}
    <p>Caricamento...</p>
  {:else if error && !challenge}
    <p class="error">{error}</p>
  {:else if challenge}
    <p class="summary">
      {challenge.mode === 'individual' ? 'Individuale' : 'A squadre'} · al meglio di {challenge.bestOf} ·
      {statusLabel(challenge.status)}
    </p>

    <section>
      <h2>Partecipanti</h2>
      <ul>
        {#each challenge.participants as participant (participant.id)}
          <li>
            {participant.username}{participant.userId === currentUserId ? ' (tu)' : ''}
            {#if teamName(participant.teamId)}
              — {teamName(participant.teamId)}
            {/if}
          </li>
        {/each}
      </ul>
    </section>

    {#if !isParticipant && challenge.status === 'open'}
      <section class="join">
        <h2>Partecipa</h2>
        {#if challenge.mode === 'team'}
          <div class="options">
            {#each challenge.teams as team (team.id)}
              <button
                type="button"
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
          class="primary"
          disabled={joining || (challenge.mode === 'team' && !selectedTeamId)}
          onclick={handleJoin}
        >
          {joining ? 'Iscrizione...' : 'Partecipa'}
        </button>
      </section>
    {/if}

    {#if error}
      <p class="error">{error}</p>
    {/if}

    <section>
      <h2>Match</h2>
      <ul>
        {#each challenge.matches as match (match.id)}
          <li class="match">
            <span>Match {match.matchIndex + 1}</span>
            {#if match.status === 'waiting'}
              <span class="status">In attesa</span>
              {#if isParticipant && challenge.status === 'in_progress' && match.submittedByMe}
                <span class="status">Hai già giocato, in attesa degli altri</span>
              {:else if isParticipant && challenge.status === 'in_progress'}
                <button type="button" class="secondary" onclick={() => handlePlay(match)}>
                  {match.startedByMe ? 'Riprendi' : 'Gioca'}
                </button>
              {:else if isParticipant}
                <span class="status">In attesa di altri giocatori</span>
              {/if}
            {:else}
              <span class="status completed">Completato</span>
              <ul class="scores">
                {#each [...(match.scores ?? [])].sort((a, b) => (b.score ?? 0) - (a.score ?? 0)) as score (score.userId)}
                  <li>{score.username ?? score.userId}: {score.score}</li>
                {/each}
              </ul>
            {/if}
          </li>
        {/each}
      </ul>
    </section>

    {#if challenge.creatorUserId === currentUserId && challenge.status !== 'cancelled'}
      <button type="button" class="danger" disabled={cancelling} onclick={handleCancel}>
        {cancelling ? 'Cancellazione...' : 'Cancella sfida'}
      </button>
    {/if}
  {/if}

  <button type="button" class="secondary" onclick={onBack}>Indietro</button>
</div>

<style>
  .detail {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    width: min(90vw, 420px);
  }

  .summary {
    opacity: 0.8;
  }

  section {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }

  h2 {
    font-size: 1rem;
    font-weight: 600;
    margin: 0;
  }

  ul {
    list-style: none;
    padding: 0;
    margin: 0;
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .match {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-radius: 8px;
    border: 2px solid #2c4256;
  }

  .status {
    font-weight: 600;
    opacity: 0.8;
  }

  .status.completed {
    color: #4a90d9;
  }

  .scores {
    width: 100%;
    gap: 2px;
    opacity: 0.8;
  }

  .options {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    justify-content: center;
  }

  .options button,
  .join .primary,
  .secondary {
    font-size: 1rem;
    padding: 8px 16px;
    border-radius: 8px;
    border: 2px solid #2c4256;
    background: #1c2b3a;
    color: #f5f5f5;
    cursor: pointer;
  }

  .options button.selected {
    border-color: #4a90d9;
    background: #4a90d9;
  }

  .options button:disabled {
    opacity: 0.5;
    cursor: default;
  }

  .join .primary {
    border: none;
    background: #4a90d9;
  }

  .join .primary:disabled {
    background: #7a8a99;
    cursor: default;
  }

  .error {
    color: #b3261e;
  }

  .match .secondary {
    padding: 6px 12px;
    font-size: 0.9rem;
  }

  .danger {
    font-size: 1rem;
    padding: 8px 16px;
    border-radius: 8px;
    border: 2px solid #b3261e;
    background: transparent;
    color: #ff6b60;
    cursor: pointer;
  }

  .danger:disabled {
    opacity: 0.5;
    cursor: default;
  }
</style>
