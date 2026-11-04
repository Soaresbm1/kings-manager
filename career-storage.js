/* Sauvegardes locales vérifiées. Le primaire reste la map JSON historique.
 * Le sidecar conserve une révision par carrière et un seul journal en attente.
 * localStorage n'offre ni transaction multiclés ni verrou entre onglets : le
 * journal permet de reconnaître un commit interrompu, pas de promettre un verrou.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CareerStorage = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const DEFAULT_KEY = "kingsManager7v7_saves";
  const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
  const record = value => value !== null && typeof value === "object" && !Array.isArray(value);
  const copy = value => JSON.parse(JSON.stringify(value));
  const slotRaw = (map, id) => own(map, id) ? JSON.stringify(map[id]) : null;
  const dictionary = source => Object.assign(Object.create(null), source || {});

  // Seul le sidecar est encodé ; le primaire reste lisible par les anciens jeux.
  // Les tags sont distincts des nombres/chaînes JSON : 0 = objet (index de clé,
  // valeur), 1 = tableau, 2 = référence de chaîne, 3 = objet de schéma partagé.
  // Les listes de clés des joueurs/équipes sont internées aussi : un objet garde
  // toutes ses valeurs et leur ordre, sans répéter les index de clés. Les chaînes
  // uniques restent littérales ; aucun tableau de jeu ne ressemble à un token.
  const CODEC = "dictionary-v1";
  const PACKED_CODEC = "lzw16-v1";
  const CODEC_LIMITS = { source: 8 * 1024 * 1024, expanded: 16 * 1024 * 1024, depth: 96, nodes: 1000000, strings: 200000 };

  // LZW à codes fixes 16 bits sur les octets UTF16 du JSON de dictionnaire.
  // Les codes sont empaquetés dans des unités 15 bits entre U+0100 et U+80FF :
  // ni contrôles JSON, ni guillemets, ni surrogates à échapper dans localStorage.
  // Le dictionnaire est borné à 65536 codes et réinitialisé explicitement.
  function packSidecar(raw) {
    if (raw.length < 1024) return raw;
    const table = new Map(), output = [];
    let next = 258, prefix = -1, buffer = 0, bits = 0;
    function emit(code) {
      buffer |= code << bits; bits += 16;
      while (bits >= 15) { output.push(String.fromCharCode(0x100 + (buffer & 0x7fff))); buffer >>>= 15; bits -= 15; }
    }
    function byte(value) {
      if (prefix < 0) { prefix = value; return; }
      const key = prefix * 256 + value;
      const found = table.get(key);
      if (found !== undefined) { prefix = found; return; }
      emit(prefix);
      if (next < 65536) table.set(key, next++);
      else { emit(256); table.clear(); next = 258; }
      prefix = value;
    }
    for (let i = 0; i < raw.length; i++) { const unit = raw.charCodeAt(i); byte(unit & 255); byte(unit >>> 8); }
    if (prefix >= 0) emit(prefix);
    emit(257);
    if (bits) output.push(String.fromCharCode(0x100 + buffer));
    const packed = JSON.stringify({ codec: PACKED_CODEC, length: raw.length, hash: fingerprint(raw).hash, value: output.join("") });
    return packed.length < raw.length ? packed : raw;
  }

  function unpackSidecar(envelope) {
    const length = envelope.length, source = envelope.value;
    if (!Number.isInteger(length) || length < 0 || length > CODEC_LIMITS.source || typeof source !== "string"
      || source.length > CODEC_LIMITS.source || typeof envelope.hash !== "string" || !/^[0-9a-f]{16}$/.test(envelope.hash))
      throw new Error("Enveloppe LZW invalide");
    const prefixes = new Uint16Array(65536), suffixes = new Uint8Array(65536), units = new Uint16Array(length);
    let position = 0, buffer = 0, bits = 0, next = 258, old = -1, first = 0, written = 0, low = -1, codes = 0;
    function readCode() {
      while (bits < 16) {
        if (position >= source.length) throw new Error("Flux LZW tronqué");
        const unit = source.charCodeAt(position++) - 0x100;
        if (unit < 0 || unit > 0x7fff) throw new Error("Unité LZW invalide");
        buffer |= unit << bits; bits += 15;
      }
      const code = buffer & 0xffff; buffer >>>= 16; bits -= 16;
      return code;
    }
    function byte(value) {
      if (low < 0) low = value;
      else {
        if (written >= length) throw new Error("Expansion LZW excessive");
        units[written++] = low | value << 8; low = -1;
      }
    }
    while (true) {
      if (++codes > CODEC_LIMITS.source * 2 + 2) throw new Error("Flux LZW trop long");
      const code = readCode();
      if (code === 257) break;
      if (code === 256) { next = 258; old = -1; continue; }
      if (old < 0) {
        if (code > 255) throw new Error("Premier code LZW invalide");
        byte(code); first = code; old = code; continue;
      }
      let cursor = code;
      const stack = [];
      if (cursor === next && next < 65536) { stack.push(first); cursor = old; }
      else if (cursor >= next) throw new Error("Référence LZW invalide");
      while (cursor >= 258) {
        if (cursor >= next || stack.length >= 65536) throw new Error("Chaîne LZW invalide");
        stack.push(suffixes[cursor]); cursor = prefixes[cursor];
      }
      if (cursor > 255) throw new Error("Préfixe LZW invalide");
      first = cursor; stack.push(first);
      for (let i = stack.length - 1; i >= 0; i--) byte(stack[i]);
      if (next < 65536) { prefixes[next] = old; suffixes[next] = first; next++; }
      old = code;
    }
    if (written !== length || low >= 0 || position !== source.length || buffer !== 0) throw new Error("Longueur LZW invalide");
    const chunks = [];
    for (let i = 0; i < units.length; i += 4096) chunks.push(String.fromCharCode(...units.subarray(i, i + 4096)));
    const raw = chunks.join("");
    if (fingerprint(raw).hash !== envelope.hash) throw new Error("Empreinte LZW invalide");
    return raw;
  }
  function codecBudget() {
    let chars = 0, nodes = 0;
    return (depth, size) => {
      chars += size;
      if (depth > CODEC_LIMITS.depth || ++nodes > CODEC_LIMITS.nodes || chars > CODEC_LIMITS.expanded)
        throw new Error("Limite du codec dépassée");
    };
  }
  function encodeSidecar(value) {
    const strings = [], indices = new Map(), counts = new Map(), shapeCounts = new Map();
    const check = codecBudget();
    const intern = text => {
      if (!indices.has(text)) {
        if (strings.length >= CODEC_LIMITS.strings) throw new Error("Dictionnaire trop grand");
        indices.set(text, strings.length); strings.push(text);
      }
      return indices.get(text);
    };
    function collect(node, depth) {
      if (typeof node === "string") {
        check(depth, JSON.stringify(node).length);
        if (node.length >= 12) counts.set(node, (counts.get(node) || 0) + 1);
      } else if (Array.isArray(node)) {
        check(depth, node.length + 2);
        node.forEach(child => collect(child, depth + 1));
      } else if (record(node)) {
        const keys = Object.keys(node);
        check(depth, keys.length * 2 + 2);
        const shape = keys.map(key => intern(key));
        const signature = shape.join(",");
        const previous = shapeCounts.get(signature);
        if (previous) previous.count++;
        else shapeCounts.set(signature, { keys: shape, count: 1 });
        keys.forEach(key => { check(depth, JSON.stringify(key).length); collect(node[key], depth + 1); });
      } else {
        if (node !== null && typeof node !== "boolean" && !(typeof node === "number" && Number.isFinite(node))) throw new Error("Valeur JSON invalide");
        check(depth, JSON.stringify(node).length);
      }
    }
    collect(value, 0);
    counts.forEach((count, text) => { if (count > 1) intern(text); });
    const shapes = [], shapeIndices = new Map();
    shapeCounts.forEach((shape, signature) => {
      if (shape.count > 1 && shape.keys.length >= 2) { shapeIndices.set(signature, shapes.length); shapes.push(shape.keys); }
    });
    function encode(node) {
      if (typeof node === "string") return node.length >= 12 && indices.has(node) ? [2, indices.get(node)] : node;
      if (Array.isArray(node)) return [1, ...node.map(encode)];
      if (record(node)) {
        const keys = Object.keys(node);
        const shape = shapeIndices.get(keys.map(key => indices.get(key)).join(","));
        if (shape !== undefined) return [3, shape, ...keys.map(key => encode(node[key]))];
        const encoded = [0];
        keys.forEach(key => { encoded.push(indices.get(key), encode(node[key])); });
        return encoded;
      }
      return node;
    }
    const raw = JSON.stringify({ codec: CODEC, strings, shapes, value: encode(value) });
    if (raw.length > CODEC_LIMITS.source) throw new Error("Journal trop grand");
    return packSidecar(raw);
  }
  function decodeSidecar(envelope) {
    if (envelope.codec !== CODEC || !Array.isArray(envelope.strings) || envelope.strings.length > CODEC_LIMITS.strings || !own(envelope, "value"))
      throw new Error("Enveloppe du codec invalide");
    const strings = envelope.strings;
    const lengths = strings.map(text => {
      if (typeof text !== "string") throw new Error("Dictionnaire invalide");
      return JSON.stringify(text).length;
    });
    const check = codecBudget();
    const validIndex = index => Number.isInteger(index) && index >= 0 && index < strings.length;
    const shapes = own(envelope, "shapes") ? envelope.shapes : [];
    if (!Array.isArray(shapes) || shapes.length > CODEC_LIMITS.strings) throw new Error("Schémas invalides");
    let shapeKeys = 0;
    shapes.forEach(shape => {
      if (!Array.isArray(shape) || (shapeKeys += shape.length) > CODEC_LIMITS.nodes
        || shape.some(index => !validIndex(index)) || new Set(shape.map(index => strings[index])).size !== shape.length)
        throw new Error("Clés de schéma invalides");
    });
    function decode(node, depth) {
      if (!Array.isArray(node)) {
        if (node !== null && typeof node !== "string" && typeof node !== "boolean" && !(typeof node === "number" && Number.isFinite(node)))
          throw new Error("Primitif du codec invalide");
        check(depth, JSON.stringify(node).length);
        return node;
      }
      if (node[0] === 2 && node.length === 2 && validIndex(node[1])) {
        check(depth, lengths[node[1]]);
        return strings[node[1]];
      }
      if (node[0] === 1) {
        check(depth, node.length + 1);
        return node.slice(1).map(child => decode(child, depth + 1));
      }
      if (node[0] === 3 && Number.isInteger(node[1]) && node[1] >= 0 && node[1] < shapes.length) {
        const keys = shapes[node[1]];
        if (node.length !== keys.length + 2) throw new Error("Valeurs du schéma invalides");
        check(depth, keys.length * 2 + 2);
        const value = {};
        keys.forEach((index, position) => {
          check(depth, lengths[index]);
          Object.defineProperty(value, strings[index], { enumerable: true, configurable: true, writable: true, value: decode(node[position + 2], depth + 1) });
        });
        return value;
      }
      if (node[0] === 0 && node.length % 2 === 1) {
        check(depth, node.length + 1);
        const value = {};
        for (let i = 1; i < node.length; i += 2) {
          const index = node[i];
          if (!validIndex(index) || own(value, strings[index])) throw new Error("Clé du codec invalide");
          check(depth, lengths[index]);
          // __proto__, constructor et prototype restent des clés de données.
          Object.defineProperty(value, strings[index], { enumerable: true, configurable: true, writable: true, value: decode(node[i + 1], depth + 1) });
        }
        return value;
      }
      throw new Error("Token du codec invalide");
    }
    return decode(envelope.value, 0);
  }

  // Deux accumulateurs indépendants et la longueur évitent de doubler une grosse
  // carrière dans le journal. Ceci est une empreinte de cohérence, pas de sécurité.
  function fingerprint(raw) {
    if (raw === null) return { length: -1, hash: "absent" };
    let a = 2166136261, b = 5381;
    for (let i = 0; i < raw.length; i++) {
      const code = raw.charCodeAt(i);
      a = Math.imul(a ^ code, 16777619);
      b = Math.imul(b, 33) ^ code;
    }
    return { length: raw.length, hash: (a >>> 0).toString(16).padStart(8, "0") + (b >>> 0).toString(16).padStart(8, "0") };
  }
  const sameFingerprint = (a, b) => a && b && a.length === b.length && a.hash === b.hash;
  const validFingerprint = value => record(value) && Number.isInteger(value.length) && value.length >= -1
    && typeof value.hash === "string" && (value.length === -1 ? value.hash === "absent" : /^[0-9a-f]{16}$/.test(value.hash));

  function failure(code, message, details) {
    return Object.assign({ ok: false, code, message, verified: false, persisted: false }, details || {});
  }

  function storageFailure(error, area, phase) {
    const name = error && error.name || "Error";
    const quota = name === "QuotaExceededError" || name === "NS_ERROR_DOM_QUOTA_REACHED" || error && (error.code === 22 || error.code === 1014);
    const disabled = name === "SecurityError" || name === "NotAllowedError";
    return failure(quota ? "quota-exceeded" : disabled ? "storage-disabled" : phase === "read" ? "read-failed" : "write-failed",
      quota ? "Stockage local plein. Exportez votre carrière, puis réessayez."
        : disabled ? "Le navigateur bloque le stockage local. Exportez votre carrière pour la conserver."
          : phase === "read" ? "Impossible de lire les sauvegardes locales. Les données n’ont pas été remplacées."
            : "L’écriture locale a échoué. Votre progression en mémoire peut être exportée.",
      { area, phase, errorName: name });
  }

  function create(options) {
    options = options || {};
    const key = options.key || DEFAULT_KEY;
    const backupKey = options.backupKey || key + "_recovery";
    const now = typeof options.now === "function" ? options.now : Date.now;
    const validator = typeof options.validateEntry === "function" ? options.validateEntry : entry => record(entry) && record(entry.data);
    if (key === backupKey) throw new Error("La clé de restauration doit être distincte de la clé des sauvegardes.");

    function storage() {
      // Ne pas lire localStorage au chargement du script : son getter peut lever.
      return own(options, "storage") ? options.storage : globalThis.localStorage;
    }
    function get(itemKey, area) {
      try {
        const value = storage().getItem(itemKey);
        if (value !== null && typeof value !== "string") return failure("invalid-format", "Le stockage a renvoyé une valeur illisible.", { area });
        return { ok: true, raw: value };
      } catch (error) { return storageFailure(error, area, "read"); }
    }
    function parse(raw, area) {
      if (raw === null) return { ok: true, value: area === "primary" ? {} : { version: 1, slots: {}, pending: null } };
      if (area === "backup" && raw.length > CODEC_LIMITS.source)
        return failure("invalid-format", "Le point de restauration dépasse la taille de lecture autorisée. Les données ont été conservées.", { area });
      let value;
      try { value = JSON.parse(raw); }
      catch (error) { return failure("invalid-json", "Les données locales sont illisibles. Elles ont été conservées sans modification.", { area, raw }); }
      if (!record(value)) return failure("invalid-format", "Le format des sauvegardes locales est invalide. Les données ont été conservées.", { area, raw });
      if (area === "backup") {
        if (own(value, "codec")) {
          try {
            if (value.codec === PACKED_CODEC) value = JSON.parse(unpackSidecar(value));
            value = decodeSidecar(value);
          }
          catch (error) { return failure("invalid-format", "Le point de restauration compressé est illisible. Il a été conservé sans modification.", { area, raw }); }
          if (!record(value)) return failure("invalid-format", "Le point de restauration compressé est invalide. Il a été conservé.", { area, raw });
        }
        const pending = value.pending;
        const validPending = pending === null || (record(pending) && ["write", "restore", "remove"].includes(pending.kind)
          && typeof pending.slotId === "string" && pending.slotId.length > 0 && typeof pending.beforeExists === "boolean"
          && own(pending, "before") && validFingerprint(pending.after));
        if (value.version !== 1 || !record(value.slots) || !validPending)
          return failure("invalid-format", "Le point de restauration local est illisible. Il a été conservé sans modification.", { area, raw });
      }
      return { ok: true, value };
    }
    function read() {
      const result = get(key, "primary");
      if (!result.ok) return result;
      const parsed = parse(result.raw, "primary");
      return parsed.ok ? { ok: true, code: "read", map: parsed.value, raw: result.raw, verified: true, persisted: result.raw !== null } : parsed;
    }
    function snapshot() {
      const primary = read();
      if (!primary.ok) return primary;
      const backup = get(backupKey, "backup");
      if (!backup.ok) return backup;
      const parsed = parse(backup.raw, "backup");
      if (!parsed.ok) return parsed;
      const envelope = parsed.value;
      const slots = dictionary(envelope.slots);
      let recovery = null;
      if (envelope.pending) {
        const pending = envelope.pending;
        const current = fingerprint(slotRaw(primary.map, pending.slotId));
        const before = fingerprint(pending.beforeExists ? JSON.stringify(pending.before) : null);
        if (sameFingerprint(current, pending.after)) {
          if (pending.kind === "remove" || !pending.beforeExists) delete slots[pending.slotId];
          else slots[pending.slotId] = pending.before;
          recovery = "committed";
        } else if (sameFingerprint(current, before)) recovery = "not-committed";
        else return failure("recovery-conflict", "Les sauvegardes ont changé pendant une écriture. Rechargez la page avant de réessayer ; les copies locales sont conservées.", { area: "backup", slotId: pending.slotId });
      }
      return { ok: true, map: primary.map, primaryRaw: primary.raw, backupRaw: backup.raw,
        envelope: { version: 1, slots, pending: null }, pending: envelope.pending, recovery };
    }
    function validId(id) {
      return typeof id === "string" && id.length > 0 && id.length <= 250;
    }
    function validate(entry) {
      let cloned;
      try {
        cloned = copy(entry);
        const accepted = validator(copy(cloned));
        if (accepted !== true && !(record(accepted) && accepted.ok === true)) throw new Error("invalid-entry");
      } catch (error) { return failure("invalid-entry", "Cette carrière ne peut pas être chargée. Aucune sauvegarde n’a été remplacée."); }
      return { ok: true, entry: cloned };
    }
    function checkUnchanged(expectedPrimary, expectedBackup) {
      const primary = get(key, "primary");
      if (!primary.ok) return primary;
      const backup = get(backupKey, "backup");
      if (!backup.ok) return backup;
      if (primary.raw !== expectedPrimary || backup.raw !== expectedBackup)
        return failure("storage-changed", "Une sauvegarde a changé dans un autre onglet. Rechargez la page avant de réessayer.");
      return { ok: true };
    }
    function setVerified(itemKey, raw, area) {
      try { storage().setItem(itemKey, raw); }
      catch (error) { return storageFailure(error, area, "write"); }
      const result = get(itemKey, area);
      if (!result.ok) return Object.assign(result, { code: "verification-failed", phase: "verify", uncertain: true,
        message: "L’écriture n’a pas pu être vérifiée. Exportez votre progression avant de recharger la page." });
      if (result.raw !== raw) return failure("verification-failed", "La sauvegarde relue diffère de l’écriture demandée. Les copies de récupération ont été conservées.", { area, phase: "verify", uncertain: true });
      return { ok: true };
    }
    function tokenFor(snap, id) {
      return JSON.stringify([id, fingerprint(slotRaw(snap.map, id)), fingerprint(slotRaw(snap.envelope.slots, id))]);
    }
    function restoreInfoFrom(snap, id) {
      const exists = own(snap.envelope.slots, id);
      const backup = exists ? validate(snap.envelope.slots[id]) : null;
      const available = !!(backup && backup.ok);
      return { ok: true, code: "restore-info", slotId: id, available, token: tokenFor(snap, id),
        entry: available ? backup.entry : null, currentEntry: own(snap.map, id) ? copy(snap.map[id]) : null,
        updatedAt: available && backup.entry.meta && own(backup.entry.meta, "updatedAt") ? backup.entry.meta.updatedAt : null,
        invalidBackup: exists && !available, recovery: snap.recovery };
    }
    function getRestoreInfo(id) {
      if (!validId(id)) return failure("invalid-slot", "Identifiant de carrière invalide.");
      const snap = snapshot();
      return snap.ok ? restoreInfoFrom(snap, id) : snap;
    }
    function inspect(id) {
      if (id !== undefined && !validId(id)) return failure("invalid-slot", "Identifiant de carrière invalide.");
      const snap = snapshot();
      if (!snap.ok) return snap;
      if (id !== undefined) return Object.assign(restoreInfoFrom(snap, id), {
        code: "inspect", exists: own(snap.map, id), valid: own(snap.map, id) && validate(snap.map[id]).ok
      });
      const slots = {};
      Object.keys(snap.map).forEach(slot => Object.defineProperty(slots, slot, { enumerable: true, value: restoreInfoFrom(snap, slot) }));
      return { ok: true, code: "inspect", map: snap.map, slots, backups: Object.fromEntries(Object.entries(snap.envelope.slots)), pending: snap.pending, recovery: snap.recovery };
    }

    function commit(kind, id, entry, snap) {
      const beforeExists = own(snap.map, id);
      const before = beforeExists ? snap.map[id] : null;
      const nextMap = dictionary(snap.map);
      if (kind === "remove") delete nextMap[id];
      else nextMap[id] = entry;
      const raw = JSON.stringify(nextMap);
      const unchanged = kind !== "remove" && slotRaw(snap.map, id) === JSON.stringify(entry);
      const checked = checkUnchanged(snap.primaryRaw, snap.backupRaw);
      if (!checked.ok) return checked;

      // Même état : vraie écriture + relecture, sans faire tourner le backup.
      if (unchanged) {
        const written = setVerified(key, raw, "primary");
        return written.ok ? { ok: true, code: "unchanged", message: "Cette progression est déjà sauvegardée.", slotId: id,
          verified: true, persisted: true, verifiedAt: now(), entry: copy(entry), restoreAvailable: own(snap.envelope.slots, id) } : written;
      }

      const journal = { version: 1, slots: snap.envelope.slots, pending: { kind, slotId: id, beforeExists, before,
        after: fingerprint(slotRaw(nextMap, id)), preparedAt: now() } };
      let journalRaw, finalRaw;
      const slots = dictionary(snap.envelope.slots);
      if (kind === "remove" || !beforeExists) delete slots[id];
      else slots[id] = before;
      // Prépare les DEUX sérialisations avant toute écriture : une entrée trop
      // profonde ou trop grande ne doit pas laisser un commit à moitié préparé.
      try {
        journalRaw = encodeSidecar(journal);
        finalRaw = encodeSidecar({ version: 1, slots, pending: null });
      } catch (error) { return failure("backup-encoding-failed", "Le point de restauration est trop volumineux ou trop complexe. Exportez votre progression pour la conserver.", { area: "backup", slotId: id, primaryUnchanged: true }); }
      const staged = setVerified(backupKey, journalRaw, "backup");
      if (!staged.ok) return Object.assign(staged, { slotId: id, primaryUnchanged: true });
      // Vérifie encore le primaire après avoir réservé le point de restauration.
      const fresh = checkUnchanged(snap.primaryRaw, journalRaw);
      if (!fresh.ok) return fresh;
      const written = setVerified(key, raw, "primary");
      if (!written.ok) return Object.assign(written, { slotId: id, recoveryAvailable: beforeExists });

      const finalCheck = checkUnchanged(raw, journalRaw);
      const finished = finalCheck.ok ? setVerified(backupKey, finalRaw, "backup") : finalCheck;
      const result = { ok: true, code: kind === "remove" ? "deleted" : kind === "restore" ? "restored" : "saved",
        message: kind === "remove" ? "Carrière supprimée de cet appareil."
          : kind === "restore" ? "Point de restauration rétabli et vérifié." : "Progression sauvegardée sur cet appareil.",
        slotId: id, verified: true, persisted: true, verifiedAt: now(),
        entry: kind === "remove" ? null : copy(entry), restoreAvailable: kind !== "remove" && beforeExists };
      if (!finished.ok) {
        result.warning = { code: "recovery-pending",
          message: "La sauvegarde est vérifiée. La finalisation du point de restauration n’a pas pu être confirmée.", cause: finished.code };
        if (finished.uncertain || finished.code === "storage-changed") {
          result.restoreAvailable = false;
          result.recoveryUncertain = true;
        }
      }
      return result;
    }
    function write(id, entry) {
      if (!validId(id)) return failure("invalid-slot", "Identifiant de carrière invalide.");
      const candidate = validate(entry);
      if (!candidate.ok) return candidate;
      const snap = snapshot();
      return snap.ok ? commit("write", id, candidate.entry, snap) : snap;
    }
    function remove(id) {
      if (!validId(id)) return failure("invalid-slot", "Identifiant de carrière invalide.");
      const snap = snapshot();
      return snap.ok ? commit("remove", id, null, snap) : snap;
    }
    function restore(id, restoreOptions) {
      if (!validId(id)) return failure("invalid-slot", "Identifiant de carrière invalide.");
      const snap = snapshot();
      if (!snap.ok) return snap;
      const info = restoreInfoFrom(snap, id);
      if (!info.available) return failure(info.invalidBackup ? "invalid-entry" : "no-backup", "Aucun point de restauration valide n’est disponible pour cette carrière.");
      if (!restoreOptions || typeof restoreOptions.expectedToken !== "string")
        return failure("confirmation-required", "Confirmez le point de restauration avant de le rétablir.");
      if (restoreOptions.expectedToken !== info.token)
        return failure("stale-restore", "Cette carrière a changé depuis la confirmation. Vérifiez le point de restauration à nouveau.");
      const candidate = validate(own(restoreOptions, "entry") ? restoreOptions.entry : info.entry);
      return candidate.ok ? commit("restore", id, candidate.entry, snap) : candidate;
    }

    return { read, write, remove, restore, inspect, getRestoreInfo, key, backupKey };
  }

  // Le callback d’export reçoit le résultat, mais l’app reste propriétaire de
  // l’état vivant à exporter : une erreur disque ne remplace jamais cet état.
  function renderStatus(container, result, actions) {
    if (!container || !container.ownerDocument) return;
    const document = container.ownerDocument;
    actions = actions || {};
    container.replaceChildren();
    if (!result) { container.hidden = true; return; }
    container.hidden = false;
    container.classList.add("save-status");
    container.classList.toggle("save-status-error", !result.ok);
    container.classList.toggle("save-status-warning", !!result.warning);
    container.setAttribute("role", result.ok ? "status" : "alert");
    container.setAttribute("aria-live", result.ok ? "polite" : "assertive");
    const text = document.createElement("div");
    text.className = "save-status-message";
    text.textContent = result.message || (result.ok ? "Sauvegarde vérifiée." : "Sauvegarde non confirmée.");
    container.appendChild(text);
    if (result.warning) {
      const warning = document.createElement("div");
      warning.className = "save-status-detail";
      warning.textContent = result.warning.message;
      container.appendChild(warning);
    }
    if (!result.ok && (typeof actions.onRetry === "function" || typeof actions.onExport === "function")) {
      const buttons = document.createElement("div");
      buttons.className = "save-status-actions";
      [["Réessayer", actions.onRetry], ["Exporter ma progression", actions.onExport]].forEach(([label, callback]) => {
        if (typeof callback !== "function") return;
        const button = document.createElement("button");
        button.type = "button";
        button.className = "save-control";
        button.textContent = label;
        button.addEventListener("click", () => callback(result));
        buttons.appendChild(button);
      });
      container.appendChild(buttons);
    }
  }

  return { create, renderStatus, DEFAULT_KEY };
});
