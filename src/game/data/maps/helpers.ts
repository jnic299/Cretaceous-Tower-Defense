import type { Polygon, Vec2 } from '../../types';

/**
 * Builds a closed band polygon around a centreline. Rivers and lava channels
 * are authored as a line plus a width, which is far easier to tune by hand
 * than two parallel outlines.
 */
export function bandPolygon(center: Vec2[], halfWidth: number): Polygon {
  const normals: Vec2[] = center.map((p, i) => {
    const prev = center[Math.max(0, i - 1)];
    const next = center[Math.min(center.length - 1, i + 1)];
    const dx = next.x - prev.x;
    const dy = next.y - prev.y;
    const len = Math.hypot(dx, dy) || 1;
    // Left-hand normal.
    void p;
    return { x: -dy / len, y: dx / len };
  });

  const left: Vec2[] = center.map((p, i) => ({
    x: p.x + normals[i].x * halfWidth,
    y: p.y + normals[i].y * halfWidth,
  }));
  const right: Vec2[] = center.map((p, i) => ({
    x: p.x - normals[i].x * halfWidth,
    y: p.y - normals[i].y * halfWidth,
  }));

  return [...left, ...right.reverse()];
}

/**
 * Organic closed blob for ponds, lava pools and rock outcrops. Deterministic
 * for a given seed so maps look identical on every load.
 */
export function blobPolygon(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  points = 10,
  seed = 1,
  jitter = 0.22,
): Polygon {
  let s = seed * 9301 + 49297;
  const rand = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  const out: Polygon = [];
  for (let i = 0; i < points; i++) {
    const a = (i / points) * Math.PI * 2;
    const wobble = 1 - jitter + rand() * jitter * 2;
    out.push({ x: cx + Math.cos(a) * rx * wobble, y: cy + Math.sin(a) * ry * wobble });
  }
  return out;
}

/** Axis-aligned rectangle as a polygon. */
export function rectPolygon(x: number, y: number, w: number, h: number): Polygon {
  return [
    { x, y },
    { x: x + w, y },
    { x: x + w, y: y + h },
    { x, y: y + h },
  ];
}
