import { test, expect, type Page, type Locator } from '@playwright/test';

declare const STATE: any;
declare const CareerStorage: any;
declare function saveGame(): boolean;

const KEY = 'kingsManager7v7_saves';
const BACKUP = KEY + '_recovery';
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

async function chooseCareer(page: Page, team = 'FC Silmi') {
  await page.locator('#league-sidebar').getByRole('button', { name: /France/ }).click();
  await page.locator('#team-choice').getByRole('heading', { name: team, exact: true }).click();
  await page.locator('#btn-start').click();
  await expect(page.locator('#screen-main')).toBeVisible();
  await page.locator('#btn-view-notifications').click();
  await page.getByRole('button', { name: 'Compris', exact: true }).click();
  await expect(page.locator('#topbar-team')).toContainText(team);
}

async function mentality(page: Page, label: 'Prudente' | 'Offensive') {
  await page.locator('[data-tab="tactics"]').click();
  const button = page.locator('#tactics-mentality-choice').getByRole('button', { name: label, exact: true });
  await button.click();
  await expect(button).toHaveAttribute('aria-pressed', 'true');
}

function careerRow(page: Page, team: string) {
  return page.locator('#saves-list .transfer-row').filter({ hasText: team });
}

async function stored(page: Page) {
  return page.evaluate(key => {
    const inspection = CareerStorage.create().inspect();
    return {
      raw: localStorage.getItem(key),
      map: inspection.map,
      backup: { slots: inspection.backups, pending: inspection.pending },
      slot: STATE.currentSlotId,
    };
  }, KEY);
}

async function blockWrites(page: Page, key: string, name: 'QuotaExceededError' | 'SecurityError') {
  await page.evaluate(({ key, name }) => {
    const target = window as any;
    const original = Storage.prototype.setItem;
    target.__storageUnblock = () => { Storage.prototype.setItem = original; };
    Storage.prototype.setItem = function (itemKey: string, value: string) {
      if (this === localStorage && itemKey === key) throw new DOMException('Fixture de stockage indisponible', name);
      return original.call(this, itemKey, value);
    };
  }, { key, name });
}

async function unblockWrites(page: Page) {
  await page.evaluate(() => (window as any).__storageUnblock());
}

async function exportMemory(page: Page, button: Locator) {
  // Conserve un vrai Blob URL et un vrai téléchargement. La lecture du Blob en
  // page évite le verrou du fichier temporaire de téléchargement sous Windows.
  await page.evaluate(() => {
    const original = URL.createObjectURL.bind(URL);
    (window as any).__storageExportPayload = null;
    URL.createObjectURL = function (blob: Blob | MediaSource) {
      if (blob instanceof Blob) (window as any).__storageExportPayload = blob.text();
      return original(blob);
    };
  });
  const downloadPromise = page.waitForEvent('download');
  await button.click();
  const download = await downloadPromise;
  expect(await download.failure()).toBeNull();
  expect(download.suggestedFilename()).toBe('KingsManager_progression_en_memoire.json');
  const contents = await page.evaluate(async () => await (window as any).__storageExportPayload);
  expect(typeof contents).toBe('string');
  return JSON.parse(contents);
}

test('la restauration exige confirmation, conserve le retour et isole deux carrières jusqu’à la suppression', async ({ page }) => {
  await page.goto('/');
  await chooseCareer(page);
  await mentality(page, 'Prudente');
  await mentality(page, 'Offensive');
  const first = await stored(page);
  const slotA = first.slot;
  expect(first.map[slotA].data.savedTactic.mentality).toBe('attacking');
  expect(first.backup.slots[slotA].data.savedTactic.mentality).toBe('cautious');
  await expect(page.locator('#career-save-status')).toHaveAttribute('role', 'status');

  await page.locator('#btn-restart').click();
  await chooseCareer(page, '360 Nation');
  await mentality(page, 'Prudente');
  await mentality(page, 'Offensive');
  const second = await stored(page);
  const slotB = second.slot;
  expect(slotB).not.toBe(slotA);
  const entryB = second.map[slotB];
  const backupB = second.backup.slots[slotB];
  await page.locator('#btn-restart').click();
  await expect(page.locator('#saves-list .transfer-row')).toHaveCount(2);

  await careerRow(page, 'FC Silmi').locator('.save-restore-button').click();
  await expect(page.locator('#confirm-modal')).toBeVisible();
  await expect(page.locator('#confirm-body')).toContainText('point de retour');
  expect((await stored(page)).map[slotA].data.savedTactic.mentality).toBe('attacking');
  await page.locator('#btn-confirm-cancel').click();
  expect((await stored(page)).map[slotA].data.savedTactic.mentality).toBe('attacking');
  await careerRow(page, 'FC Silmi').locator('.save-restore-button').click();
  await page.locator('#btn-confirm-ok').click();
  await expect(page.locator('#screen-main')).toBeVisible();
  await expect(page.locator('#career-save-status')).toContainText('rétabli et vérifié');
  await page.locator('[data-tab="tactics"]').click();
  await expect(page.locator('#tactics-mentality-choice').getByRole('button', { name: 'Prudente', exact: true })).toHaveAttribute('aria-pressed', 'true');
  const restored = await stored(page);
  expect(restored.map[slotA].data.savedTactic.mentality).toBe('cautious');
  expect(restored.backup.slots[slotA].data.savedTactic.mentality).toBe('attacking');
  expect(restored.map[slotB]).toEqual(entryB);
  expect(restored.backup.slots[slotB]).toEqual(backupB);

  await page.locator('#btn-restart').click();
  await careerRow(page, 'FC Silmi').locator('.save-restore-button').click();
  await page.locator('#btn-confirm-ok').click();
  await page.locator('[data-tab="tactics"]').click();
  await expect(page.locator('#tactics-mentality-choice').getByRole('button', { name: 'Offensive', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#btn-restart').click();
  await careerRow(page, 'FC Silmi').getByRole('button', { name: 'Supprimer', exact: true }).click();
  await expect(page.locator('#confirm-modal')).toBeVisible();
  expect(Object.hasOwn((await stored(page)).map, slotA)).toBe(true);
  await page.locator('#btn-confirm-ok').click();
  await expect(page.locator('#saves-list .transfer-row')).toHaveCount(1);
  const deleted = await stored(page);
  expect(Object.hasOwn(deleted.map, slotA)).toBe(false);
  expect(Object.hasOwn(deleted.backup.slots, slotA)).toBe(false);
  expect(deleted.map[slotB]).toEqual(entryB);
  expect(deleted.backup.slots[slotB]).toEqual(backupB);
  await expect(careerRow(page, '360 Nation').locator('.save-restore-button')).toBeVisible();
});

test('quota du primaire et stockage du journal bloqué préservent le disque, exportent la mémoire et permettent un vrai nouvel essai', async ({ page }) => {
  await page.goto('/');
  await chooseCareer(page);
  await mentality(page, 'Prudente');
  const cases = [
    { key: KEY, name: 'QuotaExceededError' as const, label: 'Offensive' as const, value: 'attacking', message: /Stockage local plein/ },
    { key: BACKUP, name: 'SecurityError' as const, label: 'Prudente' as const, value: 'cautious', message: /bloque le stockage local/ },
  ];
  for (const fixture of cases) {
    const before = await stored(page);
    await blockWrites(page, fixture.key, fixture.name);
    await mentality(page, fixture.label);
    expect(await page.evaluate(() => saveGame())).toBe(false);
    const status = page.locator('#career-save-status');
    await expect(status).toBeVisible();
    await expect(status).toHaveAttribute('role', 'alert');
    await expect(status).toContainText(fixture.message);
    await expect(status).not.toContainText('Progression sauvegardée');
    const failed = await stored(page);
    expect(failed.raw).toBe(before.raw);
    expect(failed.map[before.slot].data.savedTactic.mentality).not.toBe(fixture.value);
    const exported = await exportMemory(page, status.getByRole('button', { name: 'Exporter ma progression', exact: true }));
    expect(exported.data.savedTactic.mentality).toBe(fixture.value);
    expect(exported.data.userTeamId).toBe(before.map[before.slot].data.userTeamId);
    expect(await page.evaluate(() => localStorage.getItem('kingsManager7v7_saves'))).toBe(before.raw);

    await unblockWrites(page);
    await status.getByRole('button', { name: 'Réessayer', exact: true }).click();
    await expect(status).toHaveAttribute('role', 'status');
    await expect(status).toContainText('Progression sauvegardée');
    const retried = await stored(page);
    expect(retried.map[before.slot].data.savedTactic.mentality).toBe(fixture.value);
    expect(retried.backup.slots[before.slot]).toEqual(before.map[before.slot]);
  }
});

test('un primaire JSON corrompu reste intact après création et tentative de sauvegarde avec une alerte visible', async ({ page }) => {
  const corrupted = '{"ancienne_carriere":{"data":[ne_pas_ecraser';
  await page.addInitScript(({ key, raw }) => localStorage.setItem(key, raw), { key: KEY, raw: corrupted });
  await page.goto('/');
  const status = page.locator('#career-save-status');
  await expect(status).toBeVisible();
  await expect(status).toHaveAttribute('role', 'alert');
  await expect(status).toContainText('illisibles');
  await chooseCareer(page);
  await mentality(page, 'Prudente');
  expect(await page.evaluate(() => saveGame())).toBe(false);
  await expect(status).toBeVisible();
  await expect(status).toHaveAttribute('role', 'alert');
  await expect(status).not.toContainText('Progression sauvegardée');
  expect(await page.evaluate(() => localStorage.getItem('kingsManager7v7_saves'))).toBe(corrupted);
  expect(await page.evaluate(() => localStorage.getItem('kingsManager7v7_saves_recovery'))).toBeNull();
  expect(await page.evaluate(() => !!STATE.league && !!STATE.currentSlotId)).toBe(true);
  await page.locator('#btn-restart').click();
  await expect(status).toHaveAttribute('role', 'alert');
  await expect(page.locator('#saves-list .transfer-row')).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('kingsManager7v7_saves'))).toBe(corrupted);
});

test('un vrai import FileReader refuse le quota sans nouveau slot ni faux succès puis accepte le même fichier', async ({ page }) => {
  await page.goto('/');
  await chooseCareer(page);
  await mentality(page, 'Prudente');
  const before = await stored(page);
  const imported = structuredClone(before.map[before.slot]);
  imported.meta.teamName = 'Carrière importée test stockage';
  await page.locator('#btn-restart').click();
  await page.locator('details.import-panel > summary').click();
  const count = await page.locator('#saves-list .transfer-row').count();
  await blockWrites(page, KEY, 'QuotaExceededError');
  const file = { name: 'carriere-valide.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(imported)) };
  await page.locator('#import-save-input').setInputFiles(file);
  const feedback = page.locator('#import-save-feedback');
  await expect(feedback).toContainText('Importation non enregistrée');
  await expect(feedback).toContainText('Stockage local plein');
  await expect(feedback).not.toContainText('succès');
  await expect(feedback).not.toContainText('Fichier de sauvegarde invalide');
  await expect(page.locator('#career-save-status')).toHaveAttribute('role', 'alert');
  await expect(page.locator('#saves-list .transfer-row')).toHaveCount(count);
  const rejected = await stored(page);
  expect(rejected.raw).toBe(before.raw);
  expect(Object.keys(rejected.map)).toEqual(Object.keys(before.map));

  await unblockWrites(page);
  await page.locator('#import-save-input').setInputFiles(file);
  await expect(feedback).toContainText('Carrière importée avec succès');
  await expect(page.locator('#saves-list .transfer-row')).toHaveCount(count + 1);
  await expect(careerRow(page, imported.meta.teamName)).toBeVisible();
  const accepted = await stored(page);
  expect(accepted.map[before.slot]).toEqual(before.map[before.slot]);
});

test('une progression non enregistrée reste dans le jeu après Annuler et peut être exportée puis sauvegardée avant de quitter', async ({ page }) => {
  await page.goto('/');
  await chooseCareer(page);
  await mentality(page, 'Prudente');
  const before = await stored(page);
  const presetsPanel = page.locator('details.career-presets-panel:has(#tactics-presets)');
  if (await presetsPanel.getAttribute('open') === null) await presetsPanel.locator(':scope > summary').click();
  const active = page.locator('#tactics-presets .preset-card-active');
  await expect(active.locator('.preset-status')).toHaveText('Active');

  await blockWrites(page, KEY, 'QuotaExceededError');
  // Le clic utilisateur déclenche l’autosauvegarde et son échec, sans appel de
  // saveGame de test qui pourrait masquer un défaut du branchement de l’interface.
  await mentality(page, 'Offensive');
  const status = page.locator('#career-save-status');
  await expect(status).toBeVisible();
  await expect(status).toHaveAttribute('role', 'alert');
  await expect(status).toContainText('Stockage local plein');
  await expect(status).not.toContainText('Progression sauvegardée');
  await expect(active.locator('.preset-status')).toHaveText('Active · non enregistrée');
  expect((await stored(page)).raw).toBe(before.raw);

  await active.locator('[data-preset-action="save"]').click();
  const localStatus = page.locator('#tactics-preset-status');
  await expect(localStatus).toContainText('en mémoire, mais non enregistrée');
  await expect(localStatus).not.toContainText('Configuration enregistrée dans');
  await expect(localStatus).not.toContainText('Tactique active enregistrée');
  await expect(active.locator('.preset-status')).toHaveText('Active · non enregistrée');
  expect(await page.evaluate(() => {
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    return event.defaultPrevented;
  })).toBe(true);

  await page.getByRole('button', { name: 'Mes carrières', exact: true }).click();
  await expect(page.locator('#confirm-modal')).toBeVisible();
  await expect(page.locator('#confirm-title')).toHaveText('Progression non enregistrée');
  await expect(page.locator('#btn-confirm-ok')).toHaveText('Quitter sans enregistrer');
  await page.locator('#btn-confirm-cancel').click();
  await expect(page.locator('#confirm-modal')).not.toBeVisible();
  await expect(page.locator('#screen-main')).toBeVisible();
  await expect(page.locator('#screen-home')).not.toBeVisible();
  await expect(page.locator('#tactics-mentality-choice').getByRole('button', { name: 'Offensive', exact: true })).toHaveAttribute('aria-pressed', 'true');
  const exported = await exportMemory(page, status.getByRole('button', { name: 'Exporter ma progression', exact: true }));
  expect(exported.data.savedTactic.mentality).toBe('attacking');
  expect(exported.data.userTeamId).toBe(before.map[before.slot].data.userTeamId);
  expect((await stored(page)).raw).toBe(before.raw);

  await unblockWrites(page);
  await status.getByRole('button', { name: 'Réessayer', exact: true }).click();
  await expect(status).toHaveAttribute('role', 'status');
  await expect(status).toContainText('Progression sauvegardée');
  await expect(active.locator('.preset-status')).toHaveText('Active');
  await expect(localStatus).not.toContainText('non enregistrée');
  const saved = await stored(page);
  expect(saved.map[before.slot].data.savedTactic.mentality).toBe('attacking');
  expect(saved.backup.slots[before.slot]).toEqual(before.map[before.slot]);
  expect(await page.evaluate(() => {
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    return event.defaultPrevented;
  })).toBe(false);

  await page.getByRole('button', { name: 'Mes carrières', exact: true }).click();
  await expect(page.locator('#screen-home')).toBeVisible();
  await expect(page.locator('#confirm-modal')).not.toBeVisible();
  await expect(careerRow(page, 'FC Silmi')).toBeVisible();
});
