import { test, expect, type Page } from '@playwright/test';

declare const STATE: any;
declare const lineupSetup: any;
declare const matchState: any;
declare const matchEngine: any;
declare function getUserTeam(): any;
declare function getSavedTacticOrDefault(): any;
declare function saveGame(): boolean;
declare function updateTopbar(): void;
declare function renderCalendarTab(): void;
declare function renderClubManagement(): void;
declare function continueAfterMatch(): void;
declare function startNewSeason(): void;
declare function getCareerRules(kind: string, leagueKey?: string): any;

const errors = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    let seed = 20261104;
    Math.random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  });
  await page.route('https://kingsleague-cdn.kama.football/**', route => route.abort());
  await page.setViewportSize({ width: 1440, height: 1000 });
  errors.set(page, []);
  page.on('pageerror', error => errors.get(page)!.push(error.message));
});
test.afterEach(async ({ page }) => { expect(errors.get(page)).toEqual([]); });

async function career(page: Page, profiles?: { championship: string; tournament: string }) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.locator('#league-sidebar').getByRole('button', { name: /France/ }).click();
  await page.locator('#team-choice').getByRole('heading', { name: 'FC Silmi', exact: true }).click();
  if (profiles) {
    await page.locator('#new-career-rules > summary').click();
    await page.locator('#rules-new-championship').selectOption(profiles.championship);
    await page.locator('#rules-new-tournament').selectOption(profiles.tournament);
  }
  await page.locator('#btn-start').click();
  await page.locator('#btn-view-notifications').click();
  await page.getByRole('button', { name: 'Compris', exact: true }).click();
}

async function panel(page: Page, id: 'club-training' | 'club-promises' | 'competition-rules') {
  await page.locator('[data-tab="calendar"]').click();
  for (const selector of ['#club-management', `#${id}`]) {
    const details = page.locator(selector);
    if (await details.getAttribute('open') === null) await details.locator(':scope > summary').click();
  }
}

async function request(page: Page, templateIdx: number, options: { playerId?: string; requestId?: string } = {}) {
  const fixture = await page.evaluate(({ templateIdx, playerId, requestId }) => {
    const team = getUserTeam();
    const selected = getSavedTacticOrDefault().assignments;
    const player = team.players.find((p: any) => p.id === playerId)
      || team.players.find((p: any) => selected.includes(p.id) && p.pos !== 'GK');
    if (!player) throw new Error('La fixture exige un titulaire disponible.');
    player.form = 70;
    STATE.notifications = [{ id: requestId || `promise-fixture-${templateIdx}`, type: 'message', templateIdx,
      playerId: player.id, title: 'Demande du vestiaire', body: 'Je souhaite un engagement précis pour les prochains matchs.' }];
    saveGame(); updateTopbar(); renderCalendarTab();
    return { playerId: player.id, name: player.name, form: player.form };
  }, { templateIdx, ...options });
  await page.locator('#btn-view-notifications').click();
  await expect(page.locator('#notif-promise-preview')).toBeVisible();
  return fixture;
}

async function finishToSummary(page: Page) {
  await page.locator('#btn-prepare-match').click();
  const initialLineup = await page.evaluate(() => [...lineupSetup.assignments]);
  await page.locator('#btn-play-match').click();
  if (await page.locator('#phase-lineup-modal').isVisible()) await page.locator('#btn-phase-lineup-auto').click();
  await page.locator('#btn-skip-match').click();
  await expect(page.locator('#btn-skip-match')).toHaveText('Voir le résumé');
  await page.locator('#btn-skip-match').click();
  await expect(page.locator('#screen-summary')).toBeVisible();
  return initialLineup;
}

async function snapshot(page: Page) {
  return page.evaluate(() => JSON.parse(JSON.stringify({
    promises: STATE.playerPromises, training: STATE.clubTraining,
    rules: getCareerRules('championship'), tournamentRules: getCareerRules('tournament'),
    players: getUserTeam().players, round: STATE.currentRound, day: STATE.currentDay,
    progress: STATE.playerProgress,
  })));
}

async function exported(page: Page) {
  await page.locator('#btn-restart').click();
  await page.evaluate(() => {
    const original = URL.createObjectURL.bind(URL);
    (window as any).__clubExport = null;
    URL.createObjectURL = function (blob: Blob | MediaSource) {
      if (blob instanceof Blob) (window as any).__clubExport = blob.text();
      return original(blob);
    };
  });
  const downloading = page.waitForEvent('download');
  await page.locator('#saves-list').getByRole('button', { name: 'Exporter', exact: true }).first().click();
  expect(await (await downloading).failure()).toBeNull();
  return page.evaluate(async () => JSON.parse(await (window as any).__clubExport));
}

async function importAndResume(page: Page, entry: any, name: string) {
  entry.meta.teamName = name;
  await page.locator('#import-save-input').setInputFiles({ name: 'gestion-club.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(entry)) });
  await expect(page.locator('#import-save-feedback')).toHaveText('Carrière importée avec succès !');
  await page.locator('#saves-list .transfer-row').filter({ hasText: name }).getByRole('button', { name: 'Continuer', exact: true }).click();
  await expect(page.locator('#screen-main')).toBeVisible();
}

test('une promesse est explicite avant accord et réagit au vrai match une seule fois, jusque dans l’export-import', async ({ page }) => {
  test.setTimeout(120_000);
  await career(page);
  const fixture = await request(page, 2);
  await expect(page.locator('#notif-promise-preview')).toContainText('sept de départ');
  await expect(page.locator('#notif-promise-preview')).toContainText('+2');
  await page.locator('#notif-promise-accept').click();
  const accepted = await snapshot(page);
  expect(accepted.players.find((p: any) => p.id === fixture.playerId).form).toBe(70);
  expect(accepted.promises.entries).toHaveLength(1);
  expect(accepted.promises.entries[0].status).toBe('active');
  await panel(page, 'club-promises');
  await expect(page.locator('#club-promises-content')).toContainText('0/1');
  const initialLineup = await finishToSummary(page);
  expect(initialLineup).toContain(fixture.playerId);
  // Référence indépendante du bonus : la règle de forme habituelle à partir du
  // vrai résultat du moteur, avant la continuation qui valide la rencontre.
  const expected = await page.evaluate(playerId => {
    const pending = STATE.pendingResult, result = pending.result, player = getUserTeam().players.find((p: any) => p.id === playerId);
    const home = pending.homeTeam.id === STATE.userTeamId;
    const played = Object.prototype.hasOwnProperty.call(result.ratings, playerId);
    let delta = -1;
    if (played) {
      const rating = result.ratings[playerId] || 6;
      delta = rating >= 7 ? 3 : rating >= 6 ? 1 : rating < 5 ? -2 : 0;
      const goalsFor = home ? result.homeGoals : result.awayGoals;
      const goalsAgainst = home ? result.awayGoals : result.homeGoals;
      delta += goalsFor > goalsAgainst ? 2 : goalsFor < goalsAgainst ? -2 : 0;
    }
    return { form: Math.max(40, Math.min(99, Math.max(40, Math.min(99, player.form + delta)) + 2)),
      before: JSON.parse(JSON.stringify(STATE.playerPromises)) };
  }, fixture.playerId);
  expect(expected.before).toEqual(accepted.promises);
  await page.locator('#btn-continue').click();
  await expect(page.locator('#screen-main')).toBeVisible();
  const committed = await snapshot(page);
  expect(committed.promises.entries[0].status).toBe('kept');
  expect(committed.players.find((p: any) => p.id === fixture.playerId).form).toBe(expected.form);
  expect(committed.round).toBe(1);
  await page.evaluate(() => { continueAfterMatch(); continueAfterMatch(); });
  expect(await snapshot(page)).toEqual(committed);
  await page.evaluate(playerId => {
    STATE.notifications = [{ id: 'promise-fixture-2', type: 'message', templateIdx: 2, playerId,
      title: 'Ancienne demande réinjectée', body: 'Cette demande a déjà été résolue.' }];
    updateTopbar(); renderCalendarTab();
  }, fixture.playerId);
  await page.locator('#btn-view-notifications').click();
  await expect(page.locator('#notif-promise-preview')).toContainText('déjà été traité');
  await expect(page.locator('#notif-promise-accept')).toBeDisabled();
  await page.locator('#notif-actions').getByRole('button', { name: 'Non', exact: true }).click();
  expect((await snapshot(page)).promises).toEqual(committed.promises);
  expect((await snapshot(page)).players.find((p: any) => p.id === fixture.playerId).form).toBe(expected.form);
  const latest = committed.progress.players.find((p: any) => p.id === fixture.playerId).samples.at(-1);
  expect(latest[8]).toBe(expected.form);
  const entry = await exported(page);
  expect(entry.data.playerPromises).toEqual(committed.promises);
  await importAndResume(page, entry, 'Promesses importées');
  const imported = await snapshot(page);
  expect(imported.promises).toEqual(committed.promises);
  expect(imported.players).toEqual(committed.players);
  const importedSlot = await page.evaluate(() => STATE.currentSlotId);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('#saves-list').getByRole('button', { name: 'Continuer', exact: true }).first().click();
  expect(await page.evaluate(() => STATE.currentSlotId)).toBe(importedSlot);
  expect((await snapshot(page)).promises).toEqual(committed.promises);
});

test('la séance exige confirmation, annulation et aperçu périmé restent sans effet, une journée ne peut pas être entraînée deux fois', async ({ page }) => {
  await career(page); await panel(page, 'club-training');
  const before = await snapshot(page);
  await page.locator('#training-confirm').click();
  await expect(page.locator('#confirm-modal')).toBeVisible();
  expect(await snapshot(page)).toEqual(before);
  await page.locator('#btn-confirm-cancel').click();
  expect(await snapshot(page)).toEqual(before);
  await page.locator('#training-confirm').click();
  const changed = await page.evaluate(() => {
    const player = getUserTeam().players.find((p: any) => !p.injured && !p.suspended && p.form < 98);
    player.form -= 1;
    return player.id;
  });
  const stale = await snapshot(page);
  await page.locator('#btn-confirm-ok').click();
  await expect(page.locator('#confirm-body')).toContainText(/changé|aperçu|Vérifie/i);
  expect((await snapshot(page)).players).toEqual(stale.players);
  expect((await snapshot(page)).training).toEqual(before.training);
  await page.locator('#btn-confirm-ok').click();
  await page.locator('#training-confirm').click();
  await page.locator('#btn-confirm-ok').click();
  const committed = await snapshot(page);
  expect(committed.training.history).toHaveLength(1);
  expect(committed.players.find((p: any) => p.id === changed).form).toBe(Math.min(99, stale.players.find((p: any) => p.id === changed).form + 2));
  expect([committed.round, committed.day]).toEqual([before.round, before.day]);
  await expect(page.locator('#training-confirm')).toBeDisabled();
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('#saves-list').getByRole('button', { name: 'Continuer', exact: true }).first().click();
  await panel(page, 'club-training');
  await expect(page.locator('#training-confirm')).toBeDisabled();
  expect((await snapshot(page)).training).toEqual(committed.training);
});

test('quatre séances techniques par journées distinctes donnent exactement un point et une observation persistante', async ({ page }) => {
  test.setTimeout(120_000);
  await career(page);
  const fixture = await page.evaluate(() => {
    const player = getUserTeam().players.find((p: any) => !p.injured && !p.suspended && p.technique < 99);
    player.form = 80;
    return { id: player.id, technique: player.technique, form: player.form };
  });
  for (let round = 0; round < 4; round++) {
    if (round) {
      // Fixture de calendrier : les effets de match ont leur propre test réel.
      // Changer l'époque permet de vérifier quatre confirmations UI sans attribuer
      // les variations d'entraînement à la progression aléatoire du moteur.
      await page.evaluate(round => { STATE.currentRound = round; STATE.currentDay = round * 7; renderCalendarTab(); }, round);
    }
    await panel(page, 'club-training');
    await page.locator('#training-mode').selectOption('technique');
    await page.getByRole('button', { name: 'Retirer la sélection', exact: true }).click();
    await page.locator('[data-training-player]').evaluateAll((elements, id) => {
      const checkbox = elements.find(element => (element as HTMLElement).dataset.trainingPlayer === id) as HTMLInputElement;
      if (!checkbox) throw new Error('Participant absent');
      checkbox.click();
    }, fixture.id);
    await expect(page.locator('#training-preview')).toContainText(round === 3 ? 'crédit remis à 0/4' : `${round}/4 → ${round + 1}/4`);
    await page.locator('#training-confirm').click(); await page.locator('#btn-confirm-ok').click();
    const current = await snapshot(page), player = current.players.find((p: any) => p.id === fixture.id);
    expect(player.technique).toBe(fixture.technique + (round === 3 ? 1 : 0));
    expect(player.form).toBe(fixture.form - 2 * (round + 1));
    expect(current.training.history).toHaveLength(round + 1);
    expect(current.round).toBe(round);
    expect(current.progress.players.find((p: any) => p.id === fixture.id).samples.at(-1)[5]).toBe(player.technique);
  }
  const complete = await snapshot(page), entry = await exported(page);
  expect(entry.data.clubTraining).toEqual(complete.training);
  await importAndResume(page, entry, 'Entraînement importé');
  expect((await snapshot(page)).training).toEqual(complete.training);
});

test('les demandes incompatibles et doublons ne créent pas de bonus ; le vestiaire reste lisible à 320 px avec un nom hostile', async ({ page }, info) => {
  await career(page);
  const fixture = await request(page, 0);
  await page.locator('#notif-promise-accept').click();
  await request(page, 1, { playerId: fixture.playerId, requestId: 'contradiction' });
  await expect(page.locator('#notif-promise-accept')).toBeDisabled();
  await expect(page.locator('#notif-promise-preview')).toContainText('déjà une promesse');
  await page.locator('#notif-actions').getByRole('button', { name: 'Non', exact: true }).click();
  const goalkeeper = await page.evaluate(() => getUserTeam().players.find((p: any) => p.pos === 'GK').id);
  await request(page, 3, { playerId: goalkeeper });
  await expect(page.locator('#notif-promise-accept')).toBeDisabled();
  await expect(page.locator('#notif-promise-preview')).toContainText('Aucun rôle offensif compatible');
  await page.locator('#notif-actions').getByRole('button', { name: 'Non', exact: true }).click();
  const state = await snapshot(page);
  expect(state.promises.entries).toHaveLength(1);
  expect(state.players.find((p: any) => p.id === fixture.playerId).form).toBe(70);
  expect(state.players.find((p: any) => p.id === goalkeeper).form).toBe(70);
  const hostile = '<img data-club-injected src=x onerror=alert(1)>王👑' + 'A'.repeat(300);
  await page.evaluate(({ id, hostile }) => { getUserTeam().players.find((p: any) => p.id === id).name = hostile; renderClubManagement(); }, { id: fixture.playerId, hostile });
  await page.setViewportSize({ width: 320, height: 740 });
  await panel(page, 'club-promises');
  await expect(page.locator('#club-promises-content h4')).toHaveText(hostile);
  await expect(page.locator('[data-club-injected]')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await page.locator('#club-promises-content').screenshot({ path: info.outputPath('promesses-320.png') });
  const playerLink = page.locator('#club-promises-content').getByRole('button', { name: 'Voir la fiche', exact: true });
  await playerLink.scrollIntoViewIfNeeded();
  await expect(playerLink).toBeInViewport({ ratio: 1 });
  expect(await playerLink.evaluate(element => element.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
  await page.screenshot({ path: info.outputPath('promesses-actions-320.png') });
  await panel(page, 'club-training');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await panel(page, 'competition-rules');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});

test('une ancienne carrière reçoit le format historique sans engagements ni séances inventés', async ({ page }) => {
  await career(page);
  const original = await snapshot(page);
  expect(original.rules.profileId).toBe('legacy-v1.5');
  expect(original.rules.config.totalMinutes).toBe(40);
  const entry = await exported(page);
  for (const field of ['clubTraining', 'playerPromises', 'competitionRules', 'nextSeasonRules']) delete entry.data[field];
  await importAndResume(page, entry, 'Ancienne carrière sans gestion');
  const migrated = await snapshot(page);
  expect(migrated.rules.profileId).toBe('legacy-v1.5');
  expect(migrated.rules.config).toEqual(original.rules.config);
  expect(migrated.tournamentRules.config).toEqual(original.tournamentRules.config);
  expect(migrated.promises.entries).toEqual([]);
  expect(migrated.training.history).toEqual([]);
  expect(migrated.training.last).toBeNull();
  expect(migrated.players).toEqual(original.players);
  await panel(page, 'competition-rules');
  await expect(page.locator('#competition-rules-content')).toContainText('40 min');
  await page.locator('#btn-prepare-match').click(); await page.locator('#btn-play-match').click();
  expect(await page.evaluate(() => matchEngine.timing.totalMinutes)).toBe(40);
});

test('les nouveaux profils restent épinglés jusqu’à la prochaine saison et le moteur lit le bon championnat', async ({ page }) => {
  await career(page, { championship: 'guide-2026-11-04', tournament: 'legacy-v1.5' });
  const initial = await snapshot(page);
  expect(initial.rules.config.totalMinutes).toBe(36);
  expect(initial.tournamentRules.config.totalMinutes).toBe(40);
  await panel(page, 'competition-rules');
  await expect(page.locator('#competition-rules-content')).toContainText('Adaptation du guide');
  await page.locator('#rules-next-championship').selectOption('legacy-v1.5');
  await page.locator('#rules-next-tournament').selectOption('guide-2026-11-04');
  await page.locator('#rules-next-save').click();
  await page.locator('#btn-confirm-cancel').click();
  expect(await page.evaluate(() => STATE.nextSeasonRules)).toEqual({ championship: 'keep', tournament: 'keep' });
  await page.locator('#rules-next-save').click(); await page.locator('#btn-confirm-ok').click();
  await expect(page.locator('#rules-save-status')).toContainText('saison suivante');
  expect((await snapshot(page)).rules).toEqual(initial.rules);
  expect((await snapshot(page)).tournamentRules).toEqual(initial.tournamentRules);
  await page.locator('#btn-prepare-match').click(); await page.locator('#btn-play-match').click();
  expect(await page.evaluate(() => matchEngine.timing.totalMinutes)).toBe(36);
  if (await page.locator('#phase-lineup-modal').isVisible()) await page.locator('#btn-phase-lineup-auto').click();
  await page.locator('#btn-skip-match').click();
  await expect(page.locator('#btn-skip-match')).toHaveText('Voir le résumé');
  await page.locator('#btn-skip-match').click(); await page.locator('#btn-continue').click();
  const archivedRules = await page.evaluate(() => STATE.matchReports.find((report: any) => report.home.id === STATE.userTeamId || report.away.id === STATE.userTeamId).rules);
  expect(archivedRules.profileId).toBe('guide-2026-11-04');
  expect(archivedRules.config.totalMinutes).toBe(36);
  const entry = await exported(page);
  expect(entry.data.competitionRules.championship).toEqual(initial.rules);
  expect(entry.data.nextSeasonRules).toEqual({ championship: 'legacy-v1.5', tournament: 'guide-2026-11-04' });
  await importAndResume(page, entry, 'Règlements importés');
  // Fixture de fin de saison : la transition réelle conserve les effectifs et
  // démarre chaque ligue avec la copie choisie pour sa nouvelle saison.
  await page.evaluate(() => {
    STATE.currentRound = STATE.schedule.length;
    for (const league of STATE.otherLeagues) league.currentRound = league.schedule.length;
    STATE.notifications = [];
    startNewSeason();
  });
  const next = await snapshot(page);
  expect(next.rules.profileId).toBe('legacy-v1.5'); expect(next.rules.season).toBe(2);
  expect(next.tournamentRules.profileId).toBe('guide-2026-11-04'); expect(next.tournamentRules.season).toBe(2);
  expect(await page.evaluate(() => STATE.matchReports.find((report: any) => report.home.id === STATE.userTeamId || report.away.id === STATE.userTeamId).rules)).toEqual(archivedRules);
  expect(await page.evaluate(() => STATE.competitionRules.otherLeagues.every((entry: any) => entry.rules.profileId === 'legacy-v1.5' && entry.rules.season === 2))).toBe(true);
  expect(await page.evaluate(() => STATE.nextSeasonRules)).toEqual({ championship: 'keep', tournament: 'keep' });
  await page.locator('#btn-view-notifications').click();
  await page.getByRole('button', { name: 'Compris', exact: true }).click();
  await page.locator('#btn-prepare-match').click(); await page.locator('#btn-play-match').click();
  expect(await page.evaluate(() => matchEngine.timing.totalMinutes)).toBe(40);
});

test('un match abandonné par rechargement ne consomme aucune échéance de promesse', async ({ page }) => {
  await career(page);
  const fixture = await request(page, 0);
  await page.locator('#notif-promise-accept').click();
  const accepted = await snapshot(page);
  await page.locator('#btn-prepare-match').click(); await page.locator('#btn-play-match').click();
  expect(await page.evaluate(() => STATE.pendingResult)).toBeNull();
  expect((await snapshot(page)).promises).toEqual(accepted.promises);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('#saves-list').getByRole('button', { name: 'Continuer', exact: true }).first().click();
  const resumed = await snapshot(page);
  expect(resumed.promises).toEqual(accepted.promises);
  expect(resumed.round).toBe(accepted.round);
  expect(resumed.players.find((p: any) => p.id === fixture.playerId).form).toBe(70);
});
