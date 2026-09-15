<script lang="ts">
  import { onDestroy } from 'svelte';
  import { remainingMs, type GameSession } from '@paroliere/core';
  import GridView from '../lib/GridView.svelte';
  import WordPopup from '../lib/WordPopup.svelte';
  import type { WordPopupData } from '../lib/word-popup.js';
  import { formatDuration } from '../lib/format.js';
  import { isSoundMuted, playCountdownTick, playGong, playPathTone, setSoundMuted } from '../lib/sound.js';

  const COUNTDOWN_MS = 3000;

  interface Props {
    session: GameSession;
    now: number;
    popup: WordPopupData | null;
    onSubmit: (path: number[]) => void;
  }

  let { session, now, popup, onSubmit }: Props = $props();

  let currentPath: number[] = $state([]);
  let muted = $state(isSoundMuted());
  let lastPathLength = 0;
  let countdownStarted = false;
  const countdownTimeouts: ReturnType<typeof setTimeout>[] = [];

  const currentWord = $derived(currentPath.map((i) => session.grid.tiles[i]).join(''));

  const score = $derived(session.foundWords.reduce((sum, f) => sum + f.points, 0));

  const recentFoundWords = $derived([...session.foundWords].reverse());

  const timeLeft = $derived(remainingMs(session, now));
  const urgent = $derived(timeLeft <= 10_000);
  const critical = $derived(timeLeft <= COUNTDOWN_MS && timeLeft > 0);

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
    for (const id of countdownTimeouts) clearTimeout(id);
  });

  function handlePathChange(path: number[]): void {
    currentPath = path;
    if (path.length !== lastPathLength && path.length > 0) playPathTone(path.length - 1);
    lastPathLength = path.length;
  }

  function toggleMute(): void {
    muted = !muted;
    setSoundMuted(muted);
  }
</script>

<div class="play">
  {#if critical}
    <div class="danger-overlay" aria-hidden="true"></div>
  {/if}
  <div class="top-row">
    <p class="timer" class:urgent>{formatDuration(timeLeft)}</p>
    <p class="score">{score} <span>pt</span></p>
    <button type="button" class="btn-icon" aria-label={muted ? 'Attiva audio' : 'Disattiva audio'} onclick={toggleMute}>
      {muted ? '🔇' : '🔊'}
    </button>
  </div>
  <div class="popup-wrap">
    <WordPopup {popup} />
  </div>
  <div class="grid-wrap">
    <GridView
      grid={session.grid}
      {onSubmit}
      onPathChange={handlePathChange}
      pointMode={session.config.pointMode}
      positionBonus={session.config.positionBonus}
    />
  </div>
  <p class="current-word">{currentWord || ' '}</p>
  <ul class="found-words">
    {#each recentFoundWords as found (found.word)}
      <li>{found.word} <span>+{found.points}</span></li>
    {/each}
  </ul>
</div>

<style>
  .play {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    width: min(94vw, 440px);
    height: 100%;
    min-height: 0;
  }

  .top-row {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    width: 100%;
    flex-shrink: 0;
  }

  .timer,
  .score {
    display: flex;
    align-items: baseline;
    gap: 4px;
    font-size: 1.15rem;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    padding: 8px 16px;
    border-radius: var(--radius-pill);
    background: var(--color-surface);
    box-shadow: var(--shadow-card);
    color: var(--color-ink);
  }

  .score span {
    font-size: 0.72rem;
    font-weight: 700;
    color: var(--color-ink-faint);
    text-transform: uppercase;
  }

  .popup-wrap,
  .grid-wrap {
    flex-shrink: 0;
  }

  .danger-overlay {
    position: fixed;
    inset: 0;
    z-index: 5;
    pointer-events: none;
    background: var(--color-danger);
    opacity: 0;
    animation: danger-pulse 1s ease-in-out infinite;
  }

  @keyframes danger-pulse {
    0%,
    100% {
      opacity: 0;
    }
    50% {
      opacity: 0.16;
    }
  }

  .timer.urgent {
    color: var(--color-danger);
    background: var(--color-danger-wash);
    animation: pulse 1s ease-in-out infinite;
  }

  @keyframes pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.55;
    }
  }

  .current-word {
    font-size: 1.3rem;
    font-weight: 700;
    min-height: 1.6em;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--color-accent);
    flex-shrink: 0;
  }

  .found-words {
    list-style: none;
    padding: 2px 2px 4px;
    margin: 0;
    display: flex;
    flex-wrap: wrap;
    align-content: flex-start;
    gap: 8px;
    justify-content: center;
    width: 100%;
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }

  .found-words li {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 0.85rem;
    font-weight: 700;
    padding: 6px 12px;
    border-radius: var(--radius-pill);
    background: var(--color-surface);
    box-shadow: var(--shadow-card);
  }

  .found-words li span {
    color: var(--color-stamp);
    font-weight: 700;
  }
</style>
