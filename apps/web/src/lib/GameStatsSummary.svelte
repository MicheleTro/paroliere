<script lang="ts">
  import type { WordStats } from './stats.js';

  interface Props {
    score?: { value: number; max: number };
    wordsFound: { found: number; total: number; percentage: number };
    typeStats?: WordStats;
  }

  let { score, wordsFound, typeStats }: Props = $props();
</script>

<div class="summary-card">
  <div class="headline">
    {#if score}
      <div class="stat main">
        <span class="value">{score.value}</span>
        <span class="label">punti (su {score.max})</span>
      </div>
    {/if}
    <div class="stat main">
      <span class="value">{wordsFound.found}<span class="of">/{wordsFound.total}</span></span>
      <span class="label">parole trovate ({wordsFound.percentage.toFixed(0)}%)</span>
    </div>
  </div>

  {#if typeStats && typeStats.gamesPlayed > 0}
    <div class="type-stats">
      <p class="type-title">
        Le tue statistiche {typeStats.gridSize}x{typeStats.gridSize} · {Math.round(typeStats.durationMs / 1000)}s
        <span class="games-count">({typeStats.gamesPlayed} partite)</span>
      </p>
      <div class="tiles">
        <div class="stat">
          <span class="value">{typeStats.longestWord ?? '—'}</span>
          <span class="label">parola più lunga ({typeStats.longestWordLength} lettere)</span>
        </div>
        <div class="stat">
          <span class="value">{typeStats.averageWordLength.toFixed(1)}</span>
          <span class="label">media lettere a parola</span>
        </div>
        <div class="stat">
          <span class="value">{typeStats.averageWordsPerGame.toFixed(1)}</span>
          <span class="label">media parole trovate</span>
        </div>
        <div class="stat">
          <span class="value">{typeStats.maxWordsInGame}</span>
          <span class="label">record parole trovate</span>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .summary-card {
    display: flex;
    flex-direction: column;
    gap: 16px;
    width: 100%;
    padding: 20px 22px;
    border-radius: var(--radius-lg);
    background: var(--color-surface);
    box-shadow: var(--shadow-card);
  }

  .headline {
    display: flex;
    gap: 12px;
    justify-content: center;
    flex-wrap: wrap;
  }

  .stat {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    min-width: 90px;
  }

  .headline .stat.main {
    padding: 10px 18px;
    border-radius: var(--radius-md);
    background: var(--color-accent-wash);
  }

  .stat.main .value {
    font-size: 1.7rem;
    font-weight: 800;
    color: var(--color-accent);
  }

  .stat .value {
    font-size: 1.1rem;
    font-weight: 700;
    color: var(--color-ink);
  }

  .of {
    font-size: 1rem;
    font-weight: 400;
    opacity: 0.6;
  }

  .stat .label {
    font-size: 0.72rem;
    font-weight: 600;
    text-align: center;
    color: var(--color-ink-faint);
  }

  .type-stats {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding-top: 14px;
    border-top: 1px solid var(--color-border);
  }

  .type-title {
    margin: 0;
    text-align: center;
    font-size: 0.8rem;
    font-weight: 700;
    color: var(--color-ink-soft);
  }

  .games-count {
    font-weight: 500;
    color: var(--color-ink-faint);
  }

  .tiles {
    display: flex;
    justify-content: center;
    gap: 10px;
    flex-wrap: wrap;
  }

  .tiles .stat {
    padding: 10px 14px;
    border-radius: var(--radius-md);
    background: var(--color-surface-alt);
    min-width: 108px;
  }
</style>
