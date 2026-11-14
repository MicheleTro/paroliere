<script lang="ts">
  import { cellPosition, neighbors, TILE_VALUES, type Grid } from '@paroliere/core';
  import { hitTestCell } from './grid-geometry.js';

  interface Props {
    grid: Grid;
    onSubmit: (path: number[]) => void;
    interactive?: boolean;
    highlightPath?: number[];
    onPathChange?: (path: number[]) => void;
    pointMode?: 'standard' | 'speciale';
    positionBonus?: boolean;
    /** Se la parola in corso è già stata trovata, il tratto cambia colore. */
    pathTone?: 'neutral' | 'ok' | 'dup' | 'no';
    /** Caselle suggerite (prima partita guidata): lampeggiano. */
    hintPath?: number[];
  }

  let {
    grid,
    onSubmit,
    interactive = true,
    highlightPath = [],
    onPathChange,
    pointMode = 'standard',
    positionBonus = false,
    pathTone = 'neutral',
    hintPath = [],
  }: Props = $props();

  let containerEl: HTMLDivElement | undefined = $state();
  let path: number[] = $state([]);
  let tracking = $state(false);

  const displayedPath = $derived(interactive ? path : highlightPath);

  // Il tratto che unisce le caselle del percorso: si disegna in pixel, dai centri reali delle caselle
  let centers: { x: number; y: number }[] = $state([]);
  let boxSize = $state({ w: 0, h: 0 });

  function measure(): void {
    if (!containerEl) return;
    const cells = containerEl.querySelectorAll<HTMLElement>('.cell');
    centers = Array.from(cells, (c) => ({ x: c.offsetLeft + c.offsetWidth / 2, y: c.offsetTop + c.offsetHeight / 2 }));
    boxSize = { w: containerEl.clientWidth, h: containerEl.clientHeight };
  }

  $effect(() => {
    void grid;
    measure();
    if (!containerEl) return;
    const observer = new ResizeObserver(measure);
    observer.observe(containerEl);
    return () => observer.disconnect();
  });

  const polyline = $derived(displayedPath.map((i) => centers[i]).filter(Boolean).map((p) => `${p!.x},${p!.y}`).join(' '));

  function pointToCell(clientX: number, clientY: number, mode: 'start' | 'move'): number | null {
    if (!containerEl) return null;
    const rect = containerEl.getBoundingClientRect();
    return hitTestCell(clientX, clientY, rect, grid.size, mode);
  }

  function handlePointerDown(event: PointerEvent): void {
    if (!interactive) return;
    const cell = pointToCell(event.clientX, event.clientY, 'start');
    if (cell === null) return;
    containerEl?.setPointerCapture(event.pointerId);
    tracking = true;
    path = [cell];
    onPathChange?.(path);
  }

  function handlePointerMove(event: PointerEvent): void {
    if (!interactive || !tracking) return;
    const cell = pointToCell(event.clientX, event.clientY, 'move');
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
  class:n5={grid.size === 5}
  class:n6={grid.size === 6}
  style={`--size: ${grid.size}`}
  role="application"
  aria-label="Griglia di gioco"
  onpointerdown={handlePointerDown}
  onpointermove={handlePointerMove}
  onpointerup={endTracking}
  onpointercancel={endTracking}
>
  {#each grid.tiles as tile, index (index)}
    {@const multiplier = grid.multipliers?.[index] ?? 1}
    <div
      class="cell"
      class:selected={displayedPath.includes(index)}
      class:hint={hintPath.includes(index) && !displayedPath.includes(index)}
      class:position-edge={positionBonus && cellPosition(index, grid.size) === 'edge'}
      class:position-corner={positionBonus && cellPosition(index, grid.size) === 'corner'}
      class:qu={tile === 'qu'}
    >
      {tile === 'qu' ? 'Qu' : tile.toUpperCase()}
      {#if multiplier > 1}
        <span class="bonus" class:x2={multiplier === 2}>×{multiplier}</span>
      {/if}
      {#if pointMode === 'speciale'}
        <span class="letter-value">{TILE_VALUES[tile]}</span>
      {/if}
    </div>
  {/each}
  {#if polyline && displayedPath.length > 1}
    <svg class="path" viewBox="0 0 {boxSize.w} {boxSize.h}" aria-hidden="true">
      <polyline points={polyline} class={pathTone} />
    </svg>
  {/if}
</div>

<style>
  .grid {
    /* larghezza: quella del contenitore (non della finestra), con un tetto in altezza e uno assoluto */
    --gw: min(100%, 62dvh, var(--grid-max, 400px));
    container-type: inline-size;
    position: relative;
    display: grid;
    grid-template-columns: repeat(var(--size), 1fr);
    grid-template-rows: repeat(var(--size), 1fr);
    width: var(--gw);
    aspect-ratio: 1 / 1;
    gap: var(--grid-gap, 9px);
    flex-shrink: 0;
    touch-action: none;
    user-select: none;
    -webkit-touch-callout: none;
    border-radius: 26px;
    padding: var(--grid-pad, 12px);
    background: linear-gradient(180deg, #1f3fae, #162f8a);
    border: 4px solid var(--ink);
    box-shadow: 0 7px 0 var(--ink);
  }

  .grid.n5 {
    --grid-gap: 7px;
  }

  .grid.n6 {
    --grid-gap: 6px;
    --grid-pad: 9px;
  }

  .cell {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: var(--f-display);
    font-weight: 400;
    font-size: var(--grid-font, calc(100cqw / var(--size) * 0.46));
    text-transform: uppercase;
    color: var(--ink);
    background: var(--tile);
    border: 3px solid var(--ink);
    border-radius: 14px;
    box-shadow: inset 0 -5px 0 rgba(29, 26, 58, 0.18);
    transition: transform 0.08s, background 0.1s;
  }

  .grid.n6 .cell {
    border-width: 2.5px;
    border-radius: 10px;
  }

  .cell.qu {
    font-size: calc(var(--grid-font, calc(100cqw / var(--size) * 0.46)) * 0.8);
  }

  .cell.selected {
    background: var(--tile-sel);
    transform: scale(0.92);
  }

  .cell.hint {
    animation: hint 1s ease-in-out infinite;
  }

  @keyframes hint {
    50% {
      background: var(--tile-sel);
      transform: scale(0.94);
    }
  }

  .cell.position-edge {
    background: #f1d896;
  }

  .cell.position-corner {
    background: #cbb3ee;
  }

  .cell.position-edge.selected,
  .cell.position-corner.selected {
    background: var(--tile-sel);
  }

  .bonus {
    position: absolute;
    top: -8px;
    right: -8px;
    font-size: 0.75rem;
    padding: 1px 5px;
    border-radius: 8px;
    background: var(--coral);
    color: #fff;
    border: 2px solid var(--ink);
    font-family: var(--f-display);
    text-transform: none;
    line-height: 1.2;
  }

  .bonus.x2 {
    background: var(--mint);
  }

  .path {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    z-index: 2;
    pointer-events: none;
  }

  .path polyline {
    fill: none;
    stroke: var(--coral);
    stroke-width: 9;
    stroke-linecap: round;
    stroke-linejoin: round;
    opacity: 0.8;
  }

  .path polyline.ok {
    stroke: var(--mint);
  }

  .path polyline.dup {
    stroke: var(--gold-d);
  }

  /* Valore della lettera ("Speciale"): piccolo, in basso a destra, visibile ma un po' trasparente */
  .letter-value {
    position: absolute;
    right: 6%;
    bottom: 4%;
    font-family: var(--f-display);
    font-size: max(8px, calc(100cqw / var(--size) * 0.2));
    line-height: 1;
    opacity: 0.6;
    pointer-events: none;
  }
</style>
