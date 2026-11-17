<script lang="ts">
  import { reportWord } from './reports.js';

  // Sezione "Segnala" a fine partita: le parole tracciate ma non accettate perché assenti dal dizionario.
  // Toccandone una (e confermando) la si segnala agli admin, che decidono se aggiungerla.

  interface Props {
    words: readonly string[];
  }

  let { words }: Props = $props();

  let reported = $state(new Set<string>());
  let pending: string | undefined = $state();
  let confirming: string | undefined = $state();
  let error: string | undefined = $state();

  async function send(word: string): Promise<void> {
    confirming = undefined;
    error = undefined;
    pending = word;
    try {
      await reportWord(word);
      reported = new Set(reported).add(word);
    } catch (err) {
      error = err instanceof Error ? err.message : 'Errore imprevisto';
    } finally {
      pending = undefined;
    }
  }
</script>

<div class="card report">
  <h2>🚩 Segnala</h2>
  {#if words.length === 0}
    <p class="empty-text">Nessuna parola rifiutata in questa partita.</p>
  {:else}
    <p class="hint">Parole non accettate perché non sono nel dizionario. Tocca una parola per segnalarla.</p>
    <ul>
      {#each words as word (word)}
        <li>
          <button
            type="button"
            class="word-chip"
            class:reported={reported.has(word)}
            class:selected={confirming === word}
            disabled={reported.has(word) || pending === word}
            onclick={() => (confirming = word)}
          >
            {word}
            {#if reported.has(word)}<span>segnalata</span>{/if}
          </button>
        </li>
      {/each}
    </ul>
    {#if confirming}
      <div class="confirm">
        <span>Segnalare <b>{confirming}</b> come parola valida?</span>
        <div class="confirm-actions">
          <button type="button" class="btn btn-secondary btn-sm" onclick={() => (confirming = undefined)}>Annulla</button>
          <button type="button" class="btn btn-primary btn-sm" onclick={() => send(confirming!)}>Segnala</button>
        </div>
      </div>
    {/if}
  {/if}
  {#if error}
    <p class="error-text">{error}</p>
  {/if}
</div>

<style>
  .report {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 16px 18px;
  }

  h2 {
    margin: 0;
  }

  .hint {
    margin: 0;
    font-size: 0.8rem;
    color: var(--color-ink-faint);
  }

  ul {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .word-chip {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 0.85rem;
    font-weight: 700;
    padding: 6px 12px;
    border-radius: var(--radius-pill);
    border: 1.5px solid transparent;
    background: var(--color-surface-alt);
    color: var(--color-ink-soft);
    cursor: pointer;
  }

  .word-chip.selected {
    border-color: var(--color-warning);
  }

  .word-chip:disabled {
    cursor: default;
  }

  .word-chip.reported {
    background: var(--color-warning-wash);
    color: var(--color-warning);
  }

  .word-chip span {
    font-size: 0.68rem;
    text-transform: uppercase;
  }

  .confirm {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 10px 12px;
    border-radius: var(--radius-md);
    background: var(--color-warning-wash);
    font-size: 0.85rem;
  }

  .confirm-actions {
    display: flex;
    gap: 6px;
  }
</style>
