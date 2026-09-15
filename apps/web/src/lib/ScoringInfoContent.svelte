<script lang="ts">
  import { baseWordValue } from '@paroliere/core';

  interface Props {
    kind: 'standard' | 'speciale' | 'position-bonus';
  }

  let { kind }: Props = $props();

  const LENGTHS = [3, 4, 5, 6, 7, 8];
</script>

{#if kind === 'standard'}
  <p>Più è lunga la parola più punti dà:</p>
  <table class="mini-table">
    <thead>
      <tr>
        <th>Lettere</th>
        {#each LENGTHS as length (length)}
          <th>{length}</th>
        {/each}
      </tr>
    </thead>
    <tbody>
      <tr>
        <th>Punti</th>
        {#each LENGTHS as length (length)}
          <td>{baseWordValue('a'.repeat(length))}</td>
        {/each}
      </tr>
    </tbody>
  </table>
{:else if kind === 'speciale'}
  <p>Include il sistema standard ma ogni lettera ha un suo punteggio specifico mostrato sulla griglia.</p>
{:else}
  <p>
    Il punteggio delle lettere sui lati viene moltiplicato ×2, agli angoli ×3. (In modalità standard le lettere
    valgono tutte 1 punto)
  </p>
{/if}

<style>
  p {
    margin: 0 0 6px;
  }

  .mini-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.78rem;
  }

  .mini-table th,
  .mini-table td {
    text-align: center;
    padding: 3px 6px;
  }

  .mini-table thead th {
    opacity: 0.65;
    font-weight: 700;
  }

  .mini-table tbody th {
    opacity: 0.65;
    font-weight: 700;
    text-align: left;
  }

  .mini-table tbody td {
    font-weight: 800;
  }
</style>
