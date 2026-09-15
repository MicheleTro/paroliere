<script lang="ts">
  import type { GameSession, SessionSummary } from '@paroliere/core';
  import GameStatsSummary from '../lib/GameStatsSummary.svelte';
  import GridView from '../lib/GridView.svelte';
  import { reportWord } from '../lib/reports.js';
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

  let segnalaExpanded = $state(false);
  let reportedWords = $state(new Set<string>());
  let reportingWord: string | undefined = $state();
  let reportError: string | undefined = $state();

  async function handleReport(word: string): Promise<void> {
    if (reportedWords.has(word) || reportingWord) return;
    if (!confirm(`Vuoi segnalare l'aggiunta di questa parola? "${word}"`)) return;

    reportError = undefined;
    reportingWord = word;
    try {
      await reportWord(word);
      reportedWords = new Set(reportedWords).add(word);
    } catch (err) {
      reportError = err instanceof Error ? err.message : 'Errore imprevisto';
    } finally {
      reportingWord = undefined;
    }
  }
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
      <button type="button" class="segnala-toggle" onclick={() => (segnalaExpanded = !segnalaExpanded)}>
        <h2>🚩 Segnala ({session.rejectedWords.length})</h2>
        <span class="chevron" class:open={segnalaExpanded}>⌄</span>
      </button>
      {#if segnalaExpanded}
        {#if session.rejectedWords.length === 0}
          <p class="empty-text">Nessuna parola non riconosciuta in questo match.</p>
        {:else}
          <ul>
            {#each session.rejectedWords as rejected (rejected.word)}
              <li>
                <button
                  type="button"
                  class="word-chip rejectable"
                  class:reported={reportedWords.has(rejected.word)}
                  disabled={reportingWord === rejected.word}
                  onclick={() => handleReport(rejected.word)}
                >
                  {rejected.word}
                  {#if reportedWords.has(rejected.word)}<span>segnalata</span>{/if}
                </button>
              </li>
            {/each}
          </ul>
        {/if}
        {#if reportError}
          <p class="error-text">{reportError}</p>
        {/if}
      {/if}
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

  .segnala-toggle {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border: none;
    background: none;
    padding: 0;
    cursor: pointer;
    text-align: left;
  }

  .chevron {
    font-size: 1rem;
    color: var(--color-ink-faint);
    transition: transform 0.15s ease;
  }

  .chevron.open {
    transform: rotate(180deg);
  }

  .word-chip.rejectable {
    background: var(--color-surface-alt);
    color: var(--color-ink-faint);
  }

  .word-chip.rejectable:disabled {
    opacity: 0.6;
    cursor: default;
  }

  .word-chip.rejectable.reported {
    background: var(--color-warning-wash);
    color: var(--color-warning);
  }

  .word-chip.rejectable span {
    font-size: 0.68rem;
    font-weight: 700;
    text-transform: uppercase;
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
