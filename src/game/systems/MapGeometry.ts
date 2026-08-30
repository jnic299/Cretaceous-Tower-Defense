import type { MapDef, PathDef, Polygon, Rect, TerrainRegion, Vec2 } from '../types';
import {
  distanceToPolygon,
  distanceToSegment,
  pointInPolygon,
  polygonBounds,
  segmentMissesBounds,
  segmentsIntersect,
} from '../../utils/geometry';

/** A polygon with its bounding box cached for fast rejection. */
interface Region {
  polygon: Polygon;
  bounds: Rect;
  blocksSight: boolean;
  height: number;
}

/** A path resampled into a dense polyline with cumulative arc lengths. */
export interface PathRuntime {
  id: string;
  def: PathDef;
  points: Vec2[];
  /** cumulative[i] is the arc length from the start up to points[i]. */
  cumulative: number[];
  length: number;
  aquatic: boolean;
  bounds: Rect;
}

export interface PathSample {
  x: number;
  y: number;
  angle: number;
}

/**
 * Centripetal Catmull-Rom through the authored waypoints, resampled at a
 * fixed step. Authoring stays coarse; dinosaurs walk a smooth curve rather
 * than snapping around corners.
 */
export function smoothPath(waypoints: Vec2[], step = 7): Vec2[] {
  if (waypoints.length < 2) return [...waypoints];

  const pts = [waypoints[0], ...waypoints, waypoints[waypoints.length - 1]];
  const out: Vec2[] = [];

  for (let i = 1; i < pts.length - 2; i++) {
    const p0 = pts[i - 1];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2];
    const segLen = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    const steps = Math.max(2, Math.ceil(segLen / step));

    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      const t2 = t * t;
      const t3 = t2 * t;
      out.push({
        x:
          0.5 *
          (2 * p1.x +
            (-p0.x + p2.x) * t +
            (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
            (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        y:
          0.5 *
          (2 * p1.y +
            (-p0.y + p2.y) * t +
            (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
            (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
      });
    }
  }
  out.push(waypoints[waypoints.length - 1]);
  return out;
}

function buildPathRuntime(def: PathDef): PathRuntime {
  const points = smoothPath(def.waypoints);
  const cumulative: number[] = new Array(points.length);
  cumulative[0] = 0;
  for (let i = 1; i < points.length; i++) {
    cumulative[i] = cumulative[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  return {
    id: def.id,
    def,
    points,
    cumulative,
    length: cumulative[cumulative.length - 1],
    aquatic: def.aquatic === true,
    bounds: polygonBounds(points),
  };
}

function toRegion(t: TerrainRegion): Region {
  return {
    polygon: t.polygon,
    bounds: polygonBounds(t.polygon),
    blocksSight: t.blocksSight === true,
    height: t.height ?? 0,
  };
}

/**
 * Everything the simulation needs to know about a map's shape, precomputed
 * once at match start. No Phaser dependency — this is plain geometry, which
 * keeps placement and line-of-sight unit-testable.
 */
export class MapGeometry {
  readonly def: MapDef;
  readonly paths: PathRuntime[];
  readonly pathsById: Map<string, PathRuntime>;
  readonly water: Region[];
  readonly lava: Region[];
  /** Rock and structures: impassable for placement. */
  readonly solid: Region[];
  /** The subset of solids that also stop bullets. */
  readonly sightBlockers: Region[];

  constructor(def: MapDef) {
    this.def = def;
    this.paths = def.paths.map(buildPathRuntime);
    this.pathsById = new Map(this.paths.map((p) => [p.id, p]));

    const regions = def.terrain.map(toRegion);
    this.water = def.terrain.filter((t) => t.kind === 'water').map(toRegion);
    this.lava = def.terrain.filter((t) => t.kind === 'lava').map(toRegion);
    this.solid = def.terrain.filter((t) => t.kind === 'rock' || t.kind === 'structure').map(toRegion);
    this.sightBlockers = regions.filter((r) => r.blocksSight);
  }

  get width(): number {
    return this.def.width;
  }

  get height(): number {
    return this.def.height;
  }

  inBounds(x: number, y: number, margin = 0): boolean {
    return x >= margin && y >= margin && x <= this.def.width - margin && y <= this.def.height - margin;
  }

  private touches(regions: Region[], x: number, y: number, radius: number): boolean {
    for (const r of regions) {
      if (
        x + radius < r.bounds.x ||
        x - radius > r.bounds.x + r.bounds.w ||
        y + radius < r.bounds.y ||
        y - radius > r.bounds.y + r.bounds.h
      ) {
        continue;
      }
      if (distanceToPolygon(x, y, r.polygon) <= radius) return true;
    }
    return false;
  }

  isInWater(x: number, y: number, radius = 0): boolean {
    return this.touches(this.water, x, y, radius);
  }

  isInLava(x: number, y: number, radius = 0): boolean {
    return this.touches(this.lava, x, y, radius);
  }

  isSolid(x: number, y: number, radius = 0): boolean {
    return this.touches(this.solid, x, y, radius);
  }

  /** True when the point is fully inside a water body (used for boats). */
  isDeepWater(x: number, y: number, radius: number): boolean {
    for (const r of this.water) {
      if (!pointInPolygon(x, y, r.polygon)) continue;
      // Require clearance from the shoreline so the hull is not beached.
      if (distanceToPolygon(x, y, r.polygon) === 0) {
        let clearance = Infinity;
        for (let i = 0, j = r.polygon.length - 1; i < r.polygon.length; j = i++) {
          const d = distanceToSegment(
            x,
            y,
            r.polygon[j].x,
            r.polygon[j].y,
            r.polygon[i].x,
            r.polygon[i].y,
          );
          if (d < clearance) clearance = d;
        }
        if (clearance >= radius) return true;
      }
    }
    return false;
  }

  /** Distance to the nearest travelled corridor across every route. */
  distanceToNearestPath(x: number, y: number): number {
    let best = Infinity;
    for (const path of this.paths) {
      const d = this.distanceToPath(x, y, path);
      if (d < best) best = d;
    }
    return best;
  }

  distanceToPath(x: number, y: number, path: PathRuntime): number {
    // Bounding-box reject first; corridors are long and thin.
    const pad = path.def.width + 64;
    if (
      x + pad < path.bounds.x ||
      x - pad > path.bounds.x + path.bounds.w ||
      y + pad < path.bounds.y ||
      y - pad > path.bounds.y + path.bounds.h
    ) {
      return Infinity;
    }
    let best = Infinity;
    const pts = path.points;
    for (let i = 0; i < pts.length - 1; i++) {
      const d = distanceToSegment(x, y, pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y);
      if (d < best) best = d;
      if (best < 1) break;
    }
    return best;
  }

  /**
   * True when the point sits inside a travelled corridor.
   *
   * `only` narrows the check to land or water routes. A patrol boat is
   * *supposed* to sit in the swimming lane — that is the whole point of a
   * water placement — so water units only ever test against land routes.
   */
  isOnPath(x: number, y: number, extra = 0, only: 'all' | 'land' | 'aquatic' = 'all'): boolean {
    for (const path of this.paths) {
      if (only === 'land' && path.aquatic) continue;
      if (only === 'aquatic' && !path.aquatic) continue;
      if (this.distanceToPath(x, y, path) <= path.def.width + extra) return true;
    }
    return false;
  }

  /**
   * Firing-line test. Rejects the shot when any sight-blocking region sits
   * between shooter and target. Bounds rejection first keeps this cheap
   * enough to run for every acquisition.
   */
  hasLineOfSight(ax: number, ay: number, bx: number, by: number): boolean {
    for (const r of this.sightBlockers) {
      if (segmentMissesBounds(ax, ay, bx, by, r.bounds)) continue;
      const poly = r.polygon;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        if (segmentsIntersect(ax, ay, bx, by, poly[j].x, poly[j].y, poly[i].x, poly[i].y)) return false;
      }
      // Both endpoints buried inside the same rock (rare, but be correct).
      if (pointInPolygon(ax, ay, poly) && pointInPolygon(bx, by, poly)) return false;
    }
    return true;
  }

  /** Position and heading at an arc-length along a route. */
  sample(path: PathRuntime, distance: number): PathSample {
    const pts = path.points;
    const cum = path.cumulative;
    if (distance <= 0) {
      const a = Math.atan2(pts[1].y - pts[0].y, pts[1].x - pts[0].x);
      return { x: pts[0].x, y: pts[0].y, angle: a };
    }
    if (distance >= path.length) {
      const n = pts.length - 1;
      const a = Math.atan2(pts[n].y - pts[n - 1].y, pts[n].x - pts[n - 1].x);
      return { x: pts[n].x, y: pts[n].y, angle: a };
    }

    let lo = 0;
    let hi = cum.length - 1;
    while (lo < hi - 1) {
      const mid = (lo + hi) >> 1;
      if (cum[mid] <= distance) lo = mid;
      else hi = mid;
    }
    const segLen = cum[hi] - cum[lo] || 1;
    const t = (distance - cum[lo]) / segLen;
    const p0 = pts[lo];
    const p1 = pts[hi];
    return {
      x: p0.x + (p1.x - p0.x) * t,
      y: p0.y + (p1.y - p0.y) * t,
      angle: Math.atan2(p1.y - p0.y, p1.x - p0.x),
    };
  }

  getPath(id: string): PathRuntime {
    const p = this.pathsById.get(id);
    if (!p) throw new Error(`Unknown path ${id} on map ${this.def.id}`);
    return p;
  }

  /** Where a spawn point feeds into the network. */
  pathForSpawn(spawnId: string | undefined): PathRuntime {
    if (spawnId) {
      const spawn = this.def.spawns.find((s) => s.id === spawnId);
      if (spawn) return this.getPath(spawn.pathId);
    }
    return this.paths[0];
  }
}
