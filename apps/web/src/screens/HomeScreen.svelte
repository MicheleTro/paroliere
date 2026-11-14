<script lang="ts">
  import Svg from '../lib/Svg.svelte';
  import { getNotifications, type Notifications } from '../lib/challenges.js';
  import { ICONS } from '../lib/icons.js';
  import { buildNews, type NewsAction } from '../lib/news.js';
  import { getMe, type Me } from '../lib/plays.js';
  import { presetColor, presetGlyph } from '../lib/preset-style.js';
  import { buildScene, isNightAt, seasonOf, starSvg, type SceneDay } from '../lib/scene.js';
  import { settings } from '../lib/settings.svelte.js';
  import { DAY_NAMES, DAY_SHORT, getWeek, type DayState, type WeekOverview } from '../lib/week.js';
  import DaySheet from '../sheets/DaySheet.svelte';
  import InfoSheet from '../sheets/InfoSheet.svelte';
  import NewsSheet from '../sheets/NewsSheet.svelte';
  import RankSheet from '../sheets/RankSheet.svelte';
  import StreakSheet from '../sheets/StreakSheet.svelte';
  import WelcomeSheet from '../sheets/WelcomeSheet.svelte';
  import WordsSheet from '../sheets/WordsSheet.svelte';

  interface Props {
    portalUrl?: string;
    ready: boolean;
    onNewGame: (guided?: boolean) => void;
    onPlayDay: (day: number, help: boolean) => Promise<void>;
    onProfile: () => void;
    onChallenges: () => void;
  }

  let { portalUrl, ready, onNewGame, onPlayDay, onProfile, onChallenges }: Props = $props();

  let me: Me | undefined = $state();
  let week: WeekOverview | undefined = $state();
  let notifications: Notifications | undefined = $state();
  let welcomeDismissed = $state(false);
  // Chi non ha ancora fatto la prima partita guidata trova il benvenuto
  const showWelcome = $derived(me !== undefined && !me.onboarded && !welcomeDismissed);

  function refresh(): void {
    getMe()
      .then((result) => (me = result))
      .catch(() => {});
    getWeek()
      .then((result) => (week = result))
      .catch(() => {});
    getNotifications()
      .then((result) => (notifications = result))
      .catch(() => {});
  }
  refresh();

  type Sheet = { kind: 'day'; day: number } | { kind: 'rank' } | { kind: 'streak' } | { kind: 'news' } | { kind: 'words' } | { kind: 'info'; topic: string };
  let sheet: Sheet | undefined = $state();
  /** Dopo una scheda "i" si torna a quella che l'ha aperta. */
  let infoReturn: Sheet | undefined;

  function showInfo(topic: string): void {
    infoReturn = sheet && sheet.kind !== 'info' ? sheet : undefined;
    sheet = { kind: 'info', topic };
  }

  function closeSheet(): void {
    if (sheet?.kind === 'info' && infoReturn) {
      sheet = infoReturn;
      infoReturn = undefined;
    } else {
      sheet = undefined;
    }
  }

  async function playDay(day: number, help: boolean): Promise<void> {
    await onPlayDay(day, help);
  }

  function goNews(action: NewsAction): void {
    if (action.kind === 'day') sheet = { kind: 'day', day: action.day };
    else if (action.kind === 'challenges') onChallenges();
  }

  // --- La scena ---
  let box: HTMLDivElement | undefined = $state();
  let boxWidth = $state(390);
  let boxHeight = $state(780);

  const now = new Date();
  const season = $derived(settings.values.season === 'auto' ? seasonOf(now) : settings.values.season);
  const night = $derived(settings.values.sky === 'auto' ? isNightAt(now) : settings.values.sky === 'notte');

  const LABEL: Record<DayState, string> = {
    locked: 'bloccata',
    blocked: 'da sbloccare giocando la precedente',
    open: 'oggi',
    recover: 'da recuperare',
    in_progress: 'in corso',
    played: 'fatta',
    lost: 'persa',
  };

  const sceneDays = $derived.by((): SceneDay[] | undefined => {
    if (!week) return undefined;
    return week.days.map((d) => ({
      name: d.preset?.name ?? DAY_NAMES[d.dayIndex]!,
      glyph: d.preset ? presetGlyph(d.preset) : '?',
      color: d.preset ? presetColor(d.preset) : '#fffaf0',
      state: d.state,
      score: d.myScore,
      short: DAY_SHORT[d.dayIndex]!,
      label: `${DAY_NAMES[d.dayIndex]}: ${d.preset?.name ?? ''}, ${LABEL[d.state]}`,
    }));
  });

  const svg = $derived(
    week && sceneDays
      ? buildScene({
          width: 390,
          height: Math.round((390 * boxHeight) / Math.max(1, boxWidth)),
          season,
          night,
          days: sceneDays,
          todayIndex: week.todayIndex,
          dayFraction: (now.getHours() * 60 + now.getMinutes()) / 1440,
        })
      : '',
  );

  function onSceneClick(event: MouseEvent): void {
    const node = (event.target as Element).closest('[data-node]');
    if (node) sheet = { kind: 'day', day: Number(node.getAttribute('data-node')) };
  }

  function onSceneKey(event: KeyboardEvent): void {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const node = (event.target as Element).closest('[data-node]');
    if (node) {
      event.preventDefault();
      sheet = { kind: 'day', day: Number(node.getAttribute('data-node')) };
    }
  }

  // --- HUD ---
  const news = $derived(buildNews(me, week, notifications));
  const newsBadge = $derived(news.filter((n) => n.badge).length);
  const locked = $derived(me ? !me.duelsUnlocked : true);
  const toPlay = $derived(notifications?.toPlay ?? 0);
  const levelPercent = $derived(me ? Math.min(100, (me.xpInLevel / me.xpForNext) * 100) : 0);
  const monthName = (date: string): string => ['GEN', 'FEB', 'MAR', 'APR', 'MAG', 'GIU', 'LUG', 'AGO', 'SET', 'OTT', 'NOV', 'DIC'][Number(date.slice(5, 7)) - 1]!;
  const selectedDay = $derived(sheet?.kind === 'day' && week ? week.days[sheet.day] : undefined);
</script>

<div class="scene-wrap" bind:this={box} bind:clientWidth={boxWidth} bind:clientHeight={boxHeight}>
  <div class="scene" role="presentation" onclick={onSceneClick} onkeydown={onSceneKey}>
    <Svg svg={svg} />
  </div>
</div>

<div class="hud">
  <button type="button" class="lvl" aria-label="Livello {me?.level ?? 1}" onclick={() => (sheet = { kind: 'info', topic: 'xp' })}>
    <span class="star"><Svg svg={starSvg('#ffc53d')} /><b class="num">{me?.level ?? 1}</b></span>
    <span class="xpbar"><i style:width="{levelPercent}%"></i></span>
  </button>
  <button type="button" class="pill words" aria-label="Parole trovate: {me?.words ?? 0}" onclick={() => (sheet = { kind: 'words' })} disabled={!me}>
    <Svg svg={ICONS.book} /><span class="num">{me?.words ?? 0}</span>
  </button>
  <button type="button" class="pill" aria-label="Serie {me?.streak.days ?? 0} su {me?.streak.cycleLength ?? 10}" onclick={() => (sheet = { kind: 'streak' })} disabled={!me}>
    <Svg svg={ICONS.flame} /><span class="num">{me?.streak.days ?? 0}/{me?.streak.cycleLength ?? 10}</span>
  </button>
  <button type="button" class="btn round btn-sm bell" aria-label="Notizie" onclick={() => (sheet = { kind: 'news' })}>
    <Svg svg={ICONS.bell} />{#if newsBadge > 0}<span class="count-badge num">{newsBadge}</span>{/if}
  </button>
</div>

{#if week}
  <div class="weekpill">
    <button type="button" class="pill" aria-label="Classifica di Sloth's week" onclick={() => (sheet = { kind: 'rank' })}>
      <span>{Number(week.weekStart.slice(8))}–{Number(week.weekEnd.slice(8))} {monthName(week.weekEnd)}</span>
      <span class="trophy"><Svg svg={ICONS.trophy} /></span>
    </button>
    <button type="button" class="info" aria-label="Come funziona Sloth's week" onclick={() => showInfo('week')}>i</button>
  </div>
{/if}

<div class="dock">
  <div>
    <button type="button" class="btn round" aria-label="Profilo" onclick={onProfile}><Svg svg={ICONS.user} /></button>
    <span class="lab white">Profilo</span>
  </div>
  <div>
    <button type="button" class="btn btn-blue btn-big play" disabled={!ready} onclick={() => onNewGame()}><Svg svg={ICONS.play} /> {ready ? 'Gioca' : '…'}</button>
    <span class="lab white">5×5 · 1:30</span>
  </div>
  <div>
    <button
      type="button"
      class="btn round"
      class:btn-coral={!locked}
      aria-label={locked ? 'Sfide, bloccate fino al livello 5' : 'Sfide'}
      onclick={() => (locked ? showInfo('sfide') : onChallenges())}
    >
      <Svg svg={ICONS.swords} />
      {#if locked}<span class="lockb"><Svg svg={ICONS.lock} /></span>{:else if toPlay > 0}<span class="count-badge num">{toPlay}</span>{/if}
    </button>
    <span class="lab white">Sfide</span>
  </div>
</div>

{#if showWelcome}
  <WelcomeSheet
    onStart={() => {
      welcomeDismissed = true;
      onNewGame(true);
    }}
    onSkip={() => (welcomeDismissed = true)}
  />
{:else if sheet?.kind === 'day' && selectedDay}
  <DaySheet day={selectedDay} helps={me?.helps ?? 0} onClose={closeSheet} onPlay={playDay} onInfo={showInfo} />
{:else if sheet?.kind === 'rank' && week}
  <RankSheet weekStart={week.weekStart} weekEnd={week.weekEnd} onClose={closeSheet} onInfo={showInfo} />
{:else if sheet?.kind === 'streak' && me}
  <StreakSheet {me} onClose={closeSheet} onInfo={showInfo} />
{:else if sheet?.kind === 'words'}
  <WordsSheet onClose={closeSheet} onInfo={showInfo} />
{:else if sheet?.kind === 'news'}
  <NewsSheet items={news} {portalUrl} onClose={closeSheet} onGo={goNews} />
{:else if sheet?.kind === 'info'}
  <InfoSheet topic={sheet.topic} onClose={closeSheet} />
{/if}

<style>
  .scene {
    position: absolute;
    inset: 0;
  }

  .scene :global(svg) {
    display: block;
    width: 100%;
    height: 100%;
  }

  .bell {
    width: 46px;
    height: 46px;
  }

  .trophy {
    width: 30px;
    height: 30px;
    border-radius: 50%;
    background: var(--gold);
    border: 2.5px solid var(--ink);
    display: grid;
    place-items: center;
  }

  .trophy :global(svg) {
    width: 18px;
    height: 18px;
  }
</style>
