<script lang="ts">
  import Svg from '../lib/Svg.svelte';
  import Leaderboard from '../lib/Leaderboard.svelte';
  import { presetColor, presetGlyph } from '../lib/preset-style.js';
  import Sheet from '../lib/Sheet.svelte';
  import { ICONS } from '../lib/icons.js';
  import { DAY_NAMES, getDay, presetFacts, shortDate, type DayDetail, type Scope, type WeekDay } from '../lib/week.js';

  interface Props {
    day: WeekDay;
    /** Aiuti +10 s disponibili. */
    helps: number;
    onClose: () => void;
    onPlay: (day: number, help: boolean) => Promise<void>;
    onInfo: (key: string) => void;
  }

  let { day, helps, onClose, onPlay, onInfo }: Props = $props();

  let detail: DayDetail | undefined = $state();
  let error: string | undefined = $state();
  let scope: Scope = $state('generale');
  let useHelp = $state(false);
  let busy = $state(false);

  function load(): void {
    getDay(day.dayIndex, scope)
      .then((result) => {
        detail = result;
        error = undefined;
      })
      .catch((err) => (error = err instanceof Error ? err.message : 'Errore imprevisto'));
  }
  load();

  function chooseScope(next: Scope): void {
    scope = next;
    load();
  }

  async function play(): Promise<void> {
    busy = true;
    error = undefined;
    try {
      await onPlay(day.dayIndex, useHelp);
    } catch (err) {
      error = err instanceof Error ? err.message : 'Errore imprevisto';
      busy = false;
    }
  }

  const state = $derived(detail?.state ?? day.state);
  const preset = $derived(detail?.preset ?? day.preset);
  const canPlay = $derived(state === 'open' || state === 'recover' || state === 'in_progress');
  const playLabel = $derived(state === 'in_progress' ? 'Riprendi' : state === 'recover' ? 'Recupera' : 'Gioca');
  const board = $derived(detail?.leaderboard ?? []);
</script>

<Sheet title={preset?.name ?? DAY_NAMES[day.dayIndex]!} subtitle="{DAY_NAMES[day.dayIndex]} {shortDate(day.date)}" {onClose} onInfo={() => onInfo('week')}>
  {#snippet badge()}
    {#if preset}
      <span class="vbadge" style:background={presetColor(preset)}>{presetGlyph(preset)}</span>
    {/if}
  {/snippet}

  {#if preset}
    <div class="facts">
      {#each presetFacts(preset) as fact (fact)}<span class="fchip blue">{fact}</span>{/each}
    </div>
    {#if preset.description}<p class="muted desc">{preset.description}</p>{/if}
  {/if}

  {#if error}<p class="error-text">{error}</p>{/if}

  {#if state === 'locked'}
    <div class="panel center">
      <h2>Si apre {DAY_NAMES[day.dayIndex]!.toLowerCase()}</h2>
      <p class="muted">a mezzanotte</p>
    </div>
  {:else}
    {#if state === 'played'}
      <div class="row between panel score">
        <div>
          <span class="muted label">Il tuo punteggio</span>
          <h1 class="num">{detail?.myScore ?? day.myScore ?? 0}</h1>
        </div>
        {#if board.some((r) => r.me)}
          <div class="center">
            <h1 class="num">{board.find((r) => r.me)!.rank}º</h1>
            <span class="muted label">su {board.length}</span>
          </div>
        {/if}
      </div>
    {:else if state === 'lost'}
      <div class="panel center"><p class="muted">Hai lasciato questa griglia: il tentativo è perso.</p></div>
    {:else if state === 'blocked'}
      <div class="panel center">
        <h2>Prima {DAY_NAMES[day.dayIndex - 1]!.toLowerCase()}</h2>
        <p class="muted">Ogni giornata si apre dopo aver giocato la precedente.</p>
      </div>
    {:else if canPlay}
      {#if helps > 0 && state !== 'in_progress'}
        <button type="button" class="toggle-help" aria-pressed={useHelp} onclick={() => (useHelp = !useHelp)}>
          <span class="token">+10s</span>
          <span class="grow">
            <b class="help-title">Usa un aiuto</b><br />
            <span class="muted small">ne hai {helps}</span>
          </span>
          <span class="check">{#if useHelp}<Svg svg={ICONS.check} />{/if}</span>
        </button>
      {/if}
      <button type="button" class="btn btn-gold btn-big btn-block" disabled={busy} onclick={play}>{playLabel}</button>
    {/if}

    <div class="tabs">
      <button type="button" aria-pressed={scope === 'generale'} onclick={() => chooseScope('generale')}>Generale</button>
      <button type="button" aria-pressed={scope === 'amici'} onclick={() => chooseScope('amici')}>Amici</button>
    </div>

    {#if detail?.scopeNote === 'locked'}
      <p class="center muted pad">Gli amici si sbloccano al livello 5.</p>
    {:else if detail?.scopeNote === 'unavailable'}
      <p class="center muted pad">Gli amici non sono disponibili al momento.</p>
    {:else if detail && board.length === 0}
      <p class="center muted pad">{scope === 'amici' ? 'Nessun amico ha giocato.' : 'Ancora nessuno: sii il primo!'}</p>
    {:else if board.length > 0}
      <Leaderboard rows={board} max={3} />
      {#if !detail?.wordsVisible}<p class="center muted small">Le parole degli altri si vedono dopo che hai giocato</p>{/if}
    {/if}
  {/if}
</Sheet>

<style>
  .desc {
    font-size: 0.85rem;
  }

  .panel.score {
    padding: 12px 16px;
  }

  .label {
    font-size: 0.75rem;
    text-transform: uppercase;
  }

  .score h1 {
    font-size: 2.2rem;
  }

  .help-title {
    font-family: var(--f-display);
    font-size: 1.1rem;
    font-weight: 400;
  }

  .small {
    font-size: 0.8rem;
  }

  .pad {
    padding: 10px;
  }
</style>
