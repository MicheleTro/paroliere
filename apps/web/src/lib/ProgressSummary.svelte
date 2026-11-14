<script lang="ts">
  import type { Progress } from './plays.js';

  interface Props {
    score?: { value: number; max: number };
    wordsFound: { found: number; total: number; percentage: number };
    progress?: Progress;
  }

  let { score, wordsFound, progress }: Props = $props();

  const levelPercent = $derived(
    progress ? Math.min(100, Math.round((progress.level.xpInLevel / progress.level.xpForNext) * 100)) : 0,
  );
</script>

<section class="card summary" aria-label="Risultato della partita">
  <div class="figures">
    {#if score}
      <div class="figure">
        <span class="value">{score.value}</span>
        <span class="label">punti</span>
      </div>
    {/if}
    <div class="figure">
      <span class="value">{wordsFound.found}<small>/{wordsFound.total}</small></span>
      <span class="label">parole · {Math.round(wordsFound.percentage)}%</span>
    </div>
    {#if progress}
      <div class="figure">
        <span class="value">+{progress.xp}</span>
        <span class="label">XP</span>
      </div>
    {/if}
  </div>

  {#if progress}
    <div class="level">
      <div class="level-head">
        <strong>Livello {progress.level.level}</strong>
        <span>{progress.level.xpInLevel}/{progress.level.xpForNext} XP</span>
      </div>
      <div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={levelPercent}>
        <span style:width="{levelPercent}%"></span>
      </div>
      {#if progress.leveledUp}
        <p class="up">Sei salito al livello {progress.level.level}!</p>
      {/if}
    </div>

    {#if progress.newWords.length > 0}
      <p class="line">
        <strong>{progress.newWords.length}</strong>
        {progress.newWords.length === 1 ? 'parola nuova' : 'parole nuove'} nella tua collezione
      </p>
    {/if}

    {#if progress.newMedals.length > 0}
      <ul class="medals">
        {#each progress.newMedals as medal (medal.id)}
          <li><strong>{medal.name}</strong> <span>{medal.description}</span></li>
        {/each}
      </ul>
    {/if}
  {/if}
</section>

<style>
  .summary {
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    gap: 8px;
    padding: 12px 16px;
  }

  .figures {
    display: flex;
    justify-content: space-around;
    gap: 8px;
    text-align: center;
  }

  .figure {
    display: flex;
    flex-direction: column;
  }

  .value {
    font-size: 1.5rem;
    font-weight: 800;
  }

  .value small {
    font-size: 1rem;
    color: var(--color-ink-soft);
  }

  .label {
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--color-ink-soft);
  }

  .level-head {
    display: flex;
    justify-content: space-between;
    font-size: 0.9rem;
    margin-bottom: 4px;
  }

  .bar {
    height: 10px;
    border-radius: 999px;
    background: var(--color-surface-alt);
    overflow: hidden;
  }

  .bar span {
    display: block;
    height: 100%;
    background: var(--color-success);
  }

  .up {
    margin: 6px 0 0;
    text-align: center;
    font-weight: 800;
    color: var(--color-success);
  }

  .line {
    margin: 0;
    text-align: center;
    font-size: 0.9rem;
  }

  .medals {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .medals li {
    padding: 6px 10px;
    border-radius: var(--radius-md);
    background: var(--color-surface-alt);
    font-size: 0.9rem;
  }

  .medals span {
    color: var(--color-ink-soft);
  }
</style>
