import { describe, expect, it } from 'vitest';
import { MapGeometry } from '../src/game/systems/MapGeometry';
import { evaluatePlacement, snapToGrid } from '../src/game/systems/placementRules';
import { RESEARCH_OUTPOST, DELTA_WETLANDS, CALDERA_STATION, FOSSIL_CANYON } from '../src/game/data/maps';
import { DEFENDERS } from '../src/game/data/defenders';

const outpost = new MapGeometry(RESEARCH_OUTPOST);
const wetlands = new MapGeometry(DELTA_WETLANDS);
const caldera = new MapGeometry(CALDERA_STATION);

const base = {
  footprint: 20,
  terrain: 'land' as const,
  allowOnPath: false,
  cost: 45,
  supply: 500,
};

describe('placement rules — Research Outpost', () => {
  it('accepts open ground beside the route', () => {
    const v = evaluatePlacement(outpost, { ...base, x: 160, y: 260 }, []);
    expect(v.ok).toBe(true);
    expect(v.reason).toBe('ok');
  });

  it('rejects the travelled route itself', () => {
    const waypoint = RESEARCH_OUTPOST.paths[0].waypoints[1];
    const v = evaluatePlacement(outpost, { ...base, x: waypoint.x, y: waypoint.y }, []);
    expect(v.ok).toBe(false);
    expect(v.reason).toBe('onPath');
  });

  it('rejects positions outside the operating area', () => {
    expect(evaluatePlacement(outpost, { ...base, x: -20, y: 300 }, []).reason).toBe('outOfBounds');
    expect(evaluatePlacement(outpost, { ...base, x: 640, y: 900 }, []).reason).toBe('outOfBounds');
  });

  it('rejects solid rock', () => {
    const v = evaluatePlacement(outpost, { ...base, x: 512, y: 300 }, []);
    expect(v.reason).toBe('blocked');
  });

  it('rejects the objective footprint', () => {
    const o = RESEARCH_OUTPOST.objective;
    const v = evaluatePlacement(outpost, { ...base, x: o.x, y: o.y }, []);
    expect(v.ok).toBe(false);
  });

  it('rejects overlapping another placement', () => {
    const spot = { x: 160, y: 260 };
    const v = evaluatePlacement(outpost, { ...base, ...spot }, [{ ...spot, radius: 20 }]);
    expect(v.reason).toBe('occupied');
  });

  it('allows a placement just outside another unit’s footprint', () => {
    const v = evaluatePlacement(
      outpost,
      { ...base, x: 160, y: 260 },
      [{ x: 160, y: 215, radius: 20 }],
    );
    expect(v.ok).toBe(true);
  });

  it('reports insufficient supply only once the position is otherwise legal', () => {
    const v = evaluatePlacement(outpost, { ...base, x: 160, y: 260, supply: 10 }, []);
    expect(v.reason).toBe('supply');
    // A bad position still reports the position problem, not the money.
    const onPath = RESEARCH_OUTPOST.paths[0].waypoints[1];
    expect(
      evaluatePlacement(outpost, { ...base, x: onPath.x, y: onPath.y, supply: 10 }, []).reason,
    ).toBe('onPath');
  });

  it('honours a challenge restriction', () => {
    const v = evaluatePlacement(outpost, { ...base, x: 160, y: 260, permitted: false }, []);
    expect(v.reason).toBe('restricted');
  });

  it('lets fixtures sit on the route', () => {
    const waypoint = RESEARCH_OUTPOST.paths[0].waypoints[1];
    const v = evaluatePlacement(
      outpost,
      { ...base, x: waypoint.x, y: waypoint.y, allowOnPath: true },
      [],
    );
    expect(v.ok).toBe(true);
  });
});

describe('placement rules — water', () => {
  const river = DELTA_WETLANDS.paths[1].waypoints[3];

  it('keeps land units out of the water', () => {
    const v = evaluatePlacement(wetlands, { ...base, x: river.x, y: river.y }, []);
    expect(v.ok).toBe(false);
    expect(['inWater', 'onPath']).toContain(v.reason);
  });

  it('lets a water unit deploy into open water', () => {
    const v = evaluatePlacement(
      wetlands,
      { ...base, x: river.x, y: river.y, terrain: 'water', footprint: 20 },
      [],
    );
    expect(v.ok).toBe(true);
  });

  it('keeps a water unit off dry land', () => {
    const v = evaluatePlacement(wetlands, { ...base, x: 200, y: 120, terrain: 'water' }, []);
    expect(v.reason).toBe('needsWater');
  });

  it('will not beach a boat on the shoreline', () => {
    const poly = DELTA_WETLANDS.terrain.find((t) => t.kind === 'water')!.polygon;
    const edge = poly[0];
    const v = evaluatePlacement(
      wetlands,
      { ...base, x: edge.x, y: edge.y, terrain: 'water', footprint: 24 },
      [],
    );
    expect(v.ok).toBe(false);
  });
});

describe('placement rules — lava', () => {
  it('forbids lava for everything', () => {
    const lava = CALDERA_STATION.terrain.find((t) => t.kind === 'lava')!.polygon;
    const cx = lava.reduce((s, p) => s + p.x, 0) / lava.length;
    const cy = lava.reduce((s, p) => s + p.y, 0) / lava.length;
    for (const terrain of ['land', 'water', 'amphibious'] as const) {
      const v = evaluatePlacement(caldera, { ...base, x: cx, y: cy, terrain }, []);
      expect(v.ok).toBe(false);
    }
  });

  it('still allows the shelves beside the lava', () => {
    const v = evaluatePlacement(caldera, { ...base, x: 700, y: 120 }, []);
    expect(v.ok).toBe(true);
  });
});

describe('placement rules — Fossil Canyon', () => {
  const canyon = new MapGeometry(FOSSIL_CANYON);
  const verdictAt = (x: number, y: number) =>
    evaluatePlacement(canyon, { ...base, x, y }, []).reason;

  it('rejects the central mesa', () => {
    expect(verdictAt(580, 360)).toBe('blocked');
  });

  it('accepts the ground between the corridors', () => {
    expect(verdictAt(640, 520)).toBe('ok');
    expect(verdictAt(300, 60)).toBe('ok');
    expect(verdictAt(980, 380)).toBe('ok');
  });

  it('still refuses the corridors themselves', () => {
    expect(verdictAt(560, 545)).toBe('onPath');
  });
});

describe('per-match deployment caps', () => {
  it('refuses a unit whose cap is already spent, ahead of terrain checks', () => {
    // Spelled out before the position is even considered, so the player is
    // told why the card is dead rather than why the ground is wrong.
    const v = evaluatePlacement(outpost, { ...base, x: 160, y: 260, atLimit: true }, []);
    expect(v.ok).toBe(false);
    expect(v.reason).toBe('atLimit');
  });

  it('is unaffected when the cap is not spent', () => {
    expect(evaluatePlacement(outpost, { ...base, x: 160, y: 260, atLimit: false }, []).ok).toBe(true);
  });

  it('caps exactly the units that are meant to be unique', () => {
    // Fred because there is only one Fred, and Ted because a second airframe
    // would fly the same beat and stack into the first.
    const capped = DEFENDERS.filter((d) => d.maxPerMatch !== undefined).map((d) => d.id);
    expect(capped.sort()).toEqual(['fred', 'ted']);
    for (const id of capped) {
      expect(DEFENDERS.find((d) => d.id === id)!.maxPerMatch, id).toBe(1);
    }
  });
});

describe('placement rules — airborne', () => {
  const air = { ...base, footprint: 24, requiresPath: true, allowOnPath: true };

  it('refuses open ground, which is where every other defender belongs', () => {
    const v = evaluatePlacement(outpost, { ...air, x: 160, y: 260 }, []);
    expect(v.ok).toBe(false);
    expect(v.reason).toBe('needsPath');
  });

  it('accepts the route itself', () => {
    const waypoint = RESEARCH_OUTPOST.paths[0].waypoints[1];
    const v = evaluatePlacement(outpost, { ...air, x: waypoint.x, y: waypoint.y }, []);
    expect(v.ok).toBe(true);
  });

  it('flies over terrain that stops everything on the ground', () => {
    // Caldera's route crosses ground a land unit could never stand on, and an
    // aircraft skips the water, lava and rock tests entirely.
    const path = CALDERA_STATION.paths[0];
    const waypoint = path.waypoints[Math.floor(path.waypoints.length / 2)];
    const v = evaluatePlacement(caldera, { ...air, x: waypoint.x, y: waypoint.y }, []);
    expect(v.reason).toBe('ok');
  });

  it('still keeps its distance from the objective', () => {
    // The route runs right up to the objective, so its far end is inside the
    // exclusion ring even though it is a legal stretch of route.
    const points = outpost.paths[0].points;
    const end = points[points.length - 1];
    expect(evaluatePlacement(outpost, { ...air, x: end.x, y: end.y }, []).reason).toBe('objective');
  });

  it('collides with another aircraft but not with ground works', () => {
    const waypoint = RESEARCH_OUTPOST.paths[0].waypoints[1];
    const here = { ...air, x: waypoint.x, y: waypoint.y };
    // The caller passes only the slots of the layer being placed into, so a
    // second airframe over the same spot is refused...
    const taken = [{ x: waypoint.x, y: waypoint.y, radius: 24 }];
    expect(evaluatePlacement(outpost, here, taken).reason).toBe('occupied');
    // ...while an empty air layer leaves the route free regardless of what is
    // parked on the ground beside it.
    expect(evaluatePlacement(outpost, here, []).reason).toBe('ok');
  });
});

describe('grid snapping', () => {
  it('snaps to the placement grid', () => {
    expect(snapToGrid(11)).toBe(8);
    expect(snapToGrid(13)).toBe(16);
    expect(snapToGrid(100, 16)).toBe(96);
  });
});
