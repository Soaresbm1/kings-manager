import { test, expect, type Page } from '@playwright/test';

declare const STATE: any;
declare const matchState: any;
declare const matchEngine: any;
declare const TacticalDebrief: any;
declare const CareerHistory: any;
declare function saveGame(): void;
declare function renderCalendarTab(): void;

const pageErrors = new WeakMap<Page, string[]>();

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    let seed = 20261104;
    Math.random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  });
  await page.route('https://kingsleague-cdn.kama.football/**', route => route.abort());
  await page.setViewportSize({ width: 1440, height: 1000 });
  const errors: string[] = [];
  pageErrors.set(page, errors);
  page.on('pageerror', error => errors.push(error.message));
});

test.afterEach(async ({ page }) => {
  expect(pageErrors.get(page)).toEqual([]);
});

async function career(page: Page) {
  await page.goto('/');
  await page.locator('#league-sidebar').getByRole('button', { name: /France/ }).click();
  await page.locator('#team-choice').getByRole('heading', { name: 'FC Silmi', exact: true }).click();
  await page.locator('#btn-start').click();
  await page.locator('#btn-view-notifications').click();
  await page.getByRole('button', { name: 'Compris', exact: true }).click();
}

async function openPresets(page: Page, container: string) {
  const panel = page.locator(`details.career-presets-panel:has(#${container})`);
  if (await panel.getAttribute('open') === null) await panel.locator(':scope > summary').click();
}

function preset(page: Page, container: string, id: string, action: string) {
  return page.locator(`#${container} [data-preset-id="${id}"][data-preset-action="${action}"]`);
}

async function startMatch(page: Page) {
  await page.locator('#btn-prepare-match').click();
  // Un vrai ordre préparé évite des interventions modales à chaque marche de l’Escalier.
  const phase = page.locator('#lineup-phase-preparation [data-kings-prep-phase="escalier"]');
  if (await phase.getAttribute('open') === null) await phase.locator(':scope > summary').click();
  await phase.locator('[data-kings-prep-focus="escalier-toggle"]').check();
  await page.locator('#btn-play-match').click();
  await expect(page.locator('#screen-match')).toBeVisible();
  await expect(page.locator('#phase-lineup-modal')).not.toBeVisible();
}

async function finish(page: Page) {
  await page.locator('#btn-skip-match').click();
  await expect(page.locator('#btn-skip-match')).toHaveText('Voir le résumé');
  const expected = await page.evaluate(() => JSON.parse(JSON.stringify({
    result: STATE.pendingResult.result,
    debrief: STATE.pendingResult.debrief,
  })));
  await page.locator('#btn-skip-match').click();
  await expect(page.locator('#screen-summary')).toBeVisible();
  await expect(page.locator('#summary-tactical-debrief')).toContainText('Débrief tactique');
  return expected;
}

async function archive(page: Page) {
  await page.locator('#btn-continue').click();
  await expect(page.locator('#screen-main')).toBeVisible();
  return page.evaluate(() => JSON.parse(JSON.stringify({
    user: STATE.matchReports.find((report: any) => report.home.id === STATE.userTeamId || report.away.id === STATE.userTeamId),
    ai: STATE.matchReports.find((report: any) => report.home.id !== STATE.userTeamId && report.away.id !== STATE.userTeamId),
  })));
}

async function openReport(page: Page, report: any) {
  await page.locator('#calendar-list').getByRole('button', {
    name: `Voir le rapport : ${report.home.name} contre ${report.away.name}`, exact: true,
  }).click();
  await expect(page.getByRole('dialog', { name: 'Rapport de match', exact: true })).toBeVisible();
}

async function resume(page: Page, label = 'FC Silmi') {
  await page.locator('#saves-list .transfer-row').filter({ hasText: label })
    .getByRole('button', { name: 'Continuer', exact: true }).click();
  await expect(page.locator('#tab-calendar')).toBeVisible();
}

test('mentalité et preset live sont enregistrés à la prochaine vraie minute, entre deux relevés exacts', async ({ page }) => {
  await career(page);
  await page.locator('[data-tab="tactics"]').click();
  await openPresets(page, 'tactics-presets');
  await preset(page, 'tactics-presets', 'usual', 'save').click();
  await preset(page, 'tactics-presets', 'protect', 'save').click();
  await preset(page, 'tactics-presets', 'protect', 'load').click();
  await page.locator('#tactics-mentality-choice').getByRole('button', { name: 'Prudente', exact: true }).click();
  await preset(page, 'tactics-presets', 'usual', 'load').click();
  await page.locator('[data-tab="calendar"]').click();
  await startMatch(page);
  await page.locator('#btn-pause-match').click();
  await expect(page.locator('#btn-pause-match')).toContainText('Reprendre');

  // Observe l’entrée du vrai moteur sans remplacer sa simulation ni ses résultats.
  await page.evaluate(() => {
    const fields = ['shots', 'shotsOnTarget', 'xG', 'passesAttempted', 'passesCompleted', 'interceptions', 'tackles'];
    const original = matchEngine.simulateMinute;
    (window as any).__debriefEngineCalls = [];
    matchEngine.simulateMinute = (minute: number, options: any) => {
      const capture = matchState.debriefCapture;
      const decision = capture.decisions.filter((entry: any) => entry.minute === minute).at(-1);
      const live = matchEngine.getLiveStats();
      (window as any).__debriefEngineCalls.push(JSON.parse(JSON.stringify({
        minute, decision,
        before: decision ? capture.samples.filter((point: any) => point.order < decision.order).at(-1) : null,
        after: decision ? capture.samples.find((point: any) => point.order > decision.order) : null,
        stats: Object.fromEntries(['home', 'away'].map(side => [side, Object.fromEntries(fields.map(key => [key, live[side][key]]))])),
        score: matchEngine.getScore(),
      })));
      return original(minute, options);
    };
  });
  const beforeChoice = await page.evaluate(() => JSON.parse(JSON.stringify({
    decisions: matchState.debriefCapture.decisions,
    samples: matchState.debriefCapture.samples,
    dashboard: matchState.dashboardStats,
    completedMinute: matchState.completedMinute,
    minute: matchState.minute,
  })));
  const displayed = await page.locator('#match-live-shots').innerText();
  const xGDisplayed = await page.locator('#match-live-xg').innerText();
  await page.locator('#live-mentality-choice').getByRole('button', { name: 'Offensive', exact: true }).click();
  const queued = await page.evaluate(() => JSON.parse(JSON.stringify({
    capture: matchState.debriefCapture, pending: matchState.debriefPendingTactic,
    calls: (window as any).__debriefEngineCalls, dashboard: matchState.dashboardStats,
  })));
  expect(queued.capture.decisions).toEqual(beforeChoice.decisions);
  expect(queued.capture.samples).toEqual(beforeChoice.samples);
  expect(queued.pending.setup.mentality).toBe('attacking');
  expect(queued.calls).toEqual([]);
  expect(queued.dashboard).toEqual(beforeChoice.dashboard);
  expect(queued.capture.samples.every((point: any) => point.minute <= beforeChoice.completedMinute)).toBe(true);
  await expect(page.locator('#match-live-shots')).toHaveText(displayed);
  await expect(page.locator('#match-live-xg')).toHaveText(xGDisplayed);

  await page.locator('#btn-pause-match').click();
  await page.waitForFunction(() => (window as any).__debriefEngineCalls.length > 0);
  await page.locator('#btn-pause-match').click();
  const first = await page.evaluate(() => (window as any).__debriefEngineCalls[0]);
  expect(first.minute).toBe(beforeChoice.minute + 1);
  expect(first.decision.setup.mentality).toBe('attacking');
  expect(first.before.minute).toBe(first.minute);
  expect(first.after.minute).toBe(first.minute);
  expect(first.before.order).toBeLessThan(first.decision.order);
  expect(first.after.order).toBeGreaterThan(first.decision.order);
  expect(first.before.stats).toEqual(first.stats);
  expect(first.after.stats).toEqual(first.stats);
  expect(first.before.score).toEqual(first.score);
  expect(first.after.score).toEqual(first.score);

  const previousCount = await page.evaluate(() => matchState.debriefCapture.decisions.length);
  await page.locator('#btn-tactics-match').click();
  await openPresets(page, 'match-presets');
  await preset(page, 'match-presets', 'protect', 'load').click();
  await expect(page.locator('#match-mentality-choice [data-mentality="cautious"]')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#btn-close-tactics-modal').click();
  expect(await page.evaluate(() => matchState.debriefCapture.decisions.length)).toBe(previousCount);
  expect(await page.evaluate(() => matchState.debriefPendingTactic.setup.mentality)).toBe('cautious');

  const completed = await finish(page);
  expect(completed.debrief.decisions.map((entry: any) => entry.setup.mentality)).toEqual(['attacking', 'cautious']);
  const calls = await page.evaluate(() => (window as any).__debriefEngineCalls);
  const second = calls.find((call: any) => call.decision?.setup.mentality === 'cautious');
  expect(second).toBeTruthy();
  expect(second.before.stats).toEqual(second.stats);
  expect(second.after.stats).toEqual(second.stats);
  const timeline = await page.evaluate(() => TacticalDebrief.read(STATE.pendingResult.debrief).timeline);
  for (const decision of completed.debrief.decisions) {
    const index = timeline.findIndex((entry: any) => entry.source === 'human' && entry.order === decision.order);
    const phaseIndex = timeline.findIndex((entry: any) => entry.source === 'event' && entry.kind === 'format' && entry.minute === decision.minute);
    expect(phaseIndex).toBeGreaterThan(index);
  }
  await expect(page.locator('#summary-tactical-debrief .debrief-human')).toHaveCount(2);
  await expect(page.locator('#summary-tactical-debrief')).toContainText('ne prouvent pas l’effet d’une décision');
});

test('fin instantanée réelle, archive, rechargement et export-import gardent exactement les relevés', async ({ page }) => {
  await career(page); await startMatch(page);
  const completed = await finish(page);
  expect(completed.debrief.samples.length).toBeGreaterThan(20);
  expect(completed.debrief.samples.length).toBeLessThanOrEqual(100);
  expect(completed.debrief.totals.home.xG).toBe(completed.result.homeXG);
  expect(completed.debrief.totals.away.shots).toBe(completed.result.awayShots);
  expect(completed.debrief.score).toEqual({ homeGoals: completed.result.homeGoals, awayGoals: completed.result.awayGoals });
  expect(completed.debrief.samples.at(-1).score).toEqual(completed.debrief.score);
  const archived = await archive(page);
  expect(archived.user.debrief).toEqual(completed.debrief);
  await page.reload(); await resume(page);
  const restored = await page.evaluate(() => STATE.matchReports.find((report: any) => report.home.id === STATE.userTeamId || report.away.id === STATE.userTeamId).debrief);
  expect(restored).toEqual(completed.debrief);
  await openReport(page, archived.user);
  await expect(page.locator('#history-report-body .history-debrief .debrief-timeline')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await page.locator('#btn-restart').click();
  // Capture le véritable Blob exporté ; aucun fichier à attendre/déverrouiller sous Windows.
  await page.evaluate(() => {
    (window as any).__debriefExport = null;
    const original = URL.createObjectURL;
    URL.createObjectURL = (blob: Blob) => {
      blob.text().then(value => { (window as any).__debriefExport = value; });
      return original(blob);
    };
  });
  await page.locator('#saves-list .transfer-row').filter({ hasText: 'FC Silmi' }).getByRole('button', { name: 'Exporter', exact: true }).click();
  await page.waitForFunction(() => (window as any).__debriefExport !== null);
  const exported = JSON.parse(await page.evaluate(() => (window as any).__debriefExport));
  expect(exported.data.matchReports.find((report: any) => report.id === archived.user.id).debrief).toEqual(completed.debrief);
  exported.meta.teamName = 'Copie du débrief';
  await page.getByText('Importer une carrière', { exact: true }).click();
  await page.locator('#import-save-input').setInputFiles({
    name: 'debrief-export.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(exported)),
  });
  await expect(page.locator('#import-save-feedback')).toHaveText('Carrière importée avec succès !');
  await resume(page, 'Copie du débrief');
  const imported = await page.evaluate(id => STATE.matchReports.find((report: any) => report.id === id).debrief, archived.user.id);
  expect(imported).toEqual(completed.debrief);
  await openReport(page, archived.user);
  await expect(page.locator('#history-report-body .history-debrief .debrief-stats')).not.toHaveCount(0);
});

test('les rapports anciens et les matchs IA déclarent les statistiques temporelles absentes', async ({ page }) => {
  await career(page); await startMatch(page); await finish(page);
  const archived = await archive(page);
  expect(archived.ai.debrief.samples).toEqual([]);
  await openReport(page, archived.ai);
  await expect(page.locator('#history-report-body .history-debrief')).toContainText('Statistiques temporelles indisponibles');
  await expect(page.locator('#history-report-body .history-debrief .debrief-stats')).toHaveCount(0);
  await page.keyboard.press('Escape');
  // Fixture de version antérieure : on retire seulement le champ facultatif d’un vrai rapport.
  await page.evaluate(id => {
    const report = STATE.matchReports.find((report: any) => report.id === id);
    delete report.debrief;
    saveGame(); renderCalendarTab();
  }, archived.user.id);
  await page.reload(); await resume(page);
  await openReport(page, archived.user);
  await expect(page.locator('#history-report-body .history-debrief')).toContainText('Aucun débrief chronologique enregistré');
  await expect(page.locator('#history-report-body .history-debrief .debrief-stats')).toHaveCount(0);
  await expect(page.locator('#history-report-body .history-score')).toHaveText(`${archived.user.score.homeGoals} – ${archived.user.score.awayGoals}`);
  const old = await page.evaluate(id => STATE.matchReports.find((report: any) => report.id === id), archived.user.id);
  expect(old.debrief).toBeNull();
  expect(old.statistics).toEqual(archived.user.statistics);
});

test('la chronologie archivée reste accessible à 320 px et rend les textes hostiles comme du texte', async ({ page }, testInfo) => {
  await career(page); await startMatch(page);
  await page.locator('#btn-pause-match').click();
  await page.locator('#live-mentality-choice').getByRole('button', { name: 'Offensive', exact: true }).click();
  await finish(page);
  const archived = await archive(page);
  const expected = await page.evaluate(id => {
    const report = STATE.matchReports.find((report: any) => report.id === id);
    const hostile = '<img data-debrief-injected="yes" src=x onerror=alert(1)>Décision';
    report.debrief.decisions[0].text = hostile;
    report.debrief.events[0].text = '<script data-debrief-injected="yes">alert(1)</script>Fait de jeu';
    report.debrief.homeName = 'ClubAuNomTrèsLongSansEspace'.repeat(8);
    report.debrief.awayName = '<b data-debrief-injected="yes">Adversaire</b>';
    STATE.matchReports = CareerHistory.normalizeReports(STATE.matchReports);
    saveGame(); renderCalendarTab();
    return { hostile, report: STATE.matchReports.find((entry: any) => entry.id === id) };
  }, archived.user.id);
  await page.setViewportSize({ width: 320, height: 740 });
  await openReport(page, expected.report);
  const debrief = page.locator('#history-report-body .history-debrief');
  await expect(debrief.getByRole('list', { name: 'Chronologie du match et décisions humaines' })).toBeVisible();
  await expect(debrief.locator('.debrief-human .debrief-description')).toHaveText(expected.hostile);
  await expect(page.locator('[data-debrief-injected]')).toHaveCount(0);
  await expect(debrief.locator('thead th').first()).toHaveAttribute('scope', 'col');
  const bounds = await debrief.evaluate(element => ({
    width: element.clientWidth, scrollWidth: element.scrollWidth,
    documentWidth: document.documentElement.scrollWidth,
    tables: Array.from(element.querySelectorAll('table')).map(table => ({ width: table.clientWidth, scrollWidth: table.scrollWidth })),
  }));
  expect(bounds.scrollWidth).toBeLessThanOrEqual(bounds.width);
  expect(bounds.documentWidth).toBeLessThanOrEqual(320);
  expect(bounds.tables.every(table => table.scrollWidth <= table.width)).toBe(true);
  await debrief.locator('.debrief-human').scrollIntoViewIfNeeded();
  await expect(debrief.locator('.debrief-human')).toBeInViewport();
  await page.screenshot({ path: testInfo.outputPath('tactical-debrief-320.png') });
  await page.keyboard.press('Escape');
  await expect(page.locator('#match-history-modal')).not.toBeVisible();
});
