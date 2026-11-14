<script lang="ts">
  import Svg from '../lib/Svg.svelte';
  import { onDestroy } from 'svelte';
  import { COMBO_WINDOW_MS, GIOCA_STARS, remainingMs, type GameSession } from '@paroliere/core';
  import ConfirmSheet from '../lib/ConfirmSheet.svelte';
  import ModalSheet from '../lib/ModalSheet.svelte';
  import { ruleDescription, ruleName } from '../lib/rules.js';
  import { displayWord } from '../lib/display.js';
  import GridView from '../lib/GridView.svelte';
  import WordPopup from '../lib/WordPopup.svelte';
  import type { WordPopupData } from '../lib/word-popup.js';
  import { formatDuration } from '../lib/format.js';
  import { ICONS } from '../lib/icons.js';
  import { settings } from '../lib/settings.svelte.js';
  import { slothHeadSvg, starSvg } from '../lib/scene.js';
  import { isSoundMuted, playCountdownTick, playGong, playPathTone, playStar, setSoundMuted } from '../lib/sound.js';

  const COUNTDOWN_MS = 3000;

  interface Props {
    session: GameSession;
    now: number;
    popup: WordPopupData | null;
    /** Nome della modalità, in alto (Gioca, Settimana, Sfida). */
    title: string;
    onSubmit: (path: number[]) => void;
    /** Uscita dalla partita (già confermata): si perdono punteggio e match. */
    onQuit: () => void;
    /** Testo della conferma di uscita, se diverso da quello di Gioca. */
    quitWarning?: string;
    /** Gioca: sotto il punteggio c'è la barra con i tre traguardi (stelle bronzo, argento e oro). */
    stars?: boolean;
    /** Partita di una sfida 1 contro 1 (aggiunge la regola delle parole uniche alla descrizione). */
    duel?: boolean;
    /** Prima partita guidata: la parola da trascinare, con il suo percorso. */
    guide?: { word: string; path: number[] };
  }

  let { session, now, popup, title, onSubmit, onQuit, quitWarning, stars = false, duel = false, guide }: Props = $props();

  // Passi della guida: 0 = trascina la parola suggerita, 1 = i punti sono XP, 2 = le parole dorate sono nuove
  const guideStep = $derived(session.foundWords.length === 0 ? 0 : session.foundWords.length < 3 ? 1 : session.foundWords.length < 6 ? 2 : 3);

  let currentPath: number[] = $state([]);
  let muted = $state(isSoundMuted());
  let lastPathLength = 0;
  let countdownStarted = false;
  const countdownTimeouts: ReturnType<typeof setTimeout>[] = [];

  const currentWord = $derived(currentPath.map((i) => session.grid.tiles[i]).join(''));
  const score = $derived(session.foundWords.reduce((sum, f) => sum + f.points, 0));
  const recentFoundWords = $derived([...session.foundWords].reverse());

  const timeLeft = $derived(remainingMs(session, now));
  const urgent = $derived(timeLeft <= 15_000);
  const critical = $derived(timeLeft <= COUNTDOWN_MS && timeLeft > 0);

  // Combo: attiva se l'ultima parola è recente (solo nelle varianti con la combo)
  const lastFound = $derived(session.foundWords[session.foundWords.length - 1]);
  const comboLevel = $derived(
    session.config.combo && lastFound && now - session.startedAt - lastFound.atMs <= COMBO_WINDOW_MS && lastFound.combo >= 2
      ? lastFound.combo
      : 0,
  );

  const pathTone = $derived(popup?.tone === 'green' ? 'ok' : popup?.tone === 'yellow' ? 'dup' : 'neutral');

  $effect(() => {
    if (countdownStarted || timeLeft > COUNTDOWN_MS || timeLeft <= 0) return;
    countdownStarted = true;
    const remaining = timeLeft;
    playCountdownTick();
    for (const mark of [2000, 1000]) {
      const delay = remaining - mark;
      if (delay > 0) countdownTimeouts.push(setTimeout(() => playCountdownTick(), delay));
    }
    countdownTimeouts.push(setTimeout(() => playGong(), Math.max(0, remaining)));
  });

  onDestroy(() => {
    if (burstTimer) clearTimeout(burstTimer);
    for (const id of countdownTimeouts) clearTimeout(id);
  });

  function handlePathChange(path: number[]): void {
    currentPath = path;
    if (path.length !== lastPathLength && path.length > 0) playPathTone(path.length - 1);
    lastPathLength = path.length;
  }

  let confirmingQuit = $state(false);
  let showRules = $state(false);
  const rulesName = $derived(ruleName(session.config));

  // Punteggio dell'ultima parola trovata: compare per un paio di secondi o fino alla parola dopo, più grande e
  // più vistoso quanto più vale. Sta nella riga dei punteggi, sopra la griglia.
  const BURST_MS = 2200;
  let burst: { id: number; points: number; combo: number } | null = $state(null);
  let burstTimer: ReturnType<typeof setTimeout> | undefined;
  let seenWords = 0;

  const burstTier = $derived(!burst ? 0 : burst.points >= 12 ? 4 : burst.points >= 8 ? 3 : burst.points >= 4 ? 2 : 1);

  $effect(() => {
    const count = session.foundWords.length;
    if (count > seenWords) {
      const last = session.foundWords[count - 1]!;
      burst = { id: count, points: last.points, combo: session.config.combo ? last.combo : 0 };
      if (burstTimer) clearTimeout(burstTimer);
      burstTimer = setTimeout(() => (burst = null), BURST_MS);
    }
    seenWords = count;
  });

  // Traguardi di Gioca: ogni stella raggiunta suona e si anima; a fine partita la più alta moltiplica l'XP
  const STAR_COLORS = { bronzo: '#d98a45', argento: '#c9d2e4', oro: '#ffc53d' } as const;
  const goalMax = GIOCA_STARS[GIOCA_STARS.length - 1]!.at;
  const goalPercent = $derived(Math.min(100, (score / goalMax) * 100));
  let starsReached = 0;

  $effect(() => {
    if (!stars) return;
    const reached = GIOCA_STARS.filter((tier) => score >= tier.at).length;
    if (reached > starsReached) playStar(reached - 1);
    starsReached = reached;
  });

  function toggleMute(): void {
    muted = !muted;
    setSoundMuted(muted);
    void settings.update({ sound: !muted }).catch(() => {});
  }
</script>

<div class="screen pattern play">
  {#if critical}
    <div class="danger-overlay" aria-hidden="true"></div>
  {/if}

  <div class="gtop">
    <button type="button" class="x" aria-label="Esci dalla partita" onclick={() => (confirmingQuit = true)}><Svg svg={ICONS.close} /></button>
    <div class="titlebox">
      <div class="title outline-text">{title}</div>
      <button type="button" class="rule" onclick={() => (showRules = true)} aria-label="Regole: {rulesName}">
        <span>{rulesName}</span><span class="info" aria-hidden="true">i</span>
      </button>
    </div>
    <button type="button" class="x" aria-label={muted ? 'Attiva audio' : 'Disattiva audio'} onclick={toggleMute}>
      {muted ? '🔇' : '🔊'}
    </button>
  </div>

  <div class="gstats">
    <span class="pill timer num" class:low={urgent}>
      <span class="clock"><Svg svg={ICONS.timer} /></span>{formatDuration(timeLeft)}
    </span>
    {#if comboLevel > 0 && !burst}<span class="combo">Combo ×{comboLevel}</span>{/if}
    {#if burst}
      {#key burst.id}
        <span class="wscore t{burstTier}" aria-live="polite">
          <b class="num">+{burst.points}</b>
          {#if burst.combo >= 2}<i>combo ×{burst.combo}</i>{/if}
        </span>
      {/key}
    {/if}
    <span class="pill score num"><span class="coin">★</span>{score}</span>
  </div>

  {#if stars}
    <div class="goal" role="img" aria-label="Traguardi: {GIOCA_STARS.map((t) => `${t.at} punti`).join(', ')}">
      <div class="track"><i style:width="{goalPercent}%"></i></div>
      {#each GIOCA_STARS as tier (tier.id)}
        <span class="gstar" class:earned={score >= tier.at} style:left="{(tier.at / goalMax) * 100}%">
          <Svg svg={starSvg(STAR_COLORS[tier.id])} /><b class="num">{tier.at}</b>
        </span>
      {/each}
    </div>
  {/if}

  {#if guide && guideStep < 3}
    <div class="coach">
      <span class="head"><Svg svg={slothHeadSvg()} /></span>
      <p class="say">
        {#if guideStep === 0}Trascina: <b>{displayWord(guide.word).toUpperCase()}</b>
        {:else if guideStep === 1}I punti diventano <b>XP</b>!
        {:else}<b>Giallo</b> = parola nuova!{/if}
      </p>
    </div>
  {/if}

  <div class="popup-wrap">
    <WordPopup {popup} />
  </div>

  <div class="board-area">
    <GridView
      grid={session.grid}
      {onSubmit}
      onPathChange={handlePathChange}
      pointMode={session.config.pointMode}
      positionBonus={session.config.positionBonus}
      {pathTone}
      hintPath={guide && guideStep === 0 ? guide.path : []}
    />
  </div>

  <p class="current-word outline-text">{currentWord ? displayWord(currentWord) : ' '}</p>

  <ul class="strip" aria-label="Parole trovate">
    {#each recentFoundWords as found (found.word)}
      <li class="wchip" class:new={!!guide}>{displayWord(found.word)} <span>+{found.points}</span></li>
    {/each}
  </ul>
</div>

{#if showRules}
  <ModalSheet title={rulesName} action="Ok" onClose={() => (showRules = false)}>
    <ul class="rules">
      {#each ruleDescription(session.config, duel) as line (line)}<li>{line}</li>{/each}
    </ul>
  </ModalSheet>
{:else if confirmingQuit}
  <ConfirmSheet
    title="Uscire dalla partita?"
    confirmLabel="Esci e perdi tutto"
    cancelLabel="Resta in gioco"
    onCancel={() => (confirmingQuit = false)}
    onConfirm={() => {
      confirmingQuit = false;
      onQuit();
    }}
  >
    <p class="muted">{quitWarning ?? 'Perderai il punteggio e la partita non verrà conteggiata.'}</p>
  </ConfirmSheet>
{/if}

<style>
  .play {
    gap: 0;
  }

  .gtop {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    flex-shrink: 0;
  }

  .titlebox {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
  }

  /* Le regole della partita: nome ricavato dai parametri e una (i) che le spiega */
  .rule {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    max-width: 100%;
    padding: 1px 4px 1px 10px;
    border: 2.5px solid var(--ink);
    border-radius: 999px;
    background: var(--paper);
    font-family: var(--f-display);
    font-size: 0.8rem;
    color: var(--ink);
    cursor: pointer;
  }

  .rule > span:first-child {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .rule .info {
    width: 20px;
    height: 20px;
    font-size: 0.8rem;
    border-width: 2px;
    box-shadow: none;
  }

  .rules {
    margin: 0;
    padding-left: 1.1rem;
    text-align: left;
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: 0.9rem;
  }

  .gtop .title {
    min-width: 0;
    max-width: 100%;
    text-align: center;
    font-family: var(--f-display);
    font-size: 1.05rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .gstats {
    position: relative;
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    margin-top: 12px;
    flex-shrink: 0;
  }

  .timer,
  .score {
    font-size: 1.7rem;
    padding: 2px 16px 2px 6px;
    cursor: default;
  }

  .timer .clock {
    width: 30px;
    height: 30px;
    border-radius: 50%;
    background: var(--blue);
    border: 2.5px solid var(--ink);
    color: #fff;
    display: grid;
    place-items: center;
  }

  .timer.low {
    background: var(--coral-l);
    animation: shake 0.5s infinite;
  }

  .score .coin {
    width: 30px;
    height: 30px;
    border-radius: 50%;
    background: var(--gold);
    border: 2.5px solid var(--ink);
    display: grid;
    place-items: center;
    font-size: 1rem;
    color: var(--ink);
  }

  .combo {
    font-family: var(--f-display);
    color: var(--gold);
    font-size: 1.1rem;
    text-shadow: 0 2px 0 var(--ink);
  }

  /* Barra dei traguardi: la stella sta sul punto della barra in cui scatta */
  .goal {
    position: relative;
    width: calc(100% - 28px);
    height: 38px;
    margin-top: 8px;
    flex-shrink: 0;
  }

  .goal .track {
    position: absolute;
    left: 0;
    right: 0;
    top: 12px;
    height: 14px;
    border: 3px solid var(--ink);
    border-radius: 999px;
    background: var(--paper);
    overflow: hidden;
  }

  .goal .track i {
    display: block;
    height: 100%;
    background: var(--gold);
    transition: width 0.3s ease-out;
  }

  .gstar {
    position: absolute;
    top: 0;
    width: 38px;
    height: 38px;
    margin-left: -19px;
    display: grid;
    place-items: center;
    filter: grayscale(1) opacity(0.55);
    transition: filter 0.3s;
  }

  .gstar :global(svg) {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }

  .gstar b {
    position: relative;
    font-family: var(--f-display);
    font-weight: 400;
    font-size: 0.75rem;
    color: var(--ink);
    margin-top: 2px;
  }

  .gstar.earned {
    filter: none;
    animation: star-pop 0.8s cubic-bezier(0.2, 1.6, 0.4, 1);
  }

  .gstar.earned::after {
    content: '';
    position: absolute;
    inset: 4px;
    border-radius: 50%;
    border: 3px solid var(--gold);
    opacity: 0;
    animation: star-ring 0.8s ease-out;
  }

  @keyframes star-pop {
    0% {
      transform: scale(0.6) rotate(-25deg);
    }

    45% {
      transform: scale(1.7) rotate(12deg);
    }

    100% {
      transform: scale(1) rotate(0);
    }
  }

  @keyframes star-ring {
    0% {
      opacity: 0.9;
      transform: scale(0.6);
    }

    100% {
      opacity: 0;
      transform: scale(2.6);
    }
  }

  /* Punteggio dell'ultima parola: al centro della riga dei punteggi, mai sulla griglia */
  .wscore {
    position: absolute;
    left: 50%;
    top: 50%;
    z-index: 4;
    display: flex;
    flex-direction: column;
    align-items: center;
    pointer-events: none;
    font-family: var(--f-display);
    color: #fff;
    text-shadow:
      0 3px 0 var(--ink),
      2px 0 0 var(--ink),
      -2px 0 0 var(--ink),
      0 -2px 0 var(--ink);
    animation: wscore-pop 2.2s ease-out forwards;
    --c: var(--mint);
  }

  .wscore b {
    font-weight: 400;
    line-height: 1;
    color: var(--c);
  }

  .wscore i {
    font-style: normal;
    font-size: 0.75rem;
    color: var(--gold);
  }

  .wscore.t1 b {
    font-size: 1.6rem;
  }

  .wscore.t2 b {
    font-size: 2rem;
  }

  .wscore.t3 {
    --c: var(--gold);
  }

  .wscore.t3 b {
    font-size: 2.4rem;
  }

  .wscore.t4 {
    --c: var(--coral);
  }

  .wscore.t4 b {
    font-size: 2.8rem;
  }

  /* anello che si espande per i punteggi alti */
  .wscore.t3::before,
  .wscore.t4::before {
    content: '';
    position: absolute;
    left: 50%;
    top: 50%;
    width: 64px;
    height: 64px;
    margin: -32px 0 0 -32px;
    border-radius: 50%;
    border: 4px solid var(--c);
    opacity: 0;
    animation: wscore-ring 0.7s ease-out;
  }

  .wscore.t4 b {
    animation: wscore-shake 0.5s 0.15s;
  }

  @keyframes wscore-pop {
    0% {
      transform: translate(-50%, -30%) scale(0.3) rotate(-8deg);
      opacity: 0;
    }

    12% {
      transform: translate(-50%, -55%) scale(1.35) rotate(4deg);
      opacity: 1;
    }

    22% {
      transform: translate(-50%, -50%) scale(1) rotate(0);
    }

    75% {
      transform: translate(-50%, -52%) scale(1);
      opacity: 1;
    }

    100% {
      transform: translate(-50%, -90%) scale(0.9);
      opacity: 0;
    }
  }

  @keyframes wscore-ring {
    0% {
      opacity: 0.9;
      transform: scale(0.4);
    }

    100% {
      opacity: 0;
      transform: scale(2.2);
    }
  }

  @keyframes wscore-shake {
    25% {
      transform: translateX(-3px) rotate(-3deg);
    }

    75% {
      transform: translateX(3px) rotate(3deg);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .wscore,
    .wscore::before,
    .wscore b {
      animation: none;
    }
  }

  .popup-wrap {
    flex-shrink: 0;
    margin-top: 6px;
  }

  .coach {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    margin-top: 10px;
    min-height: 56px;
    flex-shrink: 0;
  }

  .coach .head {
    width: 50px;
    height: 50px;
    flex: none;
  }

  .coach .head :global(svg) {
    width: 100%;
    height: 100%;
  }

  .coach .say {
    position: relative;
    flex: 1;
    background: var(--paper);
    border: 3px solid var(--ink);
    border-radius: 16px;
    padding: 8px 12px;
    font-family: var(--f-display);
    font-weight: 400;
    font-size: 1.05rem;
    box-shadow: 0 4px 0 rgba(29, 26, 58, 0.35);
  }

  .coach .say b {
    color: var(--coral-d);
    font-weight: 400;
  }

  .board-area {
    flex: 1;
    min-height: 0;
    width: 100%;
    display: grid;
    place-items: center;
  }

  .current-word {
    flex-shrink: 0;
    min-height: 2.2rem;
    font-family: var(--f-display);
    font-size: 2rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    text-align: center;
  }

  .strip {
    display: flex;
    gap: 6px;
    overflow-x: auto;
    padding: 4px 2px 8px;
    margin: 0;
    width: 100%;
    list-style: none;
    min-height: 42px;
    flex-shrink: 0;
    scrollbar-width: none;
  }

  .strip::-webkit-scrollbar {
    display: none;
  }

  .strip li {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .strip li span {
    color: var(--gold-d);
  }

  .danger-overlay {
    position: absolute;
    inset: 0;
    z-index: 5;
    pointer-events: none;
    background: var(--coral);
    opacity: 0;
    animation: danger-pulse 1s ease-in-out infinite;
  }

  @keyframes danger-pulse {
    0%,
    100% {
      opacity: 0;
    }

    50% {
      opacity: 0.18;
    }
  }
</style>
