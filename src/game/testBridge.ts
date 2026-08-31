/**
 * Read-only telemetry for automated browser tests.
 *
 * Browser tests need to assert things the DOM cannot show — most importantly
 * that pausing stops the *simulation* clock rather than merely hiding motion.
 * Rather than scraping pixels or guessing from wall-clock timing, the match
 * publishes a small snapshot here.
 *
 * This is deliberately inert unless the page is opened with `?e2e=1`. It
 * exposes no way to mutate state, grant resources or skip content: it is a
 * window onto the simulation, never a lever on it.
 */

export interface TestSnapshot {
  /** Milliseconds of simulation elapsed. The value pause must not advance. */
  simTimeMs: number;
  phase: string;
  paused: boolean;
  menuOpen: boolean;
  speed: number;
  supply: number;
  objectiveHp: number;
  kills: number;
  waveIndex: number;
  enemiesAlive: number;
  placements: number;
  ended: boolean;
}

export interface TestBridge {
  readonly version: 1;
  getState(): TestSnapshot | null;
  /** Maps a point in map space to page coordinates, for reliable clicking. */
  worldToPage(x: number, y: number): { x: number; y: number } | null;
}

const FLAG = 'e2e';

let enabledCache: boolean | null = null;

function enabled(): boolean {
  if (enabledCache !== null) return enabledCache;
  if (typeof window === 'undefined') return false;
  try {
    enabledCache = new URLSearchParams(window.location.search).get(FLAG) === '1';
  } catch {
    enabledCache = false;
  }
  return enabledCache;
}

let snapshot: TestSnapshot | null = null;
let installed = false;

/** Called once per frame by the match scene. Cheap and side-effect free when off. */
export function publishTestState(next: TestSnapshot | null): void {
  if (!enabled()) return;
  snapshot = next;
  if (installed) return;
  installed = true;

  const bridge: TestBridge = {
    version: 1,
    getState: () => (snapshot ? { ...snapshot } : null),
    worldToPage: (x, y) => {
      const canvas = document.querySelector('canvas');
      if (!canvas) return null;
      const r = canvas.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) return null;
      return { x: r.left + (x / WORLD_W) * r.width, y: r.top + (y / WORLD_H) * r.height };
    },
  };
  (window as unknown as Record<string, unknown>).__ctdTest = bridge;
}

/** Clears the snapshot when a match tears down, so stale state is never read. */
export function clearTestState(): void {
  snapshot = null;
}

export const WORLD_W = 1280;
export const WORLD_H = 720;

export function isTestBridgeEnabled(): boolean {
  return enabled();
}
