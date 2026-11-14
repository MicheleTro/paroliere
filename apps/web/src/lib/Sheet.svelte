<script lang="ts">
  import Svg from './Svg.svelte';
  import type { Snippet } from 'svelte';
  import { ICONS } from './icons.js';

  interface Props {
    title: string;
    /** Foglio centrato (conferme, spiegazioni) invece che dal basso. */
    mid?: boolean;
    onClose: () => void;
    /** Pulsante "i" accanto al titolo. */
    onInfo?: () => void;
    /** Elemento a sinistra del titolo (icona o segno). */
    badge?: Snippet;
    /** Sottotitolo sotto il titolo. */
    subtitle?: string;
    children: Snippet;
  }

  let { title, mid = false, onClose, onInfo, badge, subtitle, children }: Props = $props();

  let sheetEl: HTMLDivElement | undefined = $state();

  // Il focus entra nel foglio e Esc lo chiude
  $effect(() => {
    sheetEl?.querySelector<HTMLElement>('button:not(.info)')?.focus({ preventScroll: true });
  });

  function onKey(event: KeyboardEvent): void {
    if (event.key === 'Escape') onClose();
  }
</script>

<svelte:window onkeydown={onKey} />

<div
  class="scrim"
  class:centered={mid}
  role="presentation"
  onpointerdown={(e) => {
    if (e.target === e.currentTarget) onClose();
  }}
>
  <div class="sheet" class:mid role="dialog" aria-modal="true" aria-label={title} bind:this={sheetEl}>
    <div class="sheet-head">
      {#if badge}{@render badge()}{/if}
      <div class="grow">
        <h2>{title}</h2>
        {#if subtitle}<span class="muted">{subtitle}</span>{/if}
      </div>
      {#if onInfo}<button type="button" class="info" aria-label="Maggiori informazioni" onclick={onInfo}>i</button>{/if}
      <button type="button" class="x" aria-label="Chiudi" onclick={onClose}><Svg svg={ICONS.close} /></button>
    </div>
    <div class="sheet-body">
      {@render children()}
    </div>
  </div>
</div>
