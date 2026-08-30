import type { ChallengeDef, MapDef, MatchResult } from '../game/types';
import type { PlayerProfile } from '../persistence/schema';
import { computeRewards } from './rewards';
import { emptyMapResult } from './profile';

/**
 * Folds a finished match into a profile. Pure: takes a profile and a result,
 * returns the new profile plus the result enriched with what was actually
 * awarded. Keeping it pure is what makes the reward rules testable.
 */
export function applyMatchResult(
  profile: PlayerProfile,
  result: MatchResult,
  map: MapDef,
  challenge?: ChallengeDef,
): { profile: PlayerProfile; result: MatchResult } {
  const challengeDone = challenge ? profile.challengeResults[challenge.id]?.completed === true : false;

  const rewards = computeRewards(
    {
      map,
      victory: result.victory,
      objectiveHpRemaining: result.objectiveHpRemaining,
      objectiveHpMax: result.objectiveHpMax,
      wavesCleared: result.wavesCleared,
      bossesDefeated: result.bossesDefeated,
      challengeId: challenge?.id,
      challengeAmber: challenge?.amberReward,
      challengeAlreadyDone: challengeDone,
    },
    profile,
  );

  const previous = profile.mapResults[map.id] ?? emptyMapResult();
  const integrity = result.objectiveHpMax > 0 ? result.objectiveHpRemaining / result.objectiveHpMax : 0;

  const mapResults = {
    ...profile.mapResults,
    [map.id]: {
      stars: Math.max(previous.stars, rewards.stars),
      cleared: previous.cleared || result.victory,
      bestIntegrity: Math.max(previous.bestIntegrity, result.victory ? integrity : 0),
      plays: previous.plays + 1,
      wins: previous.wins + (result.victory ? 1 : 0),
      bestWave: Math.max(previous.bestWave, result.wavesCleared),
    },
  };

  const challengeResults = { ...profile.challengeResults };
  if (challenge) {
    const prev = challengeResults[challenge.id] ?? { completed: false, bestWave: 0, plays: 0 };
    challengeResults[challenge.id] = {
      completed: prev.completed || result.victory,
      bestWave: Math.max(prev.bestWave, result.wavesCleared),
      plays: prev.plays + 1,
    };
  }

  const seen = new Set(profile.codex.seen);
  const kills = { ...profile.codex.kills };
  for (const species of result.speciesSeen) seen.add(species);

  const next: PlayerProfile = {
    ...profile,
    amber: profile.amber + rewards.amber,
    mapResults,
    challengeResults,
    codex: { seen: [...seen], kills },
    stats: {
      ...profile.stats,
      kills: profile.stats.kills + result.kills,
      waves: profile.stats.waves + result.wavesCleared,
      matches: profile.stats.matches + 1,
      wins: profile.stats.wins + (result.victory ? 1 : 0),
      losses: profile.stats.losses + (result.victory ? 0 : 1),
      bosses: profile.stats.bosses + result.bossesDefeated,
      amberEarned: profile.stats.amberEarned + rewards.amber,
      playTimeMs: profile.stats.playTimeMs + result.durationMs,
    },
    lastMapId: map.id,
    updatedAt: Date.now(),
  };

  return {
    profile: next,
    result: {
      ...result,
      stars: rewards.stars,
      amberEarned: rewards.amber,
      amberBreakdown: rewards.breakdown,
      newlyUnlockedStars: rewards.newStars,
    },
  };
}
