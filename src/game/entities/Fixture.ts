import Phaser from 'phaser';
import type { FixtureDef } from '../types';
import { shade } from '../art/color';
import { bakeTexture, panel, poly } from '../art/draw';
import { DEPTH } from '../depth';

export function fixtureTextureKey(id: string): string {
  return `fixture:${id}`;
}

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

export class FixtureUnit {
  readonly id: string;
  readonly def: FixtureDef;
  readonly sprite: Phaser.GameObjects.Image;
  readonly x: number;
  readonly y: number;
  integrity: number;
  readonly maxIntegrity: number;
  expiresAt: number;
  nextSupplyAt = 0;
  alive = true;
  invested: number;

  constructor(scene: Phaser.Scene, id: string, def: FixtureDef, x: number, y: number, now: number) {
    this.id = id;
    this.def = def;
    this.x = x;
    this.y = y;
    this.maxIntegrity = def.integrity;
    this.integrity = def.integrity;
    this.expiresAt = def.durationMs > 0 ? now + def.durationMs : Infinity;
    this.nextSupplyAt = def.supplyTickMs ? now + def.supplyTickMs : Infinity;
    this.invested = def.cost;
    this.sprite = scene.add.image(x, y, fixtureTextureKey(def.id)).setDepth(DEPTH.fixture);
  }

  /** 0..1 remaining life, whichever of integrity or duration is shorter. */
  condition(now: number): number {
    const byIntegrity = this.maxIntegrity > 0 ? this.integrity / this.maxIntegrity : 1;
    const byTime =
      this.expiresAt === Infinity ? 1 : Math.max(0, (this.expiresAt - now) / this.def.durationMs);
    return Math.min(byIntegrity, byTime);
  }

  damage(amount: number): void {
    if (this.maxIntegrity <= 0) return;
    this.integrity -= amount;
    if (this.integrity <= 0) this.alive = false;
  }

  get sellValue(): number {
    return Math.floor(this.invested * 0.6);
  }

  destroy(): void {
    this.sprite.destroy();
  }
}
