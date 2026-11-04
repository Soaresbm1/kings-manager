import { test, expect, type Page } from '@playwright/test';

declare const STATE: any;
declare function getUserTeam(): any;
declare function saveGame(): void;
declare function renderCalendarTab(): void;
declare function openTournamentScreen(): void;

const pageErrors = new WeakMap<Page, string[]>();

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    let seed = 20261104;
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
  await page.locator('#team-choice').getByRole('heading', { name: 'FC Silmi', exact: true }).click();
  await page.locator('#btn-start').click();
  await page.locator('#btn-view-notifications').click();
  await page.getByRole('button', { name: 'Compris', exact: true }).click();
}

async function prepare(page: Page) {
  await page.getByRole('button', { name: 'Préparer le match', exact: true }).click();
  await expect(page.locator('#screen-lineup')).toBeVisible();
  const report = page.locator('#opponent-report .scout-report');
  await expect(report).toHaveCount(1);
  await expect(report).not.toHaveAttribute('open', '');
  return report;
}

test('une ancienne carrière sans résultat ouvre un rapport vide honnête et repliable au clavier', async ({ page }) => {
  await career(page);
  // Vieille sauvegarde réelle : les nouveaux champs facultatifs n’existent pas encore.
  await page.evaluate(() => {
    saveGame();
    const key = 'kingsManager7v7_saves';
    const slots = JSON.parse(localStorage.getItem(key)!);
    const data = slots[STATE.currentSlotId].data;
    delete data.matchReports;
    delete data.tacticPresets;
    delete data.activeTacticPreset;
    delete data.savedTactic;
    delete data.currentDay;
    data.league.results.forEach((result: any) => { result.played = false; });
    data.league.teams.forEach((team: any) => team.players.forEach((player: any) => {
      player.goals = 0; player.matches = 0;
    }));
    localStorage.setItem(key, JSON.stringify(slots));
  });
  await page.reload();
  await page.locator('#saves-list .transfer-row').filter({ hasText: 'FC Silmi' })
    .getByRole('button', { name: 'Continuer', exact: true }).click();
  const expectedOpponent = await page.evaluate(() => {
    const match = STATE.schedule[STATE.currentRound].find((match: any) => match.home === STATE.userTeamId || match.away === STATE.userTeamId);
    return STATE.league.teams.find((team: any) => team.id === (match.home === STATE.userTeamId ? match.away : match.home)).name;
  });
  const report = await prepare(page);
  await expect(report.locator('.scout-opponent')).toHaveText(expectedOpponent);
  await expect(report.locator('.scout-brief')).toContainText('Forme récente indisponible');
  const toggle = report.locator(':scope > summary');
  await toggle.focus();
  await page.keyboard.press('Enter');
  await expect(report).toHaveAttribute('open', '');
  await expect(report.locator('.scout-result')).toHaveCount(0);
  await expect(report.locator('.scout-recent')).toContainText('Aucun résultat récent disponible');
  await expect(report.locator('.scout-scorers')).toContainText('Aucun but enregistré cette saison');
  await expect(report.locator('.scout-position-row')).toHaveCount(4);
  await page.keyboard.press('Space');
  await expect(report).not.toHaveAttribute('open', '');
  await expect(toggle).toBeFocused();
});

test('préparer le match montre les cinq vrais résultats, TAB, buteurs et absences sans débordement à 320 px', async ({ page }, testInfo) => {
  await career(page);
  const expected = await page.evaluate(() => {
    const human = getUserTeam();
    STATE.currentRound = 6; STATE.currentDay = 24;
    const next = STATE.schedule[6].find((match: any) => match.home === human.id || match.away === human.id);
    const opponent = STATE.league.teams.find((team: any) => team.id === (next.home === human.id ? next.away : next.home));
    const clubs = STATE.league.teams.filter((team: any) => team.id !== human.id && team.id !== opponent.id);
    opponent.name = 'ClubAdverseAvecUnNomSansEspace'.repeat(9);
    const longPlayer = '<em data-scout-injected="yes">Buteur</em>' + 'TrèsLongNom'.repeat(25);
    human.players.forEach((player: any) => {
      player.injured = false; player.suspended = false;
      player.overall = ({ GK: 70, DEF: 62, MID: 74, ATT: 80 } as Record<string, number>)[player.pos];
    });
    const profile = [
      { name: 'Gardien adverse', pos: 'GK', overall: 80 },
      { name: 'Défenseur disponible', pos: 'DEF', overall: 72 },
      { name: 'Défenseur blessé', pos: 'DEF', overall: 98, injured: true, injuryDaysLeft: 3 },
      { name: 'Milieu A', pos: 'MID', overall: 68 },
      { name: 'Milieu B', pos: 'MID', overall: 66 },
      { name: longPlayer, pos: 'ATT', overall: 90, goals: 5, matches: 6 },
      { name: 'Attaquant suspendu', pos: 'ATT', overall: 70, suspended: true, suspensionMatches: 17 },
      { name: 'Deuxième buteur', pos: 'ATT', overall: 80, goals: 3, matches: 4 },
    ];
    const original = opponent.players.slice();
    opponent.players = profile.map((values, i) => ({ ...original[i % original.length], id: 'scout-fixture-' + i,
      goals: 0, matches: 2, injured: false, suspended: false, ...values }));
    const played = (round: number, home: boolean, gf: number, ga: number, penaltyWinner: string | null = null) => ({
      round, home: home ? opponent.id : clubs[round % clubs.length].id,
      away: home ? clubs[round % clubs.length].id : opponent.id, played: true,
      homeGoals: home ? gf : ga, awayGoals: home ? ga : gf, penaltyWinner,
    });
    // Le calendrier conserve toutes ses fixtures, même celles sans résultat joué.
    STATE.league.results = [...STATE.league.results.map((result: any) => ({ ...result, played: false })),
      played(3, false, 1, 1, 'away'), played(0, true, 9, 1), played(5, true, 6, 2),
      played(1, true, 3, 1), played(4, true, 0, 0, 'away'), played(2, false, 2, 4),
      { ...played(8, true, 99, 0), played: false },
      { round: 9, home: human.id, away: clubs[0].id, played: true, homeGoals: 88, awayGoals: 0 }];
    renderCalendarTab();
    return { opponent: opponent.name, longPlayer,
      names: [5, 4, 3, 2, 1].map(round => clubs[round % clubs.length].name),
      humanCounts: ['GK', 'DEF', 'MID', 'ATT'].map(pos => human.players.filter((player: any) => player.pos === pos).length) };
  });
  const report = await prepare(page);
  await expect(report.locator('.scout-opponent')).toHaveText(expected.opponent);
  await expect(report.locator('.scout-brief')).toContainText('5 matchs récents · 3 victoires · 2 défaites');
  await expect(report.locator('.scout-brief')).toContainText('2 joueurs indisponibles');
  await report.locator(':scope > summary').click();
  const results = report.locator('.scout-result');
  await expect(results).toHaveCount(5);
  const scores = ['6 – 2', '0 – 0', '1 – 1', '2 – 4', '3 – 1'];
  const outcomes = ['Victoire', 'Défaite', 'Victoire', 'Défaite', 'Victoire'];
  for (let i = 0; i < 5; i++) {
    await expect(results.nth(i).locator('.scout-name')).toHaveText(expected.names[i]);
    await expect(results.nth(i).locator('.scout-score')).toHaveText(scores[i]);
    await expect(results.nth(i).locator('.scout-outcome')).toHaveText(outcomes[i]);
  }
  await expect(results.nth(0).locator('.scout-meta')).toHaveText('J6 · Domicile');
  await expect(results.nth(1).locator('.scout-meta')).toHaveText('J5 · Domicile · aux tirs au but');
  await expect(results.nth(2).locator('.scout-meta')).toHaveText('J4 · Extérieur · aux tirs au but');
  await expect(results.nth(3).locator('.scout-meta')).toHaveText('J3 · Extérieur');
  await expect(report.locator('.scout-recent')).toContainText('12 buts pour, 8 contre');
  await expect(report.locator('.scout-recent')).not.toContainText('9 – 1');
  await expect(report.locator('.scout-recent')).not.toContainText('88');
  const scorers = report.locator('.scout-scorers .scout-player');
  await expect(scorers).toHaveCount(2);
  await expect(scorers.first().locator('.scout-name')).toHaveText(expected.longPlayer);
  await expect(scorers.first()).toContainText('5 buts · 6 matchs');
  await expect(report.locator('[data-scout-injected]')).toHaveCount(0);
  await expect(report.locator('.scout-absences')).toContainText('Défenseur blessé · DEF');
  await expect(report.locator('.scout-absences')).toContainText('3 jours restants dans le jeu');
  await expect(report.locator('.scout-absences')).toContainText('Attaquant suspendu · ATT');
  await expect(report.locator('.scout-absences')).toContainText('Suspendu · durée non renseignée');
  await expect(report.locator('.scout-absences')).not.toContainText('17');
  const rows = report.locator('.scout-position-row');
  for (let i = 0; i < 4; i++) {
    await expect(rows.nth(i).locator('th')).toHaveText(['GK', 'DEF', 'MID', 'ATT'][i]);
    await expect(rows.nth(i).locator('td').nth(0).locator('.scout-average')).toHaveText(['70', '62', '74', '80'][i]);
    await expect(rows.nth(i).locator('td').nth(1).locator('.scout-average')).toHaveText(['80', '72', '67', '85'][i]);
    await expect(rows.nth(i).locator('td').nth(0)).toContainText(`${expected.humanCounts[i]} disponible`);
    await expect(rows.nth(i).locator('td').nth(1)).toContainText(`${[1, 1, 2, 2][i]} disponible`);
  }
  await page.setViewportSize({ width: 320, height: 740 });
  const bounds = await report.evaluate(element => {
    const rect = element.getBoundingClientRect();
    const toggle = element.querySelector('summary')!.getBoundingClientRect();
    return { left: rect.left, right: rect.right, width: element.clientWidth, scrollWidth: element.scrollWidth,
      documentWidth: document.documentElement.scrollWidth, targetHeight: toggle.height };
  });
  expect(bounds.left).toBeGreaterThanOrEqual(0); expect(bounds.right).toBeLessThanOrEqual(320);
  expect(bounds.scrollWidth).toBeLessThanOrEqual(bounds.width);
  expect(bounds.documentWidth).toBeLessThanOrEqual(320); expect(bounds.targetHeight).toBeGreaterThanOrEqual(44);
  await expect(report.locator('.scout-opponent')).toHaveText(expected.opponent);
  await expect(scorers.first().locator('.scout-name')).toHaveText(expected.longPlayer);
  await report.evaluate(element => element.scrollIntoView({ block: 'start' }));
  await page.screenshot({ path: testInfo.outputPath('opponent-report-320.png') });
});

test('le tournoi prépare le vrai club étranger et lit les résultats de sa ligue de carrière', async ({ page }) => {
  await career(page);
  const expected = await page.evaluate(() => {
    const human = getUserTeam(), other = STATE.otherLeagues.find((entry: any) => entry.league.teams.length >= 3);
    const opponent = other.league.teams[0], rival = other.league.teams[1];
    opponent.players.forEach((player: any) => { player.goals = 0; player.matches = 2; player.injured = false; player.suspended = false; });
    const scorer = opponent.players.find((player: any) => player.pos === 'ATT') || opponent.players[0];
    scorer.name = 'Buteur de ligue étrangère'; scorer.goals = 12; scorer.matches = 8;
    other.league.results = [
      { round: 0, home: opponent.id, away: rival.id, played: true, homeGoals: 4, awayGoals: 2 },
      { round: 1, home: rival.id, away: opponent.id, played: true, homeGoals: 3, awayGoals: 3, penaltyWinner: 'away' },
      { round: 2, home: opponent.id, away: rival.id, played: false, homeGoals: 0, awayGoals: 0 },
    ];
    const humanRival = STATE.league.teams.find((team: any) => team.id !== human.id);
    STATE.league.results = [{ round: 0, home: human.id, away: humanRival.id, played: true, homeGoals: 88, awayGoals: 0 }];
    const qualifier = (team: any, leagueKey: string, leagueName: string, isUser: boolean) => ({ team, leagueKey, leagueName, isUser, points: 1, rank: 0 });
    const match = { home: qualifier(human, STATE.leagueKey, STATE.league.name, true),
      away: qualifier(opponent, other.key, other.name, false), played: false,
      homeGoals: null, awayGoals: null, penaltyWinner: null, winner: null };
    STATE.tournament = { roundIndex: 3, byes: [], finished: false, champion: null,
      rounds: [{ name: 'Barrage', matches: [] }, { name: 'Quarts de finale', matches: [] },
        { name: 'Demi-finales', matches: [] }, { name: 'Finale', matches: [match] }] };
    openTournamentScreen();
    return { opponent: opponent.name, opponentId: opponent.id, rival: rival.name, leagueName: other.league.name };
  });
  await expect(page.locator('#screen-tournament')).toBeVisible();
  await page.locator('#btn-play-tournament-match').click();
  await expect(page.locator('#screen-lineup')).toBeVisible();
  const report = page.locator('#opponent-report .scout-report');
  await expect(report.locator('.scout-opponent')).toHaveText(expected.opponent);
  await report.locator(':scope > summary').click();
  await expect(report.locator('.scout-body > .scout-note')).toContainText(expected.leagueName);
  await expect(report.locator('.scout-result')).toHaveCount(2);
  await expect(report.locator('.scout-result .scout-name')).toHaveText([expected.rival, expected.rival]);
  await expect(report.locator('.scout-score')).toHaveText(['3 – 3', '4 – 2']);
  await expect(report.locator('.scout-result').first().locator('.scout-meta')).toHaveText('J2 · Extérieur · aux tirs au but');
  await expect(report.locator('.scout-brief')).toContainText('2 matchs récents · 2 victoires · 0 défaites');
  await expect(report.locator('.scout-scorers')).toContainText('Buteur de ligue étrangère');
  await expect(report.locator('.scout-scorers')).toContainText('12 buts · 8 matchs');
  await expect(report.locator('.scout-recent')).not.toContainText('88');
  expect(await page.evaluate(() => STATE.tournamentMatchRef.away.team.id)).toBe(expected.opponentId);
});
