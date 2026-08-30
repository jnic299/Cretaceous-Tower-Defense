import { describe, expect, it } from 'vitest';
import {
  applyArmor,
  effectiveArmor,
  scaledBounty,
  scaledHp,
  scaledObjectiveDamage,
  scaledSpeed,
  shotIntervalMs,
  splashDamageAt,
  MIN_DAMAGE,
} from '../src/game/systems/combatMath';
import { SPECIES } from '../src/game/data/dinosaurs';
import { TIERS } from '../src/game/data/tiers';

describe('armour', () => {
  it('subtracts flat armour from a hit', () => {
    expect(applyArmor(50, 10)).toBe(40);
  });

  it('never reduces a hit below a tenth of its printed damage', () => {
    // A 5-damage flame tick against 16 armour: heavily reduced, not nullified.
    expect(applyArmor(5, 16)).toBeCloseTo(1, 5);
    expect(applyArmor(100, 500)).toBe(10);
  });

  it('always deals at least the minimum', () => {
    expect(applyArmor(1, 999)).toBe(MIN_DAMAGE);
  });

  it('armour piercing ignores the given fraction', () => {
    expect(applyArmor(100, 40, 0)).toBe(60);
    expect(applyArmor(100, 40, 0.5)).toBe(80);
    expect(applyArmor(100, 40, 1)).toBe(100);
  });

  it('clamps out-of-range pierce values', () => {
    expect(applyArmor(100, 40, 5)).toBe(100);
    expect(applyArmor(100, 40, -3)).toBe(60);
  });

  it('makes rapid low-calibre fire the wrong answer to plating', () => {
    const anky = SPECIES.ankylosaurus;
    const armour = effectiveArmor(anky, TIERS.orange);
    const dartDps = applyArmor(10, armour, 0.15) * 1.5;
    const railDps = applyArmor(170, armour, 1) * 0.36;
    expect(railDps).toBeGreaterThan(dartDps * 20);
  });
});

describe('tier scaling', () => {
  it('scales health monotonically across the tier ladder', () => {
    const raptor = SPECIES.velociraptor;
    const hp = (['green', 'blue', 'orange', 'red', 'obsidian'] as const).map((t) =>
      scaledHp(raptor, TIERS[t]),
    );
    for (let i = 1; i < hp.length; i++) expect(hp[i]).toBeGreaterThan(hp[i - 1]);
  });

  it('keeps objective damage on a gentler curve than health', () => {
    const trike = SPECIES.triceratops;
    const hpRatio = scaledHp(trike, TIERS.obsidian) / scaledHp(trike, TIERS.green);
    const dmgRatio =
      scaledObjectiveDamage(trike, TIERS.obsidian) / scaledObjectiveDamage(trike, TIERS.green);
    expect(dmgRatio).toBeLessThan(hpRatio);
  });

  it('pays more for tougher tiers', () => {
    const comp = SPECIES.compsognathus;
    expect(scaledBounty(comp, TIERS.red)).toBeGreaterThan(scaledBounty(comp, TIERS.green));
    expect(scaledBounty(comp, TIERS.green)).toBeGreaterThanOrEqual(1);
  });

  it('applies the tier speed multiplier', () => {
    const comp = SPECIES.compsognathus;
    expect(scaledSpeed(comp, TIERS.blue)).toBeCloseTo(comp.baseSpeed * TIERS.blue.speedMultiplier);
  });
});

describe('splash', () => {
  it('deals full damage at the centre and nothing past the radius', () => {
    expect(splashDamageAt(100, 0, 80)).toBe(100);
    expect(splashDamageAt(100, 80, 80)).toBe(0);
    expect(splashDamageAt(100, 200, 80)).toBe(0);
  });

  it('falls off to the edge fraction', () => {
    expect(splashDamageAt(100, 79.999, 80, 0.4)).toBeCloseTo(40, 1);
    expect(splashDamageAt(100, 40, 80, 0.4)).toBeCloseTo(70, 5);
  });
});

describe('fire rate', () => {
  it('converts shots per second to a cooldown', () => {
    expect(shotIntervalMs(2)).toBe(500);
    expect(shotIntervalMs(4)).toBe(250);
  });

  it('shortens the cooldown when buffed', () => {
    expect(shotIntervalMs(2, 1.25)).toBeCloseTo(400);
  });

  it('never divides by zero', () => {
    expect(Number.isFinite(shotIntervalMs(0))).toBe(true);
    expect(Number.isFinite(shotIntervalMs(2, 0))).toBe(true);
  });
});
