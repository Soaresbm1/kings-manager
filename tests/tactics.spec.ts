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

for (const size of [{ width: 1920, height: 1080 }, { width: 1280, height: 720 }, { width: 390, height: 844 }]) {
  test(`les terrains horizontaux gardent leurs lignes et leurs joueurs accessibles à ${size.width} × ${size.height}`, async ({ page }) => {
    await page.setViewportSize(size);
    await openTactics(page);
    await page.locator('#tactics-view-mode-choice').getByRole('button', { name: /Comparer|Les deux/ }).click();
    const geometry = await page.locator('#tab-tactics').evaluate(element => {
      const rect = element.getBoundingClientRect();
      return { left: rect.left, right: rect.right, pageWidth: document.documentElement.scrollWidth, viewportWidth: innerWidth };
    });
    expect(geometry.pageWidth, `pas de débordement horizontal à ${size.width}px`).toBeLessThanOrEqual(geometry.viewportWidth + 1);
    expect(geometry.left).toBeGreaterThanOrEqual(-1);
    expect(geometry.right).toBeLessThanOrEqual(size.width + 1);
    for (const formation of ['2-2-2', '3-2-1', '2-3-1']) {
      await page.locator('#tactics-formation-choice').getByRole('button', { name: formation, exact: true }).click();
      await page.locator('#tactics-oop-formation-choice').getByRole('button', { name: formation, exact: true }).click();
      const pitches = await page.locator('#tab-tactics .pitch-field').evaluateAll(fields => fields.map(pitch => {
        const bounds = pitch.getBoundingClientRect();
        const players = Array.from(pitch.querySelectorAll('.pitch-slot'));
        const lines = ['GK', 'DEF', 'MID', 'ATT'].map(position => players
          .filter(player => player.classList.contains(`pos-${position}`))
          .map(player => { const rect = player.getBoundingClientRect(); return rect.left + rect.width / 2; }));
        const clipped = players.filter(player => {
          const rect = player.getBoundingClientRect();
          return rect.top < bounds.top - 1 || rect.bottom > bounds.bottom + 1 || rect.left < bounds.left - 1 || rect.right > bounds.right + 1;
        }).map(player => player.getAttribute('aria-label'));
        const overlaps = players.flatMap((player, index) => players.slice(index + 1).filter(other => {
          const a = player.getBoundingClientRect(), b = other.getBoundingClientRect();
          return Math.min(a.right, b.right) - Math.max(a.left, b.left) > 2 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 2;
        }).map(other => `${player.getAttribute('aria-label')} / ${other.getAttribute('aria-label')}`));
        return { id: pitch.id, width: bounds.width, height: bounds.height, count: players.length, lines, clipped, overlaps };
      }));
      expect(pitches).toHaveLength(2);
      for (const pitch of pitches) {
        const context = `${pitch.id}, ${formation}, ${size.width}px`;
        expect(pitch.width, `terrain horizontal : ${context}`).toBeGreaterThan(pitch.height);
        expect(pitch.count, context).toBe(7);
        expect(pitch.clipped, `chaque carte reste dans son terrain : ${context}`).toEqual([]);
        expect(pitch.overlaps, `aucun chevauchement de cartes : ${context}`).toEqual([]);
        pitch.lines.forEach(line => expect(line.length, `chaque ligne est présente : ${context}`).toBeGreaterThan(0));
        for (let line = 0; line < pitch.lines.length - 1; line++) {
          expect(Math.max(...pitch.lines[line]), `gardien, défense, milieu puis attaque de gauche à droite : ${context}`).toBeLessThan(Math.min(...pitch.lines[line + 1]));
        }
      }
    }
    // Comparer peut défiler verticalement et le terrain mobile horizontalement.
    // Les deux bords de chaque terrain doivent néanmoins rester atteignables.
    for (const pitchId of ['tactics-pitch-field', 'tactics-oop-pitch-field']) {
      for (const selector of ['.pitch-slot.pos-GK', '.pitch-slot.pos-ATT']) {
        const edgePlayer = page.locator(`#${pitchId} ${selector}`).last();
        await edgePlayer.scrollIntoViewIfNeeded();
        await expect(edgePlayer).toBeInViewport({ ratio: 1 });
        const rect = await edgePlayer.boundingBox();
        expect(rect).not.toBeNull();
        expect(rect!.x).toBeGreaterThanOrEqual(-1);
        expect(rect!.x + rect!.width).toBeLessThanOrEqual(size.width + 1);
        expect(rect!.y).toBeGreaterThanOrEqual(-1);
        expect(rect!.y + rect!.height, `${pitchId} ${selector} à ${size.width}px`).toBeLessThanOrEqual(size.height + 1);
      }
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
  });
}
