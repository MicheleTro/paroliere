<script lang="ts">
  import { listChallenges, STATUS_LABEL, type ChallengeSummary } from '../lib/challenges.js';
  import { formatDuration } from '../lib/format.js';

  interface Props {
    onOpen: (challengeId: string) => void;
    onCreate: () => void;
  }

  let { onOpen, onCreate }: Props = $props();

  let challenges: ChallengeSummary[] = $state([]);
  let loading = $state(true);
  let error: string | undefined = $state();

  // Da fare: tocca a me (rispondere a un invito, oppure giocare). In attesa: tocca all'altro. Concluse: il resto.
  const todo = $derived(
    challenges.filter(
      (c) => (c.status === 'invited' && !c.iAmChallenger) || (c.status === 'in_progress' && !c.submittedByMe),
    ),
  );
  const waiting = $derived(
    challenges.filter(
      (c) => (c.status === 'invited' && c.iAmChallenger) || (c.status === 'in_progress' && c.submittedByMe),
    ),
  );
  const closed = $derived(challenges.filter((c) => !todo.includes(c) && !waiting.includes(c)));
  const groups = $derived([
    { title: 'Da fare', items: todo },
    { title: 'In attesa', items: waiting },
    { title: 'Concluse', items: closed },
  ]);

  listChallenges()
    .then((result) => (challenges = result))
    .catch((err) => (error = err instanceof Error ? err.message : 'Errore imprevisto'))
    .finally(() => (loading = false));

  function headline(c: ChallengeSummary): string {
    const name = c.opponent.username ?? 'un amico';
    if (c.status === 'invited') return c.iAmChallenger ? `Hai sfidato ${name}` : `${name} ti ha sfidato`;
    return `Sfida con ${name}`;
  }

  function detail(c: ChallengeSummary): string {
    if (c.status === 'completed') return `${c.myScore ?? 0} – ${c.opponentScore ?? 0}`;
    if (c.status === 'in_progress') {
      if (!c.submittedByMe) return 'Tocca a te';
      return c.opponentSubmitted ? 'Calcolo del punteggio…' : "Aspetta l'altro";
    }
    return STATUS_LABEL[c.status];
  }
</script>

<div class="page">
  <h1>Sfide</h1>

  {#if loading}
    <p class="empty-text">Caricamento...</p>
  {:else if error}
    <p class="error-text">{error}</p>
  {:else if challenges.length === 0}
    <p class="empty-text">Nessuna sfida. Sfida un amico per iniziare.</p>
  {/if}

  <div class="lists scroll-box">
  {#each groups as group (group.title)}
    {#if group.items.length > 0}
      <h2>{group.title}</h2>
      <ul>
        {#each group.items as c (c.id)}
          <li>
            <button type="button" class="challenge card" onclick={() => onOpen(c.id)}>
              <span class="row">
                <span class="who">{headline(c)}</span>
                <span class="badge" class:badge-warning={group.title === 'Da fare'} class:badge-success={c.status === 'completed'}>
                  {detail(c)}
                </span>
              </span>
              {#if c.config}
                <span class="config">
                  {c.config.size}×{c.config.size} · {formatDuration(c.config.durationMs)} · min {c.config.minWordLength} lettere
                </span>
              {/if}
            </button>
          </li>
        {/each}
      </ul>
    {/if}
  {/each}
  </div>

  <div class="actions">
    <button type="button" class="btn btn-primary btn-block" onclick={onCreate}>+ Sfida un amico</button>
  </div>
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

  .actions {
    flex-shrink: 0;
    margin-top: 4px;
  }
</style>
