<script lang="ts">
  interface Props {
    ready: boolean;
    onNewGame: () => void;
    onChallenges: () => void;
  }

  let { ready, onNewGame, onChallenges }: Props = $props();
</script>

<div class="page home">
  <button type="button" class="tile tile-primary" disabled={!ready} onclick={onNewGame}>
    <span class="icon">🎲</span>
    <span class="label">{ready ? 'Allenamento' : 'Caricamento dizionario...'}</span>
    <span class="hint">Partita rapida in singolo</span>
  </button>

  <button type="button" class="tile tile-secondary" onclick={onChallenges}>
    <span class="icon">⚔️</span>
    <span class="label">Sfide</span>
    <span class="hint">Gioca contro amici e squadre</span>
  </button>
</div>

<style>
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
