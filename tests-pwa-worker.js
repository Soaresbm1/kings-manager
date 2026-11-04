// Vérifications du cycle de vie et des limites du worker : node tests-pwa-worker.js
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const { webcrypto, createHash } = require("node:crypto");
const { MessageChannel } = require("node:worker_threads");
const source = fs.readFileSync(require.resolve("./service-worker.js"), "utf8");
const ORIGIN = "https://kings-manager.test";
const hash = value => createHash("sha256").update(value).digest("hex");
let passed = 0;
async function test(name, run) { await run(); passed++; console.log("OK " + name); }
function harness(options = {}) {
  const bodies = new Map([
    ["/index.html", Buffer.from("<!doctype html>\r\n<title>Kings Manager</title>")],
    ["/app.js", Buffer.from("window.appVersion = 'original';\r\n")],
    ["/style.css", Buffer.from("body { color: white; }\r\n")],
    ["/images/pwa/icon-192.png", Buffer.from([0, 13, 10, 255, 6])],
  ]);
  const config = { schema: 1, revision: hash("test-revision"), assets: Array.from(bodies, ([url, bytes]) => {
    const text = !url.endsWith(".png");
    return { url, text, sha256: hash(text ? bytes.toString("utf8").replace(/\r\n/g, "\n") : bytes) };
  }) };
  const buckets = new Map(), handlers = new Map(), downloads = [], messages = [];
  let offline = false, skipped = 0, claimed = 0, puts = 0;
  const key = request => new URL(typeof request === "string" ? request : request.url, ORIGIN).href;
  const cacheStorage = {
    async keys() { return Array.from(buckets.keys()); },
    async delete(name) { return buckets.delete(name); },
    async open(name) {
      if (!buckets.has(name)) buckets.set(name, new Map());
      const entries = buckets.get(name);
      return {
        async match(request) { return entries.get(key(request))?.clone(); },
        async put(request, response) { puts++; if (options.failPut?.(name, key(request), puts)) throw new Error("quota"); entries.set(key(request), response.clone()); },
        async delete(request) { return entries.delete(key(request)); },
        async keys() { return Array.from(entries.keys(), url => new Request(url)); },
      };
    },
  };
  const client = { id: "home", url: ORIGIN + "/", postMessage(_message, ports) { ports[0].postMessage({ safe: options.safe !== false }); } };
  let clients = [client], clientReads = 0;
  const self = {
    KINGS_PWA_ASSETS: config, location: { origin: ORIGIN },
    addEventListener(type, handler) { handlers.set(type, handler); },
    clients: { async matchAll(query) { assert.equal(query.includeUncontrolled, true); return options.clients?.(++clientReads, client) ?? clients; }, async claim() { claimed++; } },
    async skipWaiting() { skipped++; },
  };
  const context = vm.createContext({
    self, caches: cacheStorage, crypto: webcrypto, URL, Request, Response, TextEncoder, TextDecoder, MessageChannel, Uint8Array,
    setTimeout, clearTimeout, importScripts(url) { assert.equal(url, "/pwa-assets.js"); },
    async fetch(request) {
      const url = new URL(key(request)); downloads.push(url.pathname);
      if (offline) throw new Error("offline");
      const bytes = bodies.get(url.pathname);
      return new Response(bytes ?? "not found", { status: bytes ? 200 : 404 });
    },
  });
  vm.runInContext(source, context, { filename: "service-worker.js" });
  const names = vm.runInContext("({ shell: SHELL_CACHE, images: IMAGE_CACHE, ready: READY_URL })", context);
  async function event(type, value = {}) {
    const tasks = [];
    let response;
    handlers.get(type)({ ...value, waitUntil(task) { tasks.push(task); }, respondWith(task) { response = task; } });
    if (response) response = await response;
    await Promise.all(tasks);
    return response;
  }
  return {
    names, bodies, buckets, downloads, client,
    event,
    setOffline(value) { offline = value; },
    setClients(value) { clients = value; },
    counters() { return { skipped, claimed, puts }; },
    async message(type, from = client) {
      await event("message", { data: { type }, source: from, ports: [{ postMessage(value) { messages.push(value); }, close() {} }] });
      return JSON.parse(JSON.stringify(messages.at(-1)));
    },
    async request(url, method = "GET", navigation = false, headers = {}) {
      const request = new Request(new URL(url, ORIGIN), { method, headers });
      if (navigation) Object.defineProperty(request, "mode", { value: "navigate" });
      return event("fetch", { request });
    },
  };
}

(async () => {
  await test("le précache vérifie les textes normalisés LF et les octets binaires avant d'être prêt", async () => {
    const h = harness();
    await h.event("install");
    assert.deepEqual(h.downloads.sort(), Array.from(h.bodies.keys()).sort());
    assert.equal((await h.message("PWA_STATUS")).ready, true);
    assert.deepEqual(h.counters(), { skipped: 0, claimed: 0, puts: 5 });
  });
  await test("une ressource manquante ou altérée refuse l'installation sans toucher au cache précédent", async () => {
    for (const missing of [true, false]) {
      const h = harness();
      const prior = new Map([[ORIGIN + "/index.html", new Response("old complete version")]]);
      h.buckets.set("kings-manager-pwa-shell-old", prior);
      if (missing) h.bodies.delete("/app.js"); else h.bodies.set("/app.js", Buffer.from("other deployment"));
      await assert.rejects(h.event("install"));
      assert.equal(h.buckets.get("kings-manager-pwa-shell-old"), prior);
      assert.equal(h.buckets.has(h.names.shell), false);
      assert.equal((await h.message("PWA_STATUS")).ready, false);
    }
  });
  await test("une écriture interrompue supprime uniquement le nouveau cache en construction", async () => {
    const h = harness({ failPut: (_name, _url, count) => count === 2 });
    h.buckets.set("another-application", new Map());
    h.buckets.set("kings-manager-pwa-shell-old", new Map());
    await assert.rejects(h.event("install"));
    assert.deepEqual(Array.from(h.buckets.keys()).sort(), ["another-application", "kings-manager-pwa-shell-old"]);
  });
  await test("l'activation nettoie uniquement le namespace Kings et ne prend jamais les pages ouvertes", async () => {
    const h = harness();
    await h.event("install");
    h.buckets.set("another-application", new Map());
    h.buckets.set("kings-manager-pwa-shell-old", new Map());
    h.buckets.set("kings-manager-pwa-images-old", new Map());
    await h.event("activate");
    assert.deepEqual(Array.from(h.buckets.keys()).sort(), ["another-application", h.names.shell].sort());
    assert.equal(h.counters().claimed, 0);
    assert.equal(h.counters().skipped, 0);
  });
  await test("navigation, querystrings et code restent dans une seule version même quand le serveur change", async () => {
    const h = harness();
    await h.event("install");
    const original = h.bodies.get("/app.js").toString();
    h.bodies.set("/app.js", Buffer.from("new deployment"));
    h.setOffline(true);
    assert.equal(await (await h.request("/app.js?v=future")).text(), original);
    assert.match(await (await h.request("/?source=installed", "GET", true)).text(), /Kings Manager/);
    assert.match(await (await h.request("/index.html?source=installed", "GET", true)).text(), /Kings Manager/);
  });
  await test("POST, Range, API, prototypes et origines externes restent hors de la stratégie de cache", async () => {
    const h = harness();
    await h.event("install");
    const count = h.downloads.length;
    assert.equal(await h.request("/app.js", "POST"), undefined);
    assert.equal(await h.request("/app.js", "GET", false, { Range: "bytes=0-3" }), undefined);
    assert.equal(await h.request("/api/save"), undefined);
    assert.equal(await h.request("/prototypes/match-center/", "GET", true), undefined);
    assert.equal(await h.request("/unknown-page", "GET", true), undefined);
    assert.equal(await h.request("https://external.test/app.js"), undefined);
    assert.equal(h.downloads.length, count);
  });
  await test("une éviction partielle est signalée puis réparée explicitement sans toucher aux carrières", async () => {
    const h = harness();
    await h.event("install");
    h.buckets.get(h.names.shell).delete(ORIGIN + "/style.css");
    assert.equal((await h.message("PWA_STATUS")).ready, false);
    assert.equal((await h.message("PWA_PREPARE")).ready, true);
  });
  await test("une réparation échouée conserve toutes les ressources encore lisibles", async () => {
    const h = harness();
    await h.event("install");
    const cache = h.buckets.get(h.names.shell);
    cache.delete(ORIGIN + "/style.css");
    h.setOffline(true);
    const result = await h.message("PWA_PREPARE");
    assert.equal(result.ready, false);
    assert.equal(result.error, "prepare-failed");
    assert.equal(h.buckets.get(h.names.shell), cache);
    assert.equal(await (await h.request("/app.js")).text(), h.bodies.get("/app.js").toString());
  });
  await test("une copie du shell perdue explique la connexion requise sans servir une autre page", async () => {
    const h = harness();
    await h.event("install");
    h.buckets.delete(h.names.shell);
    h.setOffline(true);
    const response = await h.request("/", "GET", true);
    assert.equal(response.status, 503);
    assert.match(await response.text(), /Connexion nécessaire/);
    assert.equal((await h.message("PWA_STATUS")).ready, false);
  });
  await test("les photos mémorisées restent disponibles et leur cache est borné", async () => {
    const h = harness();
    await h.event("install");
    for (let i = 0; i < 75; i++) {
      const url = "/images/players/france/club/player-" + i + ".png";
      h.bodies.set(url, Buffer.from("photo " + i));
      assert.equal((await h.request(url)).status, 200);
    }
    assert.equal(h.buckets.get(h.names.images).size, 72);
    assert.equal(h.buckets.get(h.names.images).has(ORIGIN + "/images/players/france/club/player-0.png"), false);
    h.setOffline(true);
    assert.equal(await (await h.request("/images/players/france/club/player-74.png")).text(), "photo 74");
    assert.equal((await h.request("/images/players/france/club/not-visited.png")).status, 404);
  });
  await test("les portraits trop gros et les erreurs réseau ne deviennent pas des entrées de cache", async () => {
    const h = harness();
    await h.event("install");
    h.bodies.set("/images/players/france/club/large.png", Buffer.alloc(768 * 1024 + 1));
    assert.equal((await h.request("/images/players/france/club/large.png")).status, 200);
    assert.equal((await h.request("/images/players/france/club/missing.png")).status, 404);
    assert.equal(h.buckets.get(h.names.images)?.size ?? 0, 0);
  });
  await test("une activation explicite exige un seul onglet sûr et un cache complet", async () => {
    const h = harness();
    await h.event("install");
    assert.equal((await h.message("SKIP_WAITING")).ok, true);
    assert.equal(h.counters().skipped, 1);
    const unsafe = harness({ safe: false });
    await unsafe.event("install");
    assert.equal((await unsafe.message("SKIP_WAITING")).reason, "unsafe-client");
    assert.equal(unsafe.counters().skipped, 0);
    const missing = harness();
    assert.equal((await missing.message("SKIP_WAITING")).reason, "cache-unavailable");
    assert.equal(missing.counters().skipped, 0);
  });
  await test("un second onglet ou une fenêtre ouverte pendant l'accord bloque la mise à jour", async () => {
    for (const later of [false, true]) {
      const h = harness({ clients: (read, client) => !later || read > 1 ? [client, { id: "other", url: ORIGIN + "/" }] : [client] });
      await h.event("install");
      assert.equal((await h.message("SKIP_WAITING")).reason, "other-clients");
      assert.equal(h.counters().skipped, 0);
    }
  });
  await test("un client absent ou une page de prototype ne peut pas activer le worker", async () => {
    const h = harness();
    await h.event("install");
    assert.equal((await h.message("SKIP_WAITING", { id: "home", url: ORIGIN + "/prototypes/" })).reason, "unsafe-client");
    assert.equal((await h.message("SKIP_WAITING", null)).reason, "unsafe-client");
    assert.equal(h.counters().skipped, 0);
  });
  await test("l'inventaire généré couvre exactement les sources actuelles et leurs empreintes", async () => {
    const generated = require("./scripts/build-pwa-assets.cjs").build();
    const stored = fs.readFileSync(require.resolve("./pwa-assets.js"), "utf8").replace(/\r\n/g, "\n");
    assert.equal(stored, generated, "Relancer node scripts/build-pwa-assets.cjs après modification du shell");
    const context = { self: {} };
    vm.runInNewContext(stored, context);
    const entries = context.self.KINGS_PWA_ASSETS.assets;
    assert(entries.some(asset => asset.url === "/manifest.webmanifest"));
    assert(entries.some(asset => asset.url === "/pwa.js"));
    assert(entries.some(asset => asset.url === "/assets/fonts/fonts.css"));
    assert(entries.filter(asset => asset.url.endsWith(".woff2")).length >= 14);
    assert(entries.filter(asset => asset.url.startsWith("/images/clubs/")).length >= 62);
    assert.equal(entries.some(asset => asset.url.startsWith("/images/players/")), false);
  });
  console.log(passed + " tests du worker PWA réussis.");
})().catch(error => { console.error(error); process.exitCode = 1; });
