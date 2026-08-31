import type { ConsoleMessage, Page } from '@playwright/test';
import { expect } from '@playwright/test';

/** Shape published by the in-game test bridge (see src/game/testBridge.ts). */
export interface SimState {
  simTimeMs: number;
  phase: string;
  paused: boolean;
  menuOpen: boolean;
  speed: number;
  supply: number;
  objectiveHp: number;
  kills: number;
  waveIndex: number;
  enemiesAlive: number;
  placements: number;
  ended: boolean;
}

/** The bridge is inert unless the page is opened with this flag. */
export const E2E_URL = '/?e2e=1';

export interface ErrorLog {
  readonly entries: string[];
}

/** Collects console errors and uncaught exceptions for a final assertion. */
export function watchForErrors(page: Page): ErrorLog {
  const entries: string[] = [];
  page.on('console', (m: ConsoleMessage) => {
    if (m.type() === 'error') entries.push(`console: ${m.text()}`);
  });
  page.on('pageerror', (e) => entries.push(`pageerror: ${e.message}`));
  return { entries };
}

export async function simState(page: Page): Promise<SimState | null> {
  return page.evaluate(() => {
    const bridge = (window as unknown as { __ctdTest?: { getState(): SimState | null } }).__ctdTest;
    return bridge ? bridge.getState() : null;
  });
}

/** Waits until the match scene is live and publishing state. */
export async function waitForMatch(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const canvas = document.querySelector('.match__stage canvas');
      const bridge = (window as unknown as { __ctdTest?: { getState(): unknown } }).__ctdTest;
      return !!canvas && canvas.getBoundingClientRect().width > 400 && !!bridge?.getState();
    },
    undefined,
    { timeout: 45_000 },
  );
}

/** Starts a fresh run of the starter map from the title screen. */
export async function enterResearchOutpost(page: Page): Promise<void> {
  await page.getByRole('button', { name: /begin deployment|^play$/i }).click();
  await page.locator('.map-card', { hasText: 'Research Outpost' }).getByRole('button', { name: /^deploy$/i }).click();
  await expect(page.locator('.briefing__grid')).toBeVisible();
  await page.getByRole('button', { name: /^deploy$/i }).first().click();
  await waitForMatch(page);
}

/** Converts map coordinates to page coordinates through the fitted canvas. */
async function toPage(page: Page, x: number, y: number) {
  const pt = await page.evaluate(
    ([wx, wy]) => {
      const bridge = (window as unknown as {
        __ctdTest?: { worldToPage(x: number, y: number): { x: number; y: number } | null };
      }).__ctdTest;
      return bridge ? bridge.worldToPage(wx, wy) : null;
    },
    [x, y],
  );
  if (!pt) throw new Error('test bridge unavailable; open the page with ?e2e=1');
  return pt;
}

/**
 * Selects a deployment card and places it at a map coordinate.
 * Returns false when the game rejects the position, so callers can try again.
 */
export async function placeAt(page: Page, cardName: string, x: number, y: number): Promise<boolean> {
  const pt = await toPage(page, x, y);

  // Move first: the scene evaluates the position when the card is picked up.
  await page.mouse.move(pt.x - 6, pt.y - 6);
  await page.mouse.move(pt.x, pt.y);

  await page.evaluate(() => {
    const active = document.querySelector<HTMLButtonElement>('.deploy-card.is-active');
    if (active) active.click();
  });
  const picked = await page.evaluate((name) => {
    const card = [...document.querySelectorAll<HTMLButtonElement>('.deploy-card')].find((c) =>
      (c.textContent ?? '').includes(name),
    );
    if (!card || card.disabled) return false;
    card.click();
    return true;
  }, cardName);
  if (!picked) return false;

  // Nudge so a pointermove is guaranteed after the card is held.
  await page.mouse.move(pt.x + 5, pt.y + 5);
  await page.mouse.move(pt.x, pt.y);
  await page.waitForTimeout(120);

  const legal = await page.evaluate(() => !!document.querySelector('.deploy__hint.is-ok'));
  if (!legal) {
    await page.keyboard.press('Escape');
    return false;
  }
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForTimeout(150);
  return true;
}

/** Open ground beside the Research Outpost route, in map coordinates. */
export const OUTPOST_SPOTS: [number, number][] = [
  [252, 214],
  [166, 236],
  [372, 300],
  [232, 372],
  [372, 470],
  [280, 604],
  [520, 560],
  [610, 520],
  [700, 300],
  [860, 300],
  [980, 460],
  [128, 96],
];

/** Places `count` defenders, returning how many the game accepted. */
export async function buildLine(page: Page, cardName: string, count: number): Promise<number> {
  let placed = 0;
  for (const [x, y] of OUTPOST_SPOTS) {
    if (placed >= count) break;
    if (await placeAt(page, cardName, x, y)) placed++;
  }
  await page.keyboard.press('Escape');
  return placed;
}

/**
 * Waits for the autosave debounce to land a profile matching `predicate`,
 * then returns it. Progression is written a moment after the state change.
 */
export async function waitForSave<T = Record<string, unknown>>(
  page: Page,
  predicate: (profile: T) => boolean,
  timeoutMs = 10_000,
): Promise<T> {
  await expect
    .poll(
      async () => {
        const save = await readSave(page);
        if (!save) return false;
        try {
          return predicate(save.profile as T);
        } catch {
          return false;
        }
      },
      { timeout: timeoutMs, message: 'expected the profile to be saved' },
    )
    .toBe(true);
  const save = await readSave(page);
  return save!.profile as T;
}

export async function readSave(page: Page) {
  return page.evaluate(() => {
    const raw = window.localStorage.getItem('ctd.save.v1');
    return raw ? (JSON.parse(raw) as { version: number; profile: Record<string, unknown> }) : null;
  });
}
