import { test, expect, type Page } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    let state = 20261027;
    Math.random = () => ((state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 4294967296);
  });
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

async function resumeTactics(page: Page) {
  await page.locator('#saves-list .transfer-row').filter({ hasText: '360 Nation' }).getByRole('button', { name: 'Continuer', exact: true }).click();
  await page.locator('.nav button[data-tab="tactics"]').click();
}

async function expectSingleComposition(page: Page) {
  const tab = page.locator('#tab-tactics');
  await expect(tab.locator('.pitch-field:visible')).toHaveCount(1);
  await expect(tab.getByRole('button', { name: /^(Avec ballon|Sans ballon|Comparer)$/ })).toHaveCount(0);
  await expect(page.locator('#tactics-oop-formation-choice')).toBeHidden();
  await expect(tab.locator('.phase-out')).toHaveCount(0);
}

async function expectSavedMirror(page: Page) {
  const tactic = await page.evaluate(() => {
    const map = JSON.parse(localStorage.getItem('kingsManager7v7_saves') || '{}') as Record<string, any>;
    return Object.values(map)[0].data.savedTactic;
  });
  expect(tactic.formationOOP).toBe(tactic.formation);
  expect(tactic.assignmentsOOP).toEqual(tactic.assignments);
  expect(tactic.viewMode).toBe('in');
}

test('une seule composition et les consignes restent enregistrées après rechargement', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await openTactics(page);
  await expectSingleComposition(page);
  await page.locator('#tactics-formation-choice').getByRole('button', { name: /^3-2-1\b/ }).click();
  await page.locator('#tactics-attack-plan-choice').getByRole('button', { name: /^Jeu direct\b/ }).click();
  await page.locator('#tactics-defense-plan-choice').getByRole('button', { name: /^Pressing haut\b/ }).click();
  await page.locator('#tactics-mentality-choice').getByRole('button', { name: 'Offensive', exact: true }).click();
  await expectSavedMirror(page);
  await page.locator('#btn-restart').click();
  await page.reload();
  await resumeTactics(page);
  await expectSingleComposition(page);
  await expect(page.locator('#tactics-formation-choice').getByRole('button', { name: /^3-2-1\b/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#tactics-attack-plan-choice').getByRole('button', { name: /^Jeu direct\b/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#tactics-defense-plan-choice').getByRole('button', { name: /^Pressing haut\b/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#tactics-mentality-choice').getByRole('button', { name: 'Offensive', exact: true })).toHaveAttribute('aria-pressed', 'true');
  expect(pageErrors).toEqual([]);
});

test('une ancienne tactique à deux plans reprend la composition principale sans sélecteur de phase', async ({ page }) => {
  await openTactics(page);
  await page.locator('#tactics-formation-choice').getByRole('button', { name: '3-2-1', exact: true }).click();
  const expected = await page.locator('#tactics-pitch-field .pitch-slot').evaluateAll(elements => elements.map(element => element.getAttribute('data-player-id')));
  await page.locator('#btn-restart').click();
  // Recrée le format d'une ancienne sauvegarde dans son propre contexte de test.
  await page.evaluate(() => {
    const key = 'kingsManager7v7_saves';
    const map = JSON.parse(localStorage.getItem(key) || '{}') as Record<string, any>;
    const tactic = Object.values(map)[0].data.savedTactic;
    tactic.formationOOP = '1-2-3-1';
    tactic.assignmentsOOP = [...tactic.assignments];
    [tactic.assignmentsOOP[1], tactic.assignmentsOOP[2]] = [tactic.assignmentsOOP[2], tactic.assignmentsOOP[1]];
    tactic.viewMode = 'out';
    localStorage.setItem(key, JSON.stringify(map));
  });
  await page.reload();
  await resumeTactics(page);
  await expectSingleComposition(page);
  await expect(page.locator('#tactics-formation-choice').getByRole('button', { name: '3-2-1', exact: true })).toHaveAttribute('aria-pressed', 'true');
  expect(await page.locator('#tactics-pitch-field .pitch-slot').evaluateAll(elements => elements.map(element => element.getAttribute('data-player-id')))).toEqual(expected);
  await page.locator('#tactics-attack-plan-choice').getByRole('button', { name: 'Jeu direct', exact: true }).click();
  await expectSavedMirror(page);
});

test('le filtre et le poste unique permettent de remplacer puis retirer le gardien sans doublon', async ({ page }) => {
  await openTactics(page);
  const filters = page.locator('#tactics-bench-filters');
  await filters.getByRole('button', { name: 'GK', exact: true }).click();
  await expect(filters.getByRole('button', { name: 'GK', exact: true })).toHaveAttribute('aria-pressed', 'true');
  const rows = page.locator('#tactics-bench-list .player-row');
  const keeperIds = await rows.evaluateAll(elements => elements.map(element => element.getAttribute('data-player-id')));
  expect(keeperIds).toHaveLength(3);
  await expect(rows.locator('.pos-tag')).toHaveText(['GK', 'GK', 'GK']);
  await expect(rows.locator('.phase-in')).toHaveCount(3);
  await expect(rows.locator('.phase-out')).toHaveCount(0);
  const keeper = page.locator('#tactics-pitch-field .pitch-slot.pos-GK');
  const originalKeeper = await keeper.getAttribute('data-player-id');
  const replacementId = keeperIds.find(id => id !== originalKeeper);
  expect(replacementId).toBeTruthy();
  const replacementRow = page.locator(`#tactics-bench-list .player-row[data-player-id="${replacementId}"]`);
  const replacementName = await replacementRow.locator('.tactic-player-name').innerText();
  await keeper.click();
  await expect(keeper).toHaveAttribute('aria-pressed', 'true');
  await replacementRow.getByRole('button', { name: `Choisir ${replacementName}`, exact: true }).click();
  await expect(keeper).toHaveAttribute('data-player-id', replacementId!);
  const starters = await page.locator('#tactics-pitch-field .pitch-slot.filled').evaluateAll(elements => elements.map(element => element.getAttribute('data-player-id')));
  expect(starters).toHaveLength(7);
  expect(new Set(starters).size).toBe(7);
  expect(starters).not.toContain(originalKeeper);
  await expectSavedMirror(page);
  const position = page.locator(`#tactics-bench-list .player-row[data-player-id="${replacementId}"] .phase-in`);
  await position.click();
  await page.locator('#active-position-picker').getByRole('button', { name: /Banc/ }).click();
  await expect(position).toBeFocused();
  await expect(page.locator('#tactics-pitch-field .pitch-slot.filled')).toHaveCount(6);
  await expectSavedMirror(page);
  await page.locator('#tactics-formation-choice').getByRole('button', { name: '3-2-1', exact: true }).click();
  const repaired = await page.locator('#tactics-pitch-field .pitch-slot.filled').evaluateAll(elements => elements.map(element => element.getAttribute('data-player-id')));
  expect(repaired).toHaveLength(7);
  expect(new Set(repaired).size).toBe(7);
  await expectSavedMirror(page);
  await filters.getByRole('button', { name: 'Tous', exact: true }).click();
  expect(await rows.count()).toBeGreaterThan(7);
});

for (const size of [{ width: 1920, height: 1080 }, { width: 1280, height: 720 }, { width: 390, height: 844 }]) {
  test(`le terrain horizontal unique garde ses joueurs accessibles à ${size.width} × ${size.height}`, async ({ page }) => {
    await page.setViewportSize(size);
    await openTactics(page);
    await expectSingleComposition(page);
    const geometry = await page.locator('#tab-tactics').evaluate(element => {
      const rect = element.getBoundingClientRect();
      return { left: rect.left, right: rect.right, pageWidth: document.documentElement.scrollWidth, viewportWidth: innerWidth };
    });
    expect(geometry.pageWidth).toBeLessThanOrEqual(geometry.viewportWidth + 1);
    expect(geometry.left).toBeGreaterThanOrEqual(-1);
    expect(geometry.right).toBeLessThanOrEqual(size.width + 1);
    for (const formation of ['2-2-2', '3-2-1', '2-3-1']) {
      await page.locator('#tactics-formation-choice').getByRole('button', { name: formation, exact: true }).click();
      const pitch = await page.locator('#tactics-pitch-field').evaluate(field => {
        const bounds = field.getBoundingClientRect();
        const players = Array.from(field.querySelectorAll('.pitch-slot'));
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
        return { width: bounds.width, height: bounds.height, count: players.length, lines, clipped, overlaps };
      });
      const context = `${formation}, ${size.width}px`;
      expect(pitch.width, context).toBeGreaterThan(pitch.height);
      expect(pitch.count, context).toBe(7);
      expect(pitch.clipped, context).toEqual([]);
      expect(pitch.overlaps, context).toEqual([]);
      pitch.lines.forEach(line => expect(line.length, context).toBeGreaterThan(0));
      for (let line = 0; line < pitch.lines.length - 1; line++) {
        expect(Math.max(...pitch.lines[line]), context).toBeLessThan(Math.min(...pitch.lines[line + 1]));
      }
    }
    // Le terrain mobile défile horizontalement ; ses deux bords restent atteignables.
    for (const selector of ['.pitch-slot.pos-GK', '.pitch-slot.pos-ATT']) {
      const edgePlayer = page.locator(`#tactics-pitch-field ${selector}`).last();
      await edgePlayer.scrollIntoViewIfNeeded();
      await expect(edgePlayer).toBeInViewport({ ratio: 1 });
      const rect = await edgePlayer.boundingBox();
      expect(rect).not.toBeNull();
      expect(rect!.x).toBeGreaterThanOrEqual(-1);
      expect(rect!.x + rect!.width).toBeLessThanOrEqual(size.width + 1);
      expect(rect!.y).toBeGreaterThanOrEqual(-1);
      expect(rect!.y + rect!.height).toBeLessThanOrEqual(size.height + 1);
    }
    const lastAssignment = page.locator('#tactics-bench-list .player-row').last().locator('.phase-in');
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
