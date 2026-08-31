import { describe, expect, it } from 'vitest';
import { EconomySystem } from '../src/game/systems/EconomySystem';

describe('EconomySystem', () => {
  it('starts with the map budget and counts it as earned', () => {
    const e = new EconomySystem(260);
    expect(e.supply).toBe(260);
    expect(e.earned).toBe(260);
    expect(e.spent).toBe(0);
  });

  it('spends only what it has', () => {
    const e = new EconomySystem(100);
    expect(e.spend(45)).toBe(true);
    expect(e.supply).toBe(55);
    expect(e.spend(100)).toBe(false);
    expect(e.supply).toBe(55);
    expect(e.spent).toBe(45);
  });

  it('reports affordability without spending', () => {
    const e = new EconomySystem(50);
    expect(e.canAfford(50)).toBe(true);
    expect(e.canAfford(51)).toBe(false);
    expect(e.supply).toBe(50);
  });

  it('adds bounties to both the balance and the earned total', () => {
    const e = new EconomySystem(0);
    e.add(30);
    e.add(-5);
    expect(e.supply).toBe(30);
    expect(e.earned).toBe(30);
  });

  it('refunds a sale without inflating the earned figure', () => {
    const e = new EconomySystem(100);
    e.spend(45);
    const earnedBefore = e.earned;
    e.refund(31);
    expect(e.supply).toBe(86);
    expect(e.earned).toBe(earnedBefore);
    expect(e.spent).toBe(14);
    // A refund returns the Supply but does not rewrite history: the lifetime
    // statistic is built from the gross figure.
    expect(e.grossSpent).toBe(45);
  });

  it('never lets a refund reduce the gross spend', () => {
    const e = new EconomySystem(300);
    e.spend(45);
    e.spend(95);
    e.refund(31);
    e.spend(60);
    expect(e.grossSpent).toBe(200);
    expect(e.spent).toBe(169);
  });

  it('never reports a negative spend', () => {
    const e = new EconomySystem(100);
    e.refund(500);
    expect(e.spent).toBe(0);
  });
});
