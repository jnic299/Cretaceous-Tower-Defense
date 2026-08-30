import Phaser from 'phaser';
import { shade } from './color';
import { bakeTexture, panel, poly, softCircle } from './draw';

/** Projectile and particle textures. Keys are stable so FX code can look them up. */
export const FX = {
  dart: 'proj:dart',
  spike: 'proj:spike',
  bullet: 'proj:bullet',
  arc: 'proj:arc',
  grenade: 'proj:grenade',
  shell: 'proj:shell',
  slug: 'proj:slug',
  frost: 'proj:frost',
  spark: 'fx:spark',
  smoke: 'fx:smoke',
  dust: 'fx:dust',
  flame: 'fx:flame',
  ember: 'fx:ember',
  ring: 'fx:ring',
  muzzle: 'fx:muzzle',
  glow: 'fx:glow',
  star: 'fx:star',
  chunk: 'fx:chunk',
  snow: 'fx:snow',
} as const;

export function bakeFxTextures(scene: Phaser.Scene): void {
  // ---- Projectiles (drawn pointing +x) --------------------------------
  bakeTexture(scene, FX.dart, 26, 10, (g, cx, cy) => {
    poly(
      g,
      [
        { x: cx + 11, y: cy },
        { x: cx - 4, y: cy - 2.6 },
        { x: cx - 10, y: cy - 1 },
        { x: cx - 10, y: cy + 1 },
        { x: cx - 4, y: cy + 2.6 },
      ],
      0xf2e7c8,
      0x6b5a34,
      1.2,
    );
    g.fillStyle(0xd7452f, 1);
    g.fillRect(cx - 10, cy - 2.2, 4, 4.4);
  });

  bakeTexture(scene, FX.spike, 18, 8, (g, cx, cy) => {
    poly(
      g,
      [
        { x: cx + 8, y: cy },
        { x: cx - 7, y: cy - 2.4 },
        { x: cx - 7, y: cy + 2.4 },
      ],
      0xe6dcc0,
      0x5e5340,
      1.2,
    );
  });

  bakeTexture(scene, FX.bullet, 14, 7, (g, cx, cy) => {
    g.fillStyle(0xffe9a8, 1);
    g.fillEllipse(cx, cy, 12, 4.6);
    g.fillStyle(0xfff6d8, 1);
    g.fillEllipse(cx + 2.5, cy, 5, 3);
  });

  bakeTexture(scene, FX.arc, 22, 14, (g, cx, cy) => {
    g.lineStyle(3.2, 0x9be9ff, 0.95);
    g.beginPath();
    g.moveTo(cx - 10, cy);
    g.lineTo(cx - 3, cy - 4);
    g.lineTo(cx + 2, cy + 3);
    g.lineTo(cx + 10, cy - 1);
    g.strokePath();
    g.lineStyle(1.4, 0xffffff, 1);
    g.beginPath();
    g.moveTo(cx - 10, cy);
    g.lineTo(cx - 3, cy - 4);
    g.lineTo(cx + 2, cy + 3);
    g.lineTo(cx + 10, cy - 1);
    g.strokePath();
  });

  bakeTexture(scene, FX.grenade, 16, 16, (g, cx, cy) => {
    g.fillStyle(0x4d5a3c, 1);
    g.fillCircle(cx, cy, 6);
    g.lineStyle(1.6, 0x22281c, 1);
    g.strokeCircle(cx, cy, 6);
    g.fillStyle(0xf0b23a, 1);
    g.fillRect(cx - 6, cy - 1.4, 12, 2.8);
    g.fillStyle(0x8f9791, 1);
    g.fillRect(cx - 1.6, cy - 8, 3.2, 4);
  });

  bakeTexture(scene, FX.shell, 22, 12, (g, cx, cy) => {
    poly(
      g,
      [
        { x: cx + 10, y: cy },
        { x: cx + 2, y: cy - 4.4 },
        { x: cx - 9, y: cy - 4 },
        { x: cx - 9, y: cy + 4 },
        { x: cx + 2, y: cy + 4.4 },
      ],
      0x8f9791,
      0x2c3033,
      1.4,
    );
    g.fillStyle(0xd9a441, 1);
    g.fillRect(cx - 9, cy - 4, 4, 8);
  });

  bakeTexture(scene, FX.slug, 16, 10, (g, cx, cy) => {
    g.fillStyle(0xd8c48a, 1);
    g.fillEllipse(cx, cy, 13, 6.4);
    g.fillStyle(0xfff0c0, 1);
    g.fillEllipse(cx + 3, cy, 5, 4);
    g.lineStyle(1.2, 0x6b5a34, 1);
    g.strokeEllipse(cx, cy, 13, 6.4);
  });

  bakeTexture(scene, FX.frost, 16, 16, (g, cx, cy) => {
    g.lineStyle(2, 0xcaf4ff, 0.95);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI;
      g.lineBetween(cx - Math.cos(a) * 6, cy - Math.sin(a) * 6, cx + Math.cos(a) * 6, cy + Math.sin(a) * 6);
    }
    g.fillStyle(0xffffff, 0.9);
    g.fillCircle(cx, cy, 2.4);
  });

  // ---- Particles ------------------------------------------------------
  bakeTexture(scene, FX.spark, 12, 12, (g, cx, cy) => {
    g.fillStyle(0xfff3c4, 1);
    g.fillCircle(cx, cy, 3);
    g.fillStyle(0xffb648, 0.75);
    g.fillCircle(cx, cy, 5);
  });

  bakeTexture(scene, FX.smoke, 40, 40, (g, cx, cy) => {
    softCircle(g, cx, cy, 18, 0xb9b4ad, 0.55, 7);
  });

  bakeTexture(scene, FX.dust, 32, 32, (g, cx, cy) => {
    softCircle(g, cx, cy, 14, 0xd9c9a6, 0.6, 6);
  });

  bakeTexture(scene, FX.flame, 28, 28, (g, cx, cy) => {
    softCircle(g, cx, cy, 12, 0xff7a2a, 0.75, 5);
    g.fillStyle(0xffd469, 0.95);
    g.fillCircle(cx, cy, 4.5);
    g.fillStyle(0xfff3c0, 0.9);
    g.fillCircle(cx, cy, 2.2);
  });

  bakeTexture(scene, FX.ember, 8, 8, (g, cx, cy) => {
    g.fillStyle(0xffbe55, 1);
    g.fillCircle(cx, cy, 2.2);
    g.fillStyle(0xfff0c0, 1);
    g.fillCircle(cx, cy, 1);
  });

  bakeTexture(scene, FX.ring, 128, 128, (g, cx, cy) => {
    g.lineStyle(7, 0xffffff, 1);
    g.strokeCircle(cx, cy, 54);
    g.lineStyle(2.4, 0xffffff, 0.55);
    g.strokeCircle(cx, cy, 44);
  });

  bakeTexture(scene, FX.muzzle, 40, 32, (g, cx, cy) => {
    poly(
      g,
      [
        { x: cx + 18, y: cy },
        { x: cx - 2, y: cy - 11 },
        { x: cx + 4, y: cy },
        { x: cx - 2, y: cy + 11 },
      ],
      0xffd06b,
      undefined,
      0,
      0.95,
    );
    g.fillStyle(0xfff6dc, 1);
    g.fillCircle(cx - 1, cy, 5.2);
  });

  bakeTexture(scene, FX.glow, 96, 96, (g, cx, cy) => {
    softCircle(g, cx, cy, 44, 0xffffff, 0.4, 9);
  });

  bakeTexture(scene, FX.star, 20, 20, (g, cx, cy) => {
    const pts: Phaser.Types.Math.Vector2Like[] = [];
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? 9 : 3.8;
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
    }
    poly(g, pts, 0xffd75e, 0xb07a1c, 1.4);
  });

  bakeTexture(scene, FX.chunk, 12, 12, (g, cx, cy) => {
    poly(
      g,
      [
        { x: cx - 4, y: cy - 3 },
        { x: cx + 3, y: cy - 4 },
        { x: cx + 4, y: cy + 2 },
        { x: cx - 2, y: cy + 4 },
      ],
      0x8a7355,
      0x4a3c2c,
      1,
    );
  });

  bakeTexture(scene, FX.snow, 10, 10, (g, cx, cy) => {
    g.fillStyle(0xdff6ff, 0.95);
    g.fillCircle(cx, cy, 2.6);
  });

  // ---- Reusable UI bits inside the canvas -----------------------------
  bakeTexture(scene, 'ui:selection', 96, 96, (g, cx, cy) => {
    g.lineStyle(3, 0xffe9a8, 0.95);
    for (let i = 0; i < 4; i++) {
      const a0 = (i / 4) * Math.PI * 2 + 0.35;
      const a1 = a0 + 0.7;
      g.beginPath();
      g.arc(cx, cy, 38, a0, a1);
      g.strokePath();
    }
  });

  bakeTexture(scene, 'ui:pin', 34, 44, (g, cx, cy) => {
    poly(
      g,
      [
        { x: cx, y: cy + 18 },
        { x: cx - 10, y: cy - 4 },
        { x: cx + 10, y: cy - 4 },
      ],
      0xffd75e,
      0x7a5312,
      2,
    );
    g.fillStyle(0xffd75e, 1);
    g.fillCircle(cx, cy - 8, 10);
    g.lineStyle(2, 0x7a5312, 1);
    g.strokeCircle(cx, cy - 8, 10);
  });

  bakeTexture(scene, 'fx:rotor', 108, 108, (g, cx, cy) => {
    panel(g, cx - 18, cy - 9, 40, 18, 7, 0x3e4a44, 0x1c231f, 2);
    panel(g, cx + 18, cy - 4, 22, 8, 3, 0x3e4a44, 0x1c231f, 2);
    poly(
      g,
      [
        { x: cx + 40, y: cy - 10 },
        { x: cx + 50, y: cy },
        { x: cx + 40, y: cy + 10 },
      ],
      0x2f3a35,
      0x1c231f,
      1.6,
    );
    g.fillStyle(0x9be8ff, 0.85);
    g.fillCircle(cx - 12, cy - 2, 3.4);
    g.lineStyle(3, 0xdfe6e2, 0.35);
    g.strokeCircle(cx - 2, cy, 48);
    g.lineStyle(4, 0xdfe6e2, 0.55);
    g.lineBetween(cx - 50, cy, cx + 46, cy);
  });

  bakeTexture(scene, 'fx:crack', 160, 160, (g, cx, cy) => {
    g.lineStyle(3.5, shade(0x6b5a44, -0.2), 0.9);
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + 0.2;
      let x = cx + Math.cos(a) * 10;
      let y = cy + Math.sin(a) * 10;
      g.beginPath();
      g.moveTo(x, y);
      for (let s = 0; s < 4; s++) {
        x += Math.cos(a + (s % 2 ? 0.4 : -0.4)) * 16;
        y += Math.sin(a + (s % 2 ? 0.4 : -0.4)) * 16;
        g.lineTo(x, y);
      }
      g.strokePath();
    }
  });
}
