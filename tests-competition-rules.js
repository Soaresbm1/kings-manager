"use strict";
// La migration doit être neutre jusque dans le nombre de tirages du moteur 1.5.
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const Rules = require("./competition-rules.js");
const clone = value => JSON.parse(JSON.stringify(value));
const legacy = Rules.create(Rules.LEGACY_ID, { competition: "france", season: 3 });
const guide = Rules.create(Rules.GUIDE_ID, { competition: "international", season: 3 });

assert.equal(Rules.normalize(null, { competition: "spain", season: 8 }).profileId, Rules.LEGACY_ID);
assert.equal(Rules.normalize(null, { competition: "spain", season: 8 }).season, 8);
assert.equal(Rules.normalize({ schema: 999, profileId: Rules.GUIDE_ID }).profileId, Rules.LEGACY_ID);
assert.equal(Rules.create("__proto__").profileId, Rules.LEGACY_ID);
assert.equal(Rules.create({ toString: {} }).profileId, Rules.LEGACY_ID);
assert.equal(Rules.normalize({ ...clone(guide), profileId: { toString: {} } }).profileId, Rules.LEGACY_ID);
assert.equal(Rules.normalize({ ...clone(guide), revision: 99 }).profileId, Rules.LEGACY_ID);
assert.deepEqual(Rules.normalize(clone(guide)), guide);
assert.equal(legacy.competition, "france");
assert.equal(guide.competition, "international");
assert.equal(legacy.config.totalMinutes, 40);
assert.equal(guide.config.totalMinutes, 36);
assert.equal(Rules.summary(guide).checkedAt, "2026-11-04");
assert.equal(Rules.summary(guide).status, "adaptation");
assert.equal(Rules.summary(legacy).sourceUrl, "");
assert.ok(Object.isFrozen(guide.config.specialWindows[0]));
assert.throws(() => { guide.config.totalMinutes = 99; }, TypeError);
assert.throws(() => { guide.config.specialWindows[0][0] = 0; }, TypeError);
assert.equal(Rules.normalize(guide, { season: 4 }).season, 4);
assert.equal(guide.season, 3, "préparer une saison ne modifie jamais la copie de la précédente");
const imported = clone(guide);
imported.config.cardDuration = 3;
assert.equal(Rules.normalize(imported).config.cardDuration, 3, "une copie valide reste épinglée, indépendante du catalogue");
assert.equal(Rules.summary(imported).status, "game-format", "une copie modifiée ne revendique pas la provenance officielle");
assert.equal(Rules.summary(imported).sourceUrl, "");
console.log("OK règlements : migration historique, contexte indépendant, source datée et copie immuable");

for (const invalid of [
  { halfTime: 0 }, { totalMinutes: Infinity }, { diceEndMinute: 120 },
  { escalierEndMinute: 17 }, { specialWindows: [[5, 17], [16, 35]] },
  { specialWindows: [[5, 17], [23, 200]] }, { cardDuration: 100 },
  { presidentDeadline: 36 }, { starDeadline: 100 }, { yellowDuration: "2" }
]) {
  const bad = { ...clone(guide), config: { ...clone(guide.config), ...invalid } };
  assert.equal(Rules.validConfig(bad.config), false);
  assert.equal(Rules.normalize(bad).profileId, Rules.LEGACY_ID);
}
assert.equal(Rules.normalize({ ...clone(guide), competition: "<script>", season: -1 }).competition, "championship");
assert.equal(Rules.normalize({ ...clone(guide), season: -1 }).season, 1);
console.log("OK règlements : sauvegardes malformées et valeurs extrêmes rejetées");

function team(id, style) {
  return { id, name: id, playStyle: style, players: [
    ["g", "GK"], ["d1", "DEF"], ["d2", "DEF"], ["d3", "DEF"],
    ["m1", "MID"], ["m2", "MID"], ["m3", "MID"], ["a1", "ATT"], ["a2", "ATT"]
  ].map(([key, pos], i) => ({ id: id + key, pos, name: key, speed: 70 + i, technique: 78 - i,
    physical: 75 + i % 3, mental: 76 + i % 4, overall: 76, form: 80, age: 25,
    matches: 0, goals: 0, assists: 0, ratingSum: 0 })) };
}
function setup(club) {
  const ids = ["g", "d1", "d2", "m1", "m2", "a1", "a2"].map(id => club.id + id);
  return { formation: "1-2-2-2", assignments: ids, lineup: ids, attackPlan: "possession", defensePlan: "zone" };
}
function fixture(initial, moduleLoaded = true) {
  let state = initial, draws = 0;
  const math = Object.create(Math);
  math.random = () => { draws++; return ((state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 4294967296); };
  const context = vm.createContext({ Math: math });
  for (const name of ["data.js", ...(moduleLoaded ? ["competition-rules.js"] : []), "matchengine-actions.js", "engine.js"]) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, name), "utf8"), context, { filename: name });
  }
  return { context, draws: () => draws, state: () => state };
}
// Empreintes du moteur 1.5 bcac200, obtenues AVANT le paramétrage. Elles couvrent
// résultats, commentaires, statistiques, blessures, forme et tirages suivants.
const baselines = [
  [7, 3033, 4029184562, "51c387198f8cace767c1d4d9cf447650b06f22db355ee9bf70e8f9bc69f98ba0"],
  [42, 2995, 2084694027, "1924bd1a801bc470890fe79243655489e044aa8266f64b99a937f493b27e4be9"],
  [13579, 2953, 1934713302, "cd84981c884f7d5243737beb91a620693baa6c92ae2a66ce83d23c90ece95ce8"]
];
for (const [initial, draws, state, digest] of baselines) {
  for (const mode of ["standalone", "default", "explicit", "migration"]) {
    const f = fixture(initial, mode !== "standalone");
    const home = team("h", "wide"), away = team("a", "compact");
    const selected = mode === "explicit" ? legacy : mode === "migration" ? Rules.normalize(null) : undefined;
    const result = f.context.simulateAIMatch(home, away, selected);
    const actual = crypto.createHash("sha256").update(JSON.stringify({ result, home, away })).digest("hex");
    assert.equal(actual, digest, `ancienne simulation changée : graine ${initial}, mode ${mode}`);
    assert.equal(f.draws(), draws);
    assert.equal(f.state(), state);
  }
}
console.log("OK moteur : 12 simulations strictement identiques aux empreintes 1.5, hasard compris");

for (const selected of [legacy, guide]) {
  const f = fixture(42);
  const home = team("h", "wide"), away = team("a", "compact");
  const before = f.draws();
  const engine = f.context.createMatchEngine(home, setup(home), away, setup(away), selected);
  assert.equal(f.draws(), before, "épingler un règlement ne tire aucun nombre aléatoire");
  assert.equal(engine.totalMinutes, selected.config.totalMinutes);
  assert.equal(engine.halfTime, selected.config.halfTime);
  for (let minute = 0; minute <= 45; minute++) {
    for (const kind of ["card", "president"]) {
      assert.equal(engine.isSpecialActionWindowOpen(minute, kind), Rules.isSpecialWindow(selected, minute, kind),
        `${selected.profileId}, ${kind}, minute ${minute}`);
    }
  }
  assert.deepEqual([0, 1, 2, 3, 4, 5].map(minute => engine.getOutfieldCap(minute)), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual([36, 37, 38, 39, 40, 41].map(minute => engine.getOutfieldCap(minute)), [5, 4, 3, 2, 1, 1]);
  const immutable = JSON.stringify(selected);
  engine.simulateMinute(17);
  assert.equal(JSON.stringify(selected), immutable);
}
assert.equal(Rules.isSpecialWindow(guide, 17, "card"), false);
assert.equal(Rules.isSpecialWindow(guide, 23, "card"), false);
assert.equal(Rules.isSpecialWindow(guide, 36, "card"), false);
assert.equal(Rules.isSpecialWindow(legacy, 17, "card"), true);
assert.equal(Rules.isSpecialWindow(legacy, 23, "card"), true);
assert.equal(Rules.isSpecialWindow(legacy, 36, "card"), true);
console.log("OK moteur : fenêtres adaptées et historiques, escalier, Matchball et snapshots préservés");

{
  const imported = clone(guide);
  Object.assign(imported.config, { totalMinutes: 30, halfTime: 15, escalierEndMinute: 4,
    doubleGoalStartMinute: 12, diceStartMinute: 16, diceEndMinute: 18, matchballStartMinute: 26,
    specialWindows: [[4, 11], [19, 25]], presidentDeadline: 25, cardDuration: 3,
    starDeadline: 28, yellowDuration: 1, redDuration: 4 });
  const saved = Rules.normalize(imported);
  const f = fixture(7);
  const home = team("h", "wide"), away = team("a", "compact");
  const engine = f.context.createMatchEngine(home, setup(home), away, setup(away), saved);
  f.context.planChainCount = () => 0;
  assert.equal(engine.halfTime, 15);
  assert.equal(engine.totalMinutes, 30);
  assert.equal(engine.getOutfieldCap(4), 6);
  assert.equal(engine.getOutfieldCap(26), 5);
  assert.equal(engine.getOutfieldCap(30), 1);
  assert.ok(engine.simulateMinute(12).some(event => event.type === "phase" && /Tous les buts comptent double/.test(event.text)));
  assert.ok(engine.simulateMinute(16).some(event => event.type === "phase" && /jusqu'à la 18e minute/.test(event.text)));
  assert.equal(engine.activateCard("home", "doubleGoal", {}, 18).length, 0);
  assert.ok(engine.activateCard("home", "doubleGoal", {}, 19).some(event => /Pendant 3 minutes/.test(event.text)));
  assert.ok(engine.activateCard("away", "starPlayer", { player: away.players[7] }, 19).some(event => /28e minute/.test(event.text)));
  assert.equal(Rules.summary(saved).sourceUrl, "");
}
console.log("OK moteur : repères, fenêtres et durées lus dans la copie enregistrée plutôt que dans le catalogue");
