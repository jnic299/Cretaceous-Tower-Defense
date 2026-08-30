import type { MapDef } from '../game/types';
import type { PlayerProfile } from '../persistence/schema';

/** Objective integrity needed for the second and third star. */
export const STAR_THRESHOLDS = { two: 0.5, three: 0.8 } as const;

/** Amber granted per wave cleared, even in a loss. */
export const AMBER_PER_WAVE = 4;
/** Amber granted for each boss put down. */
export const AMBER_PER_BOSS = 45;

export interface RewardInput {
  map: MapDef;
  victory: boolean;
  objectiveHpRemaining: number;
  objectiveHpMax: number;
  wavesCleared: number;
  bossesDefeated: number;
  challengeId?: string;
  challengeAmber?: number;
  challengeAlreadyDone?: boolean;
}

export interface RewardOutcome {
  stars: 0 | 1 | 2 | 3;
  amber: number;
  breakdown: { label: string; amount: number }[];
  newStars: number;
  firstClear: boolean;
}

export function starsFor(victory: boolean, integrity: number): 0 | 1 | 2 | 3 {
  if (!victory) return 0;
  if (integrity >= STAR_THRESHOLDS.three) return 3;
  if (integrity >= STAR_THRESHOLDS.two) return 2;
  return 1;
}

/**
 * Amber is paid for progress, not for grinding: waves and bosses always pay,
 * first clears and *newly earned* stars pay once. Replaying a three-star map
 * still earns wave amber but never re-pays the star bonus.
 */
export function computeRewards(input: RewardInput, profile: PlayerProfile): RewardOutcome {
  const integrity = input.objectiveHpMax > 0 ? input.objectiveHpRemaining / input.objectiveHpMax : 0;
  const stars = starsFor(input.victory, integrity);
  const previous = profile.mapResults[input.map.id];
  const previousStars = previous?.stars ?? 0;
  const newStars = Math.max(0, stars - previousStars);
  const firstClear = input.victory && !previous?.cleared;

  const breakdown: { label: string; amount: number }[] = [];
  const add = (label: string, amount: number) => {
    if (amount > 0) breakdown.push({ label, amount: Math.round(amount) });
  };

  add(`Waves cleared (${input.wavesCleared})`, input.wavesCleared * AMBER_PER_WAVE);
  add(`Bosses defeated (${input.bossesDefeated})`, input.bossesDefeated * AMBER_PER_BOSS);
  if (firstClear) add('First clear bonus', input.map.firstClearAmber);
  if (newStars > 0) add(`New stars (${newStars})`, newStars * input.map.amberPerStar);
  if (input.victory && input.challengeId && input.challengeAmber && !input.challengeAlreadyDone) {
    add('Challenge complete', input.challengeAmber);
  }

  const amber = breakdown.reduce((sum, b) => sum + b.amount, 0);
  return { stars, amber, breakdown, newStars, firstClear };
}
