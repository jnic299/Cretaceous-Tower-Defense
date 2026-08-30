import type { SpeciesId } from '../game/types';

/**
 * Save schema. Bump SAVE_VERSION and add a migration whenever the shape
 * changes; `migrateSave` walks a save forward one version at a time.
 *
 * v1 — vertical slice: amber, unlocks, map results, settings.
 * v2 — adds the dinosaur codex, challenge results and lifetime stats.
 */
export const SAVE_VERSION = 2;

export const SAVE_KEY = 'ctd.save.v1';

export interface MapResult {
  /** Best stars earned, 0..3. */
  stars: number;
  cleared: boolean;
  /** Best objective health remaining as a 0..1 fraction. */
  bestIntegrity: number;
  plays: number;
  wins: number;
  bestWave: number;
}

export interface ChallengeResult {
  completed: boolean;
  bestWave: number;
  plays: number;
}

export interface GameSettings {
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  muted: boolean;
  showDamageNumbers: boolean;
  showRangeOnHover: boolean;
  screenShake: boolean;
  /** Adds heavy tier badges and patterned bars for colour-blind players. */
  highContrastTiers: boolean;
  confirmSell: boolean;
}

export interface LifetimeStats {
  kills: number;
  waves: number;
  matches: number;
  wins: number;
  losses: number;
  bosses: number;
  amberEarned: number;
  supplySpent: number;
  playTimeMs: number;
  unitsPlaced: number;
  upgrades: number;
}

export interface UnlockState {
  defenders: string[];
  turrets: string[];
  fixtures: string[];
  heroes: string[];
  maps: string[];
}

export interface PlayerProfile {
  createdAt: number;
  updatedAt: number;
  amber: number;
  unlocked: UnlockState;
  selectedHeroId: string;
  lastMapId: string;
  mapResults: Record<string, MapResult>;
  challengeResults: Record<string, ChallengeResult>;
  codex: {
    seen: SpeciesId[];
    kills: Partial<Record<SpeciesId, number>>;
  };
  stats: LifetimeStats;
  settings: GameSettings;
  tutorialCompleted: boolean;
  /** Cleared once the player leaves the title screen for the first time. */
  firstRun: boolean;
}

export interface SaveData {
  version: number;
  profile: PlayerProfile;
}
