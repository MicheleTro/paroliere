<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    label: string;
    children: Snippet;
  }

  let { label, children }: Props = $props();
  let open = $state(false);

  function toggle(): void {
    open = !open;
  }

  function close(): void {
    open = false;
  }
</script>

<button
  type="button"
  class="info-btn"
  class:active={open}
  aria-label={`Informazioni: ${label}`}
  aria-expanded={open}
  onclick={toggle}
>
  i
</button>

{#if open}
  <button type="button" class="info-backdrop" aria-label="Chiudi" onclick={close}></button>
  <div class="info-bubble" role="note">
    <button type="button" class="info-close" aria-label="Chiudi" onclick={close}>✕</button>
    <div class="info-bubble-content">
      {@render children()}
    </div>
  </div>
{/if}

<style>
  .info-btn {
    width: 18px;
    height: 18px;
    flex-shrink: 0;
    border-radius: var(--radius-pill);
    border: none;
    background: var(--color-accent-wash);
    color: var(--color-accent);
    font-size: 0.66rem;
    font-weight: 800;
    font-style: italic;
    line-height: 1;
    padding: 0;
    cursor: pointer;
  }

  .info-btn.active {
    background: var(--color-accent);
    color: var(--color-accent-contrast);
  }

  .info-backdrop {
    position: fixed;
    inset: 0;
    z-index: 30;
    border: none;
    background: rgba(25, 26, 36, 0.4);
    padding: 0;
    cursor: default;
    animation: fade-in 0.12s ease-out;
  }

  .info-bubble {
    position: fixed;
    z-index: 31;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    width: min(86vw, 320px);
    max-height: 80dvh;
    overflow-y: auto;
    padding: 18px 18px 16px;
    border-radius: var(--radius-lg);
    background: var(--color-ink);
    color: var(--color-surface);
    box-shadow: var(--shadow-float);
    animation: pop-in 0.14s ease-out;
  }

  .info-bubble-content {
    font-size: 0.85rem;
    font-weight: 500;
    line-height: 1.5;
  }

  .info-close {
    position: absolute;
    top: 10px;
    right: 10px;
    width: 26px;
    height: 26px;
    border-radius: var(--radius-pill);
    border: none;
    background: rgba(255, 255, 255, 0.14);
    color: var(--color-surface);
    font-size: 0.8rem;
    cursor: pointer;
  }

  @keyframes fade-in {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  @keyframes pop-in {
    from {
      opacity: 0;
      transform: translate(-50%, -50%) scale(0.92);
    }
    to {
      opacity: 1;
      transform: translate(-50%, -50%) scale(1);
    }
  }
</style>
