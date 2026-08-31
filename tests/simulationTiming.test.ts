import { describe, expect, it } from 'vitest';
import { SimulationClock, simulationStepMs } from '../src/game/systems/SimulationClock';
import { MapGeometry, type PathRuntime } from '../src/game/systems/MapGeometry';
import { RESEARCH_OUTPOST } from '../src/game/data/maps';
import { SPECIES } from '../src/game/data/dinosaurs';
import { TIERS } from '../src/game/data/tiers';
import { DEFENDERS } from '../src/game/data/defenders';
import { HEROES } from '../src/game/data/heroes';
import { FIXTURES } from '../src/game/data/fixtures';
import { Dino } from '../src/game/entities/Dino';
import { DefenderUnit } from '../src/game/entities/PlacedUnit';
import { FixtureUnit } from '../src/game/entities/Fixture';
import { WaveSystem } from '../src/game/systems/WaveSystem';
import { CombatSystem } from '../src/game/systems/CombatSystem';
import { SpatialGrid } from '../src/game/systems/SpatialGrid';
import type { ProjectileSystem } from '../src/game/systems/ProjectileSystem';
import type { EffectsSystem } from '../src/game/systems/EffectsSystem';
import type { AudioManager } from '../src/audio/AudioManager';
import { asScene, fakeScene } from './support/fakeScene';

/**
 * These tests drive the real entity classes through the same loop shape the
 * match scene uses, because the bug they guard against was not in a helper —
 * it was in which clock the gameplay deadlines were read from.
 *
 * The guarantee under test: 2x and 3x run the *same* simulation faster. A
 * given amount of simulation time must produce the same outcome no matter how
 * much wall-clock time was spent on it, and pause must consume none of it.
 */

const path: PathRuntime = new MapGeometry(RESEARCH_OUTPOST).paths[0];
const RANGER = DEFENDERS.find((d) => d.id === 'ranger')!;

interface RunOptions {
  speed: number;
  /** Real milliseconds per rendered frame. */
  frameMs: number;
  /** How many simulation milliseconds to run for. */
  simDurationMs: number;
  frozen?: boolean;
  /** Applied once, `applyAt` simulation ms in. */
  slow?: { factor: number; durationMs: number };
  stunMs?: number;
  burn?: { dps: number; durationMs: number };
  applyAt?: number;
  speciesId?: keyof typeof SPECIES;
  /** Pins `Math.random` so spawn jitter cannot mask a comparison. */
  seedRandom?: number;
}

interface RunOutcome {
  simTimeMs: number;
  realFrames: number;
  shots: number;
  distance: number;
  burnDamage: number;
  slowEndedAt: number | null;
  stunEndedAt: number | null;
  sprintStarts: number;
  cooldownReadyAt: number | null;
  fixtureAliveAt: number | null;
  supplyTicks: number;
}

/**
 * One run of the simulation, mirroring `MatchScene.update`: derive the step,
 * advance the clock, then hand every system the clock's time.
 */
function run(options: RunOptions): RunOutcome {
  const {
    speed,
    frameMs,
    simDurationMs,
    frozen = false,
    applyAt = 0,
    speciesId = 'velociraptor',
  } = options;

  const clock = new SimulationClock();
  const scene = asScene(fakeScene());

  // Spawn jitter is deliberate in play but would mask the comparison here.
  const realRandom = Math.random;
  if (options.seedRandom !== undefined) Math.random = () => options.seedRandom!;

  const species = SPECIES[speciesId];
  const dino = new Dino(scene);
  dino.spawn(species, TIERS.green, path, 0, 1, clock.now);

  const unit = new DefenderUnit(scene, 'u1', RANGER, 400, 400);
  const fixture = new FixtureUnit(scene, 'f1', FIXTURES.find((f) => f.id === 'decoyBeacon')!, 500, 500, clock.now);
  const cache = FIXTURES.find((f) => f.id === 'supplyCache')!;
  let nextSupplyAt = cache.supplyTickMs ?? 5000;

  const hero = HEROES[0];
  const abilityReadyAt = hero.ability.cooldownMs;

  const outcome: RunOutcome = {
    simTimeMs: 0,
    realFrames: 0,
    shots: 0,
    distance: 0,
    burnDamage: 0,
    slowEndedAt: null,
    stunEndedAt: null,
    sprintStarts: 0,
    cooldownReadyAt: null,
    fixtureAliveAt: null,
    supplyTicks: 0,
  };

  let applied = false;
  let wasSlowed = false;
  let wasStunned = false;
  let lastSpeed = dino.currentSpeed(0);
  const sprintPeak = species.baseSpeed * (species.sprintMultiplier ?? 1) * 0.9;

  // Frozen runs still burn wall-clock frames; that is the point of the test.
  const totalFrames = frozen
    ? Math.ceil(options.simDurationMs / frameMs)
    : Math.ceil(simDurationMs / (frameMs * speed));

  for (let frame = 0; frame < totalFrames; frame++) {
    const dt = simulationStepMs(frameMs, speed, frozen);
    outcome.realFrames++;
    // The scene runs no gameplay system on a zero step; the harness must not
    // either, or a frozen match would still be resolving combat.
    if (dt <= 0) continue;
    clock.advance(dt);
    const now = clock.now;

    if (!applied && now >= applyAt) {
      applied = true;
      if (options.slow) dino.applySlow(options.slow.factor, options.slow.durationMs, now);
      if (options.stunMs) dino.applyStun(options.stunMs, now);
      if (options.burn) dino.applyBurn(options.burn.dps, options.burn.durationMs, now);
    }

    // Sprint cadence: count transitions into the burst.
    const speedNow = dino.currentSpeed(now);
    if (speedNow > sprintPeak && lastSpeed <= sprintPeak) outcome.sprintStarts++;
    lastSpeed = speedNow;

    dino.update(now, dt);
    outcome.burnDamage += dino.tickBurn(now, dt);

    // The cooldown model exactly as the combat system applies it.
    if (now >= unit.nextShotAt) {
      outcome.shots++;
      unit.nextShotAt = now + unit.cooldownMs;
    }

    if (wasSlowed && now >= dino.slowUntil && outcome.slowEndedAt === null) outcome.slowEndedAt = now;
    if (now < dino.slowUntil) wasSlowed = true;
    if (wasStunned && now >= dino.stunUntil && outcome.stunEndedAt === null) outcome.stunEndedAt = now;
    if (now < dino.stunUntil) wasStunned = true;

    if (outcome.cooldownReadyAt === null && now >= abilityReadyAt) outcome.cooldownReadyAt = now;
    if (outcome.fixtureAliveAt === null && now > fixture.expiresAt) outcome.fixtureAliveAt = now;
    if (now >= nextSupplyAt) {
      outcome.supplyTicks++;
      nextSupplyAt = now + (cache.supplyTickMs ?? 5000);
    }
  }

  Math.random = realRandom;
  outcome.simTimeMs = clock.now;
  outcome.distance = dino.progress;
  return outcome;
}

/* ------------------------------------------------------------------ */
/* Identical simulation steps: outcomes must match exactly             */
/* ------------------------------------------------------------------ */

describe('game speed runs the same simulation faster', () => {
  // 48ms of simulation per step in each case, reached with different real
  // frame budgets. Same steps in, same simulation out.
  const cases = [
    { speed: 1, frameMs: 48 },
    { speed: 2, frameMs: 24 },
    { speed: 3, frameMs: 16 },
  ];
  const SIM_MS = 30_000;

  it('travels the same distance and fires the same number of shots', () => {
    // Compsognathus has no sprint timer, so the run is fully deterministic.
    const outcomes = cases.map((c) =>
      run({ ...c, simDurationMs: SIM_MS, speciesId: 'compsognathus' }),
    );
    for (const o of outcomes) expect(o.simTimeMs).toBe(SIM_MS);
    const [base] = outcomes;
    expect(base.shots).toBeGreaterThan(20);
    expect(base.distance).toBeGreaterThan(100);
    for (const o of outcomes) {
      expect(o.shots).toBe(base.shots);
      expect(o.distance).toBeCloseTo(base.distance, 6);
    }
  });

  it('spends proportionally fewer real frames at higher speed', () => {
    const outcomes = cases.map((c) =>
      run({ ...c, simDurationMs: SIM_MS, speciesId: 'compsognathus' }),
    );
    // Same simulation, a third of the wall clock at 3x.
    expect(outcomes[0].realFrames).toBe(outcomes[1].realFrames);
    expect(outcomes[0].realFrames).toBe(outcomes[2].realFrames);
    const realMs = cases.map((c, i) => outcomes[i].realFrames * c.frameMs);
    expect(realMs[1]).toBeCloseTo(realMs[0] / 2, 5);
    expect(realMs[2]).toBeCloseTo(realMs[0] / 3, 5);
  });

  it('keeps status effects the same length in simulation time', () => {
    const outcomes = cases.map((c) =>
      run({
        ...c,
        speciesId: 'compsognathus',
        simDurationMs: 20_000,
        applyAt: 2000,
        slow: { factor: 0.5, durationMs: 4000 },
        stunMs: 1500,
      }),
    );
    const [base] = outcomes;
    expect(base.slowEndedAt).not.toBeNull();
    expect(base.stunEndedAt).not.toBeNull();
    for (const o of outcomes) {
      expect(o.slowEndedAt).toBe(base.slowEndedAt);
      expect(o.stunEndedAt).toBe(base.stunEndedAt);
    }
  });

  it('deals the same total burn damage', () => {
    const outcomes = cases.map((c) =>
      run({
        ...c,
        speciesId: 'compsognathus',
        simDurationMs: 20_000,
        applyAt: 1000,
        burn: { dps: 18, durationMs: 3000 },
      }),
    );
    const [base] = outcomes;
    expect(base.burnDamage).toBeGreaterThan(40);
    for (const o of outcomes) expect(o.burnDamage).toBe(base.burnDamage);
  });

  it('keeps sprint cadence identical', () => {
    const outcomes = cases.map((c) =>
      run({ ...c, simDurationMs: 40_000, speciesId: 'pachycephalosaurus', seedRandom: 0.5 }),
    );
    const [base] = outcomes;
    expect(base.sprintStarts).toBeGreaterThan(2);
    for (const o of outcomes) expect(o.sprintStarts).toBe(base.sprintStarts);
  });

  it('completes hero cooldowns and fixture lifetimes at the same moment', () => {
    const outcomes = cases.map((c) =>
      run({ ...c, simDurationMs: 40_000, speciesId: 'compsognathus' }),
    );
    const [base] = outcomes;
    expect(base.cooldownReadyAt).not.toBeNull();
    expect(base.fixtureAliveAt).not.toBeNull();
    expect(base.supplyTicks).toBeGreaterThan(4);
    for (const o of outcomes) {
      expect(o.cooldownReadyAt).toBe(base.cooldownReadyAt);
      expect(o.fixtureAliveAt).toBe(base.fixtureAliveAt);
      expect(o.supplyTicks).toBe(base.supplyTicks);
    }
  });
});

/* ------------------------------------------------------------------ */
/* Rate invariance under a fixed real frame budget                     */
/* ------------------------------------------------------------------ */

describe('effective rates do not change with game speed', () => {
  // The regression this guards: gameplay deadlines were previously read from
  // the wall clock while movement advanced on the scaled delta, so at 3x a
  // defender fired a third as often per metre the target travelled.
  const SIM_MS = 24_000;
  const outcomes = [1, 2, 3].map((speed) =>
    run({ speed, frameMs: 16, simDurationMs: SIM_MS, speciesId: 'compsognathus' }),
  );

  it('runs the same amount of simulation at every speed', () => {
    for (const o of outcomes) expect(o.simTimeMs).toBeGreaterThanOrEqual(SIM_MS);
  });

  it('holds shots per simulated second constant', () => {
    const rates = outcomes.map((o) => o.shots / (o.simTimeMs / 1000));
    for (const r of rates) expect(r).toBeCloseTo(rates[0], 1);
  });

  it('holds shots fired per distance travelled constant', () => {
    const perDistance = outcomes.map((o) => o.shots / o.distance);
    for (const p of perDistance) expect(p).toBeCloseTo(perDistance[0], 2);
  });
});

/* ------------------------------------------------------------------ */
/* Pause                                                               */
/* ------------------------------------------------------------------ */

describe('pause freezes the authoritative clock', () => {
  it('advances zero simulation time across a long real-time pause', () => {
    // 30 real seconds at 60fps, at the fastest speed setting.
    const frozen = run({ speed: 3, frameMs: 16, simDurationMs: 30_000, frozen: true });
    expect(frozen.realFrames).toBeGreaterThan(1800);
    expect(frozen.simTimeMs).toBe(0);
  });

  it('leaves combat, movement and status untouched while frozen', () => {
    const frozen = run({
      speed: 3,
      frameMs: 16,
      simDurationMs: 30_000,
      frozen: true,
      applyAt: 0,
      slow: { factor: 0.5, durationMs: 1000 },
      stunMs: 800,
      burn: { dps: 30, durationMs: 1000 },
    });
    expect(frozen.shots).toBe(0);
    expect(frozen.distance).toBe(0);
    expect(frozen.burnDamage).toBe(0);
    // Nothing expired: a paused player does not return to a cleared board.
    expect(frozen.slowEndedAt).toBeNull();
    expect(frozen.stunEndedAt).toBeNull();
    expect(frozen.cooldownReadyAt).toBeNull();
    expect(frozen.fixtureAliveAt).toBeNull();
    expect(frozen.supplyTicks).toBe(0);
  });

  it('resumes exactly where it left off', () => {
    const uninterrupted = run({
      speed: 1,
      frameMs: 48,
      simDurationMs: 12_000,
      speciesId: 'compsognathus',
    });

    // The same simulation, with a long freeze spliced into the middle.
    const clock = new SimulationClock();
    const scene = asScene(fakeScene());
    const dino = new Dino(scene);
    dino.spawn(SPECIES.compsognathus, TIERS.green, path, 0, 1, clock.now);
    const unit = new DefenderUnit(scene, 'u1', RANGER, 400, 400);
    let shots = 0;
    const step = (frozen: boolean) => {
      const dt = simulationStepMs(48, 1, frozen);
      if (dt <= 0) return;
      clock.advance(dt);
      dino.update(clock.now, dt);
      if (clock.now >= unit.nextShotAt) {
        shots++;
        unit.nextShotAt = clock.now + unit.cooldownMs;
      }
    };
    const half = Math.ceil(12_000 / 48 / 2);
    for (let i = 0; i < half; i++) step(false);
    for (let i = 0; i < 2000; i++) step(true); // ~96 real seconds paused
    for (let i = 0; i < Math.ceil(12_000 / 48) - half; i++) step(false);

    expect(clock.now).toBe(uninterrupted.simTimeMs);
    expect(shots).toBe(uninterrupted.shots);
    expect(dino.progress).toBeCloseTo(uninterrupted.distance, 6);
  });
});

/* ------------------------------------------------------------------ */
/* Wave timing                                                         */
/* ------------------------------------------------------------------ */

describe('wave timing follows simulation time', () => {
  const spawnsOver = (speed: number, frameMs: number, simMs: number) => {
    const waves = new WaveSystem(RESEARCH_OUTPOST.waves);
    waves.begin(2);
    const clock = new SimulationClock();
    let spawned = 0;
    const frames = Math.ceil(simMs / (frameMs * speed));
    for (let i = 0; i < frames; i++) {
      const dt = simulationStepMs(frameMs, speed, false);
      clock.advance(dt);
      spawned += waves.tick(dt).length;
    }
    return { spawned, simTimeMs: clock.now };
  };

  it('spawns the same enemies for the same simulated duration at any speed', () => {
    const a = spawnsOver(1, 48, 6000);
    const b = spawnsOver(2, 24, 6000);
    const c = spawnsOver(3, 16, 6000);
    expect(a.spawned).toBeGreaterThan(0);
    expect(b.spawned).toBe(a.spawned);
    expect(c.spawned).toBe(a.spawned);
    expect(b.simTimeMs).toBe(a.simTimeMs);
  });

  it('spawns nothing while frozen', () => {
    const waves = new WaveSystem(RESEARCH_OUTPOST.waves);
    waves.begin(0);
    let spawned = 0;
    for (let i = 0; i < 3000; i++) spawned += waves.tick(simulationStepMs(16, 3, true)).length;
    expect(spawned).toBe(0);
  });
});

/* ------------------------------------------------------------------ */
/* The real combat system, not a reimplementation of it                */
/* ------------------------------------------------------------------ */

describe('CombatSystem fires on simulation time', () => {
  /**
   * Drives the genuine `CombatSystem` so that reverting any gameplay deadline
   * to a wall clock fails here. Presentation collaborators are stubbed; the
   * targeting, cooldown and status paths are the shipping ones.
   */
  function runCombat(speed: number, frameMs: number, simDurationMs: number, frozen = false) {
    const scene = fakeScene();
    const geometry = new MapGeometry(RESEARCH_OUTPOST);
    const grid = new SpatialGrid(RESEARCH_OUTPOST.width, RESEARCH_OUTPOST.height, 96);
    const clock = new SimulationClock();

    let shots = 0;
    const projectiles = { spawn: () => shots++ } as unknown as ProjectileSystem;
    const effects = {
      muzzleFlash: () => {},
      impact: () => {},
      damageNumber: () => {},
      beam: () => {},
      lightning: () => {},
      flameCone: () => {},
      radialBurst: () => {},
      frostBurst: () => {},
      explosion: () => {},
      death: () => {},
      shake: () => {},
    } as unknown as EffectsSystem;
    const audio = { play: () => {} } as unknown as AudioManager;

    const combat = new CombatSystem({
      scene: asScene(scene),
      geometry,
      grid,
      effects,
      audio,
      hooks: { onKill: () => {} },
    });
    combat.attachProjectiles(projectiles);

    // A durable target parked on the route, with a Ranger covering it. The
    // target is held still so the measurement isolates the cooldown model.
    const dino = new Dino(asScene(scene));
    dino.spawn(SPECIES.triceratops, TIERS.obsidian, path, 0, 1, clock.now);
    dino.progress = 400;
    dino.update(clock.now, 0);
    const sample = { x: dino.x, y: dino.y };

    const unit = new DefenderUnit(asScene(scene), 'u1', RANGER, sample.x + 40, sample.y + 40);
    unit.faceInstantly(dino.x, dino.y);

    combat.dinos = [dino];
    combat.defenders = [unit];
    combat.fixtures = [];

    const frames = frozen
      ? Math.ceil(simDurationMs / frameMs)
      : Math.ceil(simDurationMs / (frameMs * speed));
    for (let i = 0; i < frames; i++) {
      const dt = simulationStepMs(frameMs, speed, frozen);
      if (dt <= 0) continue;
      clock.advance(dt);
      grid.rebuild(combat.dinos);
      combat.update(clock.now, dt);
    }
    return { shots, simTimeMs: clock.now, hp: dino.hp };
  }

  it('fires the same number of shots per simulated second at every speed', () => {
    const a = runCombat(1, 48, 20_000);
    const b = runCombat(2, 24, 20_000);
    const c = runCombat(3, 16, 20_000);

    // 20 simulated seconds of a 1.5 shots/second defender.
    expect(a.shots).toBeGreaterThan(25);
    expect(b.shots).toBe(a.shots);
    expect(c.shots).toBe(a.shots);
    expect(b.simTimeMs).toBe(a.simTimeMs);
    expect(c.simTimeMs).toBe(a.simTimeMs);
  });

  it('fires nothing while the match is frozen', () => {
    const frozen = runCombat(3, 16, 30_000, true);
    expect(frozen.simTimeMs).toBe(0);
    expect(frozen.shots).toBe(0);
  });
});
