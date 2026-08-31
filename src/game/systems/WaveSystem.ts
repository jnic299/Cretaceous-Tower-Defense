import type { ChallengeDef, SpeciesId, TierId, WaveDef } from '../types';
import { boostTier } from '../data/tiers';
import { waveEnemyCount } from '../data/waves';

export interface ScheduledSpawn {
  atMs: number;
  species: SpeciesId;
  tier: TierId;
  spawnId?: string;
}

export interface WaveRuntime {
  def: WaveDef;
  queue: ScheduledSpawn[];
  cursor: number;
  totalEnemies: number;
  spawned: number;
  elapsed: number;
}

/**
 * Turns a wave table into a timed spawn queue, applying any challenge
 * modifiers as it goes. Keeping this separate from the scene means wave
 * composition is testable and challenge rules live in exactly one place.
 */
export class WaveSystem {
  readonly waves: WaveDef[];
  private current: WaveRuntime | null = null;
  index = -1;

  constructor(
    waves: WaveDef[],
    private readonly challenge?: ChallengeDef,
  ) {
    const limit = challenge?.modifiers.waveLimit;
    this.waves = limit ? waves.slice(0, limit) : waves;
  }

  get total(): number {
    return this.waves.length;
  }

  get active(): WaveRuntime | null {
    return this.current;
  }

  get isFinalWave(): boolean {
    return this.index >= this.waves.length - 1;
  }

  waveAt(i: number): WaveDef | null {
    return this.waves[i] ?? null;
  }

  /** Enemy count for a wave after challenge multipliers. */
  plannedCount(i: number): number {
    const def = this.waves[i];
    if (!def) return 0;
    const mult = this.challenge?.modifiers.enemyCountMultiplier ?? 1;
    return Math.round(waveEnemyCount(def) * mult);
  }

  begin(i: number): WaveRuntime | null {
    const def = this.waves[i];
    if (!def) return null;
    this.index = i;

    const countMult = this.challenge?.modifiers.enemyCountMultiplier ?? 1;
    const tierBoost = this.challenge?.modifiers.tierBoost ?? 0;

    const queue: ScheduledSpawn[] = [];
    for (const group of def.groups) {
      const count = Math.max(1, Math.round(group.count * countMult));
      const tier = tierBoost > 0 ? boostTier(group.tier, tierBoost) : group.tier;
      // Extra individuals from a challenge multiplier are packed into the
      // group's original window rather than stretching the wave out.
      const interval =
        count > group.count && count > 1
          ? (group.intervalMs * Math.max(0, group.count - 1)) / (count - 1)
          : group.intervalMs;
      for (let n = 0; n < count; n++) {
        queue.push({
          atMs: group.delayMs + n * interval,
          species: group.species,
          tier,
          spawnId: group.spawnId,
        });
      }
    }
    queue.sort((a, b) => a.atMs - b.atMs);

    this.current = {
      def,
      queue,
      cursor: 0,
      totalEnemies: queue.length,
      spawned: 0,
      elapsed: 0,
    };
    return this.current;
  }

  /**
   * Advances the wave clock and returns everything due this frame.
   * A zero or negative step releases nothing: a frozen match spawns nothing.
   */
  tick(deltaMs: number): ScheduledSpawn[] {
    const wave = this.current;
    if (!wave || deltaMs <= 0) return [];
    wave.elapsed += deltaMs;
    const due: ScheduledSpawn[] = [];
    while (wave.cursor < wave.queue.length && wave.queue[wave.cursor].atMs <= wave.elapsed) {
      due.push(wave.queue[wave.cursor]);
      wave.cursor++;
      wave.spawned++;
    }
    return due;
  }

  get allSpawned(): boolean {
    return this.current !== null && this.current.cursor >= this.current.queue.length;
  }

  endWave(): void {
    this.current = null;
  }
}
