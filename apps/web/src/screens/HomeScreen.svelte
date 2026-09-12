<script lang="ts">
  interface Props {
    ready: boolean;
    record: number;
    onNewGame: () => void;
  }

  let { ready, record, onNewGame }: Props = $props();
</script>

<div class="home">
  <h1>Paroliere</h1>
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
    border-radius: 8px;
    border: none;
    background: #4a90d9;
    color: white;
    cursor: pointer;
  }

  button:disabled {
    background: #7a8a99;
    cursor: default;
  }
</style>
