import { expect, test } from '@playwright/test';
import {
  E2E_URL,
  buildLine,
  enterResearchOutpost,
  placeAt,
  readSave,
  simState,
  waitForMatch,
  waitForSave,
  watchForErrors,
} from './helpers';

/**
 * Integration smoke suite. Small on purpose: it covers the seams that unit
 * tests cannot reach — the engine mounting, the simulation clock responding to
 * pause and speed, progression surviving a reload — and nothing that is
 * already covered by Vitest.
 */

test.describe('Cretaceous Tower Defense — smoke', () => {
  test('reaches a playable title screen with no console errors', async ({ page }) => {
    const errors = watchForErrors(page);
    await page.goto(E2E_URL);

    await expect(page.locator('.title__logo')).toBeVisible();
    await expect(page.getByRole('button', { name: /begin deployment|^play$/i })).toBeVisible();
    await expect(page.locator('.map-card')).toHaveCount(0);

    expect(errors.entries).toEqual([]);
  });

  test('a fresh profile can enter Research Outpost, place a defender and start a wave', async ({ page }) => {
    const errors = watchForErrors(page);
    await page.goto(E2E_URL);
    await enterResearchOutpost(page);

    const start = await simState(page);
    expect(start).not.toBeNull();
    expect(start!.placements).toBe(0);
    expect(start!.supply).toBeGreaterThan(0);

    // A fresh profile carries only the starting kit.
    await expect(page.locator('.deploy-card')).toHaveCount(2);
    // The guided run offers coaching on a first launch.
    await expect(page.locator('.coach')).toBeVisible();

    const placed = await buildLine(page, 'Ranger', 3);
    expect(placed).toBeGreaterThanOrEqual(1);

    const afterPlacing = await simState(page);
    expect(afterPlacing!.placements).toBe(placed);
    expect(afterPlacing!.supply).toBeLessThan(start!.supply);

    // Start the wave early and confirm enemies actually arrive.
    await page.keyboard.press('e');
    await page.waitForFunction(
      () => {
        const s = (window as unknown as { __ctdTest?: { getState(): { enemiesAlive: number } | null } })
          .__ctdTest?.getState();
        return !!s && s.enemiesAlive > 0;
      },
      undefined,
      { timeout: 30_000 },
    );

    expect(errors.entries).toEqual([]);
  });

  test('speed controls scale simulation time without throwing', async ({ page }) => {
    const errors = watchForErrors(page);
    await page.goto(E2E_URL);
    await enterResearchOutpost(page);

    /** Simulation milliseconds consumed over a fixed slice of real time. */
    const simPerRealSecond = async (): Promise<number> => {
      const before = (await simState(page))!.simTimeMs;
      await page.waitForTimeout(1500);
      const after = (await simState(page))!.simTimeMs;
      return ((after - before) / 1500) * 1000;
    };

    await page.keyboard.press('1');
    const atOne = await simPerRealSecond();
    expect((await simState(page))!.speed).toBe(1);
    // Only that the clock is running; a headless renderer may drop frames,
    // and long frames are deliberately clamped rather than fast-forwarded.
    expect(atOne).toBeGreaterThan(100);

    await page.keyboard.press('3');
    expect((await simState(page))!.speed).toBe(3);
    const atThree = await simPerRealSecond();

    // 3x must consume simulation time roughly three times as fast. Generous
    // bounds: this asserts the wiring, not frame-level precision.
    expect(atThree / atOne).toBeGreaterThan(1.8);
    expect(atThree / atOne).toBeLessThan(4.2);

    expect(errors.entries).toEqual([]);
  });

  test('pause freezes the simulation clock', async ({ page }) => {
    const errors = watchForErrors(page);
    await page.goto(E2E_URL);
    await enterResearchOutpost(page);

    await page.keyboard.press('3');
    await page.waitForTimeout(400);
    await page.keyboard.press('Space');
    await expect(page.locator('.hud-paused')).toBeVisible();

    const before = (await simState(page))!;
    expect(before.paused).toBe(true);
    await page.waitForTimeout(2500);
    const after = (await simState(page))!;

    // The whole point: real seconds passed, simulation seconds did not.
    expect(after.simTimeMs).toBe(before.simTimeMs);

    await page.keyboard.press('Space');
    await page.waitForTimeout(600);
    expect((await simState(page))!.simTimeMs).toBeGreaterThan(before.simTimeMs);

    expect(errors.entries).toEqual([]);
  });

  test('the operation menu freezes gameplay and restores the prior state', async ({ page }) => {
    const errors = watchForErrors(page);
    await page.goto(E2E_URL);
    await enterResearchOutpost(page);

    // Running -> open menu -> frozen.
    await page.locator('.hud-menu-btn').click();
    await expect(page.getByRole('dialog')).toBeVisible();
    const frozen = (await simState(page))!;
    expect(frozen.menuOpen).toBe(true);
    await page.waitForTimeout(1600);
    expect((await simState(page))!.simTimeMs).toBe(frozen.simTimeMs);

    // Close -> resumes, because the player never paused explicitly.
    await page.getByRole('button', { name: /^resume$/i }).click();
    await page.waitForTimeout(700);
    const resumed = (await simState(page))!;
    expect(resumed.menuOpen).toBe(false);
    expect(resumed.paused).toBe(false);
    expect(resumed.simTimeMs).toBeGreaterThan(frozen.simTimeMs);

    // Explicitly paused -> menu -> close -> still paused.
    await page.keyboard.press('Space');
    expect((await simState(page))!.paused).toBe(true);
    await page.locator('.hud-menu-btn').click();
    await page.getByRole('button', { name: /^resume$/i }).click();
    await page.waitForTimeout(700);
    const stillPaused = (await simState(page))!;
    expect(stillPaused.paused).toBe(true);
    const t = stillPaused.simTimeMs;
    await page.waitForTimeout(1200);
    expect((await simState(page))!.simTimeMs).toBe(t);

    expect(errors.entries).toEqual([]);
  });

  test('abandoning records a loss and pays partial progression', async ({ page }) => {
    const errors = watchForErrors(page);
    await page.goto(E2E_URL);
    await enterResearchOutpost(page);

    await buildLine(page, 'Ranger', 3);
    await page.keyboard.press('e');
    await page.keyboard.press('3');

    // Clear at least one wave so there is progress worth keeping.
    await page.waitForFunction(
      () => {
        const s = (window as unknown as { __ctdTest?: { getState(): { waveIndex: number } | null } })
          .__ctdTest?.getState();
        return !!s && s.waveIndex >= 2;
      },
      undefined,
      { timeout: 60_000 },
    );

    await page.locator('.hud-menu-btn').click();
    await page.getByRole('button', { name: /abandon operation/i }).click();

    // The engine's end-of-match path runs, so results are shown, not skipped.
    await expect(page.locator('.results__banner h2')).toHaveText(/operation abandoned/i);
    await expect(page.locator('.results__banner')).toHaveClass(/is-loss/);

    // Nothing keeps simulating behind the transition: the scene tears down and
    // stops publishing. Polled, because teardown follows the React unmount.
    await expect
      .poll(async () => (await simState(page)) === null, { timeout: 10_000 })
      .toBe(true);
    await expect(page.locator('.stars .star--on')).toHaveCount(0);

    const profile = await waitForSave<{
      amber: number;
      stats: { losses: number; wins: number; matches: number; kills: number };
      mapResults: Record<string, { cleared: boolean; stars: number }>;
    }>(page, (p) => p.stats.matches === 1);
    expect(profile.amber).toBeGreaterThan(0);
    expect(profile.stats.losses).toBe(1);
    expect(profile.stats.wins).toBe(0);
    expect(profile.stats.matches).toBe(1);
    expect(profile.mapResults.researchOutpost.cleared).toBe(false);
    expect(profile.mapResults.researchOutpost.stars).toBe(0);

    expect(errors.entries).toEqual([]);
  });

  test('tutorial completion and progression survive a reload', async ({ page }) => {
    const errors = watchForErrors(page);
    await page.goto(E2E_URL);
    await enterResearchOutpost(page);

    // The guided run is showing.
    await expect(page.locator('.coach')).toBeVisible();
    await buildLine(page, 'Ranger', 2);
    await page.keyboard.press('e');
    await page.keyboard.press('3');
    await page.waitForFunction(
      () => {
        const s = (window as unknown as { __ctdTest?: { getState(): { waveIndex: number } | null } })
          .__ctdTest?.getState();
        return !!s && s.waveIndex >= 2;
      },
      undefined,
      { timeout: 60_000 },
    );

    await page.locator('.hud-menu-btn').click();
    await page.getByRole('button', { name: /abandon operation/i }).click();
    await expect(page.locator('.results__banner')).toBeVisible();

    const beforeProfile = await waitForSave<{ amber: number; tutorialCompleted: boolean }>(
      page,
      (p) => p.tutorialCompleted === true,
    );
    expect(beforeProfile.amber).toBeGreaterThan(0);

    await page.reload();
    await expect(page.locator('.title__logo')).toBeVisible();

    const after = await readSave(page);
    const afterProfile = after!.profile as { amber: number; tutorialCompleted: boolean };
    expect(afterProfile.tutorialCompleted).toBe(true);
    expect(afterProfile.amber).toBe(beforeProfile.amber);
    await expect(page.locator('.amber-badge__value')).toHaveText(String(beforeProfile.amber));

    // A second run of the same map no longer starts in tutorial mode.
    await enterResearchOutpost(page);
    await expect(page.locator('.coach')).toHaveCount(0);

    expect(errors.entries).toEqual([]);
  });

  test('placement rules reject the route and accept open ground', async ({ page }) => {
    const errors = watchForErrors(page);
    await page.goto(E2E_URL);
    await enterResearchOutpost(page);

    // A point on the travelled road is refused, with a reason.
    const onRoute = await placeAt(page, 'Ranger', 208, 148);
    expect(onRoute).toBe(false);

    const onOpenGround = await placeAt(page, 'Ranger', 166, 236);
    expect(onOpenGround).toBe(true);
    expect((await simState(page))!.placements).toBe(1);

    expect(errors.entries).toEqual([]);
  });

  test('a second match in the same session is clean', async ({ page }) => {
    // Regression: the scene only listened for Phaser's SHUTDOWN event, but
    // destroying the game emits DESTROY. Teardown never ran, so every match
    // leaked a command-bus subscriber and left its music playing.
    const errors = watchForErrors(page);
    await page.goto(E2E_URL);

    await enterResearchOutpost(page);
    expect(await buildLine(page, 'Ranger', 1)).toBe(1);
    await page.locator('.hud-menu-btn').click();
    await page.getByRole('button', { name: /abandon operation/i }).click();
    await expect(page.locator('.results__banner')).toBeVisible();

    // Back out to the map list and run the level again, without reloading.
    await page.getByRole('button', { name: /^continue$/i }).click();
    await expect(page.locator('.map-grid')).toBeVisible();
    await page
      .locator('.map-card', { hasText: 'Research Outpost' })
      .getByRole('button', { name: /^deploy$/i })
      .click();
    await page.getByRole('button', { name: /^deploy$/i }).first().click();
    await waitForMatch(page);

    // A stale subscriber from the first match would corrupt this one.
    const second = (await simState(page))!;
    expect(second.placements).toBe(0);
    expect(second.simTimeMs).toBeLessThan(2000);
    expect(await buildLine(page, 'Ranger', 1)).toBe(1);
    expect((await simState(page))!.placements).toBe(1);

    await page.keyboard.press('Space');
    expect((await simState(page))!.paused).toBe(true);

    expect(errors.entries).toEqual([]);
  });

  test('deployment tooltips stay inside the viewport', async ({ page }) => {
    // Regression: the bubble is centred on its trigger, so the leftmost card's
    // tooltip ran off the edge of `.app`, which clips overflow — it rendered
    // as a chopped-off panel with the unit's name cut in half.
    const errors = watchForErrors(page);
    await page.goto(E2E_URL);
    await enterResearchOutpost(page);

    const cards = page.locator('.deploy-card');
    const count = await cards.count();
    expect(count).toBeGreaterThan(1);

    for (const index of [0, count - 1]) {
      await cards.nth(index).hover();
      const bubble = page.locator('.tip__bubble');
      await expect(bubble).toBeVisible();

      const fits = await page.evaluate(() => {
        const el = document.querySelector('.tip__bubble');
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { left: r.left, right: r.right, width: r.width, viewport: window.innerWidth };
      });
      expect(fits).not.toBeNull();
      expect(fits!.width).toBeGreaterThan(100);
      expect(fits!.left).toBeGreaterThanOrEqual(0);
      expect(fits!.right).toBeLessThanOrEqual(fits!.viewport);

      // Move away so the next hover re-measures from scratch.
      await page.mouse.move(700, 300);
      await expect(bubble).toHaveCount(0);
    }

    expect(errors.entries).toEqual([]);
  });

  test('the test bridge is absent during normal play', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.title__logo')).toBeVisible();
    const exposed = await page.evaluate(
      () => '__ctdTest' in (window as unknown as Record<string, unknown>),
    );
    expect(exposed).toBe(false);
  });
});
