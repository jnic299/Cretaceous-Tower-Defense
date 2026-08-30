import type { SaveData } from './schema';

/**
 * Storage boundary for player progression.
 *
 * V1 ships a localStorage implementation. Swapping in a cloud-backed
 * repository later means implementing this interface and changing one line in
 * `createSaveRepository` — no game system imports storage directly.
 */
export interface GameSaveRepository {
  /** Returns null when no save exists. Never throws on corrupt data. */
  load(): Promise<SaveData | null>;
  save(data: SaveData): Promise<void>;
  clear(): Promise<void>;
  /** True when the backing store is usable in this environment. */
  isAvailable(): boolean;
}

/** In-memory fallback used in tests and when storage is blocked. */
export class MemoryGameSaveRepository implements GameSaveRepository {
  private data: SaveData | null = null;

  async load(): Promise<SaveData | null> {
    return this.data ? (JSON.parse(JSON.stringify(this.data)) as SaveData) : null;
  }

  async save(data: SaveData): Promise<void> {
    this.data = JSON.parse(JSON.stringify(data)) as SaveData;
  }

  async clear(): Promise<void> {
    this.data = null;
  }

  isAvailable(): boolean {
    return true;
  }
}
