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
 * stop an animal indefinitely, so these tests drive the shipping
 * `CombatSystem` and assert the limits that keep it from being a wall: the
 * duty cycle, the capacity, and the `steadfast` exemption.
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
    expect(LURE.dutyCycle).toBeGreaterThan(0);
    expect(LURE.dutyCycle).toBeLessThan(1);
    expect(LURE.capacity).toBeGreaterThanOrEqual(1);
    expect(LURE.pullSpeed).toBeGreaterThan(0);
  });

  it('holds an animal at the emitter instead of letting it walk on', () => {
    const lured = harness([{ species: 'compsognathus', progress: 480 }]);
    lured.run(6000);

    const free = harness([{ species: 'compsognathus', progress: 480 }]);
    free.combat.hero = null;
    free.run(6000);

    expect(lured.dinos[0].progress).toBeLessThan(free.dinos[0].progress);
  });

  it('never holds anything permanently — the field drops every cycle', () => {
    const h = harness([{ species: 'compsognathus', progress: 480 }]);
    const period = 1000 / BEACON.fireRate;

    let walkingFrames = 0;
    // Three full duty cycles is long enough that a stuck animal shows up.
    h.run(period * 3, (now) => {
      if (h.dinos[0].currentSpeed(now) > 0) walkingFrames++;
    });

    expect(walkingFrames).toBeGreaterThan(0);
    // Roughly the off-window's share of every period, with slack for the
    // frame quantisation at the window edges.
    const expected = (h.clock.now / FRAME_MS) * (1 - LURE.dutyCycle);
    expect(walkingFrames).toBeGreaterThan(expected * 0.6);
  });

  it('caps any single hold at one broadcast window', () => {
    const h = harness([{ species: 'compsognathus', progress: 480 }]);
    const period = 1000 / BEACON.fireRate;

    let frozenRun = 0;
    let longestFreeze = 0;
    h.run(period * 6, (now) => {
      if (h.dinos[0].currentSpeed(now) > 0) frozenRun = 0;
      else frozenRun += FRAME_MS;
      longestFreeze = Math.max(longestFreeze, frozenRun);
    });

    // One window plus the frame of lag between applying a hold and releasing
    // it. Anything longer would mean the field can stall an animal outright.
    expect(longestFreeze).toBeLessThan(period * LURE.dutyCycle + FRAME_MS * 3);
  });

  it('lets an animal close on the emitter rather than freezing it where it stands', () => {
    const h = harness([{ species: 'compsognathus', progress: 300 }]);
    const start = h.dinos[0].progress;
    h.run(8000);
    // It is still short of the emitter, so nothing is pulling it back yet.
    expect(h.dinos[0].progress).toBeGreaterThan(start + 100);
  });

  it('ignores steadfast animals entirely', () => {
    const lured = harness([{ species: 'triceratops', progress: 480 }]);
    lured.run(6000);

    const free = harness([{ species: 'triceratops', progress: 480 }]);
    free.combat.hero = null;
    free.run(6000);

    expect(lured.dinos[0].progress).toBeCloseTo(free.dinos[0].progress, 3);
  });

  it('holds no more than its capacity, so a big pack walks through', () => {
    const pack = Array.from({ length: LURE.capacity + 4 }, (_, i) => ({
      species: 'compsognathus' as const,
      progress: 560 + i * 8,
    }));
    const h = harness(pack);

    let peakHeld = 0;
    h.run(3000, (now) => {
      const held = h.dinos.filter((d) => now < d.heldUntil).length;
      peakHeld = Math.max(peakHeld, held);
    });

    expect(peakHeld).toBeGreaterThan(0);
    expect(peakHeld).toBeLessThanOrEqual(LURE.capacity);
  });

  it('drags an animal that slipped past back towards the emitter', () => {
    // Placed just beyond the beacon but still inside the field.
    const h = harness([{ species: 'compsognathus', progress: 680 }]);
    const start = h.dinos[0].progress;

    // One broadcast window is enough to see the direction of travel reverse.
    h.run(300);
    expect(h.dinos[0].progress).toBeLessThan(start);
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
