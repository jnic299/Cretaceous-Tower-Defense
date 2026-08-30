import Phaser from 'phaser';
import type { DecorKind, MapPalette, ObjectiveDef } from '../types';
import { makeRandom, mix, shade } from './color';
import { bakeTexture, panel, poly, ribbon, softCircle } from './draw';

export function decorKey(kind: DecorKind, theme: string): string {
  return `decor:${theme}:${kind}`;
}

export function objectiveKey(kind: ObjectiveDef['kind']): string {
  return `objective:${kind}`;
}

const DARK = 0x1e2124;

/* ------------------------------------------------------------------ */
/* Decor                                                               */
/* ------------------------------------------------------------------ */

function drawTree(g: Phaser.GameObjects.Graphics, cx: number, cy: number, p: MapPalette, seed: number): void {
  const rand = makeRandom(seed);
  // Cast shadow, offset down-right for a consistent light direction.
  g.fillStyle(0x000000, 0.3);
  g.fillEllipse(cx + 9, cy + 11, 66, 50);

  // Outer silhouette so the crown separates from the ground behind it.
  const rim = shade(p.foliageDark, -0.42);
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + rand() * 0.5;
    g.fillStyle(rim, 1);
    g.fillCircle(cx + Math.cos(a) * 25, cy + Math.sin(a) * 25, 15 + rand() * 5);
  }

  // Three canopy layers stepping from shadow to lit leaf.
  const layers = [
    { count: 9, radius: 24, color: p.foliageDark, size: 14 },
    { count: 7, radius: 16, color: mix(p.foliage, p.foliageDark, 0.3), size: 13 },
    { count: 5, radius: 9, color: shade(p.foliage, 0.16), size: 12 },
  ];
  for (const layer of layers) {
    for (let i = 0; i < layer.count; i++) {
      const a = (i / layer.count) * Math.PI * 2 + rand() * 0.8;
      const r = layer.radius * (0.82 + rand() * 0.34);
      g.fillStyle(layer.color, 1);
      g.fillCircle(cx + Math.cos(a) * r - 2, cy + Math.sin(a) * r - 3, layer.size + rand() * 4);
    }
  }

  // Sunlit crown, up and to the left.
  g.fillStyle(shade(p.foliage, 0.42), 0.85);
  for (let i = 0; i < 7; i++) {
    const a = rand() * Math.PI * 2;
    const r = rand() * 17;
    g.fillCircle(cx + Math.cos(a) * r - 7, cy + Math.sin(a) * r - 9, 5 + rand() * 5);
  }
  g.fillStyle(shade(p.foliage, 0.62), 0.5);
  g.fillCircle(cx - 10, cy - 12, 8);
}

function drawPalm(g: Phaser.GameObjects.Graphics, cx: number, cy: number, p: MapPalette, seed: number): void {
  const rand = makeRandom(seed);
  g.fillStyle(0x000000, 0.2);
  g.fillEllipse(cx + 5, cy + 6, 48, 34);
  const fronds = 8;
  for (let i = 0; i < fronds; i++) {
    const a = (i / fronds) * Math.PI * 2 + rand() * 0.3;
    const len = 24 + rand() * 10;
    poly(
      g,
      ribbon([
        { x: cx, y: cy, w: 3.5 },
        { x: cx + Math.cos(a) * len * 0.6, y: cy + Math.sin(a) * len * 0.6, w: 6 },
        { x: cx + Math.cos(a) * len, y: cy + Math.sin(a) * len, w: 1 },
      ]),
      i % 2 ? p.foliage : p.foliageDark,
      shade(p.foliageDark, -0.35),
      1.2,
    );
  }
  g.fillStyle(shade(0x6b5334, 0.1), 1);
  g.fillCircle(cx, cy, 7);
  g.lineStyle(1.6, DARK, 0.7);
  g.strokeCircle(cx, cy, 7);
}

function drawDeadTree(g: Phaser.GameObjects.Graphics, cx: number, cy: number, p: MapPalette, seed: number): void {
  const rand = makeRandom(seed);
  g.fillStyle(0x000000, 0.2);
  g.fillEllipse(cx + 4, cy + 5, 40, 28);
  const trunk = mix(p.foliageDark, 0x50403a, 0.6);
  g.fillStyle(trunk, 1);
  g.fillCircle(cx, cy, 7);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + rand() * 0.5;
    const len = 16 + rand() * 12;
    poly(
      g,
      ribbon([
        { x: cx, y: cy, w: 3.4 },
        { x: cx + Math.cos(a) * len * 0.55, y: cy + Math.sin(a) * len * 0.55, w: 2.1 },
        { x: cx + Math.cos(a + 0.4) * len, y: cy + Math.sin(a + 0.4) * len, w: 0.8 },
      ]),
      trunk,
      shade(trunk, -0.4),
      1.2,
    );
  }
  g.fillStyle(shade(trunk, 0.25), 1);
  g.fillCircle(cx - 2, cy - 2, 4);
}

function drawFern(g: Phaser.GameObjects.Graphics, cx: number, cy: number, p: MapPalette, seed: number): void {
  const rand = makeRandom(seed);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + rand() * 0.4;
    const len = 11 + rand() * 6;
    poly(
      g,
      ribbon([
        { x: cx, y: cy, w: 2.4 },
        { x: cx + Math.cos(a) * len, y: cy + Math.sin(a) * len, w: 0.6 },
      ]),
      i % 2 ? p.foliage : shade(p.foliage, -0.18),
      undefined,
      0,
    );
  }
  g.fillStyle(shade(p.foliageDark, -0.1), 1);
  g.fillCircle(cx, cy, 3);
}

function drawReed(g: Phaser.GameObjects.Graphics, cx: number, cy: number, p: MapPalette, seed: number): void {
  const rand = makeRandom(seed);
  for (let i = 0; i < 9; i++) {
    const a = -Math.PI / 2 + (rand() - 0.5) * 1.4;
    const len = 12 + rand() * 12;
    g.lineStyle(1.8, i % 2 ? shade(p.foliage, 0.18) : p.foliage, 0.95);
    g.lineBetween(cx + (rand() - 0.5) * 12, cy + 6, cx + Math.cos(a) * len, cy + Math.sin(a) * len);
  }
}

function drawBoulder(g: Phaser.GameObjects.Graphics, cx: number, cy: number, p: MapPalette, seed: number): void {
  const rand = makeRandom(seed);
  const rock = mix(p.groundDeep, 0x9a9186, 0.55);
  g.fillStyle(0x000000, 0.24);
  g.fillEllipse(cx + 4, cy + 5, 36, 26);
  const pts: Phaser.Types.Math.Vector2Like[] = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const r = 14 * (0.8 + rand() * 0.4);
    pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r * 0.82 });
  }
  poly(g, pts, rock, shade(rock, -0.45), 2);
  poly(
    g,
    pts.map((q) => ({ x: cx + ((q.x ?? 0) - cx) * 0.6 - 2, y: cy + ((q.y ?? 0) - cy) * 0.6 - 3 })),
    shade(rock, 0.22),
    undefined,
    0,
  );
}

function drawBone(g: Phaser.GameObjects.Graphics, cx: number, cy: number, seed: number): void {
  const rand = makeRandom(seed);
  const bone = 0xd8cfb4;
  for (let i = 0; i < 3; i++) {
    const y = cy - 6 + i * 6;
    const w = 14 + rand() * 8;
    panel(g, cx - w / 2, y - 1.6, w, 3.2, 1.6, bone, shade(bone, -0.4), 1);
    g.fillStyle(bone, 1);
    g.fillCircle(cx - w / 2, y, 2.6);
    g.fillCircle(cx + w / 2, y, 2.6);
  }
}

function drawCrate(g: Phaser.GameObjects.Graphics, cx: number, cy: number): void {
  const wood = 0x8a6b40;
  g.fillStyle(0x000000, 0.24);
  g.fillRect(cx - 10, cy - 8, 24, 22);
  panel(g, cx - 12, cy - 11, 24, 22, 2, wood, shade(wood, -0.45), 2);
  g.lineStyle(2, shade(wood, 0.2), 1);
  g.lineBetween(cx - 12, cy - 11, cx + 12, cy + 11);
  g.lineBetween(cx + 12, cy - 11, cx - 12, cy + 11);
  g.fillStyle(0xd9a441, 0.9);
  g.fillRect(cx - 12, cy - 3, 24, 3);
}

function drawBarrel(g: Phaser.GameObjects.Graphics, cx: number, cy: number): void {
  g.fillStyle(0x000000, 0.24);
  g.fillEllipse(cx + 3, cy + 4, 24, 24);
  g.fillStyle(0x4e6b5a, 1);
  g.fillCircle(cx, cy, 11);
  g.lineStyle(2, 0x1f2b25, 1);
  g.strokeCircle(cx, cy, 11);
  g.fillStyle(0x6d8d78, 1);
  g.fillCircle(cx - 2, cy - 2, 7);
  g.fillStyle(0xd9a441, 1);
  g.fillCircle(cx, cy, 3);
}

function drawFence(g: Phaser.GameObjects.Graphics, cx: number, cy: number): void {
  const metal = 0x7f8a90;
  for (let i = 0; i < 2; i++) {
    const x = cx - 14 + i * 28;
    panel(g, x - 2.5, cy - 22, 5, 44, 2, metal, DARK, 1.6);
  }
  g.lineStyle(1.6, shade(metal, -0.15), 0.9);
  for (let i = 0; i < 5; i++) {
    const y = cy - 18 + i * 9;
    g.lineBetween(cx - 14, y, cx + 14, y);
  }
  for (let i = 0; i < 4; i++) {
    const x = cx - 10 + i * 7;
    g.lineBetween(x, cy - 22, x, cy + 22);
  }
}

function drawTent(g: Phaser.GameObjects.Graphics, cx: number, cy: number, p: MapPalette): void {
  const canvasCol = mix(p.accent, 0xa8b39a, 0.5);
  g.fillStyle(0x000000, 0.24);
  g.fillEllipse(cx + 4, cy + 6, 60, 44);
  poly(
    g,
    [
      { x: cx - 26, y: cy - 18 },
      { x: cx + 26, y: cy - 18 },
      { x: cx + 22, y: cy + 18 },
      { x: cx - 22, y: cy + 18 },
    ],
    canvasCol,
    shade(canvasCol, -0.45),
    2,
  );
  g.fillStyle(shade(canvasCol, 0.18), 1);
  g.fillRect(cx - 26, cy - 18, 52, 9);
  g.fillStyle(shade(canvasCol, -0.35), 1);
  poly(
    g,
    [
      { x: cx - 7, y: cy + 18 },
      { x: cx - 5, y: cy - 4 },
      { x: cx + 5, y: cy - 4 },
      { x: cx + 7, y: cy + 18 },
    ],
    shade(canvasCol, -0.4),
    DARK,
    1.4,
  );
}

function drawAntenna(g: Phaser.GameObjects.Graphics, cx: number, cy: number): void {
  g.fillStyle(0x000000, 0.22);
  g.fillEllipse(cx + 3, cy + 4, 34, 26);
  const metal = 0x9aa3ad;
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    g.lineStyle(2.6, shade(metal, -0.3), 1);
    g.lineBetween(cx, cy, cx + Math.cos(a) * 15, cy + Math.sin(a) * 15);
  }
  g.fillStyle(metal, 1);
  g.fillCircle(cx, cy, 7);
  g.lineStyle(2, DARK, 1);
  g.strokeCircle(cx, cy, 7);
  g.lineStyle(2, metal, 1);
  g.strokeCircle(cx, cy, 12);
  g.fillStyle(0xff5c48, 1);
  g.fillCircle(cx, cy, 2.6);
}

function drawLamp(g: Phaser.GameObjects.Graphics, cx: number, cy: number): void {
  softCircle(g, cx, cy, 26, 0xffe9a8, 0.18, 5);
  g.fillStyle(0x000000, 0.2);
  g.fillEllipse(cx + 2, cy + 3, 16, 12);
  g.fillStyle(0x6a727a, 1);
  g.fillCircle(cx, cy, 6);
  g.lineStyle(1.6, DARK, 1);
  g.strokeCircle(cx, cy, 6);
  g.fillStyle(0xffe9a8, 1);
  g.fillCircle(cx, cy, 3.4);
}

function drawVent(g: Phaser.GameObjects.Graphics, cx: number, cy: number): void {
  softCircle(g, cx, cy, 24, 0xff7a2a, 0.22, 5);
  g.fillStyle(0x2a2226, 1);
  g.fillCircle(cx, cy, 11);
  g.fillStyle(0x5a3b2c, 1);
  g.fillCircle(cx, cy, 8);
  g.fillStyle(0xff8a3c, 0.85);
  g.fillCircle(cx, cy, 5);
  g.fillStyle(0xffd36e, 0.9);
  g.fillCircle(cx, cy, 2.4);
}

const DECOR_SIZE: Record<DecorKind, number> = {
  tree: 96,
  palm: 88,
  fern: 40,
  boulder: 52,
  reed: 44,
  crate: 40,
  barrel: 34,
  fence: 60,
  tent: 76,
  antenna: 48,
  vent: 56,
  bone: 44,
  lamp: 60,
  deadTree: 80,
};

export function bakeDecor(scene: Phaser.Scene, kind: DecorKind, theme: string, p: MapPalette): string {
  const key = decorKey(kind, theme);
  const size = DECOR_SIZE[kind];
  const seed = kind.length * 7919 + theme.length * 104729;
  return bakeTexture(scene, key, size, size, (g, cx, cy) => {
    switch (kind) {
      case 'tree':
        drawTree(g, cx, cy, p, seed);
        break;
      case 'palm':
        drawPalm(g, cx, cy, p, seed);
        break;
      case 'deadTree':
        drawDeadTree(g, cx, cy, p, seed);
        break;
      case 'fern':
        drawFern(g, cx, cy, p, seed);
        break;
      case 'reed':
        drawReed(g, cx, cy, p, seed);
        break;
      case 'boulder':
        drawBoulder(g, cx, cy, p, seed);
        break;
      case 'bone':
        drawBone(g, cx, cy, seed);
        break;
      case 'crate':
        drawCrate(g, cx, cy);
        break;
      case 'barrel':
        drawBarrel(g, cx, cy);
        break;
      case 'fence':
        drawFence(g, cx, cy);
        break;
      case 'tent':
        drawTent(g, cx, cy, p);
        break;
      case 'antenna':
        drawAntenna(g, cx, cy);
        break;
      case 'lamp':
        drawLamp(g, cx, cy);
        break;
      case 'vent':
        drawVent(g, cx, cy);
        break;
    }
  });
}

/* ------------------------------------------------------------------ */
/* Objective structures                                                */
/* ------------------------------------------------------------------ */

export function bakeObjective(scene: Phaser.Scene, kind: ObjectiveDef['kind']): string {
  return bakeTexture(scene, objectiveKey(kind), 224, 224, (g, cx, cy) => {
    const hull = 0xd6d3c4;
    const roof = 0x5a6b63;
    const acc = 0xffc44d;
    g.scale = 1.24;
    cx /= 1.24;
    cy /= 1.24;

    g.fillStyle(0x000000, 0.32);
    g.fillEllipse(cx + 8, cy + 11, 168, 130);

    // Concrete pad shared by every objective type.
    poly(
      g,
      [
        { x: cx - 70, y: cy - 48 },
        { x: cx + 70, y: cy - 56 },
        { x: cx + 74, y: cy + 54 },
        { x: cx - 66, y: cy + 60 },
      ],
      0x807a6c,
      0x3a362e,
      3.5,
    );
    g.fillStyle(0x938c7c, 1);
    g.fillRect(cx - 60, cy - 40, 122, 90);
    // Deck plating and hazard striping around the edge.
    g.lineStyle(2, 0x6b6559, 0.7);
    for (let i = 1; i < 5; i++) g.lineBetween(cx - 60 + i * 24, cy - 40, cx - 60 + i * 24, cy + 50);
    for (let i = 1; i < 4; i++) g.lineBetween(cx - 60, cy - 40 + i * 22, cx + 62, cy - 40 + i * 22);
    for (let i = 0; i < 7; i++) {
      g.fillStyle(i % 2 ? acc : 0x2f2b24, 0.85);
      g.fillRect(cx - 70 + i * 20, cy + 52, 18, 5);
    }

    switch (kind) {
      case 'evac': {
        // Landing circle plus an approach chevron.
        g.lineStyle(6, acc, 0.95);
        g.strokeCircle(cx, cy, 40);
        g.lineStyle(4, 0xf2f4f5, 0.9);
        g.strokeCircle(cx, cy, 30);
        poly(
          g,
          [
            { x: cx - 16, y: cy + 12 },
            { x: cx, y: cy - 14 },
            { x: cx + 16, y: cy + 12 },
            { x: cx + 8, y: cy + 12 },
            { x: cx, y: cy - 2 },
            { x: cx - 8, y: cy + 12 },
          ],
          0xf2f4f5,
          undefined,
          0,
        );
        panel(g, cx - 66, cy - 60, 30, 22, 4, roof, 0x22282c, 2.4);
        g.fillStyle(acc, 1);
        g.fillCircle(cx - 51, cy - 49, 4);
        break;
      }
      case 'comms': {
        panel(g, cx - 44, cy - 22, 88, 60, 8, hull, 0x35393d, 3);
        panel(g, cx - 36, cy - 14, 72, 26, 5, roof, undefined, 0);
        // Lattice mast.
        for (const s of [-1, 1]) {
          g.lineStyle(3.4, 0x8f979d, 1);
          g.lineBetween(cx + s * 16, cy + 34, cx + s * 5, cy - 60);
        }
        g.lineStyle(2.2, 0x8f979d, 1);
        for (let i = 0; i < 6; i++) {
          const t = i / 5;
          const y = cy + 34 - t * 94;
          g.lineBetween(cx - 16 + t * 11, y, cx + 16 - t * 11, y);
        }
        g.fillStyle(0xff5c48, 1);
        g.fillCircle(cx, cy - 62, 5);
        panel(g, cx + 22, cy - 46, 26, 10, 4, 0x9aa3ad, 0x35393d, 2);
        break;
      }
      case 'generator': {
        panel(g, cx - 48, cy - 34, 96, 74, 8, hull, 0x35393d, 3);
        for (let i = 0; i < 3; i++) {
          panel(g, cx - 38 + i * 28, cy - 24, 20, 54, 4, 0x69727a, 0x2c3135, 2);
          g.fillStyle(acc, 0.9);
          g.fillRect(cx - 34 + i * 28, cy - 16, 12, 4);
        }
        g.fillStyle(0x9be8ff, 0.85);
        g.fillCircle(cx, cy + 30, 7);
        g.lineStyle(2.4, 0x9be8ff, 0.6);
        g.strokeCircle(cx, cy + 30, 13);
        panel(g, cx - 58, cy - 52, 34, 18, 4, roof, 0x22282c, 2.4);
        break;
      }
      case 'lab':
      case 'settlement':
      case 'station':
      default: {
        // Prefab research hut: corrugated roof, lit windows, rooftop dish.
        panel(g, cx - 54, cy - 38, 108, 84, 9, hull, 0x39352c, 3.2);
        panel(g, cx - 46, cy - 30, 92, 40, 7, roof, undefined, 0);
        g.lineStyle(1.6, shade(roof, -0.25), 0.9);
        for (let i = 1; i < 8; i++) g.lineBetween(cx - 46 + i * 11.5, cy - 30, cx - 46 + i * 11.5, cy + 10);
        g.fillStyle(shade(roof, 0.22), 0.75);
        g.fillRect(cx - 46, cy - 30, 92, 8);

        // Lit windows and a door.
        g.fillStyle(0x2f3439, 1);
        for (let i = 0; i < 3; i++) g.fillRect(cx - 36 + i * 28, cy + 16, 20, 18);
        g.fillStyle(0xffe9a8, 0.95);
        for (let i = 0; i < 3; i++) g.fillRect(cx - 34 + i * 28, cy + 18, 16, 14);
        g.fillStyle(0xffe9a8, 0.14);
        for (let i = 0; i < 3; i++) g.fillEllipse(cx - 26 + i * 28, cy + 40, 34, 20);

        // Rooftop dish.
        panel(g, cx - 14, cy - 58, 28, 24, 6, 0x76807f, 0x2c3135, 2.2);
        g.lineStyle(3.4, 0xb6bfbc, 1);
        g.strokeCircle(cx, cy - 48, 12);
        g.lineStyle(2, 0xb6bfbc, 1);
        g.strokeCircle(cx, cy - 48, 6);
        g.fillStyle(acc, 1);
        g.fillCircle(cx, cy - 48, 4);

        // Generator shed and beacon.
        panel(g, cx + 36, cy - 58, 22, 26, 5, roof, 0x22282c, 2.2);
        g.fillStyle(0xff5c48, 1);
        g.fillCircle(cx + 47, cy - 50, 4.5);
        g.fillStyle(0xff5c48, 0.2);
        g.fillCircle(cx + 47, cy - 50, 11);
        panel(g, cx - 58, cy - 56, 20, 20, 4, 0x8a6b40, 0x3f3120, 2);
        break;
      }
    }
  });
}
