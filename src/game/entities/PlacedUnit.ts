import Phaser from 'phaser';
import type { AttackSpec, DefenderDef, DefenderLevel, HeroDef, TargetMode } from '../types';
import type { Dino } from './Dino';
import { unitBaseKey, unitTopKey } from '../art/unitArt';
import { shotIntervalMs } from '../systems/combatMath';
import { DEPTH } from '../depth';
import { angleDelta } from '../../utils/geometry';

/** How fast a unit's weapon swings onto a new target, in radians/sec. */
const TURN_RATE = 9;

export interface UnitBuffs {
  fireRate: number;
  damage: number;
  range: number;
}

const NO_BUFF: UnitBuffs = { fireRate: 1, damage: 1, range: 1 };

export abstract class PlacedUnit {
  readonly id: string;
  readonly base: Phaser.GameObjects.Image;
  readonly top: Phaser.GameObjects.Image;
  x: number;
  y: number;
  level = 0;
  kills = 0;
  damageDealt = 0;
  nextShotAt = 0;
  facing = 0;
  buffs: UnitBuffs = { ...NO_BUFF };
  /** Total supply sunk into this unit, used for the sell refund. */
  invested = 0;
  /** Held between frames so the weapon tracks smoothly rather than snapping. */
  target: Dino | null = null;

  protected constructor(scene: Phaser.Scene, id: string, artId: string, x: number, y: number, depthBias = 0) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.base = scene.add.image(x, y, unitBaseKey(artId, 0)).setDepth(DEPTH.unitBase + depthBias);
    this.top = scene.add.image(x, y, unitTopKey(artId, 0)).setDepth(DEPTH.unitTop + depthBias);
  }

  abstract get range(): number;
  abstract get damage(): number;
  abstract get fireRate(): number;
  abstract get attack(): AttackSpec;
  abstract get isMachine(): boolean;

  get effectiveRange(): number {
    return this.range * this.buffs.range;
  }

  get effectiveDamage(): number {
    return this.damage * this.buffs.damage;
  }

  get cooldownMs(): number {
    return shotIntervalMs(this.fireRate, this.buffs.fireRate);
  }

  get dps(): number {
    return this.effectiveDamage * this.fireRate * this.buffs.fireRate;
  }

  /** Rotates the weapon toward a world point; returns true once roughly on target. */
  aimAt(tx: number, ty: number, deltaMs: number): boolean {
    const desired = Math.atan2(ty - this.y, tx - this.x);
    const delta = angleDelta(this.facing, desired);
    const maxStep = (TURN_RATE * deltaMs) / 1000;
    if (Math.abs(delta) <= maxStep) {
      this.facing = desired;
    } else {
      this.facing += Math.sign(delta) * maxStep;
    }
    this.top.rotation = this.facing;
    return Math.abs(angleDelta(this.facing, desired)) < 0.22;
  }

  faceInstantly(tx: number, ty: number): void {
    this.facing = Math.atan2(ty - this.y, tx - this.x);
    this.top.rotation = this.facing;
  }

  /** Small recoil kick, applied every time the unit fires. */
  recoil(scene: Phaser.Scene, amount = 3): void {
    const ox = this.x - Math.cos(this.facing) * amount;
    const oy = this.y - Math.sin(this.facing) * amount;
    this.top.setPosition(ox, oy);
    scene.tweens.add({
      targets: this.top,
      x: this.x,
      y: this.y,
      duration: 110,
      ease: 'Quad.easeOut',
    });
  }

  moveTo(x: number, y: number): void {
    this.x = x;
    this.y = y;
    this.base.setPosition(x, y);
    this.top.setPosition(x, y);
  }

  setHighlight(on: boolean): void {
    this.top.setTint(on ? 0xdff0ff : 0xffffff);
    if (!on) this.top.clearTint();
  }

  destroy(): void {
    this.base.destroy();
    this.top.destroy();
  }
}

export class DefenderUnit extends PlacedUnit {
  readonly def: DefenderDef;
  targetMode: TargetMode;

  constructor(scene: Phaser.Scene, id: string, def: DefenderDef, x: number, y: number) {
    super(scene, id, def.id, x, y);
    this.def = def;
    this.targetMode = def.defaultTargeting;
    this.invested = def.levels[0].cost;
    this.facing = -Math.PI / 2;
    this.top.rotation = this.facing;
  }

  get spec(): DefenderLevel {
    return this.def.levels[this.level];
  }

  override get range(): number {
    return this.spec.range;
  }

  override get damage(): number {
    return this.spec.damage;
  }

  override get fireRate(): number {
    return this.spec.fireRate;
  }

  override get attack(): AttackSpec {
    return this.spec.attack;
  }

  override get isMachine(): boolean {
    return this.def.category === 'turret';
  }

  get canUpgrade(): boolean {
    return this.level < this.def.levels.length - 1;
  }

  get upgradeCost(): number | null {
    return this.canUpgrade ? this.def.levels[this.level + 1].cost : null;
  }

  applyUpgrade(): void {
    if (!this.canUpgrade) return;
    this.invested += this.def.levels[this.level + 1].cost;
    this.level += 1;
    this.base.setTexture(unitBaseKey(this.def.id, this.level));
    this.top.setTexture(unitTopKey(this.def.id, this.level));
  }

  get sellValue(): number {
    return Math.floor(this.invested * 0.7);
  }
}

export class HeroUnit extends PlacedUnit {
  readonly def: HeroDef;
  targetMode: TargetMode;
  abilityReadyAt = 0;
  repositionReadyAt = 0;
  nextSecondaryShotAt = 0;

  constructor(scene: Phaser.Scene, id: string, def: HeroDef, x: number, y: number) {
    super(scene, id, def.id, x, y, 2);
    this.def = def;
    this.targetMode = def.defaultTargeting;
    this.invested = def.deployCost;
    this.facing = -Math.PI / 2;
    this.top.rotation = this.facing;
    this.base.setDepth(DEPTH.hero - 1);
    this.top.setDepth(DEPTH.hero);
  }

  override get range(): number {
    return this.def.range;
  }

  override get damage(): number {
    return this.def.damage;
  }

  override get fireRate(): number {
    return this.def.fireRate;
  }

  override get attack(): AttackSpec {
    return this.def.attack;
  }

  override get isMachine(): boolean {
    return this.def.art.chassis !== 'human';
  }

  abilityProgress(now: number): number {
    const remaining = this.abilityReadyAt - now;
    if (remaining <= 0) return 1;
    return 1 - remaining / this.def.ability.cooldownMs;
  }

  repositionProgress(now: number): number {
    const remaining = this.repositionReadyAt - now;
    if (remaining <= 0) return 1;
    return 1 - remaining / this.def.repositionCooldownMs;
  }
}
