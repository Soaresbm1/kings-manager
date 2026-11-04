// Écritures et récupération par carrière : node tests-career-storage.js
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const CareerStorage = require("./career-storage.js");
const KEY = CareerStorage.DEFAULT_KEY;
const BACKUP = KEY + "_recovery";
let passed = 0;
function test(label, run) { run(); passed++; console.log("OK " + label); }
function error(name) { return Object.assign(new Error(name), { name }); }
function entry(round, team = "a") {
  return { meta: { teamName: team, updatedAt: 1700000000000 + round }, data: { league: { name: "Ligue", teams: [{ id: team }] }, round } };
}
function memory(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    values, reads: [], writes: [], beforeRead: null, beforeWrite: null, afterWrite: null,
    getItem(key) {
      this.reads.push(key);
      if (this.beforeRead) this.beforeRead(key);
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      if (this.beforeWrite) this.beforeWrite(key, value);
      this.writes.push({ key, value });
      values.set(key, String(value));
      if (this.afterWrite) this.afterWrite(key, value);
    }
  };
}
function service(storage, options = {}) {
  return CareerStorage.create({ storage, now: () => 1800000000000, validateEntry: value => !!(value && value.data && value.data.league), ...options });
}

let realCareer;
function actualCareer() {
  if (!realCareer) {
    const context = vm.createContext({ document: { addEventListener() {} } });
    vm.runInContext('let seed=20261104; Math.random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);', context);
    for (const file of ["data.js", "matchengine-actions.js", "engine.js", "app.js"])
      vm.runInContext(fs.readFileSync(require.resolve("./" + file), "utf8"), context, { filename: file });
    realCareer = JSON.parse(JSON.stringify(vm.runInContext(`
      STATE.leagueKey="france";
      STATE.league={name:LEAGUES.france.name,teams:JSON.parse(JSON.stringify(LEAGUES.france.teams)),results:[]};
      STATE.userTeamId=STATE.league.teams[0].id;
      STATE.schedule=generateSchedule(STATE.league.teams.map(t=>t.id));
      STATE.schedule.forEach((round,index)=>round.forEach(match=>STATE.league.results.push({round:index,...match,played:false,homeGoals:0,awayGoals:0})));
      STATE.otherLeagues=buildOtherLeagues("france");
      ({meta:{teamName:STATE.league.teams[0].name,leagueName:STATE.league.name,updatedAt:1700000000000},data:buildSaveData()});
    `, context)));
  }
  return JSON.parse(JSON.stringify(realCareer));
}

test("la map legacy reste lisible et le primaire ne devient pas une enveloppe", () => {
  const old = entry(0);
  const disk = memory({ [KEY]: JSON.stringify({ a: old }) });
  const store = service(disk);
  assert.deepEqual(store.read().map, { a: old });
  const saved = store.write("a", entry(1));
  assert.equal(saved.ok, true);
  assert.equal(saved.code, "saved");
  assert.equal(saved.verifiedAt, 1800000000000);
  assert.deepEqual(JSON.parse(disk.values.get(KEY)), { a: entry(1) });
  assert.deepEqual(store.getRestoreInfo("a").entry, old);
  assert.deepEqual(store.inspect().backups, { a: old });
  assert.equal(store.inspect().pending, null);
});

test("un premier enregistrement vérifie le journal, puis le primaire, puis finalise", () => {
  const disk = memory();
  const store = service(disk);
  let preparedAt;
  disk.afterWrite = key => { if (key === BACKUP && preparedAt === undefined) preparedAt = store.inspect().pending.preparedAt; };
  assert.equal(store.write("a", entry(0)).ok, true);
  assert.deepEqual(disk.writes.map(write => write.key), [BACKUP, KEY, BACKUP]);
  assert.equal(service(disk).getRestoreInfo("a").available, false);
  assert.equal(preparedAt, 1800000000000);
});

test("une lecture absente est vide, mais JSON invalide, null, tableaux et chaînes ne le sont pas", () => {
  assert.deepEqual(service(memory()).read().map, {});
  for (const raw of ["{cassé", "", "null", "[]", '"map"', "42"]) {
    const disk = memory({ [KEY]: raw });
    const store = service(disk);
    assert.equal(store.read().ok, false, raw);
    assert.equal(store.write("a", entry(1)).ok, false, raw);
    assert.equal(store.remove("a").ok, false, raw);
    assert.equal(disk.values.get(KEY), raw);
    assert.equal(disk.writes.length, 0);
  }
});

test("les exceptions de lecture et storage bloqué ne déclenchent aucune écriture", () => {
  for (const blocked of [KEY, BACKUP]) {
    const disk = memory({ [KEY]: JSON.stringify({ a: entry(0) }) });
    disk.beforeRead = key => { if (key === blocked) throw error("SecurityError"); };
    const result = service(disk).write("a", entry(1));
    assert.equal(result.ok, false);
    assert.equal(result.code, "storage-disabled");
    assert.equal(result.area, blocked === KEY ? "primary" : "backup");
    assert.equal(disk.writes.length, 0);
  }
  const disk = memory();
  disk.beforeRead = () => { throw error("Error"); };
  assert.equal(service(disk).read().code, "read-failed");
  assert.equal(CareerStorage.create({ storage: null }).read().ok, false);
});

test("un sidecar invalide ne bloque pas la lecture/export du primaire et bloque les mutations", () => {
  for (const raw of ["cassé", "null", "{}", '{"version":2,"slots":{},"pending":null}', '{"version":1,"slots":{},"pending":{}}']) {
    const disk = memory({ [KEY]: JSON.stringify({ a: entry(0) }), [BACKUP]: raw });
    const store = service(disk);
    assert.equal(store.read().ok, true);
    assert.equal(store.write("a", entry(1)).ok, false);
    assert.equal(store.remove("a").ok, false);
    assert.equal(disk.values.get(BACKUP), raw);
    assert.equal(disk.writes.length, 0);
  }
});

test("quota du journal : le primaire et l’ancien backup restent intacts", () => {
  const disk = memory();
  const store = service(disk);
  store.write("a", entry(0)); store.write("a", entry(1));
  const initial = new Map(disk.values);
  disk.beforeWrite = key => { if (key === BACKUP) throw error("QuotaExceededError"); };
  const result = store.write("a", entry(2));
  assert.equal(result.ok, false);
  assert.equal(result.code, "quota-exceeded");
  assert.equal(result.primaryUnchanged, true);
  assert.deepEqual(disk.values, initial);
  assert.deepEqual(store.getRestoreInfo("a").entry, entry(0));
});

test("quota du primaire : la progression et l’ancien backup restent restaurables sans faux succès", () => {
  const disk = memory();
  const store = service(disk);
  store.write("a", entry(0)); store.write("a", entry(1));
  const primary = disk.values.get(KEY);
  disk.beforeWrite = key => { if (key === KEY) throw error("QuotaExceededError"); };
  const result = store.write("a", entry(2));
  assert.equal(result.ok, false);
  assert.equal(result.persisted, false);
  assert.equal(disk.values.get(KEY), primary);
  assert.deepEqual(store.getRestoreInfo("a").entry, entry(0));
  assert.equal(store.inspect("a").recovery, "not-committed");
  disk.beforeWrite = null;
  assert.equal(store.write("a", entry(2)).ok, true);
  assert.deepEqual(store.getRestoreInfo("a").entry, entry(1));
});

test("un commit dont la finalisation échoue garde le bon backup après rechargement", () => {
  const disk = memory();
  const store = service(disk);
  store.write("a", entry(0)); store.write("a", entry(1));
  let writes = 0;
  disk.beforeWrite = key => { if (key === BACKUP && ++writes === 2) throw error("QuotaExceededError"); };
  const result = store.write("a", entry(2));
  assert.equal(result.ok, true);
  assert.equal(result.warning.code, "recovery-pending");
  assert.equal(result.verified, true);
  assert.equal(service(disk).inspect("a").recovery, "committed");
  assert.deepEqual(service(disk).getRestoreInfo("a").entry, entry(1));
  const journal = service(disk).inspect().pending;
  assert.deepEqual(journal.before, entry(1));
  assert.equal(journal.after.length, JSON.stringify(entry(2)).length);
  assert.equal(Object.hasOwn(journal.after, "data"), false);
  disk.beforeWrite = null;
  assert.equal(service(disk).write("a", entry(3)).ok, true);
  assert.deepEqual(service(disk).getRestoreInfo("a").entry, entry(2));
});

test("les écritures non vérifiables ne peuvent pas annoncer un succès", () => {
  for (const changedKey of [KEY, BACKUP]) {
    const disk = memory({ [KEY]: JSON.stringify({ a: entry(0) }) });
    disk.afterWrite = key => { if (key === changedKey) disk.values.set(key, "{}"); };
    const result = service(disk).write("a", entry(1));
    assert.equal(result.ok, false);
    assert.equal(result.code, "verification-failed");
    assert.equal(result.uncertain, true);
    if (changedKey === BACKUP) assert.deepEqual(JSON.parse(disk.values.get(KEY)), { a: entry(0) });
  }
});

test("un échec de vérification à la finalisation signale honnêtement le backup incertain", () => {
  const disk = memory({ [KEY]: JSON.stringify({ a: entry(0) }) });
  let writes = 0;
  disk.afterWrite = key => { if (key === BACKUP && ++writes === 2) disk.values.set(BACKUP, "{}"); };
  const result = service(disk).write("a", entry(1));
  assert.equal(result.ok, true);
  assert.deepEqual(service(disk).read().map.a, entry(1));
  assert.equal(result.warning.cause, "verification-failed");
  assert.equal(result.restoreAvailable, false);
  assert.equal(result.recoveryUncertain, true);
});

test("un storage devenu bloqué pendant l’écriture ne remplace pas le primaire", () => {
  for (const blocked of [KEY, BACKUP]) {
    const raw = JSON.stringify({ a: entry(0) });
    const disk = memory({ [KEY]: raw });
    disk.beforeWrite = key => { if (key === blocked) throw error("SecurityError"); };
    const result = service(disk).write("a", entry(1));
    assert.equal(result.ok, false);
    assert.equal(result.code, "storage-disabled");
    assert.equal(disk.values.get(KEY), raw);
  }
});

test("une exception après écriture laisse un journal qui reconnaît le commit effectif", () => {
  const disk = memory({ [KEY]: JSON.stringify({ a: entry(0) }) });
  disk.afterWrite = key => {
    if (key === KEY) disk.beforeRead = item => { if (item === KEY) throw error("SecurityError"); };
  };
  const result = service(disk).write("a", entry(1));
  assert.equal(result.ok, false);
  assert.equal(result.code, "verification-failed");
  disk.beforeRead = null;
  assert.deepEqual(service(disk).getRestoreInfo("a").entry, entry(0));
  assert.equal(service(disk).inspect("a").recovery, "committed");
});

test("un journal divergent bloque les mutations sans toucher les données", () => {
  const disk = memory({ [KEY]: JSON.stringify({ a: entry(0) }) });
  disk.beforeWrite = key => { if (key === KEY) throw error("QuotaExceededError"); };
  service(disk).write("a", entry(1));
  disk.beforeWrite = null;
  disk.values.set(KEY, JSON.stringify({ a: entry(7) }));
  const initial = new Map(disk.values);
  assert.equal(service(disk).write("b", entry(0, "b")).code, "recovery-conflict");
  assert.deepEqual(disk.values, initial);
  assert.equal(service(disk).read().ok, true);
});

test("restaurer exige le token confirmé et permet de revenir à l’état remplacé", () => {
  const disk = memory();
  const store = service(disk);
  store.write("a", entry(0)); store.write("a", entry(1));
  const info = store.getRestoreInfo("a");
  assert.equal(store.restore("a").code, "confirmation-required");
  assert.equal(store.restore("a", { expectedToken: "ancien" }).code, "stale-restore");
  assert.equal(store.restore("a", { expectedToken: info.token, entry: { data: {} } }).code, "invalid-entry");
  assert.equal(store.restore("a", { expectedToken: info.token, entry: info.entry }).ok, true);
  assert.deepEqual(store.read().map.a, entry(0));
  const back = store.getRestoreInfo("a");
  assert.deepEqual(back.entry, entry(1));
  assert.equal(store.restore("a", { expectedToken: back.token }).ok, true);
  assert.deepEqual(store.read().map.a, entry(1));
});

test("une confirmation obsolète et un backup rejeté sont refusés sans écriture", () => {
  const disk = memory();
  const store = service(disk);
  store.write("a", entry(0)); store.write("a", entry(1));
  const info = store.getRestoreInfo("a");
  store.write("a", entry(2));
  const count = disk.writes.length;
  assert.equal(store.restore("a", { expectedToken: info.token }).code, "stale-restore");
  assert.equal(disk.writes.length, count);
  const strict = service(disk, { validateEntry: value => value.data.round > 1 });
  assert.equal(strict.getRestoreInfo("a").invalidBackup, true);
  assert.equal(strict.restore("a", { expectedToken: "x" }).code, "invalid-entry");
  assert.equal(disk.writes.length, count);
});

test("les points de restauration et suppressions restent isolés entre carrières", () => {
  const disk = memory();
  const store = service(disk);
  store.write("a", entry(0)); store.write("a", entry(1));
  store.write("b", entry(10, "b")); store.write("b", entry(11, "b"));
  const a = store.getRestoreInfo("a");
  assert.equal(store.restore("a", { expectedToken: a.token }).ok, true);
  assert.deepEqual(store.read().map.b, entry(11, "b"));
  assert.deepEqual(store.getRestoreInfo("b").entry, entry(10, "b"));
  assert.equal(store.remove("a").code, "deleted");
  assert.equal(Object.hasOwn(store.read().map, "a"), false);
  assert.equal(store.getRestoreInfo("a").available, false);
  assert.deepEqual(store.getRestoreInfo("b").entry, entry(10, "b"));
  assert.equal(Object.hasOwn(store.inspect().backups, "a"), false);
});

test("une suppression interrompue est reconnue sans ressusciter le backup supprimé", () => {
  const disk = memory();
  const store = service(disk);
  store.write("a", entry(0)); store.write("a", entry(1));
  store.write("b", entry(0, "b")); store.write("b", entry(1, "b"));
  let writes = 0;
  disk.beforeWrite = key => { if (key === BACKUP && ++writes === 2) throw error("QuotaExceededError"); };
  assert.equal(store.remove("a").ok, true);
  assert.equal(service(disk).getRestoreInfo("a").available, false);
  assert.deepEqual(service(disk).getRestoreInfo("b").entry, entry(0, "b"));
});

test("les entrées, les résultats et les validateurs n’altèrent jamais l’objet reçu", () => {
  const disk = memory();
  const store = service(disk, { validateEntry: value => { value.meta.teamName = "muté"; return true; } });
  const value = entry(0);
  const raw = JSON.stringify(value);
  const result = store.write("a", value);
  assert.equal(JSON.stringify(value), raw);
  assert.deepEqual(store.read().map.a, value);
  result.entry.meta.teamName = "autre";
  assert.deepEqual(store.read().map.a, value);
  store.write("a", entry(1));
  const info = store.getRestoreInfo("a");
  info.entry.meta.teamName = "autre";
  assert.deepEqual(store.getRestoreInfo("a").entry, value);
});

test("les mêmes données sont réécrites/vérifiées sans perdre le précédent backup", () => {
  const disk = memory();
  const store = service(disk);
  store.write("a", entry(0)); store.write("a", entry(1));
  const count = disk.writes.length;
  assert.equal(store.write("a", entry(1)).code, "unchanged");
  assert.equal(disk.writes.length, count + 1);
  assert.equal(disk.writes.at(-1).key, KEY);
  assert.deepEqual(store.getRestoreInfo("a").entry, entry(0));
});

test("les sauvegardes répétées restent bornées à une révision par carrière", () => {
  const disk = memory();
  const store = service(disk);
  for (let round = 0; round < 50; round++) assert.equal(store.write("a", entry(round)).ok, true);
  assert.deepEqual(store.inspect().backups, { a: entry(48) });
  assert.equal(store.inspect().pending, null);
});

test("un gros historique n’est pas copié dans l’empreinte after du journal", () => {
  const old = entry(0), next = entry(1);
  old.data.matchReports = "a".repeat(750000);
  next.data.matchReports = "b".repeat(900000);
  const disk = memory({ [KEY]: JSON.stringify({ a: old }) });
  assert.equal(service(disk).write("a", next).ok, true);
  const journal = disk.writes.find(write => write.key === BACKUP).value;
  assert.ok(journal.length < JSON.stringify(old).length + 1024, "Le journal contient before et un en-tête borné, jamais une copie de after");
  assert.equal(journal.includes("b".repeat(100)), false);
});

test("des candidats non sérialisables ou rejetés laissent les deux clés intactes", () => {
  const disk = memory({ [KEY]: JSON.stringify({ a: entry(0) }) });
  const circular = entry(1); circular.data.circular = circular;
  const initial = new Map(disk.values);
  for (const value of [undefined, null, { data: {} }, circular, { data: { league: {}, n: 1n } }])
    assert.equal(service(disk).write("a", value).code, "invalid-entry");
  assert.deepEqual(disk.values, initial);
  assert.equal(disk.writes.length, 0);
});

test("les clés réservées, entrées voisines inconnues et chaînes dangereuses restent des données", () => {
  const disk = memory({ [KEY]: '{"broken":null,"__proto__":{"meta":{},"data":{"league":{}}}}' });
  const store = service(disk);
  assert.equal(store.write("__proto__", entry(1, "<img onerror=alert(1)> ")).ok, true);
  assert.equal(Object.hasOwn(store.read().map, "__proto__"), true);
  assert.equal(store.read().map.broken, null);
  assert.equal({}.data, undefined);
  assert.equal(store.remove("__proto__").ok, true);
  assert.equal(Object.hasOwn(store.read().map, "__proto__"), false);
  assert.equal(store.read().map.broken, null);
});

test("un changement d’onglet détecté entre les lectures bloque l’écrasement", () => {
  const disk = memory({ [KEY]: JSON.stringify({ a: entry(0) }) });
  let reads = 0;
  disk.beforeRead = key => { if (key === KEY && ++reads === 2) disk.values.set(KEY, JSON.stringify({ a: entry(8) })); };
  assert.equal(service(disk).write("a", entry(1)).code, "storage-changed");
  assert.deepEqual(JSON.parse(disk.values.get(KEY)), { a: entry(8) });
  assert.equal(disk.writes.length, 0);
});

test("le module global se charge même si localStorage est désactivé et n’utilise aucun RNG", () => {
  const context = { Math: Object.create(Math), Date, console };
  context.Math.random = () => { throw new Error("RNG interdit"); };
  vm.createContext(context);
  vm.runInContext('Object.defineProperty(globalThis, "localStorage", { get() { const error = new Error("blocked"); error.name = "SecurityError"; throw error; } });', context);
  vm.runInContext(fs.readFileSync(require.resolve("./career-storage.js"), "utf8"), context);
  assert.equal(typeof context.CareerStorage.create, "function");
  assert.equal(context.CareerStorage.create().read().code, "storage-disabled");
  assert.equal(context.CareerStorage.create({ storage: memory(), now: () => 7 }).write("a", entry(1)).verifiedAt, 7);
});

test("les clés sont configurables mais ne peuvent pas se recouvrir", () => {
  const disk = memory();
  const store = service(disk, { key: "custom", backupKey: "custom_backup" });
  assert.equal(store.write("a", entry(1)).ok, true);
  assert.ok(disk.values.has("custom"));
  assert.ok(disk.values.has("custom_backup"));
  assert.equal(disk.values.has(KEY), false);
  assert.throws(() => service(disk, { key: "same", backupKey: "same" }));
});

test("le dictionnaire préserve Unicode, métadonnées, clés réservées et tableaux ressemblant aux tokens", () => {
  const old = entry(0, "Équipe 🦁 — Zürich e\u0301 \ud800");
  old.meta.extra = { note: "Message de direction répété 🏆", noteAgain: "Message de direction répété 🏆", empty: "", enabled: false, missing: null };
  old.data.details = JSON.parse('{"__proto__":{"polluted":true},"constructor":{"prototype":{"polluted":true}},"0":[0,2,"array"],"1":[1],"2":[2,0]}');
  old.data.detailsAgain = JSON.parse(JSON.stringify(old.data.details));
  old.data.tokens = [[], {}, [0, 1, "texte"], [1, [2, 0]], [2, 1], [3, 0, "objet partagé"], null, false, true, 0, -0, -1.25, 3.14e20, "日本語\n\"\\\t"];
  const disk = memory();
  const store = service(disk);
  assert.equal(store.write("__proto__", old).ok, true);
  assert.equal(store.write("__proto__", entry(1)).ok, true);
  const expected = JSON.parse(JSON.stringify(old));
  assert.deepEqual(store.getRestoreInfo("__proto__").entry, expected);
  assert.deepEqual(store.inspect().backups.__proto__, expected);
  assert.equal(Object.hasOwn(store.getRestoreInfo("__proto__").entry.data.details, "__proto__"), true);
  assert.equal({}.polluted, undefined);
  const info = store.getRestoreInfo("__proto__");
  assert.equal(store.restore("__proto__", { expectedToken: info.token }).ok, true);
  assert.deepEqual(store.read().map.__proto__, expected);
});

test("un ancien sidecar JSON brut se lit puis se compacte sans perdre son point de retour", () => {
  const disk = memory({ [KEY]: JSON.stringify({ a: entry(1) }), [BACKUP]: JSON.stringify({ version: 1, slots: { a: entry(0) }, pending: null }) });
  const store = service(disk);
  assert.deepEqual(store.getRestoreInfo("a").entry, entry(0));
  const info = store.getRestoreInfo("a");
  assert.equal(store.restore("a", { expectedToken: info.token }).ok, true);
  assert.deepEqual(store.read().map.a, entry(0));
  assert.deepEqual(store.getRestoreInfo("a").entry, entry(1));
  assert.equal(JSON.parse(disk.values.get(BACKUP)).codec, "dictionary-v1");
});

test("un ancien journal pending brut reste récupérable avant sa prochaine écriture compacte", () => {
  const disk = memory({ [KEY]: JSON.stringify({ a: entry(0) }) });
  const store = service(disk);
  let writes = 0;
  disk.beforeWrite = key => { if (key === BACKUP && ++writes === 2) throw error("QuotaExceededError"); };
  assert.equal(store.write("a", entry(1)).ok, true);
  const pending = store.inspect().pending;
  disk.values.set(BACKUP, JSON.stringify({ version: 1, slots: {}, pending }));
  assert.equal(store.inspect().recovery, "committed");
  assert.deepEqual(store.getRestoreInfo("a").entry, entry(0));
  disk.beforeWrite = null;
  assert.equal(store.write("a", entry(2)).ok, true);
  assert.deepEqual(store.getRestoreInfo("a").entry, entry(1));
  assert.equal(JSON.parse(disk.values.get(BACKUP)).codec, "dictionary-v1");
});

test("une vraie carrière est compressée sans perte et deux carrières tiennent dans 5MiB UTF16, journal compris", () => {
  const first = actualCareer();
  const second = actualCareer();
  second.meta.teamName = second.data.league.teams[1].name;
  second.data.userTeamId = second.data.league.teams[1].id;
  const entryChars = JSON.stringify(first).length;
  assert.ok(entryChars > 700000, "Le test doit garder le volume et la structure réels du jeu");
  const limit = 5 * 1024 * 1024;
  let peak = 0;
  const disk = memory();
  disk.beforeWrite = (key, raw) => {
    const candidate = new Map(disk.values); candidate.set(key, raw);
    const bytes = [...candidate].reduce((sum, [itemKey, value]) => sum + (itemKey.length + value.length) * 2, 0);
    if (bytes > limit) throw error("QuotaExceededError");
    peak = Math.max(peak, bytes);
  };
  const store = service(disk);
  assert.equal(store.write("a", first).ok, true);
  first.data.currentDay = 1;
  assert.equal(store.write("a", first).ok, true);
  const compactChars = disk.values.get(BACKUP).length;
  assert.ok(compactChars < entryChars * 0.6, "Le sidecar doit économiser plus de 40% sur une vraie carrière");
  assert.equal(store.write("b", second).ok, true);
  second.data.currentDay = 1;
  assert.equal(store.write("b", second).ok, true);
  const before = JSON.parse(JSON.stringify(first));
  first.data.currentDay = 2;
  assert.equal(store.write("a", first).ok, true, "Le journal temporaire de la 3e révision doit respecter le vrai quota UTF16");
  assert.deepEqual(store.getRestoreInfo("a").entry, before);
  assert.deepEqual(store.read().map.b, second);
  const info = store.getRestoreInfo("a");
  assert.equal(store.restore("a", { expectedToken: info.token }).ok, true);
  assert.deepEqual(store.read().map.a, before);
  assert.deepEqual(store.getRestoreInfo("a").entry, first);
  assert.ok(peak <= limit);
  assert.ok((JSON.stringify({ a: first, b: second }).length + entryChars * 3) * 2 > limit, "Le journal brut d’origine doit effectivement dépasser ce quota");
  console.log(`   vraie carrière ${entryChars} chars, sidecar ${compactChars} chars, pic ${peak}/${limit} octets UTF16`);
});

test("un codec corrompu, trop profond, mal indexé ou expansif est refusé sans écriture", () => {
  let deep = null;
  for (let i = 0; i < 100; i++) deep = [1, deep];
  const expansion = { codec: "dictionary-v1", strings: ["x".repeat(1000000)], value: [1, ...Array.from({ length: 20 }, () => [2, 0])] };
  const codecs = [
    { codec: "dictionary-v2", strings: [], value: [0] },
    { codec: "dictionary-v1", strings: {}, value: [0] },
    { codec: "dictionary-v1", strings: [7], value: [0] },
    { codec: "dictionary-v1", strings: [], value: [2, 0] },
    { codec: "dictionary-v1", strings: ["key"], value: [2, -1] },
    { codec: "dictionary-v1", strings: ["key"], value: [2, 0.5] },
    { codec: "dictionary-v1", strings: ["key"], value: [2, 0, "extra"] },
    { codec: "dictionary-v1", strings: ["key"], value: [0, 1, "value"] },
    { codec: "dictionary-v1", strings: ["key"], value: [0, 0] },
    { codec: "dictionary-v1", strings: ["key"], value: [0, 0, 1, 0, 2] },
    { codec: "dictionary-v1", strings: [], value: [7] },
    { codec: "dictionary-v1", strings: ["key"], shapes: {}, value: [0] },
    { codec: "dictionary-v1", strings: ["key"], shapes: [[1]], value: [0] },
    { codec: "dictionary-v1", strings: ["key", "key"], shapes: [[0, 1]], value: [0] },
    { codec: "dictionary-v1", strings: ["key"], shapes: [[0]], value: [3, 1, "value"] },
    { codec: "dictionary-v1", strings: ["key"], shapes: [[0]], value: [3, 0] },
    { codec: "dictionary-v1", strings: ["key"], shapes: [[0]], value: [3, 0, "value", "extra"] },
    { codec: "dictionary-v1", strings: [], value: { unexpected: "object" } },
    { codec: "dictionary-v1", strings: [], value: deep },
    expansion,
  ];
  for (const codec of codecs) {
    const raw = JSON.stringify(codec);
    const disk = memory({ [KEY]: JSON.stringify({ a: entry(0) }), [BACKUP]: raw });
    const original = new Map(disk.values);
    const store = service(disk);
    assert.equal(store.read().ok, true);
    assert.equal(store.inspect().code, "invalid-format");
    assert.equal(store.write("a", entry(1)).ok, false);
    assert.equal(store.remove("a").ok, false);
    assert.equal(store.restore("a", { expectedToken: "x" }).ok, false);
    assert.deepEqual(disk.values, original);
    assert.equal(disk.writes.length, 0);
  }
});

console.log(`${passed} tests de stockage réussis.`);
