import { describe, expect, it } from 'vitest';
import { MapGeometry } from '../src/game/systems/MapGeometry';
import { evaluatePlacement, snapToGrid } from '../src/game/systems/placementRules';
import { RESEARCH_OUTPOST, DELTA_WETLANDS, CALDERA_STATION } from '../src/game/data/maps';

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

describe('grid snapping', () => {
  it('snaps to the placement grid', () => {
    expect(snapToGrid(11)).toBe(8);
    expect(snapToGrid(13)).toBe(16);
    expect(snapToGrid(100, 16)).toBe(96);
  });
});
