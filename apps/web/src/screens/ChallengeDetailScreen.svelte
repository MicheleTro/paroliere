<script lang="ts">
  import {
    cancelChallenge,
    getChallenge,
    pointModeLabel,
    respondToChallenge,
    startChallenge,
    STATUS_LABEL,
    type ChallengeDetail,
  } from '../lib/challenges.js';
  import { formatDuration } from '../lib/format.js';

  interface Props {
    challengeId: string;
    onPlay: (challenge: ChallengeDetail, seed: number, remainingMs: number) => void;
    onBack: () => void;
  }

  let { challengeId, onPlay, onBack }: Props = $props();

  let challenge: ChallengeDetail | undefined = $state();
  let loading = $state(true);
  let busy = $state(false);
  let error: string | undefined = $state();
  let confirmCancel = $state(false);

  const opponent = $derived(challenge?.iAmChallenger ? challenge.opponent : challenge?.challenger);
  const opponentName = $derived(opponent?.username ?? 'il tuo amico');

  async function load(): Promise<void> {
    try {
      challenge = await getChallenge(challengeId);
      error = undefined;
    } catch (err) {
      error = err instanceof Error ? err.message : 'Errore imprevisto';
    } finally {
      loading = false;
    }
  }

  void load();

  async function run(action: () => Promise<void>): Promise<void> {
    busy = true;
    error = undefined;
    try {
      await action();
      await load();
    } catch (err) {
      error = err instanceof Error ? err.message : 'Errore imprevisto';
    } finally {
      busy = false;
      confirmCancel = false;
    }
  }

  async function play(): Promise<void> {
    if (!challenge) return;
    busy = true;
    error = undefined;
    try {
      const { startedAt, seed } = await startChallenge(challenge.id);
      const remainingMs = challenge.config.durationMs - (Date.now() - new Date(startedAt).getTime());
      if (remainingMs <= 0) {
        error = 'Il tempo per questa partita è scaduto.';
        await load();
        return;
      }
      onPlay(challenge, seed, remainingMs);
    } catch (err) {
      error = err instanceof Error ? err.message : 'Errore imprevisto';
    } finally {
      busy = false;
    }
  }

  const winnerId = $derived.by(() => {
    const scores = challenge?.scores;
    if (!scores || scores.length < 2) return undefined;
    const [a, b] = scores;
    if (a!.score === b!.score) return null; // pareggio
    return (a!.score ?? 0) > (b!.score ?? 0) ? a!.userId : b!.userId;
  });
</script>

<div class="page">
  {#if loading}
    <p class="empty-text">Caricamento...</p>
  {:else if !challenge}
    <p class="error-text">{error ?? 'Sfida non trovata'}</p>
  {:else}
    <h1>Sfida con {opponentName}</h1>
    <p class="status">{STATUS_LABEL[challenge.status]}</p>

    <div class="card config">
      {challenge.config.size}×{challenge.config.size} · {formatDuration(challenge.config.durationMs)} · min
      {challenge.config.minWordLength} lettere · {pointModeLabel(challenge.config)}
    </div>

    {#if challenge.status === 'invited' && !challenge.iAmChallenger}
      <p class="notice">{opponentName} ti ha sfidato. Vuoi accettare?</p>
      <div class="actions">
        <button type="button" class="btn btn-secondary" disabled={busy} onclick={() => run(() => respondToChallenge(challenge!.id, false))}>
          Rifiuta
        </button>
        <button type="button" class="btn btn-primary" disabled={busy} onclick={() => run(() => respondToChallenge(challenge!.id, true))}>
          Accetta
        </button>
      </div>
    {:else if challenge.status === 'invited'}
      <p class="notice">Aspetta che {opponentName} risponda. L'invito scade dopo 7 giorni.</p>
      {#if confirmCancel}
        <div class="actions">
          <button type="button" class="btn btn-secondary" disabled={busy} onclick={() => (confirmCancel = false)}>Annulla</button>
          <button type="button" class="btn btn-primary" disabled={busy} onclick={() => run(() => cancelChallenge(challenge!.id))}>
            Conferma: ritira
          </button>
        </div>
      {:else}
        <button type="button" class="btn btn-secondary btn-block" disabled={busy} onclick={() => (confirmCancel = true)}>
          Ritira la sfida
        </button>
      {/if}
    {:else if challenge.status === 'in_progress'}
      {#if !challenge.submittedByMe}
        <p class="notice">
          Tutti e due giocate la stessa griglia, quando volete. Il tempo parte appena premi Gioca ({formatDuration(
            challenge.config.durationMs,
          )}); una parola trovata solo da uno dei due vale il doppio.
        </p>
        <button type="button" class="btn btn-primary btn-block" disabled={busy} onclick={play}>
          {challenge.startedByMe ? 'Riprendi' : 'Gioca'}
        </button>
      {:else if challenge.opponentSubmitted}
        <p class="notice">Hanno giocato entrambi: sto calcolando il punteggio. Ricarica tra un attimo.</p>
        <button type="button" class="btn btn-secondary btn-block" disabled={busy} onclick={() => run(async () => {})}>Aggiorna</button>
      {:else}
        <p class="notice">Hai giocato. Il punteggio arriva quando giocherà anche {opponentName}.</p>
        <button type="button" class="btn btn-secondary btn-block" disabled={busy} onclick={() => run(async () => {})}>Aggiorna</button>
      {/if}
    {:else if challenge.status === 'completed' && challenge.scores}
      <p class="notice result">
        {#if winnerId === null}
          Pareggio!
        {:else if winnerId === (challenge.iAmChallenger ? challenge.challenger.id : challenge.opponent.id)}
          Hai vinto!
        {:else}
          Ha vinto {opponentName}.
        {/if}
      </p>
      <ul class="scores">
        {#each challenge.scores as s (s.userId)}
          <li class="card">
            <div class="head">
              <span class="name">{s.username ?? 'giocatore'}</span>
              <span class="points" class:winner={winnerId === s.userId}>{s.score ?? 0}</span>
            </div>
            <details>
              <summary>{s.words.length} parole</summary>
              <p class="words">
                {#each s.words as w (w.word)}
                  <span class="word">{w.word} <b>{w.points}</b></span>
                {/each}
              </p>
            </details>
          </li>
        {/each}
      </ul>
    {:else}
      <p class="notice">Questa sfida è {STATUS_LABEL[challenge.status].toLowerCase()}.</p>
    {/if}

    {#if error}
      <p class="error-text">{error}</p>
    {/if}
  {/if}

  <button type="button" class="btn btn-secondary btn-block" onclick={onBack}>Torna alle sfide</button>
</div>

<style>
  .status {
    margin: -6px 0 0;
    text-align: center;
    font-weight: 700;
    color: var(--color-ink-soft);
  }

  .config {
    text-align: center;
    font-size: 0.9rem;
    font-weight: 600;
  }

  .notice {
    margin: 0;
    padding: 12px 16px;
    text-align: center;
    font-size: 0.9rem;
    font-weight: 600;
    border-radius: var(--radius-md);
    background: var(--color-surface-alt);
    color: var(--color-ink-soft);
  }

  .notice.result {
    font-size: 1.1rem;
    color: var(--color-ink);
  }

  .actions {
    display: flex;
    gap: 10px;
  }

  .actions .btn {
    flex: 1;
  }

  .scores {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
  }

  .name {
    font-weight: 800;
  }

  .points {
    font-size: 1.6rem;
    font-weight: 800;
  }

  .points.winner {
    color: var(--color-success);
  }

  summary {
    cursor: pointer;
    font-size: 0.85rem;
    color: var(--color-ink-soft);
  }

  .words {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin: 8px 0 0;
  }

  .word {
    padding: 2px 8px;
    border-radius: var(--radius-pill);
    background: var(--color-surface-alt);
    font-size: 0.85rem;
  }
</style>
