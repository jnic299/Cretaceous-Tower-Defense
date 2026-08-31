import type Phaser from 'phaser';
import type { FixtureDef } from '../types';
import { fixtureTextureKey } from '../art/keys';
import { DEPTH } from '../depth';

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
