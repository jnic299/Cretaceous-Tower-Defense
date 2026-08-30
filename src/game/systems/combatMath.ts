import type { SpeciesDef, TierDef } from '../types';

/** Nothing is ever fully immune: a hit always lands for at least this much. */
export const MIN_DAMAGE = 1;
/** Armour can never reduce a hit below this fraction of its printed damage. */
export const ARMOR_FLOOR_RATIO = 0.1;

export function scaledHp(species: SpeciesDef, tier: TierDef): number {
  return Math.round(species.baseHp * tier.hpMultiplier);
}

export function scaledSpeed(species: SpeciesDef, tier: TierDef): number {
  return species.baseSpeed * tier.speedMultiplier;
}

export function scaledBounty(species: SpeciesDef, tier: TierDef): number {
  return Math.max(1, Math.round(species.bounty * tier.bountyMultiplier));
}

export function effectiveArmor(species: SpeciesDef, tier: TierDef): number {
  return species.armor + tier.armorBonus;
}

export function scaledObjectiveDamage(species: SpeciesDef, tier: TierDef): number {
  // Heavier tiers hit the objective harder, but not on the HP curve — that
  // would make late waves unsurvivable rather than difficult.
  return Math.round(species.objectiveDamage * (1 + (tier.rank - 1) * 0.22));
}

/**
 * Armour subtracts flat damage, so rapid low-calibre fire is what suffers —
 * exactly the intended Ankylosaurus problem. `armorPierce` (0..1) is the
 * fraction of armour a round ignores.
 */
export function applyArmor(damage: number, armor: number, armorPierce = 0): number {
  const effective = armor * (1 - Math.min(1, Math.max(0, armorPierce)));
  const reduced = damage - effective;
  return Math.max(MIN_DAMAGE, Math.max(damage * ARMOR_FLOOR_RATIO, reduced));
}

/** Splash falls off linearly from the centre to `radius`. */
export function splashDamageAt(
  damage: number,
  distance: number,
  radius: number,
  edgeFraction = 0.45,
): number {
  if (distance >= radius) return 0;
  const t = radius <= 0 ? 0 : distance / radius;
  return damage * (1 - t * (1 - edgeFraction));
}

/** Cooldown in ms between shots, given shots-per-second and any buffs. */
export function shotIntervalMs(fireRate: number, fireRateMultiplier = 1): number {
  const rate = Math.max(0.01, fireRate * Math.max(0.05, fireRateMultiplier));
  return 1000 / rate;
}
