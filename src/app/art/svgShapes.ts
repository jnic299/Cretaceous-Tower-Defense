import type { DinoBodySpec, Polygon, Vec2 } from '../../game/types';

/** Closed outline around a centreline with per-point widths. */
export function ribbonPath(spine: { x: number; y: number; w: number }[]): string {
  const left: Vec2[] = [];
  const right: Vec2[] = [];
  for (let i = 0; i < spine.length; i++) {
    const prev = spine[Math.max(0, i - 1)];
    const next = spine[Math.min(spine.length - 1, i + 1)];
    const dx = next.x - prev.x;
    const dy = next.y - prev.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    left.push({ x: spine[i].x + nx * spine[i].w, y: spine[i].y + ny * spine[i].w });
    right.push({ x: spine[i].x - nx * spine[i].w, y: spine[i].y - ny * spine[i].w });
  }
  const pts = [...left, ...right.reverse()];
  return `M ${pts.map((p) => `${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' L ')} Z`;
}

export function polygonPath(poly: Polygon, scale = 1, ox = 0, oy = 0): string {
  if (poly.length === 0) return '';
  return `M ${poly
    .map((p) => `${(p.x * scale + ox).toFixed(2)} ${(p.y * scale + oy).toFixed(2)}`)
    .join(' L ')} Z`;
}

export function polylinePath(points: Vec2[], scale = 1, ox = 0, oy = 0): string {
  if (points.length === 0) return '';
  return `M ${points
    .map((p) => `${(p.x * scale + ox).toFixed(2)} ${(p.y * scale + oy).toFixed(2)}`)
    .join(' L ')}`;
}

export interface DinoSilhouette {
  body: string;
  tail: string;
  neck: string;
  head: string;
  legs: string[];
  crown: string | null;
  spines: string | null;
  /** Bounding box for the viewBox. */
  view: { x: number; y: number; w: number; h: number };
}

/**
 * Builds SVG paths for a species from the same body spec the canvas art uses,
 * so the codex and armory read as the same creature as the battlefield.
 */
export function buildDinoSilhouette(b: DinoBodySpec): DinoSilhouette {
  const bodyX = 0;
  const bodyY = 0;

  const tailSpine: { x: number; y: number; w: number }[] = [];
  for (let i = 0; i <= 5; i++) {
    const t = i / 5;
    tailSpine.push({
      x: bodyX - b.bodyLength * 0.85 - t * b.tailLength,
      y: bodyY + Math.sin(t * 2.2) * b.tailWidth * 0.8 * t,
      w: b.tailWidth * (1 - t * 0.88) + 0.6,
    });
  }

  const torso = [
    { x: bodyX - b.bodyLength * 0.9, y: bodyY, w: b.bodyWidth * 0.55 },
    { x: bodyX - b.bodyLength * 0.45, y: bodyY, w: b.bodyWidth * 0.98 },
    { x: bodyX + b.bodyLength * 0.1, y: bodyY, w: b.bodyWidth },
    { x: bodyX + b.bodyLength * 0.62, y: bodyY, w: b.bodyWidth * 0.78 },
    { x: bodyX + b.bodyLength * 0.95, y: bodyY, w: b.bodyWidth * 0.46 },
  ];

  const neckBaseX = bodyX + b.bodyLength * 0.8;
  const headX = neckBaseX + b.neckLength + b.headLength * 0.45;
  const neck = [
    { x: neckBaseX - 2, y: bodyY, w: b.neckWidth * 1.15 },
    { x: neckBaseX + b.neckLength * 0.5, y: bodyY - b.neckWidth * 0.18, w: b.neckWidth },
    { x: neckBaseX + b.neckLength, y: bodyY, w: b.neckWidth * 0.92 },
  ];
  const head = [
    { x: headX - b.headLength * 0.55, y: bodyY, w: b.headWidth * 0.75 },
    { x: headX - b.headLength * 0.05, y: bodyY, w: b.headWidth * 0.92 },
    { x: headX + b.headLength * 0.42, y: bodyY, w: b.headWidth * 0.66 },
    { x: headX + b.headLength * 0.62, y: bodyY, w: b.headWidth * 0.3 },
  ];

  const legs: string[] = [];
  const hipX = bodyX - b.bodyLength * 0.42;
  const mkLeg = (ox: number, dir: number, swing: number, length: number, width: number) =>
    ribbonPath([
      { x: ox, y: bodyY + dir * b.bodyWidth * 0.4, w: width },
      { x: ox + swing * length * 0.5, y: bodyY + dir * (b.bodyWidth * 0.4 + length * 0.55), w: width * 0.78 },
      { x: ox + swing * length * 0.95, y: bodyY + dir * (b.bodyWidth * 0.4 + length * 1.05), w: width * 0.6 },
    ]);

  if (b.stance === 'biped') {
    legs.push(mkLeg(hipX, 1, 0.5, b.legLength, b.legWidth));
    legs.push(mkLeg(hipX, -1, -0.5, b.legLength, b.legWidth));
  } else {
    const shoulderX = bodyX + b.bodyLength * 0.45;
    legs.push(mkLeg(hipX, 1, 0.35, b.legLength, b.legWidth));
    legs.push(mkLeg(hipX, -1, -0.35, b.legLength, b.legWidth));
    legs.push(mkLeg(shoulderX, 1, -0.35, b.legLength * 0.92, b.legWidth * 0.92));
    legs.push(mkLeg(shoulderX, -1, 0.35, b.legLength * 0.92, b.legWidth * 0.92));
  }

  let crown: string | null = null;
  switch (b.crown) {
    case 'frill': {
      const fr = b.headWidth * 1.55;
      crown = `M ${headX - b.headLength * 0.5} ${-fr} L ${headX + b.headLength * 0.1} ${-fr * 1.05} L ${
        headX + b.headLength * 0.35
      } 0 L ${headX + b.headLength * 0.1} ${fr * 1.05} L ${headX - b.headLength * 0.5} ${fr} Z`;
      break;
    }
    case 'dome':
      crown = `M ${headX - b.headLength * 0.5} 0 a ${b.headLength * 0.5} ${b.headWidth * 0.55} 0 1 0 ${
        b.headLength
      } 0 a ${b.headLength * 0.5} ${b.headWidth * 0.55} 0 1 0 ${-b.headLength} 0 Z`;
      break;
    case 'sail': {
      const len = b.bodyLength;
      const pts: string[] = [];
      for (let i = 0; i <= 8; i++) {
        const t = i / 8;
        const x = bodyX - len * 0.85 + t * len * 1.75;
        pts.push(`${x.toFixed(1)} ${(-Math.sin(t * Math.PI) * b.bodyWidth * 1.9).toFixed(1)}`);
      }
      crown = `M ${bodyX - len * 0.85} 0 L ${pts.join(' L ')} L ${bodyX + len * 0.9} 0 Z`;
      break;
    }
    case 'crest':
      crown = `M ${headX - b.headLength * 0.35} ${-b.headWidth * 0.34} L ${headX + b.headLength * 0.15} ${
        -b.headWidth * 0.85
      } L ${headX + b.headLength * 0.5} ${-b.headWidth * 0.42} Z M ${headX - b.headLength * 0.35} ${
        b.headWidth * 0.34
      } L ${headX + b.headLength * 0.15} ${b.headWidth * 0.85} L ${headX + b.headLength * 0.5} ${
        b.headWidth * 0.42
      } Z`;
      break;
    case 'tube':
      crown = `M ${headX - b.headLength * 0.4} ${-b.headWidth * 0.3} L ${headX - b.headLength * 1.5} ${
        -b.headWidth * 1.5
      } L ${headX - b.headLength * 1.15} ${-b.headWidth * 1.95} L ${headX - b.headLength * 0.2} ${
        -b.headWidth * 0.55
      } Z`;
      break;
    case 'horns':
      crown = `M ${headX + b.headLength * 0.05} ${-b.headWidth * 0.4} L ${headX + b.headLength * 0.42} ${
        -b.headWidth * 1.2
      } L ${headX + b.headLength * 0.3} ${-b.headWidth * 0.32} Z M ${headX + b.headLength * 0.05} ${
        b.headWidth * 0.4
      } L ${headX + b.headLength * 0.42} ${b.headWidth * 1.2} L ${headX + b.headLength * 0.3} ${
        b.headWidth * 0.32
      } Z`;
      break;
    case 'plates': {
      const len = b.bodyLength;
      const parts: string[] = [];
      for (let row = -1; row <= 1; row++) {
        for (let i = 0; i < 5; i++) {
          const x = bodyX - len * 0.7 + (i / 4) * len * 1.4;
          const y = row * b.bodyWidth * 0.62;
          parts.push(
            `M ${x - len * 0.15} ${y} a ${len * 0.15} ${b.bodyWidth * 0.25} 0 1 0 ${len * 0.3} 0 a ${
              len * 0.15
            } ${b.bodyWidth * 0.25} 0 1 0 ${-len * 0.3} 0 Z`,
          );
        }
      }
      crown = parts.join(' ');
      break;
    }
    default:
      crown = null;
  }

  let spines: string | null = null;
  if (b.spines > 0) {
    const parts: string[] = [];
    for (let i = 0; i < b.spines; i++) {
      const t = i / (b.spines - 1 || 1);
      const x = bodyX - b.bodyLength * 0.8 + t * b.bodyLength * 1.7;
      const h = 1.6 + Math.sin(t * Math.PI) * b.bodyWidth * 0.42;
      parts.push(
        `M ${x - 1.6} ${-b.bodyWidth * 0.72} L ${x} ${-b.bodyWidth * 0.72 - h} L ${x + 1.6} ${
          -b.bodyWidth * 0.72
        } Z`,
      );
    }
    spines = parts.join(' ');
  }

  const spanX = b.bodyLength * 2 + b.tailLength + b.neckLength + b.headLength;
  const spanY = Math.max(b.bodyWidth * 4, b.legLength * 3, b.headWidth * 4);
  return {
    body: ribbonPath(torso),
    tail: ribbonPath(tailSpine),
    neck: ribbonPath(neck),
    head: ribbonPath(head),
    legs,
    crown,
    spines,
    view: {
      x: -(b.bodyLength * 0.9 + b.tailLength) - 8,
      y: -spanY / 2 - 4,
      w: spanX + 20,
      h: spanY + 8,
    },
  };
}
