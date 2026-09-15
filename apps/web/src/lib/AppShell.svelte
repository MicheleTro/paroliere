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

  const initial = $derived(username.charAt(0).toUpperCase() || '?');
</script>

<div class="shell">
  <header>
    <div class="left">
      {#if showHome}
        <button type="button" class="btn-icon" aria-label="Torna alla home" onclick={onHome}>&larr;</button>
      {:else}
        <span class="logo">🔤</span>
        <h1>Paroliere</h1>
      {/if}
    </div>
    <div class="account">
      <span class="avatar">{initial}</span>
      <span class="username">{username}</span>
      <button type="button" class="btn-icon logout" aria-label="Esci" onclick={onLogout}>⏻</button>
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
    width: 100%;
    min-height: 100vh;
    padding-bottom: calc(24px + var(--safe-bottom));
  }

  header {
    position: sticky;
    top: 0;
    z-index: 10;
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: calc(14px + var(--safe-top)) max(16px, calc((100vw - 440px) / 2 + 16px)) 14px;
    background: rgba(243, 244, 251, 0.82);
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
    border-bottom: 1px solid var(--color-border);
  }

  .left {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .logo {
    font-size: 1.3rem;
    line-height: 1;
  }

  header h1 {
    font-size: 1.15rem;
  }

  .account {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .avatar {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: var(--radius-pill);
    background: linear-gradient(135deg, var(--color-accent), var(--color-accent-soft));
    color: var(--color-accent-contrast);
    font-size: 0.85rem;
    font-weight: 700;
  }

  .username {
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--color-ink-soft);
    max-width: 90px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .logout {
    width: 36px;
    height: 36px;
    font-size: 0.95rem;
    color: var(--color-ink-soft);
  }

  .content {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 4px 16px 0;
  }
</style>
