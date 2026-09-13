<script lang="ts">
  interface Props {
    ready: boolean;
    record: number;
    username: string;
    onNewGame: () => void;
    onLogout: () => void;
  }

  let { ready, record, username, onNewGame, onLogout }: Props = $props();
</script>

<div class="home">
  <h1>Paroliere</h1>
  <p class="user">
    {username}
    <button type="button" class="link" onclick={onLogout}>Esci</button>
  </p>
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

  .user {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.9rem;
    color: #b5c2cd;
  }

  .link {
    font-size: 0.9rem;
    padding: 0;
    border: none;
    background: none;
    color: #4a90d9;
    text-decoration: underline;
    cursor: pointer;
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
