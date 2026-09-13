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
    <button type="button" class="mute" aria-label={muted ? 'Attiva audio' : 'Disattiva audio'} onclick={toggleMute}>
      {muted ? '🔇' : '🔊'}
    </button>
  </div>
  <WordPopup {popup} />
  <GridView grid={session.grid} {onSubmit} onPathChange={handlePathChange} />
  <p class="current-word">{currentWord || ' '}</p>
  <p class="score">Punteggio: {score}</p>
  <ul class="found-words">
    {#each session.foundWords as found (found.word)}
      <li>{found.word} (+{found.points})</li>
    {/each}
  </ul>
</div>

<style>
  .play {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }

  .top-row {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .timer {
    font-size: 1.6rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }

  .mute {
    font-size: 1.1rem;
    padding: 4px 8px;
    border-radius: var(--radius-sm);
    border: 2px solid var(--color-border);
    background: var(--color-surface);
    cursor: pointer;
  }

  .timer.urgent {
    color: var(--color-danger);
    animation: pulse 1s ease-in-out infinite;
  }

  @keyframes pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }

  .current-word {
    font-size: 1.3rem;
    font-weight: 600;
    min-height: 1.6em;
    text-transform: uppercase;
  }

  .score {
    font-size: 1.2rem;
    font-weight: 600;
  }

  .found-words {
    list-style: none;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    justify-content: center;
  }
</style>
