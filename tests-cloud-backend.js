// Le contrat HTTP protège les sauvegardes chiffrées et les écritures concurrentes.
"use strict";
const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const { Readable } = require("node:stream");
const { createHandler, MAX_BODY_BYTES } = require("./api/career-sync.js");
const TOKEN = Buffer.alloc(32, 17).toString("base64url");
const OTHER = Buffer.alloc(32, 19).toString("base64url");
const DATA = { v: 1, iv: Buffer.alloc(12, 3).toString("base64url"), ciphertext: Buffer.alloc(100, 5).toString("base64url") };
class BlobPreconditionFailedError extends Error {}
class BlobNotFoundError extends Error {}
class BlobServiceRateLimited extends Error { constructor() { super("secret"); this.retryAfter = 7; } }
function memoryStore() {
  const entries = new Map(), calls = []; let revision = 0;
  return {
    entries, calls,
    async get(path, options) {
      calls.push({ method: "get", path, options });
      const entry = entries.get(path);
      if (!entry) return null;
      return {
        statusCode: 200, blob: { etag: entry.etag, size: Buffer.byteLength(entry.body) },
        stream: new Response(entry.body).body
      };
    },
    async put(path, body, options) {
      calls.push({ method: "put", path, body, options });
      // Ces vérifications simulent la primitive atomique offerte par Blob.
      const previous = entries.get(path);
      if (!options.allowOverwrite && previous) throw new Error("This blob already exists");
      if (options.ifMatch && previous?.etag !== options.ifMatch) throw new BlobPreconditionFailedError();
      const etag = `"revision-${++revision}"`;
      entries.set(path, { body, etag });
      return { etag };
    },
    async del(path, options) {
      calls.push({ method: "del", path, options });
      if (entries.get(path)?.etag !== options.ifMatch) throw new BlobPreconditionFailedError();
      entries.delete(path);
    }
  };
}
async function call(handler, { method = "GET", token = TOKEN, body, headers = {}, stream } = {}) {
  const request = stream || { body };
  Object.assign(request, {
    method, headers: { host: "kings-manager.test", authorization: `Bearer ${token}`, ...headers },
    socket: { remoteAddress: "127.0.0.1" }
  });
  const values = {};
  const response = {
    statusCode: 200,
    setHeader(key, value) { values[key.toLowerCase()] = value; },
    end(value) { this.body = JSON.parse(value); }
  };
  await handler(request, response);
  assert.match(values["cache-control"], /no-store/);
  assert.equal(values["vercel-cdn-cache-control"], "no-store");
  assert.equal(values["access-control-allow-origin"], undefined);
  return { status: response.statusCode, body: response.body, headers: values };
}
const put = (handler, extra = {}) => call(handler, { method: "PUT", body: DATA, headers: { "content-type": "application/json", "if-none-match": "*", ...extra.headers }, ...extra });
let passed = 0;
async function test(label, run) { await run(); passed++; console.log("OK " + label); }
async function main() {
  await test("authentification canonique, origine et méthodes refusées avant tout accès au stockage", async () => {
    const store = memoryStore(), handler = createHandler({ store, rateLimit: false });
    for (const token of ["", "short", TOKEN + "=", TOKEN.slice(0, -1) + "F", "../" + TOKEN]) {
      assert.equal((await call(handler, { token })).status, 401);
    }
    assert.equal((await call(handler, { headers: { origin: "https://evil.test" } })).status, 403);
    assert.equal((await call(handler, { headers: { origin: "http://kings-manager.test" } })).status, 403);
    assert.equal((await call(handler, { headers: { origin: "null" } })).status, 403);
    assert.equal((await call(handler, { headers: { "sec-fetch-site": "cross-site" } })).status, 403);
    assert.equal((await call(handler, { headers: { origin: "https://kings-manager.test/path" } })).status, 403);
    assert.equal((await call(handler, { method: "OPTIONS" })).status, 405);
    assert.equal(store.calls.length, 0);
  });
  await test("copie privée isolée par capacité et environnement, lecture à jour et ETag opaque", async () => {
    const store = memoryStore(), handler = createHandler({ store, environment: "production", rateLimit: false });
    assert.equal((await call(handler)).status, 404);
    const created = await put(handler);
    assert.equal(created.status, 201);
    assert.ok(created.headers.etag);
    const read = await call(handler, { headers: { origin: "https://kings-manager.test" } });
    assert.equal(read.status, 200);
    assert.deepEqual(read.body, DATA);
    assert.equal(read.headers.etag, created.headers.etag);
    const expected = "careers/production/" + createHash("sha256").update(Buffer.from(TOKEN, "base64url")).digest("hex") + ".json";
    assert.equal(store.calls.at(-1).path, expected);
    assert.deepEqual(store.calls.at(-1).options, { access: "private", useCache: false });
    assert.equal((await call(handler, { token: OTHER })).status, 404);
    const preview = createHandler({ store, environment: "preview", rateLimit: false });
    assert.equal((await call(preview)).status, 404);
    assert.equal(store.calls.some(value => JSON.stringify(value).includes(TOKEN)), false);
  });
  await test("deux créations simultanées conservent la première copie, sans remplacement silencieux", async () => {
    const store = memoryStore(), handler = createHandler({ store, rateLimit: false });
    const results = await Promise.all([put(handler), put(handler)]);
    assert.deepEqual(results.map(r => r.status).sort(), [201, 409]);
    assert.equal(store.entries.size, 1);
    assert.equal(store.calls.filter(c => c.method === "get").length, 0);
    assert.equal(store.calls.filter(c => c.method === "put").every(c => c.options.allowOverwrite === false && c.options.addRandomSuffix === false), true);
  });
  await test("deux appareils écrivant le même ETag : une réussite et un conflit atomique", async () => {
    const store = memoryStore(), handler = createHandler({ store, rateLimit: false });
    const created = await put(handler), etag = created.headers.etag;
    const update = extra => call(handler, { method: "PUT", body: { ...DATA, ciphertext: Buffer.alloc(110, extra).toString("base64url") }, headers: { "content-type": "application/json; charset=utf-8", "if-match": etag } });
    const results = await Promise.all([update(9), update(10)]);
    assert.deepEqual(results.map(r => r.status).sort(), [200, 409]);
    assert.notEqual((await call(handler)).headers.etag, etag);
    const calls = store.calls.filter(c => c.method === "put").slice(1);
    assert.equal(calls.every(c => c.options.ifMatch === etag && c.options.allowOverwrite === true), true);
    assert.equal((await call(handler, { method: "DELETE", headers: { "if-match": etag } })).status, 409);
    assert.equal(store.entries.size, 1);
    const current = await call(handler);
    assert.equal((await call(handler, { method: "DELETE", headers: { "if-match": current.headers.etag } })).status, 200);
    assert.equal((await call(handler)).status, 404);
  });
  await test("enveloppes et préconditions invalides n’atteignent jamais Blob", async () => {
    const store = memoryStore(), handler = createHandler({ store, rateLimit: false });
    for (const value of [null, [], { ...DATA, plain: "secret" }, { ...DATA, v: 2 }, { ...DATA, iv: DATA.iv + "=" }, { ...DATA, ciphertext: "tiny" }]) {
      assert.equal((await put(handler, { body: value })).status, 400);
    }
    for (const headers of [{}, { "if-match": "*" }, { "if-match": "W/\"etag\"" }, { "if-match": "a,b" }, { "if-match": "\"etag\"", "if-none-match": "*" }, { "if-none-match": "other" }]) {
      const result = await call(handler, { method: "PUT", body: DATA, headers: { "content-type": "application/json", ...headers } });
      assert.equal(result.status, 428);
    }
    assert.equal((await call(handler, { method: "DELETE" })).status, 428);
    assert.equal((await call(handler, { method: "PUT", body: DATA, headers: { "content-type": "text/plain", "if-none-match": "*" } })).status, 415);
    assert.equal(store.calls.length, 0);
  });
  await test("limite de taille appliquée aux corps parsés, bruts, déclarés et en flux", async () => {
    const store = memoryStore(), handler = createHandler({ store, rateLimit: false });
    const tooLarge = { ...DATA, ciphertext: "A".repeat(MAX_BODY_BYTES) };
    assert.equal((await put(handler, { body: tooLarge })).status, 413);
    assert.equal((await put(handler, { body: JSON.stringify(tooLarge) })).status, 413);
    const headers = { "content-type": "application/json", "if-none-match": "*", "content-length": String(MAX_BODY_BYTES + 1) };
    assert.equal((await call(handler, { method: "PUT", body: DATA, headers })).status, 413);
    const stream = Readable.from([Buffer.alloc(MAX_BODY_BYTES - 2), Buffer.alloc(3)]);
    assert.equal((await call(handler, { method: "PUT", stream, headers: { "content-type": "application/json", "if-none-match": "*" } })).status, 413);
    assert.equal((await put(handler, { body: "not-json" })).status, 400);
    assert.equal(store.calls.length, 0);
    const validStream = Readable.from([Buffer.from(JSON.stringify(DATA).slice(0, 15)), Buffer.from(JSON.stringify(DATA).slice(15))]);
    assert.equal((await call(handler, { method: "PUT", stream: validStream, headers: { "content-type": "application/json", "if-none-match": "*" } })).status, 201);
  });
  await test("erreurs de service et contenu distant corrompu restent explicites et sans secret", async () => {
    const missing = createHandler({ store: { async get() { throw new BlobNotFoundError(); } }, rateLimit: false });
    assert.equal((await call(missing)).status, 404);
    const limited = createHandler({ store: { async get() { throw new BlobServiceRateLimited(); } }, rateLimit: false });
    const result = await call(limited);
    assert.equal(result.status, 429); assert.equal(result.headers["retry-after"], "7");
    const down = createHandler({ store: { async get() { throw new Error("https://private.blob/secret?token=" + TOKEN); } }, rateLimit: false });
    const unavailable = await call(down);
    assert.equal(unavailable.status, 503);
    assert.equal(JSON.stringify(unavailable).includes(TOKEN), false);
    const store = memoryStore(), handler = createHandler({ store, rateLimit: false });
    await put(handler);
    const entry = store.entries.values().next().value;
    entry.body = JSON.stringify({ career: "unencrypted" });
    assert.equal((await call(handler)).status, 502);
    entry.body = JSON.stringify(DATA); entry.etag = "bad\nheader";
    assert.equal((await call(handler)).status, 502);
  });
  await test("limiteur local borné et réouverture de la fenêtre, sans bloquer les capacités isolées", async () => {
    const store = memoryStore(); let now = 1000;
    const handler = createHandler({ store, now: () => now });
    for (let index = 0; index < 60; index++) assert.equal((await call(handler)).status, 404);
    const limited = await call(handler);
    assert.equal(limited.status, 429); assert.equal(limited.headers["retry-after"], "60");
    now += 60_000;
    assert.equal((await call(handler)).status, 404);
    for (let index = 0; index < 12; index++) await put(handler);
    assert.equal((await put(handler)).status, 429);
  });
  console.log(`${passed} blocs de tests cloud réussis.`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
