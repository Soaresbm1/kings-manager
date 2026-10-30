import { test, expect, type Page } from '@playwright/test';

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
  await expect(page.locator('#tab-tactics')).toBeVisible();
}

async function resumeTactics(page: Page) {
  await page.locator('#saves-list .transfer-row').filter({ hasText: '360 Nation' }).getByRole('button', { name: 'Continuer', exact: true }).click();
  await page.locator('.nav button[data-tab="tactics"]').click();
}

async function savedTactic(page: Page) {
  return page.evaluate(() => {
    const saves = JSON.parse(localStorage.getItem('kingsManager7v7_saves') || '{}') as Record<string, any>;
    return Object.values(saves)[0].data.savedTactic;
  });
}

function roleSelect(page: Page, id: string, bench = 'tactics-bench-list') {
  return page.locator(`#${bench} .tactic-role-select[data-player-id="${id}"]`);
}

test('le rôle choisi apparaît sur le terrain et reste associé au joueur après rechargement', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await openTactics(page);
  await expect(page.locator('#tactics-team-style')).toBeVisible();
  const midfielder = page.locator('#tactics-pitch-field .pitch-slot[data-slot-index="3"]');
  const playerId = (await midfielder.getAttribute('data-player-id'))!;
  const choice = roleSelect(page, playerId);
  await choice.selectOption('creator');
  await expect(choice).toHaveValue('creator');
  await expect(midfielder.locator('.slot-role')).toContainText('Créateur');
  expect((await savedTactic(page)).playerRoles[playerId]).toBe('creator');

  await page.locator('#btn-restart').click();
  await page.reload();
  await resumeTactics(page);
  await expect(roleSelect(page, playerId)).toHaveValue('creator');
  await expect(page.locator(`#tactics-pitch-field .pitch-slot[data-player-id="${playerId}"] .slot-role`)).toContainText('Créateur');
  expect(errors).toEqual([]);
});

test('un changement de ligne adapte un rôle incompatible et une ancienne carrière reçoit les rôles par défaut', async ({ page }) => {
  await openTactics(page);
  const defender = page.locator('#tactics-pitch-field .pitch-slot[data-slot-index="1"]');
  const playerId = (await defender.getAttribute('data-player-id'))!;
  await roleSelect(page, playerId).selectOption('overlap');
  expect((await savedTactic(page)).playerRoles[playerId]).toBe('overlap');

  // Le clavier utilise le même échange que le glisser-déposer. Le rôle suit
  // l'identité du joueur, puis est vérifié contre son nouveau poste de terrain.
  await defender.press('Enter');
  const attacker = page.locator('#tactics-pitch-field .pitch-slot[data-slot-index="5"]');
  await attacker.press('Enter');
  await expect(attacker).toHaveAttribute('data-player-id', playerId);
  await expect(roleSelect(page, playerId)).toHaveValue('runner');
  await expect(roleSelect(page, playerId).locator('option[value="overlap"]')).toHaveCount(0);
  const moved = await savedTactic(page);
  expect(moved.playerRoles[playerId]).toBe('runner');
  expect(new Set(moved.assignments).size).toBe(7);
  expect(moved.assignmentsOOP).toEqual(moved.assignments);

  await page.locator('#btn-restart').click();
  await page.evaluate(() => {
    const key = 'kingsManager7v7_saves';
    const saves = JSON.parse(localStorage.getItem(key) || '{}') as Record<string, any>;
    delete Object.values(saves)[0].data.savedTactic.playerRoles;
    localStorage.setItem(key, JSON.stringify(saves));
  });
  await page.reload();
  await resumeTactics(page);
  await expect(page.locator('#tactics-pitch-field .slot-role')).toHaveCount(7);
  await expect(roleSelect(page, playerId)).toHaveValue('runner');
  await page.locator('#tactics-attack-plan-choice').getByRole('button', { name: 'Jeu direct', exact: true }).click();
  const restored = await savedTactic(page);
  expect(restored.assignments).toEqual(moved.assignments);
  for (const id of restored.assignments) expect(restored.playerRoles[id]).toBeTruthy();
});

test('le rôle préparé pour un match et le profil adverse sont visibles sans écraser la tactique habituelle', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await openTactics(page);
  const playerId = (await page.locator('#tactics-pitch-field .pitch-slot[data-slot-index="3"]').getAttribute('data-player-id'))!;
  await roleSelect(page, playerId).selectOption('creator');
  await page.locator('.nav button[data-tab="calendar"]').click();
  await page.locator('#btn-view-notifications').click();
  await page.getByRole('button', { name: 'Compris', exact: true }).click();
  await page.locator('#btn-prepare-match').click();
  await expect(page.locator('#opponent-style-preview')).toBeVisible();
  await expect(page.locator('#opponent-style-preview')).toContainText(/fort|atout/i);
  await expect(page.locator('#opponent-style-preview')).toContainText(/faible|limite|vulnérab/i);
  await page.locator('#opponent-style-preview summary').click();
  for (const card of await page.locator('#pitch-field .pitch-slot').all()) {
    await card.scrollIntoViewIfNeeded();
    await expect(card).toBeInViewport({ ratio: 1 });
  }
  const temporary = roleSelect(page, playerId, 'bench-list');
  await expect(temporary).toHaveValue('creator');
  await temporary.selectOption('ball_winner');
  await expect(temporary).toHaveValue('ball_winner');
  expect((await savedTactic(page)).playerRoles[playerId]).toBe('creator');

  await page.reload();
  await resumeTactics(page);
  await expect(roleSelect(page, playerId)).toHaveValue('creator');
});
