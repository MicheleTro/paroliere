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
    color: var(--color-ink-soft);
  }

  .link {
    font-size: 0.85rem;
    padding: 0;
    border: none;
    background: none;
    color: var(--color-accent);
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
    border-radius: var(--radius-md);
    border: 2px solid var(--color-border);
    background: var(--color-surface);
    color: var(--color-ink-soft);
    cursor: pointer;
  }

  .tabs button.active {
    border-color: var(--color-accent);
    background: var(--color-accent);
    color: var(--color-accent-contrast);
  }
</style>
