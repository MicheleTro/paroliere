<script lang="ts">
  import { createChallenge, type ChallengeMode, type Scoring } from '../lib/challenges.js';
  import { formatDuration } from '../lib/format.js';

  interface Props {
    onCreated: (challengeId: string) => void;
    onBack: () => void;
  }

  let { onCreated, onBack }: Props = $props();

  const DURATIONS_MS = [30_000, 60_000, 90_000, 120_000, 150_000];
  const MIN_WORD_LENGTHS = [3, 4, 5];
  const SIZES = [4, 5, 6] as const;

  let durationMs = $state(120_000);
  let minWordLength = $state(3);
  let size: 4 | 5 | 6 = $state(4);
  let scoring: Scoring = $state('classic');
  let mode: ChallengeMode = $state('individual');
  let bestOf = $state(1);
  let teamNames: string[] = $state(['Squadra A', 'Squadra B']);
  let submitting = $state(false);
  let error: string | undefined = $state();

  function addTeam(): void {
    teamNames = [...teamNames, `Squadra ${teamNames.length + 1}`];
  }

  function removeTeam(index: number): void {
    teamNames = teamNames.filter((_, i) => i !== index);
  }

  async function handleSubmit(): Promise<void> {
    error = undefined;
    if (mode === 'team' && teamNames.filter((name) => name.trim().length > 0).length < 2) {
      error = 'Servono almeno 2 squadre';
      return;
    }

    submitting = true;
    try {
      const result = await createChallenge({
        config: { size, durationMs, minWordLength, minWords: 50, scoring },
        mode,
        bestOf,
        teams: mode === 'team' ? teamNames.map((name) => ({ name })) : undefined,
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
    <h2>Lettere per lato</h2>
    <div class="options">
      {#each SIZES as s (s)}
        <button type="button" class:selected={size === s} onclick={() => (size = s)}>
          {s}
        </button>
      {/each}
    </div>
  </section>

  <section>
    <h2>Punteggio</h2>
    <div class="options">
      <button type="button" class:selected={scoring === 'classic'} onclick={() => (scoring = 'classic')}>
        Classico
      </button>
      <button type="button" class:selected={scoring === 'versus'} onclick={() => (scoring = 'versus')}>
        Versus
      </button>
    </div>
  </section>

  <section>
    <h2>Modalità</h2>
    <div class="options">
      <button type="button" class:selected={mode === 'individual'} onclick={() => (mode = 'individual')}>
        Individuale
      </button>
      <button type="button" class:selected={mode === 'team'} onclick={() => (mode = 'team')}>A squadre</button>
    </div>
  </section>

  {#if mode === 'team'}
    <section>
      <h2>Squadre</h2>
      {#each teamNames as _, index (index)}
        <div class="team-row">
          <input type="text" bind:value={teamNames[index]} />
          {#if teamNames.length > 2}
            <button type="button" class="link" onclick={() => removeTeam(index)}>Rimuovi</button>
          {/if}
        </div>
      {/each}
      <button type="button" class="link" onclick={addTeam}>Aggiungi squadra</button>
    </section>
  {/if}

  <section>
    <h2>Numero di match (best of)</h2>
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
    border-radius: 8px;
    border: 2px solid #2c4256;
    background: #1c2b3a;
    color: #f5f5f5;
    cursor: pointer;
  }

  .options button.selected {
    border-color: #4a90d9;
    background: #4a90d9;
  }

  .team-row {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
  }

  .team-row input {
    flex: 1;
    font-size: 1rem;
    padding: 8px 12px;
    border-radius: 8px;
    border: 2px solid #2c4256;
    background: white;
    color: #1c2b3a;
  }

  .link {
    font-size: 0.9rem;
    padding: 0;
    border: none;
    background: none;
    color: #4a90d9;
    text-decoration: underline;
    cursor: pointer;
  }

  .error {
    color: #b3261e;
  }

  .actions {
    display: flex;
    gap: 12px;
    margin-top: 12px;
  }

  .actions button {
    font-size: 1.1rem;
    padding: 10px 20px;
    border-radius: 8px;
    border: none;
    cursor: pointer;
  }

  .actions .primary {
    background: #4a90d9;
    color: white;
  }

  .actions .primary:disabled {
    background: #7a8a99;
    cursor: default;
  }

  .actions .secondary {
    background: #7a8a99;
    color: white;
  }
</style>
