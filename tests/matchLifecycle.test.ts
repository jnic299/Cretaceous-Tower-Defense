import { describe, expect, it } from 'vitest';
import type { MatchEndReason, MatchResult } from '../src/game/types';
import { RESEARCH_OUTPOST } from '../src/game/data/maps';
import { CHALLENGES_BY_ID } from '../src/game/data/challenges';
import { createProfile } from '../src/progression/profile';
import { applyMatchResult } from '../src/progression/applyResult';
import { AMBER_PER_BOSS, AMBER_PER_WAVE } from '../src/progression/rewards';
import { migrateSave } from '../src/persistence/migrations';
import { SAVE_VERSION } from '../src/persistence/schema';

function matchResult(endReason: MatchEndReason, over: Partial<MatchResult> = {}): MatchResult {
  return {
    mapId: RESEARCH_OUTPOST.id,
    endReason,
    victory: endReason === 'victory',
    stars: 0,
    objectiveHpRemaining: endReason === 'victory' ? 100 : 40,
    objectiveHpMax: 100,
    wavesCleared: 5,
    wavesTotal: 12,
    kills: 64,
    bossesDefeated: 1,
    supplyEarned: 700,
    supplySpent: 480,
    unitsPlaced: 9,
    upgradesPurchased: 3,
    amberEarned: 0,
    amberBreakdown: [],
    durationMs: 240_000,
    speciesSeen: ['compsognathus', 'velociraptor'],
    killsBySpecies: { compsognathus: 50, velociraptor: 14 },
    newlyUnlockedStars: 0,
    ...over,
  };
}

/* ------------------------------------------------------------------ */
/* Abandoning                                                          */
/* ------------------------------------------------------------------ */

describe('abandoning an operation', () => {
  it('records a loss and pays the partial Amber the menu promises', () => {
    const { profile, result } = applyMatchResult(
      createProfile(),
      matchResult('abandoned'),
      RESEARCH_OUTPOST,
    );

    expect(result.endReason).toBe('abandoned');
    expect(result.victory).toBe(false);
    expect(result.stars).toBe(0);
    // Waves cleared and bosses defeated still pay; nothing else does.
    expect(result.amberEarned).toBe(5 * AMBER_PER_WAVE + AMBER_PER_BOSS);
    expect(profile.amber).toBe(result.amberEarned);
    expect(profile.stats.losses).toBe(1);
    expect(profile.stats.wins).toBe(0);
    expect(profile.stats.matches).toBe(1);
  });

  it('never awards stars, a first clear, or a map completion', () => {
    const { profile, result } = applyMatchResult(
      createProfile(),
      // Even with the objective untouched, withdrawing is not a clear.
      matchResult('abandoned', { objectiveHpRemaining: 100 }),
      RESEARCH_OUTPOST,
    );
    expect(result.stars).toBe(0);
    expect(result.amberBreakdown.some((b) => /first clear/i.test(b.label))).toBe(false);
    expect(result.amberBreakdown.some((b) => /star/i.test(b.label))).toBe(false);
    expect(profile.mapResults[RESEARCH_OUTPOST.id].cleared).toBe(false);
    expect(profile.mapResults[RESEARCH_OUTPOST.id].stars).toBe(0);
  });

  it('preserves kills, codex progress and play time', () => {
    const { profile } = applyMatchResult(createProfile(), matchResult('abandoned'), RESEARCH_OUTPOST);
    expect(profile.stats.kills).toBe(64);
    expect(profile.stats.waves).toBe(5);
    expect(profile.stats.bosses).toBe(1);
    expect(profile.stats.playTimeMs).toBe(240_000);
    expect(profile.codex.seen).toContain('velociraptor');
    expect(profile.codex.kills.compsognathus).toBe(50);
  });

  it('does not complete a challenge that was walked away from', () => {
    const challenge = CHALLENGES_BY_ID['outpost-swarm'];
    const { profile, result } = applyMatchResult(
      createProfile(),
      matchResult('abandoned', { challengeId: challenge.id }),
      RESEARCH_OUTPOST,
      challenge,
    );
    expect(result.amberBreakdown.some((b) => /challenge/i.test(b.label))).toBe(false);
    expect(profile.challengeResults[challenge.id].completed).toBe(false);
    expect(profile.challengeResults[challenge.id].plays).toBe(1);
  });

  it('pays a defeat and an abandonment identically', () => {
    const abandoned = applyMatchResult(createProfile(), matchResult('abandoned'), RESEARCH_OUTPOST);
    const defeated = applyMatchResult(createProfile(), matchResult('defeat'), RESEARCH_OUTPOST);
    expect(abandoned.result.amberEarned).toBe(defeated.result.amberEarned);
    expect(abandoned.profile.stats.losses).toBe(defeated.profile.stats.losses);
  });

  it('keeps victory and endReason consistent', () => {
    for (const reason of ['victory', 'defeat', 'abandoned'] as const) {
      const { result } = applyMatchResult(createProfile(), matchResult(reason), RESEARCH_OUTPOST);
      expect(result.victory).toBe(reason === 'victory');
    }
  });
});

/* ------------------------------------------------------------------ */
/* Tutorial completion                                                 */
/* ------------------------------------------------------------------ */

describe('tutorial completion', () => {
  it('is part of the same transition as the rewards', () => {
    const fresh = createProfile();
    expect(fresh.tutorialCompleted).toBe(false);

    const { profile } = applyMatchResult(fresh, matchResult('victory'), RESEARCH_OUTPOST, undefined, {
      completedTutorial: true,
    });

    // One profile, carrying both facts. Neither can overwrite the other.
    expect(profile.tutorialCompleted).toBe(true);
    expect(profile.amber).toBeGreaterThan(0);
    expect(profile.mapResults[RESEARCH_OUTPOST.id].cleared).toBe(true);
  });

  it('survives a save round trip and a migration', () => {
    const { profile } = applyMatchResult(
      createProfile(),
      matchResult('victory'),
      RESEARCH_OUTPOST,
      undefined,
      { completedTutorial: true },
    );

    const reloaded = migrateSave(JSON.parse(JSON.stringify({ version: SAVE_VERSION, profile })));
    expect(reloaded.profile.tutorialCompleted).toBe(true);
    expect(reloaded.profile.amber).toBe(profile.amber);
  });

  it('stays completed on later matches that do not set the flag', () => {
    let profile = applyMatchResult(
      createProfile(),
      matchResult('victory'),
      RESEARCH_OUTPOST,
      undefined,
      { completedTutorial: true },
    ).profile;

    profile = applyMatchResult(profile, matchResult('defeat'), RESEARCH_OUTPOST).profile;
    expect(profile.tutorialCompleted).toBe(true);

    profile = applyMatchResult(profile, matchResult('abandoned'), RESEARCH_OUTPOST, undefined, {
      completedTutorial: false,
    }).profile;
    expect(profile.tutorialCompleted).toBe(true);
  });

  it('is not set by an ordinary match', () => {
    const { profile } = applyMatchResult(createProfile(), matchResult('victory'), RESEARCH_OUTPOST);
    expect(profile.tutorialCompleted).toBe(false);
  });

  it('completes even when the guided run is abandoned', () => {
    // The player has seen the coaching; do not make them sit through it again.
    const { profile } = applyMatchResult(
      createProfile(),
      matchResult('abandoned'),
      RESEARCH_OUTPOST,
      undefined,
      { completedTutorial: true },
    );
    expect(profile.tutorialCompleted).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/* Lifetime statistics                                                 */
/* ------------------------------------------------------------------ */

describe('lifetime statistics', () => {
  it('starts at zero for a fresh profile', () => {
    const s = createProfile().stats;
    expect(s.supplySpent).toBe(0);
    expect(s.unitsPlaced).toBe(0);
    expect(s.upgrades).toBe(0);
  });

  it('records Supply spent, units deployed and upgrades bought', () => {
    const { profile } = applyMatchResult(createProfile(), matchResult('victory'), RESEARCH_OUTPOST);
    expect(profile.stats.supplySpent).toBe(480);
    expect(profile.stats.unitsPlaced).toBe(9);
    expect(profile.stats.upgrades).toBe(3);
  });

  it('accumulates across matches, including abandoned ones', () => {
    let profile = createProfile();
    profile = applyMatchResult(profile, matchResult('victory'), RESEARCH_OUTPOST).profile;
    profile = applyMatchResult(profile, matchResult('abandoned'), RESEARCH_OUTPOST).profile;
    expect(profile.stats.supplySpent).toBe(960);
    expect(profile.stats.unitsPlaced).toBe(18);
    expect(profile.stats.upgrades).toBe(6);
    expect(profile.stats.matches).toBe(2);
  });

  it('never goes backwards on a malformed result', () => {
    let profile = applyMatchResult(createProfile(), matchResult('victory'), RESEARCH_OUTPOST).profile;
    const before = { ...profile.stats };
    profile = applyMatchResult(
      profile,
      matchResult('defeat', { supplySpent: -500, unitsPlaced: -3, upgradesPurchased: -1 }),
      RESEARCH_OUTPOST,
    ).profile;
    expect(profile.stats.supplySpent).toBe(before.supplySpent);
    expect(profile.stats.unitsPlaced).toBe(before.unitsPlaced);
    expect(profile.stats.upgrades).toBe(before.upgrades);
  });

  it('has no permanently dead fields left in the schema', () => {
    // Every lifetime counter must be written by the end-of-match reducer.
    const before = createProfile();
    const { profile: after } = applyMatchResult(
      before,
      matchResult('victory'),
      RESEARCH_OUTPOST,
    );
    const untouched = (Object.keys(before.stats) as (keyof typeof before.stats)[]).filter(
      (key) => after.stats[key] === before.stats[key],
    );
    // `losses` is the only counter a winning match legitimately leaves alone.
    expect(untouched).toEqual(['losses']);
  });
});
