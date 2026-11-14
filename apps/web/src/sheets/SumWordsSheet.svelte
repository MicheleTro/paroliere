<script lang="ts">
  import type { GameSession, SessionSummary } from '@paroliere/core';
  import { displayWord } from '../lib/display.js';
  import GridView from '../lib/GridView.svelte';
  import Sheet from '../lib/Sheet.svelte';

  interface Props {
    session: GameSession;
    summary: SessionSummary;
    /** Parole entrate per la prima volta nella collezione. */
    newWords: Set<string>;
    /** Le parole mancate si vedono solo in Gioca (il seme è casuale e non svela nulla agli altri). */
    showMissed: boolean;
    onClose: () => void;
  }

  let { session, summary, newWords, showMissed, onClose }: Props = $props();

  type Tab = 'trovate' | 'mancate';
  let tab: Tab = $state('trovate');
  let selected: string | undefined = $state();

  const found = $derived([...summary.foundWords].sort((a, b) => b.word.length - a.word.length || a.word.localeCompare(b.word)));
  const missed = $derived([...summary.missedWords].sort((a, b) => b.word.length - a.word.length || a.word.localeCompare(b.word)));
  const list = $derived(tab === 'mancate' ? missed : found);
  const path = $derived(list.find((w) => w.word === selected)?.path ?? []);

  function choose(next: Tab): void {
    tab = next;
    selected = undefined;
  }
</script>

<Sheet title="Parole" {onClose}>
  {#if showMissed}
    <div class="tabs">
      <button type="button" aria-pressed={tab === 'trovate'} onclick={() => choose('trovate')}>Trovate {found.length}</button>
      <button type="button" aria-pressed={tab === 'mancate'} onclick={() => choose('mancate')}>Mancate {missed.length}</button>
    </div>
  {/if}

  <div class="row top">
    <div class="mini">
      <GridView grid={session.grid} interactive={false} highlightPath={path} onSubmit={() => {}} />
    </div>
    <div class="wgrid grow words" style="min-width: 0">
      {#each list as item (item.word)}
        <button
          type="button"
          class="wchip"
          class:new={newWords.has(item.word)}
          aria-pressed={selected === item.word}
          onclick={() => (selected = selected === item.word ? undefined : item.word)}
        >
          {displayWord(item.word)}
        </button>
      {:else}
        <p class="muted">Nessuna.</p>
      {/each}
    </div>
  </div>
</Sheet>

<style>
  .top {
    align-items: flex-start;
    gap: 12px;
    min-height: 0;
  }

  .mini {
    --grid-max: 150px;
    --grid-font: 0.8rem;
    flex: none;
    width: 150px;
  }

  /* Le griglie 5×5 e 6×6 hanno margini propri: qui vanno ridotti, o le caselle escono dal riquadro */
  .mini :global(.grid) {
    --grid-pad: 6px;
    --grid-gap: 3px;
    border-width: 3px;
    border-radius: 16px;
    box-shadow: 0 4px 0 var(--ink);
  }

  .mini :global(.cell) {
    border-width: 2px;
    border-radius: 8px;
    min-width: 0;
    min-height: 0;
  }

  .words {
    max-height: 44dvh;
  }

  .wchip {
    cursor: pointer;
    color: var(--ink);
  }

  .wchip[aria-pressed='true'] {
    background: var(--blue);
    color: #fff;
  }
</style>
