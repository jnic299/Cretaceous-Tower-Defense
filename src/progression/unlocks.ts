import { ALL_DEFENDERS, FIXTURES, HEROES } from '../game/data/catalog';
import { MAPS_BY_ID } from '../game/data/maps';
import type { PlayerProfile, UnlockState } from '../persistence/schema';
import { totalStars } from './profile';

export type UnlockKind = keyof UnlockState;

export interface UnlockTarget {
  kind: UnlockKind;
  id: string;
  name: string;
  cost: number;
  starsRequired: number;
}

/** Resolves an id to the slot it lives in and what it costs. */
export function describeUnlock(kind: UnlockKind, id: string): UnlockTarget | null {
  switch (kind) {
    case 'defenders':
    case 'turrets': {
      const def = ALL_DEFENDERS.find((d) => d.id === id);
      return def ? { kind, id, name: def.name, cost: def.unlockCost, starsRequired: 0 } : null;
    }
    case 'fixtures': {
      const fix = FIXTURES.find((f) => f.id === id);
      return fix ? { kind, id, name: fix.name, cost: fix.unlockCost, starsRequired: 0 } : null;
    }
    case 'heroes': {
      const hero = HEROES.find((h) => h.id === id);
      return hero ? { kind, id, name: hero.name, cost: hero.unlockCost, starsRequired: 0 } : null;
    }
    case 'maps': {
      const map = MAPS_BY_ID[id];
      return map
        ? { kind, id, name: map.name, cost: map.unlockCost, starsRequired: map.starsRequired }
        : null;
    }
  }
}

export type UnlockFailure = 'unknown' | 'owned' | 'amber' | 'stars';

/** `reason` is always present so callers can branch without narrowing first. */
export type UnlockCheck =
  | { ok: true; reason: 'ok'; cost: number }
  | { ok: false; reason: UnlockFailure; cost: number; needed?: number };

export function canUnlock(profile: PlayerProfile, kind: UnlockKind, id: string): UnlockCheck {
  const target = describeUnlock(kind, id);
  if (!target) return { ok: false, reason: 'unknown', cost: 0 };
  if (profile.unlocked[kind].includes(id)) return { ok: false, reason: 'owned', cost: target.cost };
  const stars = totalStars(profile);
  if (stars < target.starsRequired) {
    return { ok: false, reason: 'stars', cost: target.cost, needed: target.starsRequired - stars };
  }
  if (profile.amber < target.cost) {
    return { ok: false, reason: 'amber', cost: target.cost, needed: target.cost - profile.amber };
  }
  return { ok: true, reason: 'ok', cost: target.cost };
}

/**
 * Returns a new profile with the item unlocked and the amber deducted, or the
 * original profile untouched if the purchase is not legal.
 */
export function applyUnlock(profile: PlayerProfile, kind: UnlockKind, id: string): PlayerProfile {
  const check = canUnlock(profile, kind, id);
  if (!check.ok) return profile;
  return {
    ...profile,
    amber: profile.amber - check.cost,
    unlocked: { ...profile.unlocked, [kind]: [...profile.unlocked[kind], id] },
    updatedAt: Date.now(),
  };
}
