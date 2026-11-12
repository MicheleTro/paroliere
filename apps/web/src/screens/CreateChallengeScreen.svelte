<script lang="ts">
  import { createChallenge, listFriends, type Friend } from '../lib/challenges.js';
  import { formatDuration } from '../lib/format.js';
  import InfoPopover from '../lib/InfoPopover.svelte';
  import ScoringInfoContent from '../lib/ScoringInfoContent.svelte';

  interface Props {
    portalUrl: string;
    onCreated: (challengeId: string) => void;
    onBack: () => void;
  }

  let { portalUrl, onCreated, onBack }: Props = $props();

  const DURATIONS_MS = [30_000, 60_000, 90_000, 120_000, 150_000];
  const MIN_WORD_LENGTHS = [3, 4, 5];
  const SIZES = [4, 5, 6] as const;

  let friends: Friend[] = $state([]);
  let loadingFriends = $state(true);
  let friendsError: string | undefined = $state();
  let opponentId: string | undefined = $state();

  let durationMs = $state(90_000);
  let minWordLength = $state(3);
  let size: 4 | 5 | 6 = $state(5);
  let pointMode: 'standard' | 'speciale' = $state('standard');
  let positionBonus = $state(false);

  let submitting = $state(false);
  let error: string | undefined = $state();

  listFriends()
    .then((result) => (friends = result.friends))
    .catch((err) => (friendsError = err instanceof Error ? err.message : 'Amici non disponibili'))
    .finally(() => (loadingFriends = false));

  async function submit(): Promise<void> {
    if (!opponentId) return;
    submitting = true;
    error = undefined;
    try {
      const { id } = await createChallenge(opponentId, {
        size,
        durationMs,
        minWordLength,
        minWords: 50,
        scoring: 'versus',
        pointMode,
        positionBonus,
      });
      onCreated(id);
    } catch (err) {
      error = err instanceof Error ? err.message : 'Errore imprevisto';
      submitting = false;
    }
  }
</script>

<div class="page">
  <h1>Sfida un amico</h1>

  <div class="section">
    <p class="section-title">Chi sfidi</p>
    {#if loadingFriends}
      <p class="empty-text">Caricamento...</p>
    {:else if friendsError}
      <p class="error-text">{friendsError}</p>
    {:else if friends.length === 0}
      <p class="empty-text">
        Non hai ancora amici. Aggiungili dal <a href={portalUrl}>portale</a> (sezione Amici), poi torna qui.
      </p>
    {:else}
      <div class="chip-group">
        {#each friends as friend (friend.sub)}
          <button type="button" class="chip" class:selected={opponentId === friend.sub} onclick={() => (opponentId = friend.sub)}>
            {friend.username}
          </button>
        {/each}
      </div>
    {/if}
  </div>

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
        <button type="button" class="chip" class:selected={size === s} onclick={() => (size = s)}>{s}×{s}</button>
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
        <InfoPopover label="Punteggio standard"><ScoringInfoContent kind="standard" /></InfoPopover>
      </span>
      <span class="chip-with-info">
        <button type="button" class="chip" class:selected={pointMode === 'speciale'} onclick={() => (pointMode = 'speciale')}>
          Speciale
        </button>
        <InfoPopover label="Punteggio speciale"><ScoringInfoContent kind="speciale" /></InfoPopover>
      </span>
    </div>
  </div>

  <div class="section">
    <p class="section-title">Bonus posizione</p>
    <div class="chip-group">
      <button type="button" class="chip" class:selected={!positionBonus} onclick={() => (positionBonus = false)}>No</button>
      <span class="chip-with-info">
        <button type="button" class="chip" class:selected={positionBonus} onclick={() => (positionBonus = true)}>Sì</button>
        <InfoPopover label="Bonus posizione"><ScoringInfoContent kind="position-bonus" /></InfoPopover>
      </span>
    </div>
  </div>

  <p class="hint">Nella sfida, una parola trovata solo da uno dei due vale il doppio.</p>

  {#if error}
    <p class="error-text">{error}</p>
  {/if}

  <div class="actions">
    <button type="button" class="btn btn-secondary" onclick={onBack}>Indietro</button>
    <button type="button" class="btn btn-primary" disabled={!opponentId || submitting} onclick={submit}>
      {submitting ? 'Invio…' : 'Lancia la sfida'}
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
