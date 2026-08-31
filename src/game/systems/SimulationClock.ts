/**
 * The authoritative gameplay clock.
 *
 * Phaser's `scene.time.now` is raw wall-clock time: it ignores `timeScale`
 * and keeps advancing while the game is paused. Any gameplay deadline built
 * on it therefore drifts against a simulation that advances by a scaled
 * delta — at 3x speed a defender's cooldown would tick at a third of the rate
 * its targets move, and a 30-second pause would silently expire every
 * cooldown and status effect.
 *
 * This clock is the single source of gameplay time. It advances only by the
 * scaled simulation delta, so "one second of simulation" means the same thing
 * at every speed and pause costs exactly zero of it.
 *
 * Phaser's own timers and tweens are still fine for presentation; they must
 * never decide a gameplay outcome.
 */
export class SimulationClock {
  /** Milliseconds of simulation elapsed since the match began. */
  private _now = 0;
  private nextId = 1;
  private queue: ScheduledCallback[] = [];

  get now(): number {
    return this._now;
  }

  /**
   * Advances simulation time and runs anything that came due, in order.
   * A zero or negative delta is a no-op, which is how pause is expressed.
   */
  advance(deltaMs: number): void {
    if (deltaMs <= 0) return;
    this._now += deltaMs;
    if (this.queue.length === 0) return;

    // Callbacks may schedule more work; only fire what was already due, and
    // guard against a callback that reschedules itself at the same instant.
    let guard = 0;
    for (;;) {
      const due = this.queue.filter((c) => c.at <= this._now);
      if (due.length === 0 || guard++ > 64) break;
      this.queue = this.queue.filter((c) => c.at > this._now);
      due.sort((a, b) => a.at - b.at || a.id - b.id);
      for (const c of due) c.fn();
    }
  }

  /** Runs `fn` after `delayMs` of *simulation* time. Returns a cancellable id. */
  schedule(delayMs: number, fn: () => void): number {
    const id = this.nextId++;
    this.queue.push({ id, at: this._now + Math.max(0, delayMs), fn });
    return id;
  }

  cancel(id: number): void {
    const i = this.queue.findIndex((c) => c.id === id);
    if (i >= 0) this.queue.splice(i, 1);
  }

  /** Drops every pending callback. Used when a match ends or is torn down. */
  clear(): void {
    this.queue.length = 0;
  }

  get pendingCount(): number {
    return this.queue.length;
  }

  reset(): void {
    this._now = 0;
    this.queue.length = 0;
  }
}

interface ScheduledCallback {
  id: number;
  at: number;
  fn: () => void;
}

/** Largest real frame a single step may represent, before speed scaling. */
export const MAX_FRAME_MS = 48;

/**
 * Converts a real frame delta into simulation milliseconds.
 *
 * Long frames are clamped so a stalled tab cannot teleport the wave through
 * the defence, and a frozen match consumes no simulation time at all.
 */
export function simulationStepMs(realDeltaMs: number, speed: number, frozen: boolean): number {
  if (frozen) return 0;
  const clamped = Math.min(MAX_FRAME_MS, Math.max(0, realDeltaMs));
  return clamped * Math.max(0, speed);
}
