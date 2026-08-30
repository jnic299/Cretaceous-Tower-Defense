import type { TargetMode } from '../types';

/** Minimum surface a targetable entity must expose. */
export interface TargetCandidate {
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  /** Arc length travelled along the route; higher means closer to the objective. */
  progress: number;
  alive: boolean;
}

export interface TargetingOptions {
  mode: TargetMode;
  range: number;
  minRange?: number;
  /** Return false to reject a target whose firing line is blocked. */
  canSee?: (x: number, y: number) => boolean;
}

/**
 * Scores candidates for a single mode and returns the best in-range,
 * visible one. Pure and generic so both defenders and heroes use it, and so
 * the line-of-sight rejection can be exercised without a running scene.
 */
export function selectTarget<T extends TargetCandidate>(
  candidates: readonly T[],
  originX: number,
  originY: number,
  options: TargetingOptions,
): T | null {
  const { mode, range, minRange = 0, canSee } = options;
  const rangeSq = range * range;
  const minSq = minRange * minRange;

  let best: T | null = null;
  let bestScore = -Infinity;

  for (const c of candidates) {
    if (!c.alive) continue;
    const dx = c.x - originX;
    const dy = c.y - originY;
    const dSq = dx * dx + dy * dy;
    if (dSq > rangeSq || dSq < minSq) continue;
    if (canSee && !canSee(c.x, c.y)) continue;

    let score: number;
    switch (mode) {
      case 'first':
        score = c.progress;
        break;
      case 'last':
        score = -c.progress;
        break;
      case 'strongest':
        // Prefer the biggest health pool; break ties toward the leader.
        score = c.maxHp * 1000 + c.progress;
        break;
      case 'weakest':
        score = -(c.hp * 1000) + c.progress;
        break;
      case 'closest':
        score = -dSq;
        break;
    }

    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }

  return best;
}

export const TARGET_MODE_LABELS: Record<TargetMode, string> = {
  first: 'First',
  last: 'Last',
  strongest: 'Strongest',
  weakest: 'Weakest',
  closest: 'Closest',
};

export const TARGET_MODE_HINTS: Record<TargetMode, string> = {
  first: 'Whichever is furthest along the route.',
  last: 'The straggler at the back of the group.',
  strongest: 'The largest health pool in range.',
  weakest: 'Finishes off the most damaged target.',
  closest: 'Whatever is nearest, regardless of threat.',
};
