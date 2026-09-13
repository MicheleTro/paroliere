<script lang="ts">
  import { listGames, type GameRecord } from '../lib/history.js';
  import { formatDuration } from '../lib/format.js';

  let games: GameRecord[] = $state([]);
  let loading = $state(true);

  listGames()
    .then((result) => (games = result))
    .finally(() => (loading = false));

  function formatDate(playedAt: number): string {
    return new Date(playedAt).toLocaleString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
</script>

<div class="history">
  <h1>Storico</h1>

  {#if loading}
    <p>Caricamento...</p>
  {:else if games.length === 0}
    <p>Nessuna partita giocata ancora.</p>
  {:else}
    <ul>
      {#each games as game (game.id)}
        <li>
          <div class="row">
            <span class="score">{game.score} punti</span>
            <span class="date">{formatDate(game.playedAt)}</span>
          </div>
          <span class="config">
            {game.config.size}×{game.config.size} · {formatDuration(game.config.durationMs)} · min
            {game.config.minWordLength} lettere · {game.foundWords.length}/{game.totalWords} parole
          </span>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .history {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    width: 100%;
  }

  ul {
    list-style: none;
    padding: 0;
    margin: 0;
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  li {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 12px 16px;
    border-radius: 8px;
    border: 2px solid #2c4256;
    background: #1c2b3a;
    color: #f5f5f5;
  }

  .row {
    display: flex;
    justify-content: space-between;
    gap: 8px;
  }

  .score {
    font-weight: 700;
  }

  .date {
    opacity: 0.8;
    font-size: 0.9rem;
  }

  .config {
    font-size: 0.85rem;
    opacity: 0.85;
  }
</style>
