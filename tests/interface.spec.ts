import { test, expect, type Page } from '@playwright/test';

declare const matchState: any;
declare const choreo: any;
declare const pitchRaf: any;
declare function showConfirm(message: string, onConfirm: () => void): void;

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    let seed = 20261102;
    Math.random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  });
  await page.route('https://kingsleague-cdn.kama.football/**', route => route.abort());
});

async function career(page: Page) {
  await page.goto('/');
  await page.locator('#league-sidebar').getByRole('button', { name: /France/ }).click();
  await page.locator('#team-choice').getByRole('button', { name: 'FC Silmi', exact: true }).click();
  await page.locator('#btn-start').click();
  await page.locator('#btn-view-notifications').click();
  await page.getByRole('button', { name: 'Compris', exact: true }).click();
}
async function match(page: Page) {
  await career(page);
  await page.locator('#btn-prepare-match').click();
  await page.locator('#btn-play-match').click();
  await page.locator('#btn-phase-lineup-auto').click();
}

test('le mercato pagine tous les joueurs, conserve les actions et réinitialise une recherche', async ({ page }) => {
  await career(page);
  await page.locator('[data-tab="transfers"]').click();
  await expect(page.locator('#market-list tr')).toHaveCount(40);
  await expect(page.locator('#market-page-status')).toContainText('1–40 sur 849');
  const firstPage = await page.locator('#market-list [data-action="shortlist"]').evaluateAll(buttons => buttons.map(button => (button as HTMLElement).dataset.player));
  await page.locator('#market-page-next').click();
  await expect(page.locator('#market-page-status')).toContainText('41–80');
  const secondPage = await page.locator('#market-list [data-action="shortlist"]').evaluateAll(buttons => buttons.map(button => (button as HTMLElement).dataset.player));
  expect(secondPage.some(id => firstPage.includes(id))).toBe(false);
  await page.locator('#filter-name').fill('Sinama');
  await expect(page.locator('#market-list tr')).toHaveCount(1);
  await expect(page.locator('#market-page-status')).toContainText('1–1 sur 1');
  const shortlist = page.locator('#market-list [data-action="shortlist"]');
  await shortlist.focus();
  await shortlist.press('Enter');
  await expect(shortlist).toBeFocused();
  await expect(shortlist).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#market-list [data-action="compare"]').click();
  await expect(page.locator('#market-list [data-action="compare"]')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#filter-name').fill('Zlatan Ibrahimović');
  await expect(page.locator('#market-empty')).toBeVisible();
  await expect(page.locator('#market-page-next')).toBeDisabled();
});

test('une fiche contient le focus, se ferme avec Échap et retrouve son déclencheur', async ({ page }) => {
  await career(page);
  await page.locator('[data-tab="squad"]').click();
  const row = page.locator('#squad-table tbody tr').first();
  await row.focus();
  await row.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Fiche joueur', exact: true });
  await expect(dialog).toBeVisible();
  await expect(page.locator('#screen-main')).toHaveAttribute('inert', '');
  await expect(page.locator('#btn-player-info-close')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.locator('#btn-player-info-close')).toBeFocused();
  await page.evaluate(() => showConfirm('Une confirmation au-dessus de la fiche', () => {}));
  await expect(page.locator('#btn-confirm-cancel')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('#confirm-modal')).not.toBeVisible();
  await expect(dialog).toBeVisible();
  await expect(page.locator('#btn-player-info-close')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(row).toBeFocused();
  await expect(page.locator('#screen-main')).not.toHaveAttribute('inert', '');
});

test('l’ordre des joueurs de la phase se choisit au clavier sans fermeture accidentelle', async ({ page }) => {
  await career(page);
  await page.locator('#btn-prepare-match').click();
  await page.locator('#btn-play-match').click();
  const players = page.locator('#phase-lineup-list button');
  await expect(players).toHaveCount(6);
  for (let index = 0; index < 6; index++) {
    await players.nth(index).focus();
    await players.nth(index).press('Enter');
    await expect(players.nth(index)).toHaveAttribute('aria-pressed', 'true');
    await expect(players.nth(index)).toBeFocused();
  }
  await page.keyboard.press('Escape');
  await expect(page.locator('#phase-lineup-modal')).toBeVisible();
  await page.locator('#btn-phase-lineup-confirm').click();
  await expect(page.locator('#phase-lineup-modal')).not.toBeVisible();
  await expect(page.locator('#match-score')).toHaveText('0 - 0');
});

test('la pause arrête le rendu, la reprise progresse et le résultat efface la bannière de pause', async ({ page, browserName }, testInfo) => {
  await match(page);
  await page.locator('#btn-pause-match').click();
  await expect.poll(() => page.evaluate(() => pitchRaf)).toBeNull();
  const ball = await page.evaluate(() => JSON.stringify(choreo.getState().ball));
  if (browserName === 'chromium') await page.screenshot({ path: testInfo.outputPath('match-desktop.png') });
  await page.waitForTimeout(100);
  expect(await page.evaluate(() => JSON.stringify(choreo.getState().ball))).toBe(ball);
  await page.locator('#btn-pause-match').click();
  await expect.poll(() => page.evaluate(() => pitchRaf !== null)).toBe(true);
  await page.locator('#btn-skip-match').click();
  await expect(page.locator('#turn-banner')).not.toBeVisible();
  await expect(page.locator('#match-live-phase')).toHaveText('Match terminé');
  await expect(page.locator('#btn-skip-match')).toHaveText('Voir le résumé');
});

test('sur téléphone le score et les commandes restent accessibles, la table propose tous les détails', async ({ page, browserName }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await career(page);
  await page.locator('[data-tab="squad"]').click();
  await expect(page.locator('#squad-table tbody tr').first()).toBeInViewport();
  const table = page.locator('#squad-table');
  expect(await table.evaluate(element => element.scrollWidth)).toBeLessThanOrEqual(366);
  await page.getByRole('button', { name: 'Toutes les statistiques', exact: true }).click();
  await expect(table).toHaveClass(/show-all-columns/);
  await expect(page.getByRole('button', { name: 'Vue synthétique', exact: true })).toHaveAttribute('aria-expanded', 'true');
  await page.locator('[data-tab="calendar"]').click();
  await page.locator('#btn-prepare-match').click();
  await page.locator('#btn-play-match').click();
  await page.locator('#btn-phase-lineup-auto').click();
  await expect(page.locator('#match-score')).toBeInViewport({ ratio: 1 });
  await expect(page.locator('#btn-pause-match')).toBeInViewport({ ratio: 1 });
  await expect(page.locator('#btn-skip-match')).toBeInViewport({ ratio: 1 });
  await expect(page.locator('#match-pitch-canvas')).toHaveCSS('touch-action', 'pan-y pinch-zoom');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.locator('#btn-pause-match').click();
  if (browserName === 'chromium') await page.screenshot({ path: testInfo.outputPath('match-mobile.png') });
});

test('le mouvement réduit et une faible hauteur conservent les commandes utiles', async ({ page }) => {
  await page.setViewportSize({ width: 640, height: 360 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await match(page);
  await expect(page.locator('#match-score')).toBeInViewport({ ratio: 1 });
  await expect(page.locator('#btn-pause-match')).toBeInViewport({ ratio: 1 });
  await expect(page.locator('#screen-match')).toHaveCSS('animation-name', 'none');
  await page.locator('#btn-tactics-match').click();
  await expect(page.locator('#match-tactics-modal .modal-box')).toHaveCSS('transition-duration', '0s');
  await page.keyboard.press('Escape');
  await expect(page.locator('#match-tactics-modal')).not.toBeVisible();
});

test('les variantes utilisent le vrai match sans enregistrer de carrière', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/prototypes/match-center/');
  for (const [index, name] of ['Banc', 'Régie', 'Analyse'].entries()) {
    await page.locator('.proto-picker-item').getByText(name, { exact: true }).click();
    const frame = page.frameLocator('#stage iframe');
    await expect(frame.locator('body')).toHaveAttribute('data-lab-ready', 'true');
    await expect(frame.locator('#match-score')).toHaveText('0 - 0');
    if (index === 1) {
      await expect(frame.locator('.match-center')).not.toBeVisible();
      await frame.getByRole('button', { name: 'Ouvrir le fil du match', exact: true }).click();
      await expect(frame.locator('.match-center')).toBeVisible();
    }
    await frame.locator('#btn-pause-match').click();
    await expect(frame.locator('#btn-pause-match')).toContainText('Pause');
    await expect(page).toHaveURL(new RegExp(`v=${index + 1}`));
  }
  expect(await page.evaluate(() => localStorage.getItem('kingsManager7v7_saves'))).toBeNull();
  expect(errors).toEqual([]);
});

test('les données difficiles, vides et uniques ne cassent pas les composants réels', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/prototypes/robustness/?screen=squad&data=worst');
  const frame = page.frameLocator('#stage iframe');
  await expect(frame.locator('body')).toHaveAttribute('data-lab-ready', 'true');
  await expect(frame.locator('#squad-table')).toContainText('Mohammed-Karim Berrabah');
  expect(await frame.locator('html').evaluate(element => element.scrollWidth)).toBeLessThanOrEqual(320);
  await page.locator('#lab-data').selectOption('empty');
  await expect(frame.locator('body')).toHaveAttribute('data-lab-ready', 'true');
  await expect(frame.locator('#squad-table tbody tr')).toHaveCount(0);
  await page.locator('#lab-data').selectOption('one');
  await expect(frame.locator('#squad-table tbody tr')).toHaveCount(1);
  await page.locator('#lab-data').selectOption('worst');
  await page.locator('#lab-screen').selectOption('player');
  await expect(frame.getByRole('dialog', { name: 'Fiche joueur', exact: true })).toBeVisible();
  await expect(frame.locator('#player-info-body')).not.toContainText(/NaN|undefined|Infinity/);
});

test('les noms importés restent du texte et une carrière mal structurée est refusée', async ({ page }) => {
  await career(page);
  await page.evaluate(() => {
    const state = (0, eval)('STATE');
    state.league.teams.find((team: any) => team.id === state.userTeamId).players[0].name = '<b>Jo & Co</b>';
  });
  await page.locator('[data-tab="squad"]').click();
  await expect(page.locator('#squad-table .player-cell-name').first()).toHaveText('<b>Jo & Co</b>');
  await expect(page.locator('#squad-table .player-cell-name b')).toHaveCount(0);
  await page.locator('#btn-restart').click();
  await page.getByText('Importer une carrière', { exact: true }).click();
  await page.locator('#import-save-input').setInputFiles({ name: 'invalide.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ league: {}, schedule: [] })) });
  await expect(page.locator('#import-save-feedback')).toHaveText('Fichier de sauvegarde invalide.');
});
