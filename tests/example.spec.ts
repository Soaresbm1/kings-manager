import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

// Le jeu utilise le hasard pour ses données et ses matchs. Les assertions portent
// sur les parcours et les invariants ; une graine fixe rend un échec rejouable.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    let state = 20261026;
    Math.random = () => ((state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 4294967296);
  });
});

async function startCareer(page: Page, league = 'France', team = '360 Nation') {
  await page.goto('/');
  await expect(page).toHaveTitle('Kings Manager 7v7');
  await page.locator('#league-sidebar').getByText(league, { exact: false }).click();
  await page.locator('#team-choice').getByText(team, { exact: true }).click();
  await page.locator('#btn-start').click();
  await page.locator('#btn-view-notifications').click();
  await page.getByRole('button', { name: 'Compris', exact: true }).click();
  await expect(page.locator('#topbar-team')).toContainText(team);
}

test('carrière, consignes du banc, résultat puis sauvegarde persistante', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await startCareer(page);
  await page.locator('.nav button[data-tab="tactics"]').click();
  await page.locator('#tactics-mentality-choice').getByRole('button', { name: 'Prudente', exact: true }).click();
  await page.locator('.nav button[data-tab="calendar"]').click();
  await page.locator('#btn-prepare-match').click();
  await expect(page.locator('#lineup-count')).toHaveText('7');
  await page.locator('#mentality-choice').getByRole('button', { name: 'Prudente', exact: true }).click();
  await expect(page.locator('#mentality-choice').getByRole('button', { name: 'Prudente', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#btn-play-match').click();
  await page.locator('#btn-phase-lineup-auto').click();
  await expect(page.locator('#phase-lineup-modal')).not.toBeVisible();

  const touchline = page.locator('#live-mentality-choice');
  await expect(touchline.getByRole('button')).toHaveCount(3);
  await touchline.getByRole('button', { name: 'Offensive', exact: true }).click();
  await expect(touchline.getByRole('button', { name: 'Offensive', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#match-live-shots')).toContainText(/\d/);
  await expect(page.locator('#match-live-xg')).toContainText(/\d/);

  await page.locator('#btn-skip-match').click();
  await expect(page.locator('#btn-skip-match')).toHaveText('Voir le résumé');
  await page.locator('#btn-skip-match').click();
  await expect(page.locator('#screen-summary')).toBeVisible();
  await expect(page.locator('#summary-score')).toHaveText(/\d+\s*-\s*\d+/);
  await expect(page.locator('#summary-advanced-stats')).toContainText('Passes réussies');
  await page.locator('#btn-continue').click();
  await expect(page.locator('#screen-main')).toBeVisible();
  await page.reload();
  const savedCareer = page.locator('#saves-list .transfer-row').filter({ hasText: '360 Nation' });
  await expect(savedCareer).toContainText('Journée 2');
  await savedCareer.getByRole('button', { name: 'Continuer', exact: true }).click();
  await page.locator('.nav button[data-tab="tactics"]').click();
  await expect(page.locator('#tactics-mentality-choice').getByRole('button', { name: 'Prudente', exact: true })).toHaveAttribute('aria-pressed', 'true');
  expect(pageErrors).toEqual([]);
});

test('export et import d’une ancienne carrière sans nouvelle consigne tactique', async ({ page }) => {
  await startCareer(page);
  await page.locator('.nav button[data-tab="tactics"]').click();
  await page.locator('#tactics-mentality-choice').getByRole('button', { name: 'Offensive', exact: true }).click();
  await page.locator('#btn-restart').click();
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#saves-list').getByRole('button', { name: 'Exporter', exact: true }).click();
  const download = await downloadPromise;
  const filename = await download.path();
  expect(filename).toBeTruthy();
  const entry = JSON.parse(await readFile(filename!, 'utf8'));
  expect(entry.data.savedTactic.mentality).toBe('attacking');
  delete entry.data.savedTactic.mentality;
  entry.meta.teamName = 'Ancienne carrière';
  await page.locator('#import-save-input').setInputFiles({
    name: 'ancienne-carriere.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(entry)),
  });
  await expect(page.locator('#import-save-feedback')).toContainText('Carrière importée avec succès');
  await page.locator('#saves-list .transfer-row').filter({ hasText: 'Ancienne carrière' }).getByRole('button', { name: 'Continuer', exact: true }).click();
  await page.locator('.nav button[data-tab="tactics"]').click();
  await expect(page.locator('#tactics-mentality-choice').getByRole('button', { name: 'Équilibrée', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#btn-restart').click();
  const countBefore = await page.locator('#saves-list .transfer-row').count();
  await page.locator('#import-save-input').setInputFiles({
    name: 'invalide.json', mimeType: 'application/json', buffer: Buffer.from('{'),
  });
  await expect(page.locator('#import-save-feedback')).toHaveText('Fichier de sauvegarde invalide.');
  await expect(page.locator('#saves-list .transfer-row')).toHaveCount(countBefore);
});

test('un effectif sans formation naturelle conserve sept titulaires et un seul gardien', async ({ page }) => {
  await startCareer(page, 'Brésil', 'Fluxo FC');
  await page.locator('#btn-prepare-match').click();
  await expect(page.locator('#lineup-count')).toHaveText('7');
  await expect(page.locator('#btn-play-match')).toBeEnabled();
  await expect(page.locator('#pitch-field .pitch-slot.pos-GK.filled')).toHaveCount(1);
  expect(await page.locator('#pitch-field .slot-role-warning').count()).toBeGreaterThan(0);
});

