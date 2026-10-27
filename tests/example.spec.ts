import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

// État global lexical du jeu, accessible dans le contexte navigateur des tests.
declare const STATE: any;
declare function generateSchedule(ids: string[]): Array<Array<{ home: string; away: string }>>;
declare function saveGame(): void;

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
  await page.evaluate(() => {
    const team = STATE.league.teams.find((item: any) => item.id === STATE.userTeamId);
    team.players.forEach((player: any) => { if (player.pos !== 'GK') player.pos = 'MID'; });
  });
  await page.locator('#btn-prepare-match').click();
  await expect(page.locator('#lineup-count')).toHaveText('7');
  await expect(page.locator('#btn-play-match')).toBeEnabled();
  await expect(page.locator('#pitch-field .pitch-slot.pos-GK.filled')).toHaveCount(1);
  expect(await page.locator('#pitch-field .slot-role-warning').count()).toBeGreaterThan(0);
});

test('le résumé brésilien reste accessible avec une note absente et un joueur sorti', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await startCareer(page, 'Brésil', 'G3X FC');
  await page.locator('#btn-prepare-match').click();
  await page.locator('#btn-play-match').click();
  await page.locator('#btn-phase-lineup-auto').click();
  await page.locator('#btn-skip-match').click();
  await expect(page.locator('#btn-skip-match')).toHaveText('Voir le résumé');
  const expected = await page.evaluate(() => {
    // Une composition peut changer sans que le joueur entrant ait eu le temps
    // de participer ; les sortants restent présents dans le résultat du moteur.
    const pending = STATE.pendingResult;
    const { result, homeSetup } = pending;
    const exitedId = result.participants.home[0];
    homeSetup.lineup = homeSetup.lineup.filter((id: string) => id !== exitedId);
    delete result.ratings[result.participants.home[1]];
    return { count: result.participants.home.length, name: pending.homeTeam.players.find((p: any) => p.id === exitedId).name };
  });
  await page.locator('#btn-skip-match').click();
  await expect(page.locator('#screen-summary')).toBeVisible();
  await expect(page.locator('#summary-home-ratings tr')).toHaveCount(expected.count);
  await expect(page.locator('#summary-home-ratings')).toContainText(expected.name);
  await expect(page.locator('#summary-home-ratings')).toContainText('—');
  await page.locator('#btn-continue').click();
  await expect(page.locator('#screen-main')).toBeVisible();
  await page.reload();
  await expect(page.locator('#saves-list .transfer-row').filter({ hasText: 'G3X FC' })).toContainText('Journée 2');
  expect(pageErrors).toEqual([]);
});

test('la nouvelle base mexicaine conserve les anciennes carrières à douze clubs', async ({ page }) => {
  await startCareer(page, 'Mexique', 'Persas FC');
  const baseline = JSON.parse(await readFile('research/rosters-baseline.json', 'utf8'));
  await page.evaluate((oldTeams: any[]) => {
    STATE.league.teams = oldTeams.map(team => ({ ...team, players: team.players.map((player: any, index: number) => ({ ...player, id: `${team.id}-legacy-${index}`, form: 80 })) }));
    STATE.userTeamId = 'lal';
    STATE.schedule = generateSchedule(STATE.league.teams.map((team: any) => team.id));
    STATE.league.results = STATE.schedule.flatMap((matches: any[], round: number) => matches.map(match => ({ ...match, round, played: false, homeGoals: 0, awayGoals: 0 })));
    saveGame();
  }, baseline.leagues.mexico.teams);
  await page.reload();
  await page.locator('#league-sidebar').getByText('Mexique', { exact: false }).click();
  await expect(page.locator('#team-choice .team-card')).toHaveCount(10);
  await expect(page.locator('#team-choice')).not.toContainText('Los Aliens');
  await expect(page.locator('#roster-revision-note')).toContainText('26/10/2026');
  await expect(page.locator('#roster-revision-note')).toContainText('Nouvelles carrières');
  const oldCareer = page.locator('#saves-list .transfer-row').filter({ hasText: 'Los Aliens FC' });
  await oldCareer.getByRole('button', { name: 'Continuer', exact: true }).click();
  await expect(page.locator('#topbar-team')).toHaveText('Los Aliens FC');
  expect(await page.evaluate(() => STATE.league.teams.length)).toBe(12);
});

test('le portrait officiel italien apparaît dans l’effectif et la fiche du bon joueur', async ({ page }) => {
  // Le réseau est simulé ici pour tester le rendu sans dépendre du CDN en CI.
  // Les originaux sont contrôlés séparément par verify-player-photos.cjs.
  await page.route('https://kingsleague-cdn.kama.football/**', route => route.fulfill({
    status: 200, contentType: 'image/png',
    body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a0WQAAAAASUVORK5CYII=', 'base64'),
  }));
  await startCareer(page, 'Italie', 'Alpak FC');
  await page.locator('.nav button[data-tab="squad"]').click();
  const row = page.locator('#squad-table tbody tr').filter({ hasText: 'Luigi Castelli' });
  const expected = 'https://kingsleague-cdn.kama.football/account/production/seasonTeamPlayer/67ccdb5f-4a56-43a6-89d7-3f9602582883/244541879.png';
  await expect(row.locator('img.avatar-sm-img')).toHaveAttribute('src', expected);
  await expect(row.locator('img.avatar-sm-img')).toBeVisible();
  await row.locator('.player-cell-name').click();
  await expect(page.locator('#player-info-modal')).toBeVisible();
  await expect(page.locator('#player-info-body')).toContainText('Luigi Castelli');
  await expect(page.locator('#player-info-body img.player-photo-lg')).toHaveAttribute('src', expected);
  await expect(page.locator('#player-info-body img.player-photo-lg')).toBeVisible();
});

