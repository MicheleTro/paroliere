<script lang="ts">
  import Svg from '../lib/Svg.svelte';
  import { displayWord } from '../lib/display.js';
  import { getWords, type WordLength } from '../lib/me.js';
  import Sheet from '../lib/Sheet.svelte';
  import { ICONS } from '../lib/icons.js';

  interface Props {
    onClose: () => void;
    onInfo: (key: string) => void;
  }

  let { onClose, onInfo }: Props = $props();

  const FILTERS: WordLength[] = ['tutte', '3', '4', '5', '6', '7+'];

  let filter: WordLength = $state('tutte');
  let words: string[] = $state([]);
  let total = $state(0);
  let loading = $state(true);
  let error: string | undefined = $state();

  function load(): void {
    loading = true;
    getWords(filter)
      .then((result) => {
        words = result.words;
        total = result.total;
        error = undefined;
      })
      .catch((err) => (error = err instanceof Error ? err.message : 'Errore imprevisto'))
      .finally(() => (loading = false));
  }
  load();

  function choose(next: WordLength): void {
    filter = next;
    load();
  }
</script>

<Sheet title="{total.toLocaleString('it-IT')} {total === 1 ? 'parola' : 'parole'}" {onClose} onInfo={() => onInfo('parole')}>
  {#snippet badge()}
    <span class="vbadge" style="background: var(--blue-l)"><Svg svg={ICONS.book} /></span>
  {/snippet}

  <div class="tabs">
    {#each FILTERS as f (f)}
      <button type="button" aria-pressed={filter === f} onclick={() => choose(f)}>{f === 'tutte' ? 'Tutte' : f}</button>
    {/each}
  </div>

  {#if error}
    <p class="error-text">{error}</p>
  {:else if loading}
    <p class="muted center">Caricamento...</p>
  {:else if words.length === 0}
    <p class="muted center">Nessuna parola qui.</p>
  {:else}
    <div class="wgrid list">
      {#each words as word (word)}<span class="wchip">{displayWord(word)}</span>{/each}
    </div>
  {/if}
</Sheet>

<style>
  .vbadge :global(svg) {
    width: 30px;
    height: 30px;
  }

  .list {
    max-height: 46dvh;
  }
</style>
