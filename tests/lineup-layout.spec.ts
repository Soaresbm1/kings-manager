import { test, expect, type Page } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    let state = 20261030;
    Math.random = () => ((state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 4294967296);
  });
  await page.route('https://kingsleague-cdn.kama.football/**', route => route.abort());
});

async function openLineup(page: Page) {
  await page.goto('/');
  await page.locator('#league-sidebar').getByText('France', { exact: false }).click();
  await page.locator('#team-choice').getByText('360 Nation', { exact: true }).click();
  await page.locator('#btn-start').click();
  await page.locator('#btn-view-notifications').click();
  await page.getByRole('button', { name: 'Compris', exact: true }).click();
  await page.locator('#btn-prepare-match').click();
  await expect(page.locator('#screen-lineup')).toBeVisible();
  await expect(page.locator('#lineup-count')).toHaveText('7');
}

async function expectHorizontalPitch(page: Page, pitchId: string, context: string) {
  const pitch = page.locator(`#${pitchId}`);
  await expect(pitch).toBeVisible();
  const geometry = await pitch.evaluate(field => {
    const bounds = field.getBoundingClientRect();
    const cards = Array.from(field.querySelectorAll('.pitch-slot'));
    const lines = ['GK', 'DEF', 'MID', 'ATT'].map(position => cards
      .filter(card => card.classList.contains(`pos-${position}`))
      .map(card => { const rect = card.getBoundingClientRect(); return rect.left + rect.width / 2; }));
    const clipped = cards.filter(card => {
      const rect = card.getBoundingClientRect();
      return rect.left < bounds.left - 1 || rect.right > bounds.right + 1
        || rect.top < bounds.top - 1 || rect.bottom > bounds.bottom + 1;
    }).map(card => card.getAttribute('aria-label'));
    const overlapping = cards.flatMap((card, index) => cards.slice(index + 1).filter(other => {
      const a = card.getBoundingClientRect(), b = other.getBoundingClientRect();
      return Math.min(a.right, b.right) - Math.max(a.left, b.left) > 2
        && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 2;
    }).map(other => `${card.getAttribute('aria-label')} / ${other.getAttribute('aria-label')}`));
    return { width: bounds.width, height: bounds.height, count: cards.length,
      roles: field.querySelectorAll('.slot-role').length, lines, clipped, overlapping };
  });
  expect(geometry.width, context).toBeGreaterThan(geometry.height);
  expect(geometry.count, context).toBe(7);
  expect(geometry.roles, context).toBe(7);
  expect(geometry.clipped, context).toEqual([]);
  expect(geometry.overlapping, context).toEqual([]);
  geometry.lines.forEach(line => expect(line.length, context).toBeGreaterThan(0));
  for (let line = 0; line < geometry.lines.length - 1; line++) {
    expect(Math.max(...geometry.lines[line]), context).toBeLessThan(Math.min(...geometry.lines[line + 1]));
  }
}

async function expectPitchEdgesReachable(page: Page, pitchId: string) {
  for (const position of ['GK', 'ATT']) {
    const edge = page.locator(`#${pitchId} .pitch-slot.pos-${position}`).last();
    await edge.scrollIntoViewIfNeeded();
    await expect(edge).toBeInViewport({ ratio: 1 });
    // Vérifie aussi le nom et le rôle, pour ne pas considérer une carte dont
    // seul le portrait resterait dans la fenêtre comme accessible.
    await expect(edge.locator('.slot-name')).toBeVisible();
    await expect(edge.locator('.slot-role')).toBeVisible();
  }
}

for (const size of [{ width: 1920, height: 1080 }, { width: 1280, height: 720 }, { width: 390, height: 844 }]) {
  test(`l’avant-match garde un terrain horizontal et des joueurs accessibles à ${size.width} × ${size.height}`, async ({ page }) => {
    await page.setViewportSize(size);
    await openLineup(page);
    for (const expanded of [false, true]) {
      if (expanded) await page.locator('#opponent-style-preview summary').click();
      for (const formation of ['2-2-2', '3-2-1', '2-3-1']) {
        await page.locator('#formation-choice').getByRole('button', { name: formation, exact: true }).click();
        await expectHorizontalPitch(page, 'pitch-field', `${formation}, profil ${expanded ? 'ouvert' : 'fermé'}, ${size.width}px`);
      }
    }
    await expectPitchEdgesReachable(page, 'pitch-field');
    const flow = await page.locator('#screen-lineup').evaluate(screen => ({
      benchBottom: screen.querySelector('.tactics-bench-panel')!.getBoundingClientRect().bottom,
      buttonTop: screen.querySelector('#btn-play-match')!.getBoundingClientRect().top,
    }));
    expect(flow.buttonTop).toBeGreaterThanOrEqual(flow.benchBottom);
    const documentWidth = await page.locator('html').evaluate(element => element.scrollWidth);
    expect(documentWidth).toBeLessThanOrEqual(size.width + 1);
    await page.locator('#btn-play-match').scrollIntoViewIfNeeded();
    await expect(page.locator('#btn-play-match')).toBeInViewport({ ratio: 1 });
    await expect(page.locator('#btn-play-match')).toBeEnabled();
  });
}

test('les ajustements en match gardent la même orientation horizontale et les rôles accessibles', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await openLineup(page);
  await page.locator('#btn-play-match').click();
  await page.locator('#btn-phase-lineup-auto').click();
  await expect(page.locator('#phase-lineup-modal')).not.toBeVisible();
  await page.locator('#btn-tactics-match').click();
  await expect(page.locator('#match-tactics-modal')).toBeVisible();
  await expectHorizontalPitch(page, 'match-tactics-pitch-field', 'ajustements en match');
  await expectPitchEdgesReachable(page, 'match-tactics-pitch-field');
  await expect(page.locator('#match-tactics-bench-list .tactic-role-select')).toHaveCount(7);
  await page.locator('#btn-close-tactics-modal').scrollIntoViewIfNeeded();
  await expect(page.locator('#btn-close-tactics-modal')).toBeInViewport({ ratio: 1 });
});
