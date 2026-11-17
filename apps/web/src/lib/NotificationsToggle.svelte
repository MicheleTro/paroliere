<script lang="ts">
  import { enableNotifications, live } from './live.svelte.js';
</script>

{#if live.permission === 'default'}
  <button type="button" class="notify-toggle" onclick={enableNotifications}>
    🔔 Attiva le notifiche delle sfide
  </button>
{:else if live.permission === 'denied'}
  <p class="notify-denied">Notifiche bloccate: puoi riattivarle dalle impostazioni del browser.</p>
{/if}

<style>
  .notify-toggle {
    width: 100%;
    padding: 10px 14px;
    border: 1.5px dashed var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-surface);
    color: var(--color-ink-soft);
    font-weight: 700;
    font-size: 0.85rem;
    cursor: pointer;
  }

  .notify-denied {
    margin: 0;
    font-size: 0.78rem;
    text-align: center;
    color: var(--color-ink-faint);
  }
</style>
