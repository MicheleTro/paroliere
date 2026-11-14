<script lang="ts">
  import type { GameSession, SessionSummary } from '@paroliere/core';
  import ProgressSummary from '../lib/ProgressSummary.svelte';
  import GridView from '../lib/GridView.svelte';
  import type { SubmitResultResponse } from '../lib/challenges.js';

  interface Props {
    session: GameSession;
    summary: SessionSummary;
    result?: SubmitResultResponse;
    error?: string;
    onBack: () => void;
  }

  let { session, summary, result, error, onBack }: Props = $props();
</script>

<div class="page">
  <h1>{error ? 'Invio non riuscito' : 'Partita inviata'}</h1>

  <ProgressSummary
    wordsFound={{ found: summary.foundWords.length, total: summary.totalWords, percentage: summary.foundPercentage }}
    progress={result?.progress}
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
    <p class="notice notice-success">La sfida è conclusa: hanno giocato entrambi, il punteggio è nel dettaglio.</p>
  {:else}
    <p class="notice">
      Risultato registrato. Il punteggio ufficiale sarà calcolato quando avrà giocato anche il tuo avversario.
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
