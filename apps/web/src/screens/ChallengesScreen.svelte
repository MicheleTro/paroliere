<script lang="ts">
  import { cancelChallenge, listChallenges, type ChallengeSummary } from '../lib/challenges.js';
  import { formatDuration } from '../lib/format.js';

  interface Props {
    currentUserId: string;
    onOpen: (challengeId: string) => void;
    onCreate: () => void;
    onBack: () => void;
  }

  let { currentUserId, onOpen, onCreate, onBack }: Props = $props();

  let challenges: ChallengeSummary[] = $state([]);
  let loading = $state(true);
  let error: string | undefined = $state();
  let cancellingId: string | undefined = $state();

  function load(): void {
    loading = true;
    error = undefined;
    listChallenges()
      .then((result) => (challenges = result))
      .catch((err) => (error = err instanceof Error ? err.message : 'Errore imprevisto'))
      .finally(() => (loading = false));
  }

  load();

  async function handleCancel(challenge: ChallengeSummary): Promise<void> {
    if (!confirm('Cancellare questa sfida? L\'operazione non si può annullare.')) return;
    error = undefined;
    cancellingId = challenge.id;
    try {
      await cancelChallenge(challenge.id);
      challenges = challenges.filter((c) => c.id !== challenge.id);
    } catch (err) {
      error = err instanceof Error ? err.message : 'Errore imprevisto';
    } finally {
      cancellingId = undefined;
    }
  }

  function statusLabel(status: ChallengeSummary['status']): string {
    if (status === 'open') return 'Aperta';
    if (status === 'in_progress') return 'In corso';
    if (status === 'cancelled') return 'Cancellata';
    return 'Completata';
  }

  function modeLabel(mode: ChallengeSummary['mode']): string {
    return mode === 'individual' ? 'Individuale' : 'A squadre';
  }

  function playersLabel(challenge: ChallengeSummary): string {
    if (challenge.mode === 'individual') {
      return `${challenge.participantCount}/${challenge.maxParticipants} giocatori`;
    }
    return `${challenge.participantCount} iscritti · ${challenge.playersPerTeam} per squadra`;
  }

  function scoringLabel(scoring: ChallengeSummary['config']['scoring']): string {
    return scoring === 'classic' ? 'Classico' : 'Versus';
  }
</script>

<div class="challenges">
  <h1>Sfide</h1>

  {#if loading}
    <p>Caricamento...</p>
  {:else if error}
    <p class="error">{error}</p>
  {:else if challenges.length === 0}
    <p>Nessuna sfida ancora. Creane una per iniziare.</p>
  {:else}
    <ul>
      {#each challenges as challenge (challenge.id)}
        <li class="row-item">
          <button type="button" class="challenge" onclick={() => onOpen(challenge.id)}>
            <div class="row">
              <span class="mode">{modeLabel(challenge.mode)}</span>
              <span
                class="status"
                class:in-progress={challenge.status === 'in_progress'}
                class:completed={challenge.status === 'completed'}
              >
                {statusLabel(challenge.status)}
              </span>
            </div>
            <span class="creator">Creata da {challenge.creatorUsername} · {playersLabel(challenge)}</span>
            <span class="config">
              {challenge.config.size}×{challenge.config.size} · {formatDuration(challenge.config.durationMs)} · min
              {challenge.config.minWordLength} lettere · {scoringLabel(challenge.config.scoring)} · al meglio di {challenge.bestOf}
            </span>
          </button>
          {#if challenge.creatorUserId === currentUserId}
            <button
              type="button"
              class="delete"
              aria-label="Cancella sfida"
              disabled={cancellingId === challenge.id}
              onclick={() => handleCancel(challenge)}
            >
              🗑️
            </button>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}

  <div class="actions">
    <button type="button" class="secondary" onclick={onBack}>Indietro</button>
    <button type="button" class="primary" onclick={onCreate}>Nuova sfida</button>
  </div>
</div>

<style>
  .challenges {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    width: min(90vw, 400px);
  }

  .error {
    color: #b3261e;
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

  .row-item {
    display: flex;
    align-items: stretch;
    gap: 8px;
  }

  .challenge {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 12px 16px;
    border-radius: 8px;
    border: 2px solid #2c4256;
    background: #1c2b3a;
    color: #f5f5f5;
    cursor: pointer;
    text-align: left;
  }

  .delete {
    flex-shrink: 0;
    width: 44px;
    border-radius: 8px;
    border: 2px solid #2c4256;
    background: #1c2b3a;
    font-size: 1.1rem;
    cursor: pointer;
  }

  .delete:disabled {
    opacity: 0.5;
    cursor: default;
  }

  .row {
    display: flex;
    justify-content: space-between;
    gap: 8px;
  }

  .status {
    font-weight: 600;
  }

  .status.in-progress {
    color: #e8b84a;
  }

  .status.completed {
    color: #7ac47f;
  }

  .creator,
  .config {
    font-size: 0.85rem;
    opacity: 0.85;
  }

  .actions {
    display: flex;
    gap: 12px;
  }

  .actions button {
    font-size: 1.1rem;
    padding: 10px 20px;
    border-radius: 8px;
    border: none;
    cursor: pointer;
  }

  .actions .primary {
    background: #4a90d9;
    color: white;
  }

  .actions .secondary {
    background: #7a8a99;
    color: white;
  }
</style>
