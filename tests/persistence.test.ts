import { describe, expect, it } from 'vitest';
import { migrateSave, normalizeProfile } from '../src/persistence/migrations';
import { SAVE_VERSION } from '../src/persistence/schema';
import { createProfile, createSave } from '../src/progression/profile';
import { MemoryGameSaveRepository } from '../src/persistence/GameSaveRepository';

describe('save migration', () => {
  it('passes a current save through unchanged in shape', () => {
    const save = createSave();
    const migrated = migrateSave(save);
    expect(migrated.version).toBe(SAVE_VERSION);
    expect(migrated.profile.amber).toBe(save.profile.amber);
    expect(migrated.profile.unlocked.defenders).toEqual(save.profile.unlocked.defenders);
  });

  it('upgrades a v1 save, filling in the fields v2 added', () => {
    const v1 = {
      version: 1,
      profile: {
        createdAt: 1,
        updatedAt: 1,
        amber: 640,
        unlocked: {
          defenders: ['ranger', 'fred'],
          turrets: ['sentryTurret'],
          fixtures: [],
          heroes: ['ironside'],
          maps: ['researchOutpost', 'deltaWetlands'],
        },
        selectedHeroId: 'ironside',
        lastMapId: 'deltaWetlands',
        mapResults: { researchOutpost: { stars: 3, cleared: true, bestIntegrity: 1, plays: 4, wins: 3, bestWave: 12 } },
        settings: { masterVolume: 0.5, muted: true },
        tutorialCompleted: true,
        firstRun: false,
      },
    };

    const migrated = migrateSave(v1);
    expect(migrated.version).toBe(SAVE_VERSION);
    expect(migrated.profile.amber).toBe(640);
    expect(migrated.profile.unlocked.defenders).toEqual(['ranger', 'fred']);
    expect(migrated.profile.mapResults.researchOutpost.stars).toBe(3);
    // Added in v2 and back-filled by the migration.
    expect(migrated.profile.codex).toEqual({ seen: [], kills: {} });
    expect(migrated.profile.challengeResults).toEqual({});
    expect(migrated.profile.stats.kills).toBe(0);
    // Existing settings survive; missing ones take the default.
    expect(migrated.profile.settings.muted).toBe(true);
    expect(migrated.profile.settings.masterVolume).toBe(0.5);
    expect(migrated.profile.settings.sfxVolume).toBe(createProfile().settings.sfxVolume);
  });

  it('falls back to a fresh profile for junk input', () => {
    for (const junk of [null, undefined, 42, 'nope', [], {}]) {
      const migrated = migrateSave(junk);
      expect(migrated.version).toBe(SAVE_VERSION);
      expect(migrated.profile.unlocked.defenders).toContain('ranger');
    }
  });

  it('refuses a save from a newer build rather than corrupting it', () => {
    const future = { version: SAVE_VERSION + 5, profile: { amber: 99999 } };
    const migrated = migrateSave(future);
    expect(migrated.profile.amber).toBe(0);
  });

  it('repairs hostile or partial profile data', () => {
    const broken = normalizeProfile({
      amber: -500,
      unlocked: { defenders: ['ranger', 7, null], maps: 'not-an-array' },
      settings: { masterVolume: 0.2 },
      codex: { seen: ['velociraptor', 12] },
      stats: { kills: 5 },
    });
    expect(broken.amber).toBe(0);
    expect(broken.unlocked.defenders).toEqual(['ranger']);
    expect(broken.unlocked.maps).toEqual(['researchOutpost']);
    expect(broken.codex.seen).toEqual(['velociraptor']);
    expect(broken.stats.kills).toBe(5);
    expect(broken.stats.matches).toBe(0);
    expect(broken.settings.masterVolume).toBe(0.2);
  });

  it('floors fractional amber', () => {
    expect(normalizeProfile({ amber: 12.9 }).amber).toBe(12);
    expect(normalizeProfile({ amber: Number.NaN }).amber).toBe(0);
  });
});

describe('save repository', () => {
  it('round-trips a save and clears it', async () => {
    const repo = new MemoryGameSaveRepository();
    expect(await repo.load()).toBeNull();

    const save = createSave();
    save.profile.amber = 1234;
    await repo.save(save);

    const loaded = await repo.load();
    expect(loaded?.profile.amber).toBe(1234);

    // Stored data is a copy, not a live reference.
    save.profile.amber = 0;
    expect((await repo.load())?.profile.amber).toBe(1234);

    await repo.clear();
    expect(await repo.load()).toBeNull();
  });
});
