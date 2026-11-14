<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    title: string;
    /** Testo del pulsante di chiusura. */
    action?: string;
    onClose: () => void;
    children: Snippet;
  }

  let { title, action = 'Continua', onClose, children }: Props = $props();

  let panel: HTMLDivElement | undefined = $state();

  $effect(() => {
    panel?.querySelector<HTMLElement>('button')?.focus({ preventScroll: true });
  });
</script>

<div class="scrim centered" role="presentation">
  <div class="sheet mid" role="dialog" aria-modal="true" aria-label={title} bind:this={panel}>
    <h1>{title}</h1>
    {@render children()}
    <button type="button" class="btn btn-gold btn-big btn-block" onclick={onClose}>{action}</button>
  </div>
</div>

<style>
  h1 {
    font-size: 2rem;
  }
</style>
