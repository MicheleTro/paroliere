<script lang="ts">
  import { neighbors, type Grid } from '@paroliere/core';
  import { hitTestCell } from './grid-geometry.js';

  interface Props {
    grid: Grid;
    onSubmit: (path: number[]) => void;
    interactive?: boolean;
    highlightPath?: number[];
    onPathChange?: (path: number[]) => void;
  }

  let { grid, onSubmit, interactive = true, highlightPath = [], onPathChange }: Props = $props();

  let containerEl: HTMLDivElement | undefined;
  let path: number[] = $state([]);
  let tracking = $state(false);

  const displayedPath = $derived(interactive ? path : highlightPath);

  function pointToCell(clientX: number, clientY: number): number | null {
    if (!containerEl) return null;
    const rect = containerEl.getBoundingClientRect();
    return hitTestCell(clientX, clientY, rect, grid.size);
  }

  function handlePointerDown(event: PointerEvent): void {
    if (!interactive) return;
    const cell = pointToCell(event.clientX, event.clientY);
    if (cell === null) return;
    containerEl?.setPointerCapture(event.pointerId);
    tracking = true;
    path = [cell];
    onPathChange?.(path);
  }

  function handlePointerMove(event: PointerEvent): void {
    if (!interactive || !tracking) return;
    const cell = pointToCell(event.clientX, event.clientY);
    if (cell === null) return;

    const last = path[path.length - 1];
    if (cell === last) return;

    const penultimate = path[path.length - 2];
    if (penultimate !== undefined && cell === penultimate) {
      path = path.slice(0, -1);
      onPathChange?.(path);
      return;
    }

    // Una lettera non adiacente all'ultima selezionata, o già usata nel
    // percorso, viene semplicemente ignorata: il puntatore resta "agganciato"
    // all'ultima cella valida finché non entra in una cella raggiungibile.
    if (path.includes(cell)) return;
    if (last === undefined || !neighbors(last, grid.size).includes(cell)) return;

    path = [...path, cell];
    onPathChange?.(path);
  }

  function endTracking(event: PointerEvent): void {
    if (!interactive || !tracking) return;
    tracking = false;
    containerEl?.releasePointerCapture(event.pointerId);
    if (path.length > 0) onSubmit(path);
    path = [];
    onPathChange?.(path);
  }
</script>

<div
  bind:this={containerEl}
  class="grid"
  style={`--size: ${grid.size}`}
  role="application"
  aria-label="Griglia di gioco"
  onpointerdown={handlePointerDown}
  onpointermove={handlePointerMove}
  onpointerup={endTracking}
  onpointercancel={endTracking}
>
  {#each grid.tiles as tile, index (index)}
    <div class="cell" class:selected={displayedPath.includes(index)}>
      {tile === 'qu' ? 'Qu' : tile.toUpperCase()}
    </div>
  {/each}
</div>

<style>
  .grid {
    display: grid;
    grid-template-columns: repeat(var(--size), 1fr);
    grid-template-rows: repeat(var(--size), 1fr);
    width: min(90vw, 400px);
    height: min(90vw, 400px);
    gap: 8px;
    touch-action: none;
    user-select: none;
    -webkit-touch-callout: none;
    border-radius: 12px;
    padding: 8px;
    background: #1c2b3a;
  }

  .cell {
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.8rem;
    font-weight: 600;
    color: #f5f5f5;
    background: #2c4256;
    border-radius: 8px;
  }

  .cell.selected {
    background: #4a90d9;
  }
</style>
