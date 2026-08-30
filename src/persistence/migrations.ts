import { createProfile } from '../progression/profile';
import { DEFAULT_SETTINGS } from '../progression/profile';
import { SAVE_VERSION, type PlayerProfile, type SaveData } from './schema';

type AnyRecord = Record<string, unknown>;

/**
 * Walks a save forward one version at a time. Each step must be pure and
 * defensive: a save written by an older build may be missing anything.
 */
const MIGRATIONS: Record<number, (data: AnyRecord) => AnyRecord> = {
  // v1 → v2: the codex, challenge results and lifetime stats were added.
  1: (data) => {
    const profile = (data.profile ?? {}) as AnyRecord;
    return {
      ...data,
      version: 2,
      profile: {
        ...profile,
        codex: profile.codex ?? { seen: [], kills: {} },
        challengeResults: profile.challengeResults ?? {},
        stats: profile.stats ?? createProfile().stats,
      },
    };
  },
};

/** Fills in anything a migration or a hand-edited save might have left out. */
export function normalizeProfile(input: unknown): PlayerProfile {
  const base = createProfile();
  if (!input || typeof input !== 'object') return base;
  const p = input as AnyRecord;
  const unlocked = (p.unlocked ?? {}) as AnyRecord;

  const asIds = (value: unknown, fallback: string[]): string[] =>
    Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : fallback;

  return {
    ...base,
    ...(p as Partial<PlayerProfile>),
    amber: typeof p.amber === 'number' && Number.isFinite(p.amber) ? Math.max(0, Math.floor(p.amber)) : 0,
    unlocked: {
      defenders: asIds(unlocked.defenders, base.unlocked.defenders),
      turrets: asIds(unlocked.turrets, base.unlocked.turrets),
      fixtures: asIds(unlocked.fixtures, base.unlocked.fixtures),
      heroes: asIds(unlocked.heroes, base.unlocked.heroes),
      maps: asIds(unlocked.maps, base.unlocked.maps),
    },
    mapResults: (p.mapResults as PlayerProfile['mapResults']) ?? {},
    challengeResults: (p.challengeResults as PlayerProfile['challengeResults']) ?? {},
    codex: {
      seen: asIds((p.codex as AnyRecord | undefined)?.seen, []) as PlayerProfile['codex']['seen'],
      kills: ((p.codex as AnyRecord | undefined)?.kills as PlayerProfile['codex']['kills']) ?? {},
    },
    stats: { ...base.stats, ...((p.stats as AnyRecord) ?? {}) } as PlayerProfile['stats'],
    settings: { ...DEFAULT_SETTINGS, ...((p.settings as AnyRecord) ?? {}) } as PlayerProfile['settings'],
    selectedHeroId: typeof p.selectedHeroId === 'string' ? p.selectedHeroId : base.selectedHeroId,
    lastMapId: typeof p.lastMapId === 'string' ? p.lastMapId : base.lastMapId,
    tutorialCompleted: p.tutorialCompleted === true,
    firstRun: p.firstRun !== false,
  };
}

/**
 * Brings any stored save up to the current version. Unrecognised or
 * future-versioned data falls back to a fresh profile rather than crashing.
 */
export function migrateSave(input: unknown): SaveData {
  if (!input || typeof input !== 'object') {
    return { version: SAVE_VERSION, profile: createProfile() };
  }

  let data = input as AnyRecord;
  let version = typeof data.version === 'number' ? data.version : 1;

  if (version > SAVE_VERSION) {
    console.warn('[ctd] save is newer than this build; starting a fresh profile');
    return { version: SAVE_VERSION, profile: createProfile() };
  }

  let guard = 0;
  while (version < SAVE_VERSION && guard++ < 32) {
    const step = MIGRATIONS[version];
    if (!step) break;
    data = step(data);
    version = typeof data.version === 'number' ? data.version : version + 1;
  }

  return { version: SAVE_VERSION, profile: normalizeProfile(data.profile) };
}
