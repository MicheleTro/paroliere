<script lang="ts">
  import Svg from '../lib/Svg.svelte';
  import Sheet from '../lib/Sheet.svelte';
  import { ICONS } from '../lib/icons.js';
  import type { Me } from '../lib/plays.js';

  interface Props {
    me: Me;
    onClose: () => void;
    onInfo: (key: string) => void;
  }

  let { me, onClose, onInfo }: Props = $props();

  const helps = $derived(me.helps);
</script>

<Sheet title="Serie {me.streak.days}/{me.streak.cycleLength}" subtitle={me.streak.playedToday ? 'oggi fatto' : 'oggi da fare'} {onClose} onInfo={() => onInfo('serie')}>
  {#snippet badge()}
    <span class="vbadge" style="background: var(--coral-l)"><Svg svg={ICONS.flame} /></span>
  {/snippet}

  <ol class="cells" aria-label="Giorni della serie">
    {#each Array.from({ length: me.streak.cycleLength }, (_, i) => i) as i (i)}
      <li class:done={i < me.streak.days} class:prize={i === me.streak.cycleLength - 1}>
        {i === me.streak.cycleLength - 1 ? '+10s' : i + 1}
      </li>
    {/each}
  </ol>

  <div class="row panel">
    <span class="token" class:off={helps === 0}>+10s</span>
    <div class="grow">
      <h2 class="num">{helps} {helps === 1 ? 'aiuto' : 'aiuti'}</h2>
      <span class="muted small">da usare in Sloth's week e nelle sfide</span>
    </div>
    <button type="button" class="info" aria-label="Maggiori informazioni sugli aiuti" onclick={() => onInfo('aiuto')}>i</button>
  </div>
</Sheet>

<style>
  .vbadge :global(svg) {
    width: 34px;
    height: 34px;
  }

  .cells {
    display: grid;
    grid-template-columns: repeat(10, 1fr);
    gap: 5px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .cells li {
    aspect-ratio: 1;
    border-radius: 10px;
    border: 2.5px solid var(--ink);
    display: grid;
    place-items: center;
    font-family: var(--f-display);
    font-size: 0.8rem;
    background: var(--paper-2);
    color: var(--ink);
  }

  .cells li.done {
    background: var(--coral);
    color: #fff;
  }

  .cells li.prize:not(.done) {
    background: var(--gold-l);
  }

  .panel {
    padding: 12px;
  }

  .small {
    font-size: 0.85rem;
  }
</style>
