import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { runInNewContext } from 'node:vm';

type AssetResponse = { status: number; type: string; body: Buffer };

/** A separate origin gives each update test real, isolated browser registrations.
 * It changes only test responses; application files are never modified. */
export async function createPwaFixture(baseURL: string) {
  let generation = 1;
  let brokenShell = false;
  let closed = false;
  const upstream = new Map<string, Promise<AssetResponse>>();

  async function original(pathname: string): Promise<AssetResponse> {
    if (!upstream.has(pathname)) {
      upstream.set(pathname, (async () => {
        const response = await fetch(new URL(pathname, baseURL), { signal: AbortSignal.timeout(15_000) });
        return { status: response.status, type: response.headers.get('content-type') || 'application/octet-stream', body: Buffer.from(await response.arrayBuffer()) };
      })());
    }
    return upstream.get(pathname)!;
  }

  async function transformed(pathname: string, revision: number): Promise<AssetResponse> {
    const response = await original(pathname);
    if (response.status !== 200) return response;
    const cleanPath = new URL(pathname, 'http://fixture.invalid').pathname;
    let text: string;
    if (cleanPath === '/' || cleanPath === '/index.html') {
      text = response.body.toString('utf8').replace(/<html\b/, `<html data-pwa-fixture-version="${revision}"`);
    } else if (cleanPath === '/app.js') {
      text = `window.__pwaFixtureVersion = ${revision};\n` + response.body.toString('utf8');
    } else return response;
    return { ...response, body: Buffer.from(text) };
  }

  async function assetManifest(pathname: string, revision: number): Promise<AssetResponse> {
    const response = await original(pathname);
    const scope: Record<string, any> = {};
    const sandbox: Record<string, any> = { self: scope };
    runInNewContext(response.body.toString('utf8'), sandbox, { timeout: 1000 });
    const exposed = [...Object.entries(scope), ...Object.entries(sandbox)]
      .find(([name, value]) => name !== 'self' && value && typeof value === 'object' && Array.isArray(value.assets));
    if (!exposed) throw new Error('PWA fixture: expected a published asset manifest');
    const [name, source] = exposed;
    const manifest = JSON.parse(JSON.stringify(source));
    for (const asset of manifest.assets) {
      if (typeof asset.url !== 'string' || typeof asset.sha256 !== 'string') throw new Error('PWA fixture: unsupported asset shape');
      const item = await transformed(asset.url, revision);
      const normalized = asset.text
        ? Buffer.from(item.body.toString('utf8').replace(/\r\n/g, '\n')) : item.body;
      asset.sha256 = createHash('sha256').update(normalized).digest('hex');
      if (brokenShell && new URL(asset.url, 'http://fixture.invalid').pathname === '/data.js') asset.url = '/__missing-shell-test__.js';
    }
    manifest.revision = createHash('sha256').update(JSON.stringify(manifest.assets)).digest('hex');
    return { ...response, body: Buffer.from(`self[${JSON.stringify(name)}] = ${JSON.stringify(manifest)};\n`) };
  }

  const server = createServer(async (request, response) => {
    try {
      const pathname = request.url || '/';
      const cleanPath = new URL(pathname, 'http://fixture.invalid').pathname;
      if (cleanPath === '/__missing-shell-test__.js') { response.writeHead(404).end('Missing test shell asset'); return; }
      const revision = generation;
      let asset = cleanPath === '/pwa-assets.js' ? await assetManifest(pathname, revision) : await transformed(pathname, revision);
      if (cleanPath === '/service-worker.js') {
        let source = asset.body.toString('utf8');
        const replaced = source.replace(/const\s+VERSION\s*=\s*(['"])(.*?)\1\s*;/, (_match, _quote, version) => `const VERSION = ${JSON.stringify(version + '-fixture-' + revision)};`);
        if (source === replaced) throw new Error('PWA fixture: worker VERSION literal was not found');
        source = replaced;
        asset = { ...asset, body: Buffer.from(source) };
      }
      response.writeHead(asset.status, { 'Content-Type': asset.type, 'Content-Length': asset.body.length, 'Cache-Control': 'no-store', 'Service-Worker-Allowed': '/' });
      response.end(request.method === 'HEAD' ? undefined : asset.body);
    } catch (error) {
      response.writeHead(500, { 'Content-Type': 'text/plain' }).end(String(error));
    }
  });
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('PWA fixture could not bind a local port');
  return {
    url: `http://127.0.0.1:${address.port}`,
    upgrade() { generation++; },
    breakShell(value: boolean) { brokenShell = value; },
    async close() {
      if (closed) return;
      closed = true;
      await new Promise<void>(resolve => { server.close(() => resolve()); server.closeAllConnections(); });
    },
  };
}
