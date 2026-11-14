<script lang="ts">
  interface Row {
    rank: number;
    userId: string;
    username: string;
    score: number;
    me: boolean;
    words?: string[];
  }

  interface Props {
    rows: Row[];
    /** Massimo di righe sotto il podio. */
    max?: number;
  }

  let { rows, max = 5 }: Props = $props();

  const top = $derived(rows.slice(0, 3));
  const rest = $derived.by(() => {
    const below = rows.slice(3);
    const meIndex = below.findIndex((r) => r.me);
    // Se ci sei ma saresti tagliato, resti in vista in fondo
    if (meIndex >= max) return [...below.slice(0, max - 1), below[meIndex]!];
    return below.slice(0, max);
  });

  const PODIUM = [
    { index: 1, height: 54, color: '#cdd3e3' },
    { index: 0, height: 72, color: '#ffc53d' },
    { index: 2, height: 40, color: '#f0a46b' },
  ];

  let peek: string | undefined = $state();
  const peeked = $derived(rows.find((r) => r.userId === peek));
</script>

<div class="podium">
  {#each PODIUM as slot (slot.index)}
    {@const r = top[slot.index]}
    {#if r}
      <button type="button" class="p" class:peekable={!!r.words} disabled={!r.words} onclick={() => (peek = peek === r.userId ? undefined : r.userId)}>
        <span class="avatar" style={r.me ? 'background:var(--blue);color:#fff' : ''}>{r.username[0]}</span>
        <span class="nm">{r.username}</span>
        <span class="blk" style:height="{slot.height}px" style:background={slot.color}>{r.score}</span>
      </button>
    {:else}
      <div class="p"></div>
    {/if}
  {/each}
</div>

{#if rest.length > 0}
  <div>
    {#each rest as r (r.userId)}
      <button type="button" class="rank" class:me={r.me} disabled={!r.words} onclick={() => (peek = peek === r.userId ? undefined : r.userId)}>
        <span class="pos num">{r.rank}</span>
        <span class="avatar">{r.username[0]}</span>
        <span class="nm">{r.username}</span>
        <span class="sc num">{r.score}</span>
      </button>
    {/each}
  </div>
{/if}

{#if peeked?.words}
  <div class="peek">
    <p class="muted">Parole di {peeked.username}</p>
    <div class="wgrid">
      {#each peeked.words as word (word)}<span class="wchip">{word}</span>{/each}
    </div>
  </div>
{/if}

<style>
  .p {
    background: none;
    border: 0;
    padding: 0;
    color: inherit;
    font: inherit;
  }

  .p.peekable {
    cursor: pointer;
  }

  .rank:disabled {
    cursor: default;
    color: inherit;
  }

  .peek {
    display: flex;
    flex-direction: column;
    gap: 6px;
    max-height: 22dvh;
    overflow-y: auto;
  }

  .peek p {
    font-size: 0.8rem;
  }
</style>
