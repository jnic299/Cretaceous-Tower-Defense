import Phaser from 'phaser';
import type { UnitArtSpec } from '../types';
import { mix, shade } from './color';
import { bakeTexture, panel, poly, ribbon } from './draw';

/**
 * Every placeable renders as two sprites: a static base (the ground works it
 * sits on) and a rotating top (the operator and their weapon). Splitting them
 * means units visibly track their target without the sandbags spinning.
 */

import { UNIT_RENDER_SCALE, unitBaseKey, unitTopKey } from './keys';

export { UNIT_RENDER_SCALE, unitBaseKey, unitTopKey };

const DARK = 0x25282e;

function outline(color: number): number {
  return shade(color, -0.62);
}

/* ------------------------------------------------------------------ */
/* Bases                                                               */
/* ------------------------------------------------------------------ */

function drawHumanBase(g: Phaser.GameObjects.Graphics, cx: number, cy: number, art: UnitArtSpec, level: number): void {
  const sand = mix(art.accent, 0xbfae86, 0.6);
  g.fillStyle(0x000000, 0.16);
  g.fillEllipse(cx + 2, cy + 3, 40, 30);
  // Sandbag ring.
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + 0.3;
    const x = cx + Math.cos(a) * 15;
    const y = cy + Math.sin(a) * 11;
    g.fillStyle(i % 2 ? sand : shade(sand, -0.14), 1);
    g.fillEllipse(x, y, 12, 8);
    g.lineStyle(1, shade(sand, -0.45), 0.8);
    g.strokeEllipse(x, y, 12, 8);
  }
  g.fillStyle(shade(art.body, -0.3), 1);
  g.fillEllipse(cx, cy, 20, 15);
  if (level > 0) {
    g.lineStyle(2, art.accent, 0.85);
    g.strokeEllipse(cx, cy, 21, 16);
  }
  if (level > 1) {
    for (const s of [-1, 1]) {
      panel(g, cx - 4 + s * 16, cy - 12, 8, 7, 2, shade(art.accent, -0.15), outline(art.accent), 1);
    }
  }
}

function drawMachineBase(g: Phaser.GameObjects.Graphics, cx: number, cy: number, art: UnitArtSpec, level: number): void {
  g.fillStyle(0x000000, 0.18);
  g.fillEllipse(cx + 2, cy + 3, 42, 32);
  const plate: Phaser.Types.Math.Vector2Like[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    plate.push({ x: cx + Math.cos(a) * 20, y: cy + Math.sin(a) * 15 });
  }
  poly(g, plate, shade(art.metal, -0.28), DARK, 2);
  poly(
    g,
    plate.map((p) => ({ x: cx + ((p.x ?? 0) - cx) * 0.72, y: cy + ((p.y ?? 0) - cy) * 0.72 })),
    shade(art.metal, -0.12),
    undefined,
    0,
  );
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    g.fillStyle(DARK, 0.75);
    g.fillCircle(cx + Math.cos(a) * 16, cy + Math.sin(a) * 12, 1.8);
  }
  if (level > 0) {
    g.lineStyle(2, art.accent, 0.8);
    g.strokeCircle(cx, cy, 10);
  }
  if (level > 1) {
    g.fillStyle(art.accent, 0.35);
    g.fillCircle(cx, cy, 7);
  }
}

function drawVehicleBase(g: Phaser.GameObjects.Graphics, cx: number, cy: number, art: UnitArtSpec, level: number): void {
  g.fillStyle(0x000000, 0.2);
  g.fillEllipse(cx + 2, cy + 4, 56, 40);
  if (art.weapon === 'boat') return; // The hull is drawn on the rotating layer.
  // Track units.
  for (const s of [-1, 1]) {
    panel(g, cx - 22, cy + s * 13 - 6, 44, 12, 5, shade(DARK, 0.12), DARK, 2);
    for (let i = 0; i < 6; i++) {
      g.fillStyle(shade(DARK, 0.3), 0.9);
      g.fillRect(cx - 20 + i * 7, cy + s * 13 - 5, 3, 10);
    }
  }
  panel(g, cx - 18, cy - 12, 36, 24, 5, shade(art.body, -0.18), outline(art.body), 2);
  if (level > 0) {
    g.fillStyle(art.accent, 0.9);
    g.fillRect(cx - 16, cy - 2, 32, 3);
  }
  if (level > 1) {
    panel(g, cx + 8, cy - 10, 8, 20, 2, shade(art.metal, -0.1), DARK, 1);
  }
}

/* ------------------------------------------------------------------ */
/* Weapons                                                             */
/* ------------------------------------------------------------------ */

function drawWeapon(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  art: UnitArtSpec,
  level: number,
): void {
  const m = art.metal;
  const mo = DARK;
  const acc = art.accent;
  const L = level;

  switch (art.weapon) {
    case 'dart': {
      panel(g, x, y - 2.2, 20 + L * 3, 4.4, 2, m, mo, 1.2);
      panel(g, x + 4, y - 5, 7, 4, 1.5, shade(m, -0.2), mo, 1);
      g.fillStyle(acc, 1);
      g.fillCircle(x + 3, y + 3.5, 2.6 + L * 0.3);
      if (L > 1) {
        panel(g, x + 20, y - 3.2, 6, 6.4, 2, shade(m, 0.15), mo, 1);
      }
      break;
    }
    case 'spikeRing': {
      g.fillStyle(shade(m, -0.15), 1);
      g.fillCircle(x + 2, y, 9 + L);
      g.lineStyle(2, mo, 1);
      g.strokeCircle(x + 2, y, 9 + L);
      for (let i = 0; i < 8 + L * 2; i++) {
        const a = (i / (8 + L * 2)) * Math.PI * 2;
        const r = 9 + L;
        poly(
          g,
          [
            { x: x + 2 + Math.cos(a) * r, y: y + Math.sin(a) * r },
            { x: x + 2 + Math.cos(a) * (r + 5), y: y + Math.sin(a) * (r + 5) },
            { x: x + 2 + Math.cos(a + 0.25) * r, y: y + Math.sin(a + 0.25) * r },
          ],
          acc,
          undefined,
          0,
        );
      }
      g.fillStyle(shade(acc, 0.3), 1);
      g.fillCircle(x + 2, y, 3.5);
      break;
    }
    case 'flamer': {
      panel(g, x, y - 3.4, 18 + L * 2, 6.8, 3, m, mo, 1.4);
      panel(g, x + 16 + L * 2, y - 4.6, 7, 9.2, 3, shade(m, -0.25), mo, 1.2);
      g.fillStyle(0xff8a3c, 1);
      g.fillCircle(x + 21 + L * 2, y, 2.6 + L * 0.4);
      g.fillStyle(0xffd36e, 1);
      g.fillCircle(x + 21 + L * 2, y, 1.3);
      // Fuel tank rides on the operator's back.
      panel(g, x - 20, y - 6, 9, 12, 4, shade(acc, -0.2), mo, 1.2);
      g.lineStyle(1.4, shade(m, 0.1), 1);
      g.lineBetween(x - 12, y - 2, x, y);
      break;
    }
    case 'sniper': {
      panel(g, x - 4, y - 1.8, 34 + L * 5, 3.6, 1.6, m, mo, 1.2);
      panel(g, x - 8, y - 3.4, 12, 6.8, 2, shade(m, -0.22), mo, 1.2);
      panel(g, x + 2, y - 6.2, 9, 3.4, 1.4, shade(acc, -0.1), mo, 1);
      g.fillStyle(0x7fe3ff, 0.9);
      g.fillCircle(x + 10.5, y - 4.5, 1.4);
      if (L > 0) panel(g, x + 30 + L * 5, y - 3, 5, 6, 2, shade(m, 0.12), mo, 1);
      // Bipod.
      g.lineStyle(1.6, mo, 1);
      g.lineBetween(x + 14, y, x + 18, y - 6);
      g.lineBetween(x + 14, y, x + 18, y + 6);
      break;
    }
    case 'shock': {
      panel(g, x, y - 3, 16 + L * 2, 6, 2.5, m, mo, 1.2);
      const coilX = x + 15 + L * 2;
      g.lineStyle(1.8, acc, 1);
      for (let i = 0; i < 3; i++) g.strokeCircle(coilX, y, 3 + i * 2.2);
      g.fillStyle(shade(acc, 0.4), 1);
      g.fillCircle(coilX, y, 2.4);
      panel(g, x - 16, y - 5, 8, 10, 3, shade(art.body, -0.15), mo, 1.2);
      break;
    }
    case 'launcher': {
      panel(g, x, y - 4, 20 + L * 2, 8, 3.5, m, mo, 1.4);
      panel(g, x + 18 + L * 2, y - 5.4, 8, 10.8, 3, shade(m, -0.25), mo, 1.2);
      g.fillStyle(DARK, 1);
      g.fillCircle(x + 24 + L * 2, y, 3.4);
      for (let i = 0; i < 2 + L; i++) {
        g.fillStyle(acc, 1);
        g.fillCircle(x - 14, y - 5 + i * 5, 2.6);
        g.lineStyle(1, mo, 0.8);
        g.strokeCircle(x - 14, y - 5 + i * 5, 2.6);
      }
      break;
    }
    case 'wrench': {
      panel(g, x, y - 1.8, 13, 3.6, 1.6, m, mo, 1.1);
      poly(
        g,
        [
          { x: x + 13, y: y - 4.5 },
          { x: x + 20, y: y - 3 },
          { x: x + 20, y: y + 3 },
          { x: x + 13, y: y + 4.5 },
          { x: x + 15, y: y },
        ],
        shade(m, 0.1),
        mo,
        1.1,
      );
      // Toolkit satchel.
      panel(g, x - 18, y - 6, 10, 12, 3, shade(acc, -0.25), mo, 1.2);
      g.fillStyle(acc, 1);
      g.fillRect(x - 16, y - 1, 6, 2);
      break;
    }
    case 'boat': {
      // Hull, drawn on the rotating layer so the boat points where it shoots.
      poly(
        g,
        ribbon([
          { x: x - 30, y, w: 9 },
          { x: x - 6, y, w: 13 },
          { x: x + 16, y, w: 10 },
          { x: x + 30, y, w: 2.5 },
        ]),
        art.body,
        outline(art.body),
        2,
      );
      poly(
        g,
        ribbon([
          { x: x - 24, y, w: 6 },
          { x: x + 10, y, w: 8 },
          { x: x + 22, y, w: 2 },
        ]),
        shade(art.body, 0.22),
        undefined,
        0,
      );
      panel(g, x - 14, y - 6, 14, 12, 3, shade(art.accent, -0.1), mo, 1.4);
      panel(g, x + 2, y - 2, 20 + L * 3, 4, 2, m, mo, 1.2);
      g.fillStyle(acc, 1);
      g.fillCircle(x - 7, y, 3);
      if (L > 1) panel(g, x + 2, y - 6, 14, 3, 1.4, m, mo, 1);
      break;
    }
    case 'autocannon': {
      panel(g, x - 10, y - 8, 20, 16, 4, shade(m, -0.12), mo, 2);
      panel(g, x + 8, y - 3, 22 + L * 4, 6, 2.5, m, mo, 1.4);
      panel(g, x + 8, y - 6.5, 22 + L * 4, 3, 1.4, shade(m, 0.18), mo, 1);
      g.fillStyle(DARK, 1);
      g.fillCircle(x + 30 + L * 4, y - 1.5, 2);
      g.fillStyle(acc, 1);
      g.fillRect(x - 8, y - 6, 4, 12);
      if (L > 1) {
        panel(g, x + 26 + L * 4, y - 4.4, 7, 8.8, 2, shade(m, 0.1), mo, 1);
      }
      break;
    }
    case 'tesla': {
      panel(g, x - 9, y - 9, 18, 18, 5, shade(m, -0.15), mo, 2);
      for (let i = 0; i < 3; i++) {
        g.lineStyle(2, shade(m, 0.1 + i * 0.1), 1);
        g.strokeCircle(x + 2, y, 11 - i * 3);
      }
      g.fillStyle(acc, 1);
      g.fillCircle(x + 2, y, 5 + L * 0.6);
      g.fillStyle(shade(acc, 0.5), 1);
      g.fillCircle(x + 2, y, 2.4);
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + 0.4;
        g.lineStyle(1.6, acc, 0.9);
        g.lineBetween(x + 2 + Math.cos(a) * 6, y + Math.sin(a) * 6, x + 2 + Math.cos(a) * 13, y + Math.sin(a) * 13);
      }
      break;
    }
    case 'rail': {
      panel(g, x - 12, y - 9, 22, 18, 4, shade(m, -0.18), mo, 2);
      for (const s of [-1, 1]) {
        panel(g, x + 8, y + s * 4 - 1.6, 30 + L * 5, 3.2, 1.4, shade(m, 0.15), mo, 1.2);
      }
      g.lineStyle(1.6, acc, 0.95);
      for (let i = 0; i < 4; i++) {
        const bx = x + 12 + i * (7 + L);
        g.lineBetween(bx, y - 4, bx, y + 4);
      }
      g.fillStyle(acc, 0.9);
      g.fillCircle(x + 38 + L * 5, y, 2.6);
      break;
    }
    case 'mortar': {
      panel(g, x - 10, y - 10, 20, 20, 5, shade(m, -0.2), mo, 2);
      // Barrel elevated, so it reads as indirect fire.
      poly(
        g,
        ribbon([
          { x: x - 2, y: y + 2, w: 5.5 },
          { x: x + 15 + L * 2, y: y - 6 - L, w: 6.5 },
        ]),
        m,
        mo,
        1.6,
      );
      g.fillStyle(DARK, 1);
      g.fillCircle(x + 15 + L * 2, y - 6 - L, 4);
      g.fillStyle(acc, 1);
      g.fillCircle(x - 4, y, 3.4);
      for (const s of [-1, 1]) {
        g.lineStyle(2, mo, 1);
        g.lineBetween(x - 2, y + 2, x - 14, y + s * 10);
      }
      break;
    }
    case 'tank': {
      panel(g, x - 14, y - 12, 30, 24, 7, art.body, outline(art.body), 2.4);
      panel(g, x - 10, y - 8, 20, 16, 5, shade(art.body, 0.16), undefined, 0);
      panel(g, x + 12, y - 3.6, 34, 7.2, 3, m, mo, 1.8);
      panel(g, x + 40, y - 5.4, 9, 10.8, 3, shade(m, -0.2), mo, 1.4);
      g.fillStyle(DARK, 1);
      g.fillCircle(x + 46, y, 3);
      // Coaxial gun.
      panel(g, x + 10, y + 7, 18, 3.4, 1.4, shade(m, -0.1), mo, 1);
      g.fillStyle(acc, 1);
      g.fillRect(x - 12, y - 10, 4, 20);
      panel(g, x - 6, y - 14, 12, 5, 2, shade(art.body, -0.25), mo, 1.2);
      break;
    }
    case 'rifle': {
      panel(g, x - 3, y - 2, 28 + L * 3, 4, 1.8, m, mo, 1.2);
      panel(g, x - 8, y - 3.6, 11, 7.2, 2, shade(m, -0.22), mo, 1.2);
      panel(g, x + 4, y - 6, 8, 3, 1.2, shade(acc, -0.1), mo, 1);
      g.fillStyle(0x9be8ff, 0.9);
      g.fillCircle(x + 11, y - 4.5, 1.3);
      break;
    }
    case 'exo': {
      // Powered frame: heavy pauldrons and a forearm cannon.
      panel(g, x - 14, y - 14, 26, 28, 8, art.body, outline(art.body), 2.4);
      panel(g, x - 10, y - 10, 18, 20, 6, shade(art.body, 0.18), undefined, 0);
      for (const s of [-1, 1]) {
        panel(g, x - 6, y + s * 15 - 7, 18, 14, 6, shade(art.metal, -0.1), mo, 2);
      }
      panel(g, x + 10, y - 5, 22, 10, 4, m, mo, 1.6);
      g.fillStyle(DARK, 1);
      g.fillCircle(x + 30, y, 3.2);
      g.fillStyle(acc, 1);
      g.fillCircle(x - 2, y, 4.6);
      g.fillStyle(shade(acc, 0.4), 1);
      g.fillCircle(x - 2, y, 2.2);
      break;
    }
  }
}

/* ------------------------------------------------------------------ */
/* Operators                                                           */
/* ------------------------------------------------------------------ */

function drawHumanTop(g: Phaser.GameObjects.Graphics, cx: number, cy: number, art: UnitArtSpec, level: number): void {
  const body = art.body;
  const ol = outline(body);

  // Backpack.
  panel(g, cx - 14, cy - 7, 9, 14, 3, shade(body, -0.28), ol, 1.4);

  // Shoulders / torso seen from above.
  poly(
    g,
    ribbon([
      { x: cx - 7, y: cy, w: 8.5 },
      { x: cx + 2, y: cy, w: 9.5 },
      { x: cx + 8, y: cy, w: 7 },
    ]),
    body,
    ol,
    2,
  );
  g.fillStyle(shade(body, 0.22), 0.9);
  g.fillEllipse(cx, cy - 3.5, 16, 7);
  // Webbing.
  g.fillStyle(art.accent, 0.9);
  g.fillRect(cx - 5, cy - 8.5, 3.4, 17);

  // Arms reaching to the weapon.
  for (const s of [-1, 1]) {
    poly(
      g,
      ribbon([
        { x: cx + 3, y: cy + s * 7.5, w: 3.2 },
        { x: cx + 13, y: cy + s * 4.5, w: 2.6 },
      ]),
      shade(body, -0.12),
      ol,
      1.2,
    );
  }

  drawWeapon(g, cx + 10, cy, art, level);

  // Head, drawn last so it sits on top of the shoulders.
  g.fillStyle(mix(0xd8a878, art.body, 0.12), 1);
  g.fillCircle(cx + 2, cy, 5.6);
  g.lineStyle(1.6, ol, 1);
  g.strokeCircle(cx + 2, cy, 5.6);

  switch (art.hat) {
    case 'cap':
      poly(
        g,
        [
          { x: cx - 2, y: cy - 5.4 },
          { x: cx + 9, y: cy - 3.2 },
          { x: cx + 9, y: cy + 3.2 },
          { x: cx - 2, y: cy + 5.4 },
        ],
        shade(body, -0.2),
        ol,
        1.2,
      );
      break;
    case 'helmet':
      g.fillStyle(shade(body, -0.28), 1);
      g.fillCircle(cx + 1.5, cy, 6.4);
      g.lineStyle(1.6, ol, 1);
      g.strokeCircle(cx + 1.5, cy, 6.4);
      g.fillStyle(art.accent, 0.85);
      g.fillRect(cx - 3.5, cy - 1.2, 9, 2.4);
      break;
    case 'visor':
      g.fillStyle(shade(body, -0.3), 1);
      g.fillCircle(cx + 1.5, cy, 6.2);
      panel(g, cx + 3, cy - 4, 5, 8, 2, art.accent, ol, 1);
      break;
    case 'hood':
      poly(
        g,
        ribbon([
          { x: cx - 5, y: cy, w: 7.4 },
          { x: cx + 4, y: cy, w: 6.2 },
          { x: cx + 8, y: cy, w: 3 },
        ]),
        shade(body, -0.34),
        ol,
        1.4,
      );
      break;
    default:
      break;
  }

  if (level > 1) {
    // Rank flash on the shoulder at max level.
    g.fillStyle(art.accent, 1);
    g.fillTriangle(cx - 3, cy - 9.5, cx + 1, cy - 12, cx + 5, cy - 9.5);
  }
}

function drawMachineTop(g: Phaser.GameObjects.Graphics, cx: number, cy: number, art: UnitArtSpec, level: number): void {
  drawWeapon(g, cx, cy, art, level);
}

function drawVehicleTop(g: Phaser.GameObjects.Graphics, cx: number, cy: number, art: UnitArtSpec, level: number): void {
  drawWeapon(g, cx - 6, cy, art, level);
}

/* ------------------------------------------------------------------ */
/* Baking                                                              */
/* ------------------------------------------------------------------ */

export const UNIT_BASE_SIZE = 64 * UNIT_RENDER_SCALE;
export const UNIT_TOP_SIZE = 128 * UNIT_RENDER_SCALE;

export function bakeUnitArt(scene: Phaser.Scene, id: string, art: UnitArtSpec, levels = 3): void {
  for (let level = 0; level < levels; level++) {
    const scale = (art.scale ?? 1) * UNIT_RENDER_SCALE;

    bakeTexture(scene, unitBaseKey(id, level), UNIT_BASE_SIZE, UNIT_BASE_SIZE, (g, cx, cy) => {
      g.scale = UNIT_RENDER_SCALE;
      const lx = cx / UNIT_RENDER_SCALE;
      const ly = cy / UNIT_RENDER_SCALE;
      if (art.chassis === 'human') drawHumanBase(g, lx, ly, art, level);
      else if (art.chassis === 'machine') drawMachineBase(g, lx, ly, art, level);
      else drawVehicleBase(g, lx, ly, art, level);
    });

    bakeTexture(scene, unitTopKey(id, level), UNIT_TOP_SIZE, UNIT_TOP_SIZE, (g, cx, cy) => {
      g.scale = scale;
      const lx = cx / scale;
      const ly = cy / scale;
      if (art.chassis === 'human') drawHumanTop(g, lx, ly, art, level);
      else if (art.chassis === 'machine') drawMachineTop(g, lx, ly, art, level);
      else drawVehicleTop(g, lx, ly, art, level);
    });
  }
}
