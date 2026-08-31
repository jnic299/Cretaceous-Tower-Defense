import { describe, expect, it } from 'vitest';
import { MAX_FRAME_MS, SimulationClock, simulationStepMs } from '../src/game/systems/SimulationClock';

describe('simulationStepMs', () => {
  it('scales a real frame by the game speed', () => {
    expect(simulationStepMs(16, 1, false)).toBe(16);
    expect(simulationStepMs(16, 2, false)).toBe(32);
    expect(simulationStepMs(16, 3, false)).toBe(48);
  });

  it('consumes no simulation time while frozen, at any speed', () => {
    for (const speed of [1, 2, 3]) {
      expect(simulationStepMs(16, speed, true)).toBe(0);
      expect(simulationStepMs(5000, speed, true)).toBe(0);
    }
  });

  it('clamps a stalled frame so a slow tab cannot teleport the wave', () => {
    expect(simulationStepMs(100_000, 1, false)).toBe(MAX_FRAME_MS);
    expect(simulationStepMs(100_000, 3, false)).toBe(MAX_FRAME_MS * 3);
  });

  it('never returns a negative step', () => {
    expect(simulationStepMs(-50, 2, false)).toBe(0);
  });
});

describe('SimulationClock', () => {
  it('starts at zero and advances by the step given', () => {
    const clock = new SimulationClock();
    expect(clock.now).toBe(0);
    clock.advance(16);
    clock.advance(16);
    expect(clock.now).toBe(32);
  });

  it('ignores zero and negative advances, which is how pause is expressed', () => {
    const clock = new SimulationClock();
    clock.advance(100);
    for (let i = 0; i < 500; i++) clock.advance(0);
    expect(clock.now).toBe(100);
  });

  it('runs a scheduled callback once the delay has elapsed in simulation time', () => {
    const clock = new SimulationClock();
    let fired = 0;
    clock.schedule(100, () => fired++);

    clock.advance(60);
    expect(fired).toBe(0);
    clock.advance(60);
    expect(fired).toBe(1);
    clock.advance(1000);
    expect(fired).toBe(1);
  });

  it('fires callbacks in due order regardless of scheduling order', () => {
    const clock = new SimulationClock();
    const order: string[] = [];
    clock.schedule(300, () => order.push('c'));
    clock.schedule(100, () => order.push('a'));
    clock.schedule(200, () => order.push('b'));
    clock.advance(500);
    expect(order).toEqual(['a', 'b', 'c']);
  });

  it('holds callbacks indefinitely while frozen', () => {
    const clock = new SimulationClock();
    let fired = 0;
    clock.schedule(50, () => fired++);
    // A long real-time pause is simply many zero-length advances.
    for (let i = 0; i < 2000; i++) clock.advance(simulationStepMs(16, 3, true));
    expect(fired).toBe(0);
    expect(clock.now).toBe(0);
    clock.advance(50);
    expect(fired).toBe(1);
  });

  it('lets a scheduled callback be cancelled', () => {
    const clock = new SimulationClock();
    let fired = 0;
    const id = clock.schedule(50, () => fired++);
    clock.cancel(id);
    clock.advance(500);
    expect(fired).toBe(0);
  });

  it('drops everything pending on clear, so nothing lands after a match ends', () => {
    const clock = new SimulationClock();
    let fired = 0;
    for (let i = 1; i <= 5; i++) clock.schedule(i * 100, () => fired++);
    expect(clock.pendingCount).toBe(5);
    clock.advance(150);
    expect(fired).toBe(1);
    clock.clear();
    clock.advance(10_000);
    expect(fired).toBe(1);
    expect(clock.pendingCount).toBe(0);
  });

  it('runs work a callback schedules for the same instant', () => {
    const clock = new SimulationClock();
    const seen: number[] = [];
    clock.schedule(10, () => {
      seen.push(1);
      clock.schedule(0, () => seen.push(2));
    });
    clock.advance(20);
    expect(seen).toEqual([1, 2]);
  });

  it('resets for a fresh match', () => {
    const clock = new SimulationClock();
    clock.schedule(10, () => {});
    clock.advance(500);
    clock.reset();
    expect(clock.now).toBe(0);
    expect(clock.pendingCount).toBe(0);
  });

  it('reaches the same time whatever speed consumed it', () => {
    const at = (speed: number, frameMs: number, frames: number) => {
      const clock = new SimulationClock();
      for (let i = 0; i < frames; i++) clock.advance(simulationStepMs(frameMs, speed, false));
      return clock.now;
    };
    // 48ms of simulation per step in every case; a third of the frames at 3x.
    expect(at(1, 48, 60)).toBe(2880);
    expect(at(2, 24, 60)).toBe(2880);
    expect(at(3, 16, 60)).toBe(2880);
  });
});
