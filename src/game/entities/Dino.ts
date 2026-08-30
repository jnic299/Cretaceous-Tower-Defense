import Phaser from 'phaser';
import type { SpeciesDef, SpeciesId, TierDef, TierId } from '../types';
import type { PathRuntime } from '../systems/MapGeometry';
import { DINO_FRAMES, DINO_RENDER_SCALE, DINO_SUPERSAMPLE, dinoShadowKey, dinoTextureKey } from '../art/dinoArt';
import { effectiveArmor, scaledBounty, scaledHp, scaledObjectiveDamage, scaledSpeed } from '../systems/combatMath';
import { DEPTH } from '../depth';

/** How far a dinosaur walks before advancing one animation frame. */
const STRIDE_DIVISOR = 5.5;

export class Dino {
  readonly sprite: Phaser.GameObjects.Sprite;
  readonly shadow: Phaser.GameObjects.Image;

  speciesId!: SpeciesId;
  tierId!: TierId;
  species!: SpeciesDef;
  tier!: TierDef;

  hp = 1;
  maxHp = 1;
  armor = 0;
  baseSpeed = 0;
  bounty = 0;
  objectiveDamage = 0;
  isBoss = false;

  path!: PathRuntime;
  progress = 0;
  laneOffset = 0;
  x = 0;
  y = 0;
  angle = 0;

  alive = false;
  /** Distance walked, drives the walk cycle so slows visibly slow the gait. */
  private strideDistance = 0;

  // Status effects.
  slowFactor = 1;
  slowUntil = 0;
  stunUntil = 0;
  burnDps = 0;
  burnUntil = 0;
  private burnAccumulator = 0;
  private sprintUntil = 0;
  private nextSprintAt = 0;
  /** Set while the animal is distracted by a decoy beacon. */
  heldUntil = 0;
  heldBy: { x: number; y: number; damage(amount: number): void } | null = null;
  /** Herd trait: speed bonus granted by nearby callers. */
  herdBonus = 1;

  private hitFlashUntil = 0;

  constructor(scene: Phaser.Scene) {
    this.shadow = scene.add.image(0, 0, dinoShadowKey()).setDepth(DEPTH.shadow).setVisible(false);
    this.sprite = scene.add.sprite(0, 0, dinoTextureKey('compsognathus', 'green', 0)).setDepth(DEPTH.dino).setVisible(false);
  }

  spawn(
    species: SpeciesDef,
    tier: TierDef,
    path: PathRuntime,
    laneOffset: number,
    speedMultiplier: number,
    now: number,
  ): void {
    this.speciesId = species.id;
    this.tierId = tier.id;
    this.species = species;
    this.tier = tier;
    this.path = path;
    this.laneOffset = laneOffset;

    this.maxHp = scaledHp(species, tier);
    this.hp = this.maxHp;
    this.armor = effectiveArmor(species, tier);
    this.baseSpeed = scaledSpeed(species, tier) * speedMultiplier;
    this.bounty = scaledBounty(species, tier);
    this.objectiveDamage = scaledObjectiveDamage(species, tier);
    this.isBoss = species.traits.includes('boss');

    this.progress = 0;
    this.strideDistance = 0;
    this.alive = true;
    this.slowFactor = 1;
    this.slowUntil = 0;
    this.stunUntil = 0;
    this.burnDps = 0;
    this.burnUntil = 0;
    this.burnAccumulator = 0;
    this.heldUntil = 0;
    this.heldBy = null;
    this.herdBonus = 1;
    this.hitFlashUntil = 0;
    this.nextSprintAt = now + (species.sprintIntervalMs ?? 0) * (0.4 + Math.random() * 0.6);
    this.sprintUntil = 0;

    const scale = tier.scaleMultiplier / DINO_SUPERSAMPLE;
    this.sprite
      .setTexture(dinoTextureKey(species.id, tier.id, 0))
      .setScale(scale)
      .setVisible(true)
      .setActive(true)
      .setAlpha(1)
      .clearTint()
      .setDepth(this.isBoss ? DEPTH.dino + 2 : DEPTH.dino);

    this.shadow
      .setVisible(true)
      .setActive(true)
      .setAlpha(0.3)
      .setScale(
        (species.body.length / 90) * tier.scaleMultiplier * DINO_RENDER_SCALE,
        (species.body.length / 130) * tier.scaleMultiplier * DINO_RENDER_SCALE,
      );
  }

  get speed(): number {
    return this.baseSpeed;
  }

  /** On-screen nose-to-tail length, used to size bars and effects. */
  get worldLength(): number {
    return this.species.body.length * DINO_RENDER_SCALE * this.tier.scaleMultiplier;
  }

  /** Movement speed after slows, sprints, herd calls and rally. */
  currentSpeed(now: number): number {
    if (now < this.stunUntil) return 0;
    if (now < this.heldUntil) return 0;
    let s = this.baseSpeed * this.herdBonus;
    if (now < this.slowUntil) s *= this.slowFactor;
    if (now < this.sprintUntil) s *= this.species.sprintMultiplier ?? 1;
    if (this.species.traits.includes('rally')) {
      // Speeds up as it loses health, to a maximum of +35%.
      s *= 1 + (1 - this.hp / this.maxHp) * 0.35;
    }
    return s;
  }

  applySlow(factor: number, durationMs: number, now: number): void {
    if (this.species.traits.includes('steadfast')) {
      factor = 1 - (1 - factor) * 0.45;
      durationMs *= 0.6;
    }
    // Strongest slow wins; refresh the timer either way.
    if (factor <= this.slowFactor || now > this.slowUntil) this.slowFactor = factor;
    this.slowUntil = Math.max(this.slowUntil, now + durationMs);
  }

  applyStun(durationMs: number, now: number): void {
    if (this.species.traits.includes('steadfast')) durationMs *= 0.5;
    if (this.isBoss) durationMs *= 0.55;
    this.stunUntil = Math.max(this.stunUntil, now + durationMs);
  }

  applyBurn(dps: number, durationMs: number, now: number): void {
    this.burnDps = Math.max(this.burnDps, dps);
    this.burnUntil = Math.max(this.burnUntil, now + durationMs);
  }

  flashHit(now: number): void {
    this.hitFlashUntil = now + 90;
    this.sprite.setTintFill(0xffffff);
  }

  /** Advances position, animation and status timers. Returns true if it reached the objective. */
  update(now: number, deltaMs: number): boolean {
    if (!this.alive) return false;

    if (this.hitFlashUntil && now > this.hitFlashUntil) {
      this.hitFlashUntil = 0;
      this.sprite.clearTint();
    }

    // Sprint cycling for species that carry the trait.
    if (this.species.sprintIntervalMs && now > this.nextSprintAt) {
      this.sprintUntil = now + (this.species.sprintDurationMs ?? 600);
      this.nextSprintAt = now + this.species.sprintIntervalMs;
    }

    const speed = this.currentSpeed(now);
    const step = (speed * deltaMs) / 1000;
    this.progress += step;
    this.strideDistance += step;

    const sample = this.path.def.waypoints.length
      ? this.samplePath()
      : { x: this.x, y: this.y, angle: this.angle };

    this.x = sample.x;
    this.y = sample.y;
    this.angle = sample.angle;

    const s = this.sprite;
    s.x = this.x;
    s.y = this.y;
    s.rotation = this.angle;

    this.shadow.x = this.x + 5;
    this.shadow.y = this.y + 6;
    this.shadow.rotation = this.angle;

    if (speed > 0.01) {
      const frame = Math.floor(this.strideDistance / (STRIDE_DIVISOR * this.tier.scaleMultiplier)) % DINO_FRAMES;
      const key = dinoTextureKey(this.speciesId, this.tierId, frame);
      if (s.texture.key !== key) s.setTexture(key);
    }

    return this.progress >= this.path.length;
  }

  /** Applies burn ticks. Burn deliberately ignores armour. */
  tickBurn(now: number, deltaMs: number): number {
    if (now > this.burnUntil || this.burnDps <= 0) return 0;
    this.burnAccumulator += (this.burnDps * deltaMs) / 1000;
    if (this.burnAccumulator < 1) return 0;
    const dealt = Math.floor(this.burnAccumulator);
    this.burnAccumulator -= dealt;
    return dealt;
  }

  private samplePath(): { x: number; y: number; angle: number } {
    const pts = this.path.points;
    const cum = this.path.cumulative;
    const d = Math.min(this.progress, this.path.length);

    let lo = 0;
    let hi = cum.length - 1;
    while (lo < hi - 1) {
      const mid = (lo + hi) >> 1;
      if (cum[mid] <= d) lo = mid;
      else hi = mid;
    }
    const segLen = cum[hi] - cum[lo] || 1;
    const t = (d - cum[lo]) / segLen;
    const p0 = pts[lo];
    const p1 = pts[hi];
    const angle = Math.atan2(p1.y - p0.y, p1.x - p0.x);
    const nx = -Math.sin(angle);
    const ny = Math.cos(angle);
    return {
      x: p0.x + (p1.x - p0.x) * t + nx * this.laneOffset,
      y: p0.y + (p1.y - p0.y) * t + ny * this.laneOffset,
      angle,
    };
  }

  hide(): void {
    this.alive = false;
    this.sprite.setVisible(false).setActive(false);
    this.shadow.setVisible(false).setActive(false);
  }

  destroy(): void {
    this.sprite.destroy();
    this.shadow.destroy();
  }
}
