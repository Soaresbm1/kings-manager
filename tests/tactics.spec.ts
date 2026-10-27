import { test, expect, type Page } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    let state = 20261027;
    Math.random = () => ((state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 4294967296);
  });
  // Ces parcours contrôlent les choix du coach et leur accessibilité, même
  // lorsque les portraits ne sont pas disponibles sur le réseau.
  await page.route('https://kingsleague-cdn.kama.football/**', route => route.abort());
});

async function openTactics(page: Page) {
  await page.goto('/');
  await page.locator('#league-sidebar').getByText('France', { exact: false }).click();
  await page.locator('#team-choice').getByText('360 Nation', { exact: true }).click();
  await page.locator('#btn-start').click();
  await page.locator('.nav button[data-tab="tactics"]').click();
  await expect(page.locator('#tab-tactics')).toBeVisible();
}

test('les consignes et les deux formations restent enregistrées après rechargement', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await openTactics(page);
  await page.locator('#tactics-formation-choice').getByRole('button', { name: /^3-2-1\b/ }).click();
  await page.locator('#tactics-attack-plan-choice').getByRole('button', { name: /^Jeu direct\b/ }).click();
  await page.locator('#tactics-defense-plan-choice').getByRole('button', { name: /^Pressing haut\b/ }).click();
  await page.locator('#tactics-mentality-choice').getByRole('button', { name: 'Offensive', exact: true }).click();

  const views = page.locator('#tactics-view-mode-choice');
  await views.getByRole('button', { name: /Sans ballon/ }).click();
  await expect(page.locator('#tactics-pitch-field')).not.toBeVisible();
  await expect(page.locator('#tactics-oop-pitch-field')).toBeVisible();
  await page.locator('#tactics-oop-formation-choice').getByRole('button', { name: /^2-3-1\b/ }).click();
  await views.getByRole('button', { name: /Comparer|Les deux/ }).click();
  await expect(page.locator('#tactics-pitch-field')).toBeVisible();
  await expect(page.locator('#tactics-oop-pitch-field')).toBeVisible();
  await page.locator('#btn-restart').click();
  await page.reload();
  await page.locator('#saves-list .transfer-row').filter({ hasText: '360 Nation' }).getByRole('button', { name: 'Continuer', exact: true }).click();
  await page.locator('.nav button[data-tab="tactics"]').click();

  await expect(page.locator('#tactics-formation-choice').getByRole('button', { name: /^3-2-1\b/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#tactics-oop-formation-choice').getByRole('button', { name: /^2-3-1\b/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#tactics-attack-plan-choice').getByRole('button', { name: /^Jeu direct\b/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#tactics-defense-plan-choice').getByRole('button', { name: /^Pressing haut\b/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#tactics-mentality-choice').getByRole('button', { name: 'Offensive', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(views.getByRole('button', { name: /Comparer|Les deux/ })).toHaveAttribute('aria-pressed', 'true');
  await views.getByRole('button', { name: /Avec ballon/ }).click();
  await expect(page.locator('#tactics-pitch-field')).toBeVisible();
  await expect(page.locator('#tactics-oop-pitch-field')).not.toBeVisible();
  expect(pageErrors).toEqual([]);
});

test('le filtre permet de remplacer le gardien depuis le terrain sans ballon sans dupliquer de titulaire', async ({ page }) => {
  await openTactics(page);
  const filters = page.locator('#tactics-bench-filters');
  await filters.getByRole('button', { name: 'GK', exact: true }).click();
  await expect(filters.getByRole('button', { name: 'GK', exact: true })).toHaveAttribute('aria-pressed', 'true');
  const rows = page.locator('#tactics-bench-list .player-row');
  const keeperIds = await rows.evaluateAll(elements => elements.map(element => element.getAttribute('data-player-id')));
  expect(keeperIds).toHaveLength(3);
  await expect(rows.locator('.pos-tag')).toHaveText(['GK', 'GK', 'GK']);

  const originalKeeper = await page.locator('#tactics-pitch-field .pitch-slot.pos-GK').getAttribute('data-player-id');
  const replacementId = keeperIds.find(id => id !== originalKeeper);
  expect(replacementId).toBeTruthy();
  const replacementRow = page.locator(`#tactics-bench-list .player-row[data-player-id="${replacementId}"]`);
  const replacementName = await replacementRow.locator('.tactic-player-name').innerText();

  await page.locator('#tactics-view-mode-choice').getByRole('button', { name: /Sans ballon/ }).click();
  const outKeeper = page.locator('#tactics-oop-pitch-field .pitch-slot.pos-GK');
  await outKeeper.click();
  await expect(outKeeper).toHaveAttribute('aria-pressed', 'true');
  await replacementRow.getByRole('button', { name: `Choisir ${replacementName}`, exact: true }).click();
  await expect(outKeeper).toHaveAttribute('data-player-id', replacementId!);

  await page.locator('#tactics-view-mode-choice').getByRole('button', { name: /Comparer|Les deux/ }).click();
  await expect(page.locator('#tactics-pitch-field .pitch-slot.pos-GK')).toHaveAttribute('data-player-id', replacementId!);
  const withBall = await page.locator('#tactics-pitch-field .pitch-slot.filled').evaluateAll(elements => elements.map(element => element.getAttribute('data-player-id')));
  const withoutBall = await page.locator('#tactics-oop-pitch-field .pitch-slot.filled').evaluateAll(elements => elements.map(element => element.getAttribute('data-player-id')));
  expect(withBall).toHaveLength(7);
  expect(new Set(withBall).size).toBe(7);
  expect(withoutBall.sort()).toEqual(withBall.sort());
  expect(withBall).not.toContain(originalKeeper);
  await page.locator(`#tactics-bench-list .player-row[data-player-id="${replacementId}"] .phase-out`).click();
  await page.locator('#active-position-picker').getByRole('button', { name: /Banc/ }).click();
  await expect(page.locator(`#tactics-bench-list .player-row[data-player-id="${replacementId}"] .phase-out`)).toBeFocused();
  await expect(page.locator('#tactics-pitch-field .pitch-slot.filled')).toHaveCount(6);
  await expect(page.locator('#tactics-oop-pitch-field .pitch-slot.filled')).toHaveCount(6);
  await page.locator('#tactics-formation-choice').getByRole('button', { name: '3-2-1', exact: true }).click();
  const repairedWithBall = await page.locator('#tactics-pitch-field .pitch-slot.filled').evaluateAll(elements => elements.map(element => element.getAttribute('data-player-id')));
  const repairedWithoutBall = await page.locator('#tactics-oop-pitch-field .pitch-slot.filled').evaluateAll(elements => elements.map(element => element.getAttribute('data-player-id')));
  expect(repairedWithBall).toHaveLength(7);
  expect(new Set(repairedWithBall).size).toBe(7);
  expect(repairedWithoutBall.sort()).toEqual(repairedWithBall.sort());
  await filters.getByRole('button', { name: 'Tous', exact: true }).click();
  expect(await rows.count()).toBeGreaterThan(7);
});

test('le tableau tactique et le dernier joueur restent accessibles sur ordinateur et mobile', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await openTactics(page);
  await page.locator('#tactics-view-mode-choice').getByRole('button', { name: /Comparer|Les deux/ }).click();
  for (const size of [{ width: 1280, height: 720 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(size);
    const geometry = await page.locator('#tab-tactics').evaluate(element => {
      const rect = element.getBoundingClientRect();
      return { left: rect.left, right: rect.right, pageWidth: document.documentElement.scrollWidth, viewportWidth: innerWidth };
    });
    expect(geometry.pageWidth, `pas de débordement horizontal à ${size.width}px`).toBeLessThanOrEqual(geometry.viewportWidth + 1);
    expect(geometry.left).toBeGreaterThanOrEqual(-1);
    expect(geometry.right).toBeLessThanOrEqual(size.width + 1);
    const overlappingPlayers = await page.locator('#tab-tactics .pitch-field').evaluateAll(pitches => pitches.flatMap(pitch => {
      const players = Array.from(pitch.querySelectorAll('.pitch-slot'));
      return players.flatMap((player, index) => players.slice(index + 1).filter(other => {
        const a = player.getBoundingClientRect(), b = other.getBoundingClientRect();
        return Math.min(a.right, b.right) - Math.max(a.left, b.left) > 2 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 2;
      }).map(other => `${player.getAttribute('aria-label')} / ${other.getAttribute('aria-label')}`));
    }));
    expect(overlappingPlayers, 'les cartes joueurs ne doivent pas se chevaucher').toEqual([]);
    if (size.width >= 1100) {
      const clippedSlots = await page.locator('#tab-tactics .tactics-pitch-row').evaluate(row => {
        const bounds = row.getBoundingClientRect();
        return Array.from(row.querySelectorAll('.pitch-slot')).filter(slot => {
          const rect = slot.getBoundingClientRect();
          return rect.top < bounds.top - 1 || rect.bottom > bounds.bottom + 1 || rect.left < bounds.left - 1 || rect.right > bounds.right + 1;
        }).map(slot => slot.getAttribute('aria-label'));
      });
      expect(clippedSlots, 'les deux équipes de sept doivent rester entièrement visibles').toEqual([]);
    }

    const lastAssignment = page.locator('#tactics-bench-list .player-row').last().locator('.phase-out');
    await lastAssignment.scrollIntoViewIfNeeded();
    await expect(lastAssignment).toBeVisible();
    const buttonRect = await lastAssignment.boundingBox();
    expect(buttonRect).not.toBeNull();
    expect(buttonRect!.x).toBeGreaterThanOrEqual(0);
    expect(buttonRect!.x + buttonRect!.width).toBeLessThanOrEqual(size.width + 1);
    expect(buttonRect!.y).toBeGreaterThanOrEqual(0);
    expect(buttonRect!.y + buttonRect!.height).toBeLessThanOrEqual(size.height + 1);
    await lastAssignment.click();
    await expect(page.locator('#active-position-picker')).toBeVisible();
    await page.keyboard.press('Escape');
  }
});
