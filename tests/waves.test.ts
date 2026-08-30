import { describe, expect, it } from 'vitest';
import { g, wave, waveEnemyCount, waveSpawnDurationMs, speciesInWaves, variantsInWaves } from '../src/game/data/waves';
import { WaveSystem } from '../src/game/systems/WaveSystem';
import { RESEARCH_OUTPOST } from '../src/game/data/maps';
import { CHALLENGES_BY_ID } from '../src/game/data/challenges';

describe('wave helpers', () => {
  const w = wave(1, 30, [g('compsognathus', 'green', 5, 500), g('velociraptor', 'blue', 2, 1000, 3000)]);

  it('counts every individual in a wave', () => {
    expect(waveEnemyCount(w)).toBe(7);
  });

  it('reports when the last spawn is due', () => {
    expect(waveSpawnDurationMs(w)).toBe(4000);
  });

  it('lists distinct species and (species, tier) variants', () => {
    expect(speciesInWaves([w]).sort()).toEqual(['compsognathus', 'velociraptor']);
    expect(variantsInWaves([w])).toHaveLength(2);
    expect(variantsInWaves([w, w])).toHaveLength(2);
  });
});

describe('WaveSystem', () => {
  it('builds a queue ordered by spawn time', () => {
    const system = new WaveSystem(RESEARCH_OUTPOST.waves);
    const runtime = system.begin(0)!;
    expect(runtime.totalEnemies).toBe(waveEnemyCount(RESEARCH_OUTPOST.waves[0]));
    for (let i = 1; i < runtime.queue.length; i++) {
      expect(runtime.queue[i].atMs).toBeGreaterThanOrEqual(runtime.queue[i - 1].atMs);
    }
  });

  it('releases spawns as the clock advances and finishes exactly once', () => {
    const system = new WaveSystem(RESEARCH_OUTPOST.waves);
    system.begin(0);
    let released = 0;
    for (let t = 0; t < 60_000 && !system.allSpawned; t += 100) {
      released += system.tick(100).length;
    }
    expect(system.allSpawned).toBe(true);
    expect(released).toBe(waveEnemyCount(RESEARCH_OUTPOST.waves[0]));
    // Nothing more comes out once the queue is drained.
    expect(system.tick(5000)).toHaveLength(0);
  });

  it('returns null past the end of the table', () => {
    const system = new WaveSystem(RESEARCH_OUTPOST.waves);
    expect(system.begin(999)).toBeNull();
    expect(system.waveAt(999)).toBeNull();
  });

  it('reports the final wave', () => {
    const system = new WaveSystem(RESEARCH_OUTPOST.waves);
    system.begin(RESEARCH_OUTPOST.waves.length - 1);
    expect(system.isFinalWave).toBe(true);
  });
});

describe('challenge modifiers', () => {
  it('caps the wave count for a hold-the-line challenge', () => {
    const challenge = CHALLENGES_BY_ID['canyon-hold'];
    const system = new WaveSystem(RESEARCH_OUTPOST.waves, challenge);
    expect(system.total).toBe(challenge.modifiers.waveLimit);
  });

  it('multiplies enemy counts for a swarm challenge', () => {
    const challenge = CHALLENGES_BY_ID['outpost-swarm'];
    const plain = new WaveSystem(RESEARCH_OUTPOST.waves);
    const swarm = new WaveSystem(RESEARCH_OUTPOST.waves, challenge);
    expect(swarm.begin(0)!.totalEnemies).toBeGreaterThan(plain.begin(0)!.totalEnemies);
    expect(swarm.plannedCount(0)).toBeGreaterThan(plain.plannedCount(0));
  });

  it('boosts every tier for a heavyweights challenge', () => {
    const challenge = CHALLENGES_BY_ID['caldera-heavyweights'];
    const boosted = new WaveSystem(RESEARCH_OUTPOST.waves, challenge);
    const runtime = boosted.begin(0)!;
    expect(runtime.queue.every((s) => s.tier !== 'green')).toBe(true);
  });

  it('keeps a boosted wave inside its original spawn window', () => {
    const challenge = CHALLENGES_BY_ID['outpost-swarm'];
    const swarm = new WaveSystem(RESEARCH_OUTPOST.waves, challenge);
    const runtime = swarm.begin(3)!;
    const plainDuration = waveSpawnDurationMs(RESEARCH_OUTPOST.waves[3]);
    expect(runtime.queue.at(-1)!.atMs).toBeLessThanOrEqual(plainDuration + 1);
  });
});
