<script lang="ts">
  import { displayWord } from './display.js';

  // Elenco di parole in ordine di punteggio (dal più alto). Toccandone una se ne mostra il percorso sulla griglia.

  interface Word {
    word: string;
    points: number;
    path: number[];
  }

  interface Props {
    title: string;
    words: readonly Word[];
    tone: 'found' | 'missed';
    empty?: string;
    onSelect?: (path: number[]) => void;
  }

  let { title, words, tone, empty = 'Nessuna parola.', onSelect }: Props = $props();

  const sorted = $derived(
    [...words].sort((a, b) => b.points - a.points || b.word.length - a.word.length || a.word.localeCompare(b.word)),
  );
</script>

<div class="card word-card">
  <h2>{title} <span class="count">{words.length}</span></h2>
  {#if sorted.length === 0}
    <p class="empty-text">{empty}</p>
  {:else}
    <ul>
      {#each sorted as w (w.word)}
        <li>
          <button type="button" class="word-chip {tone}" onclick={() => onSelect?.(w.path)}>
            {displayWord(w.word)} <span>{tone === 'found' ? '+' : ''}{w.points}</span>
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .word-card {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 16px 18px;
  }

  h2 {
    margin: 0;
  }

  .count {
    font-size: 0.85rem;
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
    border: none;
    cursor: pointer;
  }

  .word-chip.found {
    background: var(--color-success-wash);
    color: var(--color-success);
  }

  .word-chip.found span {
    color: var(--color-stamp);
  }

  .word-chip.missed {
    background: var(--color-surface-alt);
    color: var(--color-ink-faint);
  }

  .word-chip.missed span {
    font-size: 0.75rem;
  }
</style>
