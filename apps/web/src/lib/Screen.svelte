<script lang="ts">
  import Svg from './Svg.svelte';
  import type { Snippet } from 'svelte';
  import { ICONS } from './icons.js';

  interface Props {
    /** Mostra il pulsante per tornare indietro. */
    onBack?: () => void;
    backLabel?: string;
    /** Titolo al centro della barra (le schermate che hanno già il loro non lo usano). */
    title?: string;
    /** Elemento a destra della barra (es. ingranaggio). */
    right?: Snippet;
    children: Snippet;
  }

  let { onBack, backLabel = 'Indietro', title, right, children }: Props = $props();
</script>

<div class="screen pattern">
  {#if onBack || title || right}
    <div class="top">
      {#if onBack}
        <button type="button" class="x round-x" aria-label={backLabel} onclick={onBack}><Svg svg={ICONS.back} /></button>
      {:else}
        <span class="spacer"></span>
      {/if}
      <div class="title">{title ?? ''}</div>
      {#if right}{@render right()}{:else}<span class="spacer"></span>{/if}
    </div>
  {/if}
  <div class="content">
    {@render children()}
  </div>
</div>

<style>
  .round-x {
    width: 44px;
    height: 44px;
  }

  .round-x :global(svg) {
    width: 22px;
    height: 22px;
  }
</style>
