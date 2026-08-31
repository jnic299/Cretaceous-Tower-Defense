import Phaser from 'phaser';
import type { FixtureDef } from '../types';
import { shade } from './color';
import { bakeTexture, panel, poly } from './draw';
import { fixtureTextureKey } from './keys';

export { fixtureTextureKey };

/** Fixtures get their own compact top-down art rather than reusing unit bases. */
export function bakeFixtureArt(scene: Phaser.Scene, def: FixtureDef): void {
  bakeTexture(scene, fixtureTextureKey(def.id), 96, 96, (g, cx, cy) => {
    g.fillStyle(0x000000, 0.24);
    g.fillEllipse(cx + 3, cy + 4, 68, 46);
    switch (def.kind) {
      case 'barricade': {
        const steel = 0x8d949c;
        for (let i = -1; i <= 1; i++) {
          panel(g, cx - 34, cy + i * 12 - 5, 68, 10, 3, i === 0 ? shade(steel, 0.1) : steel, 0x2a2e33, 2);
        }
        for (const s of [-1, 1]) {
          panel(g, cx + s * 30 - 4, cy - 22, 8, 44, 3, shade(steel, -0.25), 0x2a2e33, 2);
        }
        g.fillStyle(0xf0b23a, 1);
        for (let i = 0; i < 4; i++) g.fillRect(cx - 30 + i * 17, cy - 3, 8, 6);
        break;
      }
      case 'shockFence': {
        const post = 0x6f767d;
        for (const s of [-1, 1]) {
          panel(g, cx + s * 30 - 4, cy - 26, 8, 52, 3, post, 0x22262a, 2);
          g.fillStyle(0x9be8ff, 1);
          g.fillCircle(cx + s * 30, cy - 26, 4);
        }
        g.lineStyle(2.2, 0x9be8ff, 0.95);
        for (let i = 0; i < 5; i++) {
          const y = cy - 20 + i * 10;
          g.lineBetween(cx - 30, y, cx + 30, y);
        }
        g.lineStyle(1.6, 0xffffff, 0.8);
        g.beginPath();
        g.moveTo(cx - 26, cy - 10);
        g.lineTo(cx - 8, cy + 4);
        g.lineTo(cx + 6, cy - 8);
        g.lineTo(cx + 26, cy + 6);
        g.strokePath();
        break;
      }
      case 'decoy': {
        panel(g, cx - 12, cy - 6, 24, 26, 5, 0x4a5a4a, 0x1e261e, 2);
        g.fillStyle(0xd9a441, 1);
        g.fillRect(cx - 9, cy + 2, 18, 4);
        // Horn assembly.
        poly(
          g,
          [
            { x: cx - 4, y: cy - 6 },
            { x: cx + 4, y: cy - 6 },
            { x: cx + 15, y: cy - 26 },
            { x: cx - 15, y: cy - 26 },
          ],
          0x9aa3ad,
          0x2a2e33,
          2,
        );
        g.fillStyle(0xffe9a8, 0.9);
        g.fillEllipse(cx, cy - 26, 30, 8);
        for (let i = 1; i <= 3; i++) {
          g.lineStyle(2, 0xffe9a8, 0.35 / i);
          g.strokeCircle(cx, cy - 26, 12 + i * 9);
        }
        break;
      }
      case 'supplyCache': {
        const wood = 0x8a6b40;
        panel(g, cx - 26, cy - 18, 34, 34, 4, wood, shade(wood, -0.5), 2.4);
        g.lineStyle(2.4, shade(wood, 0.22), 1);
        g.lineBetween(cx - 26, cy - 18, cx + 8, cy + 16);
        g.lineBetween(cx + 8, cy - 18, cx - 26, cy + 16);
        panel(g, cx + 6, cy - 6, 22, 22, 4, 0x4e6b5a, 0x1f2b25, 2);
        g.fillStyle(0xd9a441, 1);
        g.fillCircle(cx + 17, cy + 5, 5);
        g.fillStyle(0xffe9a8, 1);
        g.fillCircle(cx + 17, cy + 5, 2.2);
        break;
      }
    }
  });
}
