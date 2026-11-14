<script lang="ts">
  /**
   * Inserisce un disegno SVG già pronto (le icone di icons.ts e la scena della home, generata da scene.ts).
   * È l'unico punto dell'app che usa {@html}: il contenuto è sempre costruito dal codice, e i testi che arrivano
   * dai dati (nomi delle varianti) passano da escapeXml. Mai testo scritto dagli utenti.
   */
  let { svg }: { svg: string } = $props();
</script>

<!-- eslint-disable-next-line svelte/no-at-html-tags -->
{@html svg}
