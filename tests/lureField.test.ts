import { describe, expect, it } from 'vitest';
import { MapGeometry, type PathRuntime } from '../src/game/systems/MapGeometry';
import { RESEARCH_OUTPOST } from '../src/game/data/maps';
import { SPECIES } from '../src/game/data/dinosaurs';
import { TIERS } from '../src/game/data/tiers';
import { HEROES_BY_ID } from '../src/game/data/heroes';
import { Dino } from '../src/game/entities/Dino';
import { HeroUnit } from '../src/game/entities/PlacedUnit';
import { CombatSystem } from '../src/game/systems/CombatSystem';
import { SimulationClock } from '../src/game/systems/SimulationClock';
import { SpatialGrid } from '../src/game/systems/SpatialGrid';
import type { ProjectileSystem } from '../src/game/systems/ProjectileSystem';
import type { EffectsSystem } from '../src/game/systems/EffectsSystem';
import type { AudioManager } from '../src/audio/AudioManager';
import { asScene, fakeScene } from './support/fakeScene';

/**
 * The Distract-o-matic's lure field is the only mechanic in the game that can
 * stop an animal outright, so these tests drive the shipping `CombatSystem`
 * and assert the limits that keep it from being a wall: the per-animal hold
 * budget, the recovery window that has to outlast a walk clear of the field,
 * and the shorter budget `steadfast` animals get. Nothing is exempt and
 * nothing is capped by headcount — a swarm walking past untouched was the
 * bug, not the design.
 */

const path: PathRuntime = new MapGeometry(RESEARCH_OUTPOST).paths[0];
const BEACON = HEROES_BY_ID.distractomatic;
const LURE = BEACON.attack.lure!;
const FRAME_MS = 16;

/** Where on the map an animal at `progress` stands, and which way it faces. */
function pointAt(
  scene: ReturnType<typeof fakeScene>,
  progress: number,
): { x: number; y: number; angle: number } {
  const probe = new Dino(asScene(scene));
  probe.spawn(SPECIES.compsognathus, TIERS.green, path, 0, 1, 0);
  probe.progress = progress;
  probe.update(0, 0);
  return { x: probe.x, y: probe.y, angle: probe.angle };
}

/** Placement rules keep units off the route, so the beacon sits beside it. */
const STANDOFF = 70;

interface Harness {
  clock: SimulationClock;
  combat: CombatSystem;
  grid: SpatialGrid;
  hero: HeroUnit;
  dinos: Dino[];
  step(): void;
  run(simMs: number, onFrame?: (now: number) => void): void;
}

/** Plants the beacon beside the route with `spawns` walking into it. */
function harness(
  spawns: { species: keyof typeof SPECIES; progress: number }[],
  { durable = true, anchorProgress = 600 }: { durable?: boolean; anchorProgress?: number } = {},
): Harness {
  const scene = fakeScene();
  const geometry = new MapGeometry(RESEARCH_OUTPOST);
  const grid = new SpatialGrid(RESEARCH_OUTPOST.width, RESEARCH_OUTPOST.height, 96);
  const clock = new SimulationClock();

  const effects = {
    muzzleFlash: () => {},
    impact: () => {},
    damageNumber: () => {},
    beam: () => {},
    lightning: () => {},
    flameCone: () => {},
    radialBurst: () => {},
    broadcastArcs: () => {},
    frostBurst: () => {},
    explosion: () => {},
    death: () => {},
    shake: () => {},
  } as unknown as EffectsSystem;

  const combat = new CombatSystem({
    scene: asScene(scene),
    geometry,
    grid,
    effects,
    audio: { play: () => {} } as unknown as AudioManager,
    hooks: { onKill: () => {} },
  });
  combat.attachProjectiles({ spawn: () => {} } as unknown as ProjectileSystem);

  const spot = pointAt(scene, anchorProgress);
  const hero = new HeroUnit(
    asScene(scene),
    'hero',
    BEACON,
    spot.x - Math.sin(spot.angle) * STANDOFF,
    spot.y + Math.cos(spot.angle) * STANDOFF,
  );

  const dinos = spawns.map((s) => {
    const d = new Dino(asScene(scene));
    d.spawn(SPECIES[s.species], TIERS.green, path, 0, 1, clock.now);
    d.progress = s.progress;
    d.laneOffset = 0;
    d.update(clock.now, 0);
    // Most of these tests measure movement, so the animal must outlive the
    // pulse that is landing on it.
    if (durable) {
      d.maxHp = 1e6;
      d.hp = 1e6;
    }
    return d;
  });

  combat.dinos = dinos;
  combat.defenders = [];
  combat.fixtures = [];
  combat.hero = hero;

  const step = () => {
    clock.advance(FRAME_MS);
    const now = clock.now;
    for (const d of dinos) d.update(now, FRAME_MS);
    grid.rebuild(dinos);
    combat.update(now, FRAME_MS);
  };

  return {
    clock,
    combat,
    grid,
    hero,
    dinos,
    step,
    run(simMs, onFrame) {
      const frames = Math.round(simMs / FRAME_MS);
      for (let i = 0; i < frames; i++) {
        step();
        onFrame?.(clock.now);
      }
    },
  };
}

describe('lure field', () => {
  it('is configured so anything it holds is inside the weapon it feeds', () => {
    expect(LURE.radius).toBeGreaterThan(0);
    expect(LURE.radius).toBeLessThanOrEqual(BEACON.range);
    expect(LURE.holdMs).toBeGreaterThan(0);
    expect(LURE.pullSpeed).toBeGreaterThan(0);
    expect(LURE.steadfastFactor).toBeGreaterThan(0);
    expect(LURE.steadfastFactor).toBeLessThan(1);
  });

  it('gives a freed animal long enough to walk clear before it can be caught again', () => {
    // If recovery ran out while the animal were still inside the field it
    // would be re-caught on the spot, which is the pinned-forever bug.
    const slowest = Math.min(...Object.values(SPECIES).map((s) => s.baseSpeed));
    expect(LURE.recoveryMs).toBeGreaterThan((LURE.radius / slowest) * 1000);
  });

  it('stops an animal at the emitter instead of letting it walk on', () => {
    const lured = harness([{ species: 'compsognathus', progress: 480 }]);
    lured.run(6000);

    const free = harness([{ species: 'compsognathus', progress: 480 }]);
    free.combat.hero = null;
    free.run(6000);

    expect(lured.dinos[0].progress).toBeLessThan(free.dinos[0].progress);
  });

  it('holds continuously while it holds at all', () => {
    // The old duty-cycled field stuttered; a distraction should read as one
    // unbroken pause, so the longest frozen run covers most of the budget.
    const h = harness([{ species: 'compsognathus', progress: 560 }]);
    let frozenRun = 0;
    let longest = 0;
    h.run(LURE.holdMs * 2, (now) => {
      if (h.dinos[0].currentSpeed(now) > 0) frozenRun = 0;
      else frozenRun += FRAME_MS;
      longest = Math.max(longest, frozenRun);
    });
    expect(longest).toBeGreaterThan(LURE.holdMs * 0.8);
  });

  it('releases an animal once its budget is spent and never re-catches it', () => {
    const h = harness([{ species: 'compsognathus', progress: 560 }]);

    let frozenRun = 0;
    let longest = 0;
    h.run(LURE.holdMs + LURE.recoveryMs + 4000, (now) => {
      if (h.dinos[0].currentSpeed(now) > 0) frozenRun = 0;
      else frozenRun += FRAME_MS;
      longest = Math.max(longest, frozenRun);
    });

    // Held for its budget and no longer — this is the stuck-at-the-beacon
    // regression, where an animal could be pinned for the whole match.
    expect(longest).toBeLessThan(LURE.holdMs + FRAME_MS * 4);
  });

  it('lets a lured animal reach the objective in the end', () => {
    const h = harness([{ species: 'compsognathus', progress: 560 }]);
    h.run(25_000);
    // Well past the emitter, so it broke free and stayed free.
    expect(h.dinos[0].progress).toBeGreaterThan(600 + LURE.radius);
  });

  it('distracts steadfast animals too, just for less time', () => {
    const heavy = harness([{ species: 'ankylosaurus', progress: 560 }]);
    const light = harness([{ species: 'compsognathus', progress: 560 }]);

    const frozen = (h: Harness, ms: number) => {
      let frames = 0;
      h.run(ms, (now) => {
        if (h.dinos[0].currentSpeed(now) <= 0) frames++;
      });
      return frames * FRAME_MS;
    };

    const heavyHeld = frozen(heavy, LURE.holdMs + 1000);
    const lightHeld = frozen(light, LURE.holdMs + 1000);

    // The reported bug was Ankylosaurus walking straight past untouched.
    expect(heavyHeld).toBeGreaterThan(300);
    expect(heavyHeld).toBeLessThan(lightHeld);
  });

  it('holds a whole swarm, not a handful of it', () => {
    // Swarm Protocol sends far more animals than any headcount cap would
    // cover; every one of them should stop.
    const pack = Array.from({ length: 14 }, (_, i) => ({
      species: 'compsognathus' as const,
      progress: 540 + i * 6,
    }));
    const h = harness(pack);

    let peakHeld = 0;
    h.run(1500, (now) => {
      peakHeld = Math.max(peakHeld, h.dinos.filter((d) => now < d.heldUntil).length);
    });

    expect(peakHeld).toBe(pack.length);
  });

  it('drags an animal that slipped past back towards the emitter', () => {
    // Placed just beyond the beacon but still inside the field.
    const h = harness([{ species: 'compsognathus', progress: 680 }]);
    const start = h.dinos[0].progress;
    h.run(300);
    expect(h.dinos[0].progress).toBeLessThan(start);
  });

  it('never drags an approaching animal forward', () => {
    // Pulling both ways would hand an animal ground it had not walked. It
    // still takes its own first step before the field engages, so allow one
    // frame of ordinary walking and nothing beyond it.
    const h = harness([{ species: 'compsognathus', progress: 500 }]);
    const start = h.dinos[0].progress;
    const oneStep = (SPECIES.compsognathus.baseSpeed * FRAME_MS) / 1000;
    h.run(LURE.holdMs * 0.5);
    expect(h.dinos[0].progress).toBeLessThanOrEqual(start + oneStep * 2);
  });
});

describe('pulse attack', () => {
  it('damages every animal in the arc on the same shot', () => {
    const h = harness([
      { species: 'compsognathus', progress: 560 },
      { species: 'compsognathus', progress: 600 },
      { species: 'compsognathus', progress: 640 },
    ]);
    const maxHp = h.dinos[0].maxHp;
    h.hero.faceInstantly(h.dinos[1].x, h.dinos[1].y);

    // One full attack period, so exactly one pulse lands.
    h.run(1000 / BEACON.fireRate);

    const hurt = h.dinos.filter((d) => d.hp < maxHp).length;
    expect(hurt).toBe(3);
  });

  it('spends no projectiles — the arcs are resolved in place', () => {
    const h = harness([{ species: 'compsognathus', progress: 600 }]);
    let spawned = 0;
    h.combat.attachProjectiles({ spawn: () => spawned++ } as unknown as ProjectileSystem);
    h.hero.faceInstantly(h.dinos[0].x, h.dinos[0].y);
    h.run(4000);
    expect(spawned).toBe(0);
  });
});
