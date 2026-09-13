<script lang="ts">
  import { adminLogout, deleteUser, listUsers, type AdminUser } from '../lib/admin.svelte.js';

  let users: AdminUser[] = $state([]);
  let loading = $state(true);
  let error: string | undefined = $state();
  let deletingId: string | undefined = $state();

  function load(): void {
    loading = true;
    error = undefined;
    listUsers()
      .then((result) => (users = result))
      .catch((err) => (error = err instanceof Error ? err.message : 'Errore imprevisto'))
      .finally(() => (loading = false));
  }

  load();

  async function handleDelete(user: AdminUser): Promise<void> {
    if (!confirm(`Cancellare l'utente "${user.username}"? L'operazione non si può annullare.`)) return;
    error = undefined;
    deletingId = user.id;
    try {
      await deleteUser(user.id);
      users = users.filter((u) => u.id !== user.id);
    } catch (err) {
      error = err instanceof Error ? err.message : 'Errore imprevisto';
    } finally {
      deletingId = undefined;
    }
  }
</script>

<div class="admin">
  <div class="header">
    <h1>Amministrazione utenti</h1>
    <button type="button" class="secondary" onclick={adminLogout}>Esci</button>
  </div>

  {#if error}
    <p class="error">{error}</p>
  {/if}

  {#if loading}
    <p>Caricamento...</p>
  {:else}
    <ul class="users">
      {#each users as user (user.id)}
        <li>
          <div class="info">
            <span class="username">{user.username}</span>
            <span class="email">{user.email}</span>
            <span class="date">registrato il {new Date(user.createdAt).toLocaleDateString('it-IT')}</span>
          </div>
          <button type="button" class="danger" disabled={deletingId === user.id} onclick={() => handleDelete(user)}>
            {deletingId === user.id ? 'Cancellazione...' : 'Cancella'}
          </button>
        </li>
      {:else}
        <p class="empty">Nessun utente registrato</p>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .admin {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    width: min(90vw, 480px);
  }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    gap: 12px;
  }

  h1 {
    font-size: 1.2rem;
    margin: 0;
  }

  .users {
    list-style: none;
    padding: 0;
    margin: 0;
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .users li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 8px 12px;
    border-radius: var(--radius-md);
    border: 2px solid var(--color-border);
  }

  .info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .username {
    font-weight: 700;
  }

  .email,
  .date {
    font-size: 0.8rem;
    opacity: 0.75;
  }

  .empty {
    opacity: 0.7;
  }

  .secondary,
  .danger {
    font-size: 0.9rem;
    padding: 6px 12px;
    border-radius: var(--radius-md);
    border: 2px solid var(--color-border);
    background: var(--color-surface);
    color: var(--color-ink);
    cursor: pointer;
    flex-shrink: 0;
  }

  .danger {
    border-color: var(--color-danger);
    color: var(--color-danger);
    background: transparent;
  }

  .danger:disabled,
  .secondary:disabled {
    opacity: 0.5;
    cursor: default;
  }

  .error {
    color: var(--color-danger);
    margin: 0;
  }
</style>
