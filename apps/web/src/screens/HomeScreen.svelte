<script lang="ts">
  import { getNotifications, type Notifications } from '../lib/challenges.js';

  interface Props {
    portalUrl?: string;
    ready: boolean;
    onNewGame: () => void;
    onChallenges?: () => void;
    onHistory?: () => void;
    onAdmin?: () => void;
  }

  let { ready, portalUrl, onNewGame, onChallenges, onHistory, onAdmin }: Props = $props();

  // Da fare: inviti, partite da giocare, richieste di amicizia. Se il server non risponde, nessun avviso.
  let notifications: Notifications | undefined = $state();
  getNotifications()
    .then((result) => (notifications = result))
    .catch(() => {});
  const toDo = $derived((notifications?.invites ?? 0) + (notifications?.toPlay ?? 0));
  const friendRequests = $derived(notifications?.friendRequests ?? 0);
</script>

<div class="page home">
  <button type="button" class="tile tile-primary" disabled={!ready} onclick={onNewGame}>
    <span class="icon">🎲</span>
    <span class="label">{ready ? 'Allenamento' : 'Caricamento dizionario...'}</span>
    <span class="hint">Partita rapida in singolo</span>
  </button>

  {#if onChallenges}
    <button type="button" class="tile tile-secondary" onclick={onChallenges}>
      <span class="icon">⚔️</span>
      <span class="label">Sfide{#if toDo > 0} <span class="count" aria-label="{toDo} da fare">{toDo}</span>{/if}</span>
      <span class="hint">
        {#if notifications && notifications.invites > 0}
          {notifications.invites} {notifications.invites === 1 ? 'invito' : 'inviti'} da accettare
        {:else if notifications && notifications.toPlay > 0}
          {notifications.toPlay} {notifications.toPlay === 1 ? 'sfida' : 'sfide'} da giocare
        {:else}
          Sfida un tuo amico
        {/if}
      </span>
    </button>
    {#if friendRequests > 0 && portalUrl}
      <a class="friend-requests" href={portalUrl}>
        {friendRequests} {friendRequests === 1 ? 'richiesta di amicizia' : 'richieste di amicizia'} nel portale
      </a>
    {/if}
  {/if}

  {#if onAdmin}
    <button type="button" class="tile tile-secondary" onclick={onAdmin}>
      <span class="icon">🛠️</span>
      <span class="label">Amministrazione</span>
      <span class="hint">Utenti e parole segnalate</span>
    </button>
  {/if}

  {#if onHistory}
    <button type="button" class="tile tile-secondary" onclick={onHistory}>
      <span class="icon">📜</span>
      <span class="label">Storico</span>
      <span class="hint">Le tue partite su questo dispositivo</span>
    </button>
  {/if}
</div>

<style>
  .count {
    display: inline-block;
    min-width: 1.4em;
    margin-left: 6px;
    padding: 0 6px;
    border-radius: var(--radius-pill);
    background: var(--color-stamp);
    color: var(--color-ink);
    font-size: 0.85rem;
    text-align: center;
  }

  .friend-requests {
    margin-top: -6px;
    padding: 10px 16px;
    border-radius: var(--radius-md);
    background: var(--color-accent-wash);
    color: var(--color-accent);
    font-size: 0.9rem;
    font-weight: 700;
    text-align: center;
    text-decoration: none;
  }

  .home {
    gap: 14px;
    margin-top: 12px;
  }

  .tile {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
    width: 100%;
    padding: 22px 24px;
    border-radius: var(--radius-lg);
    border: none;
    cursor: pointer;
    text-align: left;
    transition: transform 0.12s ease, box-shadow 0.12s ease, opacity 0.12s ease;
  }

  .tile:active {
    transform: scale(0.98);
  }

  .tile:disabled {
    cursor: default;
    transform: none;
    opacity: 0.6;
  }

  .icon {
    font-size: 1.8rem;
    line-height: 1;
    margin-bottom: 6px;
  }

  .label {
    font-size: 1.25rem;
    font-weight: 800;
  }

  .hint {
    font-size: 0.85rem;
    font-weight: 500;
    opacity: 0.85;
  }

  .tile-primary {
    background: linear-gradient(135deg, var(--color-accent), var(--color-accent-soft));
    color: var(--color-accent-contrast);
    box-shadow: var(--shadow-pop);
  }

  .tile-secondary {
    background: var(--color-surface);
    color: var(--color-ink);
    box-shadow: var(--shadow-card);
  }

  .tile-secondary .icon {
    filter: none;
  }
</style>
