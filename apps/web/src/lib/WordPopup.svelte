<script lang="ts">
  import { displayWord } from './display.js';
  import type { WordPopupData } from './word-popup.js';

  interface Props {
    popup: WordPopupData | null;
  }

  let { popup }: Props = $props();
</script>

<div class="slot" aria-live="polite">
  {#if popup}
    <div class="fb" class:ok={popup.tone === 'green'} class:dup={popup.tone === 'yellow'} class:no={popup.tone === 'red'}>
      <span class="word">{displayWord(popup.word).toUpperCase()}</span>
      {#if popup.subtitle}<span class="subtitle">{popup.subtitle}</span>{/if}
    </div>
  {/if}
</div>

<style>
  .slot {
    height: 3rem;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .fb {
    display: flex;
    align-items: baseline;
    gap: 8px;
    font-family: var(--f-display);
    font-size: 1.05rem;
    padding: 4px 14px;
    border-radius: 12px;
    border: 3px solid var(--ink);
    animation: pop-in 0.16s ease-out;
  }

  .fb.ok {
    background: var(--mint);
  }

  .fb.dup {
    background: var(--gold);
  }

  .fb.no {
    background: var(--coral);
    color: #fff;
  }

  .word {
    letter-spacing: 0.03em;
  }

  .subtitle {
    font-size: 0.8rem;
    opacity: 0.9;
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
</style>
