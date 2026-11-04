import { test as base, expect, type Page } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const { createHandler } = require('../api/career-sync.js');
declare const STATE: any;
declare const cloudLinks: Record<string, any>;
declare const cloudBusy: boolean;
declare function flushCloudQueue(): Promise<void>;
declare function cloudTask(action: () => Promise<void>): Promise<void>;
const SAVES = 'kingsManager7v7_saves';
const LINKS = 'kingsManager7v7_cloud_v1';

async function fixture() {
  // HTTP, chiffrement navigateur et handler de production réels. Seule la
  // primitive Blob est injectée pour reproduire les conflits sans secrets CI.
  const entries = new Map<string, { body: string; etag: string }>();
  const writes: { status: number; body: string; authorization: string }[] = [];
  let revision = 0;
  class BlobPreconditionFailedError extends Error {}
  const handler = createHandler({ rateLimit: false, environment: 'preview', store: {
    async get(name: string, options: any) {
      expect(options).toEqual({ access: 'private', useCache: false, headers: { 'Accept-Encoding': 'identity' } });
      const entry = entries.get(name);
      return entry ? { statusCode: 200, blob: { etag: entry.etag, size: Buffer.byteLength(entry.body) }, stream: new Response(entry.body).body } : null;
    },
    async put(name: string, body: string, options: any) {
      const previous = entries.get(name);
      if (!options.allowOverwrite && previous) throw new Error('This blob already exists');
      if (options.ifMatch && previous?.etag !== options.ifMatch) throw new BlobPreconditionFailedError();
      const etag = `"fixture-${++revision}"`; entries.set(name, { body, etag });
      return { etag };
    },
    async del(name: string, options: any) {
      if (entries.get(name)?.etag !== options.ifMatch) throw new BlobPreconditionFailedError();
      entries.delete(name);
    }
  } });
  const directory = path.resolve(__dirname, '..');
  const types: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
  const server = createServer(async (request, response) => {
    try {
      const pathname = new URL(request.url || '/', 'http://fixture.invalid').pathname;
      if (pathname === '/api/career-sync') {
        // Reproduit un intermédiaire qui réécrit l'ETag de transport, tandis que
        // la révision explicite doit rester utilisable pour les écritures CAS.
        const setHeader = response.setHeader.bind(response);
        response.setHeader = ((name: string, value: any) => setHeader(name, name.toLowerCase() === 'etag' ? 'W/' + value : value)) as typeof response.setHeader;
        let body = '';
        request.on('data', chunk => { body += String(chunk); });
        response.once('finish', () => { if (request.method === 'PUT') writes.push({ status: response.statusCode, body, authorization: String(request.headers.authorization || '') }); });
        await handler(request, response); return;
      }
      const filename = path.resolve(directory, '.' + decodeURIComponent(pathname === '/' ? '/index.html' : pathname));
      if (!filename.startsWith(directory + path.sep) || pathname.split('/').some(segment => segment.startsWith('.') || segment === 'node_modules')) {
        response.writeHead(404).end(); return;
      }
      const content = await readFile(filename);
      response.writeHead(200, { 'Content-Type': types[path.extname(filename)] || 'application/octet-stream', 'Content-Length': content.length, 'Cache-Control': 'no-store' });
      response.end(content);
    } catch { if (!response.headersSent) response.writeHead(404).end(); else response.end(); }
  });
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Cloud fixture could not listen');
  return {
    url: `http://127.0.0.1:${address.port}`, entries, writes,
    async close() { await new Promise<void>(resolve => { server.close(() => resolve()); server.closeAllConnections(); }); }
  };
}

const test = base.extend<{ cloud: Awaited<ReturnType<typeof fixture>> }>({
  cloud: async ({}, use) => { const cloud = await fixture(); try { await use(cloud); } finally { await cloud.close(); } }
});
test.use({ serviceWorkers: 'block' });
const errors = new WeakMap<Page, string[]>();
async function prepare(page: Page) {
  const messages: string[] = []; errors.set(page, messages);
  page.on('pageerror', error => messages.push(error.message));
  await page.route('https://kingsleague-cdn.kama.football/**', route => route.abort());
  await page.setViewportSize({ width: 1360, height: 1000 });
}
test.beforeEach(async ({ page }) => { await prepare(page); });
test.afterEach(async ({ page }) => { expect(errors.get(page)).toEqual([]); });
async function career(page: Page, url: string) {
  await page.goto(url);
  await page.locator('#league-sidebar').getByRole('button', { name: /France/ }).click();
  await page.locator('#team-choice').getByRole('heading', { name: 'FC Silmi', exact: true }).click();
  await page.locator('#btn-start').click();
  await page.locator('#btn-view-notifications').click();
  await page.getByRole('button', { name: 'Compris', exact: true }).click();
  await page.locator('#btn-restart').click();
}
async function panel(page: Page) {
  await expect(page.locator('#cloud-sync-panel')).toBeVisible();
  if (!(await page.locator('#cloud-sync-panel').evaluate((element: HTMLDetailsElement) => element.open))) await page.locator('#cloud-sync-panel > summary').click();
}
async function activate(page: Page) {
  await panel(page);
  const slot = await page.locator('#cloud-career option').evaluateAll(options => (options.find(option => (option as HTMLOptionElement).value) as HTMLOptionElement).value);
  await page.locator('#cloud-career').selectOption(slot);
  await page.locator('#cloud-create').click();
  await expect(page.locator('#cloud-status')).toContainText('Synchronisation activée');
  const code = await page.locator('#cloud-code-output').inputValue();
  expect(code).toMatch(/^KM1\.[A-Za-z0-9_-]{43}$/);
  return { slot, code };
}
async function join(page: Page, url: string, code: string) {
  await page.goto(url); await panel(page);
  await page.locator('#cloud-join-code').fill(code);
  await page.locator('#cloud-join').click();
  await expect(page.locator('#cloud-join-code')).toHaveValue('');
  await expect(page.locator('#saves-list [data-action="continue"]')).toHaveCount(1);
  await expect(page.locator('#cloud-inspect')).toBeEnabled();
  return page.locator('#cloud-career').inputValue();
}
async function saved(page: Page) { return page.evaluate(key => JSON.parse(localStorage.getItem(key) || '{}'), SAVES); }
async function mentality(page: Page, label: 'Prudente' | 'Offensive') {
  // Le test choisit son instant d'envoi ; fermer le panneau évite le flush
  // facultatif du retour à l'accueil avant l'envoi concurrent explicite.
  if (await page.locator('#cloud-sync-panel').evaluate((element: HTMLDetailsElement) => element.open)) await page.locator('#cloud-sync-panel > summary').click();
  await page.locator('#saves-list [data-action="continue"]').first().click();
  await page.locator('[data-tab="tactics"]').click();
  await page.locator('#tactics-mentality-choice').getByRole('button', { name: label, exact: true }).click();
  await page.locator('#btn-restart').click();
  await panel(page);
}
async function send(page: Page) {
  await page.locator('#cloud-send').click();
  await expect(page.locator('#cloud-status')).toContainText(/Progression envoyée|Cette progression est déjà synchronisée/);
}

test('deux appareils partagent une copie chiffrée sans exposer le code dans les exports', async ({ page, browser, cloud }) => {
  await career(page, cloud.url); const connected = await activate(page);
  const original = await saved(page);
  const secondContext = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 844 } });
  try {
    const mobile = await secondContext.newPage(); await prepare(mobile); await mobile.setViewportSize({ width: 320, height: 740 });
    const secondSlot = await join(mobile, cloud.url, connected.code);
    expect((await saved(mobile))[secondSlot].data).toEqual(original[connected.slot].data);
    expect(await page.locator('#cloud-code-output').inputValue()).toBe(connected.code);
    expect(await mobile.locator('#cloud-join-code').inputValue()).toBe('');
    expect(await mobile.locator('#cloud-code-output').inputValue()).toBe('');
    expect(cloud.entries.size).toBe(1);
    const wire = JSON.parse(cloud.entries.values().next().value!.body);
    expect(Object.keys(wire).sort()).toEqual(['ciphertext', 'iv', 'v']);
    expect(JSON.stringify(wire)).not.toContain('FC Silmi');
    expect(JSON.stringify(wire)).not.toContain(connected.code);
    expect(cloud.writes[0].authorization).not.toContain(connected.code.slice(4));
    await page.evaluate(() => {
      const original = URL.createObjectURL.bind(URL);
      (window as any).__cloudExport = null;
      URL.createObjectURL = blob => { if (blob instanceof Blob) (window as any).__cloudExport = blob.text(); return original(blob); };
    });
    const downloading = page.waitForEvent('download');
    await page.locator('#saves-list [data-action="export"]').first().click();
    expect(await (await downloading).failure()).toBeNull();
    const exported = await page.evaluate(async () => await (window as any).__cloudExport);
    expect(exported).not.toContain(connected.code); expect(exported).not.toContain('KM1.');
    expect(JSON.parse(exported).data).toEqual(original[connected.slot].data);
    expect(await mobile.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    await mobile.locator('#cloud-disconnect').click(); await mobile.locator('#btn-confirm-cancel').click();
    expect(await mobile.evaluate(key => Object.keys(JSON.parse(localStorage.getItem(key) || '{}')).length, LINKS)).toBe(1);
    await mobile.locator('#cloud-disconnect').click(); await mobile.locator('#btn-confirm-ok').click();
    await expect(mobile.locator('#cloud-status')).toContainText('Appareil déconnecté');
    expect(Object.keys(await saved(mobile))).toHaveLength(1); expect(cloud.entries.size).toBe(1);
    expect(errors.get(mobile)).toEqual([]);
  } finally { await secondContext.close(); }
});

test('deux envois concurrents donnent un conflit puis une importation conserve les deux progressions', async ({ page, browser, cloud }) => {
  await career(page, cloud.url); const connected = await activate(page);
  const secondContext = await browser.newContext({ serviceWorkers: 'block' });
  try {
    const second = await secondContext.newPage(); await prepare(second); await join(second, cloud.url, connected.code);
    await Promise.all([page.context().setOffline(true), secondContext.setOffline(true)]);
    await mentality(page, 'Prudente'); await mentality(second, 'Offensive');
    const localA = await saved(page), localB = await saved(second);
    // Reconnexion des deux appareils : leurs files portent encore le même ETag.
    await Promise.all([page.context().setOffline(false), secondContext.setOffline(false)]);
    await expect.poll(() => cloud.writes.filter(write => write.status === 409).length).toBe(1);
    expect(cloud.writes.filter(write => write.status === 200)).toHaveLength(1);
    await expect.poll(async () => Number(await page.evaluate(() => Object.values(cloudLinks).some(link => link.conflict)))
      + Number(await second.evaluate(() => Object.values(cloudLinks).some(link => link.conflict)))).toBe(1);
    const aConflicted = await page.evaluate(() => Object.values(cloudLinks).some(link => link.conflict));
    const conflicted = aConflicted ? page : second;
    const before = aConflicted ? localA : localB;
    const winner = aConflicted ? localB : localA;
    await expect(conflicted.locator('#cloud-send')).toBeDisabled();
    await conflicted.locator('#cloud-inspect').click();
    await expect(conflicted.locator('#cloud-resolution')).toBeVisible();
    await conflicted.locator('#cloud-import-remote').click();
    await expect(conflicted.locator('#cloud-status')).toContainText('Les deux carrières sont conservées');
    const after = await saved(conflicted), previousSlot = Object.keys(before)[0];
    expect(Object.keys(after)).toHaveLength(2);
    expect(after[previousSlot]).toEqual(before[previousSlot]);
    const importedSlot = Object.keys(after).find(slot => slot !== previousSlot)!;
    expect(after[importedSlot].data).toEqual(Object.values(winner)[0] && (Object.values(winner)[0] as any).data);
    const links = await conflicted.evaluate(key => JSON.parse(localStorage.getItem(key) || '{}'), LINKS);
    expect(Object.keys(links)).toEqual([importedSlot]);
    expect(cloud.writes).toHaveLength(3);
    expect(errors.get(second)).toEqual([]);
  } finally { await secondContext.close(); }
});

test('hors ligne la progression reste locale, et une écriture non vérifiée n’est jamais envoyée', async ({ page, context, cloud }) => {
  await career(page, cloud.url); const connected = await activate(page);
  const initial = cloud.entries.values().next().value!.body;
  await context.setOffline(true);
  await mentality(page, 'Prudente');
  await expect(page.locator('#cloud-status')).toContainText('envoi cloud en attente');
  const offline = await saved(page);
  expect(offline[connected.slot].data.savedTactic.mentality).toBe('cautious');
  await page.evaluate(() => flushCloudQueue());
  expect(cloud.entries.values().next().value!.body).toBe(initial);
  await context.setOffline(false);
  await expect.poll(() => cloud.writes.filter(write => write.status === 200).length).toBe(1);
  await expect(page.locator('#cloud-status')).toContainText('Progression envoyée');
  await page.locator('#saves-list [data-action="continue"]').first().click();
  await page.locator('[data-tab="tactics"]').click();
  await page.evaluate(key => {
    const original = Storage.prototype.setItem;
    (window as any).__unblockCloudWrite = () => { Storage.prototype.setItem = original; };
    Storage.prototype.setItem = function (itemKey: string, value: string) {
      if (this === localStorage && itemKey === key) throw new DOMException('Fixture quota', 'QuotaExceededError');
      return original.call(this, itemKey, value);
    };
  }, SAVES);
  await page.locator('#tactics-mentality-choice').getByRole('button', { name: 'Offensive', exact: true }).click();
  await expect(page.locator('#career-save-status')).toHaveAttribute('role', 'alert');
  await expect(page.locator('#career-save-status')).toContainText('Stockage local plein');
  expect((await saved(page))[connected.slot].data).toEqual(offline[connected.slot].data);
  await page.evaluate(() => flushCloudQueue());
  expect(cloud.writes).toHaveLength(2);
  expect(await page.evaluate(() => STATE.savedTactic.mentality)).toBe('attacking');
  await page.evaluate(() => (window as any).__unblockCloudWrite());
  await page.locator('#career-save-status').getByRole('button', { name: /Réessayer/ }).click();
  await page.evaluate(() => flushCloudQueue());
  await expect.poll(() => cloud.writes.filter(write => write.status === 200).length).toBe(2);
});

test('une comparaison devenue obsolète ne permet ni remplacement ni suppression de la nouvelle copie', async ({ page, browser, cloud }) => {
  await career(page, cloud.url); const connected = await activate(page);
  const secondContext = await browser.newContext({ serviceWorkers: 'block' });
  try {
    const second = await secondContext.newPage(); await prepare(second); await join(second, cloud.url, connected.code);
    await mentality(second, 'Prudente'); await send(second);
    await page.locator('#cloud-inspect').click();
    await expect(page.locator('#cloud-resolution')).toBeVisible();
    await mentality(second, 'Offensive'); await send(second);
    const latest = cloud.entries.values().next().value!.body, original = await saved(page);
    await page.locator('#cloud-replace-remote').click();
    await page.locator('#btn-confirm-cancel').click();
    expect(cloud.entries.values().next().value!.body).toBe(latest);
    await page.locator('#cloud-replace-remote').click(); await page.locator('#btn-confirm-ok').click();
    await expect(page.locator('#cloud-status')).toContainText('Une autre progression');
    expect(cloud.entries.values().next().value!.body).toBe(latest);
    expect(await saved(page)).toEqual(original);
    await page.locator('#cloud-inspect').click();
    await expect(page.locator('#cloud-status')).toContainText('Compare cette copie');
    await page.locator('#cloud-replace-remote').click(); await page.locator('#btn-confirm-ok').click();
    await expect(page.locator('#cloud-status')).toContainText('Copie distante remplacée');
    const replaced = cloud.entries.values().next().value!.body;
    expect(replaced).not.toBe(latest);
    await second.locator('#cloud-delete').click(); await second.locator('#btn-confirm-ok').click();
    await expect(second.locator('#cloud-status')).toContainText('Une autre progression');
    expect(cloud.entries.values().next().value!.body).toBe(replaced);
    expect(errors.get(second)).toEqual([]);
  } finally { await secondContext.close(); }
});

test('un onglet ouvert avant l’appairage ne peut pas écraser le registre cloud d’un autre onglet', async ({ page, context, cloud }) => {
  await career(page, cloud.url);
  const before = await saved(page), slot = Object.keys(before)[0];
  const stale = await context.newPage();
  try {
    await prepare(stale); await stale.goto(cloud.url); await panel(stale);
    await stale.locator('#cloud-career').selectOption(slot);
    await expect(stale.locator('#cloud-create')).toBeEnabled();
    const connected = await activate(page);
    expect(connected.slot).toBe(slot);
    const registry = await page.evaluate(key => localStorage.getItem(key), LINKS);
    await expect(stale.locator('#cloud-status')).toContainText(/[Rr]echarg/);
    await expect(stale.locator('#cloud-create')).toBeDisabled();
    await expect(stale.locator('#cloud-join')).toBeDisabled();
    await stale.evaluate(async () => {
      (window as any).__cloudMutationRan = false;
      await cloudTask(async () => { (window as any).__cloudMutationRan = true; });
      await flushCloudQueue();
    });
    expect(await stale.evaluate(() => (window as any).__cloudMutationRan)).toBe(false);
    expect(await stale.evaluate(key => localStorage.getItem(key), LINKS)).toBe(registry);
    expect(await page.evaluate(key => localStorage.getItem(key), LINKS)).toBe(registry);
    expect(await saved(stale)).toEqual(before);
    expect(cloud.entries.size).toBe(1); expect(cloud.writes).toHaveLength(1);
    await stale.reload(); await panel(stale);
    await stale.locator('#cloud-career').selectOption(slot);
    await expect(stale.locator('#cloud-inspect')).toBeEnabled();
    await stale.locator('#cloud-reveal').click();
    await expect(stale.locator('#cloud-code-output')).toHaveValue(connected.code);
    expect(errors.get(stale)).toEqual([]);
  } finally { await stale.close(); }
});

test('une déconnexion non enregistrée garde le lien et ne prétend pas avoir réussi', async ({ page, cloud }) => {
  await career(page, cloud.url); const connected = await activate(page);
  const before = await saved(page);
  const registry = await page.evaluate(key => localStorage.getItem(key), LINKS);
  await page.evaluate(key => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (itemKey: string, value: string) {
      if (this === localStorage && itemKey === key) throw new DOMException('Fixture quota cloud', 'QuotaExceededError');
      return original.call(this, itemKey, value);
    };
  }, LINKS);
  await page.locator('#cloud-disconnect').click();
  await page.locator('#btn-confirm-ok').click();
  await expect(page.locator('#cloud-status')).toContainText('Le lien cloud n’a pas pu être enregistré');
  await expect(page.locator('#cloud-status')).not.toContainText('Appareil déconnecté');
  expect(await page.evaluate(key => localStorage.getItem(key), LINKS)).toBe(registry);
  expect(await page.evaluate(slot => !!cloudLinks[slot], connected.slot)).toBe(true);
  expect(await saved(page)).toEqual(before);
  expect(cloud.entries.size).toBe(1); expect(cloud.writes).toHaveLength(1);
  // Le rechargement retire la panne injectée, conserve le vrai registre et
  // permet de retrouver le même code, sans créer de nouvelle copie distante.
  await page.reload(); await panel(page);
  await page.locator('#cloud-career').selectOption(connected.slot);
  await expect(page.locator('#cloud-inspect')).toBeEnabled();
  await page.locator('#cloud-reveal').click();
  await expect(page.locator('#cloud-code-output')).toHaveValue(connected.code);
  expect(await page.evaluate(key => localStorage.getItem(key), LINKS)).toBe(registry);
  expect(cloud.writes).toHaveLength(1);
});

test('sans lien cloud un flush vide ne prend aucun verrou et laisse démarrer une carrière', async ({ page, cloud }) => {
  await page.addInitScript(() => {
    const locks = navigator.locks as any;
    const original = locks.request;
    (window as any).__emptyCloudLockCalls = 0;
    locks.request = function (name: string, ...args: any[]) {
      if (name === 'kings-manager-cloud-registry-v1') {
        (window as any).__emptyCloudLockCalls++;
        // Un verrou cloud contentieux ne doit jamais concerner une personne
        // qui joue uniquement en local. L'ancienne version resterait occupée.
        return new Promise(() => {});
      }
      return original.apply(this, [name, ...args]);
    };
  });
  await page.goto(cloud.url);
  const before = await page.evaluate(async () => {
    void flushCloudQueue();
    await Promise.resolve();
    return { calls: (window as any).__emptyCloudLockCalls, busy: cloudBusy, links: Object.keys(cloudLinks).length };
  });
  expect(before).toEqual({ calls: 0, busy: false, links: 0 });
  await page.locator('#league-sidebar').getByRole('button', { name: /France/ }).click();
  await page.locator('#team-choice').getByRole('heading', { name: 'FC Silmi', exact: true }).click();
  await expect(page.locator('#btn-start')).toBeEnabled();
  await page.locator('#btn-start').click();
  await expect(page.locator('#screen-main')).toBeVisible();
  expect(await page.evaluate(() => ({ calls: (window as any).__emptyCloudLockCalls, busy: cloudBusy }))).toEqual({ calls: 0, busy: false });
  expect(cloud.entries.size).toBe(0); expect(cloud.writes).toHaveLength(0);
});
