import { describe, expect, it } from 'vitest';
import { MapGeometry, type PathRuntime } from '../src/game/systems/MapGeometry';
import { RESEARCH_OUTPOST } from '../src/game/data/maps';
import { SPECIES } from '../src/game/data/dinosaurs';
import { TIERS } from '../src/game/data/tiers';
import { FIXTURES_BY_ID } from '../src/game/data/fixtures';
import { Dino } from '../src/game/entities/Dino';
import { FixtureUnit } from '../src/game/entities/Fixture';
import { CombatSystem } from '../src/game/systems/CombatSystem';
import { SimulationClock } from '../src/game/systems/SimulationClock';
import { SpatialGrid } from '../src/game/systems/SpatialGrid';
import type { ProjectileSystem } from '../src/game/systems/ProjectileSystem';
import type { EffectsSystem } from '../src/game/systems/EffectsSystem';
import type { AudioManager } from '../src/audio/AudioManager';
import { asScene, fakeScene } from './support/fakeScene';

/**
 * Fixtures are consumed by the animals they work on, and by nothing else.
 *
 * The regression that motivated these tests: the Decoy Beacon carried a
 * 16-second lifetime that started at deployment, so two beacons dropped during
 * a build phase were both dead before the wave they were bought for ever
 * launched. A fixture standing in a quiet lane must keep every point of its
 * integrity, however long the player leaves it there.
 */

const path: PathRuntime = new MapGeometry(RESEARCH_OUTPOST).paths[0];
const DECOY = FIXTURES_BY_ID.decoyBeacon;
const BARRICADE = FIXTURES_BY_ID.barricade;
const FRAME_MS = 16;

/**
 * Far enough from the route that nothing can ever reach the fixture. The map's
 * far corner sits ~400px off the route, well outside any fixture radius.
 */
const AWAY = { x: 1240, y: 690 };

interface Harness {
  clock: SimulationClock;
  combat: CombatSystem;
  fixture: FixtureUnit;
  dinos: Dino[];
  run(simMs: number, onFrame?: (now: number) => void): void;
}

/** Plants `def` at `spot` with `spawns` walking the route towards it. */
function harness(
  def: typeof DECOY,
  spot: { x: number; y: number },
  spawns: { species: keyof typeof SPECIES; progress: number }[] = [],
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

  const fixture = new FixtureUnit(asScene(scene), 'f1', def, spot.x, spot.y, clock.now);

  const dinos = spawns.map((s) => {
    const d = new Dino(asScene(scene));
    d.spawn(SPECIES[s.species], TIERS.green, path, 0, 1, clock.now);
    d.progress = s.progress;
    d.laneOffset = 0;
    d.update(clock.now, 0);
    // These tests measure the fixture, so the animals must outlive it.
    d.maxHp = 1e6;
    d.hp = 1e6;
    return d;
  });

  combat.dinos = dinos;
  combat.defenders = [];
  combat.fixtures = [fixture];
  combat.hero = null;

  return {
    clock,
    combat,
    fixture,
    dinos,
    run(simMs, onFrame) {
      const frames = Math.round(simMs / FRAME_MS);
      for (let i = 0; i < frames; i++) {
        clock.advance(FRAME_MS);
        const now = clock.now;
        for (const d of dinos) d.update(now, FRAME_MS);
        grid.rebuild(dinos);
        combat.update(now, FRAME_MS);
        onFrame?.(now);
      }
    },
  };
}

/** Somewhere on the route, so animals walk into the fixture's radius. */
function onRoute(progress: number): { x: number; y: number } {
  const scene = fakeScene();
  const probe = new Dino(asScene(scene));
  probe.spawn(SPECIES.compsognathus, TIERS.green, path, 0, 1, 0);
  probe.progress = progress;
  probe.update(0, 0);
  return { x: probe.x, y: probe.y };
}

describe('fixture lifetime', () => {
  it('puts no fixture on a countdown', () => {
    // The shipped data is the fix: a lifetime field is what expired a beacon
    // that had never been touched.
    for (const f of Object.values(FIXTURES_BY_ID)) {
      expect(f, f.id).not.toHaveProperty('durationMs');
    }
  });

  it('leaves an idle decoy at full integrity for far longer than a build phase', () => {
    // The reported bug, at the scale it was reported: deployed, then left
    // alone while the player finished setting up.
    const h = harness(DECOY, AWAY);
    h.run(180_000);

    expect(h.fixture.alive).toBe(true);
    expect(h.fixture.integrity).toBe(DECOY.integrity);
    expect(h.fixture.condition()).toBe(1);
  });

  it('leaves an idle barricade at full integrity too', () => {
    const h = harness(BARRICADE, AWAY);
    h.run(180_000);
    expect(h.fixture.alive).toBe(true);
    expect(h.fixture.integrity).toBe(BARRICADE.integrity);
  });

  it('never drops a decoy while animals are merely on the map, out of range', () => {
    // An animal walking a distant stretch of the route must not tick it down.
    const h = harness(DECOY, AWAY, [{ species: 'velociraptor', progress: 200 }]);
    h.run(60_000);
    expect(h.fixture.integrity).toBe(DECOY.integrity);
  });

  it('reads full condition whatever the clock says', () => {
    const h = harness(DECOY, AWAY);
    const readings: number[] = [];
    h.run(90_000, () => readings.push(h.fixture.condition()));
    expect(Math.min(...readings)).toBe(1);
  });
});

describe('fixture wear', () => {
  it('spends a decoy only while it is holding something', () => {
    const spot = onRoute(600);
    const idle = harness(DECOY, spot);
    const working = harness(DECOY, spot, [
      { species: 'velociraptor', progress: 600 },
      { species: 'velociraptor', progress: 620 },
    ]);

    idle.run(4000);
    working.run(4000);

    expect(idle.fixture.integrity).toBe(DECOY.integrity);
    expect(working.fixture.integrity).toBeLessThan(DECOY.integrity);
  });

  it('wears faster the more it holds', () => {
    const spot = onRoute(600);
    const pack = (n: number) =>
      Array.from({ length: n }, (_, i) => ({
        species: 'velociraptor' as const,
        progress: 588 + i * 10,
      }));

    const few = harness(DECOY, spot, pack(2));
    const many = harness(DECOY, spot, pack(8));
    few.run(3000);
    many.run(3000);

    const spent = (h: Harness) => DECOY.integrity - h.fixture.integrity;
    expect(spent(many)).toBeGreaterThan(spent(few));
  });

  it('holds a group for several seconds before the group tears it apart', () => {
    // The trade the beacon is sold on: it buys a lane a handful of seconds and
    // is consumed doing it. Well short of forever, well clear of useless.
    const h = harness(
      DECOY,
      onRoute(600),
      Array.from({ length: 6 }, (_, i) => ({
        species: 'velociraptor' as const,
        progress: 572 + i * 12,
      })),
    );

    let heldFrames = 0;
    let diedAt: number | null = null;
    h.run(40_000, (now) => {
      if (h.dinos.some((d) => now < d.heldUntil)) heldFrames++;
      if (diedAt === null && !h.fixture.alive) diedAt = now;
    });

    expect(diedAt).not.toBeNull();
    expect(heldFrames * FRAME_MS).toBeGreaterThan(3000);
    expect(diedAt!).toBeLessThan(30_000);
  });

  it('releases everything it was holding when it is destroyed', () => {
    const h = harness(DECOY, onRoute(600), [
      { species: 'velociraptor', progress: 600 },
      { species: 'velociraptor', progress: 616 },
    ]);
    h.run(40_000);

    expect(h.fixture.alive).toBe(false);
    const now = h.clock.now;
    for (const d of h.dinos) expect(now).toBeGreaterThanOrEqual(d.heldUntil);
    // And having been freed, they got on with the walk.
    for (const d of h.dinos) expect(d.progress).toBeGreaterThan(650);
  });

  it('is ignored by steadfast animals, which therefore cannot wear it down', () => {
    const h = harness(DECOY, onRoute(600), [{ species: 'ankylosaurus', progress: 600 }]);
    h.run(3000);
    expect(h.fixture.integrity).toBe(DECOY.integrity);
    expect(h.clock.now).toBeGreaterThanOrEqual(h.dinos[0].heldUntil);
  });

  it('cannot wear out a fixture that has no integrity at all', () => {
    // The fence and the cache are permanent by design; with lifetimes gone,
    // an integrity of 0 has to mean indestructible rather than instantly dead.
    for (const id of ['shockFence', 'supplyCache'] as const) {
      const def = FIXTURES_BY_ID[id];
      expect(def.integrity).toBe(0);
      const h = harness(def, onRoute(600), [{ species: 'velociraptor', progress: 600 }]);
      h.run(20_000);
      expect(h.fixture.alive, id).toBe(true);
      expect(h.fixture.condition(), id).toBe(1);
    }
  });
});
