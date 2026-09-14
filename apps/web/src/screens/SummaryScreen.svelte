<script lang="ts">
  import type { GameSession, SessionSummary } from '@paroliere/core';
  import GameStatsSummary from '../lib/GameStatsSummary.svelte';
  import GridView from '../lib/GridView.svelte';
  import type { WordStats } from '../lib/stats.js';

  interface Props {
    session: GameSession;
    summary: SessionSummary;
    typeStats?: WordStats;
    onNewGame: () => void;
    onHome: () => void;
  }

  let { session, summary, typeStats, onNewGame, onHome }: Props = $props();

  let selectedPath: number[] = $state([]);

  function groupByLength<T extends { word: string }>(words: readonly T[]): Map<number, T[]> {
    const groups = new Map<number, T[]>();
    for (const w of words) {
      const list = groups.get(w.word.length) ?? [];
      list.push(w);
      groups.set(w.word.length, list);
    }
    return new Map([...groups.entries()].sort((a, b) => a[0] - b[0]));
  }

  const foundByLength = $derived(groupByLength(summary.foundWords));
  const missedByLength = $derived(groupByLength(summary.missedWords));
</script>

<div class="summary">
  <h1>Riepilogo</h1>

  <GameStatsSummary
    score={{ value: summary.score, max: summary.maxScore }}
    wordsFound={{ found: summary.foundWords.length, total: summary.totalWords, percentage: summary.foundPercentage }}
    {typeStats}
  />

  <GridView grid={session.grid} interactive={false} highlightPath={selectedPath} onSubmit={() => {}} />

  <div class="word-lists">
    <section>
      <h2>Trovate</h2>
      {#each [...foundByLength] as [length, words] (length)}
        <p class="length-label">{length} lettere</p>
        <ul>
          {#each words as found (found.word)}
            <li>
              <button type="button" onclick={() => (selectedPath = found.path)}>
                {found.word} (+{found.points})
              </button>
            </li>
          {/each}
        </ul>
      {/each}
    </section>

    <section>
      <h2>Mancate</h2>
      {#each [...missedByLength] as [length, words] (length)}
        <p class="length-label">{length} lettere</p>
        <ul>
          {#each words as missed (missed.word)}
            <li>
              <button type="button" onclick={() => (selectedPath = missed.path)}>
                {missed.word}
              </button>
            </li>
          {/each}
        </ul>
      {/each}
    </section>
  </div>

  <div class="actions">
    <button type="button" onclick={onNewGame}>Nuova partita</button>
    <button type="button" class="secondary" onclick={onHome}>Home</button>
  </div>
</div>

<style>
  .summary {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    width: min(92vw, 480px);
  }

  .word-lists {
    display: flex;
    gap: 24px;
    flex-wrap: wrap;
    justify-content: center;
  }

  .length-label {
    margin: 8px 0 2px;
    font-weight: 600;
    opacity: 0.7;
  }

  ul {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  button {
    cursor: pointer;
  }

  .actions {
    display: flex;
    gap: 12px;
    margin-top: 12px;
  }

  .actions button {
    font-size: 1.1rem;
    padding: 10px 20px;
    border-radius: var(--radius-md);
    border: none;
    background: var(--color-accent);
    color: var(--color-accent-contrast);
    cursor: pointer;
  }

  .actions .secondary {
    background: var(--color-disabled);
    color: var(--color-ink);
  }
</style>
