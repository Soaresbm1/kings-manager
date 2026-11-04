import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

declare const STATE: any;
declare function saveGame(): void;
declare function renderCalendarTab(): void;
declare function startNewSeason(): void;

const pageErrors = new WeakMap<Page, string[]>();

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    let seed = 20261102;
    Math.random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  });
  await page.route('https://kingsleague-cdn.kama.football/**', route => route.abort());
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
  await page.locator('#team-choice').getByRole('button', { name: 'FC Silmi', exact: true }).click();
  await page.locator('#btn-start').click();
  await page.locator('#btn-view-notifications').click();
  await page.getByRole('button', { name: 'Compris', exact: true }).click();
}

async function finishRound(page: Page) {
  await page.locator('#btn-prepare-match').click();
  await page.locator('#btn-play-match').click();
  if (await page.locator('#phase-lineup-modal').isVisible()) await page.locator('#btn-phase-lineup-auto').click();
  await page.locator('#btn-skip-match').click();
  await expect(page.locator('#btn-skip-match')).toHaveText('Voir le résumé');
  await page.locator('#btn-skip-match').click();
  await expect(page.locator('#screen-summary')).toBeVisible();
  // Référence indépendante : le résultat véritable du moteur avant son archivage.
  const expected = await page.evaluate(() => {
    const { result, homeTeam, awayTeam } = STATE.pendingResult;
    const side = (key: string, team: any) => result.participants[key].map((id: string) => ({
      id, name: team.players.find((player: any) => player.id === id)?.name,
      rating: result.ratings[id],
    }));
    return {
      score: `${result.homeGoals} – ${result.awayGoals}`, homeId: homeTeam.id, awayId: awayTeam.id,
      homeName: homeTeam.name, awayName: awayTeam.name, home: side('home', homeTeam), away: side('away', awayTeam),
      shootout: result.shootout ? `${result.shootout.homeScore} – ${result.shootout.awayScore}` : null,
      fixtureCount: STATE.schedule[STATE.currentRound].length,
    };
  });
  await page.locator('#btn-continue').click();
  await expect(page.locator('#screen-main')).toBeVisible();
  return expected;
}

async function reports(page: Page): Promise<any[]> {
  return page.evaluate(() => JSON.parse(JSON.stringify(STATE.matchReports)));
}

async function resume(page: Page, name = 'FC Silmi') {
  await page.locator('#saves-list .transfer-row').filter({ hasText: name })
    .getByRole('button', { name: 'Continuer', exact: true }).click();
  await expect(page.locator('#tab-calendar')).toBeVisible();
}

function calendarButton(page: Page, report: any) {
  return page.locator('#calendar-list').getByRole('button', {
    name: `Voir le rapport : ${report.home.name} contre ${report.away.name}`, exact: true,
  });
}

async function openHistoryPanel(page: Page) {
  const panel = page.locator('details.career-history-panel');
  if (await panel.count() && await panel.getAttribute('open') === null) {
    await panel.locator(':scope > summary').click();
  }
}

async function openHistoryReport(page: Page, report: any) {
  await openHistoryPanel(page);
  const row = page.locator('#career-match-history .history-fixture').filter({ hasText: report.home.name })
    .filter({ hasText: report.away.name });
  await row.getByRole('button').click();
  await expect(page.getByRole('dialog', { name: 'Rapport de match', exact: true })).toBeVisible();
}

test('une vraie journée archive les rencontres humaines et IA, accessibles au clavier et après rechargement', async ({ page }, testInfo) => {
  await career(page);
  const expected = await finishRound(page);
  const archived = await reports(page);
  expect(archived).toHaveLength(expected.fixtureCount);
  const userId = await page.evaluate(() => STATE.userTeamId);
  const human = archived.find(report => report.home.id === userId || report.away.id === userId);
  const ai = archived.find(report => report.home.id !== userId && report.away.id !== userId);
  expect(human).toBeTruthy(); expect(ai).toBeTruthy();
  const leagueIds = await page.evaluate(() => STATE.league.teams.map((team: any) => team.id));
  expect(archived.every(report => leagueIds.includes(report.home.id) && leagueIds.includes(report.away.id))).toBe(true);
  await expect(page.locator('#calendar-list .history-fixture-button')).toHaveCount(expected.fixtureCount);

  const trigger = calendarButton(page, human);
  await trigger.focus(); await trigger.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Rapport de match', exact: true });
  await expect(dialog).toBeVisible();
  await expect(page.locator('#btn-history-close')).toBeFocused();
  await expect(page.locator('#screen-main')).toHaveAttribute('inert', '');
  await expect(page.locator('#history-report-body .history-scoreboard .history-score')).toHaveText(expected.score);
  if (expected.shootout) await expect(page.locator('#history-report-body .history-shootout')).toContainText(expected.shootout);
  for (const [index, players] of [expected.home, expected.away].entries()) {
    const rows = page.locator('#history-report-body .history-player-table').nth(index).locator('tbody tr');
    await expect(rows).toHaveCount(players.length);
    for (const player of players) {
      const row = rows.filter({ hasText: player.name });
      await expect(row).toHaveCount(1);
      await expect(row.locator('td').nth(2)).toHaveText(player.rating.toFixed(1));
    }
  }
  // Le dernier tableau est le dernier contrôle tabulable du dialogue : Tab boucle sur Fermer.
  await page.locator('#history-report-body .history-table-scroll').last().focus();
  await page.keyboard.press('Tab'); await expect(page.locator('#btn-history-close')).toBeFocused();
  await page.keyboard.press('Escape'); await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await expect(page.locator('#screen-main')).not.toHaveAttribute('inert', '');

  const aiTrigger = calendarButton(page, ai);
  await aiTrigger.click();
  await expect(dialog).toBeVisible();
  await expect(page.locator('#history-report-body .history-scoreboard .history-score')).toHaveText(`${ai.score.homeGoals} – ${ai.score.awayGoals}`);
  await expect(page.locator('#history-report-body')).toContainText('Composition à la fin du match : indisponible');
  await expect(page.locator('#history-report-body .history-player-table tbody tr')).toHaveCount(ai.home.participantIds.length + ai.away.participantIds.length);
  await page.keyboard.press('Escape'); await expect(aiTrigger).toBeFocused();

  await page.reload(); await resume(page);
  expect(await reports(page)).toEqual(archived);
  await calendarButton(page, human).click();
  await expect(page.locator('#history-report-body .history-scoreboard .history-score')).toHaveText(expected.score);
  await page.setViewportSize({ width: 320, height: 740 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await expect(page.locator('#btn-history-close')).toBeInViewport({ ratio: 1 });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: testInfo.outputPath('career-report-390.png') });
});

test('les rapports gardent leurs noms, rôles et performances après renommage et transfert des participants', async ({ page }) => {
  await career(page); await finishRound(page);
  const archived = await reports(page);
  const userId = await page.evaluate(() => STATE.userTeamId);
  const human = archived.find(report => report.home.id === userId || report.away.id === userId);
  await calendarButton(page, human).click();
  const before = await page.locator('#history-report-body').innerText();
  await page.keyboard.press('Escape');
  const changed = await page.evaluate(() => {
    const report = STATE.matchReports.find((entry: any) => entry.home.id === STATE.userTeamId || entry.away.id === STATE.userTeamId);
    const side = report.home.id === STATE.userTeamId ? report.home : report.away;
    const from = STATE.league.teams.find((team: any) => team.id === STATE.userTeamId);
    const to = STATE.league.teams.find((team: any) => team.id !== from.id);
    const original = side.players.find((player: any) => player.pos !== 'GK' && side.participantIds.includes(player.id));
    const player = from.players.find((candidate: any) => candidate.id === original.id);
    player.name = 'Joueur renommé après son transfert';
    from.players = from.players.filter((candidate: any) => candidate.id !== player.id);
    to.players.push(player);
    from.name = 'Club renommé après la rencontre';
    saveGame(); renderCalendarTab();
    return { originalName: original.name, playerId: player.id, destination: to.id };
  });
  expect(changed.originalName).toBeTruthy();
  expect(await reports(page)).toEqual(archived);
  await calendarButton(page, human).click();
  await expect(page.locator('#history-report-body')).toHaveText(before, { useInnerText: true });
  await expect(page.locator('#history-report-body')).toContainText(changed.originalName);
  await expect(page.locator('#history-report-body')).not.toContainText('Joueur renommé après son transfert');
  await page.reload(); await resume(page, 'Club renommé après la rencontre');
  const transferSurvived = await page.evaluate(({ playerId, destination }) =>
    STATE.league.teams.find((team: any) => team.id === destination).players.some((player: any) => player.id === playerId), changed);
  expect(transferSurvived).toBe(true);
  expect(await reports(page)).toEqual(archived);
  await calendarButton(page, human).click();
  await expect(page.locator('#history-report-body')).toHaveText(before, { useInnerText: true });
});

test('la transition réelle de saison préserve les anciennes rencontres et les filtres saison et club', async ({ page }) => {
  await career(page); await finishRound(page);
  const seasonOne = await reports(page);
  // Fixture de fin de saison : la simulation des ligues a ses propres suites. Les vrais
  // rapports de la journée jouée restent intacts, les autres scores n'en créent aucun.
  await page.evaluate(() => {
    for (const league of [{ league: STATE.league, schedule: STATE.schedule, currentRound: STATE.currentRound }, ...STATE.otherLeagues]) {
      for (const result of league.league.results) if (!result.played) {
        result.played = true; result.homeGoals = 1; result.awayGoals = 0; result.penaltyWinner = null;
      }
      league.currentRound = league.schedule.length;
    }
    STATE.currentRound = STATE.schedule.length;
    startNewSeason();
  });
  expect(await page.evaluate(() => STATE.season)).toBe(2);
  expect(await reports(page)).toEqual(seasonOne);
  if (await page.locator('#btn-view-notifications').isVisible()) {
    await page.locator('#btn-view-notifications').click();
    for (let count = 0; count < 15 && await page.locator('#notification-modal').isVisible(); count++) {
      await page.locator('#notif-actions button').last().click();
    }
  }
  await finishRound(page);
  const all = await reports(page);
  expect(all.filter(report => report.season === 1)).toEqual(seasonOne);
  expect(all.some(report => report.season === 2)).toBe(true);
  await openHistoryPanel(page);
  const history = page.locator('#career-match-history');
  const season = history.getByRole('combobox', { name: 'Saison', exact: true });
  const club = history.getByRole('combobox', { name: 'Rencontres', exact: true });
  await expect(season.locator('option')).toHaveText(['Toutes les saisons', 'Saison 2', 'Saison 1']);
  await season.selectOption('1');
  await expect(history.locator('.history-fixture')).toHaveCount(seasonOne.length);
  await expect(history.locator('.history-fixture .history-meta').first()).toContainText('Saison 1');
  await club.selectOption('mine');
  await expect(history.locator('.history-fixture')).toHaveCount(1);
  await openHistoryReport(page, seasonOne.find(report => report.home.id === report.userTeamId || report.away.id === report.userTeamId));
  await expect(page.locator('#history-report-body > .history-meta')).toContainText('Saison 1');
  await page.keyboard.press('Escape');
  await season.selectOption('2');
  await expect(history.locator('.history-fixture')).toHaveCount(1);
  await club.selectOption('all');
  await expect(history.locator('.history-fixture')).toHaveCount(all.filter(report => report.season === 2).length);
  await page.reload(); await resume(page);
  expect(await reports(page)).toEqual(all);
});

test('export et import conservent les rapports, une ancienne carrière garde ses scores sans inventer de rapports', async ({ page }, testInfo) => {
  await career(page); await finishRound(page);
  const archived = await reports(page);
  await page.locator('#btn-restart').click();
  const downloading = page.waitForEvent('download');
  await page.locator('#saves-list').getByRole('button', { name: 'Exporter', exact: true }).click();
  const download = await downloading;
  const filename = testInfo.outputPath('career-history-export.json');
  let contents = '';
  await expect(async () => { await download.saveAs(filename); contents = await readFile(filename, 'utf8'); }).toPass({ timeout: 5_000, intervals: [100, 250, 500] });
  const entry = JSON.parse(contents);
  expect(entry.data.matchReports).toEqual(archived);
  entry.meta.teamName = 'Copie avec rapports';
  await page.getByText('Importer une carrière', { exact: true }).click();
  await page.locator('#import-save-input').setInputFiles({
    name: download.suggestedFilename(), mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(entry)),
  });
  await expect(page.locator('#import-save-feedback')).toHaveText('Carrière importée avec succès !');
  await resume(page, 'Copie avec rapports');
  expect(await reports(page)).toEqual(archived);
  await openHistoryReport(page, archived[0]);
  await expect(page.locator('#history-report-body .history-scoreboard .history-score')).toHaveText(`${archived[0].score.homeGoals} – ${archived[0].score.awayGoals}`);
  await page.keyboard.press('Escape'); await page.locator('#btn-restart').click();

  delete entry.data.matchReports;
  entry.meta.teamName = 'Ancienne carrière sans rapports';
  await page.locator('#import-save-input').setInputFiles({ name: 'ancienne-carriere.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(entry)) });
  await expect(page.locator('#import-save-feedback')).toHaveText('Carrière importée avec succès !');
  await resume(page, 'Ancienne carrière sans rapports');
  expect(await reports(page)).toEqual([]);
  await openHistoryPanel(page);
  await expect(page.locator('#career-match-history')).toContainText('Les anciens scores n’ont pas de rapport');
  await expect(page.locator('#career-match-history')).toContainText('les prochaines rencontres seront enregistrées');
  await expect(page.locator('#career-match-history .history-open')).toHaveCount(0);
  await expect(page.locator('#calendar-list .history-fixture-button')).toHaveCount(0);
  const actualScores = await page.locator('#calendar-list .fixture .score').allTextContents();
  const played = entry.data.league.results.filter((result: any) => result.played);
  expect(played).toHaveLength(archived.length);
  for (const result of played) expect(actualScores).toContain(`${result.homeGoals} - ${result.awayGoals}${result.penaltyWinner ? ' (tab)' : ''}`);
});
