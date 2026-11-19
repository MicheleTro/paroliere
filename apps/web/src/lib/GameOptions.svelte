<script lang="ts" module>
  export interface GameOptionValues {
    size: 4 | 5 | 6;
    durationMs: number;
    minWordLength: number;
    pointMode: 'standard' | 'speciale';
    positionBonus: boolean;
  }

  export const DEFAULT_OPTIONS: GameOptionValues = {
    size: 5,
    durationMs: 90_000,
    minWordLength: 3,
    pointMode: 'standard',
    positionBonus: false,
  };
</script>

<script lang="ts">
  import { formatDuration } from './format.js';
  import InfoPopover from './InfoPopover.svelte';
  import ScoringInfoContent from './ScoringInfoContent.svelte';

  // Scelte di una partita (durata, lunghezza minima, griglia, punteggio, bonus posizione): sfide e Gioca personalizzato.

  interface Props {
    options: GameOptionValues;
  }

  let { options = $bindable() }: Props = $props();

  const DURATIONS_MS = [30_000, 60_000, 90_000, 120_000, 150_000];
  const MIN_WORD_LENGTHS = [3, 4, 5];
  const SIZES = [4, 5, 6] as const;
</script>

<div class="section">
  <p class="section-title">Durata</p>
  <div class="chip-group">
    {#each DURATIONS_MS as ms (ms)}
      <button type="button" class="chip" class:selected={options.durationMs === ms} onclick={() => (options.durationMs = ms)}>
        {formatDuration(ms)}
      </button>
    {/each}
  </div>
</div>

<div class="section">
  <p class="section-title">Lunghezza minima parola</p>
  <div class="chip-group">
    {#each MIN_WORD_LENGTHS as length (length)}
      <button type="button" class="chip" class:selected={options.minWordLength === length} onclick={() => (options.minWordLength = length)}>
        {length}
      </button>
    {/each}
  </div>
</div>

<div class="section">
  <p class="section-title">Griglia</p>
  <div class="chip-group">
    {#each SIZES as s (s)}
      <button type="button" class="chip" class:selected={options.size === s} onclick={() => (options.size = s)}>{s}×{s}</button>
    {/each}
  </div>
</div>

<div class="section">
  <p class="section-title">Punteggio</p>
  <div class="chip-group">
    <span class="chip-with-info">
      <button type="button" class="chip" class:selected={options.pointMode === 'standard'} onclick={() => (options.pointMode = 'standard')}>
        Standard
      </button>
      <InfoPopover label="Punteggio standard"><ScoringInfoContent kind="standard" /></InfoPopover>
    </span>
    <span class="chip-with-info">
      <button type="button" class="chip" class:selected={options.pointMode === 'speciale'} onclick={() => (options.pointMode = 'speciale')}>
        Speciale
      </button>
      <InfoPopover label="Punteggio speciale"><ScoringInfoContent kind="speciale" /></InfoPopover>
    </span>
  </div>
</div>

<div class="section">
  <p class="section-title">Bonus posizione</p>
  <div class="chip-group">
    <button type="button" class="chip" class:selected={!options.positionBonus} onclick={() => (options.positionBonus = false)}>No</button>
    <span class="chip-with-info">
      <button type="button" class="chip" class:selected={options.positionBonus} onclick={() => (options.positionBonus = true)}>Sì</button>
      <InfoPopover label="Bonus posizione"><ScoringInfoContent kind="position-bonus" /></InfoPopover>
    </span>
  </div>
</div>

