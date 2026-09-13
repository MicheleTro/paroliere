<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    username: string;
    showHome: boolean;
    onHome: () => void;
    onLogout: () => void;
    children: Snippet;
  }

  let { username, showHome, onHome, onLogout, children }: Props = $props();
</script>

<div class="shell">
  <header>
    {#if showHome}
      <button type="button" class="home" onclick={onHome}>🏠 Home</button>
    {:else}
      <h1>Paroliere</h1>
    {/if}
    <div class="account">
      <span>{username}</span>
      <button type="button" class="link" onclick={onLogout}>Esci</button>
    </div>
  </header>

  <div class="content">
    {@render children()}
  </div>
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

  .home {
    font-size: 1rem;
    padding: 6px 12px;
    border-radius: var(--radius-md);
    border: 2px solid var(--color-border);
    background: var(--color-surface);
    color: var(--color-ink);
    cursor: pointer;
  }
</style>
