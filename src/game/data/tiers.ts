import type { TierDef, TierId } from '../types';

/**
 * Colour communicates durability, but never on its own: every tier also
 * carries a rank (pip count), a distinct health-bar treatment and a
 * silhouette marking pattern so the tier reads without colour vision.
 */
export const TIERS: Record<TierId, TierDef> = {
  green: {
    id: 'green',
    name: 'Verdant',
    rank: 1,
    hpMultiplier: 1,
    speedMultiplier: 1,
    bountyMultiplier: 1,
    armorBonus: 0,
    scaleMultiplier: 1,
    color: 0x76c14a,
    cssColor: '#76c14a',
    pattern: 'plain',
    description: 'Juvenile stock. Numerous, fragile, and extremely committed.',
  },
  blue: {
    id: 'blue',
    name: 'Cobalt',
    rank: 2,
    hpMultiplier: 2.35,
    speedMultiplier: 1.04,
    bountyMultiplier: 1.5,
    armorBonus: 1,
    scaleMultiplier: 1.06,
    color: 0x4aa3d8,
    cssColor: '#4aa3d8',
    pattern: 'speckle',
    description: 'Adolescent. Noticeably harder to put down than it looks.',
  },
  orange: {
    id: 'orange',
    name: 'Amberhide',
    rank: 3,
    hpMultiplier: 5.4,
    speedMultiplier: 1.02,
    bountyMultiplier: 2.4,
    armorBonus: 3,
    scaleMultiplier: 1.14,
    color: 0xe8973a,
    cssColor: '#e8973a',
    pattern: 'stripe',
    description: 'Mature and thick-skinned. Small-calibre fire is wasted here.',
  },
  red: {
    id: 'red',
    name: 'Crimson',
    rank: 4,
    hpMultiplier: 11.5,
    speedMultiplier: 1.06,
    bountyMultiplier: 3.8,
    armorBonus: 6,
    scaleMultiplier: 1.22,
    color: 0xd9453f,
    cssColor: '#d9453f',
    pattern: 'chevron',
    description: 'Alpha specimen. Concentrate everything you have.',
  },
  obsidian: {
    id: 'obsidian',
    name: 'Obsidian',
    rank: 5,
    hpMultiplier: 26,
    speedMultiplier: 0.96,
    bountyMultiplier: 6.5,
    armorBonus: 10,
    scaleMultiplier: 1.34,
    color: 0x5b5470,
    cssColor: '#8b82a8',
    pattern: 'crackle',
    description: 'Field notes on this tier are brief and mostly punctuation.',
  },
};

export const TIER_ORDER: TierId[] = ['green', 'blue', 'orange', 'red', 'obsidian'];

export function getTier(id: TierId): TierDef {
  return TIERS[id];
}

/** Steps a tier up by `n` places, clamped at obsidian. Used by challenges. */
export function boostTier(id: TierId, n: number): TierId {
  const i = TIER_ORDER.indexOf(id);
  return TIER_ORDER[Math.min(TIER_ORDER.length - 1, Math.max(0, i + n))];
}
