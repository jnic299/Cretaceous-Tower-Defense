import Phaser from 'phaser';
import type { BurnSpec, DamageType, SlowSpec, StunSpec } from '../types';
import type { Dino } from '../entities/Dino';
import type { SpatialGrid } from './SpatialGrid';
import { DEPTH } from '../depth';

export interface ProjectileSpawn {
  x: number;
  y: number;
  angle: number;
  speed: number;
  maxDistance: number;
  texture: string;
  damage: number;
  damageType: DamageType;
  armorPierce?: number;
  splashRadius?: number;
  splashFalloff?: number;
  /** Extra enemies the shot passes through. */
  pierce?: number;
  burn?: BurnSpec;
  slow?: SlowSpec;
  stun?: StunSpec;
  knockback?: number;
  /** `lob` shells detonate at a fixed ground point instead of on contact. */
  kind: 'linear' | 'lob';
  targetX?: number;
  targetY?: number;
  scale?: number;
  tint?: number;
  sourceId: string;
  spin?: boolean;
}

export interface ProjectileImpactHandler {
  onDirectHit(dino: Dino, p: Projectile): void;
  onDetonate(x: number, y: number, p: Projectile): void;
}

export class Projectile {
  sprite!: Phaser.GameObjects.Image;
  active = false;
  x = 0;
  y = 0;
  vx = 0;
  vy = 0;
  travelled = 0;
  maxDistance = 0;
  damage = 0;
  damageType: DamageType = 'kinetic';
  armorPierce = 0;
  splashRadius = 0;
  splashFalloff = 0.45;
  pierce = 0;
  burn?: BurnSpec;
  slow?: SlowSpec;
  stun?: StunSpec;
  knockback = 0;
  kind: 'linear' | 'lob' = 'linear';
  targetX = 0;
  targetY = 0;
  sourceId = '';
  spin = false;
  hitRadius = 12;
  private hits = new Set<Dino>();

  reset(): void {
    this.hits.clear();
  }

  hasHit(d: Dino): boolean {
    return this.hits.has(d);
  }

  markHit(d: Dino): void {
    this.hits.add(d);
  }
}

/**
 * Pooled travelling shots. Linear rounds sweep for contact each step (so fast
 * projectiles cannot tunnel past a small animal); lobbed shells fly to a fixed
 * point and detonate there.
 */
export class ProjectileSystem {
  private pool: Projectile[] = [];
  private active: Projectile[] = [];
  private scratch: Dino[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly grid: SpatialGrid,
    private readonly handler: ProjectileImpactHandler,
  ) {}

  get activeCount(): number {
    return this.active.length;
  }

  spawn(config: ProjectileSpawn): void {
    const p = this.pool.pop() ?? this.create();
    p.reset();
    p.active = true;
    p.x = config.x;
    p.y = config.y;
    p.kind = config.kind;
    p.travelled = 0;
    p.maxDistance = config.maxDistance;
    p.damage = config.damage;
    p.damageType = config.damageType;
    p.armorPierce = config.armorPierce ?? 0;
    p.splashRadius = config.splashRadius ?? 0;
    p.splashFalloff = config.splashFalloff ?? 0.45;
    p.pierce = config.pierce ?? 0;
    p.burn = config.burn;
    p.slow = config.slow;
    p.stun = config.stun;
    p.knockback = config.knockback ?? 0;
    p.sourceId = config.sourceId;
    p.spin = config.spin ?? false;
    p.hitRadius = config.splashRadius && config.kind === 'linear' ? 14 : 13;

    if (config.kind === 'lob') {
      p.targetX = config.targetX ?? config.x;
      p.targetY = config.targetY ?? config.y;
      const dx = p.targetX - p.x;
      const dy = p.targetY - p.y;
      const dist = Math.hypot(dx, dy) || 1;
      p.vx = (dx / dist) * config.speed;
      p.vy = (dy / dist) * config.speed;
      p.maxDistance = dist;
    } else {
      p.vx = Math.cos(config.angle) * config.speed;
      p.vy = Math.sin(config.angle) * config.speed;
    }

    p.sprite
      .setTexture(config.texture)
      .setPosition(p.x, p.y)
      .setRotation(config.angle)
      .setScale(config.scale ?? 1)
      .setVisible(true)
      .setActive(true);
    if (config.tint !== undefined) p.sprite.setTint(config.tint);
    else p.sprite.clearTint();

    this.active.push(p);
  }

  private create(): Projectile {
    const p = new Projectile();
    p.sprite = this.scene.add.image(0, 0, 'proj:bullet').setDepth(DEPTH.projectile).setVisible(false);
    return p;
  }

  update(deltaMs: number): void {
    const dt = deltaMs / 1000;
    for (let i = this.active.length - 1; i >= 0; i--) {
      const p = this.active[i];
      const stepX = p.vx * dt;
      const stepY = p.vy * dt;
      const stepLen = Math.hypot(stepX, stepY);
      const prevX = p.x;
      const prevY = p.y;
      p.x += stepX;
      p.y += stepY;
      p.travelled += stepLen;
      p.sprite.setPosition(p.x, p.y);
      if (p.spin) p.sprite.rotation += deltaMs * 0.02;

      let done = false;

      if (p.kind === 'lob') {
        if (p.travelled >= p.maxDistance) {
          this.handler.onDetonate(p.targetX, p.targetY, p);
          done = true;
        }
      } else {
        // Sweep the step so fast rounds cannot skip past a target.
        const samples = Math.max(1, Math.ceil(stepLen / 16));
        for (let s = 1; s <= samples && !done; s++) {
          const t = s / samples;
          const sx = prevX + stepX * t;
          const sy = prevY + stepY * t;
          const near = this.grid.queryCircle(sx, sy, p.hitRadius, this.scratch);
          for (const d of near) {
            if (p.hasHit(d) || !d.alive) continue;
            p.markHit(d);
            this.handler.onDirectHit(d, p);
            if (p.splashRadius > 0) {
              this.handler.onDetonate(sx, sy, p);
              done = true;
              break;
            }
            if (p.pierce > 0) {
              p.pierce -= 1;
            } else {
              done = true;
              break;
            }
          }
        }
        if (!done && p.travelled >= p.maxDistance) {
          if (p.splashRadius > 0) this.handler.onDetonate(p.x, p.y, p);
          done = true;
        }
      }

      if (done) {
        this.release(p, i);
      }
    }
  }

  private release(p: Projectile, index: number): void {
    p.active = false;
    p.sprite.setVisible(false).setActive(false);
    this.active.splice(index, 1);
    this.pool.push(p);
  }

  clear(): void {
    for (const p of this.active) {
      p.active = false;
      p.sprite.setVisible(false).setActive(false);
      this.pool.push(p);
    }
    this.active.length = 0;
  }

  destroy(): void {
    for (const p of [...this.active, ...this.pool]) p.sprite.destroy();
    this.active.length = 0;
    this.pool.length = 0;
  }
}
