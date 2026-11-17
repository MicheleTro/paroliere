<script lang="ts">
  import type { Grid } from '@paroliere/core';
  import { displayWord } from '../lib/display.js';
  import GridView from '../lib/GridView.svelte';
  import ReportWords from '../lib/ReportWords.svelte';
  import Sheet from '../lib/Sheet.svelte';

  // Parole di fine sfida in un foglio: una scheda per giocatore (con lo username), una per le mancate
  // e una per le parole da segnalare. Toccandone una se ne vede il percorso sulla griglia piccola.

  interface Word {
    word: string;
    points: number;
    path: number[];
  }

  interface Tab {
    key: string;
    label: string;
    words: readonly Word[];
    /** Le parole mancate non danno punti. */
    missed?: boolean;
  }

  interface Props {
    grid: Grid;
    pointMode?: 'standard' | 'speciale';
    positionBonus?: boolean;
    tabs: readonly Tab[];
    /** Parole rifiutate perché assenti dal dizionario: se ci sono, compare la scheda "Segnalate". */
    rejected?: readonly string[];
    onClose: () => void;
  }

  let { grid, pointMode, positionBonus, tabs, rejected = [], onClose }: Props = $props();

  const REPORT = '__segnalate';
  let tabKey = $state(tabs[0]?.key ?? REPORT);
  let selected: string | undefined = $state();

  const current = $derived(tabs.find((t) => t.key === tabKey));
  const sorted = $derived(
    [...(current?.words ?? [])].sort(
      (a, b) => b.points - a.points || b.word.length - a.word.length || a.word.localeCompare(b.word),
    ),
  );
  const path = $derived(sorted.find((w) => w.word === selected)?.path ?? []);

  function choose(key: string): void {
    tabKey = key;
    selected = undefined;
  }
</script>

<Sheet title="Parole" {onClose}>
  <div class="tabs">
    {#each tabs as t (t.key)}
      <button type="button" aria-pressed={tabKey === t.key} onclick={() => choose(t.key)}>
        {t.label} {t.words.length}
      </button>
    {/each}
    {#if rejected.length > 0}
      <button type="button" aria-pressed={tabKey === REPORT} onclick={() => choose(REPORT)}>
        Segnalate {rejected.length}
      </button>
    {/if}
  </div>

  {#if tabKey === REPORT}
    <div class="report">
      <ReportWords words={rejected} />
    </div>
  {:else}
    <div class="row top">
      <div class="mini">
        <GridView {grid} interactive={false} highlightPath={path} onSubmit={() => {}} {pointMode} {positionBonus} />
      </div>
      <div class="wgrid grow words" style="min-width: 0">
        {#each sorted as item (item.word)}
          <button
            type="button"
            class="wchip"
            aria-pressed={selected === item.word}
            onclick={() => (selected = selected === item.word ? undefined : item.word)}
          >
            {displayWord(item.word)}{#if !current?.missed}&nbsp;+{item.points}{/if}
          </button>
        {:else}
          <p class="muted">Nessuna.</p>
        {/each}
      </div>
    </div>
  {/if}
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

  .report {
    max-height: 50dvh;
    overflow-y: auto;
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
