<script lang="ts">
  import { INFO } from '../lib/info.js';
  import Sheet from '../lib/Sheet.svelte';

  interface Props {
    /** Una chiave di INFO oppure un testo libero [titolo, corpo]. */
    topic: string | [string, string];
    onClose: () => void;
  }

  let { topic, onClose }: Props = $props();

  const content = $derived(typeof topic === 'string' ? (INFO[topic] ?? ['Informazioni', '']) : topic);
</script>

<Sheet title={content[0]} mid {onClose}>
  <p class="body">{content[1]}</p>
</Sheet>

<style>
  .body {
    font-size: 1.05rem;
  }
</style>
