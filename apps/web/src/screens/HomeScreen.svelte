<script lang="ts">
  interface Props {
    ready: boolean;
    record: number;
    onNewGame: () => void;
  }

  let { ready, record, onNewGame }: Props = $props();
</script>

<div class="home">
  <p class="record">Record: {record}</p>
  <button type="button" disabled={!ready} onclick={onNewGame}>
    {ready ? 'Nuova partita' : 'Caricamento dizionario...'}
  </button>
</div>

<style>
  .home {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
  }

  .record {
    font-size: 1.1rem;
  }

  button {
    font-size: 1.1rem;
    padding: 12px 24px;
    border-radius: var(--radius-md);
    border: none;
    background: var(--color-accent);
    color: var(--color-accent-contrast);
    cursor: pointer;
  }

  button:disabled {
    background: var(--color-disabled);
    color: var(--color-ink-soft);
    cursor: default;
  }
</style>
