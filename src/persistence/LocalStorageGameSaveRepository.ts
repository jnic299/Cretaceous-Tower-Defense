import type { GameSaveRepository } from './GameSaveRepository';
import { SAVE_KEY, type SaveData } from './schema';

/**
 * Browser localStorage implementation. Deliberately forgiving: a corrupt or
 * unreadable blob is treated as "no save" rather than crashing the app, so a
 * bad write can never lock a player out of the game.
 */
export class LocalStorageGameSaveRepository implements GameSaveRepository {
  constructor(private readonly key: string = SAVE_KEY) {}

  isAvailable(): boolean {
    try {
      const probe = '__ctd_probe__';
      window.localStorage.setItem(probe, '1');
      window.localStorage.removeItem(probe);
      return true;
    } catch {
      return false;
    }
  }

  async load(): Promise<SaveData | null> {
    try {
      const raw = window.localStorage.getItem(this.key);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as unknown;
      if (!parsed || typeof parsed !== 'object') return null;
      return parsed as SaveData;
    } catch (err) {
      console.warn('[ctd] save could not be read, starting fresh', err);
      return null;
    }
  }

  async save(data: SaveData): Promise<void> {
    try {
      window.localStorage.setItem(this.key, JSON.stringify(data));
    } catch (err) {
      console.warn('[ctd] save failed', err);
    }
  }

  async clear(): Promise<void> {
    try {
      window.localStorage.removeItem(this.key);
    } catch (err) {
      console.warn('[ctd] save could not be cleared', err);
    }
  }
}
