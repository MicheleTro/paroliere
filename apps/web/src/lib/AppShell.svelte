<script module lang="ts">
  export type MainTab = 'home' | 'challenges' | 'history';
</script>

<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    username: string;
    active: MainTab;
    onSelectTab: (tab: MainTab) => void;
    onLogout: () => void;
    children: Snippet;
  }

  let { username, active, onSelectTab, onLogout, children }: Props = $props();

  const TABS: { id: MainTab; label: string }[] = [
    { id: 'home', label: 'Gioca' },
    { id: 'challenges', label: 'Sfide' },
    { id: 'history', label: 'Storico' },
  ];
</script>

<div class="shell">
  <header>
    <h1>Paroliere</h1>
    <div class="account">
      <span>{username}</span>
      <button type="button" class="link" onclick={onLogout}>Esci</button>
    </div>
  </header>

  <div class="content">
    {@render children()}
  </div>

  <nav class="tabs">
    {#each TABS as tab (tab.id)}
      <button type="button" class:active={active === tab.id} onclick={() => onSelectTab(tab.id)}>
        {tab.label}
      </button>
    {/each}
  </nav>
</div>

<style>
  .shell {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    width: min(90vw, 420px);
  }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
  }

  header h1 {
    margin: 0;
    font-size: 1.4rem;
  }

  .account {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.85rem;
    color: #b5c2cd;
  }

  .link {
    font-size: 0.85rem;
    padding: 0;
    border: none;
    background: none;
    color: #4a90d9;
    text-decoration: underline;
    cursor: pointer;
  }

  .content {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .tabs {
    display: flex;
    gap: 8px;
    width: 100%;
  }

  .tabs button {
    flex: 1;
    font-size: 1rem;
    padding: 10px 0;
    border-radius: 8px;
    border: 2px solid #2c4256;
    background: #1c2b3a;
    color: #f5f5f5;
    cursor: pointer;
  }

  .tabs button.active {
    border-color: #4a90d9;
    background: #4a90d9;
  }
</style>
