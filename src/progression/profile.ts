import { STARTING_UNLOCKS } from '../game/data/catalog';
import { MAPS } from '../game/data/maps';
import { SAVE_VERSION, type GameSettings, type MapResult, type PlayerProfile, type SaveData } from '../persistence/schema';

export const DEFAULT_SETTINGS: GameSettings = {
  masterVolume: 0.75,
  musicVolume: 0.45,
  sfxVolume: 0.8,
  muted: false,
  showDamageNumbers: true,
  showRangeOnHover: true,
  screenShake: true,
  highContrastTiers: false,
  confirmSell: false,
};

export function emptyMapResult(): MapResult {
  return { stars: 0, cleared: false, bestIntegrity: 0, plays: 0, wins: 0, bestWave: 0 };
}

export function createProfile(now = Date.now()): PlayerProfile {
  return {
    createdAt: now,
    updatedAt: now,
    amber: 0,
    unlocked: {
      defenders: [...STARTING_UNLOCKS.defenders],
      turrets: [...STARTING_UNLOCKS.turrets],
      fixtures: [...STARTING_UNLOCKS.fixtures],
      heroes: [...STARTING_UNLOCKS.heroes],
      maps: [...STARTING_UNLOCKS.maps],
    },
    selectedHeroId: STARTING_UNLOCKS.heroes[0],
    lastMapId: STARTING_UNLOCKS.maps[0],
    mapResults: {},
    challengeResults: {},
    codex: { seen: [], kills: {} },
    stats: {
      kills: 0,
      waves: 0,
      matches: 0,
      wins: 0,
      losses: 0,
      bosses: 0,
      amberEarned: 0,
      supplySpent: 0,
      playTimeMs: 0,
      unitsPlaced: 0,
      upgrades: 0,
    },
    settings: { ...DEFAULT_SETTINGS },
    tutorialCompleted: false,
    firstRun: true,
  };
}

export function createSave(now = Date.now()): SaveData {
  return { version: SAVE_VERSION, profile: createProfile(now) };
}

/** Total stars across every map. Gates map purchases and challenges. */
export function totalStars(profile: PlayerProfile): number {
  return Object.values(profile.mapResults).reduce((sum, r) => sum + (r?.stars ?? 0), 0);
}

export function mapResult(profile: PlayerProfile, mapId: string): MapResult {
  return profile.mapResults[mapId] ?? emptyMapResult();
}

export function isUnlocked(profile: PlayerProfile, kind: keyof PlayerProfile['unlocked'], id: string): boolean {
  return profile.unlocked[kind].includes(id);
}

/** Maps in display order with their availability resolved. */
export function mapAvailability(profile: PlayerProfile) {
  const stars = totalStars(profile);
  return MAPS.map((m) => ({
    map: m,
    unlocked: profile.unlocked.maps.includes(m.id),
    affordable: profile.amber >= m.unlockCost,
    starsMet: stars >= m.starsRequired,
    result: mapResult(profile, m.id),
  }));
}
