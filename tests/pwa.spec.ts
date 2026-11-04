import { test, expect, type Page } from '@playwright/test';
import { createPwaFixture } from './helpers/pwa-fixture';

declare const STATE: any;
declare const matchState: any;
declare function saveGame(): boolean;

const SAVE_KEY = 'kingsManager7v7_saves';
const pageErrors = new WeakMap<Page, string[]>();

test.beforeEach(async ({ page, context }) => {
  await page.addInitScript(() => {
    let seed = 20261104;
    Math.random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  });
  await context.route('https://kingsleague-cdn.kama.football/**', route => route.abort());
  await page.setViewportSize({ width: 1440, height: 1000 });
  const errors: string[] = [];
  pageErrors.set(page, errors);
  page.on('pageerror', error => errors.push(error.message));
});

test.afterEach(async ({ page }) => {
  expect(pageErrors.get(page)).toEqual([]);
});

async function requireServiceWorkers(page: Page) {
  const supported = await page.evaluate(() => !!navigator.serviceWorker && !!window.caches && !!window.crypto?.subtle);
  test.skip(!supported, 'Ce moteur de test ne fournit pas les API Service Worker / Cache Storage en contexte sécurisé.');
}

async function workerStatus(page: Page, target: 'active' | 'waiting' = 'active'): Promise<any> {
  return page.evaluate(async target => {
    const registration = await navigator.serviceWorker.getRegistration('/');
    const worker = registration?.[target];
    if (!worker) return null;
    return new Promise(resolve => {
      const channel = new MessageChannel();
      const timer = setTimeout(() => { channel.port1.close(); resolve(null); }, 3000);
      channel.port1.onmessage = event => { clearTimeout(timer); channel.port1.close(); resolve(event.data); };
      worker.postMessage({ type: 'PWA_STATUS' }, [channel.port2]);
    });
  }, target);
}

async function ready(page: Page) {
  await requireServiceWorkers(page);
  await expect.poll(() => workerStatus(page), { timeout: 25_000 }).toMatchObject({ type: 'PWA_STATUS', ready: true });
  await expect(page.locator('#pwa-status')).toHaveAttribute('data-pwa-ready', 'true');
}

async function chooseCareer(page: Page) {
  await page.locator('#league-sidebar').getByRole('button', { name: /France/ }).click();
  await page.locator('#team-choice').getByRole('heading', { name: 'FC Silmi', exact: true }).click();
  await page.locator('#btn-start').click();
  await expect(page.locator('#screen-main')).toBeVisible();
  await page.locator('#btn-view-notifications').click();
  await page.getByRole('button', { name: 'Compris', exact: true }).click();
}

async function resume(page: Page) {
  await page.locator('#saves-list .transfer-row').filter({ hasText: 'FC Silmi' })
    .getByRole('button', { name: 'Continuer', exact: true }).click();
  await expect(page.locator('#screen-main')).toBeVisible();
}

async function startMatch(page: Page) {
  await page.locator('#btn-prepare-match').click();
  const phase = page.locator('#lineup-phase-preparation [data-kings-prep-phase="escalier"]');
  if (await phase.getAttribute('open') === null) await phase.locator(':scope > summary').click();
  await phase.locator('[data-kings-prep-focus="escalier-toggle"]').check();
  await page.locator('#btn-play-match').click();
  await expect(page.locator('#screen-match')).toBeVisible();
  await expect(page.locator('#phase-lineup-modal')).not.toBeVisible();
}

async function finishMatch(page: Page) {
  await page.locator('#btn-skip-match').click();
  await expect(page.locator('#btn-skip-match')).toHaveText('Voir le résumé');
  await page.locator('#btn-skip-match').click();
  await expect(page.locator('#screen-summary')).toBeVisible();
  await page.locator('#btn-continue').click();
  await expect(page.locator('#screen-main')).toBeVisible();
}

async function snapshot(page: Page) {
  return page.evaluate(key => {
    const entry = JSON.parse(localStorage.getItem(key) || '{}')[STATE.currentSlotId];
    // Une reprise peut confirmer une nouvelle écriture : sa date change, les
    // données et toutes les autres métadonnées doivent rester identiques.
    if (entry?.meta) delete entry.meta.updatedAt;
    return { slot: STATE.currentSlotId, round: STATE.currentRound,
      reports: JSON.parse(JSON.stringify(STATE.matchReports)), entry };
  }, SAVE_KEY);
}

async function exportedCareer(page: Page) {
  await page.evaluate(() => {
    const original = URL.createObjectURL.bind(URL);
    (window as any).__pwaExport = null;
    URL.createObjectURL = function (value: Blob | MediaSource) {
      if (value instanceof Blob) (window as any).__pwaExport = value.text();
      return original(value);
    };
  });
  const downloading = page.waitForEvent('download');
  await page.locator('#saves-list .transfer-row').filter({ hasText: 'FC Silmi' })
    .getByRole('button', { name: 'Exporter', exact: true }).click();
  const download = await downloading;
  expect(await download.failure()).toBeNull();
  const raw = await page.evaluate(async () => await (window as any).__pwaExport);
  expect(typeof raw).toBe('string');
  return JSON.parse(raw);
}

async function triggerUpdate(page: Page) {
  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration('/');
    if (!registration) throw new Error('Registration missing');
    await registration.update();
  });
  await expect.poll(() => workerStatus(page, 'waiting'), { timeout: 25_000 }).toMatchObject({ ready: true });
}

test('le manifeste et les icônes locales rendent l’application installable sans désactiver le zoom', async ({ page, context, browserName }) => {
  await page.goto('/');
  const manifest = await page.evaluate(async () => {
    const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    if (!link) throw new Error('Manifest link missing');
    const response = await fetch(link.href);
    return { url: link.href, type: response.headers.get('content-type'), status: response.status, value: await response.json() };
  });
  expect(manifest.status).toBe(200);
  expect(manifest.type).toMatch(/application\/(?:manifest\+json|json)/);
  expect(new URL(manifest.url).origin).toBe(new URL(page.url()).origin);
  expect(manifest.value.display).toBe('standalone');
  expect(new URL(manifest.value.start_url, manifest.url).pathname).toBe('/');
  expect(new URL(manifest.value.scope, manifest.url).pathname).toBe('/');
  expect(manifest.value.name).toMatch(/Kings Manager/i);
  expect(manifest.value.icons).toEqual(expect.arrayContaining([
    expect.objectContaining({ sizes: '192x192', type: 'image/png' }),
    expect.objectContaining({ sizes: '512x512', type: 'image/png' }),
    expect.objectContaining({ purpose: 'maskable', type: 'image/png' }),
  ]));
  for (const icon of manifest.value.icons) {
    const dimensions = await page.evaluate(async ({ source, manifestURL }) => {
      const url = new URL(source, manifestURL);
      if (url.origin !== location.origin) throw new Error('External install icon');
      const image = new Image(); image.src = url.href;
      await image.decode();
      return `${image.naturalWidth}x${image.naturalHeight}`;
    }, { source: icon.src, manifestURL: manifest.url });
    expect(dimensions).toBe(icon.sizes);
  }
  const viewport = await page.locator('meta[name="viewport"]').getAttribute('content');
  expect(viewport).toContain('viewport-fit=cover');
  expect(viewport).not.toMatch(/user-scalable\s*=\s*no|maximum-scale\s*=\s*1/);
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute('href', /\S+/);
  if (browserName === 'chromium') {
    await ready(page);
    await page.reload();
    const protocol = await context.newCDPSession(page);
    const nativeManifest = await protocol.send('Page.getAppManifest');
    expect(nativeManifest.errors).toEqual([]);
    expect(JSON.parse(nativeManifest.data).name).toBe(manifest.value.name);
    const installability = await protocol.send('Page.getInstallabilityErrors');
    expect(installability.installabilityErrors).toEqual([]);
    await protocol.detach();
  }
});

test('une carrière se recharge, joue une journée, se sauvegarde et s’exporte réellement sans réseau', async ({ page, context, baseURL, browserName }) => {
  // WebKit's offline flag rejects even a literal SW Response before dispatch:
  // https://github.com/microsoft/playwright/issues/42775. Stop the real origin
  // instead; do not bypass the worker, skip the test, or relax any assertions.
  const fixture = browserName === 'webkit' ? await createPwaFixture(baseURL!) : null;
  try {
    await page.goto(fixture?.url || '/');
    await ready(page);
    await page.reload();
    expect(await page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
    await chooseCareer(page);
    const before = await snapshot(page);
    await page.locator('#btn-restart').click();

    if (fixture) {
      await fixture.close();
      await expect(fetch(fixture.url, { signal: AbortSignal.timeout(3000) })).rejects.toThrow();
    } else await context.setOffline(true);
    const response = await page.reload({ waitUntil: 'domcontentloaded' });
    expect(response?.fromServiceWorker()).toBe(true);
    await expect(page.locator('#screen-home')).toBeVisible();
    await expect(page.locator('#pwa-status')).toHaveAttribute('data-pwa-ready', 'true');
    await resume(page);
    expect((await snapshot(page)).slot).toBe(before.slot);
    await startMatch(page);
    await finishMatch(page);
    const after = await snapshot(page);
    expect(after.round).toBe(before.round + 1);
    expect(after.reports.length).toBeGreaterThan(before.reports.length);
    expect(after.entry.data.currentRound).toBe(after.round);
    expect(after.entry.data.matchReports).toEqual(after.reports);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await resume(page);
    const reloaded = await snapshot(page);
    expect(reloaded).toEqual(after);
    await page.locator('#btn-restart').click();
    const exported = await exportedCareer(page);
    expect(exported.data.currentRound).toBe(after.round);
    expect(exported.data.matchReports).toEqual(after.reports);
  } finally {
    await context.setOffline(false);
    await fixture?.close();
  }
});

test('le bouton d’installation utilise une seule demande et disparaît en mode installé', async ({ page }) => {
  await page.goto('/');
  async function installEvent(outcome: string) {
    await page.evaluate(outcome => {
      const event = new Event('beforeinstallprompt', { cancelable: true });
      Object.defineProperties(event, {
        prompt: { value: async () => { (window as any).__pwaPromptCalls = ((window as any).__pwaPromptCalls || 0) + 1; } },
        userChoice: { value: Promise.resolve({ outcome, platform: 'web' }) },
      });
      dispatchEvent(event);
    }, outcome);
  }
  const panel = page.locator('#pwa-panel');
  if (await panel.getAttribute('open') === null) await panel.locator(':scope > summary').click();
  await installEvent('dismissed');
  await expect(page.locator('#pwa-install')).toBeVisible();
  await page.locator('#pwa-install').click();
  expect(await page.evaluate(() => (window as any).__pwaPromptCalls)).toBe(1);
  await expect(page.locator('#pwa-install')).toBeHidden();
  await installEvent('accepted');
  await page.locator('#pwa-install').click();
  expect(await page.evaluate(() => (window as any).__pwaPromptCalls)).toBe(2);
  await page.evaluate(() => dispatchEvent(new Event('appinstalled')));
  await expect(page.locator('#pwa-install')).toBeHidden();

  await page.addInitScript(() => Object.defineProperty(navigator, 'standalone', { configurable: true, value: true }));
  await page.reload();
  if (await panel.getAttribute('open') === null) await panel.locator(':scope > summary').click();
  await installEvent('accepted');
  await expect(page.locator('#pwa-install')).toBeHidden();
});

test('un navigateur qui bloque les service workers garde le jeu utilisable sans annoncer le hors ligne', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    get() { throw new DOMException('Service Workers bloqués par le navigateur', 'SecurityError'); },
  }));
  await page.goto('/');
  await expect(page.locator('#pwa-status')).toHaveAttribute('data-pwa-ready', 'false');
  await expect(page.locator('#pwa-status')).toContainText(/indisponible/i);
  await chooseCareer(page);
  await expect(page.locator('#screen-main')).toBeVisible();
  expect((await snapshot(page)).entry.data.league.name).toBe('France');
});

test('une vraie mise à jour attend pendant un match et deux onglets, puis préserve la carrière lors de son activation', async ({ page, context, baseURL }) => {
  const fixture = await createPwaFixture(baseURL!);
  try {
    await page.goto(fixture.url);
    await ready(page);
    await page.reload();
    await chooseCareer(page);
    await startMatch(page);
    await page.locator('#btn-pause-match').click();
    const before = await page.evaluate(() => ({ minute: matchState.minute, save: localStorage.getItem('kingsManager7v7_saves') }));
    const version = await workerStatus(page);
    expect(version.version).toMatch(/fixture-1$/);
    fixture.upgrade();
    await triggerUpdate(page);
    expect((await workerStatus(page)).version).toBe(version.version);
    expect((await workerStatus(page, 'waiting')).version).toMatch(/fixture-2$/);
    await expect(page.locator('#screen-match')).toBeVisible();
    await expect(page.locator('#pwa-update')).not.toBeVisible();
    await expect(page.locator('#pwa-update')).toBeDisabled();
    expect(await page.evaluate(() => ({ minute: matchState.minute, save: localStorage.getItem('kingsManager7v7_saves') }))).toEqual(before);

    // Même une demande directe ne doit pas promouvoir le worker pendant le match.
    const blocked = await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.getRegistration('/');
      return new Promise<any>(resolve => {
        const channel = new MessageChannel();
        channel.port1.onmessage = event => { channel.port1.close(); resolve(event.data); };
        registration!.waiting!.postMessage({ type: 'SKIP_WAITING' }, [channel.port2]);
      });
    });
    expect(blocked).toMatchObject({ type: 'PWA_UPDATE_RESULT', ok: false, reason: 'unsafe-client' });
    await finishMatch(page);
    const completed = await snapshot(page);
    await page.locator('#btn-restart').click();
    const panel = page.locator('#pwa-panel');
    if (await panel.getAttribute('open') === null) await panel.locator(':scope > summary').click();
    await expect(page.locator('#pwa-update')).toBeEnabled();

    const second = await context.newPage();
    second.on('pageerror', error => pageErrors.get(page)!.push(error.message));
    await second.goto(fixture.url);
    await page.locator('#pwa-update').click();
    await expect(page.locator('#pwa-update-status')).toContainText(/onglet/i);
    expect((await workerStatus(page)).version).toBe(version.version);
    await expect(page.locator('#screen-home')).toBeVisible();
    await second.close();

    const reloading = page.waitForEvent('domcontentloaded', { timeout: 15_000 });
    await page.locator('#pwa-update').click();
    await reloading;
    await expect.poll(async () => (await workerStatus(page))?.version, { timeout: 15_000 }).toMatch(/fixture-2$/);
    await expect(page.locator('html')).toHaveAttribute('data-pwa-fixture-version', '2');
    expect(await page.evaluate(() => (window as any).__pwaFixtureVersion)).toBe(2);
    await resume(page);
    expect(await snapshot(page)).toEqual(completed);
  } finally {
    await fixture.close();
  }
});

test('une préparation incomplète ne promet pas le hors ligne et peut être réessayée sans toucher aux sauvegardes', async ({ page, baseURL }) => {
  const fixture = await createPwaFixture(baseURL!);
  fixture.breakShell(true);
  try {
    await page.goto(fixture.url);
    await requireServiceWorkers(page);
    const panel = page.locator('#pwa-panel');
    if (await panel.getAttribute('open') === null) await panel.locator(':scope > summary').click();
    await expect(page.locator('#pwa-retry')).toBeVisible({ timeout: 25_000 });
    await expect(page.locator('#pwa-status')).toHaveAttribute('data-pwa-ready', 'false');
    expect((await workerStatus(page))?.ready).not.toBe(true);
    expect(await page.evaluate(() => localStorage.getItem('kingsManager7v7_saves'))).toBeNull();
    fixture.breakShell(false);
    fixture.upgrade();
    await page.locator('#pwa-retry').click();
    await ready(page);
    expect(await page.evaluate(() => localStorage.getItem('kingsManager7v7_saves'))).toBeNull();
  } finally {
    await fixture.close();
  }
});
