import { test, expect, type Locator, type Page } from '@playwright/test';

declare const STATE: any;
declare const lineupSetup: any;
declare const matchState: any;
declare const matchEngine: any;

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    let state = 20261030;
    Math.random = () => ((state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 4294967296);
  });
  await page.route('https://kingsleague-cdn.kama.football/**', route => route.abort());
  await page.setViewportSize({ width: 1920, height: 1080 });
});

async function openLineup(page: Page) {
  await page.goto('/');
  await page.locator('#league-sidebar').getByText('France', { exact: false }).click();
  await page.locator('#team-choice').getByText('360 Nation', { exact: true }).click();
  await page.locator('#btn-start').click();
  // Crée un véritable choix de carrière, pour détecter une sauvegarde indue
  // des changements qui ne doivent concerner que la rencontre préparée.
  await page.locator('.nav button[data-tab="tactics"]').click();
  const midfielder = (await page.locator('#tactics-pitch-field .pitch-slot[data-slot-index="3"]').getAttribute('data-player-id'))!;
  await page.locator(`#tactics-bench-list .tactic-role-select[data-player-id="${midfielder}"]`).selectOption('creator');
  const defaultTactic = await page.evaluate(() => JSON.stringify(STATE.savedTactic));
  await page.locator('.nav button[data-tab="calendar"]').click();
  await page.locator('#btn-view-notifications').click();
  await page.getByRole('button', { name: 'Compris', exact: true }).click();
  await page.locator('#btn-prepare-match').click();
  await expect(page.locator('#lineup-count')).toHaveText('7');
  return defaultTactic;
}

function slot(page: Page, pitchId: string, index: number) {
  return page.locator(`#${pitchId} .pitch-slot[data-slot-index="${index}"]`);
}

async function composition(page: Page, pitchId: string): Promise<string[]> {
  return page.locator(`#${pitchId} .pitch-slot`).evaluateAll(elements => elements.map(element => element.getAttribute('data-player-id') || ''));
}

function exchange(ids: string[], first: string, second: string) {
  return ids.map(id => id === first ? second : id === second ? first : id);
}

async function expectComposition(page: Page, pitchId: string, expected: string[]) {
  await expect.poll(() => composition(page, pitchId)).toEqual(expected);
  expect(expected).toHaveLength(7);
  expect(new Set(expected).size).toBe(7);
  expect(expected.every(Boolean)).toBe(true);
  const setup = await page.evaluate(() => ({
    assignments: [...lineupSetup.assignments],
    mirror: [...lineupSetup.assignmentsOOP],
    formation: lineupSetup.formation,
    mirrorFormation: lineupSetup.formationOOP,
  }));
  expect(setup.assignments).toEqual(expected);
  expect(setup.mirror).toEqual(expected);
  expect(setup.mirrorFormation).toBe(setup.formation);
}

async function center(locator: Locator) {
  const rect = await locator.boundingBox();
  expect(rect).not.toBeNull();
  return { x: rect!.x + rect!.width / 2, y: rect!.y + rect!.height / 2 };
}

async function mouseDrop(page: Page, source: Locator, target: Locator, cancel = false) {
  await target.scrollIntoViewIfNeeded();
  await source.scrollIntoViewIfNeeded();
  const from = await center(source), to = await center(target);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 16 });
  if (cancel) await page.keyboard.press('Escape');
  await page.mouse.up();
}

async function benchReplacement(page: Page, benchId: string, starters: string[]) {
  const rows = await page.locator(`#${benchId} .player-row`).evaluateAll(elements => elements.map(row => ({
    id: row.getAttribute('data-player-id') || '',
    position: row.getAttribute('data-position'),
    available: !(row.querySelector('.tactic-player-main') as HTMLButtonElement).disabled,
  })));
  const replacement = rows.find(row => row.available && row.position !== 'GK' && !starters.includes(row.id));
  expect(replacement, 'un joueur de champ du banc est disponible').toBeTruthy();
  return replacement!.id;
}

async function touchDrop(page: Page, source: Locator, target: Locator) {
  await target.scrollIntoViewIfNeeded();
  await source.scrollIntoViewIfNeeded();
  const from = await center(source), to = await center(target);
  const session = await page.context().newCDPSession(page);
  await session.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
  const point = (x: number, y: number) => ({ x, y, id: 1, radiusX: 1, radiusY: 1, force: 1 });
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point(from.x, from.y)] });
  // Ce délai représente l'appui prolongé, pas une attente de chargement.
  await page.waitForTimeout(360);
  for (let step = 1; step <= 12; step++) {
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point(from.x + (to.x - from.x) * step / 12, from.y + (to.y - from.y) * step / 12)] });
  }
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await session.send('Emulation.setTouchEmulationEnabled', { enabled: false });
  await session.detach();
}

test('les déplacements avant-match échangent ou remplacent les joueurs sans écraser la tactique habituelle', async ({ page, browserName }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const defaultTactic = await openLineup(page);
  const pitch = 'pitch-field';
  let expected = await composition(page, pitch);
  await mouseDrop(page, slot(page, pitch, 1), slot(page, pitch, 2));
  expected = exchange(expected, expected[1], expected[2]);
  await expectComposition(page, pitch, expected);

  const replacement = await benchReplacement(page, 'bench-list', expected);
  await mouseDrop(page, page.locator(`#bench-list .player-row[data-player-id="${replacement}"] .tactic-player-main`), slot(page, pitch, 3));
  expected = expected.map((id, index) => index === 3 ? replacement : id);
  await expectComposition(page, pitch, expected);
  await mouseDrop(page, slot(page, pitch, 0), slot(page, pitch, 1));
  await expectComposition(page, pitch, expected);
  await mouseDrop(page, slot(page, pitch, 1), slot(page, pitch, 0));
  await expectComposition(page, pitch, expected);
  await mouseDrop(page, slot(page, pitch, 1), page.locator('#screen-lineup .tactics-pitch-panel h3'));
  await expectComposition(page, pitch, expected);
  await mouseDrop(page, slot(page, pitch, 1), slot(page, pitch, 4), true);
  await expectComposition(page, pitch, expected);

  if (browserName === 'chromium') {
    await touchDrop(page, slot(page, pitch, 3), slot(page, pitch, 4));
    expected = exchange(expected, expected[3], expected[4]);
    await expectComposition(page, pitch, expected);
  }
  expect(await page.evaluate(() => JSON.stringify(STATE.savedTactic))).toBe(defaultTactic);
  await expect(page.locator('#btn-play-match')).toBeEnabled();
  expect(errors).toEqual([]);
});

test('les déplacements dans la fenêtre tactique sont validés par le moteur puis repris sans doublon', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const defaultTactic = await openLineup(page);
  await page.locator('#btn-play-match').click();
  await page.locator('#btn-phase-lineup-auto').click();
  await expect(page.locator('#phase-lineup-modal')).not.toBeVisible();
  await page.locator('#btn-tactics-match').click();
  await expect(page.locator('#match-tactics-modal')).toBeVisible();
  const pitch = 'match-tactics-pitch-field';
  let expected = await composition(page, pitch);
  await mouseDrop(page, slot(page, pitch, 1), slot(page, pitch, 2));
  expected = exchange(expected, expected[1], expected[2]);
  await expectComposition(page, pitch, expected);
  const replacement = await benchReplacement(page, 'match-tactics-bench-list', expected);
  const outgoing = expected[3];
  await mouseDrop(page, page.locator(`#match-tactics-bench-list .player-row[data-player-id="${replacement}"] .tactic-player-main`), slot(page, pitch, 3));
  expected = expected.map((id, index) => index === 3 ? replacement : id);
  await expectComposition(page, pitch, expected);
  await mouseDrop(page, slot(page, pitch, 0), slot(page, pitch, 5));
  await expectComposition(page, pitch, expected);
  await mouseDrop(page, slot(page, pitch, 1), slot(page, pitch, 4), true);
  await expectComposition(page, pitch, expected);

  await page.locator('#btn-close-tactics-modal').click();
  await expect(page.locator('#match-tactics-modal')).not.toBeVisible();
  await page.locator('#btn-pause-match').click();
  const committed = await page.evaluate(() => ({
    lineup: [...lineupSetup.lineup],
    // À la 8e minute, le format est 7v7 : cette lecture évite d'attendre
    // tout l'escalier initial pour vérifier la composition consommée.
    active: matchEngine.getActiveLineupIds(matchState.userSide, 8),
    anchors: Object.keys(matchEngine.getFormationAnchors(matchState.userSide, 8)),
    saved: JSON.stringify(STATE.savedTactic),
  }));
  expect(committed.lineup).toEqual(expected);
  expect([...committed.active].sort()).toEqual([...expected].sort());
  expect([...committed.anchors].sort()).toEqual([...expected].sort());
  expect(committed.active).toContain(replacement);
  expect(committed.active).not.toContain(outgoing);
  expect(new Set(committed.active).size).toBe(7);
  expect(committed.saved).toBe(defaultTactic);
  expect(errors).toEqual([]);
});
