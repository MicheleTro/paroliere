<script lang="ts">
  import type { GameSession, SessionSummary } from '@paroliere/core';
  import ModalSheet from '../lib/ModalSheet.svelte';
  import Svg from '../lib/Svg.svelte';
  import { ICONS } from '../lib/icons.js';
  import { medalClass, medalGlyph } from '../lib/medal-style.js';
  import { DUELS_UNLOCK_LEVEL } from '@paroliere/core';
  import type { FinishedPlay } from '../lib/plays.js';
  import { starSvg } from '../lib/scene.js';
  import SumWordsSheet from '../sheets/SumWordsSheet.svelte';
  import { WEEK_NAME } from '../lib/week.js';

  interface Props {
    session: GameSession;
    summary: SessionSummary;
    /** Esito registrato dal server (XP, parole nuove, medaglie); assente finché non arriva o se l'invio non è riuscito. */
    result?: FinishedPlay;
    error?: string;
    /** Gioca: si può rigiocare e si vedono le parole mancate; Settimana: un solo tentativo per griglia. */
    mode: 'gioca' | 'settimana';
    /** Questa partita ha chiuso un ciclo da 10 giorni: c'è un aiuto in regalo. */
    gift?: boolean;
    onNewGame: () => void;
    onHome: () => void;
  }

  let { session, summary, result, error, mode, gift = false, onNewGame, onHome }: Props = $props();

  const xp = $derived(result?.xp ?? summary.score);
  const newWords = $derived(new Set(result?.newWords ?? []));
  const level = $derived(result?.level);
  const levelPercent = $derived(level ? Math.min(100, (level.xpInLevel / level.xpForNext) * 100) : 0);

  const STAR_COLORS = { bronzo: '#d98a45', argento: '#c9d2e4', oro: '#ffc53d' } as const;

  let showWords = $state(false);

  // Dopo il riepilogo arrivano, uno alla volta, il passaggio di livello, il regalo e le medaglie
  type Modal = { kind: 'level' } | { kind: 'gift' } | { kind: 'medal'; id: string; name: string; description: string };
  let queue: Modal[] = $state([]);
  let queued = false;

  $effect(() => {
    if (!result || queued) return;
    queued = true;
    const list: Modal[] = [];
    if (result.leveledUp) list.push({ kind: 'level' });
    if (gift) list.push({ kind: 'gift' });
    for (const medal of result.newMedals) list.push({ kind: 'medal', ...medal });
    queue = list;
  });

  const current = $derived(queue[0]);
  const unlockedDuels = $derived(result ? result.levelBefore < DUELS_UNLOCK_LEVEL && (level?.level ?? 0) >= DUELS_UNLOCK_LEVEL : false);

  function nextModal(): void {
    queue = queue.slice(1);
  }

  const title = $derived(mode === 'settimana' ? WEEK_NAME : 'Gioca');
</script>

<div class="sum">
  <p class="head outline-text">{title}</p>

  <div class="burst">
    <svg viewBox="-100 -100 200 200" aria-hidden="true">
      {#each Array.from({ length: 14 }, (_, i) => i) as i (i)}
        <path
          d="M0 0 L{Math.cos((i / 14) * 6.283) * 100} {Math.sin((i / 14) * 6.283) * 100} L{Math.cos(((i + 0.5) / 14) * 6.283) * 100} {Math.sin(((i + 0.5) / 14) * 6.283) * 100}Z"
          fill={i % 2 ? '#ffd768' : '#ffc53d'}
          opacity=".55"
        />
      {/each}
      <circle r="58" fill="#ffc53d" stroke="#1d1a3a" stroke-width="4" />
    </svg>
    <div class="v"><b class="num">+{xp}</b><span>XP</span></div>
  </div>

  {#if error}
    <p class="error-text">Il risultato non è stato registrato: {error}</p>
  {/if}

  {#if result?.starBonus}
    <div class="bonus-row" class:oro={result.starBonus.star === 'oro'}>
      <span class="bstar"><Svg svg={starSvg(STAR_COLORS[result.starBonus.star])} /></span>
      <span class="grow">Stella {result.starBonus.star} <b class="num">×{result.starBonus.multiplier.toLocaleString('it-IT')}</b></span>
      <b class="num gold">+{result.starBonus.xp} XP</b>
    </div>
  {/if}

  <div class="panel level">
    <div class="lvlrow">
      <span class="starbox">
        <Svg svg={starSvg('#ffc53d')} />
        <b class="num">{level?.level ?? '…'}</b>
      </span>
      <span class="xpbar grow"><i style:width="{levelPercent}%"></i></span>
      <span class="num amount">{level ? `${level.xpInLevel}/${level.xpForNext}` : '…'}</span>
    </div>
  </div>

  <div class="trio">
    <div class="bub"><b class="num gold">+{newWords.size}</b><span>nuove</span></div>
    <div class="bub"><b class="num">{summary.foundWords.length}</b><span>parole</span></div>
    <div class="bub"><b class="num coral">{result?.streakDays ?? 0}/10</b><span>serie</span></div>
  </div>

  <div class="row buttons">
    <button type="button" class="btn btn-block" onclick={() => (showWords = true)}><Svg svg={ICONS.book} /> Parole</button>
    {#if mode === 'gioca'}
      <button type="button" class="btn btn-blue btn-block" onclick={onNewGame}>Ancora</button>
    {/if}
  </div>
  <button type="button" class="btn btn-gold btn-big btn-block" onclick={onHome}>Home</button>
</div>

{#if showWords}
  <SumWordsSheet {session} {summary} {newWords} showMissed={mode === 'gioca'} onClose={() => (showWords = false)} />
{:else if current?.kind === 'level' && level}
  <ModalSheet title="Livello {level.level}!" onClose={nextModal}>
    <span class="bigstar"><Svg svg={starSvg('#ffc53d')} /><b class="num">{level.level}</b></span>
    <p class="muted">Sei salito di livello.</p>
    {#if unlockedDuels}<p class="unlock">Si sbloccano gli amici e le Sfide!</p>{/if}
  </ModalSheet>
{:else if current?.kind === 'gift'}
  <ModalSheet title="Serie completa!" onClose={nextModal}>
    <span class="token big">+10s</span>
    <p class="muted">Dieci giorni di fila: hai un aiuto in regalo, da usare in Sloth's week o in una sfida.</p>
  </ModalSheet>
{:else if current?.kind === 'medal'}
  <ModalSheet title="Nuova medaglia" onClose={nextModal}>
    <span class="medal"><span class="m big {medalClass('')}">{medalGlyph(current.id, current.name)}</span></span>
    <h2>{current.name}</h2>
    <p class="muted">{current.description}</p>
  </ModalSheet>
{/if}

<style>
  .sum {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    justify-content: space-between;
    gap: 10px;
    width: min(100%, 440px);
    flex: 1 1 auto;
    min-height: 0;
  }

  .head {
    text-align: center;
    font-family: var(--f-display);
    font-size: 1.3rem;
  }

  .bonus-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    flex-shrink: 0;
    background: var(--paper);
    border: 3px solid var(--ink);
    border-radius: 16px;
    box-shadow: 0 4px 0 var(--ink);
    font-family: var(--f-display);
    font-size: 1.05rem;
    text-transform: capitalize;
    animation: bonus-in 0.5s cubic-bezier(0.2, 1.4, 0.4, 1);
  }

  .bonus-row .bstar {
    width: 34px;
    height: 34px;
    flex: none;
  }

  .bonus-row .bstar :global(svg) {
    width: 100%;
    height: 100%;
  }

  .bonus-row b {
    font-weight: 400;
  }

  @keyframes bonus-in {
    from {
      transform: scale(0.7);
      opacity: 0;
    }
  }

  .level {
    padding: 12px 14px;
    flex-shrink: 0;
  }

  .starbox {
    position: relative;
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    flex: none;
  }

  .starbox :global(svg) {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }

  .starbox b {
    position: relative;
    font-family: var(--f-display);
    font-weight: 400;
    font-size: 1.1rem;
  }

  .amount {
    font-family: var(--f-display);
    font-size: 0.95rem;
    font-weight: 400;
  }

  .gold {
    color: var(--gold-d);
  }

  .coral {
    color: var(--coral-d);
  }

  .buttons {
    gap: 10px;
    flex-shrink: 0;
  }

  .bigstar {
    position: relative;
    display: grid;
    place-items: center;
    width: 110px;
    height: 110px;
    animation: pop 0.6s cubic-bezier(0.2, 1.5, 0.4, 1);
  }

  .bigstar :global(svg) {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }

  .bigstar b {
    position: relative;
    font-family: var(--f-display);
    font-weight: 400;
    font-size: 2.4rem;
  }

  .token.big {
    width: 110px;
    height: 110px;
    font-size: 1.8rem;
    animation: pop 0.6s cubic-bezier(0.2, 1.5, 0.4, 1);
  }

  .unlock {
    font-family: var(--f-display);
    font-size: 1.1rem;
    color: var(--coral-d);
  }
</style>
