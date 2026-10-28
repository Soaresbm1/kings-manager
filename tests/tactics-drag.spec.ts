import { test, expect, type Locator, type Page } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    let state = 20261028;
    Math.random = () => ((state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 4294967296);
  });
  await page.route('https://kingsleague-cdn.kama.football/**', route => route.abort());
  await page.setViewportSize({ width: 1920, height: 1080 });
});

async function openTactics(page: Page) {
  await page.goto('/');
  await page.locator('#league-sidebar').getByText('France', { exact: false }).click();
  await page.locator('#team-choice').getByText('360 Nation', { exact: true }).click();
  await page.locator('#btn-start').click();
  await page.locator('.nav button[data-tab="tactics"]').click();
}

function slot(page: Page, index: number) {
  return page.locator(`#tactics-pitch-field .pitch-slot[data-slot-index="${index}"]`);
}

async function composition(page: Page): Promise<string[]> {
  return page.locator('#tactics-pitch-field .pitch-slot').evaluateAll(elements => elements.map(element => element.getAttribute('data-player-id') || ''));
}

function exchanged(before: string[], first: string, second: string): string[] {
  return before.map(id => id === first ? second : id === second ? first : id);
}

async function expectComposition(page: Page, expected: string[]) {
  await expect.poll(() => composition(page)).toEqual(expected);
  expect(expected).toHaveLength(7);
  expect(new Set(expected).size).toBe(7);
  expect(expected.every(Boolean)).toBe(true);
  const tactic = await page.evaluate(() => {
    const map = JSON.parse(localStorage.getItem('kingsManager7v7_saves') || '{}') as Record<string, any>;
    return Object.values(map)[0].data.savedTactic;
  });
  expect(tactic.assignments).toEqual(expected);
  expect(tactic.assignmentsOOP).toEqual(expected);
  expect(tactic.formationOOP).toBe(tactic.formation);
}

async function center(locator: Locator) {
  const rect = await locator.boundingBox();
  expect(rect).not.toBeNull();
  return { x: rect!.x + rect!.width / 2, y: rect!.y + rect!.height / 2 };
}

async function mouseDrop(page: Page, source: Locator, target: Locator, cancel?: 'escape') {
  await target.scrollIntoViewIfNeeded();
  await source.scrollIntoViewIfNeeded();
  const from = await center(source);
  const to = await center(target);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 16 });
  if (cancel === 'escape') await page.keyboard.press('Escape');
  await page.mouse.up();
}

test('le glisser-déposer modifie la composition unique puis conserve les places après rechargement', async ({ page }) => {
  await openTactics(page);
  const before = await composition(page);
  const first = before[1], second = before[2];
  await mouseDrop(page, slot(page, 1), slot(page, 2));
  const afterFirst = exchanged(before, first, second);
  await expectComposition(page, afterFirst);
  // Un joueur de champ peut aussi échanger avec une autre ligne.
  const attacker = afterFirst[5];
  await mouseDrop(page, slot(page, afterFirst.indexOf(first)), slot(page, afterFirst.indexOf(attacker)));
  const expected = exchanged(afterFirst, first, attacker);
  await expectComposition(page, expected);
  await expect(page.locator('#tactics-formation-choice').getByRole('button', { name: '2-2-2', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#tab-tactics .pitch-field:visible')).toHaveCount(1);
  await page.locator('#btn-restart').click();
  await page.reload();
  await page.locator('#saves-list .transfer-row').filter({ hasText: '360 Nation' }).getByRole('button', { name: 'Continuer', exact: true }).click();
  await page.locator('.nav button[data-tab="tactics"]').click();
  await expectComposition(page, expected);
});

test('un joueur du banc remplace le titulaire et les gestes invalides ne changent rien', async ({ page }) => {
  await openTactics(page);
  await page.locator('#tactics-bench-filters').getByRole('button', { name: 'GK', exact: true }).click();
  const before = await composition(page);
  const original = before[0];
  const keeperIds = await page.locator('#tactics-bench-list .player-row').evaluateAll(elements => elements.map(element => element.getAttribute('data-player-id') || ''));
  const replacement = keeperIds.find(id => !before.includes(id));
  expect(replacement).toBeTruthy();
  const replacementRow = page.locator(`#tactics-bench-list .player-row[data-player-id="${replacement}"]`);
  await mouseDrop(page, replacementRow.locator('.tactic-player-main'), slot(page, 0));
  const expected = before.map(id => id === original ? replacement! : id);
  await expectComposition(page, expected);
  await mouseDrop(page, slot(page, 0), slot(page, 1));
  await expectComposition(page, expected);
  await mouseDrop(page, slot(page, 1), slot(page, 0));
  await expectComposition(page, expected);
  const heading = page.locator('#tab-tactics .tactics-page-heading h2');
  await mouseDrop(page, slot(page, 1), heading);
  await expectComposition(page, expected);
  await mouseDrop(page, slot(page, 1), slot(page, 3), 'escape');
  await expectComposition(page, expected);
});

test('le déplacement tactile après appui prolongé et le choix au clavier modifient la composition', async ({ page, browserName }) => {
  await openTactics(page);
  let expected = await composition(page);
  if (browserName === 'chromium') {
    const source = slot(page, 3), target = slot(page, 4);
    await target.scrollIntoViewIfNeeded();
    await source.scrollIntoViewIfNeeded();
    const from = await center(source), to = await center(target);
    const session = await page.context().newCDPSession(page);
    await session.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
    const point = (x: number, y: number) => ({ x, y, id: 1, radiusX: 1, radiusY: 1, force: 1 });
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point(from.x, from.y)] });
    // Le délai fait partie du geste : un appui court doit rester un clic.
    await page.waitForTimeout(360);
    for (let step = 1; step <= 12; step++) {
      await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point(from.x + (to.x - from.x) * step / 12, from.y + (to.y - from.y) * step / 12)] });
    }
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await session.send('Emulation.setTouchEmulationEnabled', { enabled: false });
    await session.detach();
    expected = exchanged(expected, expected[3], expected[4]);
    await expectComposition(page, expected);
  }
  const first = expected[1], second = expected[2];
  await slot(page, 1).press('Enter');
  await slot(page, 2).press('Enter');
  await expectComposition(page, exchanged(expected, first, second));
});
