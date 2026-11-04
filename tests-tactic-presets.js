// Données persistantes uniquement : node tests-tactic-presets.js.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const Presets = require("./tactic-presets.js");
let passed = 0, failed = 0;

function test(name, run) {
  try { run(); passed++; console.log("OK " + name); }
  catch (error) { failed++; console.error("FAIL " + name + ": " + error.stack); }
}

function setup() {
  return {
    formation: "1-2-2-2", assignments: ["gk", "def1", "def2", "mid1", "mid2", "att1", "att2"],
    formationOOP: "1-3-2-1", assignmentsOOP: ["ancien"], attackPlan: "possession", defensePlan: "zone",
    mentality: "balanced", playerRoles: { gk: "keeper", def1: "stay_back", mid1: "creator" },
    escalierOrder: ["att1", "mid1", "def1"], matchballOrder: ["def1", "mid1", "att1"]
  };
}

test("une ancienne carrière migre uniquement sa tactique habituelle", () => {
  const legacy = setup();
  const slots = Presets.normalizePresets(undefined, legacy);
  assert.deepEqual(slots.map(slot => [slot.id, slot.name]), [
    ["usual", "Habituel"], ["protect", "Protéger l’avance"], ["chase", "Revenir au score"]
  ]);
  assert.deepEqual(slots[0].tactic, Presets.capture(legacy));
  assert.equal(slots[1].tactic, null);
  assert.equal(slots[2].tactic, null);
  legacy.assignments[0] = "changé";
  assert.equal(slots[0].tactic.assignments[0], "gk");
});

test("trois identifiants fixes survivent aux doublons, inconnus et mauvais formats", () => {
  const slots = Presets.normalizePresets([
    { id: "chase", name: "  Offensive  ", tactic: setup() },
    { id: "usual", tactic: null }, { id: "usual", tactic: setup() },
    { id: "unknown", name: "Intrus", tactic: setup() }, null, "protect"
  ], setup());
  assert.deepEqual(slots.map(slot => slot.id), ["usual", "protect", "chase"]);
  assert.equal(slots[0].tactic, null, "ne ressuscite pas un emplacement volontairement vide depuis savedTactic");
  assert.equal(slots[1].tactic, null);
  assert.equal(slots[2].name, "Offensive");
  assert.equal(Presets.normalizePresets({ invalid: true }).length, 3);
  assert.equal(Presets.getPreset(slots, "unknown"), null);
});

test("capture exclut les secrets, transitoires et identités de match puis rétablit le miroir", () => {
  const source = Object.assign(setup(), {
    secretCard: { id: "penalty" }, opponentId: "rival", autoCoach: true, lineup: ["other"], persist: true,
    activeOverride: ["att1"], selectedSlot: 3, viewMode: "out", teamStyle: "pressing", stamina: { att1: 10 }
  });
  const captured = Presets.capture(source);
  assert.deepEqual(Object.keys(captured).sort(), ["formation", "assignments", "formationOOP", "assignmentsOOP", "attackPlan",
    "defensePlan", "mentality", "playerRoles", "escalierOrder", "matchballOrder"].sort());
  assert.equal(captured.formationOOP, source.formation);
  assert.deepEqual(captured.assignmentsOOP, source.assignments);
  assert.notEqual(captured.assignments, captured.assignmentsOOP);
  assert.equal(Presets.capture(null), null);
  assert.equal(Presets.capture([]), null);
  assert.equal(Presets.capture({ secretCard: "penalty" }), null);
});

test("les champs mal formés sont exclus et les index de placement restent intacts", () => {
  const captured = Presets.capture({
    formation: { toString: () => "1-2-2-2" }, assignments: ["gk", null, 4, { id: "x" }, "att1"],
    attackPlan: false, defensePlan: "zone", mentality: [], playerRoles: { gk: "keeper", att1: { name: "runner" } },
    escalierOrder: { 0: "att1", length: 1 }, matchballOrder: null
  });
  assert.deepEqual(captured, {
    assignments: ["gk", null, null, null, "att1"], assignmentsOOP: ["gk", null, null, null, "att1"],
    defensePlan: "zone", playerRoles: { gk: "keeper" }
  });
  assert.equal(Presets.capture({ formation: "future-formation", attackPlan: "future-plan" }).formation, "future-formation",
    "la validation métier reste dans app.js");
});

test("les ordres préparés gardent des identifiants uniques sans affecter la source", () => {
  const source = { escalierOrder: ["att1", "att1", null, "mid1", 0, {}, "def1", "mid1"],
    matchballOrder: ["def1", "__proto__", "att1", "constructor", "def1"] };
  const captured = Presets.capture(source);
  assert.deepEqual(captured.escalierOrder, ["att1", "mid1", "def1"]);
  assert.deepEqual(captured.matchballOrder, ["def1", "att1"]);
  assert.equal(source.escalierOrder.length, 8);
  assert.deepEqual(Presets.capture({ escalierOrder: [] }), { escalierOrder: [] });
});

test("enregistrer et lire créent des copies profondes indépendantes de tous les slots", () => {
  const source = setup();
  const empty = Presets.normalizePresets();
  const first = Presets.upsert(empty, "usual", source);
  const second = Presets.upsert(first, "protect", source);
  const third = Presets.upsert(second, "chase", source);
  const before = JSON.stringify(third);
  const loaded = Presets.getPreset(third, "protect");
  loaded.tactic.assignments[0] = "remplaçant";
  loaded.tactic.playerRoles.gk = "other";
  loaded.tactic.escalierOrder.reverse();
  source.matchballOrder.push("autre");
  first[0].tactic.assignments[1] = "changé";
  assert.equal(JSON.stringify(third), before);
  assert.equal(empty[0].tactic, null);
  assert.equal(first[1].tactic, null);
  third[0].tactic.assignments[0] = "autre";
  assert.equal(third[1].tactic.assignments[0], "gk");
  assert.equal(third[2].tactic.assignments[0], "gk");
});

test("renommer limite les noms, préserve les tactiques et accepte les libellés non latins", () => {
  const presets = Presets.upsert(Presets.normalizePresets(), "usual", setup());
  const renamed = Presets.upsert(presets, "usual", undefined, "  Plan\n spécial  ");
  assert.equal(renamed[0].name, "Plan spécial");
  assert.deepEqual(renamed[0].tactic, presets[0].tactic);
  assert.equal(presets[0].name, "Habituel");
  const long = Presets.upsert(renamed, "chase", setup(), "進".repeat(100));
  assert.equal(long[2].name, "進".repeat(40));
  assert.equal(Presets.upsert(long, "usual", undefined, "  ")[0].name, "Plan spécial");
  assert.equal(Presets.upsert(long, "usual", null)[0].tactic, null);
  assert.deepEqual(Presets.upsert(long, "__proto__", setup()), long);
});

test("les données importées ne propagent ni prototype, ni clé sensible, ni accesseur", () => {
  const source = JSON.parse('{"formation":"1-2-2-2","__proto__":{"polluted":true},"playerRoles":{"__proto__":"creator","constructor":"runner","prototype":"target","att1":"runner"},"assignments":["gk","__proto__"]}');
  let called = 0;
  Object.defineProperty(source, "secretCard", { get() { called++; throw new Error("secret consulté"); } });
  Object.defineProperty(source, "attackPlan", { get() { called++; throw new Error("accesseur consulté"); } });
  Object.defineProperty(source.playerRoles, "mid1", { enumerable: true, get() { called++; throw new Error("rôle consulté"); } });
  const captured = Presets.capture(source);
  assert.equal(called, 0);
  assert.deepEqual(captured.playerRoles, { att1: "runner" });
  assert.deepEqual(captured.assignments, ["gk", null]);
  assert.equal(Object.getPrototypeOf(captured), Object.prototype);
  assert.equal(Object.getPrototypeOf(captured.playerRoles), Object.prototype);
  assert.equal({}.polluted, undefined);
  const inherited = Object.create({ formation: "1-2-2-2", assignments: ["gk"] });
  assert.equal(Presets.capture(inherited), null);
  const slots = [{ id: "usual", tactic: source }];
  Object.defineProperty(slots, "1", { get() { called++; throw new Error("slot consulté"); } });
  assert.equal(Presets.normalizePresets(slots)[0].tactic.formation, "1-2-2-2");
  assert.equal(called, 0);
});

test("le même module se charge sans DOM ni dépendance dans le navigateur", () => {
  const context = vm.createContext({});
  vm.runInContext(fs.readFileSync(path.join(__dirname, "tactic-presets.js"), "utf8"), context);
  assert.equal(typeof context.TacticPresets.capture, "function");
  assert.deepEqual(Array.from(context.TacticPresets.normalizePresets(), slot => slot.id), ["usual", "protect", "chase"]);
  assert.doesNotThrow(() => context.TacticPresets.render(null, {}));
});

console.log(`${passed}/${passed + failed} régressions de tactiques réutilisables réussies`);
process.exitCode = failed ? 1 : 0;
