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

<div class="page">
  <h1>{error ? 'Invio non riuscito' : 'Match inviato'}</h1>

  <GameStatsSummary
    wordsFound={{ found: summary.foundWords.length, total: summary.totalWords, percentage: summary.foundPercentage }}
    {typeStats}
  />

  <GridView
    grid={session.grid}
    interactive={false}
    highlightPath={[]}
    onSubmit={() => {}}
    pointMode={session.config.pointMode}
    positionBonus={session.config.positionBonus}
  />

  {#if error}
    <p class="notice notice-danger">Il risultato non è stato registrato: {error}. Riprova dal dettaglio della sfida.</p>
  {:else if result?.settled}
    <p class="notice notice-success">Il match è concluso: tutti i partecipanti hanno giocato, il punteggio è disponibile.</p>
  {:else}
    <p class="notice">
      Risultato registrato. Il punteggio ufficiale sarà calcolato quando tutti i partecipanti avranno giocato questo
      match.
    </p>
  {/if}

  <button type="button" class="btn btn-primary btn-block" onclick={onBack}>Torna alla sfida</button>
</div>

<style>
  .notice {
    text-align: center;
    font-size: 0.9rem;
    font-weight: 600;
    padding: 12px 16px;
    border-radius: var(--radius-md);
    background: var(--color-surface-alt);
    color: var(--color-ink-soft);
  }

  .notice-success {
    background: var(--color-success-wash);
    color: var(--color-success);
  }

  .notice-danger {
    background: var(--color-danger-wash);
    color: var(--color-danger);
  }
</style>
