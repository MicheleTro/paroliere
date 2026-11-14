<script lang="ts">
  import {
    createPreset,
    getWeekPlan,
    listPresets,
    saveWeekPlan,
    updatePreset,
    type AdminPlanDay,
    type AdminPreset,
    type AdminPresetFields,
  } from '../lib/admin.svelte.js';
  import { DAY_NAMES } from '../lib/week.js';

  interface Props {
    onBack: () => void;
  }

  let { onBack }: Props = $props();

  let presets: AdminPreset[] = $state([]);
  let plan: AdminPlanDay[] = $state([]);
  let loading = $state(true);
  let error: string | undefined = $state();
  let message: string | undefined = $state();
  let editing: AdminPreset | undefined = $state();
  let draft: (AdminPresetFields & { slug: string }) | undefined = $state();

  const activePresets = $derived(presets.filter((p) => p.active));

  async function load(): Promise<void> {
    try {
      [presets, plan] = await Promise.all([listPresets(), getWeekPlan()]);
    } catch (err) {
      error = err instanceof Error ? err.message : 'Errore imprevisto';
    } finally {
      loading = false;
    }
  }
  void load();

  function edit(preset: AdminPreset): void {
    editing = { ...preset, bonusCells: [...preset.bonusCells] };
    draft = undefined;
    message = undefined;
  }

  function startNew(): void {
    draft = { slug: '', name: '', description: '', size: 4, durationMs: 120_000, minWordLength: 3, minWords: 80, bonusCells: [], combo: false, pointMode: 'standard', positionBonus: false, active: true };
    editing = undefined;
    message = undefined;
  }

  function parseBonus(text: string): number[] {
    return text
      .split(/[,\s]+/)
      .map((s) => Number(s))
      .filter((n) => Number.isInteger(n) && n >= 2);
  }

  async function save(): Promise<void> {
    error = undefined;
    try {
      if (editing) {
        const { id, name, description, size, durationMs, minWordLength, minWords, bonusCells, combo, pointMode, positionBonus, active } = editing;
        await updatePreset(id, { name, description, size, durationMs, minWordLength, minWords, bonusCells, combo, pointMode, positionBonus, active });
      } else if (draft) {
        await createPreset(draft);
      }
      editing = undefined;
      draft = undefined;
      message = 'Preset salvato.';
      await load();
    } catch (err) {
      error = err instanceof Error ? err.message : 'Errore imprevisto';
    }
  }

  async function savePlan(): Promise<void> {
    error = undefined;
    try {
      await saveWeekPlan(plan.map((d) => ({ dayIndex: d.dayIndex, presetId: d.presetId })));
      message = 'Piano salvato: vale per le griglie non ancora create.';
    } catch (err) {
      error = err instanceof Error ? err.message : 'Errore imprevisto';
    }
  }

  const form = $derived(editing ?? draft);
</script>

<div class="page admin">
  <div class="header">
    <button type="button" class="btn btn-secondary btn-sm" onclick={onBack}>← Indietro</button>
    <h1>Sloth's week</h1>
  </div>

  {#if error}<p class="error-text">{error}</p>{/if}
  {#if message}<p class="ok-text">{message}</p>{/if}

  {#if loading}
    <p class="empty-text">Caricamento...</p>
  {:else if form}
    <div class="card form">
      <h2>{editing ? `Modifica "${editing.name}"` : 'Nuovo preset'}</h2>
      {#if draft}
        <label class="field">Identificativo (minuscole, numeri, trattini)<input bind:value={draft.slug} /></label>
      {/if}
      <label class="field">Nome<input bind:value={form.name} /></label>
      <label class="field">Descrizione<input bind:value={form.description} /></label>
      <div class="grid2">
        <label class="field">
          Griglia
          <select bind:value={form.size}>
            <option value={4}>4×4</option>
            <option value={5}>5×5</option>
            <option value={6}>6×6</option>
          </select>
        </label>
        <label class="field">
          Durata (secondi)
          <input type="number" min="10" max="600" value={form.durationMs / 1000} oninput={(e) => (form.durationMs = Number(e.currentTarget.value) * 1000)} />
        </label>
        <label class="field">Lettere minime<input type="number" min="1" max="10" bind:value={form.minWordLength} /></label>
        <label class="field">Parole minime<input type="number" min="1" max="500" bind:value={form.minWords} /></label>
      </div>
      <label class="field">
        Caselle bonus (moltiplicatori, es. "3 2")
        <input value={form.bonusCells.join(' ')} oninput={(e) => (form.bonusCells = parseBonus(e.currentTarget.value))} />
      </label>
      <label class="check"><input type="checkbox" bind:checked={form.combo} /> Combo (parole ravvicinate valgono di più)</label>
      <label class="check"><input type="checkbox" checked={form.pointMode === 'speciale'} onchange={(e) => (form.pointMode = e.currentTarget.checked ? 'speciale' : 'standard')} /> Punti per lettera (ogni lettera ha un suo valore)</label>
      <label class="check"><input type="checkbox" bind:checked={form.positionBonus} /> Bonus posizione (lati e angoli valgono di più)</label>
      <label class="check"><input type="checkbox" bind:checked={form.active} /> Attivo</label>
      <div class="actions">
        <button type="button" class="btn btn-secondary" onclick={() => { editing = undefined; draft = undefined; }}>Annulla</button>
        <button type="button" class="btn btn-primary" onclick={save}>Salva</button>
      </div>
    </div>
  {:else}
    <section class="card">
      <h2>Piano della settimana</h2>
      <p class="note">Quale preset in quale giorno. Vale per le griglie non ancora create: quelle già create non cambiano.</p>
      {#each plan as day (day.dayIndex)}
        <label class="plan-row">
          <span>{DAY_NAMES[day.dayIndex]}</span>
          <select bind:value={day.presetId}>
            {#each activePresets as preset (preset.id)}
              <option value={preset.id}>{preset.name} ({preset.size}×{preset.size})</option>
            {/each}
          </select>
        </label>
      {/each}
      <button type="button" class="btn btn-primary btn-sm" onclick={savePlan}>Salva il piano</button>
    </section>

    <section class="card">
      <div class="head">
        <h2>Preset</h2>
        <button type="button" class="btn btn-secondary btn-sm" onclick={startNew}>+ Nuovo</button>
      </div>
      <ul>
        {#each presets as preset (preset.id)}
          <li>
            <button type="button" class="preset" class:off={!preset.active} onclick={() => edit(preset)}>
              <strong>{preset.name}</strong>
              <span>
                {preset.size}×{preset.size} · {preset.durationMs / 1000} s · {preset.minWordLength}+ lettere{preset.bonusCells.length > 0 ? ` · bonus ${preset.bonusCells.join(' ')}` : ''}{preset.combo ? ' · combo' : ''}{preset.pointMode === 'speciale' ? ' · punti per lettera' : ''}{preset.positionBonus ? ' · bonus posizione' : ''}{preset.active ? '' : ' · disattivato'}
              </span>
            </button>
          </li>
        {/each}
      </ul>
    </section>
  {/if}
</div>

<style>
  .header {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .card {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 14px 16px;
  }

  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  h2 {
    margin: 0;
  }

  .note {
    margin: 0;
    font-size: 0.82rem;
    color: var(--color-ink-soft);
  }

  .ok-text {
    margin: 0;
    text-align: center;
    font-weight: 600;
    color: var(--color-success);
  }

  .plan-row {
    display: grid;
    grid-template-columns: 100px 1fr;
    align-items: center;
    gap: 8px;
    font-weight: 700;
  }

  select,
  .field input {
    font: inherit;
    padding: 8px 10px;
    border-radius: var(--radius-sm);
    border: 1.5px solid var(--color-border);
    background: var(--color-surface-alt);
    height: 42px;
  }

  .grid2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }

  .check {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.9rem;
    font-weight: 600;
  }

  ul {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .preset {
    display: flex;
    flex-direction: column;
    gap: 2px;
    width: 100%;
    padding: 8px 12px;
    border: none;
    border-radius: var(--radius-md);
    background: var(--color-surface-alt);
    text-align: left;
    font-family: inherit;
    color: inherit;
    cursor: pointer;
  }

  .preset span {
    font-size: 0.8rem;
    color: var(--color-ink-soft);
  }

  .preset.off {
    opacity: 0.5;
  }

  .actions {
    display: flex;
    gap: 10px;
  }

  .actions .btn {
    flex: 1;
  }
</style>
