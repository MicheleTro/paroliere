<script lang="ts">
  import {
    adminLogout,
    approveReportedWord,
    discardReportedWord,
    listReportedWords,
    type AdminReportedWord,
  } from '../lib/admin.svelte.js';

  interface Props {
    onBack: () => void;
  }

  let { onBack }: Props = $props();

  let words: AdminReportedWord[] = $state([]);
  let loading = $state(true);
  let error: string | undefined = $state();
  let decidingId: string | undefined = $state();

  function load(): void {
    loading = true;
    error = undefined;
    listReportedWords()
      .then((result) => (words = result))
      .catch((err) => (error = err instanceof Error ? err.message : 'Errore imprevisto'))
      .finally(() => (loading = false));
  }

  load();

  async function handleApprove(word: AdminReportedWord): Promise<void> {
    error = undefined;
    decidingId = word.id;
    try {
      await approveReportedWord(word.id);
      words = words.filter((w) => w.id !== word.id);
    } catch (err) {
      error = err instanceof Error ? err.message : 'Errore imprevisto';
    } finally {
      decidingId = undefined;
    }
  }

  async function handleDiscard(word: AdminReportedWord): Promise<void> {
    error = undefined;
    decidingId = word.id;
    try {
      await discardReportedWord(word.id);
      words = words.filter((w) => w.id !== word.id);
    } catch (err) {
      error = err instanceof Error ? err.message : 'Errore imprevisto';
    } finally {
      decidingId = undefined;
    }
  }
</script>

<div class="page admin">
  <div class="header">
    <button type="button" class="btn-icon" aria-label="Torna al menu admin" onclick={onBack}>&larr;</button>
    <h1>Gestione parole</h1>
    <button type="button" class="btn btn-secondary btn-sm" onclick={adminLogout}>Esci</button>
  </div>

  <p class="hint">Parole segnalate dai giocatori come mancanti nel dizionario.</p>

  {#if error}
    <p class="error-text">{error}</p>
  {/if}

  {#if loading}
    <p class="empty-text">Caricamento...</p>
  {:else if words.length === 0}
    <p class="empty-text">Nessuna parola segnalata al momento.</p>
  {:else}
    <ul class="words">
      {#each words as word (word.id)}
        <li class="card">
          <div class="info">
            <span class="word">{word.word}</span>
            <span class="count">segnalata {word.reportCount} {word.reportCount === 1 ? 'volta' : 'volte'}</span>
          </div>
          <div class="row-actions">
            <button
              type="button"
              class="btn btn-secondary btn-sm"
              disabled={decidingId === word.id}
              onclick={() => handleDiscard(word)}
            >
              Scarta
            </button>
            <button
              type="button"
              class="btn btn-primary btn-sm"
              disabled={decidingId === word.id}
              onclick={() => handleApprove(word)}
            >
              Aggiungi al dizionario
            </button>
          </div>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .admin {
    width: min(94vw, 560px);
  }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    gap: 12px;
  }

  .header h1 {
    flex: 1;
    font-size: 1.2rem;
  }

  .hint {
    font-size: 0.85rem;
    color: var(--color-ink-faint);
  }

  .words {
    list-style: none;
    padding: 0;
    margin: 0;
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .words li {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 14px 16px;
  }

  .info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .word {
    font-weight: 700;
    font-size: 1.05rem;
    text-transform: capitalize;
  }

  .count {
    font-size: 0.8rem;
    color: var(--color-ink-faint);
  }

  .row-actions {
    display: flex;
    gap: 8px;
    flex-shrink: 0;
  }
</style>
