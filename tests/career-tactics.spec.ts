import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

declare const STATE: any;
declare const tacticsSetup: any;
declare const lineupSetup: any;
declare const matchState: any;
declare const matchEngine: any;
declare function getUserTeam(): any;
declare function saveGame(): void;
declare function maybeAskPhaseLineup(minute: number): boolean;

const pageErrors = new WeakMap<Page, string[]>();

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    let seed = 20261104;
    Math.random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  });
  await page.route('https://kingsleague-cdn.kama.football/**', route => route.abort());
  await page.setViewportSize({ width: 1920, height: 1080 });
  const errors: string[] = [];
  pageErrors.set(page, errors);
  page.on('pageerror', error => errors.push(error.message));
});

test.afterEach(async ({ page }) => {
  expect(pageErrors.get(page)).toEqual([]);
});

async function career(page: Page, teamName = 'FC Silmi') {
  await page.goto('/');
  await page.locator('#league-sidebar').getByRole('button', { name: /France/ }).click();
  // Le sigle du blason de secours peut rejoindre le nom accessible du bouton
  // après l'échec CDN ; le titre du club reste son libellé stable.
  await page.locator('#team-choice').getByRole('heading', { name: teamName, exact: true }).click();
  await page.locator('#btn-start').click();
  await page.locator('#btn-view-notifications').click();
  await page.getByRole('button', { name: 'Compris', exact: true }).click();
}

async function tactics(page: Page) {
  await page.locator('[data-tab="tactics"]').click();
  await expect(page.locator('#tab-tactics')).toBeVisible();
  await expect(page.locator('#tactics-presets .preset-card')).toHaveCount(3);
  await openPresets(page, 'tactics-presets');
}

async function openPresets(page: Page, container: string) {
  const panel = page.locator(`details.career-presets-panel:has(#${container})`);
  if (await panel.getAttribute('open') === null) await panel.locator(':scope > summary').click();
}

async function resume(page: Page, teamName = 'FC Silmi', last = false) {
  const rows = page.locator('#saves-list .transfer-row').filter({ hasText: teamName });
  await (last ? rows.last() : rows.first()).getByRole('button', { name: 'Continuer', exact: true }).click();
  await tactics(page);
}

function presetAction(page: Page, id: string, action: string, container = 'tactics-presets') {
  return page.locator(`#${container} [data-preset-id="${id}"][data-preset-action="${action}"]`);
}

async function savePreset(page: Page, id: string) {
  await openPresets(page, 'tactics-presets');
  await presetAction(page, id, 'save').click();
  if (await page.locator('#confirm-modal').isVisible()) await page.locator('#btn-confirm-ok').click();
  await expect(presetAction(page, id, 'load')).toBeEnabled();
}

async function saved(page: Page) {
  return page.evaluate(() => {
    const state = JSON.parse(JSON.stringify({
      savedTactic: STATE.savedTactic, tacticPresets: STATE.tacticPresets,
      activeTacticPreset: STATE.activeTacticPreset
    }));
    // Une ancienne vue « in/out » n'est pas une donnée tactique persistante.
    // Sa suppression au chargement est une migration attendue.
    if (state.savedTactic) delete state.savedTactic.viewMode;
    return state;
  });
}

async function composition(page: Page, pitch = 'tactics-pitch-field'): Promise<string[]> {
  return page.locator(`#${pitch} .pitch-slot`).evaluateAll(elements =>
    elements.map(element => element.getAttribute('data-player-id') || ''));
}

async function openPhase(page: Page, container: string, kind: 'escalier' | 'matchball') {
  const phase = page.locator(`#${container} [data-kings-prep-phase="${kind}"]`);
  if (await phase.getAttribute('open') === null) await phase.locator(`[data-kings-prep-focus="${kind}-summary"]`).click();
  return phase;
}

async function prepareOrders(page: Page, container: string) {
  for (const kind of ['escalier', 'matchball'] as const) {
    const phase = await openPhase(page, container, kind);
    await phase.locator(`[data-kings-prep-focus="${kind}-toggle"]`).check();
    await expect(phase.locator('.kings-prep-player')).toHaveCount(6);
    // Le deuxième joueur passe en tête. Le focus et la liste doivent survivre au rendu.
    const up = phase.locator('.kings-prep-player').nth(1).getByRole('button', { name: /^Monter / });
    await up.focus();
    await up.press('Enter');
    await expect(phase.locator('.kings-prep-badge')).toHaveText('Préparé');
    await expect(phase.locator('.kings-prep-keeper')).toContainText('Gardien inclus à part');
  }
}

async function protectedPlan(page: Page) {
  await savePreset(page, 'usual');
  const usual = (await saved(page)).tacticPresets.find((slot: any) => slot.id === 'usual');
  await savePreset(page, 'protect');
  await presetAction(page, 'protect', 'load').click();
  await page.locator('#tactics-formation-choice').getByRole('button', { name: '3-2-1', exact: true }).click();
  await page.locator('#tactics-attack-plan-choice').getByRole('button', { name: 'Jeu direct', exact: true }).click();
  await page.locator('#tactics-defense-plan-choice').getByRole('button', { name: 'Bloc bas', exact: true }).click();
  await page.locator('#tactics-mentality-choice').getByRole('button', { name: 'Prudente', exact: true }).click();
  const firstDefender = page.locator('#tactics-pitch-field .pitch-slot[data-slot-index="1"]');
  const secondDefender = page.locator('#tactics-pitch-field .pitch-slot[data-slot-index="2"]');
  await firstDefender.press('Enter');
  await secondDefender.press('Enter');
  const defenderId = (await firstDefender.getAttribute('data-player-id'))!;
  await page.locator(`#tactics-bench-list .tactic-role-select[data-player-id="${defenderId}"]`).selectOption('overlap');
  await prepareOrders(page, 'tactics-phase-preparation');
  const name = presetAction(page, 'protect', 'rename');
  await name.fill('Bloc prudent — fin de match');
  await name.press('Enter');
  await savePreset(page, 'protect');
  const state = await saved(page);
  const protect = state.tacticPresets.find((slot: any) => slot.id === 'protect');
  expect(protect.tactic.playerRoles[defenderId]).toBe('overlap');
  expect(state.tacticPresets.find((slot: any) => slot.id === 'usual')).toEqual(usual);
  return { usual, protect, defenderId };
}

async function expectValidSeven(page: Page, pitch: string) {
  const ids = await composition(page, pitch);
  expect(ids).toHaveLength(7);
  expect(ids.every(Boolean)).toBe(true);
  expect(new Set(ids).size).toBe(7);
  const keepers = await page.evaluate(assigned => getUserTeam().players
    .filter((player: any) => assigned.includes(player.id) && player.pos === 'GK').map((player: any) => player.id), ids);
  expect(keepers).toHaveLength(1);
  expect(await page.locator(`#${pitch} .pitch-slot.pos-GK`).getAttribute('data-player-id')).toBe(keepers[0]);
  return ids;
}

test('une ancienne savedTactic migre vers Habituel en conservant rôles, intention et ordres préparés', async ({ page }) => {
  await career(page);
  await tactics(page);
  await page.locator('#tactics-mentality-choice').getByRole('button', { name: 'Offensive', exact: true }).click();
  const midfielder = (await page.locator('#tactics-pitch-field .pitch-slot[data-slot-index="3"]').getAttribute('data-player-id'))!;
  await page.locator(`#tactics-bench-list .tactic-role-select[data-player-id="${midfielder}"]`).selectOption('creator');
  await prepareOrders(page, 'tactics-phase-preparation');
  await savePreset(page, 'usual');
  const expected = (await saved(page)).savedTactic;
  await page.locator('#btn-restart').click();
  // Le point d'entrée de migration est un vrai fichier de carrière ancien, sans les nouveaux champs.
  await page.evaluate(() => {
    const key = 'kingsManager7v7_saves';
    const saves = JSON.parse(localStorage.getItem(key) || '{}') as Record<string, any>;
    const data = Object.values(saves)[0].data;
    delete data.tacticPresets;
    delete data.activeTacticPreset;
    data.savedTactic.formationOOP = '1-3-2-1';
    data.savedTactic.assignmentsOOP = [...data.savedTactic.assignments].reverse();
    localStorage.setItem(key, JSON.stringify(saves));
  });
  await page.reload();
  await resume(page);
  const restored = await saved(page);
  expect(restored.tacticPresets.map((slot: any) => slot.id)).toEqual(['usual', 'protect', 'chase']);
  expect(restored.tacticPresets.map((slot: any) => slot.name)).toEqual(['Habituel', 'Protéger l’avance', 'Revenir au score']);
  expect(restored.activeTacticPreset).toBe('usual');
  const tactic = restored.tacticPresets[0].tactic;
  for (const key of ['formation', 'assignments', 'attackPlan', 'defensePlan', 'mentality', 'playerRoles', 'escalierOrder', 'matchballOrder']) {
    expect(tactic[key], key).toEqual(expected[key]);
  }
  expect(tactic.formationOOP).toBe(tactic.formation);
  expect(tactic.assignmentsOOP).toEqual(tactic.assignments);
  expect(restored.tacticPresets[1].tactic).toBeNull();
  expect(restored.tacticPresets[2].tactic).toBeNull();
  await expect(presetAction(page, 'protect', 'load')).toBeDisabled();
  await expect(presetAction(page, 'chase', 'load')).toBeDisabled();
  await expect(page.locator(`#tactics-bench-list .tactic-role-select[data-player-id="${midfielder}"]`)).toHaveValue('creator');
  await expect(page.locator('#tactics-mentality-choice [data-mentality="attacking"]')).toHaveAttribute('aria-pressed', 'true');
  expect(await composition(page)).toEqual(expected.assignments);
});

test('les trois plans restent indépendants après renommage, rechargement et export-import réel', async ({ page, browserName }, testInfo) => {
  await career(page);
  await tactics(page);
  const { usual, protect } = await protectedPlan(page);
  await savePreset(page, 'chase');
  await page.locator('#tactics-mentality-choice').getByRole('button', { name: 'Offensive', exact: true }).click();
  const chase = (await saved(page)).tacticPresets.find((slot: any) => slot.id === 'chase');
  expect(chase.tactic.mentality).toBe('attacking');
  expect((await saved(page)).tacticPresets.find((slot: any) => slot.id === 'protect')).toEqual(protect);
  await presetAction(page, 'usual', 'load').click();
  expect(await composition(page)).toEqual(usual.tactic.assignments);
  await presetAction(page, 'protect', 'load').click();
  expect(await composition(page)).toEqual(protect.tactic.assignments);
  const expected = await saved(page);
  await page.locator('#btn-restart').click();
  await page.reload();
  await resume(page);
  expect(await saved(page)).toEqual(expected);
  await expect(presetAction(page, 'protect', 'rename')).toHaveValue('Bloc prudent — fin de match');
  await page.locator('#btn-restart').click();
  const downloadEvent = page.waitForEvent('download');
  await page.locator('#saves-list .transfer-row').filter({ hasText: 'FC Silmi' }).getByRole('button', { name: 'Exporter', exact: true }).click();
  const download = await downloadEvent;
  const exportedPath = testInfo.outputPath('carriere-exportee.json');
  let contents = '';
  // Le fichier peut encore être verrouillé brièvement après l'événement download sous Windows.
  await expect(async () => {
    await download.saveAs(exportedPath);
    contents = await readFile(exportedPath, 'utf8');
  }).toPass({ timeout: 5_000, intervals: [100, 250, 500] });
  const buffer = Buffer.from(contents);
  expect(JSON.parse(buffer.toString()).data.tacticPresets).toEqual(expected.tacticPresets);
  await page.getByText('Importer une carrière', { exact: true }).click();
  await page.locator('#import-save-input').setInputFiles({ name: download.suggestedFilename(), mimeType: 'application/json', buffer });
  await expect(page.locator('#import-save-feedback')).toHaveText('Carrière importée avec succès !');
  await expect(page.locator('#saves-list .transfer-row').filter({ hasText: 'FC Silmi' })).toHaveCount(2);
  await resume(page, 'FC Silmi', true);
  expect(await saved(page)).toEqual(expected);
  await presetAction(page, 'usual', 'load').click();
  expect(await composition(page)).toEqual(usual.tactic.assignments);
  await presetAction(page, 'protect', 'load').click();
  expect(await composition(page)).toEqual(protect.tactic.assignments);
  expect((await saved(page)).tacticPresets.find((slot: any) => slot.id === 'chase')).toEqual(chase);
  if (browserName === 'chromium') {
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await openPresets(page, 'tactics-presets');
      const panel = page.locator('details.career-presets-panel:has(#tactics-presets)');
      await panel.screenshot({ path: testInfo.outputPath(`presets-${width}.png`) });
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    }
  }
});

test('Charger reste temporaire avant et pendant le match, sans réintroduire un joueur expulsé', async ({ page }) => {
  await career(page);
  await tactics(page);
  const { protect } = await protectedPlan(page);
  await presetAction(page, 'usual', 'load').click();
  const persistent = await saved(page);
  await page.locator('[data-tab="calendar"]').click();
  await page.locator('#btn-prepare-match').click();
  await openPresets(page, 'lineup-presets');
  await page.locator('#secret-card-choice .secret-card').click();
  const matchIdentity = await page.evaluate(() => ({ secretCard: lineupSetup.secretCard, opponentId: lineupSetup.opponentId }));
  await presetAction(page, 'protect', 'load', 'lineup-presets').click();
  expect(await composition(page, 'pitch-field')).toEqual(protect.tactic.assignments);
  await expectValidSeven(page, 'pitch-field');
  expect(await saved(page)).toEqual(persistent);
  expect(await page.evaluate(() => ({ secretCard: lineupSetup.secretCard, opponentId: lineupSetup.opponentId }))).toEqual(matchIdentity);
  await page.locator('#btn-play-match').click();
  await expect(page.locator('#phase-lineup-modal')).not.toBeVisible();
  await page.locator('#btn-tactics-match').click();
  await expect(page.locator('#match-tactics-modal')).toBeVisible();
  await openPresets(page, 'match-presets');
  await presetAction(page, 'usual', 'load', 'match-presets').click();
  await expectValidSeven(page, 'match-tactics-pitch-field');
  // Déclenche un véritable rouge du moteur. Le hasard reste isolé à cet événement rare ;
  // les tableaux de sanctions et la validation du chargement ne sont pas remplacés.
  const red = await page.evaluate(() => {
    const originalRandom = Math.random;
    const rolls = [0.5, 0.5, 0, matchState.userSide === 'home' ? 0 : 0.9, 0, 0.5];
    Math.random = () => rolls.length ? rolls.shift()! : 0.5;
    try {
      return matchEngine.simulateMinute(8).find((event: any) => event.type === 'red' && event.side === matchState.userSide);
    } finally { Math.random = originalRandom; }
  });
  expect(red?.playerId).toBeTruthy();
  await presetAction(page, 'protect', 'load', 'match-presets').click();
  await expect(page.locator('#match-mentality-choice [data-mentality="cautious"]')).toHaveAttribute('aria-pressed', 'true');
  expect(await saved(page)).toEqual(persistent);
  const actual = await page.evaluate(() => {
    const active = matchEngine.getActiveLineupIds(matchState.userSide, 8);
    return { active, keeper: matchEngine.getGK(matchState.userSide)?.id,
      unavailable: matchEngine.getUnavailablePlayers(matchState.userSide, 8),
      mirror: [...lineupSetup.assignmentsOOP], assignments: [...lineupSetup.assignments],
      identity: { secretCard: lineupSetup.secretCard, opponentId: lineupSetup.opponentId } };
  });
  expect(actual.active).not.toContain(red.playerId);
  expect(actual.active).toContain(actual.keeper);
  expect(new Set(actual.active).size).toBe(actual.active.length);
  expect(actual.active.length).toBeLessThanOrEqual(6);
  expect(actual.unavailable).toEqual(expect.arrayContaining([expect.objectContaining({ playerId: red.playerId, reason: 'red' })]));
  expect(actual.mirror).toEqual(actual.assignments);
  expect(actual.identity).toEqual(matchIdentity);
  await page.locator('#btn-close-tactics-modal').click();
  expect(await saved(page)).toEqual(persistent);
});

test('les ordres opt-in réordonnés avant le match pilotent les vrais actifs de l’Escalier et du Matchball', async ({ page }) => {
  await career(page);
  await tactics(page);
  await savePreset(page, 'usual');
  const persistent = await saved(page);
  await page.locator('[data-tab="calendar"]').click();
  await page.locator('#btn-prepare-match').click();
  for (const kind of ['escalier', 'matchball'] as const) {
    const phase = await openPhase(page, 'lineup-phase-preparation', kind);
    await expect(phase.locator(`[data-kings-prep-focus="${kind}-toggle"]`)).not.toBeChecked();
    await expect(phase.locator('.kings-prep-list')).toHaveCount(0);
  }
  await prepareOrders(page, 'lineup-phase-preparation');
  const orders = await page.evaluate(() => ({ escalier: [...lineupSetup.escalierOrder], matchball: [...lineupSetup.matchballOrder] }));
  expect(new Set(orders.escalier).size).toBe(6);
  expect(new Set(orders.matchball).size).toBe(6);
  expect(await saved(page)).toEqual(persistent);
  await page.locator('#btn-play-match').click();
  await expect(page.locator('#phase-lineup-modal')).not.toBeVisible();
  await page.locator('#btn-pause-match').click();
  const escalier = await page.evaluate(() => {
    const minute = matchState.minute;
    return { cap: matchEngine.getOutfieldCap(minute), active: matchEngine.getActiveLineupIds(matchState.userSide, minute),
      keeper: matchEngine.getGK(matchState.userSide).id,
      anchors: Object.keys(matchEngine.getFormationAnchors(matchState.userSide, minute)) };
  });
  expect(escalier.active).toEqual([escalier.keeper, ...orders.escalier.slice(0, escalier.cap)]);
  expect([...escalier.anchors].sort()).toEqual([...escalier.active].sort());
  // Exerce le vrai changement de format et le vrai getter du moteur, sans attendre
  // 36 minutes d'animation et sans lire uniquement le tableau de préparation.
  const matchball = await page.evaluate(() => [36, 37, 38, 39].map(minute => {
    const asked = maybeAskPhaseLineup(minute);
    return { minute, asked, cap: matchEngine.getOutfieldCap(minute),
      active: matchEngine.getActiveLineupIds(matchState.userSide, minute),
      anchors: Object.keys(matchEngine.getFormationAnchors(matchState.userSide, minute)) };
  }));
  for (const phase of matchball) {
    expect(phase.asked, `${phase.minute}'`).toBe(false);
    expect(phase.active, `${phase.minute}'`).toEqual([escalier.keeper, ...orders.matchball.slice(0, phase.cap)]);
    expect([...phase.anchors].sort()).toEqual([...phase.active].sort());
    expect(new Set(phase.active).size).toBe(phase.active.length);
  }
  await expect(page.locator('#phase-lineup-modal')).not.toBeVisible();
  expect(await saved(page)).toEqual(persistent);
});

test('blessure et transfert réparent chaque plan chargé sans partager les changements entre plans ou carrières', async ({ page }) => {
  await career(page);
  await tactics(page);
  await protectedPlan(page);
  await presetAction(page, 'usual', 'load').click();
  // Reproduit les effets persistants d'une blessure et d'un transfert dans la vraie carrière.
  const removed = await page.evaluate(() => {
    const team = getUserTeam();
    const soldId = tacticsSetup.assignments[1];
    const injuredId = tacticsSetup.assignments[3];
    const sold = team.players.find((player: any) => player.id === soldId);
    team.players = team.players.filter((player: any) => player.id !== soldId);
    STATE.league.teams.find((other: any) => other.id !== team.id).players.push(sold);
    const injured = team.players.find((player: any) => player.id === injuredId);
    injured.injured = true;
    injured.injuryDaysLeft = 10;
    injured.injurySeverity = 'Modérée';
    saveGame();
    return [soldId, injuredId];
  });
  await page.reload();
  await resume(page);
  for (const id of ['usual', 'protect']) {
    await presetAction(page, id, 'load').click();
    const ids = await expectValidSeven(page, 'tactics-pitch-field');
    for (const absent of removed) expect(ids).not.toContain(absent);
    const orders = await page.evaluate(() => [tacticsSetup.escalierOrder, tacticsSetup.matchballOrder]);
    for (const order of orders) if (Array.isArray(order) && order.length) {
      expect(new Set(order).size).toBe(order.length);
      for (const absent of removed) expect(order).not.toContain(absent);
      expect(order.every((playerId: string) => ids.includes(playerId))).toBe(true);
    }
  }
  const usual = (await saved(page)).tacticPresets.find((slot: any) => slot.id === 'usual');
  await page.locator('#tactics-mentality-choice').getByRole('button', { name: 'Offensive', exact: true }).click();
  expect((await saved(page)).tacticPresets.find((slot: any) => slot.id === 'usual')).toEqual(usual);
  const original = await saved(page);
  await page.locator('#btn-restart').click();
  await career(page, '360 Nation');
  await tactics(page);
  const otherName = presetAction(page, 'usual', 'rename');
  await otherName.fill('Autre carrière');
  await otherName.press('Enter');
  await savePreset(page, 'usual');
  await expect(presetAction(page, 'protect', 'load')).toBeDisabled();
  await page.locator('#btn-restart').click();
  await page.reload();
  await resume(page);
  expect(await saved(page)).toEqual(original);
  await expect(presetAction(page, 'usual', 'rename')).toHaveValue('Habituel');
});
