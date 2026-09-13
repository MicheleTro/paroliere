<script lang="ts">
  interface Props {
    ready: boolean;
    onNewGame: () => void;
    onChallenges: () => void;
  }

  let { ready, onNewGame, onChallenges }: Props = $props();
</script>

<div class="home">
  <button type="button" class="big" disabled={!ready} onclick={onNewGame}>
    {ready ? 'Allenamento' : 'Caricamento dizionario...'}
  </button>
  <button type="button" class="big" onclick={onChallenges}>Sfide</button>
</div>

<style>
  .home {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 16px;
    width: min(90vw, 320px);
  }

  .big {
    font-size: 1.4rem;
    padding: 24px;
    border-radius: var(--radius-md);
    border: none;
    background: var(--color-accent);
    color: var(--color-accent-contrast);
    cursor: pointer;
  }

  .big:disabled {
    background: var(--color-disabled);
    color: var(--color-ink-soft);
    cursor: default;
  }
</style>
