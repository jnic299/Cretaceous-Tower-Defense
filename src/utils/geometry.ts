import type { Polygon, Rect, Vec2 } from '../game/types';

export const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export function distance(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(bx - ax, by - ay);
}

export function distanceSq(ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  return dx * dx + dy * dy;
}

/** Even-odd ray cast. Correct for convex and concave polygons alike. */
export function pointInPolygon(px: number, py: number, poly: Polygon): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x;
    const yi = poly[i].y;
    const xj = poly[j].x;
    const yj = poly[j].y;
    const intersects = yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi || 1e-9) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

/** Shortest distance from a point to a line segment. */
export function distanceToSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - ax, py - ay);
  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = clamp(t, 0, 1);
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Shortest distance from a point to an open polyline. */
export function distanceToPolyline(px: number, py: number, points: Vec2[]): number {
  let best = Infinity;
  for (let i = 0; i < points.length - 1; i++) {
    const d = distanceToSegment(px, py, points[i].x, points[i].y, points[i + 1].x, points[i + 1].y);
    if (d < best) best = d;
  }
  return best;
}

/** Shortest distance from a point to a polygon's outline (ignores interior). */
export function distanceToPolygonEdge(px: number, py: number, poly: Polygon): number {
  let best = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const d = distanceToSegment(px, py, poly[j].x, poly[j].y, poly[i].x, poly[i].y);
    if (d < best) best = d;
  }
  return best;
}

/** Distance from a point to a polygon; zero when the point is inside. */
export function distanceToPolygon(px: number, py: number, poly: Polygon): number {
  if (pointInPolygon(px, py, poly)) return 0;
  return distanceToPolygonEdge(px, py, poly);
}

/** True if a disc of `radius` at (px, py) touches the polygon at all. */
export function circleTouchesPolygon(px: number, py: number, radius: number, poly: Polygon): boolean {
  return distanceToPolygon(px, py, poly) <= radius;
}

function orientation(ax: number, ay: number, bx: number, by: number, cx: number, cy: number): number {
  const v = (by - ay) * (cx - bx) - (bx - ax) * (cy - by);
  if (Math.abs(v) < 1e-9) return 0;
  return v > 0 ? 1 : 2;
}

function onSegment(ax: number, ay: number, bx: number, by: number, cx: number, cy: number): boolean {
  return (
    bx <= Math.max(ax, cx) + 1e-9 &&
    bx >= Math.min(ax, cx) - 1e-9 &&
    by <= Math.max(ay, cy) + 1e-9 &&
    by >= Math.min(ay, cy) - 1e-9
  );
}

/** Standard orientation-based segment intersection, collinear cases included. */
export function segmentsIntersect(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
  dx: number,
  dy: number,
): boolean {
  const o1 = orientation(ax, ay, bx, by, cx, cy);
  const o2 = orientation(ax, ay, bx, by, dx, dy);
  const o3 = orientation(cx, cy, dx, dy, ax, ay);
  const o4 = orientation(cx, cy, dx, dy, bx, by);

  if (o1 !== o2 && o3 !== o4) return true;
  if (o1 === 0 && onSegment(ax, ay, cx, cy, bx, by)) return true;
  if (o2 === 0 && onSegment(ax, ay, dx, dy, bx, by)) return true;
  if (o3 === 0 && onSegment(cx, cy, ax, ay, dx, dy)) return true;
  if (o4 === 0 && onSegment(cx, cy, bx, by, dx, dy)) return true;
  return false;
}

export function polygonBounds(poly: Polygon): Rect {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of poly) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

/** Cheap reject before running per-edge intersection tests. */
export function segmentMissesBounds(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  bounds: Rect,
): boolean {
  if (Math.max(ax, bx) < bounds.x) return true;
  if (Math.min(ax, bx) > bounds.x + bounds.w) return true;
  if (Math.max(ay, by) < bounds.y) return true;
  if (Math.min(ay, by) > bounds.y + bounds.h) return true;
  return false;
}

/** True when the segment crosses an edge of the polygon or lies inside it. */
export function segmentIntersectsPolygon(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  poly: Polygon,
): boolean {
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    if (segmentsIntersect(ax, ay, bx, by, poly[j].x, poly[j].y, poly[i].x, poly[i].y)) return true;
  }
  return pointInPolygon(ax, ay, poly);
}

export function polygonCentroid(poly: Polygon): Vec2 {
  let area = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const cross = poly[j].x * poly[i].y - poly[i].x * poly[j].y;
    area += cross;
    cx += (poly[j].x + poly[i].x) * cross;
    cy += (poly[j].y + poly[i].y) * cross;
  }
  area *= 0.5;
  if (Math.abs(area) < 1e-9) {
    const sum = poly.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
    return { x: sum.x / poly.length, y: sum.y / poly.length };
  }
  return { x: cx / (6 * area), y: cy / (6 * area) };
}

/** Shortest signed angular difference, in radians. */
export function angleDelta(from: number, to: number): number {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}
