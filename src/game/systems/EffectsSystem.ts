import Phaser from 'phaser';
import type { DamageType, TierDef } from '../types';
import { FX } from '../art/fxArt';
import { DEPTH } from '../depth';

const DAMAGE_COLORS: Record<DamageType, string> = {
  kinetic: '#ffe9a8',
  piercing: '#e6f0ff',
  fire: '#ff9a3c',
  shock: '#9be8ff',
  explosive: '#ffc44d',
};

/**
 * All of the game's feedback in one place: muzzle flashes, impacts,
 * explosions, floating numbers and screen shake. Text objects and one-shot
 * sprites are pooled so a heavy wave never allocates mid-frame.
 */
export class EffectsSystem {
  private textPool: Phaser.GameObjects.Text[] = [];
  private activeText: Phaser.GameObjects.Text[] = [];
  private sparks!: Phaser.GameObjects.Particles.ParticleEmitter;
  private smoke!: Phaser.GameObjects.Particles.ParticleEmitter;
  private dust!: Phaser.GameObjects.Particles.ParticleEmitter;
  private flames!: Phaser.GameObjects.Particles.ParticleEmitter;
  private chunks!: Phaser.GameObjects.Particles.ParticleEmitter;
  private frost!: Phaser.GameObjects.Particles.ParticleEmitter;
  showDamageNumbers = true;
  screenShake = true;

  constructor(private readonly scene: Phaser.Scene) {
    this.sparks = scene.add.particles(0, 0, FX.spark, {
      lifespan: 340,
      speed: { min: 60, max: 220 },
      scale: { start: 0.85, end: 0 },
      alpha: { start: 1, end: 0 },
      blendMode: Phaser.BlendModes.ADD,
      emitting: false,
    });
    this.smoke = scene.add.particles(0, 0, FX.smoke, {
      lifespan: 700,
      speed: { min: 12, max: 60 },
      scale: { start: 0.5, end: 1.3 },
      alpha: { start: 0.5, end: 0 },
      emitting: false,
    });
    this.dust = scene.add.particles(0, 0, FX.dust, {
      lifespan: 620,
      speed: { min: 20, max: 90 },
      scale: { start: 0.5, end: 1.2 },
      alpha: { start: 0.7, end: 0 },
      emitting: false,
    });
    this.flames = scene.add.particles(0, 0, FX.flame, {
      lifespan: 420,
      speed: { min: 30, max: 120 },
      scale: { start: 0.75, end: 0.1 },
      alpha: { start: 0.95, end: 0 },
      blendMode: Phaser.BlendModes.ADD,
      emitting: false,
    });
    this.chunks = scene.add.particles(0, 0, FX.chunk, {
      lifespan: 620,
      speed: { min: 50, max: 190 },
      scale: { start: 1, end: 0.2 },
      alpha: { start: 1, end: 0 },
      rotate: { start: 0, end: 360 },
      gravityY: 220,
      emitting: false,
    });
    this.frost = scene.add.particles(0, 0, FX.snow, {
      lifespan: 560,
      speed: { min: 20, max: 90 },
      scale: { start: 0.9, end: 0 },
      alpha: { start: 0.9, end: 0 },
      emitting: false,
    });

    for (const e of [this.sparks, this.smoke, this.dust, this.flames, this.chunks, this.frost]) {
      e.setDepth(DEPTH.effect);
    }
  }

  /* ---- Weapons ------------------------------------------------------ */

  muzzleFlash(x: number, y: number, angle: number, scale = 1): void {
    const img = this.scene.add
      .image(x, y, FX.muzzle)
      .setDepth(DEPTH.effect)
      .setRotation(angle)
      .setScale(scale * 0.9)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.scene.tweens.add({
      targets: img,
      alpha: 0,
      scaleX: scale * 1.4,
      scaleY: scale * 0.6,
      duration: 90,
      onComplete: () => img.destroy(),
    });
  }

  /** Instant beam for hitscan weapons; fades over a couple of frames. */
  beam(x1: number, y1: number, x2: number, y2: number, color: number, width = 3, ms = 130): void {
    const g = this.scene.add.graphics().setDepth(DEPTH.effect).setBlendMode(Phaser.BlendModes.ADD);
    g.lineStyle(width + 3, color, 0.28);
    g.lineBetween(x1, y1, x2, y2);
    g.lineStyle(width, color, 0.95);
    g.lineBetween(x1, y1, x2, y2);
    g.lineStyle(Math.max(1, width * 0.4), 0xffffff, 1);
    g.lineBetween(x1, y1, x2, y2);
    this.scene.tweens.add({ targets: g, alpha: 0, duration: ms, onComplete: () => g.destroy() });
  }

  /** Jagged arc used by shock weapons and the Tesla coil's chain. */
  lightning(points: { x: number; y: number }[], color = 0x9be8ff): void {
    const g = this.scene.add.graphics().setDepth(DEPTH.effect).setBlendMode(Phaser.BlendModes.ADD);
    const draw = (width: number, col: number, alpha: number) => {
      g.lineStyle(width, col, alpha);
      g.beginPath();
      g.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        const a = points[i - 1];
        const b = points[i];
        const steps = 3;
        for (let s = 1; s <= steps; s++) {
          const t = s / steps;
          const jitter = s === steps ? 0 : 9;
          g.lineTo(
            a.x + (b.x - a.x) * t + (Math.random() - 0.5) * jitter,
            a.y + (b.y - a.y) * t + (Math.random() - 0.5) * jitter,
          );
        }
      }
      g.strokePath();
    };
    draw(7, color, 0.25);
    draw(3, color, 0.9);
    draw(1.4, 0xffffff, 1);
    this.scene.tweens.add({ targets: g, alpha: 0, duration: 170, onComplete: () => g.destroy() });
  }

  /** Flamethrower cone: a soft wedge plus a burst of fire particles. */
  flameCone(x: number, y: number, angle: number, range: number, spread: number): void {
    const g = this.scene.add.graphics().setDepth(DEPTH.effect).setBlendMode(Phaser.BlendModes.ADD);
    const half = spread / 2;
    for (let layer = 0; layer < 3; layer++) {
      const t = 1 - layer * 0.28;
      g.fillStyle(layer === 0 ? 0xff7a2a : layer === 1 ? 0xffb347 : 0xffe9a8, 0.16 + layer * 0.06);
      g.beginPath();
      g.moveTo(x, y);
      const steps = 8;
      for (let i = 0; i <= steps; i++) {
        const a = angle - half + (spread * i) / steps;
        g.lineTo(x + Math.cos(a) * range * t, y + Math.sin(a) * range * t);
      }
      g.closePath();
      g.fillPath();
    }
    this.scene.tweens.add({ targets: g, alpha: 0, duration: 130, onComplete: () => g.destroy() });

    this.flames.emitParticleAt(
      x + Math.cos(angle) * range * 0.45,
      y + Math.sin(angle) * range * 0.45,
      3,
    );
  }

  /** Ring of spikes leaving the Spike Gunner. */
  radialBurst(x: number, y: number, radius: number, color = 0xffe9a8): void {
    const ring = this.scene.add
      .image(x, y, FX.ring)
      .setDepth(DEPTH.effect)
      .setTint(color)
      .setScale(0.15)
      .setAlpha(0.85)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.scene.tweens.add({
      targets: ring,
      scale: (radius / 54) * 1.02,
      alpha: 0,
      duration: 320,
      ease: 'Cubic.easeOut',
      onComplete: () => ring.destroy(),
    });
  }

  /* ---- Impacts ------------------------------------------------------ */

  impact(x: number, y: number, type: DamageType): void {
    switch (type) {
      case 'fire':
        this.flames.emitParticleAt(x, y, 2);
        break;
      case 'shock':
        this.sparks.emitParticleAt(x, y, 4);
        break;
      case 'explosive':
        this.sparks.emitParticleAt(x, y, 5);
        this.smoke.emitParticleAt(x, y, 2);
        break;
      default:
        this.sparks.emitParticleAt(x, y, 3);
        this.dust.emitParticleAt(x, y, 1);
    }
  }

  frostBurst(x: number, y: number): void {
    this.frost.emitParticleAt(x, y, 4);
  }

  explosion(x: number, y: number, radius: number, tint = 0xffc44d): void {
    const ring = this.scene.add
      .image(x, y, FX.ring)
      .setDepth(DEPTH.effect)
      .setTint(tint)
      .setScale(0.1)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.scene.tweens.add({
      targets: ring,
      scale: radius / 54,
      alpha: 0,
      duration: 300,
      ease: 'Cubic.easeOut',
      onComplete: () => ring.destroy(),
    });

    const flash = this.scene.add
      .image(x, y, FX.glow)
      .setDepth(DEPTH.effect)
      .setTint(tint)
      .setScale(radius / 60)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.scene.tweens.add({
      targets: flash,
      alpha: 0,
      scale: (radius / 60) * 1.5,
      duration: 240,
      onComplete: () => flash.destroy(),
    });

    this.sparks.emitParticleAt(x, y, Math.min(18, 6 + radius / 8));
    this.smoke.emitParticleAt(x, y, Math.min(10, 3 + radius / 16));
    this.chunks.emitParticleAt(x, y, Math.min(10, 3 + radius / 18));
    this.shake(Math.min(0.006, radius / 22000), 160);
  }

  /** A dinosaur going down: dust, a couple of chunks, and a fading corpse. */
  death(x: number, y: number, tier: TierDef, size: number, sprite?: Phaser.GameObjects.Sprite): void {
    this.dust.emitParticleAt(x, y, Math.min(10, 3 + size / 14));
    this.sparks.emitParticleAt(x, y, 2);
    if (sprite) {
      const corpse = this.scene.add
        .sprite(x, y, sprite.texture.key)
        .setDepth(DEPTH.corpse)
        .setRotation(sprite.rotation)
        .setScale(sprite.scaleX, sprite.scaleY)
        .setTint(tier.color)
        .setAlpha(0.9);
      this.scene.tweens.add({
        targets: corpse,
        alpha: 0,
        scaleX: sprite.scaleX * 0.82,
        scaleY: sprite.scaleY * 0.82,
        rotation: corpse.rotation + (Math.random() > 0.5 ? 0.5 : -0.5),
        duration: 900,
        ease: 'Quad.easeIn',
        onComplete: () => corpse.destroy(),
      });
    }
  }

  /* ---- Text --------------------------------------------------------- */

  damageNumber(x: number, y: number, amount: number, type: DamageType, big = false): void {
    if (!this.showDamageNumbers || this.activeText.length > 26) return;
    const text = this.textPool.pop() ?? this.makeText();
    text
      .setText(String(Math.max(1, Math.round(amount))))
      .setPosition(x + (Math.random() - 0.5) * 12, y - 10)
      .setColor(DAMAGE_COLORS[type])
      .setFontSize(big ? 20 : 14)
      .setAlpha(1)
      .setScale(1)
      .setVisible(true);
    this.activeText.push(text);
    this.scene.tweens.add({
      targets: text,
      y: text.y - (big ? 34 : 24),
      alpha: 0,
      duration: big ? 780 : 560,
      ease: 'Quad.easeOut',
      onComplete: () => {
        text.setVisible(false);
        const i = this.activeText.indexOf(text);
        if (i >= 0) this.activeText.splice(i, 1);
        this.textPool.push(text);
      },
    });
  }

  banner(x: number, y: number, message: string, color = '#ffd75e'): void {
    const t = this.scene.add
      .text(x, y, message, {
        fontFamily: 'Barlow Condensed, Impact, sans-serif',
        fontSize: '40px',
        color,
        stroke: '#10141a',
        strokeThickness: 7,
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.overlay)
      .setScale(0.6)
      .setAlpha(0);
    this.scene.tweens.add({
      targets: t,
      scale: 1,
      alpha: 1,
      duration: 260,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.scene.tweens.add({
          targets: t,
          alpha: 0,
          y: y - 26,
          delay: 900,
          duration: 420,
          onComplete: () => t.destroy(),
        });
      },
    });
  }

  private makeText(): Phaser.GameObjects.Text {
    return this.scene.add
      .text(0, 0, '', {
        fontFamily: 'Barlow Condensed, Impact, sans-serif',
        fontSize: '14px',
        color: '#ffffff',
        stroke: '#101418',
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.floatingText);
  }

  /* ---- Camera ------------------------------------------------------- */

  shake(intensity: number, durationMs: number): void {
    if (!this.screenShake) return;
    this.scene.cameras.main.shake(durationMs, intensity, false);
  }

  flashScreen(color: number, alpha = 0.35, ms = 220): void {
    const cam = this.scene.cameras.main;
    const r = (color >> 16) & 0xff;
    const g = (color >> 8) & 0xff;
    const b = color & 0xff;
    cam.flash(ms, r, g, b, false, undefined, alpha);
  }

  destroy(): void {
    for (const t of [...this.textPool, ...this.activeText]) t.destroy();
    this.textPool = [];
    this.activeText = [];
    for (const e of [this.sparks, this.smoke, this.dust, this.flames, this.chunks, this.frost]) e.destroy();
  }
}
