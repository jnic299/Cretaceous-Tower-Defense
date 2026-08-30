import { describe, expect, it } from 'vitest';
import { selectTarget, type TargetCandidate } from '../src/game/systems/targeting';

function make(x: number, y: number, hp: number, maxHp: number, progress: number): TargetCandidate {
  return { x, y, hp, maxHp, progress, alive: true };
}

const near = make(20, 0, 10, 10, 100);
const far = make(90, 0, 500, 900, 400);
const middle = make(50, 0, 60, 300, 250);
const all = [near, far, middle];

describe('targeting modes', () => {
  it('first picks whatever is furthest along the route', () => {
    expect(selectTarget(all, 0, 0, { mode: 'first', range: 200 })).toBe(far);
  });

  it('last picks the straggler', () => {
    expect(selectTarget(all, 0, 0, { mode: 'last', range: 200 })).toBe(near);
  });

  it('strongest picks the biggest health pool', () => {
    expect(selectTarget(all, 0, 0, { mode: 'strongest', range: 200 })).toBe(far);
  });

  it('weakest finishes off the most damaged target', () => {
    expect(selectTarget(all, 0, 0, { mode: 'weakest', range: 200 })).toBe(near);
  });

  it('closest picks by distance', () => {
    expect(selectTarget(all, 0, 0, { mode: 'closest', range: 200 })).toBe(near);
  });
});

describe('range', () => {
  it('ignores everything out of range', () => {
    expect(selectTarget(all, 0, 0, { mode: 'first', range: 30 })).toBe(near);
    expect(selectTarget(all, 0, 0, { mode: 'first', range: 5 })).toBeNull();
  });

  it('honours a minimum range', () => {
    const t = selectTarget(all, 0, 0, { mode: 'closest', range: 200, minRange: 40 });
    expect(t).toBe(middle);
  });

  it('skips dead candidates', () => {
    const dead = { ...far, alive: false };
    expect(selectTarget([dead], 0, 0, { mode: 'first', range: 500 })).toBeNull();
  });

  it('returns null for an empty field', () => {
    expect(selectTarget([], 0, 0, { mode: 'first', range: 500 })).toBeNull();
  });
});

describe('line of sight rejection', () => {
  it('skips targets the shooter cannot see', () => {
    const blocked = selectTarget(all, 0, 0, {
      mode: 'first',
      range: 200,
      canSee: (x) => x < 60,
    });
    expect(blocked).toBe(middle);
  });

  it('returns null when everything is behind cover', () => {
    expect(selectTarget(all, 0, 0, { mode: 'first', range: 200, canSee: () => false })).toBeNull();
  });
});
