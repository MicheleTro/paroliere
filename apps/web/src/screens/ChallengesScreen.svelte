<script lang="ts">
  import { untrack } from 'svelte';
  import { listChallenges, STATUS_LABEL, type ChallengeSummary, type Outcome } from '../lib/challenges.js';
  import { formatDuration } from '../lib/format.js';
  import { live } from '../lib/live.svelte.js';
  import NotificationsToggle from '../lib/NotificationsToggle.svelte';

  interface Props {
    onOpen: (challengeId: string) => void;
    onCreate: () => void;
  }

  let { onOpen, onCreate }: Props = $props();

  let challenges: ChallengeSummary[] = $state([]);
  let loading = $state(true);
  let error: string | undefined = $state();

  // Filtri delle sfide concluse
  let playerFilter = $state('');
  let outcomeFilter: Outcome | '' = $state('');

  // Da fare: tocca a me (rispondere a un invito, oppure giocare: chi lancia la sfida può giocare subito).
  // In attesa: tocca all'altro. Concluse: il resto.
  const isTodo = (c: ChallengeSummary) =>
    (c.status === 'invited' && (!c.iAmChallenger || !c.submittedByMe)) || (c.status === 'in_progress' && !c.submittedByMe);
  const isWaiting = (c: ChallengeSummary) =>
    (c.status === 'invited' && c.iAmChallenger && c.submittedByMe) || (c.status === 'in_progress' && c.submittedByMe);

  const todo = $derived(challenges.filter(isTodo));
  const waiting = $derived(challenges.filter(isWaiting));
  const closed = $derived(challenges.filter((c) => !isTodo(c) && !isWaiting(c)));
  const players = $derived(
    [...new Map(closed.map((c) => [c.opponent.id, c.opponent.username ?? 'giocatore'])).entries()].sort((a, b) =>
      a[1].localeCompare(b[1]),
    ),
  );
  const closedFiltered = $derived(
    closed.filter(
      (c) => (!playerFilter || c.opponent.id === playerFilter) && (!outcomeFilter || c.outcome === outcomeFilter),
    ),
  );
  const filtering = $derived(playerFilter !== '' || outcomeFilter !== '');
  const tally = $derived({
    won: closedFiltered.filter((c) => c.outcome === 'won').length,
    lost: closedFiltered.filter((c) => c.outcome === 'lost').length,
    draw: closedFiltered.filter((c) => c.outcome === 'draw').length,
  });

  async function load(): Promise<void> {
    try {
      challenges = await listChallenges();
      error = undefined;
    } catch (err) {
      error = err instanceof Error ? err.message : 'Errore imprevisto';
    } finally {
      loading = false;
    }
  }

  // Ricarica a ogni aggiornamento dal server (nuovo invito, sfida accettata, giocata, conclusa)
  $effect(() => {
    void live.version;
    untrack(() => void load());
  });

  function headline(c: ChallengeSummary): string {
    const name = c.opponent.username ?? 'un amico';
    if (c.status === 'invited') return c.iAmChallenger ? `Hai sfidato ${name}` : `${name} ti ha sfidato`;
    return `Sfida con ${name}`;
  }

  function detail(c: ChallengeSummary): string {
    if (c.status === 'completed') return `${c.myScore ?? 0} – ${c.opponentScore ?? 0}`;
    if (c.status === 'invited' && c.iAmChallenger) return c.submittedByMe ? 'In attesa di risposta' : 'Gioca ora';
    if (c.status === 'in_progress') {
      if (!c.submittedByMe) return 'Tocca a te';
      return c.opponentSubmitted ? 'Calcolo del punteggio…' : "Aspetta l'altro";
    }
    return STATUS_LABEL[c.status];
  }

  const OUTCOME_LABEL: Record<Outcome, string> = { won: 'Vinta', lost: 'Persa', draw: 'Pari' };
</script>

{#snippet item(c: ChallengeSummary, urgent: boolean)}
  <li>
    <button
      type="button"
      class="challenge card"
      class:won={c.outcome === 'won'}
      class:lost={c.outcome === 'lost'}
      onclick={() => onOpen(c.id)}
    >
      <span class="row">
        <span class="who">{headline(c)}</span>
        <span
          class="badge"
          class:badge-warning={urgent}
          class:badge-success={c.outcome === 'won'}
          class:badge-danger={c.outcome === 'lost'}
        >
          {detail(c)}
        </span>
      </span>
      <span class="config">
        {#if c.outcome}<b>{OUTCOME_LABEL[c.outcome]}</b> ·{/if}
        {#if c.config}
          {c.config.size}×{c.config.size} · {formatDuration(c.config.durationMs)} · min {c.config.minWordLength} lettere
        {/if}
      </span>
    </button>
  </li>
{/snippet}

<div class="page">
  <h1>Sfide</h1>

  <NotificationsToggle />

  {#if loading}
    <p class="empty-text">Caricamento...</p>
  {:else if error}
    <p class="error-text">{error}</p>
  {:else if challenges.length === 0}
    <p class="empty-text">Nessuna sfida. Sfida un amico per iniziare.</p>
  {/if}

  <div class="actions">
    <button type="button" class="btn btn-primary btn-block" onclick={onCreate}>+ Sfida un amico</button>
  </div>

  {#if todo.length > 0}
    <h2>Da fare</h2>
    <ul>
      {#each todo as c (c.id)}{@render item(c, true)}{/each}
    </ul>
  {/if}

  {#if waiting.length > 0}
    <h2>In attesa</h2>
    <ul>
      {#each waiting as c (c.id)}{@render item(c, false)}{/each}
    </ul>
  {/if}

  {#if closed.length > 0}
    <h2>Concluse</h2>
    <div class="filters">
      <select bind:value={playerFilter} aria-label="Filtra per giocatore">
        <option value="">Tutti i giocatori</option>
        {#each players as [id, name] (id)}
          <option value={id}>{name}</option>
        {/each}
      </select>
      <div class="chips" role="group" aria-label="Filtra per risultato">
        {#each [['', 'Tutte'], ['won', 'Vinte'], ['lost', 'Perse'], ['draw', 'Pari']] as [value, label] (value)}
          <button
            type="button"
            class="chip chip-{value || 'all'}"
            class:active={outcomeFilter === value}
            aria-pressed={outcomeFilter === value}
            onclick={() => (outcomeFilter = value as Outcome | '')}
          >
            {label}
          </button>
        {/each}
      </div>
      <p class="tally">
        <span class="won-text">{tally.won} vinte</span> · <span class="lost-text">{tally.lost} perse</span> · {tally.draw} pari
      </p>
    </div>
    {#if closedFiltered.length === 0}
      <p class="empty-text">Nessuna sfida con questi filtri.</p>
    {:else}
      <ul>
        {#each closedFiltered as c (c.id)}{@render item(c, false)}{/each}
      </ul>
    {/if}
    {#if filtering}
      <button
        type="button"
        class="btn btn-secondary btn-sm"
        onclick={() => {
          playerFilter = '';
          outcomeFilter = '';
        }}
      >
        Togli i filtri
      </button>
    {/if}
  {/if}
</div>

<style>
  h2 {
    margin: 10px 0 2px;
    font-size: 0.95rem;
    color: var(--color-ink-soft);
  }

  ul {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .challenge {
    display: flex;
    flex-direction: column;
    gap: 6px;
    width: 100%;
    text-align: left;
    cursor: pointer;
    border: 1.5px solid var(--color-border);
    border-left: 5px solid var(--color-border);
  }

  .challenge.won {
    border-left-color: var(--color-success);
    background: var(--color-success-wash);
  }

  .challenge.lost {
    border-left-color: var(--color-danger);
    background: var(--color-danger-wash);
  }

  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }

  .who {
    font-weight: 800;
  }

  .config {
    font-size: 0.82rem;
    color: var(--color-ink-faint);
  }

  .won .config b {
    color: var(--color-success);
  }

  .lost .config b {
    color: var(--color-danger);
  }

  .badge-danger {
    background: var(--color-danger);
    color: #fff;
  }

  .filters {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  select {
    width: 100%;
    padding: 8px 10px;
    border-radius: var(--radius-md);
    border: 1.5px solid var(--color-border);
    background: var(--color-surface);
    color: var(--color-ink);
    font: inherit;
    font-weight: 600;
  }

  .chips {
    display: flex;
    gap: 6px;
  }

  .chip {
    flex: 1;
    padding: 6px 8px;
    border-radius: var(--radius-pill);
    border: 1.5px solid var(--color-border);
    background: var(--color-surface);
    color: var(--color-ink-soft);
    font-weight: 700;
    font-size: 0.82rem;
    cursor: pointer;
  }

  .chip.active {
    background: var(--color-accent);
    border-color: var(--color-accent);
    color: var(--color-accent-contrast);
  }

  .chip-won.active {
    background: var(--color-success);
    border-color: var(--color-success);
  }

  .chip-lost.active {
    background: var(--color-danger);
    border-color: var(--color-danger);
  }

  .tally {
    margin: 0;
    font-size: 0.8rem;
    font-weight: 700;
    color: var(--color-ink-soft);
  }

  .won-text {
    color: var(--color-success);
  }

  .lost-text {
    color: var(--color-danger);
  }
</style>
