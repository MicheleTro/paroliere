<script lang="ts">
  import { createChallenge, type ChallengeMode } from '../lib/challenges.js';
  import { formatDuration } from '../lib/format.js';
  import InfoPopover from '../lib/InfoPopover.svelte';
  import ScoringInfoContent from '../lib/ScoringInfoContent.svelte';

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
  let pointMode: 'standard' | 'speciale' = $state('standard');
  let positionBonus = $state(false);
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
        config: { size, durationMs, minWordLength, minWords: 50, scoring: 'versus', pointMode, positionBonus },
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

<div class="page">
  <h1>Nuova sfida</h1>

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
    <p class="hint">Con questa modalità di punteggio i match non contano per le statistiche.</p>
  {/if}

  <div class="section">
    <p class="section-title">Modalità</p>
    <div class="chip-group">
      <button type="button" class="chip selected" disabled>Individuale</button>
      <button type="button" class="chip" disabled title="Disponibile più avanti">A squadre</button>
    </div>
  </div>

  <div class="section">
    <p class="section-title">Numero di giocatori</p>
    <div class="slider">
      <input type="range" min="2" max="8" step="1" bind:value={maxParticipants} />
      <span class="slider-value">{maxParticipants}</span>
    </div>
  </div>

  <div class="section">
    <p class="section-title">Numero di match</p>
    <div class="chip-group">
      {#each [1, 3, 5] as n (n)}
        <button type="button" class="chip" class:selected={bestOf === n} onclick={() => (bestOf = n)}>{n}</button>
      {/each}
    </div>
  </div>

  {#if error}
    <p class="error-text">{error}</p>
  {/if}

  <div class="actions">
    <button type="button" class="btn btn-secondary" onclick={onBack}>Indietro</button>
    <button type="button" class="btn btn-primary" disabled={submitting} onclick={handleSubmit}>
      {submitting ? 'Creazione...' : 'Crea sfida'}
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

  .slider {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
  }

  .slider input[type='range'] {
    flex: 1;
    accent-color: var(--color-accent);
  }

  .slider-value {
    font-size: 1.1rem;
    font-weight: 800;
    color: var(--color-accent);
    min-width: 1.5em;
    text-align: center;
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
