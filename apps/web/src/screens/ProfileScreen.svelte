<script lang="ts">
  import Svg from '../lib/Svg.svelte';
  import { ICONS } from '../lib/icons.js';
  import { getMedals, type MedalEntry } from '../lib/me.js';
  import { medalClass, medalGlyph } from '../lib/medal-style.js';
  import { getMe, type Me } from '../lib/plays.js';
  import { starSvg } from '../lib/scene.js';
  import InfoSheet from '../sheets/InfoSheet.svelte';
  import MedalsSheet from '../sheets/MedalsSheet.svelte';
  import SettingsSheet from '../sheets/SettingsSheet.svelte';
  import StreakSheet from '../sheets/StreakSheet.svelte';
  import WordsSheet from '../sheets/WordsSheet.svelte';

  interface Props {
    username: string;
    portalUrl?: string;
    onBack: () => void;
    onLogout: () => void;
    onAdmin?: () => void;
  }

  let { username, onBack, onLogout, onAdmin }: Props = $props();

  let me: Me | undefined = $state();
  let medals: MedalEntry[] = $state([]);
  let error: string | undefined = $state();

  getMe()
    .then((result) => (me = result))
    .catch((err) => (error = err instanceof Error ? err.message : 'Errore imprevisto'));
  getMedals()
    .then((result) => (medals = result.medals))
    .catch(() => {});

  type Sheet = 'words' | 'streak' | 'medals' | 'settings' | { info: string };
  let sheet: Sheet | undefined = $state();
  let infoReturn: Sheet | undefined;

  function showInfo(topic: string): void {
    infoReturn = sheet && typeof sheet === 'string' ? sheet : undefined;
    sheet = { info: topic };
  }

  function closeSheet(): void {
    if (typeof sheet === 'object' && infoReturn) {
      sheet = infoReturn;
      infoReturn = undefined;
    } else {
      sheet = undefined;
    }
  }

  const earned = $derived(medals.filter((m) => m.earnedAt !== null).length);
  const levelPercent = $derived(me ? Math.min(100, (me.xpInLevel / me.xpForNext) * 100) : 0);
</script>

<div class="screen pattern">
  <div class="top">
    <button type="button" class="x round-x" aria-label="Indietro" onclick={onBack}><Svg svg={ICONS.back} /></button>
    <div class="title">Profilo</div>
    <button type="button" class="x round-x" aria-label="Impostazioni" onclick={() => (sheet = 'settings')}><Svg svg={ICONS.gear} /></button>
  </div>

  {#if error}
    <p class="error-text">{error}</p>
  {:else if !me}
    <p class="empty-text">Caricamento...</p>
  {:else}
    <div class="pbody">
      <div class="panel hero">
        <span class="bigstar"><Svg svg={starSvg('#ffc53d')} /><b class="num">{me.level}</b></span>
        <div class="grow">
          <h2 class="lvl-title">Livello {me.level}</h2>
          <div class="xpbar bar"><i style:width="{levelPercent}%"></i></div>
          <span class="muted num small">{me.xpInLevel} / {me.xpForNext} XP</span>
        </div>
        <button type="button" class="info" aria-label="Come funzionano gli XP" onclick={() => showInfo('xp')}>i</button>
      </div>

      <div class="tiles4">
        <button type="button" class="ptile" onclick={() => (sheet = 'words')}>
          <span class="ic" style="color: var(--blue)"><Svg svg={ICONS.book} /></span>
          <b class="num">{me.words.toLocaleString('it-IT')}</b>
          <span>parole</span>
        </button>
        <div class="ptile">
          <span class="ic" style="color: var(--mint-d)"><Svg svg={ICONS.play} /></span>
          <b class="longest">{me.longestWord ?? '—'}</b>
          <span>la più lunga</span>
        </div>
        <button type="button" class="ptile" onclick={() => (sheet = 'streak')}>
          <span class="ic"><Svg svg={ICONS.flame} /></span>
          <b class="num">{me.streak.days}/{me.streak.cycleLength}</b>
          <span>serie</span>
        </button>
        <button type="button" class="ptile" onclick={() => (sheet = 'streak')}>
          <span class="token mini">+10s</span>
          <b class="num">{me.helps}</b>
          <span>aiuti</span>
        </button>
      </div>

      <button type="button" class="panel medals-panel" onclick={() => (sheet = 'medals')}>
        <div class="row between">
          <h2>Medaglie</h2>
          <span class="fchip gold num">{earned}/{medals.length}</span>
        </div>
        <div class="medals">
          {#each medals as medal (medal.id)}
            <span class="medal">
              <span class="m {medalClass(medal.kind)}" class:off={medal.earnedAt === null} style="width: 48px; height: 48px">{medalGlyph(medal.id, medal.name)}</span>
            </span>
          {/each}
        </div>
      </button>

      <div class="foot">
        <span class="muted">{username}</span>
        {#if onAdmin}<button type="button" class="btn btn-sm" onclick={onAdmin}>Amministrazione</button>{/if}
      </div>
    </div>
  {/if}

  {#if sheet === 'words'}
    <WordsSheet onClose={closeSheet} onInfo={showInfo} />
  {:else if sheet === 'streak' && me}
    <StreakSheet {me} onClose={closeSheet} onInfo={showInfo} />
  {:else if sheet === 'medals'}
    <MedalsSheet onClose={closeSheet} />
  {:else if sheet === 'settings'}
    <SettingsSheet onClose={closeSheet} {onLogout} />
  {:else if typeof sheet === 'object'}
    <InfoSheet topic={sheet.info} onClose={closeSheet} />
  {/if}
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

  .lvl-title {
    font-size: 1.6rem;
  }

  .bar {
    margin-top: 6px;
    height: 18px;
  }

  .small {
    font-size: 0.85rem;
  }

  .longest {
    text-transform: uppercase;
  }

  .token.mini {
    width: 34px;
    height: 34px;
    font-size: 0.7rem;
    border-width: 2.5px;
    box-shadow: 0 2px 0 var(--ink);
  }

  .medals-panel {
    padding: 12px;
    text-align: left;
    display: flex;
    flex-direction: column;
    gap: 8px;
    cursor: pointer;
    flex-shrink: 0;
  }

  .medals-panel .medals {
    grid-template-columns: repeat(5, 1fr);
  }

  .foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    color: #fff;
  }

  .foot .muted {
    color: #fff;
    text-shadow: 0 2px 0 var(--ink);
  }
</style>
