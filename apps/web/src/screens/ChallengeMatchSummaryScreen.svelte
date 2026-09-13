<script lang="ts">
  import type { GameSession, SessionSummary } from '@paroliere/core';
  import GridView from '../lib/GridView.svelte';
  import type { SubmitResultResponse } from '../lib/challenges.js';

  interface Props {
    session: GameSession;
    summary: SessionSummary;
    result: SubmitResultResponse;
    onBack: () => void;
  }

  let { session, summary, result, onBack }: Props = $props();
</script>

<div class="summary">
  <h1>Match inviato</h1>
  <p class="score">Parole trovate: {summary.foundWords.length} / {summary.totalWords}</p>

  <GridView grid={session.grid} interactive={false} highlightPath={[]} onSubmit={() => {}} />

  {#if result.settled}
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

  .score {
    font-size: 1.2rem;
    font-weight: 600;
  }

  .settled,
  .waiting {
    text-align: center;
    opacity: 0.9;
  }

  .primary {
    font-size: 1.1rem;
    padding: 10px 20px;
    border-radius: 8px;
    border: none;
    background: #4a90d9;
    color: white;
    cursor: pointer;
  }
</style>
