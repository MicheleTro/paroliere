<script lang="ts">
  import type { Snippet } from 'svelte';

  // Conferma in stile del gioco (al posto del `confirm()` del sistema): due scelte, quella sicura in evidenza.
  interface Props {
    title: string;
    /** Testo del pulsante che conferma l'azione (pericolosa). */
    confirmLabel: string;
    cancelLabel?: string;
    onConfirm: () => void;
    onCancel: () => void;
    children: Snippet;
  }

  let { title, confirmLabel, cancelLabel = 'Resta', onConfirm, onCancel, children }: Props = $props();

  let panel: HTMLDivElement | undefined = $state();

  $effect(() => {
    // Il focus parte sul pulsante sicuro, così un tocco distratto non fa perdere la partita
    panel?.querySelector<HTMLElement>('[data-safe]')?.focus({ preventScroll: true });
  });

  function onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') onCancel();
  }
</script>

<svelte:window onkeydown={onKeydown} />

<div class="scrim centered" role="presentation">
  <div class="sheet mid" role="alertdialog" aria-modal="true" aria-label={title} bind:this={panel}>
    <h1>{title}</h1>
    <div class="body">{@render children()}</div>
    <div class="actions">
      <button type="button" class="btn btn-gold btn-big btn-block" data-safe onclick={onCancel}>{cancelLabel}</button>
      <button type="button" class="btn btn-coral btn-block" onclick={onConfirm}>{confirmLabel}</button>
    </div>
  </div>
</div>

<style>
  h1 {
    font-size: 1.8rem;
  }

  .body {
    text-align: center;
  }

  .actions {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
</style>
