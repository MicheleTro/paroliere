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
    <button type="button" class="btn btn-secondary btn-sm" onclick={onBack}>&larr; Utenti</button>
    <h1>{user.username}</h1>
  </div>
  <p class="email">registrato il {new Date(user.createdAt).toLocaleDateString('it-IT')} · ultimo accesso {new Date(user.lastSeenAt).toLocaleDateString('it-IT')}</p>

  {#if error}
    <p class="error-text">{error}</p>
  {:else if loading}
    <p class="empty-text">Caricamento...</p>
  {:else if stats}
    <section class="card">
      <h2>Progresso</h2>
      <p>
        Livello {stats.profile.level} · {stats.profile.totalXp} XP · {stats.profile.words} parole · {stats.profile.gamesPlayed} partite
      </p>
      <p>
        Serie {stats.profile.streakDays}/10 · cicli completati {stats.profile.streakCycles} · oggetti: {stats.profile.items.length === 0 ? 'nessuno' : stats.profile.items.map((i) => i.name + " ×" + i.quantity).join(", ")}
        {#if stats.profile.longestWord}· parola più lunga: {stats.profile.longestWord}{/if}
      </p>
      <p>Medaglie: {stats.profile.medals.length === 0 ? 'nessuna' : stats.profile.medals.join(', ')}</p>
    </section>

    <section class="card">
      <h2>Partite recenti</h2>
      {#if stats.recentPlays.length === 0}
        <p class="empty-text">Nessuna partita registrata</p>
      {:else}
        <table>
          <thead>
            <tr>
              <th>Data</th>
              <th>Modalità</th>
              <th>Griglia</th>
              <th>Durata</th>
              <th>Punteggio</th>
              <th>Parole</th>
              <th>Stato</th>
            </tr>
          </thead>
          <tbody>
            {#each stats.recentPlays as play (play.id)}
              <tr>
                <td>{formatDate(play.startedAt)}</td>
                <td>{play.mode}</td>
                <td>{play.size}x{play.size}</td>
                <td>{Math.round(play.durationMs / 1000)}s</td>
                <td>{play.score}</td>
                <td>{play.wordCount}</td>
                <td>{play.status === 'started' ? 'in corso' : play.status === 'abandoned' ? 'abbandonata' : 'finita'}</td>
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
    gap: 14px;
    width: min(90vw, 640px);
  }

  .header {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  h2 {
    font-size: 1rem;
    margin: 0 0 10px;
  }

  .email {
    font-size: 0.85rem;
    color: var(--color-ink-faint);
    margin: 0;
  }

  section {
    overflow-x: auto;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.85rem;
  }

  th,
  td {
    text-align: left;
    padding: 8px 10px;
    border-bottom: 1px solid var(--color-border);
  }

  th {
    color: var(--color-ink-faint);
    font-weight: 700;
  }
</style>
