import { describe, expect, it } from 'vitest';
import { MapGeometry, samplePathAt, nearestOnPath, type PathRuntime } from '../src/game/systems/MapGeometry';
import { RESEARCH_OUTPOST, DELTA_WETLANDS } from '../src/game/data/maps';
import { DEFENDERS } from '../src/game/data/defenders';
import { DefenderUnit } from '../src/game/entities/PlacedUnit';
import { Dino } from '../src/game/entities/Dino';
import { CombatSystem } from '../src/game/systems/CombatSystem';
import { SpatialGrid } from '../src/game/systems/SpatialGrid';
import { SPECIES } from '../src/game/data/dinosaurs';
import { TIERS } from '../src/game/data/tiers';
import type { Projectile, ProjectileSystem } from '../src/game/systems/ProjectileSystem';
import type { EffectsSystem } from '../src/game/systems/EffectsSystem';
import type { AudioManager } from '../src/audio/AudioManager';
import { SimulationClock, simulationStepMs } from '../src/game/systems/SimulationClock';
import { asScene, fakeScene } from './support/fakeScene';

/**
 * Ted is the only defender that moves, so his beat is driven here through the
 * real `DefenderUnit` against a real map. The guarantees under test are that
 * he stays on the route he was deployed over, that he turns at both ends
 * rather than running off either one, and that his beat is measured in
 * simulation time like every other deadline — so pause freezes him and 2x
 * flies him faster rather than differently.
 */

const geometry = new MapGeometry(RESEARCH_OUTPOST);
const path: PathRuntime = geometry.paths[0];
const TED = DEFENDERS.find((d) => d.id === 'ted')!;
/** One rendered frame, in real milliseconds. */
const FRAME_MS = 16;
const PATROL = TED.patrol!;

interface Run {
  unit: DefenderUnit;
  clock: SimulationClock;
  /** Mirrors `MatchScene.update`: derive the step, advance the clock, then fly. */
  fly(simMs: number, onFrame?: (unit: DefenderUnit, now: number) => void): void;
}

function deployAt(progress: number, options: { speed?: number; frameMs?: number; frozen?: boolean } = {}): Run {
  const { frameMs = 16, frozen = false } = options;
  const scene = fakeScene();
  const clock = new SimulationClock();
  const start = samplePathAt(path, progress);
  const unit = new DefenderUnit(asScene(scene), 'ted', TED, start.x, start.y);
  unit.startPatrol(path, progress, geometry.visibleSpan(path, TED.footprint));

  return {
    unit,
    clock,
    fly(simMs, onFrame) {
      // `simMs` is a span of *simulation* time, so a faster game speed needs
      // proportionally fewer real frames to cover it. A frozen run burns real
      // frames and no simulation time at all — that is the point of the test.
      const frames = frozen
        ? Math.ceil(simMs / frameMs)
        : Math.ceil(simMs / (frameMs * (options.speed ?? 1)));
      for (let i = 0; i < frames; i++) {
        const dt = simulationStepMs(frameMs, options.speed ?? 1, frozen);
        if (dt <= 0) continue;
        clock.advance(dt);
        unit.updatePatrol(clock.now, dt);
        onFrame?.(unit, clock.now);
      }
    },
  };
}

/** How far off the route the unit currently is. */
const offRoute = (unit: DefenderUnit) => nearestOnPath(path, unit.x, unit.y).distance;

describe('Ted is configured as the one airborne defender', () => {
  it('is the only defender that patrols, and carries a usable beat', () => {
    const flying = DEFENDERS.filter((d) => d.patrol);
    expect(flying.map((d) => d.id)).toEqual(['ted']);
    expect(PATROL.speed).toBeGreaterThan(0);
    expect(PATROL.turnMs).toBeGreaterThanOrEqual(0);
  });

  it('outruns the animals it is hunting, or it would never catch the tail', () => {
    // A beat slower than the wave it is chasing only ever sees the back of it.
    expect(PATROL.speed).toBeGreaterThan(50);
  });

  it('bombs a small area beneath itself rather than reaching out', () => {
    for (const level of TED.levels) {
      expect(level.attack.pattern).toBe('lob');
      expect(level.attack.splashRadius, 'splash').toBeGreaterThan(0);
      // Short reach: the charges go down, not out. Anything much longer than
      // the splash would read as artillery instead of a bombing run.
      expect(level.range).toBeLessThan(120);
      expect(level.attack.splashRadius!).toBeLessThan(level.range);
    }
  });
});

describe('the patrol beat', () => {
  it('starts out heading for the top of the route, where the animals come from', () => {
    const run = deployAt(path.length * 0.5);
    const before = nearestOnPath(path, run.unit.x, run.unit.y).progress;
    run.fly(500);
    const after = nearestOnPath(path, run.unit.x, run.unit.y).progress;
    expect(after).toBeLessThan(before);
  });

  it('turns at the start and comes back towards the objective', () => {
    const span = geometry.visibleSpan(path, TED.footprint);
    // Deployed close to the near end of the beat, so the first turn is quick.
    const run = deployAt(span.from + 140);
    let sawStart = false;
    let cameBack = false;
    run.fly(12_000, (unit) => {
      const at = nearestOnPath(path, unit.x, unit.y).progress;
      if (at <= span.from + 4) sawStart = true;
      if (sawStart && at > span.from + 200) cameBack = true;
    });
    expect(sawStart).toBe(true);
    expect(cameBack).toBe(true);
  });

  it('turns again at the objective end and keeps shuttling', () => {
    const span = geometry.visibleSpan(path, TED.footprint);
    const run = deployAt(span.to - 140);
    const seen: number[] = [];
    // Long enough for several full lengths of the beat.
    run.fly(120_000, (unit) => seen.push(nearestOnPath(path, unit.x, unit.y).progress));

    // Reached both ends, more than once each: it is shuttling, not parked.
    expect(seen.filter((p) => p <= span.from + 8).length).toBeGreaterThan(1);
    expect(seen.filter((p) => p >= span.to - 8).length).toBeGreaterThan(1);
  });

  it('never leaves the route it was deployed over', () => {
    const run = deployAt(path.length * 0.3);
    let worst = 0;
    run.fly(90_000, (unit) => {
      worst = Math.max(worst, offRoute(unit));
    });
    // Within the sampling step of the polyline it flies along.
    expect(worst).toBeLessThan(8);
  });

  it('stays on screen instead of parking at the off-map spawn point', () => {
    // Routes start and end off the map edge so animals walk on and off. An
    // aircraft shuttling along one would otherwise fly off the playfield and
    // hang there, out of sight of the player who paid for it.
    const span = geometry.visibleSpan(path, TED.footprint);
    expect(span.from).toBeGreaterThan(0);
    expect(span.to).toBeLessThanOrEqual(path.length);

    const run = deployAt(span.from + 40);
    let offScreen = 0;
    run.fly(90_000, (unit) => {
      if (!geometry.inBounds(unit.x, unit.y, 0)) offScreen++;
    });
    expect(offScreen).toBe(0);
  });

  it('never runs off either end of its beat', () => {
    const span = geometry.visibleSpan(path, TED.footprint);
    const run = deployAt(span.to - 60);
    let lo = Infinity;
    let hi = -Infinity;
    run.fly(90_000, (unit) => {
      const at = nearestOnPath(path, unit.x, unit.y).progress;
      lo = Math.min(lo, at);
      hi = Math.max(hi, at);
    });
    expect(lo).toBeGreaterThanOrEqual(span.from - 2);
    expect(hi).toBeLessThanOrEqual(span.to + 2);
  });

  it('points its nose along the direction of travel, both ways', () => {
    // Capture the heading on each leg by watching for the turn rather than
    // guessing when it happens.
    const span = geometry.visibleSpan(path, TED.footprint);
    const run = deployAt(span.from + 300);

    let outbound: number | null = null;
    let inbound: number | null = null;
    let lastProgress = nearestOnPath(path, run.unit.x, run.unit.y).progress;
    run.fly(20_000, (unit) => {
      const at = nearestOnPath(path, unit.x, unit.y).progress;
      const moving = at - lastProgress;
      lastProgress = at;
      if (moving < -0.5 && outbound === null) outbound = unit.facing;
      if (moving > 0.5 && outbound !== null && inbound === null) inbound = unit.facing;
    });

    expect(outbound).not.toBeNull();
    expect(inbound).not.toBeNull();
    // Opposite legs of the same route face roughly opposite ways.
    const delta = Math.abs(Math.atan2(Math.sin(outbound! - inbound!), Math.cos(outbound! - inbound!)));
    expect(delta).toBeGreaterThan(Math.PI / 2);
  });

  it('docks onto whichever route it was deployed over', () => {
    // Delta has two, and an aircraft dropped over one must not fly the other.
    const delta = new MapGeometry(DELTA_WETLANDS);
    expect(delta.paths.length).toBeGreaterThan(1);
    for (const route of delta.paths) {
      const mid = samplePathAt(route, route.length * 0.5);
      const found = delta.nearestPath(mid.x, mid.y);
      expect(found?.path.id, route.id).toBe(route.id);
    }
  });
});

describe('the beat runs on simulation time', () => {
  /** Distance flown along the route over a fixed span of *simulation* time. */
  function flownIn(simMs: number, speed: number, frameMs: number): number {
    const run = deployAt(path.length * 0.5, { speed, frameMs });
    const before = nearestOnPath(path, run.unit.x, run.unit.y).progress;
    run.fly(simMs);
    return before - nearestOnPath(path, run.unit.x, run.unit.y).progress;
  }

  it('flies the same distance per simulated second at every game speed', () => {
    const a = flownIn(4000, 1, 48);
    const b = flownIn(4000, 2, 24);
    const c = flownIn(4000, 3, 16);
    expect(a).toBeGreaterThan(100);
    expect(b).toBeCloseTo(a, 6);
    expect(c).toBeCloseTo(a, 6);
  });

  it('does not move at all while the match is frozen', () => {
    const run = deployAt(path.length * 0.5, { frozen: true, speed: 3 });
    const before = { x: run.unit.x, y: run.unit.y };
    run.fly(30_000);
    expect(run.clock.now).toBe(0);
    expect(run.unit.x).toBe(before.x);
    expect(run.unit.y).toBe(before.y);
  });

  it('hangs at the turn for as long as the beat says', () => {
    const run = deployAt(geometry.visibleSpan(path, TED.footprint).from + 60);
    let stalledFrames = 0;
    let last = { x: run.unit.x, y: run.unit.y };
    run.fly(4000, (unit) => {
      if (unit.x === last.x && unit.y === last.y) stalledFrames++;
      last = { x: unit.x, y: unit.y };
    });
    // It paused at the end of the route rather than bouncing off instantly.
    expect(stalledFrames * 16).toBeGreaterThan(PATROL.turnMs * 0.5);
  });
});

describe('bombing what it flies over', () => {
  /**
   * Drives the shipping `CombatSystem` with Ted patrolling and one animal
   * walking the same route, landing every shell at its aim point the way the
   * projectile pool does on impact. This is the whole chain — acquire, fire,
   * detonate, credit — which a browser run can only sample by luck.
   */
  function flyAgainst(species: keyof typeof SPECIES, simMs: number) {
    const scene = fakeScene();
    const grid = new SpatialGrid(RESEARCH_OUTPOST.width, RESEARCH_OUTPOST.height, 96);
    const clock = new SimulationClock();

    let shots = 0;
    const landed: { x: number; y: number; p: Projectile }[] = [];
    const combat = new CombatSystem({
      scene: asScene(scene),
      geometry,
      grid,
      effects: new Proxy({}, { get: () => () => {} }) as unknown as EffectsSystem,
      audio: { play: () => {} } as unknown as AudioManager,
      hooks: { onKill: () => {} },
    });
    combat.attachProjectiles({
      spawn: (cfg: Projectile & { targetX?: number; targetY?: number }) => {
        shots++;
        landed.push({ x: cfg.targetX ?? cfg.x, y: cfg.targetY ?? cfg.y, p: cfg });
      },
    } as unknown as ProjectileSystem);

    const span = geometry.visibleSpan(path, TED.footprint);
    const spot = samplePathAt(path, span.from + 600);
    const ted = new DefenderUnit(asScene(scene), 'ted', TED, spot.x, spot.y);
    ted.startPatrol(path, span.from + 600, span);

    const dino = new Dino(asScene(scene));
    dino.spawn(SPECIES[species], TIERS.green, path, 0, 1, 0);
    dino.update(0, 0);

    combat.dinos = [dino];
    combat.defenders = [ted];
    combat.fixtures = [];

    for (let i = 0; i < Math.ceil(simMs / FRAME_MS); i++) {
      clock.advance(FRAME_MS);
      const now = clock.now;
      dino.update(now, FRAME_MS);
      ted.updatePatrol(now, FRAME_MS);
      grid.rebuild([dino]);
      combat.update(now, FRAME_MS);
      while (landed.length) {
        const shell = landed.shift()!;
        combat.onDetonate(shell.x, shell.y, shell.p);
      }
    }
    return { ted, dino, shots };
  }

  it('acquires and bombs an animal it passes over', () => {
    const { ted, shots } = flyAgainst('triceratops', 60_000);
    expect(shots).toBeGreaterThan(0);
    expect(ted.damageDealt).toBeGreaterThan(0);
  });

  it('kills what it flies over, given enough passes', () => {
    const { ted, dino } = flyAgainst('compsognathus', 60_000);
    expect(dino.alive).toBe(false);
    expect(ted.kills).toBeGreaterThan(0);
  });

  it('is in contact only part of the time, so its output is well under its printed rate', () => {
    // The trade for covering a whole route: it passes over a target rather
    // than holding it, so a single animal absorbs far fewer than 1.6 shots a
    // second. If this ever approaches the nominal rate, the beat has stopped
    // moving and something is wrong.
    const { shots } = flyAgainst('triceratops', 60_000);
    const nominal = TED.levels[0].fireRate * 60;
    expect(shots).toBeLessThan(nominal * 0.5);
  });
});
