import { describe, expect, it } from 'vitest';
import { MAPS, MAPS_BY_ID } from '../src/game/data/maps';
import { DEFENDERS } from '../src/game/data/defenders';
import { TURRETS } from '../src/game/data/turrets';
import { FIXTURES } from '../src/game/data/fixtures';
import { HEROES } from '../src/game/data/heroes';
import { CHALLENGES } from '../src/game/data/challenges';
import { SPECIES, SPECIES_ORDER } from '../src/game/data/dinosaurs';
import { TIERS, TIER_ORDER, boostTier } from '../src/game/data/tiers';
import { ALL_PLACEABLES, STARTING_UNLOCKS, findDefender, findFixture, findHero } from '../src/game/data/catalog';
import { waveEnemyCount } from '../src/game/data/waves';
import { MapGeometry } from '../src/game/systems/MapGeometry';
import { scaledHp } from '../src/game/systems/combatMath';

/**
 * The whole game is a set of balance tables. These guard the shapes those
 * tables have to hold so a typo in a data file fails here rather than in a
 * player's match.
 */

describe('tiers', () => {
  it('rise monotonically in health, armour and bounty', () => {
    for (let i = 1; i < TIER_ORDER.length; i++) {
      const prev = TIERS[TIER_ORDER[i - 1]];
      const cur = TIERS[TIER_ORDER[i]];
      expect(cur.hpMultiplier).toBeGreaterThan(prev.hpMultiplier);
      expect(cur.bountyMultiplier).toBeGreaterThan(prev.bountyMultiplier);
      expect(cur.armorBonus).toBeGreaterThanOrEqual(prev.armorBonus);
      expect(cur.rank).toBe(prev.rank + 1);
    }
  });

  it('gives every tier a distinct colour and marking pattern', () => {
    expect(new Set(TIER_ORDER.map((t) => TIERS[t].color)).size).toBe(TIER_ORDER.length);
    expect(new Set(TIER_ORDER.map((t) => TIERS[t].pattern)).size).toBe(TIER_ORDER.length);
  });

  it('clamps tier boosting at both ends', () => {
    expect(boostTier('green', 1)).toBe('blue');
    expect(boostTier('obsidian', 3)).toBe('obsidian');
    expect(boostTier('green', -5)).toBe('green');
  });
});

describe('species', () => {
  it('lists every species exactly once in display order', () => {
    expect(new Set(SPECIES_ORDER).size).toBe(SPECIES_ORDER.length);
    expect(SPECIES_ORDER.length).toBe(Object.keys(SPECIES).length);
  });

  it('has sane combat numbers', () => {
    for (const id of SPECIES_ORDER) {
      const s = SPECIES[id];
      expect(s.baseHp, id).toBeGreaterThan(0);
      expect(s.baseSpeed, id).toBeGreaterThan(0);
      expect(s.armor, id).toBeGreaterThanOrEqual(0);
      expect(s.objectiveDamage, id).toBeGreaterThan(0);
      expect(s.bounty, id).toBeGreaterThan(0);
      expect(s.body.length, id).toBeGreaterThan(0);
      expect(s.codex.blurb.length, id).toBeGreaterThan(10);
    }
  });

  it('gives every sprinter the timings the trait needs', () => {
    for (const id of SPECIES_ORDER) {
      const s = SPECIES[id];
      if (!s.traits.includes('sprint')) continue;
      expect(s.sprintMultiplier, id).toBeGreaterThan(1);
      expect(s.sprintDurationMs, id).toBeGreaterThan(0);
      expect(s.sprintIntervalMs, id).toBeGreaterThan(s.sprintDurationMs!);
    }
  });

  it('makes bosses genuinely boss-sized', () => {
    const bosses = SPECIES_ORDER.filter((id) => SPECIES[id].traits.includes('boss'));
    expect(bosses.length).toBeGreaterThan(0);
    const biggestNonBoss = Math.max(
      ...SPECIES_ORDER.filter((id) => !SPECIES[id].traits.includes('boss')).map((id) => SPECIES[id].baseHp),
    );
    for (const id of bosses) expect(SPECIES[id].baseHp, id).toBeGreaterThan(biggestNonBoss);
  });

  it('keeps armour meaningful relative to the smallest weapons', () => {
    // The armoured archetype must actually shrug off a Ranger dart.
    const rangerDamage = DEFENDERS.find((d) => d.id === 'ranger')!.levels[0].damage;
    expect(SPECIES.ankylosaurus.armor).toBeGreaterThan(rangerDamage);
  });
});

describe('defenders and turrets', () => {
  const all = [...DEFENDERS, ...TURRETS];

  it('has unique ids across every placeable', () => {
    const ids = ALL_PLACEABLES.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every unit exactly three levels that improve', () => {
    for (const d of all) {
      expect(d.levels, d.id).toHaveLength(3);
      expect(d.levels[0].cost, d.id).toBe(d.cost);
      for (let i = 1; i < 3; i++) {
        expect(d.levels[i].damage, `${d.id} L${i + 1} damage`).toBeGreaterThan(d.levels[i - 1].damage);
        expect(d.levels[i].range, `${d.id} L${i + 1} range`).toBeGreaterThanOrEqual(d.levels[i - 1].range);
        expect(d.levels[i].fireRate, `${d.id} L${i + 1} rate`).toBeGreaterThanOrEqual(d.levels[i - 1].fireRate);
        expect(d.levels[i].cost, `${d.id} L${i + 1} cost`).toBeGreaterThan(0);
        expect(d.levels[i].note.length, d.id).toBeGreaterThan(4);
      }
    }
  });

  it('always includes the default targeting mode in the offered modes', () => {
    for (const d of all) expect(d.targetModes, d.id).toContain(d.defaultTargeting);
  });

  it('describes every unit for the armory', () => {
    for (const d of all) {
      expect(d.strengths.length, d.id).toBeGreaterThan(0);
      expect(d.weaknesses.length, d.id).toBeGreaterThan(0);
      expect(d.description.length, d.id).toBeGreaterThan(20);
      expect(d.flavor.length, d.id).toBeGreaterThan(5);
      expect(d.footprint, d.id).toBeGreaterThan(0);
      expect(d.cost, d.id).toBeGreaterThan(0);
      expect(d.unlockCost, d.id).toBeGreaterThanOrEqual(0);
    }
  });

  it('gives every attack pattern the fields it depends on', () => {
    for (const d of all) {
      for (const level of d.levels) {
        const a = level.attack;
        if (a.pattern === 'radial') expect(a.spikes, d.id).toBeGreaterThan(2);
        if (a.pattern === 'cone') expect(a.coneAngle, d.id).toBeGreaterThan(0);
        if (a.pattern === 'chain') expect(a.chainJumps, d.id).toBeGreaterThan(0);
        if (a.pattern === 'lob') expect(a.splashRadius, d.id).toBeGreaterThan(0);
        if (a.pattern === 'projectile' || a.pattern === 'lob' || a.pattern === 'radial') {
          expect(a.projectileSpeed, d.id).toBeGreaterThan(0);
        }
        if (a.minRange !== undefined) expect(a.minRange, d.id).toBeLessThan(level.range);
      }
    }
  });

  it('prices exactly the starting kit at zero', () => {
    const free = [...DEFENDERS, ...TURRETS].filter((d) => d.unlockCost === 0).map((d) => d.id).sort();
    const kit = [...STARTING_UNLOCKS.defenders, ...STARTING_UNLOCKS.turrets].sort();
    expect(free).toEqual(kit);
  });

  it('keeps the Ranger the cheapest thing on the roster', () => {
    const ranger = DEFENDERS.find((d) => d.id === 'ranger')!;
    for (const d of all) expect(d.cost, d.id).toBeGreaterThanOrEqual(ranger.cost);
  });

  it('never lets one unit dominate on damage per supply at level one', () => {
    // Single-target DPS per Supply, for the units that are actually
    // single-target damage dealers. Support units are priced for their aura,
    // not their sidearm, so they are excluded. A runaway here means an
    // obviously dominant pick.
    const singleTarget = all.filter(
      (d) => ['projectile', 'hitscan'].includes(d.levels[0].attack.pattern) && !d.levels[0].attack.buff,
    );
    const efficiency = singleTarget.map((d) => (d.levels[0].damage * d.levels[0].fireRate) / d.cost);
    const best = Math.max(...efficiency);
    const worst = Math.min(...efficiency);
    expect(best / worst).toBeLessThan(3);
  });
});

describe('heroes', () => {
  it('has at least three, one of them free', () => {
    expect(HEROES.length).toBeGreaterThanOrEqual(3);
    expect(HEROES.filter((h) => h.unlockCost === 0)).toHaveLength(1);
  });

  it('gives every hero a usable ability', () => {
    for (const h of HEROES) {
      expect(h.ability.cooldownMs, h.id).toBeGreaterThan(1000);
      expect(h.ability.description.length, h.id).toBeGreaterThan(20);
      expect(h.repositionCooldownMs, h.id).toBeGreaterThan(0);
      expect(h.deployCost, h.id).toBeGreaterThan(0);
      if (h.ability.kind === 'targeted') expect(h.ability.radius, h.id).toBeGreaterThan(0);
    }
  });

  it('makes heroes stronger than an ordinary defender', () => {
    const bestDefenderDps = Math.max(
      ...DEFENDERS.map((d) => d.levels[0].damage * d.levels[0].fireRate),
    );
    for (const h of HEROES) {
      expect(h.damage * h.fireRate, h.id).toBeGreaterThan(bestDefenderDps);
    }
  });

  it('includes a tank operator with a splash primary and a secondary gun', () => {
    const tank = HEROES.find((h) => h.art.weapon === 'tank');
    expect(tank).toBeDefined();
    expect(tank!.attack.splashRadius).toBeGreaterThan(0);
    expect(tank!.secondary).toBeDefined();
  });
});

describe('fixtures', () => {
  it('describes every fixture and gives it an effect', () => {
    for (const f of FIXTURES) {
      expect(f.cost, f.id).toBeGreaterThan(0);
      expect(f.radius, f.id).toBeGreaterThan(0);
      expect(f.strengths.length, f.id).toBeGreaterThan(0);
      expect(f.weaknesses.length, f.id).toBeGreaterThan(0);
      const hasEffect = Boolean(f.dps || f.slow || f.buff || f.supplyPerTick || f.integrity);
      expect(hasEffect, f.id).toBe(true);
    }
  });

  it('makes every crowd-control fixture wear out or expire', () => {
    for (const f of FIXTURES) {
      if (f.kind !== 'barricade' && f.kind !== 'decoy') continue;
      expect(f.integrity > 0 || f.durationMs > 0, f.id).toBe(true);
    }
  });
});

describe('maps', () => {
  it('ships four maps with distinct ids and rising difficulty', () => {
    expect(MAPS).toHaveLength(4);
    expect(new Set(MAPS.map((m) => m.id)).size).toBe(4);
    for (let i = 1; i < MAPS.length; i++) {
      expect(MAPS[i].difficulty).toBeGreaterThanOrEqual(MAPS[i - 1].difficulty);
      expect(MAPS[i].starsRequired).toBeGreaterThanOrEqual(MAPS[i - 1].starsRequired);
      expect(MAPS[i].unlockCost).toBeGreaterThan(MAPS[i - 1].unlockCost);
    }
    expect(MAPS[0].unlockCost).toBe(0);
    expect(MAPS[0].starsRequired).toBe(0);
  });

  it('keeps every star gate reachable from the maps before it', () => {
    let availableStars = 0;
    for (const map of MAPS) {
      expect(map.starsRequired, map.id).toBeLessThanOrEqual(availableStars);
      availableStars += 3;
    }
  });

  for (const map of MAPS) {
    describe(map.name, () => {
      it('routes every spawn point to a real path that starts there', () => {
        expect(map.spawns.length).toBeGreaterThan(0);
        for (const spawn of map.spawns) {
          const path = map.paths.find((p) => p.id === spawn.pathId);
          expect(path, `${map.id}/${spawn.id}`).toBeDefined();
          const start = path!.waypoints[0];
          expect(Math.hypot(start.x - spawn.x, start.y - spawn.y)).toBeLessThan(2);
        }
      });

      it('ends every route at the objective', () => {
        for (const path of map.paths) {
          expect(path.waypoints.length).toBeGreaterThan(2);
          const end = path.waypoints.at(-1)!;
          const d = Math.hypot(end.x - map.objective.x, end.y - map.objective.y);
          expect(d, `${map.id}/${path.id}`).toBeLessThan(map.objective.radius + 60);
        }
      });

      it('keeps the objective inside the playfield', () => {
        expect(map.objective.x).toBeGreaterThan(0);
        expect(map.objective.x).toBeLessThan(map.width);
        expect(map.objective.y).toBeGreaterThan(0);
        expect(map.objective.y).toBeLessThan(map.height);
        expect(map.objective.hp).toBeGreaterThan(0);
      });

      it('numbers waves 1..n with a boss finale', () => {
        expect(map.waves.length).toBeGreaterThanOrEqual(12);
        map.waves.forEach((w, i) => {
          expect(w.index, `${map.id} wave ${i}`).toBe(i + 1);
          expect(waveEnemyCount(w), `${map.id} wave ${i}`).toBeGreaterThan(0);
          expect(w.reward).toBeGreaterThan(0);
          for (const group of w.groups) {
            expect(SPECIES[group.species], `${map.id}/${group.species}`).toBeDefined();
            expect(TIERS[group.tier], `${map.id}/${group.tier}`).toBeDefined();
            expect(group.count).toBeGreaterThan(0);
            if (group.spawnId) {
              expect(map.spawns.some((s) => s.id === group.spawnId), `${map.id}/${group.spawnId}`).toBe(true);
            }
          }
        });
        expect(map.waves.at(-1)!.boss).toBe(true);
      });

      it('escalates: the final wave is far tougher than the first', () => {
        const totalHp = (w: (typeof map.waves)[number]) =>
          w.groups.reduce((sum, grp) => sum + grp.count * scaledHp(SPECIES[grp.species], TIERS[grp.tier]), 0);
        expect(totalHp(map.waves.at(-1)!)).toBeGreaterThan(totalHp(map.waves[0]) * 10);
      });

      it('grows wave rewards over the course of the level', () => {
        expect(map.waves.at(-1)!.reward).toBeGreaterThan(map.waves[0].reward);
      });

      it('advertises the species it actually fields', () => {
        const actual = new Set(map.waves.flatMap((w) => w.groups.map((grp) => grp.species)));
        for (const s of map.expectedSpecies) expect(actual.has(s), `${map.id}/${s}`).toBe(true);
      });

      it('has room to build: open ground beside every route', () => {
        const geometry = new MapGeometry(map);
        let buildable = 0;
        for (let x = 40; x < map.width - 40; x += 24) {
          for (let y = 40; y < map.height - 40; y += 24) {
            if (geometry.isOnPath(x, y, 24)) continue;
            if (geometry.isInWater(x, y, 20) || geometry.isInLava(x, y, 20) || geometry.isSolid(x, y, 20)) continue;
            buildable++;
          }
        }
        expect(buildable, map.id).toBeGreaterThan(200);
      });

      it('gives a starting budget worth at least three Rangers', () => {
        const ranger = DEFENDERS.find((d) => d.id === 'ranger')!;
        expect(map.startingSupply / ranger.cost, map.id).toBeGreaterThanOrEqual(3);
      });

      it('has enough decoration to feel like a place', () => {
        expect(map.decor.length, map.id).toBeGreaterThan(15);
        expect(map.features.length, map.id).toBeGreaterThan(1);
      });
    });
  }

  it('gives the wetlands a water route and water regions', () => {
    const wetlands = MAPS_BY_ID.deltaWetlands;
    expect(wetlands.paths.some((p) => p.aquatic)).toBe(true);
    expect(wetlands.terrain.some((t) => t.kind === 'water')).toBe(true);
  });

  it('gives the caldera lava and no water', () => {
    const caldera = MAPS_BY_ID.calderaStation;
    expect(caldera.terrain.some((t) => t.kind === 'lava')).toBe(true);
    expect(caldera.terrain.some((t) => t.kind === 'water')).toBe(false);
  });

  it('gives the canyon sight-blocking terrain', () => {
    const canyon = MAPS_BY_ID.fossilCanyon;
    expect(canyon.terrain.filter((t) => t.blocksSight).length).toBeGreaterThan(3);
  });
});

describe('challenges', () => {
  it('points at real maps and pays a bounty', () => {
    for (const c of CHALLENGES) {
      expect(MAPS_BY_ID[c.mapId], c.id).toBeDefined();
      expect(c.amberReward, c.id).toBeGreaterThan(0);
      expect(c.rules.length, c.id).toBeGreaterThan(0);
      expect(c.description.length, c.id).toBeGreaterThan(20);
    }
  });

  it('only restricts to defenders that exist', () => {
    for (const c of CHALLENGES) {
      for (const id of c.modifiers.allowedDefenderIds ?? []) {
        expect(findDefender(id) ?? findFixture(id), `${c.id}/${id}`).toBeDefined();
      }
    }
  });

  it('never gates a challenge behind more stars than its map can be reached with', () => {
    for (const c of CHALLENGES) {
      const map = MAPS_BY_ID[c.mapId];
      expect(c.starsRequired, c.id).toBeGreaterThanOrEqual(map.starsRequired);
      expect(c.starsRequired, c.id).toBeLessThanOrEqual(MAPS.length * 3);
    }
  });
});

describe('starting inventory', () => {
  it('only references things that exist', () => {
    for (const id of STARTING_UNLOCKS.defenders) expect(findDefender(id), id).toBeDefined();
    for (const id of STARTING_UNLOCKS.turrets) expect(findDefender(id), id).toBeDefined();
    for (const id of STARTING_UNLOCKS.fixtures) expect(findFixture(id), id).toBeDefined();
    for (const id of STARTING_UNLOCKS.heroes) expect(findHero(id), id).toBeDefined();
    for (const id of STARTING_UNLOCKS.maps) expect(MAPS_BY_ID[id], id).toBeDefined();
  });

  it('is free', () => {
    for (const id of [...STARTING_UNLOCKS.defenders, ...STARTING_UNLOCKS.turrets]) {
      expect(findDefender(id)!.unlockCost, id).toBe(0);
    }
    for (const id of STARTING_UNLOCKS.heroes) expect(findHero(id)!.unlockCost, id).toBe(0);
    for (const id of STARTING_UNLOCKS.maps) expect(MAPS_BY_ID[id].unlockCost, id).toBe(0);
  });
});
