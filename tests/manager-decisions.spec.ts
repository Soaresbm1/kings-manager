import { test, expect, type Page } from '@playwright/test';
declare const STATE: any;
declare const matchState: any;
declare const matchEngine: any;
declare const lineupSetup: any;
declare const MATCH_TACTICS_IDS: any;
declare const FORMATION_SLOTS: any;
declare function renderRecruitmentAdvisor(): void;
declare function renderBenchAdvisor(): void;
declare function planTacticDropForScreen(...args: any[]): any;
declare function moveTacticPlayer(...args: any[]): boolean;

const errors = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    let seed = 20261104;
    Math.random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  });
  await page.route('https://kingsleague-cdn.kama.football/**', route => route.abort());
  await page.setViewportSize({ width: 1440, height: 1000 });
  errors.set(page, []); page.on('pageerror', error => errors.get(page)!.push(error.message));
});
test.afterEach(async ({ page }) => { expect(errors.get(page)).toEqual([]); });
async function career(page: Page) {
  await page.goto('/');
  await page.locator('#league-sidebar').getByRole('button', { name: /France/ }).click();
  await page.locator('#team-choice').getByRole('heading', { name: 'FC Silmi', exact: true }).click();
  await page.locator('#btn-start').click();
  await page.locator('#btn-view-notifications').click();
  await page.getByRole('button', { name: 'Compris', exact: true }).click();
}
async function start(page: Page) {
  await page.locator('#btn-prepare-match').click();
  const phase = page.locator('#lineup-phase-preparation [data-kings-prep-phase="escalier"]');
  await phase.locator(':scope > summary').click();
  await phase.locator('[data-kings-prep-focus="escalier-toggle"]').check();
  await page.locator('#btn-play-match').click();
  await expect(page.locator('#screen-match')).toBeVisible();
}
async function finish(page: Page) {
  await page.locator('#btn-skip-match').click();
  await expect(page.locator('#btn-skip-match')).toHaveText('Voir le résumé');
  await page.locator('#btn-skip-match').click();
  await page.locator('#btn-continue').click();
  await expect(page.locator('#screen-main')).toBeVisible();
}
async function progress(page: Page) { return page.evaluate(() => JSON.parse(JSON.stringify(STATE.playerProgress))); }
async function exportCurrent(page: Page) {
  await page.locator('#btn-restart').click();
  await page.evaluate(() => {
    const original = URL.createObjectURL.bind(URL);
    (window as any).__decisionExport = null;
    URL.createObjectURL = function (blob: Blob | MediaSource) {
      if (blob instanceof Blob) (window as any).__decisionExport = blob.text();
      return original(blob);
    };
  });
  const downloading = page.waitForEvent('download');
  await page.locator('#saves-list').getByRole('button', { name: 'Exporter', exact: true }).first().click();
  expect(await (await downloading).failure()).toBeNull();
  return page.evaluate(async () => JSON.parse(await (window as any).__decisionExport));
}

test('trois pistes réelles, abordables et comparables rejoignent le suivi sans achat automatique', async ({ page }) => {
  await career(page);
  await page.locator('[data-tab="transfers"]').click();
  await page.locator('#recruitment-advisor > summary').click();
  const cards = page.locator('.recruitment-card'); await expect(cards).toHaveCount(3);
  const ids = await cards.evaluateAll(cards => cards.map(card => (card as HTMLElement).dataset.recruitId));
  const before = await page.evaluate(ids => {
    const team = STATE.league.teams.find((team: any) => team.id === STATE.userTeamId);
    const clubs = [...STATE.league.teams, ...STATE.otherLeagues.flatMap((league: any) => league.league.teams)];
    for (const id of ids) {
      const club = clubs.find((club: any) => club.players.some((p: any) => p.id === id));
      const player = club.players.find((p: any) => p.id === id);
      if (club.id === team.id || club.players.length <= 7 || player.value > team.budget || player.injured || player.suspended) throw new Error('Invalid recommendation');
    }
    return { budget: team.budget, players: team.players.map((p: any) => p.id) };
  }, ids);
  await cards.first().getByRole('button', { name: 'Voir la fiche', exact: true }).click();
  await expect(page.locator('#player-info-modal')).toBeVisible(); await page.locator('#btn-player-info-close').click();
  await cards.first().getByRole('button', { name: 'Comparer au joueur de référence' }).click();
  await expect(page.locator('#compare-modal')).toBeVisible(); await page.locator('#btn-compare-close').click();
  await cards.first().getByRole('button', { name: 'Suivre', exact: true }).click();
  await expect(cards.first().getByRole('button', { name: 'Retirer du suivi', exact: true })).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => { const t = STATE.league.teams.find((t: any) => t.id === STATE.userTeamId); return { budget: t.budget, players: t.players.map((p: any) => p.id) }; })).toEqual(before);
  await page.reload();
  await page.locator('#saves-list').getByRole('button', { name: 'Continuer', exact: true }).first().click();
  expect(await page.evaluate(id => STATE.shortlist.includes(id), ids[0])).toBe(true);
});

test('les besoins filtrent les postes et un budget insuffisant ne produit pas de fausses recrues', async ({ page }) => {
  await career(page); await page.locator('[data-tab="transfers"]').click();
  await page.locator('#recruitment-advisor > summary').click();
  await page.locator('#recruitment-focus').selectOption('DEF');
  expect(await page.locator('.recruitment-card').count()).toBeGreaterThan(0);
  await expect(page.locator('.recruitment-card').first()).toContainText('DEF');
  await page.evaluate(() => { STATE.league.teams.find((t: any) => t.id === STATE.userTeamId).budget = 0; renderRecruitmentAdvisor(); });
  await expect(page.locator('.recruitment-card')).toHaveCount(0);
  await expect(page.locator('#recruitment-advisor-content')).toContainText('Aucune piste disponible');
});

test('la progression réelle survit au match, au rechargement et à l’export-import sans inventer le passé', async ({ page }) => {
  await career(page);
  const before = await progress(page); expect(before.players.every((p: any) => p.samples.length === 1)).toBe(true);
  await start(page); await finish(page);
  const after = await progress(page); expect(after.players.some((p: any) => p.samples.length >= 2)).toBe(true);
  const actual = await page.evaluate(() => {
    const team = STATE.league.teams.find((t: any) => t.id === STATE.userTeamId);
    return team.players.map((p: any) => ({ id: p.id, values: [p.overall, p.speed, p.technique, p.physical, p.mental, p.form, p.value, p.careerMatches] }));
  });
  for (const player of actual) expect(after.players.find((p: any) => p.id === player.id).samples.at(-1).slice(3)).toEqual(player.values);
  await page.locator('[data-tab="squad"]').click(); await page.locator('#squad-progress-panel > summary').click();
  await page.locator('#squad-progress-chart-metric').selectOption('form');
  await expect(page.locator('#squad-progress-chart svg')).toHaveCount(1);
  const exported = await exportCurrent(page); expect(exported.data.playerProgress).toEqual(after);
  exported.meta.teamName = 'Copie de progression';
  await page.locator('#import-save-input').setInputFiles({ name: 'progression.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(exported)) });
  await expect(page.locator('#import-save-feedback')).toHaveText('Carrière importée avec succès !');
  await page.locator('#saves-list .transfer-row').filter({ hasText: 'Copie de progression' }).getByRole('button', { name: 'Continuer', exact: true }).click();
  expect(await progress(page)).toEqual(after);
  await page.reload(); await page.locator('#saves-list').getByRole('button', { name: 'Continuer', exact: true }).first().click();
  expect(await progress(page)).toEqual(after);
});

test('une ancienne carrière commence son suivi à la reprise, dans son propre slot', async ({ page }) => {
  await career(page); const original = await progress(page);
  const exported = await exportCurrent(page); delete exported.data.playerProgress; exported.meta.teamName = 'Carrière ancienne';
  await page.locator('#import-save-input').setInputFiles({ name: 'ancienne.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(exported)) });
  await expect(page.locator('#import-save-feedback')).toHaveText('Carrière importée avec succès !');
  await page.locator('#saves-list .transfer-row').filter({ hasText: 'Carrière ancienne' }).getByRole('button', { name: 'Continuer', exact: true }).click();
  expect((await progress(page)).players.every((p: any) => p.samples.length === 1)).toBe(true);
  await page.locator('[data-tab="squad"]').click(); await page.locator('#squad-progress-panel > summary').click();
  await expect(page.locator('#squad-progress-chart')).toContainText('Les anciennes valeurs ne sont pas reconstituées');
  const stored = await page.evaluate(() => Object.values(JSON.parse(localStorage.getItem('kingsManager7v7_saves')!)) as any[]);
  expect(stored).toHaveLength(2); expect(stored[0].data.playerProgress).toEqual(original);
});

async function tiredFixture(page: Page) {
  await page.locator('#btn-pause-match').click();
  return page.evaluate(() => {
    const observation = matchState.benchObservation;
    const slots = FORMATION_SLOTS[lineupSetup.formation];
    for (const id of observation.activeIds) {
      const index = lineupSetup.assignments.indexOf(id);
      if (index < 0) continue;
      const incoming = observation.players.find((p: any) => !lineupSetup.assignments.includes(p.id)
        && planTacticDropForScreen(lineupSetup, MATCH_TACTICS_IDS, p.id, index, 'in').valid);
      if (!incoming) continue;
      observation.players.forEach((p: any) => { p.energy = p.id === id ? 50 : 100; });
      renderBenchAdvisor();
      return { outId: id, index, assignments: [...lineupSetup.assignments], pos: slots[index].pos };
    }
    throw new Error('Fixture needs a legal bench replacement');
  });
}
test('un conseil de fatigue ne remplace personne avant confirmation et utilise les commandes tactiques existantes', async ({ page }) => {
  await career(page); await start(page);
  expect(await page.evaluate(() => matchState.benchObservation.minute)).toBe(0);
  const fixture = await tiredFixture(page);
  await page.locator('#btn-bench-advisor').click();
  const proposal = page.locator('[data-bench-out]').filter({ hasText: 'Proposer ce remplacement' }).first();
  const inId = await proposal.getAttribute('data-bench-in');
  await proposal.click(); await expect(page.locator('#confirm-modal')).toBeVisible();
  expect(await page.evaluate(() => lineupSetup.assignments)).toEqual(fixture.assignments);
  await page.locator('#btn-confirm-cancel').click();
  expect(await page.evaluate(() => lineupSetup.assignments)).toEqual(fixture.assignments);
  await proposal.click(); await page.locator('#btn-confirm-ok').click();
  const actual = await page.evaluate(() => ({ assignments: lineupSetup.assignments, lineup: lineupSetup.lineup, paused: matchState.paused }));
  expect(actual.assignments[fixture.index]).toBe(inId);
  expect(actual.assignments).not.toContain(fixture.outId);
  expect(new Set(actual.assignments).size).toBe(actual.assignments.length);
  expect(actual.lineup).toContain(inId); expect(actual.paused).toBe(true);
});

test('à 320px, les textes hostiles et les données absentes restent accessibles sans exécuter de HTML', async ({ page }, info) => {
  await career(page); await page.setViewportSize({ width: 320, height: 740 });
  await page.locator('[data-tab="transfers"]').click(); await page.locator('#recruitment-advisor > summary').click();
  const id = await page.locator('.recruitment-card').first().getAttribute('data-recruit-id');
  await page.evaluate(id => {
    const clubs = [...STATE.league.teams, ...STATE.otherLeagues.flatMap((l: any) => l.league.teams)];
    const club = clubs.find((t: any) => t.players.some((p: any) => p.id === id));
    club.players.find((p: any) => p.id === id).name = '<img data-decisions-injected src=x onerror=alert(1)>王👑' + 'A'.repeat(400);
    renderRecruitmentAdvisor();
  }, id);
  await expect(page.locator('[data-decisions-injected]')).toHaveCount(0);
  await page.screenshot({ path: info.outputPath('recruitment-320.png') });
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await page.locator('[data-tab="squad"]').click(); await page.locator('#squad-progress-panel > summary').click();
  await expect(page.locator('#progress-player')).toBeVisible();
  expect(await page.locator('#progress-player').evaluate(e => e.getBoundingClientRect().width)).toBeLessThanOrEqual(300);
});
