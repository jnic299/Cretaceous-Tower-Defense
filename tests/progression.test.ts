import { describe, expect, it } from 'vitest';
import { createProfile, totalStars, mapAvailability, emptyMapResult } from '../src/progression/profile';
import { computeRewards, starsFor, STAR_THRESHOLDS, AMBER_PER_WAVE, AMBER_PER_BOSS } from '../src/progression/rewards';
import { applyMatchResult } from '../src/progression/applyResult';
import { applyUnlock, canUnlock, describeUnlock } from '../src/progression/unlocks';
import { RESEARCH_OUTPOST, DELTA_WETLANDS } from '../src/game/data/maps';
import { CHALLENGES_BY_ID } from '../src/game/data/challenges';
import type { MatchResult } from '../src/game/types';

function result(over: Partial<MatchResult> = {}): MatchResult {
  return {
    mapId: RESEARCH_OUTPOST.id,
    endReason: 'victory',
    victory: true,
    stars: 0,
    objectiveHpRemaining: 100,
    objectiveHpMax: 100,
    wavesCleared: 12,
    wavesTotal: 12,
    kills: 180,
    bossesDefeated: 1,
    supplyEarned: 900,
    supplySpent: 640,
    unitsPlaced: 11,
    upgradesPurchased: 4,
    amberEarned: 0,
    amberBreakdown: [],
    durationMs: 600_000,
    speciesSeen: ['compsognathus', 'velociraptor'],
    killsBySpecies: { compsognathus: 120, velociraptor: 60 },
    newlyUnlockedStars: 0,
    ...over,
  };
}

describe('stars', () => {
  it('awards nothing for a loss', () => {
    expect(starsFor(false, 1)).toBe(0);
  });

  it('awards one star for surviving on fumes', () => {
    expect(starsFor(true, 0.01)).toBe(1);
  });

  it('awards two stars at the halfway threshold', () => {
    expect(starsFor(true, STAR_THRESHOLDS.two)).toBe(2);
    expect(starsFor(true, STAR_THRESHOLDS.two - 0.01)).toBe(1);
  });

  it('awards three stars at the top threshold', () => {
    expect(starsFor(true, STAR_THRESHOLDS.three)).toBe(3);
    expect(starsFor(true, 1)).toBe(3);
  });
});

describe('rewards', () => {
  it('pays waves, bosses, the first clear and the new stars', () => {
    const profile = createProfile();
    const r = computeRewards(
      {
        map: RESEARCH_OUTPOST,
        victory: true,
        objectiveHpRemaining: 100,
        objectiveHpMax: 100,
        wavesCleared: 12,
        bossesDefeated: 1,
      },
      profile,
    );
    expect(r.stars).toBe(3);
    expect(r.firstClear).toBe(true);
    expect(r.amber).toBe(
      12 * AMBER_PER_WAVE + AMBER_PER_BOSS + RESEARCH_OUTPOST.firstClearAmber + 3 * RESEARCH_OUTPOST.amberPerStar,
    );
  });

  it('does not pay the star bonus twice', () => {
    let profile = createProfile();
    profile = applyMatchResult(profile, result(), RESEARCH_OUTPOST).profile;
    const second = computeRewards(
      {
        map: RESEARCH_OUTPOST,
        victory: true,
        objectiveHpRemaining: 100,
        objectiveHpMax: 100,
        wavesCleared: 12,
        bossesDefeated: 1,
      },
      profile,
    );
    expect(second.newStars).toBe(0);
    expect(second.firstClear).toBe(false);
    // Waves and bosses still pay on a replay.
    expect(second.amber).toBe(12 * AMBER_PER_WAVE + AMBER_PER_BOSS);
  });

  it('still pays for progress on a loss', () => {
    const r = computeRewards(
      {
        map: RESEARCH_OUTPOST,
        victory: false,
        objectiveHpRemaining: 0,
        objectiveHpMax: 100,
        wavesCleared: 5,
        bossesDefeated: 0,
      },
      createProfile(),
    );
    expect(r.stars).toBe(0);
    expect(r.amber).toBe(5 * AMBER_PER_WAVE);
  });

  it('pays a challenge bounty once', () => {
    const challenge = CHALLENGES_BY_ID['outpost-swarm'];
    let profile = createProfile();
    const first = applyMatchResult(profile, result(), RESEARCH_OUTPOST, challenge);
    expect(first.result.amberBreakdown.some((b) => b.label === 'Challenge complete')).toBe(true);
    profile = first.profile;
    const second = applyMatchResult(profile, result(), RESEARCH_OUTPOST, challenge);
    expect(second.result.amberBreakdown.some((b) => b.label === 'Challenge complete')).toBe(false);
  });
});

describe('applyMatchResult', () => {
  it('folds a win into the profile without mutating the original', () => {
    const profile = createProfile();
    const snapshot = JSON.stringify(profile);
    const { profile: next, result: enriched } = applyMatchResult(profile, result(), RESEARCH_OUTPOST);

    expect(JSON.stringify(profile)).toBe(snapshot);
    expect(next.amber).toBe(enriched.amberEarned);
    expect(next.mapResults[RESEARCH_OUTPOST.id].stars).toBe(3);
    expect(next.mapResults[RESEARCH_OUTPOST.id].cleared).toBe(true);
    expect(next.stats.matches).toBe(1);
    expect(next.stats.wins).toBe(1);
    expect(next.stats.kills).toBe(180);
    expect(next.codex.seen).toContain('velociraptor');
    expect(next.codex.kills.compsognathus).toBe(120);
  });

  it('accumulates codex kills across runs', () => {
    let profile = createProfile();
    profile = applyMatchResult(profile, result(), RESEARCH_OUTPOST).profile;
    profile = applyMatchResult(profile, result(), RESEARCH_OUTPOST).profile;
    expect(profile.codex.kills.compsognathus).toBe(240);
    expect(profile.codex.kills.velociraptor).toBe(120);
  });

  it('never lowers a best rating on a worse replay', () => {
    let profile = createProfile();
    profile = applyMatchResult(profile, result(), RESEARCH_OUTPOST).profile;
    profile = applyMatchResult(
      profile,
      result({ objectiveHpRemaining: 10, kills: 5, bossesDefeated: 0 }),
      RESEARCH_OUTPOST,
    ).profile;
    expect(profile.mapResults[RESEARCH_OUTPOST.id].stars).toBe(3);
    expect(profile.mapResults[RESEARCH_OUTPOST.id].plays).toBe(2);
  });

  it('records a loss without clearing the map', () => {
    const profile = createProfile();
    const { profile: next } = applyMatchResult(
      profile,
      result({ endReason: 'defeat', victory: false, objectiveHpRemaining: 0, wavesCleared: 4, bossesDefeated: 0 }),
      RESEARCH_OUTPOST,
    );
    expect(next.mapResults[RESEARCH_OUTPOST.id].cleared).toBe(false);
    expect(next.stats.losses).toBe(1);
    expect(next.amber).toBe(4 * AMBER_PER_WAVE);
  });
});

describe('unlocks', () => {
  it('starts with the Ranger, a Sentry Turret, one hero and the first site', () => {
    const p = createProfile();
    expect(p.unlocked.defenders).toContain('ranger');
    expect(p.unlocked.turrets).toContain('sentryTurret');
    expect(p.unlocked.heroes).toContain('ironside');
    expect(p.unlocked.maps).toEqual([RESEARCH_OUTPOST.id]);
    expect(p.amber).toBe(0);
  });

  it('refuses a purchase with no Amber', () => {
    const check = canUnlock(createProfile(), 'defenders', 'fred');
    expect(check.ok).toBe(false);
    expect(check.reason).toBe('amber');
  });

  it('spends Amber and grants the item', () => {
    const profile = { ...createProfile(), amber: 1000 };
    const next = applyUnlock(profile, 'defenders', 'fred');
    expect(next.unlocked.defenders).toContain('fred');
    expect(next.amber).toBe(1000 - describeUnlock('defenders', 'fred')!.cost);
  });

  it('refuses to buy the same thing twice', () => {
    let profile = { ...createProfile(), amber: 5000 };
    profile = applyUnlock(profile, 'defenders', 'fred');
    const amberAfterFirst = profile.amber;
    profile = applyUnlock(profile, 'defenders', 'fred');
    expect(profile.amber).toBe(amberAfterFirst);
    expect(canUnlock(profile, 'defenders', 'fred').reason).toBe('owned');
  });

  it('gates later maps behind stars as well as Amber', () => {
    const rich = { ...createProfile(), amber: 99999 };
    const check = canUnlock(rich, 'maps', DELTA_WETLANDS.id);
    expect(check.ok).toBe(false);
    expect(check.reason).toBe('stars');

    const starred = {
      ...rich,
      mapResults: { [RESEARCH_OUTPOST.id]: { ...emptyMapResult(), stars: 3, cleared: true } },
    };
    expect(totalStars(starred)).toBe(3);
    expect(canUnlock(starred, 'maps', DELTA_WETLANDS.id).ok).toBe(true);
  });

  it('rejects unknown ids', () => {
    expect(canUnlock(createProfile(), 'defenders', 'nope').reason).toBe('unknown');
    expect(describeUnlock('heroes', 'nope')).toBeNull();
  });

  it('reports availability for every map', () => {
    const rows = mapAvailability(createProfile());
    expect(rows).toHaveLength(4);
    expect(rows[0].unlocked).toBe(true);
    expect(rows[1].unlocked).toBe(false);
  });
});
