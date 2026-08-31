import type Phaser from 'phaser';
import type { AttackSpec, DamageType, SlowSpec, StunSpec, BurnSpec } from '../types';
import type { Dino } from '../entities/Dino';
import type { DefenderUnit, HeroUnit, PlacedUnit } from '../entities/PlacedUnit';
import type { FixtureUnit } from '../entities/Fixture';
import type { MapGeometry } from './MapGeometry';
import type { SpatialGrid } from './SpatialGrid';
import type { EffectsSystem } from './EffectsSystem';
import type { Projectile, ProjectileSystem } from './ProjectileSystem';
import { applyArmor, splashDamageAt } from './combatMath';
import { selectTarget } from './targeting';
import { FX } from '../art/keys';
import type { AudioManager } from '../../audio/AudioManager';

const PROJECTILE_TEXTURES: Record<string, string> = {
  dart: FX.dart,
  spike: FX.spike,
  bullet: FX.bullet,
  arc: FX.arc,
  grenade: FX.grenade,
  shell: FX.shell,
  slug: FX.slug,
  frost: FX.frost,
  rifle: FX.bullet,
  rail: FX.slug,
  flame: FX.flame,
};

const BEAM_COLORS: Record<DamageType, number> = {
  kinetic: 0xffe9a8,
  piercing: 0xdfefff,
  fire: 0xff8a3c,
  shock: 0x9be8ff,
  explosive: 0xffc44d,
};

export interface DamageOptions {
  armorPierce?: number;
  burn?: BurnSpec;
  slow?: SlowSpec;
  stun?: StunSpec;
  knockback?: number;
  /** Suppresses the floating number for tiny repeated ticks. */
  quiet?: boolean;
}

export interface CombatHooks {
  onKill(dino: Dino, source: PlacedUnit | null): void;
}

export interface CombatDeps {
  scene: Phaser.Scene;
  geometry: MapGeometry;
  grid: SpatialGrid;
  effects: EffectsSystem;
  audio: AudioManager;
  hooks: CombatHooks;
}

/** How often auras and herd calls are recomputed, in ms. */
const AURA_INTERVAL = 400;

/**
 * Resolves every attack pattern, applies damage and status, and maintains the
 * aura/herd passes. Systems above it only ever say "this unit wants to fire";
 * everything about *how* a weapon behaves lives here.
 */
export class CombatSystem {
  private scratch: Dino[] = [];
  private chainScratch: Dino[] = [];
  private nextAuraAt = 0;
  private auraDirty = true;

  dinos: Dino[] = [];
  defenders: DefenderUnit[] = [];
  fixtures: FixtureUnit[] = [];
  hero: HeroUnit | null = null;

  private projectiles!: ProjectileSystem;
  /**
   * Simulation time for the frame in progress. Projectile impacts and hero
   * detonations resolve after `update` has returned, so they read this rather
   * than reaching for a wall clock.
   */
  private now = 0;

  constructor(private readonly deps: CombatDeps) {}

  /**
   * The projectile pool needs this system as its impact handler, and this
   * system needs the pool to launch shots, so the link is made after both
   * exist rather than through a constructor cycle.
   */
  attachProjectiles(projectiles: ProjectileSystem): void {
    this.projectiles = projectiles;
  }

  markPlacementsChanged(): void {
    this.auraDirty = true;
  }

  /* ------------------------------------------------------------------ */
  /* Frame update                                                        */
  /* ------------------------------------------------------------------ */

  update(now: number, deltaMs: number): void {
    this.now = now;
    if (this.auraDirty || now >= this.nextAuraAt) {
      this.recomputeAuras();
      this.recomputeHerds();
      this.nextAuraAt = now + AURA_INTERVAL;
      this.auraDirty = false;
    }

    for (const unit of this.defenders) this.updateUnit(unit, now, deltaMs);
    if (this.hero) this.updateHero(this.hero, now, deltaMs);

    this.updateFixtures(now, deltaMs);
    this.tickBurns(now, deltaMs);
  }

  /* ------------------------------------------------------------------ */
  /* Auras                                                               */
  /* ------------------------------------------------------------------ */

  private recomputeAuras(): void {
    const all: PlacedUnit[] = this.hero ? [...this.defenders, this.hero] : [...this.defenders];
    for (const u of all) {
      u.buffs.fireRate = 1;
      u.buffs.damage = 1;
      u.buffs.range = 1;
    }

    const sources: { x: number; y: number; buff: NonNullable<AttackSpec['buff']> }[] = [];
    for (const unit of this.defenders) {
      const buff = unit.spec.attack.buff;
      if (buff) sources.push({ x: unit.x, y: unit.y, buff });
    }
    for (const fixture of this.fixtures) {
      if (fixture.alive && fixture.def.buff) {
        sources.push({ x: fixture.x, y: fixture.y, buff: fixture.def.buff });
      }
    }
    if (sources.length === 0) return;

    for (const u of all) {
      for (const src of sources) {
        if (src.x === u.x && src.y === u.y) continue;
        if (src.buff.targets === 'machines' && !u.isMachine) continue;
        const rSq = src.buff.radius * src.buff.radius;
        const dx = u.x - src.x;
        const dy = u.y - src.y;
        if (dx * dx + dy * dy > rSq) continue;
        u.buffs.fireRate *= src.buff.fireRateMultiplier;
        u.buffs.damage *= src.buff.damageMultiplier;
        u.buffs.range *= src.buff.rangeMultiplier;
      }
    }
  }

  private recomputeHerds(): void {
    let anyHerd = false;
    for (const d of this.dinos) {
      if (!d.alive) continue;
      d.herdBonus = 1;
      if (d.species.traits.includes('herd')) anyHerd = true;
    }
    if (!anyHerd) return;
    for (const caller of this.dinos) {
      if (!caller.alive || !caller.species.traits.includes('herd')) continue;
      const near = this.deps.grid.queryCircle(caller.x, caller.y, 150, this.scratch);
      for (const d of near) {
        if (d === caller) continue;
        d.herdBonus = Math.min(1.3, d.herdBonus * 1.14);
      }
    }
  }

  /* ------------------------------------------------------------------ */
  /* Firing                                                              */
  /* ------------------------------------------------------------------ */

  private acquire(unit: PlacedUnit, range: number, minRange: number, ignoreLos: boolean, mode: DefenderUnit['targetMode']): Dino | null {
    const near = this.deps.grid.queryCircle(unit.x, unit.y, range, this.scratch);
    if (near.length === 0) return null;
    const geometry = this.deps.geometry;
    return selectTarget(near, unit.x, unit.y, {
      mode,
      range,
      minRange,
      canSee: ignoreLos ? undefined : (x, y) => geometry.hasLineOfSight(unit.x, unit.y, x, y),
    });
  }

  private targetStillValid(unit: PlacedUnit, target: Dino | null, range: number, minRange: number, ignoreLos: boolean): boolean {
    if (!target || !target.alive) return false;
    const dSq = (target.x - unit.x) ** 2 + (target.y - unit.y) ** 2;
    if (dSq > range * range || dSq < minRange * minRange) return false;
    if (!ignoreLos && !this.deps.geometry.hasLineOfSight(unit.x, unit.y, target.x, target.y)) return false;
    return true;
  }

  private updateUnit(unit: DefenderUnit, now: number, deltaMs: number): void {
    const attack = unit.spec.attack;
    const range = unit.effectiveRange;
    const minRange = attack.minRange ?? 0;
    const ignoreLos = attack.pattern === 'lob' || attack.pattern === 'radial';

    if (!this.targetStillValid(unit, unit.target, range, minRange, ignoreLos)) {
      unit.target = this.acquire(unit, range, minRange, ignoreLos, unit.targetMode);
    }

    const target = unit.target;
    if (!target) {
      // Idle sweep so units never look frozen between waves.
      unit.top.rotation = unit.facing + Math.sin(now / 900 + unit.x) * 0.05;
      return;
    }

    const aimed = unit.aimAt(target.x, target.y, deltaMs);
    if (now < unit.nextShotAt) return;
    if (!aimed && attack.pattern !== 'radial') return;

    unit.nextShotAt = now + unit.cooldownMs;
    this.fire(unit, target, attack, unit.effectiveDamage, range);
  }

  private updateHero(hero: HeroUnit, now: number, deltaMs: number): void {
    const attack = hero.def.attack;
    const range = hero.effectiveRange;
    const ignoreLos = attack.pattern === 'lob';

    if (!this.targetStillValid(hero, hero.target, range, attack.minRange ?? 0, ignoreLos)) {
      hero.target = this.acquire(hero, range, attack.minRange ?? 0, ignoreLos, hero.targetMode);
    }

    const target = hero.target;
    if (target) {
      const aimed = hero.aimAt(target.x, target.y, deltaMs);
      if (aimed && now >= hero.nextShotAt) {
        hero.nextShotAt = now + hero.cooldownMs;
        this.fire(hero, target, attack, hero.effectiveDamage, range);
      }
    } else {
      hero.top.rotation = hero.facing + Math.sin(now / 1100) * 0.04;
    }

    // Secondary weapon fires independently at whatever is closest.
    const secondary = hero.def.secondary;
    if (secondary && now >= hero.nextSecondaryShotAt) {
      const close = this.acquire(hero, secondary.range * hero.buffs.range, 0, false, 'closest');
      if (close) {
        hero.nextSecondaryShotAt = now + 1000 / (secondary.fireRate * hero.buffs.fireRate);
        this.fire(hero, close, secondary.attack, secondary.damage * hero.buffs.damage, secondary.range, true);
      }
    }
  }

  /** Predicts where a moving target will be when the shot arrives. */
  private lead(unit: PlacedUnit, target: Dino, projectileSpeed: number): { x: number; y: number } {
    if (projectileSpeed <= 0) return { x: target.x, y: target.y };
    const dist = Math.hypot(target.x - unit.x, target.y - unit.y);
    const t = dist / projectileSpeed;
    const speed = target.currentSpeed(this.now);
    return {
      x: target.x + Math.cos(target.angle) * speed * t,
      y: target.y + Math.sin(target.angle) * speed * t,
    };
  }

  private fire(
    unit: PlacedUnit,
    target: Dino,
    attack: AttackSpec,
    damage: number,
    range: number,
    isSecondary = false,
  ): void {
    const { effects, audio } = this.deps;
    const projectiles = this.projectiles;
    const texture = PROJECTILE_TEXTURES[attack.visual ?? 'bullet'] ?? FX.bullet;

    switch (attack.pattern) {
      case 'projectile': {
        const speed = attack.projectileSpeed ?? 600;
        const lead = this.lead(unit, target, speed);
        const angle = Math.atan2(lead.y - unit.y, lead.x - unit.x);
        const muzzleX = unit.x + Math.cos(angle) * 20;
        const muzzleY = unit.y + Math.sin(angle) * 20;
        projectiles.spawn({
          x: muzzleX,
          y: muzzleY,
          angle,
          speed,
          maxDistance: range * 1.25,
          texture,
          damage,
          damageType: attack.damageType,
          armorPierce: attack.armorPierce,
          splashRadius: attack.splashRadius,
          splashFalloff: attack.splashFalloff,
          pierce: attack.pierceCount,
          burn: attack.burn,
          slow: attack.slow,
          stun: attack.stun,
          knockback: attack.knockback,
          kind: 'linear',
          sourceId: unit.id,
        });
        effects.muzzleFlash(muzzleX, muzzleY, angle, isSecondary ? 0.45 : 0.75);
        if (!isSecondary) unit.recoil(this.deps.scene, 2.5);
        audio.play(isSecondary ? 'shotLight' : 'shot', { volume: isSecondary ? 0.25 : 0.5 });
        break;
      }

      case 'radial': {
        const count = attack.spikes ?? 10;
        const speed = attack.projectileSpeed ?? 460;
        const base = Math.random() * Math.PI * 2;
        for (let i = 0; i < count; i++) {
          const angle = base + (i / count) * Math.PI * 2;
          projectiles.spawn({
            x: unit.x + Math.cos(angle) * 14,
            y: unit.y + Math.sin(angle) * 14,
            angle,
            speed,
            maxDistance: range,
            texture,
            damage,
            damageType: attack.damageType,
            armorPierce: attack.armorPierce,
            slow: attack.slow,
            stun: attack.stun,
            kind: 'linear',
            sourceId: unit.id,
          });
        }
        effects.radialBurst(unit.x, unit.y, range, attack.visual === 'frost' ? 0xa8f0ff : 0xffe9a8);
        if (attack.visual === 'frost') effects.frostBurst(unit.x, unit.y);
        unit.recoil(this.deps.scene, 1.5);
        audio.play(attack.visual === 'frost' ? 'frost' : 'spikeRing', { volume: 0.45 });
        break;
      }

      case 'cone': {
        const angle = Math.atan2(target.y - unit.y, target.x - unit.x);
        const half = ((attack.coneAngle ?? 50) * Math.PI) / 360;
        const near = this.deps.grid.queryCircle(unit.x, unit.y, range, this.scratch);
        let struck = 0;
        for (const d of near) {
          const da = Math.atan2(d.y - unit.y, d.x - unit.x);
          let delta = Math.abs(da - angle) % (Math.PI * 2);
          if (delta > Math.PI) delta = Math.PI * 2 - delta;
          if (delta > half) continue;
          if (!this.deps.geometry.hasLineOfSight(unit.x, unit.y, d.x, d.y)) continue;
          this.applyDamage(d, damage, attack.damageType, { armorPierce: attack.armorPierce, burn: attack.burn, quiet: true }, unit);
          struck++;
        }
        effects.flameCone(unit.x, unit.y, angle, range, half * 2);
        if (struck > 0) audio.play('flame', { volume: 0.22 });
        break;
      }

      case 'hitscan': {
        const angle = Math.atan2(target.y - unit.y, target.x - unit.x);
        const muzzleX = unit.x + Math.cos(angle) * 24;
        const muzzleY = unit.y + Math.sin(angle) * 24;
        const color = BEAM_COLORS[attack.damageType];
        let endX = target.x;
        let endY = target.y;

        this.applyDamage(target, damage, attack.damageType, { armorPierce: attack.armorPierce, slow: attack.slow, stun: attack.stun }, unit);

        // Rounds that carry on through the line behind the first target.
        const extra = attack.pierceCount ?? 0;
        if (extra > 0) {
          const beyond = this.dinosAlongLine(unit.x, unit.y, angle, range, 18, extra + 1, target);
          for (const d of beyond) {
            this.applyDamage(d, damage * 0.85, attack.damageType, { armorPierce: attack.armorPierce }, unit);
            if (Math.hypot(d.x - unit.x, d.y - unit.y) > Math.hypot(endX - unit.x, endY - unit.y)) {
              endX = d.x;
              endY = d.y;
            }
          }
        }

        effects.beam(muzzleX, muzzleY, endX, endY, color, attack.visual === 'rail' ? 5 : 2.6);
        effects.muzzleFlash(muzzleX, muzzleY, angle, 1);
        effects.impact(target.x, target.y, attack.damageType);
        unit.recoil(this.deps.scene, 5);
        audio.play(attack.visual === 'rail' ? 'rail' : 'sniper', { volume: 0.55 });
        effects.shake(attack.visual === 'rail' ? 0.0018 : 0.0009, 90);
        break;
      }

      case 'chain': {
        const points: { x: number; y: number }[] = [{ x: unit.x, y: unit.y }];
        const hit = new Set<Dino>();
        let current = target;
        let dmg = damage;
        const jumps = attack.chainJumps ?? 2;
        const chainRange = attack.chainRange ?? 90;

        for (let i = 0; i <= jumps; i++) {
          points.push({ x: current.x, y: current.y });
          hit.add(current);
          this.applyDamage(current, dmg, attack.damageType, { armorPierce: attack.armorPierce, slow: attack.slow, stun: attack.stun }, unit);
          dmg *= 0.85;
          const near = this.deps.grid.queryCircle(current.x, current.y, chainRange, this.chainScratch);
          let next: Dino | null = null;
          let bestSq = Infinity;
          for (const d of near) {
            if (hit.has(d) || !d.alive) continue;
            const dSq = (d.x - current.x) ** 2 + (d.y - current.y) ** 2;
            if (dSq < bestSq) {
              bestSq = dSq;
              next = d;
            }
          }
          if (!next) break;
          current = next;
        }
        effects.lightning(points, BEAM_COLORS.shock);
        audio.play('tesla', { volume: 0.45 });
        break;
      }

      case 'lob': {
        const speed = attack.projectileSpeed ?? 340;
        const lead = this.lead(unit, target, speed);
        const angle = Math.atan2(lead.y - unit.y, lead.x - unit.x);
        projectiles.spawn({
          x: unit.x + Math.cos(angle) * 16,
          y: unit.y + Math.sin(angle) * 16,
          angle,
          speed,
          maxDistance: range * 1.3,
          texture,
          damage,
          damageType: attack.damageType,
          armorPierce: attack.armorPierce,
          splashRadius: attack.splashRadius ?? 60,
          splashFalloff: attack.splashFalloff,
          burn: attack.burn,
          slow: attack.slow,
          stun: attack.stun,
          knockback: attack.knockback,
          kind: 'lob',
          targetX: lead.x,
          targetY: lead.y,
          sourceId: unit.id,
          spin: true,
        });
        effects.muzzleFlash(unit.x + Math.cos(angle) * 20, unit.y + Math.sin(angle) * 20, angle, 1.1);
        unit.recoil(this.deps.scene, 4);
        audio.play('mortar', { volume: 0.45 });
        effects.shake(0.0012, 80);
        break;
      }

      case 'support':
      default:
        break;
    }
  }

  /** Dinosaurs within `width` of a ray, sorted by distance from the origin. */
  private dinosAlongLine(
    ox: number,
    oy: number,
    angle: number,
    length: number,
    width: number,
    limit: number,
    exclude: Dino,
  ): Dino[] {
    const midX = ox + (Math.cos(angle) * length) / 2;
    const midY = oy + (Math.sin(angle) * length) / 2;
    const near = this.deps.grid.queryCircle(midX, midY, length / 2 + width, this.chainScratch);
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    const found: { d: Dino; t: number }[] = [];
    for (const d of near) {
      if (d === exclude || !d.alive) continue;
      const t = (d.x - ox) * dx + (d.y - oy) * dy;
      if (t < 0 || t > length) continue;
      const perp = Math.abs((d.x - ox) * -dy + (d.y - oy) * dx);
      if (perp > width) continue;
      found.push({ d, t });
    }
    found.sort((a, b) => a.t - b.t);
    return found.slice(0, limit).map((f) => f.d);
  }

  /* ------------------------------------------------------------------ */
  /* Damage                                                              */
  /* ------------------------------------------------------------------ */

  applyDamage(
    dino: Dino,
    rawDamage: number,
    type: DamageType,
    options: DamageOptions,
    source: PlacedUnit | null,
  ): void {
    if (!dino.alive) return;
    const now = this.now;
    const dealt = applyArmor(rawDamage, dino.armor, options.armorPierce ?? 0);

    dino.hp -= dealt;
    dino.flashHit(now);
    if (source) source.damageDealt += dealt;

    if (options.burn) dino.applyBurn(options.burn.dps, options.burn.durationMs, now);
    if (options.slow && Math.random() < options.slow.chance) {
      dino.applySlow(options.slow.factor, options.slow.durationMs, now);
    }
    if (options.stun && Math.random() < options.stun.chance) {
      dino.applyStun(options.stun.durationMs, now);
    }
    if (options.knockback) {
      dino.progress = Math.max(0, dino.progress - options.knockback);
    }

    if (!options.quiet) {
      this.deps.effects.damageNumber(dino.x, dino.y, dealt, type, dealt >= 120);
    }

    if (dino.hp <= 0) this.kill(dino, source);
  }

  /** Burn ticks bypass armour entirely — that is Fred's answer to plating. */
  private tickBurns(now: number, deltaMs: number): void {
    for (const d of this.dinos) {
      if (!d.alive) continue;
      const burn = d.tickBurn(now, deltaMs);
      if (burn <= 0) continue;
      d.hp -= burn;
      if (Math.random() < 0.12) this.deps.effects.impact(d.x, d.y, 'fire');
      if (d.hp <= 0) this.kill(d, null);
    }
  }

  kill(dino: Dino, source: PlacedUnit | null): void {
    if (!dino.alive) return;
    dino.alive = false;
    if (source) source.kills += 1;
    this.deps.effects.death(dino.x, dino.y, dino.tier, dino.worldLength, dino.sprite);
    this.deps.audio.play(dino.isBoss ? 'bossDown' : 'dinoDown', { volume: dino.isBoss ? 0.7 : 0.28 });
    if (dino.isBoss) {
      this.deps.effects.explosion(dino.x, dino.y, 140, 0xffd166);
      this.deps.effects.shake(0.006, 320);
    }
    this.deps.hooks.onKill(dino, source);
  }

  detonate(
    x: number,
    y: number,
    radius: number,
    damage: number,
    falloff: number,
    type: DamageType,
    options: DamageOptions,
    source: PlacedUnit | null,
    now?: number,
  ): void {
    if (now !== undefined) this.now = now;
    const near = this.deps.grid.queryCircle(x, y, radius, this.chainScratch);
    for (const d of near) {
      const dist = Math.hypot(d.x - x, d.y - y);
      const amount = splashDamageAt(damage, dist, radius, falloff);
      if (amount <= 0) continue;
      this.applyDamage(d, amount, type, { ...options, quiet: near.length > 6 }, source);
    }
    this.deps.effects.explosion(x, y, radius, type === 'fire' ? 0xff8a3c : 0xffc44d);
    this.deps.audio.play('explosion', { volume: Math.min(0.6, 0.25 + radius / 400) });
  }

  /* ------------------------------------------------------------------ */
  /* Projectile callbacks                                                */
  /* ------------------------------------------------------------------ */

  onDirectHit = (dino: Dino, p: Projectile): void => {
    if (p.splashRadius > 0) return; // Splash rounds resolve in onDetonate.
    this.applyDamage(
      dino,
      p.damage,
      p.damageType,
      {
        armorPierce: p.armorPierce,
        burn: p.burn,
        slow: p.slow,
        stun: p.stun,
        knockback: p.knockback,
      },
      this.findSource(p.sourceId),
    );
    this.deps.effects.impact(dino.x, dino.y, p.damageType);
  };

  onDetonate = (x: number, y: number, p: Projectile): void => {
    if (p.splashRadius <= 0) return;
    this.detonate(
      x,
      y,
      p.splashRadius,
      p.damage,
      p.splashFalloff,
      p.damageType,
      { armorPierce: p.armorPierce, burn: p.burn, slow: p.slow, stun: p.stun, knockback: p.knockback },
      this.findSource(p.sourceId),
    );
  };

  private findSource(id: string): PlacedUnit | null {
    if (this.hero && this.hero.id === id) return this.hero;
    return this.defenders.find((d) => d.id === id) ?? null;
  }

  /* ------------------------------------------------------------------ */
  /* Fixtures                                                            */
  /* ------------------------------------------------------------------ */

  private updateFixtures(now: number, deltaMs: number): void {
    for (const fixture of this.fixtures) {
      if (!fixture.alive) continue;
      if (now > fixture.expiresAt) {
        fixture.alive = false;
        continue;
      }
      const near = this.deps.grid.queryCircle(fixture.x, fixture.y, fixture.def.radius, this.scratch);
      if (near.length === 0) continue;

      switch (fixture.def.kind) {
        case 'barricade': {
          for (const d of near) {
            if (fixture.def.slow) d.applySlow(fixture.def.slow.factor, 260, now);
            // Pushing through grinds the panels down.
            fixture.damage(((d.species.baseHp / 60 + 2) * deltaMs) / 1000);
          }
          if (!fixture.alive) this.deps.effects.explosion(fixture.x, fixture.y, 60, 0xb0b6bb);
          break;
        }
        case 'shockFence': {
          const dps = fixture.def.dps ?? 0;
          for (const d of near) {
            this.applyDamage(d, (dps * deltaMs) / 1000, 'shock', { quiet: true }, null);
            if (fixture.def.slow) d.applySlow(fixture.def.slow.factor, 260, now);
          }
          if (Math.random() < 0.08) {
            const d = near[0];
            this.deps.effects.lightning([{ x: fixture.x, y: fixture.y }, { x: d.x, y: d.y }]);
          }
          break;
        }
        case 'decoy': {
          for (const d of near) {
            if (d.species.traits.includes('steadfast')) continue;
            d.heldUntil = now + 160;
            d.heldBy = fixture;
            fixture.damage(((d.species.baseHp / 40 + 4) * deltaMs) / 1000);
          }
          if (!fixture.alive) {
            this.deps.effects.explosion(fixture.x, fixture.y, 70, 0xffe9a8);
            for (const d of near) d.heldUntil = 0;
          }
          break;
        }
        case 'supplyCache':
          break;
      }
    }
  }
}
