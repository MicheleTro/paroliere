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
  import HomeScreen from './screens/HomeScreen.svelte';
  import ConfigScreen, { type GameSettings } from './screens/ConfigScreen.svelte';
  import LoginScreen from './screens/LoginScreen.svelte';
  import PlayScreen from './screens/PlayScreen.svelte';
  import SummaryScreen from './screens/SummaryScreen.svelte';
  import ChallengesScreen from './screens/ChallengesScreen.svelte';
  import CreateChallengeScreen from './screens/CreateChallengeScreen.svelte';
  import ChallengeDetailScreen from './screens/ChallengeDetailScreen.svelte';
  import ChallengeMatchSummaryScreen from './screens/ChallengeMatchSummaryScreen.svelte';
  import { randomSeed } from './lib/random-seed.js';
  import { getPersonalBest, saveGame } from './lib/history.js';
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
  let record = $state(0);
  let session: GameSession | undefined = $state();
  let summary: SessionSummary | undefined = $state();
  let now = $state(performance.now());
  let popup: WordPopupData | null = $state(null);
  let popupTimeout: ReturnType<typeof setTimeout> | undefined;

  let dictionaryVersion = '';
  let lastConfig: NewGameConfig | undefined;
  let rafId: number | undefined;

  let selectedChallengeId: string | undefined = $state();
  let challengeMatchContext: { challengeId: string; matchIndex: number } | undefined;
  let challengeResult: SubmitResultResponse | undefined = $state();

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
      generatorVersion: 1,
    });
  }

  function replaySameSeed(): void {
    if (lastConfig) requestNewGame(lastConfig);
  }

  function goToChallenges(): void {
    screen = 'challenges';
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
      generatorVersion: 1,
    });
  }

  function backToChallengeDetail(): void {
    challengeMatchContext = undefined;
    challengeResult = undefined;
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

    if (challengeMatchContext) {
      const { challengeId, matchIndex } = challengeMatchContext;
      const paths = session.foundWords.map((f) => f.path);
      submitMatchResult(challengeId, matchIndex, paths)
        .then((result) => (challengeResult = result))
        .catch((err) => {
          challengeResult = { found: [], settled: false };
          alert(err instanceof Error ? err.message : 'Errore imprevisto durante l\'invio del risultato');
        })
        .finally(() => (screen = 'challenge-match-summary'));
      return;
    }

    record = Math.max(record, summary.score);
    screen = 'summary';
    saveGame(session.config, summary, Date.now())
      .then(() => getPersonalBest())
      .then((best) => (record = best))
      .catch(() => {});
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
        break;
      case 'already_found':
        showPopup({ word, tone: 'yellow', subtitle: 'Già trovata' });
        vibrate([20, 30, 20]);
        break;
      case 'too_short':
        // Un percorso di 1-2 celle è quasi sempre un tap accidentale, non un
        // vero tentativo di parola: va ignorato senza mostrare errori.
        if (path.length > 2) {
          showPopup({ word, tone: 'red', subtitle: 'Troppo corta' });
          vibrate([20, 30, 20]);
        }
        break;
      case 'not_in_dictionary':
        showPopup({ word, tone: 'red', subtitle: 'Non valida' });
        vibrate([20, 30, 20]);
        break;
      case 'invalid_path':
        showPopup({ word, tone: 'red', subtitle: 'Percorso non valido' });
        vibrate([20, 30, 20]);
        break;
    }
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && screen === 'playing') {
      now = performance.now();
    }
  });

  navigator.storage?.persist?.().catch(() => {});
  getPersonalBest()
    .then((best) => (record = best))
    .catch(() => {});
  void checkSession();
</script>

<main>
  {#if auth.status === 'checking'}
    <p>Caricamento...</p>
  {:else if auth.status === 'unauthenticated'}
    <LoginScreen />
  {:else if screen === 'home'}
    <HomeScreen
      {ready}
      {record}
      username={auth.user?.username ?? ''}
      onNewGame={goToConfig}
      onChallenges={goToChallenges}
      onLogout={logout}
    />
  {:else if screen === 'config'}
    <ConfigScreen onStart={startNewGame} onBack={() => (screen = 'home')} />
  {:else if screen === 'playing' && session}
    <PlayScreen {session} {now} {popup} onSubmit={handleSubmit} />
  {:else if screen === 'summary' && session && summary}
    <SummaryScreen {session} {summary} onReplaySameSeed={replaySameSeed} onNewGame={goToConfig} />
  {:else if screen === 'challenges'}
    <ChallengesScreen
      currentUserId={auth.user?.id ?? ''}
      onOpen={openChallenge}
      onCreate={() => (screen = 'challenge-create')}
      onBack={() => (screen = 'home')}
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
  {:else if screen === 'challenge-match-summary' && session && summary && challengeResult}
    <ChallengeMatchSummaryScreen {session} {summary} result={challengeResult} onBack={backToChallengeDetail} />
  {/if}
</main>

<style>
  main {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    padding: 16px;
    font-family: system-ui, sans-serif;
  }
</style>
