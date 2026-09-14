<script lang="ts">
  import type { GameSession, SessionSummary } from '@paroliere/core';
  import GameStatsSummary from '../lib/GameStatsSummary.svelte';
  import GridView from '../lib/GridView.svelte';
  import type { SubmitResultResponse } from '../lib/challenges.js';
  import type { WordStats } from '../lib/stats.js';

  interface Props {
    session: GameSession;
    summary: SessionSummary;
    typeStats?: WordStats;
    result?: SubmitResultResponse;
    error?: string;
    onBack: () => void;
  }

  let { session, summary, typeStats, result, error, onBack }: Props = $props();
</script>

<div class="summary">
  <h1>{error ? 'Invio non riuscito' : 'Match inviato'}</h1>

  <GameStatsSummary
    wordsFound={{ found: summary.foundWords.length, total: summary.totalWords, percentage: summary.foundPercentage }}
    {typeStats}
  />

  <GridView grid={session.grid} interactive={false} highlightPath={[]} onSubmit={() => {}} />

  {#if error}
    <p class="error">Il risultato non è stato registrato: {error}. Riprova dal dettaglio della sfida.</p>
  {:else if result?.settled}
    <p class="settled">Il match è concluso: tutti i partecipanti hanno giocato, il punteggio è disponibile.</p>
  {:else}
    <p class="waiting">
      Risultato registrato. Il punteggio ufficiale sarà calcolato quando tutti i partecipanti avranno giocato questo
      match.
    </p>
  {/if}

  <button type="button" class="primary" onclick={onBack}>Torna alla sfida</button>
</div>

<style>
  .summary {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    width: min(90vw, 420px);
  }

  .settled,
  .waiting {
    text-align: center;
    opacity: 0.9;
  }

  .error {
    text-align: center;
    color: var(--color-danger);
  }

  .primary {
    font-size: 1.1rem;
    padding: 10px 20px;
    border-radius: var(--radius-md);
    border: none;
    background: var(--color-accent);
    color: var(--color-accent-contrast);
    cursor: pointer;
  }
</style>
