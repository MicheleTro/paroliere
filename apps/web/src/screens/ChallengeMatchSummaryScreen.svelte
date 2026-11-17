<script lang="ts">
  import { classicScoring, type GameSession, type SessionSummary } from '@paroliere/core';
  import ProgressSummary from '../lib/ProgressSummary.svelte';
  import ChallengeWordsSheet from '../sheets/ChallengeWordsSheet.svelte';
  import { auth } from '../lib/auth.svelte.js';
  import type { SubmitResultResponse } from '../lib/challenges.js';

  interface Props {
    session: GameSession;
    summary: SessionSummary;
    result?: SubmitResultResponse;
    error?: string;
    onBack: () => void;
  }

  let { session, summary, result, error, onBack }: Props = $props();

  let showWords = $state(false);

  // Le parole valide le decide il server (può conoscere parole aggiunte al dizionario dopo il caricamento)
  const found = $derived(result?.found ?? summary.foundWords);
  const foundSet = $derived(new Set(found.map((w) => w.word)));
  const missed = $derived(
    summary.missedWords
      .filter((s) => !foundSet.has(s.word))
      .map((s) => ({ ...s, points: classicScoring.scoreWord(s.word, s.path, session.grid, session.config) })),
  );
  const rejected = $derived(session.rejectedWords.map((r) => r.word).filter((w) => !foundSet.has(w)));
</script>

<div class="page">
  <h1>{error ? 'Invio non riuscito' : 'Partita inviata'}</h1>

  <ProgressSummary
    wordsFound={{
      found: found.length,
      total: summary.totalWords,
      percentage: summary.totalWords ? (found.length / summary.totalWords) * 100 : 0,
    }}
    progress={result?.progress}
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

  <button type="button" class="btn btn-secondary btn-block" onclick={() => (showWords = true)}>Vedi le parole</button>
  {#if showWords}
    <ChallengeWordsSheet
      grid={session.grid}
      pointMode={session.config.pointMode}
      positionBonus={session.config.positionBonus}
      tabs={[
        { key: 'me', label: auth.user?.username ?? 'Tu', words: found },
        { key: 'missed', label: 'Mancate', words: missed, missed: true },
      ]}
      {rejected}
      onClose={() => (showWords = false)}
    />
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
