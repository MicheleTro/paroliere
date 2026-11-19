<script lang="ts">
  import GameOptions, { DEFAULT_OPTIONS, type GameOptionValues } from '../lib/GameOptions.svelte';
  import Sheet from '../lib/Sheet.svelte';

  // Gioca personalizzato: si sceglie il formato della partita libera, come nelle sfide. Le stelle valgono solo
  // nel formato standard; l'XP è sempre il punteggio. L'ultima scelta resta su questo dispositivo.

  interface Props {
    onClose: () => void;
    onPlay: (options: GameOptionValues) => void;
  }

  let { onClose, onPlay }: Props = $props();

  const STORAGE_KEY = 'paroliere.gioca-personalizzato';

  function saved(): GameOptionValues {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return { ...DEFAULT_OPTIONS, ...(JSON.parse(raw) as Partial<GameOptionValues>) };
    } catch {
      // archivio non disponibile o valore illeggibile: si parte dal formato standard
    }
    return { ...DEFAULT_OPTIONS };
  }

  let options: GameOptionValues = $state(saved());

  const isStandard = $derived(
    (Object.keys(DEFAULT_OPTIONS) as (keyof GameOptionValues)[]).every((key) => options[key] === DEFAULT_OPTIONS[key]),
  );

  function play(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(options));
    } catch {
      // non si ricorda la scelta, pazienza
    }
    onPlay({ ...options });
  }
</script>

<Sheet title="Personalizza" subtitle="Scegli come giocare la partita libera" {onClose}>
  <div class="options scroll-box">
    <GameOptions bind:options />
  </div>

  <p class="muted note">
    {#if isStandard}
      Formato standard: valgono le stelle.
    {:else}
      Fuori dal formato standard le stelle non valgono: l'XP è il punteggio.
    {/if}
  </p>

  <div class="actions">
    <button type="button" class="btn btn-secondary" disabled={isStandard} onclick={() => (options = { ...DEFAULT_OPTIONS })}>
      Standard
    </button>
    <button type="button" class="btn btn-blue" onclick={play}>Gioca</button>
  </div>
</Sheet>

<style>
  .options {
    display: flex;
    flex-direction: column;
    gap: 14px;
    max-height: 52dvh;
  }

  /* I titoli delle sezioni sono pensati per lo sfondo blu delle schermate: nel foglio chiaro vanno scuri */
  .options :global(.section-title) {
    color: var(--ink);
    text-shadow: none;
  }

  .note {
    margin: 10px 0 0;
    font-size: 0.82rem;
    text-align: center;
  }

  .actions {
    display: flex;
    gap: 10px;
    margin-top: 10px;
  }

  .actions .btn {
    flex: 1;
  }
</style>
