<script module lang="ts">
  export interface GameSettings {
    durationMs: number;
    minWordLength: number;
    size: 4 | 5 | 6;
  }
</script>

<script lang="ts">
  import { formatDuration } from '../lib/format.js';

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
</script>

<div class="config">
  <h1>Nuova partita</h1>

  <section>
    <h2>Durata</h2>
    <div class="options">
      {#each DURATIONS_MS as ms (ms)}
        <button type="button" class:selected={durationMs === ms} onclick={() => (durationMs = ms)}>
          {formatDuration(ms)}
        </button>
      {/each}
    </div>
  </section>

  <section>
    <h2>Lunghezza minima parola</h2>
    <div class="options">
      {#each MIN_WORD_LENGTHS as length (length)}
        <button type="button" class:selected={minWordLength === length} onclick={() => (minWordLength = length)}>
          {length}
        </button>
      {/each}
    </div>
  </section>

  <section>
    <h2>Griglia</h2>
    <div class="options">
      {#each SIZES as s (s)}
        <button type="button" class:selected={size === s} onclick={() => (size = s)}>
          {s}×{s}
        </button>
      {/each}
    </div>
  </section>

  <div class="actions">
    <button type="button" class="secondary" onclick={onBack}>Indietro</button>
    <button type="button" class="primary" onclick={() => onStart({ durationMs, minWordLength, size })}>
      Inizia
    </button>
  </div>
</div>

<style>
  .config {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    width: min(90vw, 400px);
  }

  section {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }

  h2 {
    font-size: 1rem;
    font-weight: 600;
    margin: 0;
  }

  .options {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    justify-content: center;
  }

  .options button {
    font-size: 1rem;
    padding: 8px 16px;
    border-radius: var(--radius-md);
    border: 2px solid var(--color-border);
    background: var(--color-surface);
    color: var(--color-ink);
    cursor: pointer;
  }

  .options button.selected {
    border-color: var(--color-accent);
    background: var(--color-accent);
    color: var(--color-accent-contrast);
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
    cursor: pointer;
  }

  .actions .primary {
    background: var(--color-accent);
    color: var(--color-accent-contrast);
  }

  .actions .secondary {
    background: var(--color-disabled);
    color: var(--color-ink);
  }
</style>
