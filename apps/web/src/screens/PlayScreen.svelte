<script lang="ts">
  import { remainingMs, type GameSession } from '@paroliere/core';
  import GridView from '../lib/GridView.svelte';
  import WordPopup from '../lib/WordPopup.svelte';
  import type { WordPopupData } from '../lib/word-popup.js';
  import { formatDuration } from '../lib/format.js';
  import { isSoundMuted, playPathTone, setSoundMuted } from '../lib/sound.js';

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

  const currentWord = $derived(currentPath.map((i) => session.grid.tiles[i]).join(''));

  const score = $derived(session.foundWords.reduce((sum, f) => sum + f.points, 0));

  const timeLeft = $derived(remainingMs(session, now));
  const urgent = $derived(timeLeft <= 10_000);

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
  <div class="top-row">
    <p class="timer" class:urgent>{formatDuration(timeLeft)}</p>
    <p class="score">{score} <span>pt</span></p>
    <button type="button" class="btn-icon" aria-label={muted ? 'Attiva audio' : 'Disattiva audio'} onclick={toggleMute}>
      {muted ? '🔇' : '🔊'}
    </button>
  </div>
  <WordPopup {popup} />
  <GridView
    grid={session.grid}
    {onSubmit}
    onPathChange={handlePathChange}
    pointMode={session.config.pointMode}
    positionBonus={session.config.positionBonus}
  />
  <p class="current-word">{currentWord || ' '}</p>
  <ul class="found-words">
    {#each session.foundWords as found (found.word)}
      <li>{found.word} <span>+{found.points}</span></li>
    {/each}
  </ul>
</div>

<style>
  .play {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
    width: min(94vw, 440px);
  }

  .top-row {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    width: 100%;
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
  }

  .found-words {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    justify-content: center;
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
