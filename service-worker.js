/* Kings Manager : une version complète, sans modifier les carrières locales. */
"use strict";
importScripts("/pwa-assets.js");

const VERSION = '1.6.0-20261104-club-cloud';
const ASSETS = self.KINGS_PWA_ASSETS;
if (!ASSETS || ASSETS.schema !== 1 || !/^[a-f0-9]{64}$/.test(ASSETS.revision) || !Array.isArray(ASSETS.assets)
  || ASSETS.assets.length === 0 || ASSETS.assets.length > 256) {
  throw new Error("Inventaire hors ligne invalide");
}
const ORIGIN = self.location.origin;
const CACHE_PREFIX = "kings-manager-pwa-";
const REVISION = ASSETS.revision;
const SHELL_CACHE = CACHE_PREFIX + "shell-" + VERSION + "-" + REVISION.slice(0, 12);
const IMAGE_CACHE = CACHE_PREFIX + "images-" + VERSION + "-" + REVISION.slice(0, 12);
const READY_URL = new URL("/__kings_pwa__/ready", ORIGIN).href;
const MAX_IMAGE_ENTRIES = 72;
const MAX_IMAGE_BYTES = 768 * 1024;
const CORE = new Map();
for (const asset of ASSETS.assets) {
  if (!asset || typeof asset.url !== "string" || !/^\/(?!\/)[^?#]*$/.test(asset.url)
    || !/^[a-f0-9]{64}$/.test(asset.sha256) || typeof asset.text !== "boolean") throw new Error("Ressource hors ligne invalide");
  const url = new URL(asset.url, ORIGIN);
  if (url.origin !== ORIGIN || CORE.has(url.pathname)) throw new Error("Ressource hors ligne ambiguë");
  CORE.set(url.pathname, { ...asset, href: url.href });
}
if (!CORE.has("/index.html") || !CORE.has("/app.js") || CORE.size > 256) throw new Error("Application hors ligne incomplète");

async function digest(response, text) {
  let bytes = await response.arrayBuffer();
  if (text) bytes = new TextEncoder().encode(new TextDecoder().decode(bytes).replace(/\r\n/g, "\n"));
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, "0")).join("");
}
async function downloadAsset(asset) {
  const response = await fetch(new Request(asset.href, { cache: "reload", credentials: "same-origin" }));
  if (!response.ok || response.type === "opaque" || response.redirected || await digest(response.clone(), asset.text) !== asset.sha256) {
    throw new Error("Ressource hors ligne non vérifiée : " + asset.url);
  }
  return response;
}
async function isReady() {
  try {
    const names = await caches.keys();
    if (!names.includes(SHELL_CACHE)) return false;
    const cache = await caches.open(SHELL_CACHE);
    const marker = await cache.match(READY_URL);
    if (!marker || (await marker.json()).revision !== REVISION) return false;
    const matches = await Promise.all(Array.from(CORE.values(), asset => cache.match(asset.href)));
    return matches.every(Boolean);
  } catch { return false; }
}
let preparing = null;
async function prepareShell() {
  if (preparing) return preparing;
  preparing = (async () => {
    if (await isReady()) return;
    // Tout télécharger et vérifier avant la première écriture. Une requête
    // manquante ou provenant d'un autre déploiement ne produit aucun shell mixte.
    const entries = Array.from(CORE.values());
    const responses = new Array(entries.length);
    let cursor = 0;
    const downloads = await Promise.allSettled(Array.from({ length: Math.min(6, entries.length) }, async () => {
      while (cursor < entries.length) {
        const index = cursor++;
        responses[index] = await downloadAsset(entries[index]);
      }
    }));
    const failed = downloads.find(result => result.status === "rejected");
    if (failed) throw failed.reason;
    const existed = (await caches.keys()).includes(SHELL_CACHE);
    try {
      const cache = await caches.open(SHELL_CACHE);
      for (let i = 0; i < entries.length; i++) await cache.put(entries[i].href, responses[i]);
      await cache.put(READY_URL, new Response(JSON.stringify({ revision: REVISION }), { headers: { "Content-Type": "application/json" } }));
      if (!await isReady()) throw new Error("Cache hors ligne non vérifié");
    } catch (error) {
      // Un cache déjà présent peut être en cours de réparation : ses éléments
      // encore lisibles restent disponibles si l'espace manque.
      if (!existed) await caches.delete(SHELL_CACHE).catch(() => {});
      throw error;
    }
  })();
  try { return await preparing; }
  finally { preparing = null; }
}
self.addEventListener("install", event => { event.waitUntil(prepareShell()); });
self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.allSettled(names.filter(name => name.startsWith(CACHE_PREFIX) && name !== SHELL_CACHE && name !== IMAGE_CACHE).map(name => caches.delete(name)));
    // Pas de claim() : une page déjà ouverte reste indépendante jusqu'à son
    // prochain lancement, sans rechargement d'un match ou d'une carrière.
  })());
});

function offlineResponse(document) {
  const body = document ? '<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#111512"><title>Kings Manager — connexion nécessaire</title><body style="background:#111512;color:#f5f4eb;font:16px system-ui;padding:24px;max-width:34em;margin:auto"><h1>Connexion nécessaire</h1><p>La copie hors ligne est indisponible sur cet appareil. Reconnectez-vous puis rechargez Kings Manager pour la préparer.</p><p>Les carrières enregistrées dans ce navigateur sont conservées.</p><button onclick="location.reload()" style="font:inherit;min-height:44px;padding:10px 18px">Réessayer</button></body></html>' : "Ressource indisponible hors ligne";
  return new Response(body, { status: 503, headers: { "Content-Type": document ? "text/html; charset=utf-8" : "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
}
async function coreResponse(asset, document) {
  try {
    const cache = await caches.open(SHELL_CACHE);
    const cached = await cache.match(asset.href);
    if (cached) return cached;
    const response = await downloadAsset(asset);
    // Réparer une ressource évincée ne doit pas empêcher une lecture réseau.
    try { await cache.put(asset.href, response.clone()); } catch {}
    return response;
  } catch { return offlineResponse(document); }
}
function imagePath(pathname) {
  return /^\/images\/(?:players|clubs)\/[a-z0-9/_-]+\.(?:png|jpe?g|webp|svg)$/.test(pathname);
}
let imageWrites = Promise.resolve();
function rememberImage(request, response) {
  imageWrites = imageWrites.catch(() => {}).then(async () => {
    if (!response.ok || response.type === "opaque" || response.redirected) return;
    const declared = Number(response.headers.get("content-length"));
    if (declared > MAX_IMAGE_BYTES) return;
    const bytes = await response.clone().arrayBuffer();
    if (bytes.byteLength > MAX_IMAGE_BYTES) return;
    const cache = await caches.open(IMAGE_CACHE);
    await cache.delete(request);
    await cache.put(request, response);
    const keys = await cache.keys();
    for (const key of keys.slice(0, Math.max(0, keys.length - MAX_IMAGE_ENTRIES))) await cache.delete(key);
  }).catch(() => {});
  return imageWrites;
}
async function imageResponse(request, event) {
  try {
    const cache = await caches.open(IMAGE_CACHE);
    const cached = await cache.match(request);
    if (cached) return cached;
  } catch {}
  try {
    const response = await fetch(request);
    if (response.ok) event.waitUntil(rememberImage(request, response.clone()));
    return response;
  } catch {
    // Le rendu existant remplace une photo absente par les initiales du joueur.
    return new Response("", { status: 404, headers: { "Cache-Control": "no-store" } });
  }
}
self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET" || request.headers.has("range")) return;
  const url = new URL(request.url);
  if (url.origin !== ORIGIN) return;
  if (url.pathname.startsWith("/api/") || request.headers.has("authorization")) return;
  const document = request.mode === "navigate";
  if (document) {
    if (url.pathname === "/" || url.pathname === "/index.html") event.respondWith(coreResponse(CORE.get("/index.html"), true));
    return;
  }
  const asset = CORE.get(url.pathname);
  if (asset) event.respondWith(coreResponse(asset, false));
  else if (imagePath(url.pathname)) event.respondWith(imageResponse(request, event));
});

function status(ready) { return { type: "PWA_STATUS", version: VERSION, revision: REVISION, ready, assets: CORE.size }; }
function applicationClient(client) {
  try { const url = new URL(client.url); return url.origin === ORIGIN && (url.pathname === "/" || url.pathname === "/index.html"); }
  catch { return false; }
}
async function windows() {
  return (await self.clients.matchAll({ type: "window", includeUncontrolled: true })).filter(client => {
    try { return new URL(client.url).origin === ORIGIN; } catch { return false; }
  });
}
async function canUpdate(client) {
  const channel = new MessageChannel();
  return new Promise(resolve => {
    let finished = false;
    const done = safe => { if (finished) return; finished = true; clearTimeout(timer); channel.port1.close(); channel.port2.close(); resolve(safe); };
    const timer = setTimeout(() => done(false), 1500);
    channel.port1.onmessage = event => done(event.data?.safe === true);
    channel.port1.onmessageerror = () => done(false);
    try { client.postMessage({ type: "PWA_CAN_UPDATE" }, [channel.port2]); } catch { done(false); }
  });
}
async function requestUpdate(source) {
  if (!source?.id || !applicationClient(source)) return { ok: false, reason: "unsafe-client" };
  if (!await isReady()) return { ok: false, reason: "cache-unavailable" };
  const before = await windows();
  if (before.length !== 1 || before[0].id !== source.id) return { ok: false, reason: "other-clients" };
  if (!await canUpdate(before[0])) return { ok: false, reason: "unsafe-client" };
  const after = await windows();
  if (after.length !== 1 || after[0].id !== source.id) return { ok: false, reason: "other-clients" };
  await self.skipWaiting();
  return { ok: true };
}
self.addEventListener("message", event => {
  const port = event.ports?.[0];
  if (!port || !event.data || !["PWA_STATUS", "PWA_PREPARE", "SKIP_WAITING"].includes(event.data.type)) return;
  event.waitUntil((async () => {
    if (event.data.type === "SKIP_WAITING") {
      try { port.postMessage({ type: "PWA_UPDATE_RESULT", ...await requestUpdate(event.source), version: VERSION }); }
      catch { port.postMessage({ type: "PWA_UPDATE_RESULT", ok: false, reason: "cache-unavailable", version: VERSION }); }
    } else {
      let error = false;
      if (event.data.type === "PWA_PREPARE") { try { await prepareShell(); } catch { error = true; } }
      port.postMessage({ ...status(await isReady()), ...(error ? { error: "prepare-failed" } : {}) });
    }
    port.close();
  })());
});
