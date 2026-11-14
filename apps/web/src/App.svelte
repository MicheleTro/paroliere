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
  import ProfileScreen from './screens/ProfileScreen.svelte';
  import PlayScreen from './screens/PlayScreen.svelte';
  import SummaryScreen from './screens/SummaryScreen.svelte';
  import ChallengesScreen from './screens/ChallengesScreen.svelte';
  import CreateChallengeScreen from './screens/CreateChallengeScreen.svelte';
  import ChallengeDetailScreen from './screens/ChallengeDetailScreen.svelte';
  import ChallengeMatchSummaryScreen from './screens/ChallengeMatchSummaryScreen.svelte';
  import Screen from './lib/Screen.svelte';
  import { abandonPlay, finishPlay, markOnboarded, startPlay, type FinishedPlay } from './lib/plays.js';
  import { settings } from './lib/settings.svelte.js';
  import { startWeekDay, WEEK_NAME } from './lib/week.js';
  import { playAlreadyFound, playRejected, playWordAccepted } from './lib/sound.js';
  import { adminAuth } from './lib/admin.svelte.js';
  import { auth, checkSession, logout, watchPortalSession } from './lib/auth.svelte.js';
  import { abandonChallenge, submitChallengeResult, type ChallengeDetail, type SubmitResultResponse } from './lib/challenges.js';
  import type { WordPopupData } from './lib/word-popup.js';
  import { setDisplayForms } from './lib/display.js';
  import type { NewGameConfig, WorkerResponse } from './worker/dictionary-worker.js';

  const POPUP_DURATION_MS = 1500;

  type Screen =
    | 'home'
    | 'playing'
    | 'summary'
    | 'profile'
    | 'challenges'
    | 'challenge-create'
    | 'challenge-detail'
    | 'challenge-match-summary';

  let screen: Screen = $state('home');
  let ready = $state(false);
  let session: GameSession | undefined = $state();
  let summary: SessionSummary | undefined = $state();
  let playResult: FinishedPlay | undefined = $state();
  let playError: string | undefined = $state();
  let currentPlayId: string | undefined;
  /** Che partita è in corso o appena finita (cambia riepilogo e uscita). */
  let playKind: 'gioca' | 'settimana' = $state('gioca');
  let starting = $state(false);
  let now = $state(performance.now());
  let popup: WordPopupData | null = $state(null);
  let popupTimeout: ReturnType<typeof setTimeout> | undefined;

  let dictionaryVersion = '';
  let lastConfig: NewGameConfig | undefined;
  let rafId: number | undefined;

  /** La partita appena iniziata ha chiuso un ciclo di serie: il riepilogo mostra il regalo. */
  let giftPending = $state(false);
  /** Prima partita guidata (benvenuto): il bradipo suggerisce una parola. */
  let guided = $state(false);
  const guide = $derived.by(() => {
    if (!guided || !session) return undefined;
    const words = session.allSolutions;
    const pick = words.find((s) => s.word.length === 4) ?? words.find((s) => s.word.length >= 4) ?? words[0];
    return pick ? { word: pick.word, path: pick.path } : undefined;
  });
  let selectedChallengeId: string | undefined = $state();
  let challengeMatchContext: { challengeId: string } | undefined = $state();
  let challengeResult: SubmitResultResponse | undefined = $state();
  let challengeSubmitError: string | undefined = $state();

  const worker = new Worker(new URL('./worker/dictionary-worker.ts', import.meta.url), {
    type: 'module',
  });

  worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
    const message = event.data;
    if (message.type === 'ready') {
      dictionaryVersion = message.dictionaryVersion;
      setDisplayForms(message.display);
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

  /** Gioca: il server decide seed e inizio (e riprende una partita già iniziata, se c'è). */
  async function startGioca(wantsGuide = false): Promise<void> {
    if (!ready || starting) return;
    guided = wantsGuide === true;
    starting = true;
    try {
      const play = await startPlay();
      if (play.config.dictionaryVersion !== dictionaryVersion) {
        alert('Il dizionario locale non corrisponde a quello del server: ricarica la pagina e riprova.');
        return;
      }
      currentPlayId = play.id;
      giftPending = play.streakCycleCompleted === true;
      playKind = 'gioca';
      challengeMatchContext = undefined;
      playResult = undefined;
      playError = undefined;
      requestNewGame({ ...play.config, durationMs: play.remainingMs });
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Impossibile iniziare la partita');
    } finally {
      starting = false;
    }
  }

  /** Settimana: il server consegna la griglia già pronta e l'ora di inizio (un solo tentativo per griglia). */
  async function startWeekGame(day: number, help: boolean): Promise<void> {
    const play = await startWeekDay(day, help);
    currentPlayId = play.id;
    giftPending = play.streakCycleCompleted === true;
    playKind = 'settimana';
    challengeMatchContext = undefined;
    playResult = undefined;
    playError = undefined;
    const config: GameConfig = { ...play.config, durationMs: play.remainingMs };
    session = createSession(config, play.grid, play.solutions, performance.now());
    screen = 'playing';
    startTimerLoop();
  }

  function goToChallenges(): void {
    screen = 'challenges';
  }

  function goHome(): void {
    screen = 'home';
  }

  const screenTitle = $derived(
    screen === 'challenges'
      ? 'Sfide'
      : screen === 'challenge-create'
        ? 'Nuova sfida'
        : screen === 'challenge-detail'
          ? 'Sfida'
          : screen === 'challenge-match-summary'
            ? 'Partita'
            : undefined,
  );

  /** La freccia in alto: torna al livello sopra (non sempre alla home). */
  function goBack(): void {
    switch (screen) {
      case 'challenge-create':
      case 'challenge-detail':
        screen = 'challenges';
        break;
      default:
        screen = 'home';
    }
  }

  function openChallenge(challengeId: string): void {
    selectedChallengeId = challengeId;
    screen = 'challenge-detail';
  }

  function playChallenge(challenge: ChallengeDetail, seed: number, remainingMs: number): void {
    if (challenge.config.dictionaryVersion !== dictionaryVersion) {
      alert('Il dizionario locale non corrisponde a quello del server: ricarica la pagina e riprova.');
      return;
    }
    challengeMatchContext = { challengeId: challenge.id };
    currentPlayId = undefined;
    requestNewGame({
      seed,
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
    // Percorsi e momenti: il server rivaluta tutto, il client non dichiara punteggi (RF-22)
    const words = session.foundWords.map((f) => ({ path: f.path, atMs: Math.round(f.atMs) }));

    if (challengeMatchContext) {
      const { challengeId } = challengeMatchContext;
      challengeResult = undefined;
      challengeSubmitError = undefined;
      submitChallengeResult(challengeId, words)
        .then((result) => (challengeResult = result))
        .catch((err) => (challengeSubmitError = err instanceof Error ? err.message : 'Errore imprevisto'))
        .finally(() => (screen = 'challenge-match-summary'));
      return;
    }

    playResult = undefined;
    playError = undefined;
    screen = 'summary';
    if (guided) void markOnboarded().catch(() => {});
    guided = false;
    if (!currentPlayId) return;
    finishPlay(currentPlayId, words)
      .then((result) => (playResult = result))
      .catch((err) => (playError = err instanceof Error ? err.message : 'Errore imprevisto'));
  }

  /** Uscita volontaria (già confermata): niente punteggio, niente riepilogo, la partita non conta. */
  function quitGame(): void {
    stopTimerLoop();
    const challengeId = challengeMatchContext?.challengeId;
    const playId = currentPlayId;
    session = undefined;
    summary = undefined;
    popup = null;
    if (challengeId) {
      challengeMatchContext = undefined;
      screen = 'challenge-detail';
      void abandonChallenge(challengeId).catch((err) => console.error('Uscita dalla sfida non registrata', err));
    } else {
      screen = 'home';
      if (playId) void abandonPlay(playId).catch((err) => console.error('Uscita dalla partita non registrata', err));
    }
    currentPlayId = undefined;
  }

  function showPopup(data: WordPopupData): void {
    if (popupTimeout) clearTimeout(popupTimeout);
    popup = data;
    popupTimeout = setTimeout(() => {
      popup = null;
    }, POPUP_DURATION_MS);
  }

  function vibrate(pattern: number | number[]): void {
    if (settings.values.vibration) navigator.vibrate?.(pattern);
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
  void checkSession().then(() => {
    if (auth.status === 'authenticated') void settings.load();
  });
  watchPortalSession(() => screen === 'playing');
</script>

<main class="app-root">
  {#if auth.status === 'checking'}
    <div class="screen pattern"><p class="status outline-text">Caricamento…</p></div>
  {:else if auth.status === 'unauthenticated'}
    <div class="screen pattern"><p class="status outline-text">Accesso tramite whoru…</p></div>
  {:else if adminAuth.open && auth.user?.isAdmin}
    <div class="screen pattern"><div class="content"><AdminScreen /></div></div>
  {:else if screen === 'playing' && session}
    <PlayScreen
      {session}
      {now}
      {popup}
      title={playKind === 'settimana' && !challengeMatchContext ? WEEK_NAME : challengeMatchContext ? 'Sfida' : 'Gioca'}
      onSubmit={handleSubmit}
      onQuit={quitGame}
      {guide}
      stars={playKind === 'gioca' && !challengeMatchContext}
      duel={!!challengeMatchContext}
      quitWarning={playKind === 'settimana' && !challengeMatchContext
        ? 'Perderai il punteggio e anche il tentativo: la griglia di ' + WEEK_NAME + ' si gioca una sola volta.'
        : undefined}
    />
  {:else if screen === 'home'}
    <HomeScreen
      {ready}
      portalUrl={auth.user?.portalUrl}
      onNewGame={startGioca}
      onPlayDay={startWeekGame}
      onProfile={() => (screen = 'profile')}
      onChallenges={goToChallenges}
    />
  {:else if screen === 'profile'}
    <ProfileScreen
      onBack={goHome}
      portalUrl={auth.user?.portalUrl}
      username={auth.user?.username ?? ''}
      onLogout={logout}
      onAdmin={auth.user?.isAdmin ? () => (adminAuth.open = true) : undefined}
    />
  {:else}
    <Screen onBack={goBack} title={screenTitle}>
      {#if screen === 'summary' && session && summary}
        <SummaryScreen
          {session}
          {summary}
          result={playResult}
          error={playError}
          mode={playKind}
          gift={giftPending}
          onNewGame={() => startGioca()}
          onHome={goHome}
        />
      {:else if screen === 'challenges'}
        <ChallengesScreen onOpen={openChallenge} onCreate={() => (screen = 'challenge-create')} />
      {:else if screen === 'challenge-create'}
        <CreateChallengeScreen portalUrl={auth.user?.portalUrl ?? '/'} onCreated={openChallenge} onBack={goToChallenges} />
      {:else if screen === 'challenge-detail' && selectedChallengeId}
        <ChallengeDetailScreen challengeId={selectedChallengeId} onPlay={playChallenge} onBack={goToChallenges} />
      {:else if screen === 'challenge-match-summary' && session && summary && (challengeResult || challengeSubmitError)}
        <ChallengeMatchSummaryScreen
          {session}
          {summary}
          result={challengeResult}
          error={challengeSubmitError}
          onBack={backToChallengeDetail}
        />
      {/if}
    </Screen>
  {/if}
</main>

<style>
  .status {
    margin: auto;
    font-family: var(--f-display);
    font-size: 1.4rem;
    text-align: center;
  }
</style>
