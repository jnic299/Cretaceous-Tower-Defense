import Phaser from 'phaser';

export type DrawFn = (g: Phaser.GameObjects.Graphics, cx: number, cy: number) => void;

/**
 * Bakes a Graphics drawing into a cached texture. Every sprite in the game is
 * produced this way — no external image assets, no hotlinking, and a
 * professional sprite sheet can replace any single key later without
 * touching gameplay code.
 */
export function bakeTexture(
  scene: Phaser.Scene,
  key: string,
  width: number,
  height: number,
  draw: DrawFn,
): string {
  if (scene.textures.exists(key)) return key;
  const g = new Phaser.GameObjects.Graphics(scene);
  draw(g, width / 2, height / 2);
  g.generateTexture(key, Math.ceil(width), Math.ceil(height));
  g.destroy();
  return key;
}

/** Filled polygon with an outline in one call. */
export function poly(
  g: Phaser.GameObjects.Graphics,
  points: Phaser.Types.Math.Vector2Like[],
  fill: number,
  outline?: number,
  lineWidth = 2,
  alpha = 1,
): void {
  g.fillStyle(fill, alpha);
  g.beginPath();
  g.moveTo(points[0].x ?? 0, points[0].y ?? 0);
  for (let i = 1; i < points.length; i++) g.lineTo(points[i].x ?? 0, points[i].y ?? 0);
  g.closePath();
  g.fillPath();
  if (outline !== undefined) {
    g.lineStyle(lineWidth, outline, alpha);
    g.strokePath();
  }
}

/** Capsule between two points, tapering from `w1` to `w2`. */
export function limb(
  g: Phaser.GameObjects.Graphics,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  w1: number,
  w2: number,
  fill: number,
  outline?: number,
): void {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  poly(
    g,
    [
      { x: x1 + nx * w1, y: y1 + ny * w1 },
      { x: x2 + nx * w2, y: y2 + ny * w2 },
      { x: x2 - nx * w2, y: y2 - ny * w2 },
      { x: x1 - nx * w1, y: y1 - ny * w1 },
    ],
    fill,
    outline,
    1.5,
  );
  g.fillStyle(fill, 1);
  g.fillCircle(x1, y1, w1);
  g.fillCircle(x2, y2, w2);
}

/**
 * Closed organic outline through a centreline with per-point widths.
 * This is how every dinosaur body, neck and tail is built.
 */
export function ribbon(
  spine: { x: number; y: number; w: number }[],
): Phaser.Types.Math.Vector2Like[] {
  const left: Phaser.Types.Math.Vector2Like[] = [];
  const right: Phaser.Types.Math.Vector2Like[] = [];
  for (let i = 0; i < spine.length; i++) {
    const prev = spine[Math.max(0, i - 1)];
    const next = spine[Math.min(spine.length - 1, i + 1)];
    const dx = next.x - prev.x;
    const dy = next.y - prev.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const p = spine[i];
    left.push({ x: p.x + nx * p.w, y: p.y + ny * p.w });
    right.push({ x: p.x - nx * p.w, y: p.y - ny * p.w });
  }
  return [...left, ...right.reverse()];
}

/** Soft radial blob approximated with concentric circles. */
export function softCircle(
  g: Phaser.GameObjects.Graphics,
  cx: number,
  cy: number,
  radius: number,
  color: number,
  peakAlpha = 0.5,
  rings = 6,
): void {
  for (let i = rings; i >= 1; i--) {
    const t = i / rings;
    g.fillStyle(color, (peakAlpha * (1 - t) ** 1.5) / 1 + peakAlpha * 0.06);
    g.fillCircle(cx, cy, radius * t);
  }
}

/** Rounded rectangle with outline. */
export function panel(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fill: number,
  outline?: number,
  lineWidth = 2,
): void {
  g.fillStyle(fill, 1);
  g.fillRoundedRect(x, y, w, h, r);
  if (outline !== undefined) {
    g.lineStyle(lineWidth, outline, 1);
    g.strokeRoundedRect(x, y, w, h, r);
  }
}
