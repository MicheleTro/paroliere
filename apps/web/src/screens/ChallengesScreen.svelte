<script lang="ts">
  import { cancelChallenge, listChallenges, type ChallengeSummary } from '../lib/challenges.js';
  import { formatDuration } from '../lib/format.js';

  interface Props {
    currentUserId: string;
    onOpen: (challengeId: string) => void;
    onCreate: () => void;
  }

  let { currentUserId, onOpen, onCreate }: Props = $props();

  type FilterTab = 'open' | 'in_progress' | 'completed';
  const FILTERS: { id: FilterTab; label: string }[] = [
    { id: 'open', label: 'Aperte' },
    { id: 'in_progress', label: 'In corso' },
    { id: 'completed', label: 'Completate' },
  ];

  let challenges: ChallengeSummary[] = $state([]);
  let loading = $state(true);
  let error: string | undefined = $state();
  let cancellingId: string | undefined = $state();
  let filter: FilterTab = $state('open');

  const filtered = $derived(challenges.filter((c) => c.status === filter));
  const emptyLabel = $derived(
    filter === 'open'
      ? 'Nessuna sfida aperta. Creane una per iniziare.'
      : filter === 'in_progress'
        ? 'Nessuna sfida in corso.'
        : 'Nessuna sfida completata ancora.',
  );

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

  function pointModeLabel(config: ChallengeSummary['config']): string {
    const base = config.pointMode === 'speciale' ? 'Speciale' : 'Standard';
    return config.positionBonus ? `${base} + Bonus Posizione` : base;
  }
</script>

<div class="page">
  <h1>Sfide</h1>

  <div class="chip-group filters">
    {#each FILTERS as f (f.id)}
      <button type="button" class="chip" class:selected={filter === f.id} onclick={() => (filter = f.id)}>{f.label}</button>
    {/each}
  </div>

  {#if loading}
    <p class="empty-text">Caricamento...</p>
  {:else if error}
    <p class="error-text">{error}</p>
  {:else if filtered.length === 0}
    <p class="empty-text">{emptyLabel}</p>
  {:else}
    <ul>
      {#each filtered as challenge (challenge.id)}
        <li class="row-item">
          <button type="button" class="challenge card" onclick={() => onOpen(challenge.id)}>
            <div class="row">
              <span class="mode">{modeLabel(challenge.mode)}</span>
              <span
                class="badge"
                class:badge-warning={challenge.status === 'in_progress'}
                class:badge-success={challenge.status === 'completed'}
              >
                {statusLabel(challenge.status)}
              </span>
            </div>
            <span class="creator">Creata da {challenge.creatorUsername} · {playersLabel(challenge)}</span>
            <span class="config">
              {challenge.config.size}×{challenge.config.size} · {formatDuration(challenge.config.durationMs)} · min
              {challenge.config.minWordLength} lettere · {scoringLabel(challenge.config.scoring)} · {pointModeLabel(challenge.config)} · al
              meglio di {challenge.bestOf}
            </span>
          </button>
          {#if challenge.creatorUserId === currentUserId}
            <button
              type="button"
              class="btn-icon delete"
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
    <button type="button" class="btn btn-primary btn-block" onclick={onCreate}>+ Nuova sfida</button>
  </div>
</div>

<style>
  .filters {
    width: 100%;
  }

  .filters .chip {
    flex: 1;
    padding: 0 4px;
  }

  ul {
    list-style: none;
    padding: 0;
    margin: 0;
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 10px;
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
    gap: 5px;
    padding: 14px 16px;
    border: none;
    color: var(--color-ink);
    cursor: pointer;
    text-align: left;
  }

  .delete {
    align-self: center;
  }

  .row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
  }

  .mode {
    font-weight: 700;
  }

  .creator,
  .config {
    font-size: 0.82rem;
    color: var(--color-ink-soft);
  }

  .actions {
    display: flex;
    margin-top: 4px;
  }
</style>
