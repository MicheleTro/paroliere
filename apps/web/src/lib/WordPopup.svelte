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
    height: 4rem;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .popup {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1px;
    padding: 8px 22px;
    border-radius: var(--radius-pill);
    background: var(--color-surface);
    box-shadow: var(--shadow-float);
    animation: pop-in 0.16s ease-out;
  }

  @keyframes pop-in {
    from {
      transform: scale(0.85) translateY(4px);
      opacity: 0;
    }
    to {
      transform: scale(1) translateY(0);
      opacity: 1;
    }
  }

  .popup.green {
    background: var(--color-success-wash);
  }

  .popup.green .word {
    color: var(--color-success);
  }

  .popup.yellow {
    background: var(--color-warning-wash);
  }

  .popup.yellow .word {
    color: var(--color-warning);
  }

  .popup.red {
    background: var(--color-danger-wash);
  }

  .popup.red .word {
    color: var(--color-danger);
  }

  .word {
    font-size: 1.3rem;
    font-weight: 800;
    letter-spacing: 0.03em;
    color: var(--color-ink);
  }

  .subtitle {
    font-size: 0.78rem;
    font-weight: 600;
    color: var(--color-ink-soft);
  }
</style>
