<script lang="ts">
  import { adminLogout, deleteUser, listUsers, type AdminUser } from '../lib/admin.svelte.js';
  import AdminUserDetailScreen from './AdminUserDetailScreen.svelte';

  interface Props {
    onBack: () => void;
  }

  let { onBack }: Props = $props();

  let users: AdminUser[] = $state([]);
  let loading = $state(true);
  let error: string | undefined = $state();
  let deletingId: string | undefined = $state();
  let selectedUser: AdminUser | undefined = $state();

  function load(): void {
    loading = true;
    error = undefined;
    listUsers()
      .then((result) => (users = result))
      .catch((err) => (error = err instanceof Error ? err.message : 'Errore imprevisto'))
      .finally(() => (loading = false));
  }

  load();

  async function handleDelete(user: AdminUser, event: MouseEvent): Promise<void> {
    event.stopPropagation();
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

<div class="page admin">
  {#if selectedUser}
    <AdminUserDetailScreen user={selectedUser} onBack={() => (selectedUser = undefined)} />
  {:else}
    <div class="header">
      <button type="button" class="btn-icon" aria-label="Torna al menu admin" onclick={onBack}>&larr;</button>
      <h1>Gestione utenti</h1>
      <button type="button" class="btn btn-secondary btn-sm" onclick={adminLogout}>Esci</button>
    </div>

    {#if error}
      <p class="error-text">{error}</p>
    {/if}

    {#if loading}
      <p class="empty-text">Caricamento...</p>
    {:else}
      <ul class="users">
        {#each users as user (user.id)}
          <li class="card">
            <button type="button" class="row" onclick={() => (selectedUser = user)}>
              <div class="info">
                <span class="username">{user.username}</span>
                <span class="email">{user.email}</span>
                <span class="date">registrato il {new Date(user.createdAt).toLocaleDateString('it-IT')}</span>
              </div>
            </button>
            <button type="button" class="btn btn-danger btn-sm" disabled={deletingId === user.id} onclick={(e) => handleDelete(user, e)}>
              {deletingId === user.id ? 'Cancellazione...' : 'Cancella'}
            </button>
          </li>
        {:else}
          <p class="empty-text">Nessun utente registrato</p>
        {/each}
      </ul>
    {/if}
  {/if}
</div>

<style>
  .admin {
    width: min(94vw, 560px);
  }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    gap: 12px;
  }

  .header h1 {
    flex: 1;
    font-size: 1.2rem;
  }

  .users {
    list-style: none;
    padding: 0;
    margin: 0;
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .users li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 16px;
  }

  .row {
    flex: 1;
    display: flex;
    text-align: left;
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    min-width: 0;
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
    color: var(--color-ink-faint);
  }
</style>
