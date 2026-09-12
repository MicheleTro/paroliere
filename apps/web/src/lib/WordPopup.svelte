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
    border-radius: 10px;
    border: 3px solid;
    background: #16222d;
  }

  .popup.green {
    border-color: #2ecc71;
  }

  .popup.yellow {
    border-color: #f1c40f;
  }

  .popup.red {
    border-color: #e74c3c;
  }

  .word {
    font-size: 1.4rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    color: #f5f5f5;
  }

  .subtitle {
    font-size: 0.85rem;
    color: #f5f5f5;
    opacity: 0.8;
  }
</style>
