<script lang="ts">
  import type { WordPopupData } from './word-popup.js';

  interface Props {
    popup: WordPopupData | null;
  }

  let { popup }: Props = $props();
</script>

<div class="slot">
  {#if popup}
    <div class="popup" class:green={popup.tone === 'green'} class:yellow={popup.tone === 'yellow'} class:red={popup.tone === 'red'}>
      <span class="word">{popup.word.toUpperCase()}</span>
      {#if popup.subtitle}
        <span class="subtitle">{popup.subtitle}</span>
      {/if}
    </div>
  {/if}
</div>

<style>
  .slot {
    height: 4.6rem;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .popup {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 8px 20px;
    border-radius: var(--radius-md);
    border: 3px solid;
    background: var(--color-surface);
    box-shadow: var(--shadow-card);
  }

  .popup.green {
    border-color: var(--color-success);
  }

  .popup.yellow {
    border-color: var(--color-warning);
  }

  .popup.red {
    border-color: var(--color-danger);
  }

  .word {
    font-family: var(--font-heading);
    font-size: 1.4rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    color: var(--color-ink);
  }

  .subtitle {
    font-size: 0.85rem;
    color: var(--color-ink-soft);
  }
</style>
