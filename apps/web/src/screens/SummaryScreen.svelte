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
    onRepeat: () => void;
    onHome: () => void;
  }

  let { session, summary, typeStats, onNewGame, onRepeat, onHome }: Props = $props();

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

<div class="page">
  <h1>Riepilogo</h1>

  <GameStatsSummary
    score={{ value: summary.score, max: summary.maxScore }}
    wordsFound={{ found: summary.foundWords.length, total: summary.totalWords, percentage: summary.foundPercentage }}
    {typeStats}
  />

  <GridView
    grid={session.grid}
    interactive={false}
    highlightPath={selectedPath}
    onSubmit={() => {}}
    pointMode={session.config.pointMode}
    positionBonus={session.config.positionBonus}
  />

  <div class="word-lists">
    <div class="card word-card">
      <h2>✅ Trovate</h2>
      {#each [...foundByLength] as [length, words] (length)}
        <p class="length-label">{length} lettere</p>
        <ul>
          {#each words as found (found.word)}
            <li>
              <button type="button" class="word-chip found" onclick={() => (selectedPath = found.path)}>
                {found.word} <span>+{found.points}</span>
              </button>
            </li>
          {/each}
        </ul>
      {/each}
    </div>

    <div class="card word-card">
      <h2>✖️ Mancate</h2>
      {#each [...missedByLength] as [length, words] (length)}
        <p class="length-label">{length} lettere</p>
        <ul>
          {#each words as missed (missed.word)}
            <li>
              <button type="button" class="word-chip missed" onclick={() => (selectedPath = missed.path)}>
                {missed.word}
              </button>
            </li>
          {/each}
        </ul>
      {/each}
    </div>
  </div>

  <div class="actions">
    <button type="button" class="btn btn-secondary" onclick={onHome}>Home</button>
    <button type="button" class="btn btn-secondary" onclick={onRepeat}>Ripeti</button>
    <button type="button" class="btn btn-primary" onclick={onNewGame}>Nuova partita</button>
  </div>
</div>

<style>
  .word-lists {
    display: flex;
    flex-direction: column;
    gap: 12px;
    width: 100%;
  }

  .word-card {
    padding: 16px 18px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .length-label {
    margin: 8px 0 2px;
    font-size: 0.75rem;
    font-weight: 700;
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

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-top: 4px;
  }

  .actions .btn {
    flex: 1 1 auto;
    min-width: 100px;
  }
</style>
