<script lang="ts">
  import Svg from '../lib/Svg.svelte';
  import type { Season, Sky } from '../lib/me.js';
  import Sheet from '../lib/Sheet.svelte';
  import { ICONS } from '../lib/icons.js';
  import { settings } from '../lib/settings.svelte.js';

  interface Props {
    onClose: () => void;
    onLogout: () => void;
  }

  let { onClose, onLogout }: Props = $props();

  let error: string | undefined = $state();

  async function change(changes: Parameters<typeof settings.update>[0]): Promise<void> {
    error = undefined;
    try {
      await settings.update(changes);
    } catch (err) {
      error = err instanceof Error ? err.message : 'Salvataggio non riuscito';
    }
  }

  const SKIES: { value: Sky; label: string }[] = [
    { value: 'auto', label: 'Auto' },
    { value: 'giorno', label: 'Giorno' },
    { value: 'notte', label: 'Notte' },
  ];
  const SEASONS: { value: Season; label: string }[] = [
    { value: 'auto', label: 'Auto' },
    { value: 'autunno', label: 'Aut' },
    { value: 'inverno', label: 'Inv' },
    { value: 'primavera', label: 'Pri' },
    { value: 'estate', label: 'Est' },
  ];
</script>

<Sheet title="Impostazioni" {onClose}>
  {#snippet badge()}
    <span class="vbadge" style="background: var(--paper-2)"><Svg svg={ICONS.gear} /></span>
  {/snippet}

  <div class="setrow">
    <Svg svg={ICONS.sound} />
    <span class="lbl">Suoni</span>
    <button type="button" class="sw" aria-label="Suoni" aria-pressed={settings.values.sound} onclick={() => change({ sound: !settings.values.sound })}></button>
  </div>
  <div class="setrow">
    <Svg svg={ICONS.vibra} />
    <span class="lbl">Vibrazione</span>
    <button type="button" class="sw" aria-label="Vibrazione" aria-pressed={settings.values.vibration} onclick={() => change({ vibration: !settings.values.vibration })}></button>
  </div>
  <div class="setrow">
    <Svg svg={ICONS.bell} />
    <span class="lbl">
      Promemoria serie
      {#if !settings.reminderAvailable}<small>in arrivo</small>{/if}
    </span>
    <button
      type="button"
      class="sw"
      aria-label="Promemoria serie"
      aria-pressed={settings.values.reminder}
      disabled={!settings.reminderAvailable}
      onclick={() => change({ reminder: !settings.values.reminder })}
    ></button>
  </div>

  <div class="setrow"><Svg svg={ICONS.moon} /><span class="lbl">Cielo</span></div>
  <div class="tabs">
    {#each SKIES as sky (sky.value)}
      <button type="button" aria-pressed={settings.values.sky === sky.value} onclick={() => change({ sky: sky.value })}>{sky.label}</button>
    {/each}
  </div>

  <div class="setrow"><Svg svg={ICONS.leaf} /><span class="lbl">Stagione</span></div>
  <div class="tabs">
    {#each SEASONS as season (season.value)}
      <button type="button" aria-pressed={settings.values.season === season.value} onclick={() => change({ season: season.value })}>{season.label}</button>
    {/each}
  </div>

  {#if error}<p class="error-text">{error}</p>{/if}

  <button type="button" class="btn btn-secondary btn-block" onclick={onLogout}><Svg svg={ICONS.power} /> Esci dal gioco</button>
</Sheet>

<style>
  .vbadge :global(svg) {
    width: 30px;
    height: 30px;
  }
</style>
