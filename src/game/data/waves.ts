import type { SpawnGroup, SpeciesId, TierId, WaveDef } from '../types';

/**
 * Compact builders so wave tables stay readable. Each map owns its own wave
 * list; tuning a level means editing one array, never scene code.
 */

/** A single spawn group: `g(species, tier, count, gap, delay, spawnPoint)`. */
export function g(
  species: SpeciesId,
  tier: TierId,
  count: number,
  intervalMs: number,
  delayMs = 0,
  spawnId?: string,
): SpawnGroup {
  return spawnId
    ? { species, tier, count, intervalMs, delayMs, spawnId }
    : { species, tier, count, intervalMs, delayMs };
}

export function wave(
  index: number,
  reward: number,
  groups: SpawnGroup[],
  opts: { name?: string; boss?: boolean } = {},
): WaveDef {
  const w: WaveDef = { index, reward, groups };
  if (opts.name) w.name = opts.name;
  if (opts.boss) w.boss = true;
  return w;
}

/** Total individuals in a wave — used by the HUD and by wave-clear checks. */
export function waveEnemyCount(w: WaveDef): number {
  return w.groups.reduce((sum, grp) => sum + grp.count, 0);
}

/** Last moment at which this wave can still spawn something, in ms. */
export function waveSpawnDurationMs(w: WaveDef): number {
  return w.groups.reduce(
    (max, grp) => Math.max(max, grp.delayMs + Math.max(0, grp.count - 1) * grp.intervalMs),
    0,
  );
}

/** Every distinct species that appears across a wave table. */
export function speciesInWaves(waves: WaveDef[]): SpeciesId[] {
  const seen = new Set<SpeciesId>();
  for (const w of waves) for (const grp of w.groups) seen.add(grp.species);
  return [...seen];
}

/** Every distinct (species, tier) pair — the art layer pre-bakes exactly these. */
export function variantsInWaves(waves: WaveDef[]): { species: SpeciesId; tier: TierId }[] {
  const seen = new Map<string, { species: SpeciesId; tier: TierId }>();
  for (const w of waves) {
    for (const grp of w.groups) {
      const key = `${grp.species}:${grp.tier}`;
      if (!seen.has(key)) seen.set(key, { species: grp.species, tier: grp.tier });
    }
  }
  return [...seen.values()];
}
