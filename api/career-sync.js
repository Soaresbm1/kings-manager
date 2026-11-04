"use strict";

// Le serveur ne reçoit que la capacité d'accès et une sauvegarde déjà chiffrée.
// La clé de déchiffrement reste sur les appareils appairés.
const { createHash } = require("node:crypto");
const MAX_BODY_BYTES = 3 * 1024 * 1024;
const MAX_CIPHERTEXT_BYTES = Math.floor((MAX_BODY_BYTES - 100) * 3 / 4);
const MAX_RATE_KEYS = 2048;

class HttpError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}
const fail = (status, code, message) => { throw new HttpError(status, code, message); };
function header(request, key) {
  const value = request.headers?.[key.toLowerCase()];
  return typeof value === "string" ? value : "";
}
function base64url(value, minBytes, maxBytes) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]+$/.test(value) || value.length > Math.ceil(maxBytes * 4 / 3)) return false;
  const bytes = Buffer.from(value, "base64url");
  return bytes.length >= minBytes && bytes.length <= maxBytes && bytes.toString("base64url") === value;
}
function envelope(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    && Object.keys(value).sort().join(",") === "ciphertext,iv,v" && value.v === 1
    && base64url(value.iv, 12, 12) && base64url(value.ciphertext, 32, MAX_CIPHERTEXT_BYTES);
}
function validEtag(value) {
  // SDK Blob et HTTP utilisent le même ETag opaque, conservé sans transformation.
  return typeof value === "string" && value.length >= 1 && value.length <= 256
    && /^[\x21-\x7e]+$/.test(value) && value !== "*" && !value.includes(",") && !value.startsWith("W/");
}
function sdkError(error, name) { return error?.name === name || error?.constructor?.name === name; }
function sameOrigin(request) {
  if (header(request, "sec-fetch-site") === "cross-site") return false;
  const origin = header(request, "origin");
  if (!origin) return true; // Clients directs autorisés avec leur capacité secrète.
  try {
    const parsed = new URL(origin);
    const host = header(request, "host");
    const forwardedProtocol = header(request, "x-forwarded-proto");
    const protocol = forwardedProtocol === "http" ? "http:" : forwardedProtocol === "https" || request.socket?.encrypted
      ? "https:" : /^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(host) ? "http:" : "https:";
    return parsed.protocol === protocol && parsed.origin === origin && parsed.host === host;
  } catch { return false; }
}
async function readBody(request) {
  const length = header(request, "content-length");
  if (length && !/^\d+$/.test(length)) fail(400, "invalid_body", "Corps de requête invalide.");
  if (length && Number(length) > MAX_BODY_BYTES) fail(413, "too_large", "Cette sauvegarde dépasse la taille autorisée.");
  let body = request.body;
  if (body === undefined) {
    const chunks = []; let bytes = 0;
    for await (const chunk of request) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      bytes += buffer.length;
      if (bytes > MAX_BODY_BYTES) fail(413, "too_large", "Cette sauvegarde dépasse la taille autorisée.");
      chunks.push(buffer);
    }
    body = Buffer.concat(chunks, bytes);
  }
  if (Buffer.isBuffer(body)) body = body.toString("utf8");
  if (typeof body === "string") {
    if (Buffer.byteLength(body, "utf8") > MAX_BODY_BYTES) fail(413, "too_large", "Cette sauvegarde dépasse la taille autorisée.");
    try { body = JSON.parse(body); } catch { fail(400, "invalid_body", "Sauvegarde chiffrée invalide."); }
  } else {
    let serialized;
    try { serialized = JSON.stringify(body); } catch { fail(400, "invalid_body", "Sauvegarde chiffrée invalide."); }
    if (!serialized) fail(400, "invalid_body", "Sauvegarde chiffrée invalide.");
    if (Buffer.byteLength(serialized, "utf8") > MAX_BODY_BYTES) fail(413, "too_large", "Cette sauvegarde dépasse la taille autorisée.");
  }
  if (!envelope(body)) fail(400, "invalid_body", "Sauvegarde chiffrée invalide.");
  return JSON.stringify({ v: 1, iv: body.iv, ciphertext: body.ciphertext });
}
async function readStored(result) {
  if (result.statusCode !== 200 || !result.stream || !validEtag(result.blob?.etag)) fail(502, "invalid_remote", "La copie distante ne peut pas être lue.");
  if (result.blob.size > MAX_BODY_BYTES) fail(502, "invalid_remote", "La copie distante ne peut pas être lue.");
  const reader = result.stream.getReader(); const chunks = []; let length = 0;
  try {
    for (;;) {
      const next = await reader.read();
      if (next.done) break;
      length += next.value.byteLength;
      if (length > MAX_BODY_BYTES) {
        await reader.cancel();
        fail(502, "invalid_remote", "La copie distante ne peut pas être lue.");
      }
      chunks.push(Buffer.from(next.value));
    }
  } finally { reader.releaseLock(); }
  let value;
  try { value = JSON.parse(Buffer.concat(chunks, length).toString("utf8")); }
  catch { fail(502, "invalid_remote", "La copie distante ne peut pas être lue."); }
  if (!envelope(value)) fail(502, "invalid_remote", "La copie distante ne peut pas être lue.");
  return value;
}
function createLimiter(now) {
  // Protection locale complémentaire, sans prétendre limiter toutes les instances.
  // Les limites du stockage et la protection réseau Vercel restent applicables.
  const requests = new Map();
  return function allow(key, maximum, interval) {
    const time = now(); let bucket = requests.get(key);
    if (!bucket || time >= bucket.end) bucket = { count: 0, end: time + interval };
    if (bucket.count >= maximum) return Math.max(1, Math.ceil((bucket.end - time) / 1000));
    bucket.count++;
    requests.delete(key); requests.set(key, bucket);
    while (requests.size > MAX_RATE_KEYS) requests.delete(requests.keys().next().value);
    return 0;
  };
}
function defaultStore() {
  // Chargement tardif : les tests purs injectent un stockage, sans SDK ni secret.
  const sdk = require("@vercel/blob");
  return { get: sdk.get, put: sdk.put, del: sdk.del };
}
function createHandler(options = {}) {
  const now = options.now || Date.now;
  const allow = createLimiter(now);
  const environment = (options.environment ?? process.env.VERCEL_ENV) === "production" ? "production" : "preview";
  return async function careerSync(request, response) {
    response.setHeader("Cache-Control", "no-store, max-age=0");
    response.setHeader("CDN-Cache-Control", "no-store");
    response.setHeader("Vercel-CDN-Cache-Control", "no-store");
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Referrer-Policy", "no-referrer");
    const send = (status, body) => { response.statusCode = status; response.end(JSON.stringify(body)); };
    let creating = false;
    try {
      const method = request.method;
      if (!["GET", "PUT", "DELETE"].includes(method)) {
        response.setHeader("Allow", "GET, PUT, DELETE");
        fail(405, "method_not_allowed", "Méthode non autorisée.");
      }
      if (!sameOrigin(request)) fail(403, "origin_rejected", "Cette origine n’est pas autorisée.");
      const authorization = header(request, "authorization");
      const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
      if (!base64url(token, 32, 32)) fail(401, "unauthorized", "Code de synchronisation invalide.");
      const hash = createHash("sha256").update(Buffer.from(token, "base64url")).digest("hex");
      const pathname = `careers/${environment}/${hash}.json`;
      const ip = header(request, "x-vercel-forwarded-for") || request.socket?.remoteAddress || "unknown";
      const ipHash = createHash("sha256").update(ip.slice(0, 256)).digest("hex");
      if (options.rateLimit !== false) {
        const write = method !== "GET";
        const retry = allow(`ip:${ipHash}:${write ? "write" : "read"}`, write ? 12 : 60, 60_000)
          || allow(`token:${hash}`, 60, 60_000);
        if (retry) { response.setHeader("Retry-After", String(retry)); fail(429, "rate_limited", "Trop de tentatives. Réessayez dans un instant."); }
      }
      let match;
      if (method !== "GET") {
        match = header(request, "if-match");
        const none = header(request, "if-none-match");
        creating = method === "PUT" && none === "*" && !match;
        if (!creating && (!validEtag(match) || none)) fail(428, "precondition_required", "Vérifiez d’abord la version distante de cette carrière.");
        if (method === "PUT" && !/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(header(request, "content-type"))) {
          fail(415, "unsupported_type", "Une sauvegarde JSON chiffrée est attendue.");
        }
      }
      const serialized = method === "PUT" ? await readBody(request) : null;
      const store = options.store || defaultStore();
      if (method === "GET") {
        const result = await store.get(pathname, { access: "private", useCache: false });
        if (!result) fail(404, "not_found", "Aucune copie distante pour ce code.");
        const value = await readStored(result);
        response.setHeader("ETag", result.blob.etag);
        send(200, value);
      } else if (method === "PUT") {
        const result = await store.put(pathname, serialized, {
          access: "private", addRandomSuffix: false, allowOverwrite: !creating,
          contentType: "application/json", cacheControlMaxAge: 60,
          ...(creating ? {} : { ifMatch: match })
        });
        if (!validEtag(result?.etag)) fail(502, "invalid_remote", "La confirmation distante ne peut pas être vérifiée.");
        response.setHeader("ETag", result.etag);
        send(creating ? 201 : 200, { ok: true });
      } else {
        await store.del(pathname, { ifMatch: match });
        send(200, { ok: true });
      }
    } catch (error) {
      if (error instanceof HttpError) { send(error.status, { error: error.code, message: error.message }); return; }
      if (sdkError(error, "BlobPreconditionFailedError") || (creating && /already exists/i.test(error?.message || ""))) {
        send(409, { error: "conflict", message: "Cette carrière a changé sur un autre appareil. Les deux copies sont conservées." });
      } else if (sdkError(error, "BlobNotFoundError")) {
        send(404, { error: "not_found", message: "Aucune copie distante pour ce code." });
      } else if (sdkError(error, "BlobServiceRateLimited")) {
        response.setHeader("Retry-After", String(Math.max(1, Math.min(3600, Number(error.retryAfter) || 60))));
        send(429, { error: "rate_limited", message: "Le stockage distant est occupé. Réessayez dans un instant." });
      } else {
        // Les messages SDK peuvent contenir des URL ou jetons : ne jamais les renvoyer.
        send(503, { error: "unavailable", message: "La synchronisation est indisponible. Votre carrière locale est conservée." });
      }
    }
  };
}
module.exports = createHandler();
module.exports.createHandler = createHandler;
module.exports.MAX_BODY_BYTES = MAX_BODY_BYTES;
