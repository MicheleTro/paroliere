<script lang="ts">
  import Svg from '../lib/Svg.svelte';
  import Leaderboard from '../lib/Leaderboard.svelte';
  import Sheet from '../lib/Sheet.svelte';
  import { ICONS } from '../lib/icons.js';
  import { getWeekRanking, shortDate, type Scope, type WeekRanking } from '../lib/week.js';

  interface Props {
    weekStart: string;
    weekEnd: string;
    onClose: () => void;
    onInfo: (key: string) => void;
  }

  let { weekStart, weekEnd, onClose, onInfo }: Props = $props();

  let scope: Scope = $state('generale');
  let ranking: WeekRanking | undefined = $state();
  let error: string | undefined = $state();

  function load(): void {
    ranking = undefined;
    getWeekRanking(scope)
      .then((result) => (ranking = result))
      .catch((err) => (error = err instanceof Error ? err.message : 'Errore imprevisto'));
  }
  load();

  function choose(next: Scope): void {
    scope = next;
    load();
  }
</script>

<Sheet title="Classifica" subtitle="Sloth's week {shortDate(weekStart)} – {shortDate(weekEnd)}" {onClose} onInfo={() => onInfo('week')}>
  {#snippet badge()}
    <span class="vbadge" style="background: var(--gold)"><Svg svg={ICONS.trophy} /></span>
  {/snippet}

  <div class="tabs">
    <button type="button" aria-pressed={scope === 'generale'} onclick={() => choose('generale')}>Generale</button>
    <button type="button" aria-pressed={scope === 'amici'} onclick={() => choose('amici')}>Amici</button>
  </div>

  {#if error}
    <p class="error-text">{error}</p>
  {:else if !ranking}
    <p class="center muted">Caricamento...</p>
  {:else if ranking.locked}
    <p class="center muted pad">Gli amici si sbloccano al livello 5.</p>
  {:else if ranking.unavailable}
    <p class="center muted pad">Gli amici non sono disponibili al momento.</p>
  {:else if ranking.rows.length === 0}
    <p class="center muted pad">{scope === 'amici' ? 'Nessun amico ha ancora giocato.' : 'Ancora nessuno ha giocato questa settimana.'}</p>
  {:else}
    <Leaderboard rows={ranking.rows} max={5} />
  {/if}
</Sheet>

<style>
  .vbadge :global(svg) {
    width: 30px;
    height: 30px;
  }

  .pad {
    padding: 14px;
  }
</style>
