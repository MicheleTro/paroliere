<script lang="ts">
  import ModalSheet from '../lib/ModalSheet.svelte';
  import Svg from '../lib/Svg.svelte';
  import { slothSvg } from '../lib/scene.js';

  interface Props {
    onStart: () => void;
    onSkip: () => void;
  }

  let { onStart, onSkip }: Props = $props();

  // Il bradipo su un ramo, senza l'ondeggiamento della scena
  const picture = `<svg viewBox="-40 -14 110 70" width="170" height="108" aria-hidden="true">${slothSvg().replace('class="sloth-bob"', '')}<path d="M-40 -2 H70" stroke="#1d1a3a" stroke-width="12" stroke-linecap="round"/><path d="M-40 -2 H70" stroke="#7a4a2c" stroke-width="7" stroke-linecap="round"/></svg>`;
</script>

<ModalSheet title="Benvenuto!" action="Prima partita" onClose={onStart}>
  <Svg svg={picture} />
  <p class="text">Trascina il dito sulle lettere vicine per formare le parole. Ogni punto che fai diventa XP: con gli XP sali di livello.</p>
  <button type="button" class="btn btn-ghost skip" onclick={onSkip}>Più tardi</button>
</ModalSheet>

<style>
  .text {
    font-size: 1rem;
  }

  .skip {
    color: var(--ink-2);
  }
</style>
