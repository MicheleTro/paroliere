<script lang="ts">
  import { adminLogout } from '../lib/admin.svelte.js';
  import AdminUsersScreen from './AdminUsersScreen.svelte';
  import AdminWordsScreen from './AdminWordsScreen.svelte';

  type View = 'menu' | 'users' | 'words';

  let view: View = $state('menu');
</script>

{#if view === 'users'}
  <AdminUsersScreen onBack={() => (view = 'menu')} />
{:else if view === 'words'}
  <AdminWordsScreen onBack={() => (view = 'menu')} />
{:else}
  <div class="page menu">
    <div class="header">
      <h1>Amministrazione</h1>
      <button type="button" class="btn btn-secondary btn-sm" onclick={adminLogout}>Esci</button>
    </div>

    <button type="button" class="tile" onclick={() => (view = 'users')}>
      <span class="icon">👤</span>
      <span class="label">Gestione utenti</span>
      <span class="hint">Elenco, statistiche e cancellazione account</span>
    </button>

    <button type="button" class="tile" onclick={() => (view = 'words')}>
      <span class="icon">📝</span>
      <span class="label">Gestione parole</span>
      <span class="hint">Parole segnalate dai giocatori come mancanti</span>
    </button>
  </div>
{/if}

<style>
  .menu {
    width: min(94vw, 420px);
  }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    gap: 12px;
    margin-bottom: 4px;
  }

  .tile {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
    width: 100%;
    padding: 20px 22px;
    border-radius: var(--radius-lg);
    border: none;
    background: var(--color-surface);
    box-shadow: var(--shadow-card);
    color: var(--color-ink);
    cursor: pointer;
    text-align: left;
    transition: transform 0.12s ease;
  }

  .tile:active {
    transform: scale(0.98);
  }

  .icon {
    font-size: 1.6rem;
    line-height: 1;
    margin-bottom: 4px;
  }

  .label {
    font-size: 1.1rem;
    font-weight: 800;
  }

  .hint {
    font-size: 0.82rem;
    font-weight: 500;
    color: var(--color-ink-faint);
  }
</style>
