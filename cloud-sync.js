/* Coffre facultatif : le secret maître reste sur les appareils appairés. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CareerCloud = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const MAX_PLAIN = 4 * 1024 * 1024;
  const MAX_WIRE = 3 * 1024 * 1024;
  const encoder = new TextEncoder(), decoder = new TextDecoder('utf-8', { fatal: true });
  function fail(message, code) { return Object.assign(new Error(message), { code }); }
  function encode(bytes) {
    let raw = '';
    for (let i = 0; i < bytes.length; i += 8192) raw += String.fromCharCode(...bytes.subarray(i, i + 8192));
    return btoa(raw).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function decode(value) {
    if (typeof value !== 'string' || !/^[A-Za-z0-9_-]+$/.test(value)) throw fail('Code ou copie distante invalide.', 'invalid');
    let bytes;
    try { bytes = Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)); }
    catch { throw fail('Code ou copie distante invalide.', 'invalid'); }
    if (encode(bytes) !== value) throw fail('Encodage invalide.', 'invalid');
    return bytes;
  }
  function createCode() { return 'KM1.' + encode(crypto.getRandomValues(new Uint8Array(32))); }
  async function credentials(code) {
    if (typeof code !== 'string' || !/^KM1\.[A-Za-z0-9_-]{43}$/.test(code.trim())) throw fail('Le code doit commencer par KM1. et contenir 47 caractères.', 'invalid');
    const master = decode(code.trim().slice(4));
    const material = await crypto.subtle.importKey('raw', master, 'HKDF', false, ['deriveBits', 'deriveKey']);
    const params = purpose => ({ name: 'HKDF', hash: 'SHA-256', salt: encoder.encode('kings-manager-cloud-v1'), info: encoder.encode(purpose) });
    const token = encode(new Uint8Array(await crypto.subtle.deriveBits(params('authorization'), material, 256)));
    const key = await crypto.subtle.deriveKey(params('encryption'), material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    return { token, key };
  }
  async function collect(stream, limit) {
    const reader = stream.getReader(), chunks = []; let length = 0;
    try {
      for (;;) {
        const { value, done } = await reader.read(); if (done) break;
        length += value.byteLength;
        if (length > limit) { await reader.cancel(); throw fail('La carrière dépasse la taille prise en charge.', 'size'); }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    const out = new Uint8Array(length); let offset = 0;
    for (const chunk of chunks) { out.set(chunk, offset); offset += chunk.length; }
    return out;
  }
  async function seal(entry, code) {
    const plain = encoder.encode(JSON.stringify(entry));
    if (plain.length > MAX_PLAIN) throw fail('Carrière trop volumineuse pour la synchronisation. L’export JSON reste disponible.', 'size');
    let bytes = plain, format = 0;
    if (plain.length > 40000 && typeof CompressionStream === 'function') {
      const compressed = await collect(new Blob([plain]).stream().pipeThrough(new CompressionStream('gzip')), MAX_PLAIN);
      if (compressed.length < plain.length) { bytes = compressed; format = 1; }
    }
    const input = new Uint8Array(bytes.length + 1); input[0] = format; input.set(bytes, 1);
    const { key } = await credentials(code), iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: encoder.encode('KM1') }, key, input);
    const envelope = { v: 1, iv: encode(iv), ciphertext: encode(new Uint8Array(encrypted)) };
    if (encoder.encode(JSON.stringify(envelope)).length > MAX_WIRE) throw fail('Copie chiffrée trop volumineuse. Utilise l’export JSON.', 'size');
    return envelope;
  }
  async function open(envelope, code) {
    if (!envelope || envelope.v !== 1 || typeof envelope.ciphertext !== 'string' || envelope.ciphertext.length > MAX_WIRE || typeof envelope.iv !== 'string' || envelope.iv.length !== 16) throw fail('Copie distante invalide.', 'invalid');
    const { key } = await credentials(code); let bytes;
    try {
      bytes = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: decode(envelope.iv), additionalData: encoder.encode('KM1') }, key, decode(envelope.ciphertext)));
    } catch { throw fail('Cette copie ne peut pas être déchiffrée avec ce code.', 'decrypt'); }
    const format = bytes[0]; bytes = bytes.subarray(1);
    if (format === 1) {
      if (typeof DecompressionStream !== 'function') throw fail('Ce navigateur ne peut pas ouvrir une copie compressée. Mets-le à jour ou utilise l’import JSON.', 'unsupported');
      bytes = await collect(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')), MAX_PLAIN);
    } else if (format !== 0 || bytes.length > MAX_PLAIN) throw fail('Format distant invalide.', 'invalid');
    try { return JSON.parse(decoder.decode(bytes)); } catch { throw fail('Copie distante illisible.', 'invalid'); }
  }
  async function fingerprint(entry) {
    const raw = encoder.encode(JSON.stringify({ data: entry.data, team: entry.meta?.teamName, league: entry.meta?.leagueName }));
    return encode(new Uint8Array(await crypto.subtle.digest('SHA-256', raw)));
  }
  async function request(code, method = 'GET', envelope, etag, fetcher = fetch) {
    const { token } = await credentials(code), controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    const headers = { Authorization: 'Bearer ' + token };
    if (method !== 'GET') {
      headers['Content-Type'] = 'application/json';
      if (etag) headers['If-Match'] = etag;
      else headers['If-None-Match'] = '*';
    }
    try {
      const response = await fetcher('/api/career-sync', { method, headers, body: envelope ? JSON.stringify(envelope) : undefined, cache: 'no-store', credentials: 'same-origin', signal: controller.signal });
      if (!response.ok) {
        const messages = { 404: 'Aucune copie distante ne correspond à ce code.', 409: 'Une autre progression est disponible. Choisis laquelle conserver.', 413: 'Copie trop volumineuse pour la synchronisation.', 429: 'Trop de demandes rapprochées. Réessaie dans une minute.', 503: 'La synchronisation est temporairement indisponible. Ta carrière locale reste disponible.' };
        throw fail(messages[response.status] || 'La synchronisation a échoué. Réessaie plus tard.', response.status);
      }
      // Une compression HTTP peut affaiblir l'ETag de représentation. La révision
      // explicite conserve l'identité forte du blob utilisée pour l'écriture CAS.
      const nextTag = response.headers.get('X-Career-Revision') || response.headers.get('ETag');
      if (method !== 'DELETE' && (!nextTag || nextTag.length > 256)) throw fail('Révision distante manquante. Aucun écrasement effectué.', 'revision');
      return { envelope: method === 'GET' ? await response.json() : null, etag: nextTag };
    } catch (error) {
      if (error.code) throw error;
      throw fail('Envoi en attente : connexion indisponible. La sauvegarde locale reste utilisable.', 'network');
    } finally { clearTimeout(timer); }
  }
  return { createCode, credentials, seal, open, fingerprint, request, MAX_PLAIN, MAX_WIRE };
});
