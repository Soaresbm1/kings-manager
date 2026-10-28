// Invariants des déplacements liés entre les deux dispositions tactiques.
// Sans navigateur : node tests-tactics-drag.js.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function createTactics() {
  const context = vm.createContext({ document: { addEventListener() {} } });
  for (const file of ["data.js", "player-photos.js", "matchengine-actions.js", "engine.js", "matchchoreo.js", "app.js"]) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, file), "utf8"), context, { filename: file });
  }
  vm.runInContext(`
    STATE.userTeamId = "drag-test";
    STATE.league = { teams: [{ id: "drag-test", players: [
      {id:"g",pos:"GK"}, {id:"g2",pos:"GK"},
      {id:"d1",pos:"DEF"}, {id:"d2",pos:"DEF"},
      {id:"m1",pos:"MID"}, {id:"m2",pos:"MID"},
      {id:"a1",pos:"ATT"}, {id:"a2",pos:"ATT"},
      {id:"b",pos:"MID"}, {id:"injured",pos:"MID",injured:true}
    ] }] };
  `, context);
  return {
    formations: vm.runInContext("Object.keys(FORMATION_SLOTS)", context),
    plan(setup, id, index, phase) {
      context.dropSetup = setup;
      context.dropId = id;
      context.dropIndex = index;
      context.dropPhase = phase;
      return vm.runInContext("planTacticDrop(dropSetup, dropId, dropIndex, dropPhase)", context);
    }
  };
}

function setup(formation, formationOOP) {
  return {
    formation, formationOOP,
    assignments: ["g", "d1", "d2", "m1", "m2", "a1", "a2"],
    // Des indices différents empêchent qu'un échange par numéro de case passe.
    assignmentsOOP: ["g", "a1", "d2", "m2", "d1", "a2", "m1"]
  };
}

function ids(array) { return [...array].filter(Boolean).sort(); }
function native(array) { return Array.from(array); }
function invariant(plan, expectedIds) {
  assert.equal(plan.valid, true);
  for (const array of [plan.assignments, plan.assignmentsOOP]) {
    assert.equal(array.length, 7);
    assert.equal(new Set(array.filter(Boolean)).size, array.filter(Boolean).length);
    assert.deepEqual(ids(array), expectedIds);
    assert.ok(["g", "g2"].includes(array[0]), "le gardien reste au but");
    assert.ok(array.slice(1).every(id => !["g", "g2"].includes(id)));
  }
}

let passed = 0;
function test(name, body) {
  body();
  passed++;
  console.log("OK " + name);
}

const tactics = createTactics();
const phases = ["in", "out"];
const ownKey = phase => phase === "out" ? "assignmentsOOP" : "assignments";

test("les permutations suivent les identités dans les neuf paires de formations", () => {
  for (const first of tactics.formations) for (const second of tactics.formations) for (const phase of phases) {
    for (let source = 1; source < 7; source++) for (let target = source + 1; target < 7; target++) {
      const original = setup(first, second);
      const snapshot = JSON.stringify(original);
      const sourceId = original[ownKey(phase)][source];
      const targetId = original[ownKey(phase)][target];
      const plan = tactics.plan(original, sourceId, target, phase);
      invariant(plan, ids(original.assignments));
      const exchanged = array => array.map(id => id === sourceId ? targetId : id === targetId ? sourceId : id);
      assert.deepEqual(native(plan.assignments), exchanged(original.assignments));
      assert.deepEqual(native(plan.assignmentsOOP), exchanged(original.assignmentsOOP));
      assert.equal(JSON.stringify(original), snapshot, "préparer le dépôt ne modifie jamais la tactique");
    }
  }
});

test("un remplaçant déloge la même identité dans les deux phases", () => {
  for (const first of tactics.formations) for (const second of tactics.formations) for (const phase of phases) {
    for (let target = 0; target < 7; target++) {
      const original = setup(first, second);
      const replacement = target === 0 ? "g2" : "b";
      const displaced = original[ownKey(phase)][target];
      const plan = tactics.plan(original, replacement, target, phase);
      const replace = array => array.map(id => id === displaced ? replacement : id);
      invariant(plan, ids(replace(original.assignments)));
      assert.deepEqual(native(plan.assignments), replace(original.assignments));
      assert.deepEqual(native(plan.assignmentsOOP), replace(original.assignmentsOOP));
    }
  }
});

test("déplacer un titulaire vers une case vide conserve les mêmes six joueurs", () => {
  for (const first of tactics.formations) for (const second of tactics.formations) for (const phase of phases) {
    for (let target = 1; target < 7; target++) for (let source = 1; source < 7; source++) {
      if (source === target) continue;
      const original = setup(first, second);
      const removed = original[ownKey(phase)][target];
      original.assignments = original.assignments.map(id => id === removed ? null : id);
      original.assignmentsOOP = original.assignmentsOOP.map(id => id === removed ? null : id);
      const moving = original[ownKey(phase)][source];
      const plan = tactics.plan(original, moving, target, phase);
      invariant(plan, ids(original.assignments));
      assert.equal(plan[ownKey(phase)][target], moving);
      assert.equal(plan[ownKey(phase)][source], null);
    }
  }
});

test("compléter une case vide depuis le banc ajoute exactement un joueur dans les deux phases", () => {
  for (const first of tactics.formations) for (const second of tactics.formations) for (const phase of phases) {
    for (let target = 0; target < 7; target++) {
      const original = setup(first, second);
      const removed = original[ownKey(phase)][target];
      original.assignments = original.assignments.map(id => id === removed ? null : id);
      original.assignmentsOOP = original.assignmentsOOP.map(id => id === removed ? null : id);
      const replacement = target === 0 ? "g2" : "b";
      const plan = tactics.plan(original, replacement, target, phase);
      invariant(plan, [...ids(original.assignments), replacement].sort());
      assert.equal(plan[ownKey(phase)][target], replacement);
    }
  }
});

test("les dépôts invalides sont rejetés sans mutation partielle", () => {
  for (const phase of phases) {
    for (const [id, index, requestedPhase] of [
      ["g", 1, phase], ["g2", 4, phase], ["d1", 0, phase],
      ["missing", 1, phase], ["injured", 1, phase], ["b", -1, phase],
      ["b", 7, phase], ["b", 1.5, phase], ["b", NaN, phase], ["b", 1, "invalid"]
    ]) {
      const original = setup("1-2-2-2", "1-3-2-1");
      const snapshot = JSON.stringify(original);
      assert.equal(tactics.plan(original, id, index, requestedPhase).valid, false);
      assert.equal(JSON.stringify(original), snapshot);
    }
  }
});

console.log(`${passed} groupes d’invariants tactiques validés.`);
