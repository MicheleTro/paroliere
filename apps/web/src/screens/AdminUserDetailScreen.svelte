<script lang="ts">
  import { getUserStats, type AdminUser, type AdminUserStats } from '../lib/admin.svelte.js';

  interface Props {
    user: AdminUser;
    onBack: () => void;
  }

  let { user, onBack }: Props = $props();

  let stats: AdminUserStats | undefined = $state();
  let loading = $state(true);
  let error: string | undefined = $state();

  $effect(() => {
    getUserStats(user.id)
      .then((result) => (stats = result))
      .catch((err) => (error = err instanceof Error ? err.message : 'Errore imprevisto'))
      .finally(() => (loading = false));
  });

  function formatDate(value: string | null): string {
    return value ? new Date(value).toLocaleString('it-IT') : '—';
  }
</script>

<div class="detail">
  <div class="header">
    <button type="button" class="secondary" onclick={onBack}>&larr; Utenti</button>
    <h1>{user.username}</h1>
  </div>
  <p class="email">{user.email} · registrato il {new Date(user.createdAt).toLocaleDateString('it-IT')}</p>

  {#if error}
    <p class="error">{error}</p>
  {:else if loading}
    <p>Caricamento...</p>
  {:else if stats}
    <section>
      <h2>Statistiche per tipologia</h2>
      {#if stats.wordStats.length === 0}
        <p class="empty">Nessuna partita registrata</p>
      {:else}
        <table>
          <thead>
            <tr>
              <th>Griglia</th>
              <th>Durata</th>
              <th>Partite</th>
              <th>Parola più lunga</th>
              <th>Media lettere</th>
              <th>Media parole/partita</th>
              <th>Ultima partita</th>
            </tr>
          </thead>
          <tbody>
            {#each stats.wordStats as row (`${row.gridSize}-${row.durationMs}`)}
              <tr>
                <td>{row.gridSize}x{row.gridSize}</td>
                <td>{Math.round(row.durationMs / 1000)}s</td>
                <td>{row.gamesPlayed}</td>
                <td>{row.longestWord ? `${row.longestWord} (${row.longestWordLength})` : '—'}</td>
                <td>{row.averageWordLength.toFixed(1)}</td>
                <td>{row.averageWordsPerGame.toFixed(1)}</td>
                <td>{formatDate(row.lastPlayedAt)}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      {/if}
    </section>

    <section>
      <h2>Partite recenti</h2>
      {#if stats.recentGames.length === 0}
        <p class="empty">Nessuna partita registrata</p>
      {:else}
        <table>
          <thead>
            <tr>
              <th>Data</th>
              <th>Griglia</th>
              <th>Durata</th>
              <th>Punteggio</th>
              <th>Parole</th>
              <th>Tipo</th>
            </tr>
          </thead>
          <tbody>
            {#each stats.recentGames as game (game.id)}
              <tr>
                <td>{formatDate(game.startedAt)}</td>
                <td>{game.size}x{game.size}</td>
                <td>{Math.round(game.durationMs / 1000)}s</td>
                <td>{game.score}</td>
                <td>{game.wordCount}</td>
                <td>{game.source === 'challenge' ? 'sfida' : 'allenamento'}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      {/if}
    </section>
  {/if}
</div>

<style>
  .detail {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
    width: min(90vw, 640px);
  }

  .header {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  h1 {
    font-size: 1.2rem;
    margin: 0;
  }

  h2 {
    font-size: 1rem;
    margin: 0 0 8px;
  }

  .email {
    font-size: 0.85rem;
    opacity: 0.75;
    margin: 0;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.85rem;
  }

  th,
  td {
    text-align: left;
    padding: 6px 8px;
    border-bottom: 1px solid var(--color-border);
  }

  .empty {
    opacity: 0.7;
  }

  .error {
    color: var(--color-danger);
    margin: 0;
  }

  .secondary {
    font-size: 0.9rem;
    padding: 6px 12px;
    border-radius: var(--radius-md);
    border: 2px solid var(--color-border);
    background: var(--color-surface);
    color: var(--color-ink);
    cursor: pointer;
    flex-shrink: 0;
  }
</style>
