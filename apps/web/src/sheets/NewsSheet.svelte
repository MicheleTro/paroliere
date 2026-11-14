<script lang="ts">
  import Svg from '../lib/Svg.svelte';
  import Sheet from '../lib/Sheet.svelte';
  import { ICONS } from '../lib/icons.js';
  import type { NewsAction, NewsItem } from '../lib/news.js';

  interface Props {
    items: NewsItem[];
    portalUrl?: string;
    onClose: () => void;
    onGo: (action: NewsAction) => void;
  }

  let { items, portalUrl, onClose, onGo }: Props = $props();
</script>

<Sheet title="Notizie" {onClose}>
  {#snippet badge()}
    <span class="vbadge" style="background: var(--blue-l)"><Svg svg={ICONS.bell} /></span>
  {/snippet}

  {#if items.length === 0}
    <p class="center muted pad">Niente di nuovo, per ora.</p>
  {:else}
    <div class="list">
      {#each items as item (item.key)}
        <div class="drow nohover">
          <span class="avatar">{item.mark}</span>
          <span class="grow">{item.text}</span>
          {#if item.action?.kind === 'portal' && portalUrl}
            <a class="btn btn-sm btn-gold" href={portalUrl}>Nel portale</a>
          {:else if item.action && item.action.kind !== 'portal'}
            <button type="button" class="btn btn-sm btn-gold" onclick={() => onGo(item.action!)}>Vai</button>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</Sheet>

<style>
  .vbadge :global(svg) {
    width: 30px;
    height: 30px;
  }

  .list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .nohover {
    cursor: default;
  }

  a.btn {
    text-decoration: none;
  }

  .pad {
    padding: 14px;
  }
</style>
