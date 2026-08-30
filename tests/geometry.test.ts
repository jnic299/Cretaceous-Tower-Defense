import { describe, expect, it } from 'vitest';
import {
  angleDelta,
  circleTouchesPolygon,
  distanceToPolygon,
  distanceToSegment,
  pointInPolygon,
  polygonBounds,
  polygonCentroid,
  segmentIntersectsPolygon,
  segmentMissesBounds,
  segmentsIntersect,
} from '../src/utils/geometry';

const SQUARE = [
  { x: 0, y: 0 },
  { x: 10, y: 0 },
  { x: 10, y: 10 },
  { x: 0, y: 10 },
];

// A C-shape, to make sure concave polygons are handled correctly.
const CONCAVE = [
  { x: 0, y: 0 },
  { x: 10, y: 0 },
  { x: 10, y: 3 },
  { x: 3, y: 3 },
  { x: 3, y: 7 },
  { x: 10, y: 7 },
  { x: 10, y: 10 },
  { x: 0, y: 10 },
];

describe('pointInPolygon', () => {
  it('detects inside and outside for a convex polygon', () => {
    expect(pointInPolygon(5, 5, SQUARE)).toBe(true);
    expect(pointInPolygon(-1, 5, SQUARE)).toBe(false);
    expect(pointInPolygon(11, 5, SQUARE)).toBe(false);
  });

  it('handles a concave polygon', () => {
    expect(pointInPolygon(1, 5, CONCAVE)).toBe(true);
    expect(pointInPolygon(6, 5, CONCAVE)).toBe(false);
  });
});

describe('distances', () => {
  it('measures distance to a segment, clamping to the ends', () => {
    expect(distanceToSegment(5, 5, 0, 0, 10, 0)).toBe(5);
    expect(distanceToSegment(-5, 0, 0, 0, 10, 0)).toBe(5);
    expect(distanceToSegment(0, 0, 4, 4, 4, 4)).toBeCloseTo(Math.hypot(4, 4));
  });

  it('reports zero distance inside a polygon', () => {
    expect(distanceToPolygon(5, 5, SQUARE)).toBe(0);
    expect(distanceToPolygon(15, 5, SQUARE)).toBe(5);
  });

  it('detects a disc touching a polygon', () => {
    expect(circleTouchesPolygon(14, 5, 5, SQUARE)).toBe(true);
    expect(circleTouchesPolygon(20, 5, 5, SQUARE)).toBe(false);
  });
});

describe('segment intersection', () => {
  it('detects crossing segments', () => {
    expect(segmentsIntersect(0, 0, 10, 10, 0, 10, 10, 0)).toBe(true);
    expect(segmentsIntersect(0, 0, 4, 4, 6, 6, 10, 10)).toBe(false);
  });

  it('detects collinear overlap', () => {
    expect(segmentsIntersect(0, 0, 10, 0, 5, 0, 15, 0)).toBe(true);
  });

  it('detects a segment crossing a polygon', () => {
    expect(segmentIntersectsPolygon(-5, 5, 15, 5, SQUARE)).toBe(true);
    expect(segmentIntersectsPolygon(-5, 20, 15, 20, SQUARE)).toBe(false);
  });

  it('rejects by bounding box first', () => {
    const bounds = polygonBounds(SQUARE);
    expect(segmentMissesBounds(50, 50, 60, 60, bounds)).toBe(true);
    expect(segmentMissesBounds(-5, 5, 15, 5, bounds)).toBe(false);
  });
});

describe('helpers', () => {
  it('finds a polygon centroid', () => {
    const c = polygonCentroid(SQUARE);
    expect(c.x).toBeCloseTo(5);
    expect(c.y).toBeCloseTo(5);
  });

  it('computes the shortest angular difference', () => {
    expect(angleDelta(0, Math.PI / 2)).toBeCloseTo(Math.PI / 2);
    expect(angleDelta(0, -Math.PI / 2)).toBeCloseTo(-Math.PI / 2);
    // Wrapping the short way round rather than nearly all the way.
    expect(Math.abs(angleDelta(3, -3))).toBeLessThan(Math.PI / 2);
  });
});
