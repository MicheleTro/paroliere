<script lang="ts">
  import {
    createSession,
    isOver,
    submitPath,
    summarize,
    type GameConfig,
    type GameSession,
    type SessionSummary,
  } from '@paroliere/core';
  import AdminScreen from './screens/AdminScreen.svelte';
  import HomeScreen from './screens/HomeScreen.svelte';
  import ConfigScreen, { type GameSettings } from './screens/ConfigScreen.svelte';
  import LoginScreen from './screens/LoginScreen.svelte';
  import PlayScreen from './screens/PlayScreen.svelte';
  import SummaryScreen from './screens/SummaryScreen.svelte';
  import ChallengesScreen from './screens/ChallengesScreen.svelte';
  import CreateChallengeScreen from './screens/CreateChallengeScreen.svelte';
  import ChallengeDetailScreen from './screens/ChallengeDetailScreen.svelte';
  import ChallengeMatchSummaryScreen from './screens/ChallengeMatchSummaryScreen.svelte';
  import AppShell from './lib/AppShell.svelte';
  import { randomSeed } from './lib/random-seed.js';
  import { saveGame, syncGame } from './lib/history.js';
  import { getWordStats, type WordStats } from './lib/stats.js';
  import { playAlreadyFound, playRejected, playWordAccepted } from './lib/sound.js';
  import { adminAuth } from './lib/admin.svelte.js';
  import { auth, checkSession, logout } from './lib/auth.svelte.js';
  import { submitMatchResult, type ChallengeDetail, type ChallengeMatch, type SubmitResultResponse } from './lib/challenges.js';
  import type { WordPopupData } from './lib/word-popup.js';
  import type { NewGameConfig, WorkerResponse } from './worker/dictionary-worker.js';

  const POPUP_DURATION_MS = 1500;

  type Screen =
    | 'home'
    | 'config'
    | 'playing'
    | 'summary'
    | 'challenges'
    | 'challenge-create'
    | 'challenge-detail'
    | 'challenge-match-summary';

  let screen: Screen = $state('home');
  let ready = $state(false);
  let session: GameSession | undefined = $state();
  let summary: SessionSummary | undefined = $state();
  let typeStats: WordStats | undefined = $state();
  let now = $state(performance.now());
  let popup: WordPopupData | null = $state(null);
  let popupTimeout: ReturnType<typeof setTimeout> | undefined;

  let dictionaryVersion = '';
  let lastConfig: NewGameConfig | undefined;
  let rafId: number | undefined;

  let selectedChallengeId: string | undefined = $state();
  let challengeMatchContext: { challengeId: string; matchIndex: number } | undefined;
  let challengeResult: SubmitResultResponse | undefined = $state();
  let challengeSubmitError: string | undefined = $state();

  const worker = new Worker(new URL('./worker/dictionary-worker.ts', import.meta.url), {
    type: 'module',
  });

  worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
    const message = event.data;
    if (message.type === 'ready') {
      dictionaryVersion = message.dictionaryVersion;
      ready = true;
      return;
    }

    if (!lastConfig) return;
    const config: GameConfig = { ...lastConfig, dictionaryVersion };
    session = createSession(config, message.grid, message.solutions, performance.now());
    screen = 'playing';
    startTimerLoop();
  };

  function requestNewGame(config: NewGameConfig): void {
    lastConfig = config;
    worker.postMessage({ type: 'newGame', config });
  }

  function goToConfig(): void {
    screen = 'config';
  }

  function startNewGame(settings: GameSettings): void {
    requestNewGame({
      seed: randomSeed(),
      size: settings.size,
      durationMs: settings.durationMs,
      minWordLength: settings.minWordLength,
      minWords: 50,
      scoring: 'classic',
      pointMode: settings.pointMode,
      positionBonus: settings.positionBonus,
      generatorVersion: 1,
    });
  }

  function goToChallenges(): void {
    screen = 'challenges';
  }

  function goHome(): void {
    screen = 'home';
  }

  function openChallenge(challengeId: string): void {
    selectedChallengeId = challengeId;
    screen = 'challenge-detail';
  }

  function playChallengeMatch(challenge: ChallengeDetail, match: ChallengeMatch, remainingMs: number): void {
    if (challenge.config.dictionaryVersion !== dictionaryVersion) {
      alert('Il dizionario locale non corrisponde a quello del server: ricarica la pagina e riprova.');
      return;
    }
    challengeMatchContext = { challengeId: challenge.id, matchIndex: match.matchIndex };
    requestNewGame({
      seed: match.seed,
      size: challenge.config.size,
      durationMs: remainingMs,
      minWordLength: challenge.config.minWordLength,
      minWords: challenge.config.minWords,
      scoring: challenge.config.scoring,
      pointMode: challenge.config.pointMode,
      positionBonus: challenge.config.positionBonus,
      generatorVersion: 1,
    });
  }

  function backToChallengeDetail(): void {
    challengeMatchContext = undefined;
    challengeResult = undefined;
    challengeSubmitError = undefined;
    screen = 'challenge-detail';
  }

  function startTimerLoop(): void {
    stopTimerLoop();
    const tick = (): void => {
      now = performance.now();
      if (session && isOver(session, now)) {
        finishGame();
        return;
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
  }

  function stopTimerLoop(): void {
    if (rafId !== undefined) cancelAnimationFrame(rafId);
    rafId = undefined;
  }

  function finishGame(): void {
    stopTimerLoop();
    if (!session) return;
    summary = summarize(session);
    typeStats = undefined;
    const { size, durationMs } = session.config;

    if (challengeMatchContext) {
      const { challengeId, matchIndex } = challengeMatchContext;
      const paths = session.foundWords.map((f) => f.path);
      challengeResult = undefined;
      challengeSubmitError = undefined;
      submitMatchResult(challengeId, matchIndex, paths)
        .then((result) => {
          challengeResult = result;
          return getWordStats(size, durationMs);
        })
        .then((stats) => (typeStats = stats))
        .catch((err) => {
          if (!challengeResult) {
            challengeSubmitError = err instanceof Error ? err.message : 'Errore imprevisto';
          } else {
            console.error('Statistiche match sfida non riuscite', err);
          }
        })
        .finally(() => (screen = 'challenge-match-summary'));
      return;
    }

    screen = 'summary';
    saveGame(session.config, summary, Date.now())
      .then((record) => syncGame(record))
      .then(() => getWordStats(size, durationMs))
      .then((stats) => (typeStats = stats))
      .catch((err) => console.error('Sync/statistiche allenamento non riuscite', err));
  }

  function showPopup(data: WordPopupData): void {
    if (popupTimeout) clearTimeout(popupTimeout);
    popup = data;
    popupTimeout = setTimeout(() => {
      popup = null;
    }, POPUP_DURATION_MS);
  }

  function vibrate(pattern: number | number[]): void {
    navigator.vibrate?.(pattern);
  }

  function handleSubmit(path: number[]): void {
    if (!session) return;
    const word = path.map((i) => session!.grid.tiles[i]).join('');
    const { session: nextSession, result } = submitPath(session, path, performance.now());
    session = nextSession;

    if (result.kind === 'time_over') {
      finishGame();
      return;
    }

    switch (result.kind) {
      case 'valid':
        showPopup({ word, tone: 'green' });
        vibrate(30);
        playWordAccepted(word.length);
        break;
      case 'already_found':
        showPopup({ word, tone: 'yellow', subtitle: 'Già trovata' });
        vibrate([20, 30, 20]);
        playAlreadyFound();
        break;
      case 'too_short':
        // Un percorso di 1-2 celle è quasi sempre un tap accidentale, non un
        // vero tentativo di parola: va ignorato senza mostrare errori.
        if (path.length > 2) {
          showPopup({ word, tone: 'red', subtitle: 'Troppo corta' });
          vibrate([20, 30, 20]);
          playRejected();
        }
        break;
      case 'not_in_dictionary':
        showPopup({ word, tone: 'red', subtitle: 'Non valida' });
        vibrate([20, 30, 20]);
        playRejected();
        break;
      case 'invalid_path':
        showPopup({ word, tone: 'red', subtitle: 'Percorso non valido' });
        vibrate([20, 30, 20]);
        playRejected();
        break;
    }
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && screen === 'playing') {
      now = performance.now();
    }
  });

  navigator.storage?.persist?.().catch(() => {});
  void checkSession();
</script>

<main>
  {#if adminAuth.loggedIn}
    <AdminScreen />
  {:else if auth.status === 'checking'}
    <p>Caricamento...</p>
  {:else if auth.status === 'unauthenticated'}
    <LoginScreen />
  {:else if screen === 'playing' && session}
    <PlayScreen {session} {now} {popup} onSubmit={handleSubmit} />
  {:else}
    <AppShell username={auth.user?.username ?? ''} showHome={screen !== 'home'} onHome={goHome} onLogout={logout}>
      {#if screen === 'home'}
        <HomeScreen {ready} onNewGame={goToConfig} onChallenges={goToChallenges} />
      {:else if screen === 'config'}
        <ConfigScreen onStart={startNewGame} onBack={goHome} />
      {:else if screen === 'summary' && session && summary}
        <SummaryScreen {session} {summary} {typeStats} onNewGame={goToConfig} onHome={goHome} />
      {:else if screen === 'challenges'}
        <ChallengesScreen
          currentUserId={auth.user?.id ?? ''}
          onOpen={openChallenge}
          onCreate={() => (screen = 'challenge-create')}
        />
      {:else if screen === 'challenge-create'}
        <CreateChallengeScreen onCreated={openChallenge} onBack={goToChallenges} />
      {:else if screen === 'challenge-detail' && selectedChallengeId}
        <ChallengeDetailScreen
          challengeId={selectedChallengeId}
          currentUserId={auth.user?.id ?? ''}
          onPlayMatch={playChallengeMatch}
          onBack={goToChallenges}
        />
      {:else if screen === 'challenge-match-summary' && session && summary && (challengeResult || challengeSubmitError)}
        <ChallengeMatchSummaryScreen
          {session}
          {summary}
          {typeStats}
          result={challengeResult}
          error={challengeSubmitError}
          onBack={backToChallengeDetail}
        />
      {/if}
    </AppShell>
  {/if}
</main>

<style>
  main {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    min-height: 100vh;
    padding: calc(16px + env(safe-area-inset-top, 0px)) 16px calc(16px + env(safe-area-inset-bottom, 0px));
  }
</style>
