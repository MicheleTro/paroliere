<script lang="ts">
  import { createChallenge, listFriends, type Friend } from '../lib/challenges.js';
  import GameOptions, { DEFAULT_OPTIONS, type GameOptionValues } from '../lib/GameOptions.svelte';

  interface Props {
    portalUrl: string;
    onCreated: (challengeId: string) => void;
    onBack: () => void;
  }

  let { portalUrl, onCreated, onBack }: Props = $props();

  let friends: Friend[] = $state([]);
  let loadingFriends = $state(true);
  let friendsError: string | undefined = $state();
  let opponentId: string | undefined = $state();

  let options: GameOptionValues = $state({ ...DEFAULT_OPTIONS });

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
        ...options,
        minWords: 50,
        scoring: 'versus',
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

  <div class="options scroll-box">
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
      <div class="chip-group friends">
        {#each friends as friend (friend.sub)}
          <button type="button" class="chip" class:selected={opponentId === friend.sub} onclick={() => (opponentId = friend.sub)}>
            {friend.username}
          </button>
        {/each}
      </div>
    {/if}
  </div>

  <GameOptions bind:options />

  <p class="hint">Nella sfida, una parola trovata solo da uno dei due vale il doppio.</p>
  </div>

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
    font-weight: 800;
    text-align: center;
    color: #fff;
    text-shadow: 0 2px 0 var(--ink);
  }

  .friends {
    max-height: 18dvh;
    overflow-y: auto;
    overscroll-behavior: contain;
  }

  .options {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .actions {
    display: flex;
    flex-shrink: 0;
    gap: 10px;
    margin-top: 4px;
  }

  .actions .btn {
    flex: 1;
  }
</style>
