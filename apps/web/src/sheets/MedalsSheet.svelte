<script lang="ts">
  import Svg from '../lib/Svg.svelte';
  import { getMedals, type MedalEntry } from '../lib/me.js';
  import { medalClass, medalGlyph } from '../lib/medal-style.js';
  import Sheet from '../lib/Sheet.svelte';
  import { starSvg } from '../lib/scene.js';

  interface Props {
    onClose: () => void;
  }

  let { onClose }: Props = $props();

  let medals: MedalEntry[] = $state([]);
  let selected: MedalEntry | undefined = $state();
  let error: string | undefined = $state();

  getMedals()
    .then((result) => (medals = result.medals))
    .catch((err) => (error = err instanceof Error ? err.message : 'Errore imprevisto'));

  const earned = $derived(medals.filter((m) => m.earnedAt !== null).length);
</script>

<Sheet title="{earned}/{medals.length} medaglie" {onClose}>
  {#snippet badge()}
    <span class="vbadge" style="background: var(--gold)"><Svg svg={starSvg('#fffaf0')} /></span>
  {/snippet}

  {#if error}
    <p class="error-text">{error}</p>
  {/if}
  <div class="medals">
    {#each medals as medal (medal.id)}
      <button type="button" class="medal" onclick={() => (selected = selected?.id === medal.id ? undefined : medal)}>
        <span class="m {medalClass(medal.kind)}" class:off={medal.earnedAt === null}>{medalGlyph(medal.id, medal.name)}</span>
        <span class="n">{medal.name}</span>
      </button>
    {/each}
  </div>
  {#if selected}
    <div class="panel detail">
      <h2>{selected.name}</h2>
      <p class="muted">{selected.description}</p>
      <p class="small">{selected.earnedAt ? `Ottenuta il ${new Date(selected.earnedAt).toLocaleDateString('it-IT')}` : 'Non ancora ottenuta'}</p>
    </div>
  {/if}
</Sheet>

<style>
  .vbadge :global(svg) {
    width: 36px;
    height: 36px;
  }

  .detail {
    padding: 10px 14px;
    text-align: center;
  }

  .small {
    font-size: 0.8rem;
  }
</style>
