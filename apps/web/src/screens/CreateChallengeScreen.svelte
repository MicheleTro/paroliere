<script lang="ts">
  import { createChallenge, type ChallengeMode } from '../lib/challenges.js';
  import { formatDuration } from '../lib/format.js';

  interface Props {
    onCreated: (challengeId: string) => void;
    onBack: () => void;
  }

  let { onCreated, onBack }: Props = $props();

  const DURATIONS_MS = [30_000, 60_000, 90_000, 120_000, 150_000];
  const MIN_WORD_LENGTHS = [3, 4, 5];
  const SIZES = [4, 5, 6] as const;

  let durationMs = $state(90_000);
  let minWordLength = $state(3);
  let size: 4 | 5 | 6 = $state(5);
  const mode: ChallengeMode = 'individual';
  let bestOf = $state(1);
  let maxParticipants = $state(2);
  let submitting = $state(false);
  let error: string | undefined = $state();

  async function handleSubmit(): Promise<void> {
    error = undefined;
    submitting = true;
    try {
      const result = await createChallenge({
        config: { size, durationMs, minWordLength, minWords: 50, scoring: 'versus' },
        mode,
        bestOf,
        maxParticipants,
      });
      onCreated(result.challenge.id);
    } catch (err) {
      error = err instanceof Error ? err.message : 'Errore imprevisto';
    } finally {
      submitting = false;
    }
  }
</script>

<div class="create">
  <h1>Nuova sfida</h1>

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

  <section>
    <h2>Modalità</h2>
    <div class="options">
      <button type="button" class="selected" disabled>Individuale</button>
      <button type="button" disabled title="Disponibile più avanti">A squadre</button>
    </div>
  </section>

  <section>
    <h2>Numero di giocatori</h2>
    <div class="slider">
      <input type="range" min="2" max="8" step="1" bind:value={maxParticipants} />
      <span class="slider-value">{maxParticipants}</span>
    </div>
  </section>

  <section>
    <h2>Numero di match</h2>
    <div class="options">
      {#each [1, 3, 5] as n (n)}
        <button type="button" class:selected={bestOf === n} onclick={() => (bestOf = n)}>{n}</button>
      {/each}
    </div>
  </section>

  {#if error}
    <p class="error">{error}</p>
  {/if}

  <div class="actions">
    <button type="button" class="secondary" onclick={onBack}>Indietro</button>
    <button type="button" class="primary" disabled={submitting} onclick={handleSubmit}>
      {submitting ? 'Creazione...' : 'Crea sfida'}
    </button>
  </div>
</div>

<style>
  .create {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    width: min(90vw, 420px);
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

  .options button:disabled {
    opacity: 0.5;
    cursor: default;
  }

  .slider {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
  }

  .slider input[type='range'] {
    flex: 1;
  }

  .slider-value {
    font-size: 1.1rem;
    font-weight: 700;
    color: var(--color-accent);
    min-width: 1.5em;
    text-align: center;
  }

  .error {
    color: var(--color-danger);
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

  .actions .primary:disabled {
    background: var(--color-disabled);
    color: var(--color-ink-soft);
    cursor: default;
  }

  .actions .secondary {
    background: var(--color-disabled);
    color: var(--color-ink);
  }
</style>
