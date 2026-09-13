<script lang="ts">
  import { listMyChallenges, type ChallengeSummary } from '../lib/challenges.js';

  interface Props {
    onOpen: (challengeId: string) => void;
    onCreate: () => void;
    onBack: () => void;
  }

  let { onOpen, onCreate, onBack }: Props = $props();

  let challenges: ChallengeSummary[] = $state([]);
  let loading = $state(true);
  let error: string | undefined = $state();

  listMyChallenges()
    .then((result) => (challenges = result))
    .catch((err) => (error = err instanceof Error ? err.message : 'Errore imprevisto'))
    .finally(() => (loading = false));

  function statusLabel(status: ChallengeSummary['status']): string {
    return status === 'open' ? 'Aperta' : 'Completata';
  }

  function modeLabel(mode: ChallengeSummary['mode']): string {
    return mode === 'individual' ? 'Individuale' : 'A squadre';
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
        <li>
          <button type="button" class="challenge" onclick={() => onOpen(challenge.id)}>
            <span class="mode">{modeLabel(challenge.mode)}</span>
            <span class="status" class:completed={challenge.status === 'completed'}>
              {statusLabel(challenge.status)}
            </span>
            <span class="best-of">Al meglio di {challenge.bestOf}</span>
          </button>
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

  .challenge {
    width: 100%;
    display: flex;
    justify-content: space-between;
    gap: 8px;
    padding: 12px 16px;
    border-radius: 8px;
    border: 2px solid #2c4256;
    background: #1c2b3a;
    color: #f5f5f5;
    cursor: pointer;
    text-align: left;
  }

  .status {
    font-weight: 600;
  }

  .status.completed {
    color: #7ac47f;
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
