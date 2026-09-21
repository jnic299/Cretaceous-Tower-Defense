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
  ARMOR_FLOOR_RATIO,
} from '../src/game/systems/combatMath';
import { SPECIES } from '../src/game/data/dinosaurs';
import { TIERS } from '../src/game/data/tiers';

describe('armour', () => {
  it('subtracts flat armour from a hit', () => {
    expect(applyArmor(50, 10)).toBe(40);
  });

  it('never reduces a hit below the floor fraction of its printed damage', () => {
    // A 5-damage flame tick against 16 armour: heavily reduced, not nullified.
    expect(applyArmor(5, 16)).toBeCloseTo(5 * ARMOR_FLOOR_RATIO, 5);
    expect(applyArmor(100, 500)).toBeCloseTo(100 * ARMOR_FLOOR_RATIO, 5);
  });

  it('leaves massed light fire able to grind plating down', () => {
    // The reported failure: a river gauntlet of upgraded Sentry Turrets did
    // nothing at all to a Cobalt Ankylosaurus, because each 13-damage round
    // landed for 1.3 against 17 armour. Six of them now kill it inside the
    // time it spends walking through their arcs.
    const armour = effectiveArmor(SPECIES.ankylosaurus, TIERS.blue);
    const perRound = applyArmor(13, armour, 0.15);
    const gauntletDps = perRound * 4.6 * 6;
    const hp = scaledHp(SPECIES.ankylosaurus, TIERS.blue);
    expect(hp / gauntletDps).toBeLessThan(10);
    // But one turret alone is still hopeless against it.
    expect(hp / (perRound * 4.6)).toBeGreaterThan(30);
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
    // A rail round ignores plating entirely while a dart is cut to the floor,
    // so the right tool is still an order of magnitude better. The margin is
    // narrower than it was only because the floor no longer nullifies darts.
    expect(railDps).toBeGreaterThan(dartDps * 10);
    // And a dart still loses most of its printed damage to the plating.
    expect(applyArmor(10, effectiveArmor(anky, TIERS.green), 0.15)).toBeLessThan(10 * 0.4);
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
