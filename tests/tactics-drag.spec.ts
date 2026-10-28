import { test, expect, type Locator, type Page } from '@playwright/test';

type Phases = { withBall: string[]; withoutBall: string[] };

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

function slot(page: Page, phase: 'in' | 'out', index: number) {
  return page.locator(`#${phase === 'in' ? 'tactics-pitch-field' : 'tactics-oop-pitch-field'} .pitch-slot[data-slot-index="${index}"]`);
}

async function phases(page: Page): Promise<Phases> {
  const read = (id: string) => page.locator(`#${id} .pitch-slot`).evaluateAll(elements => elements.map(element => element.getAttribute('data-player-id') || ''));
  return { withBall: await read('tactics-pitch-field'), withoutBall: await read('tactics-oop-pitch-field') };
}

function exchanged(before: Phases, first: string, second: string): Phases {
  const swap = (ids: string[]) => ids.map(id => id === first ? second : id === second ? first : id);
  return { withBall: swap(before.withBall), withoutBall: swap(before.withoutBall) };
}

async function expectPhases(page: Page, expected: Phases) {
  await expect.poll(() => phases(page)).toEqual(expected);
  for (const ids of Object.values(expected)) {
    expect(ids).toHaveLength(7);
    expect(new Set(ids).size).toBe(7);
    expect(ids.every(Boolean)).toBe(true);
  }
  expect([...expected.withBall].sort()).toEqual([...expected.withoutBall].sort());
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

test('le glisser-déposer échange les mêmes joueurs dans deux formations puis conserve ces places après rechargement', async ({ page }) => {
  await openTactics(page);
  await page.locator('#tactics-view-mode-choice').getByRole('button', { name: 'Comparer', exact: true }).click();
  await page.locator('#tactics-oop-formation-choice').getByRole('button', { name: '3-2-1', exact: true }).click();

  const before = await phases(page);
  const first = before.withBall[1], second = before.withBall[2];
  await mouseDrop(page, slot(page, 'in', 1), slot(page, 'in', 2));
  const afterFirst = exchanged(before, first, second);
  await expectPhases(page, afterFirst);

  // Le geste peut commencer dans le plan défensif ; les indices de poste
  // diffèrent entre les formations, mais les deux identités restent liées.
  const attacker = afterFirst.withBall[5];
  const outSourceIndex = afterFirst.withoutBall.indexOf(first);
  const outTargetIndex = afterFirst.withoutBall.indexOf(attacker);
  await mouseDrop(page, slot(page, 'out', outSourceIndex), slot(page, 'out', outTargetIndex));
  const expected = exchanged(afterFirst, first, attacker);
  await expectPhases(page, expected);
  await expect(page.locator('#tactics-formation-choice').getByRole('button', { name: '2-2-2', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#tactics-oop-formation-choice').getByRole('button', { name: '3-2-1', exact: true })).toHaveAttribute('aria-pressed', 'true');

  await page.locator('#btn-restart').click();
  await page.reload();
  await page.locator('#saves-list .transfer-row').filter({ hasText: '360 Nation' }).getByRole('button', { name: 'Continuer', exact: true }).click();
  await page.locator('.nav button[data-tab="tactics"]').click();
  await expectPhases(page, expected);
});

test('un joueur du banc remplace le titulaire dans les deux phases et les gestes invalides ne changent rien', async ({ page }) => {
  await openTactics(page);
  await page.locator('#tactics-view-mode-choice').getByRole('button', { name: 'Sans ballon', exact: true }).click();
  await page.locator('#tactics-bench-filters').getByRole('button', { name: 'GK', exact: true }).click();
  const before = await phases(page);
  const original = before.withBall[0];
  const keeperIds = await page.locator('#tactics-bench-list .player-row').evaluateAll(elements => elements.map(element => element.getAttribute('data-player-id') || ''));
  const replacement = keeperIds.find(id => !before.withBall.includes(id));
  expect(replacement).toBeTruthy();
  const replacementRow = page.locator(`#tactics-bench-list .player-row[data-player-id="${replacement}"]`);
  await mouseDrop(page, replacementRow.locator('.tactic-player-main'), slot(page, 'out', 0));
  const replace = (ids: string[]) => ids.map(id => id === original ? replacement! : id);
  const expected = { withBall: replace(before.withBall), withoutBall: replace(before.withoutBall) };
  await expectPhases(page, expected);

  await mouseDrop(page, slot(page, 'out', 0), slot(page, 'out', 1));
  await expectPhases(page, expected);
  await mouseDrop(page, slot(page, 'out', 1), slot(page, 'out', 0));
  await expectPhases(page, expected);

  const heading = page.locator('#tab-tactics .tactics-page-heading h2');
  await mouseDrop(page, slot(page, 'out', 1), heading);
  await expectPhases(page, expected);
  await mouseDrop(page, slot(page, 'out', 1), slot(page, 'out', 3), 'escape');
  await expectPhases(page, expected);
});

test('le déplacement tactile après appui prolongé et le choix au clavier synchronisent les deux phases', async ({ page, browserName }) => {
  await openTactics(page);
  await page.locator('#tactics-view-mode-choice').getByRole('button', { name: 'Comparer', exact: true }).click();
  let expected = await phases(page);

  if (browserName === 'chromium') {
    const source = slot(page, 'in', 3), target = slot(page, 'in', 4);
    await target.scrollIntoViewIfNeeded();
    await source.scrollIntoViewIfNeeded();
    const from = await center(source), to = await center(target);
    const session = await page.context().newCDPSession(page);
    await session.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
    const point = (x: number, y: number) => ({ x, y, id: 1, radiusX: 1, radiusY: 1, force: 1 });
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point(from.x, from.y)] });
    // Le délai fait partie du geste testé, pour distinguer le déplacement
    // intentionnel du défilement tactile habituel du terrain.
    await page.waitForTimeout(360);
    for (let step = 1; step <= 12; step++) {
      await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point(from.x + (to.x - from.x) * step / 12, from.y + (to.y - from.y) * step / 12)] });
    }
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await session.send('Emulation.setTouchEmulationEnabled', { enabled: false });
    await session.detach();
    expected = exchanged(expected, expected.withBall[3], expected.withBall[4]);
    await expectPhases(page, expected);
  }

  const first = expected.withBall[1], second = expected.withBall[2];
  await slot(page, 'in', 1).press('Enter');
  await slot(page, 'in', 2).press('Enter');
  await expectPhases(page, exchanged(expected, first, second));
});
