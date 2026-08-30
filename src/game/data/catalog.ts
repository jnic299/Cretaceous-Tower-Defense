import type { DefenderDef, FixtureDef, HeroDef, PlaceableDef } from '../types';
import { DEFENDERS } from './defenders';
import { TURRETS } from './turrets';
import { FIXTURES } from './fixtures';
import { HEROES } from './heroes';

/**
 * Single lookup surface over everything a player can own or deploy. UI code
 * should read from here rather than importing the individual tables.
 */

export const ALL_DEFENDERS: DefenderDef[] = [...DEFENDERS, ...TURRETS];

export const ALL_PLACEABLES: PlaceableDef[] = [...DEFENDERS, ...TURRETS, ...FIXTURES];

const placeableIndex = new Map<string, PlaceableDef>(ALL_PLACEABLES.map((p) => [p.id, p]));
const defenderIndex = new Map<string, DefenderDef>(ALL_DEFENDERS.map((d) => [d.id, d]));
const fixtureIndex = new Map<string, FixtureDef>(FIXTURES.map((f) => [f.id, f]));
const heroIndex = new Map<string, HeroDef>(HEROES.map((h) => [h.id, h]));

export function findPlaceable(id: string): PlaceableDef | undefined {
  return placeableIndex.get(id);
}

export function findDefender(id: string): DefenderDef | undefined {
  return defenderIndex.get(id);
}

export function findFixture(id: string): FixtureDef | undefined {
  return fixtureIndex.get(id);
}

export function findHero(id: string): HeroDef | undefined {
  return heroIndex.get(id);
}

export function isFixture(def: PlaceableDef): def is FixtureDef {
  return def.category === 'fixture';
}

/** Everything a brand-new profile owns. */
export const STARTING_UNLOCKS = {
  defenders: ['ranger'] as string[],
  turrets: ['sentryTurret'] as string[],
  fixtures: [] as string[],
  heroes: ['ironside'] as string[],
  maps: ['researchOutpost'] as string[],
};

export { DEFENDERS, TURRETS, FIXTURES, HEROES };
