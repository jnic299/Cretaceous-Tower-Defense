import { describe, expect, it } from 'vitest';
import { MapGeometry, smoothPath } from '../src/game/systems/MapGeometry';
import { FOSSIL_CANYON, RESEARCH_OUTPOST } from '../src/game/data/maps';
import { polygonCentroid } from '../src/utils/geometry';

const canyon = new MapGeometry(FOSSIL_CANYON);
const outpost = new MapGeometry(RESEARCH_OUTPOST);

describe('line of sight', () => {
  it('has sight-blocking geometry on the canyon map', () => {
    expect(canyon.sightBlockers.length).toBeGreaterThan(0);
  });

  it('blocks a shot straight through the central mesa', () => {
    const mesa = FOSSIL_CANYON.terrain[0];
    const c = polygonCentroid(mesa.polygon);
    // Upper corridor to lower corridor, straight through the rock.
    expect(canyon.hasLineOfSight(c.x, 130, c.x, 610)).toBe(false);
  });

  it('allows a clear shot along an open corridor', () => {
    expect(canyon.hasLineOfSight(300, 120, 800, 150)).toBe(true);
  });

  it('blocks a shot when only one endpoint is behind cover', () => {
    const mesa = FOSSIL_CANYON.terrain[0];
    const c = polygonCentroid(mesa.polygon);
    expect(canyon.hasLineOfSight(c.x, c.y, c.x, 40)).toBe(false);
  });

  it('leaves the starter map free of firing obstructions', () => {
    expect(outpost.sightBlockers.length).toBe(0);
    expect(outpost.hasLineOfSight(100, 100, 1100, 600)).toBe(true);
  });
});

describe('map geometry', () => {
  it('resamples authored waypoints into a dense smooth polyline', () => {
    const pts = smoothPath(RESEARCH_OUTPOST.paths[0].waypoints);
    expect(pts.length).toBeGreaterThan(RESEARCH_OUTPOST.paths[0].waypoints.length * 5);
    // Every step is short, so movement never snaps around a corner.
    for (let i = 1; i < pts.length; i++) {
      expect(Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y)).toBeLessThan(20);
    }
  });

  it('samples a route from start to finish', () => {
    const path = outpost.paths[0];
    const start = outpost.sample(path, 0);
    const end = outpost.sample(path, path.length);
    expect(start.x).toBeCloseTo(RESEARCH_OUTPOST.paths[0].waypoints[0].x, 0);
    const last = RESEARCH_OUTPOST.paths[0].waypoints.at(-1)!;
    expect(Math.hypot(end.x - last.x, end.y - last.y)).toBeLessThan(4);
  });

  it('clamps samples outside the route length', () => {
    const path = outpost.paths[0];
    const before = outpost.sample(path, -500);
    const after = outpost.sample(path, path.length + 500);
    expect(Number.isFinite(before.x)).toBe(true);
    expect(Number.isFinite(after.angle)).toBe(true);
  });

  it('resolves a spawn point to its route', () => {
    expect(outpost.pathForSpawn('north').id).toBe('main');
    // An unknown spawn falls back to the first route rather than throwing.
    expect(outpost.pathForSpawn('nope').id).toBe('main');
    expect(outpost.pathForSpawn(undefined).id).toBe('main');
  });

  it('reports the distance to the nearest route', () => {
    const wp = RESEARCH_OUTPOST.paths[0].waypoints[2];
    expect(outpost.distanceToNearestPath(wp.x, wp.y)).toBeLessThan(6);
    expect(outpost.distanceToNearestPath(1250, 700)).toBeGreaterThan(100);
  });
});
