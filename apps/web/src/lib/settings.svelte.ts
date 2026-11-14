import { getSettings, saveSettings, type Settings, type SettingsResponse } from './me.js';
import { setSoundMuted } from './sound.js';

const DEFAULTS: Settings = { sound: true, vibration: true, reminder: false, sky: 'auto', season: 'auto' };

/** Impostazioni personali: vengono dal server (stesse su ogni dispositivo) e si applicano subito. */
class SettingsStore {
  values: Settings = $state({ ...DEFAULTS });
  reminderAvailable = $state(false);
  loaded = $state(false);

  apply(settings: Settings): void {
    this.values = settings;
    // Il suono si governa con il controllo già esistente del gioco
    setSoundMuted(!settings.sound);
  }

  async load(): Promise<void> {
    try {
      const response: SettingsResponse = await getSettings();
      this.reminderAvailable = response.available.reminder;
      this.apply(response.settings);
    } catch {
      // senza rete restano i valori di partenza
    } finally {
      this.loaded = true;
    }
  }

  /** Cambia una o più impostazioni: l'effetto è immediato, il salvataggio avviene dopo (se fallisce si torna indietro). */
  async update(changes: Partial<Settings>): Promise<void> {
    const before = this.values;
    this.apply({ ...before, ...changes });
    try {
      const response = await saveSettings(changes);
      this.apply(response.settings);
    } catch (error) {
      this.apply(before);
      throw error;
    }
  }
}

export const settings = new SettingsStore();
