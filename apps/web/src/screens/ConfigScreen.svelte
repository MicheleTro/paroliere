<script module lang="ts">
  export interface GameSettings {
    durationMs: number;
    minWordLength: number;
    size: 4 | 5 | 6;
    pointMode: 'standard' | 'speciale';
    positionBonus: boolean;
  }
</script>

<script lang="ts">
  import { formatDuration } from '../lib/format.js';
  import InfoPopover from '../lib/InfoPopover.svelte';
  import ScoringInfoContent from '../lib/ScoringInfoContent.svelte';

  interface Props {
    onStart: (settings: GameSettings) => void;
    onBack: () => void;
  }

  let { onStart, onBack }: Props = $props();

  const DURATIONS_MS = [30_000, 60_000, 90_000, 120_000, 150_000];
  const MIN_WORD_LENGTHS = [3, 4, 5];
  const SIZES = [4, 5, 6] as const;

  let durationMs = $state(90_000);
  let minWordLength = $state(3);
  let size: 4 | 5 | 6 = $state(5);
  let pointMode: 'standard' | 'speciale' = $state('standard');
  let positionBonus = $state(false);
</script>

<div class="page">
  <h1>Nuova partita</h1>

  <div class="section">
    <p class="section-title">Durata</p>
    <div class="chip-group">
      {#each DURATIONS_MS as ms (ms)}
        <button type="button" class="chip" class:selected={durationMs === ms} onclick={() => (durationMs = ms)}>
          {formatDuration(ms)}
        </button>
      {/each}
    </div>
  </div>

  <div class="section">
    <p class="section-title">Lunghezza minima parola</p>
    <div class="chip-group">
      {#each MIN_WORD_LENGTHS as length (length)}
        <button type="button" class="chip" class:selected={minWordLength === length} onclick={() => (minWordLength = length)}>
          {length}
        </button>
      {/each}
    </div>
  </div>

  <div class="section">
    <p class="section-title">Griglia</p>
    <div class="chip-group">
      {#each SIZES as s (s)}
        <button type="button" class="chip" class:selected={size === s} onclick={() => (size = s)}>
          {s}×{s}
        </button>
      {/each}
    </div>
  </div>

  <div class="section">
    <p class="section-title">Punteggio</p>
    <div class="chip-group">
      <span class="chip-with-info">
        <button type="button" class="chip" class:selected={pointMode === 'standard'} onclick={() => (pointMode = 'standard')}>
          Standard
        </button>
        <InfoPopover label="Punteggio standard">
          <ScoringInfoContent kind="standard" />
        </InfoPopover>
      </span>
      <span class="chip-with-info">
        <button type="button" class="chip" class:selected={pointMode === 'speciale'} onclick={() => (pointMode = 'speciale')}>
          Speciale
        </button>
        <InfoPopover label="Punteggio speciale">
          <ScoringInfoContent kind="speciale" />
        </InfoPopover>
      </span>
    </div>
  </div>

  <div class="section">
    <p class="section-title">Bonus posizione</p>
    <div class="chip-group">
      <button type="button" class="chip" class:selected={!positionBonus} onclick={() => (positionBonus = false)}>No</button>
      <span class="chip-with-info">
        <button type="button" class="chip" class:selected={positionBonus} onclick={() => (positionBonus = true)}>Sì</button>
        <InfoPopover label="Bonus posizione">
          <ScoringInfoContent kind="position-bonus" />
        </InfoPopover>
      </span>
    </div>
  </div>

  {#if pointMode === 'speciale' || positionBonus}
    <p class="hint">Con questa modalità di punteggio la partita non conta per le statistiche.</p>
  {/if}

  <div class="actions">
    <button type="button" class="btn btn-secondary" onclick={onBack}>Indietro</button>
    <button
      type="button"
      class="btn btn-primary"
      onclick={() => onStart({ durationMs, minWordLength, size, pointMode, positionBonus })}
    >
      Inizia
    </button>
  </div>
</div>

<style>
  .hint {
    margin: 0;
    font-size: 0.82rem;
    font-weight: 600;
    text-align: center;
    color: var(--color-ink-faint);
  }

  .actions {
    display: flex;
    gap: 10px;
    margin-top: 4px;
  }

  .actions .btn {
    flex: 1;
  }
</style>
