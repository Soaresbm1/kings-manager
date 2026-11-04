// Exécution : node tests-kings-preparation.js (également découvert par npm test).
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const preparation = require("./kings-preparation.js");
let passed = 0, failed = 0;

function test(name, run) {
  try { run(); passed++; console.log("OK " + name); }
  catch (error) { failed++; console.error("FAIL " + name + ": " + error.stack); }
}

function fixture() {
  const team = { players: [
    { id: "keeper", name: "Gardien", pos: "GK" },
    { id: "a", name: "Alice", pos: "DEF" },
    { id: "b", name: "Basile", pos: "DEF" },
    { id: "c", name: "Chloé", pos: "MID" },
    { id: "d", name: "David", pos: "MID" },
    { id: "e", name: "Emma", pos: "ATT" },
    { id: "f", name: "Farid", pos: "ATT" },
    { id: "bench", name: "Banc", pos: "MID" },
    { id: "keeper2", name: "Autre gardien", pos: "GK" }
  ] };
  const setup = { formation: "1-2-2-2", assignments: ["keeper", "a", "b", "c", "d", "e", "f"],
    assignmentsOOP: ["keeper", "f", "e", "d", "c", "b", "a"], lineup: ["keeper", "f", "a"], activeOverride: ["f"] };
  return { team, setup };
}

test("le groupe contient seulement les joueurs de champ du sept assigné", () => {
  const { team, setup } = fixture();
  assert.deepEqual(preparation.getPool(team, setup).map(player => player.id), ["a", "b", "c", "d", "e", "f"]);
  assert.deepEqual(preparation.getPool(team, { assignments: [] }), []);
  assert.deepEqual(preparation.getPool(team, { lineup: ["a", "b"] }), []);
});

test("blessés, gardiens, ids vendus et doublons sont exclus sans recruter le banc", () => {
  const { team, setup } = fixture();
  team.players.find(player => player.id === "b").injured = true;
  setup.assignments = ["keeper", "a", "a", "b", "sold", "keeper2", null];
  assert.deepEqual(preparation.getPool(team, setup).map(player => player.id), ["a"]);
  assert.deepEqual(preparation.getPool(null, setup), []);
  assert.deepEqual(preparation.getPool(team, null), []);
});

test("normaliser préserve le choix en match de null et [] sans activation implicite", () => {
  const pool = ["a", "b", "c"];
  assert.equal(preparation.normalizeOrder(null, pool), null);
  assert.equal(preparation.normalizeOrder(undefined, pool), null);
  assert.equal(preparation.normalizeOrder("a", pool), null);
  assert.deepEqual(preparation.normalizeOrder([], pool), []);
});

test("un ordre choisi devient unique et valide puis complète avec le sept actuel", () => {
  const order = Object.freeze(["c", "sold", "c", "a", "keeper", null]);
  const pool = Object.freeze(["a", "b", "b", "c", "d", null, ""]);
  assert.deepEqual(preparation.normalizeOrder(order, pool), ["c", "a", "b", "d"]);
  assert.deepEqual(preparation.normalizeOrder(["sold"], pool), ["a", "b", "c", "d"]);
  assert.deepEqual(preparation.normalizeOrder(["a"], []), []);
});

test("une ancienne carrière ne reçoit aucun champ de préparation au chargement", () => {
  const { team, setup } = fixture();
  const before = JSON.stringify(setup);
  assert.equal(preparation.normalizeSetupOrders(setup, team), setup);
  assert.equal(JSON.stringify(setup), before);
  setup.escalierOrder = null;
  setup.matchballOrder = [];
  const explicitBefore = JSON.stringify(setup);
  preparation.normalizeSetupOrders(setup, team);
  assert.equal(JSON.stringify(setup), explicitBefore);
});

test("seuls les ordres configurés changent après remplacement du sept ou blessure", () => {
  const { team, setup } = fixture();
  setup.escalierOrder = ["f", "a", "b", "c", "d", "e"];
  setup.matchballOrder = ["b", "a", "f", "e", "d", "c"];
  setup.assignments = ["keeper", "bench", "b", "c", "d", "e", "f"];
  team.players.find(player => player.id === "b").injured = true;
  const assignments = JSON.stringify([setup.assignments, setup.assignmentsOOP, setup.lineup, setup.activeOverride]);
  preparation.normalizeSetupOrders(setup, team);
  assert.deepEqual(setup.escalierOrder, ["f", "c", "d", "e", "bench"]);
  assert.deepEqual(setup.matchballOrder, ["f", "e", "d", "c", "bench"]);
  assert.equal(JSON.stringify([setup.assignments, setup.assignmentsOOP, setup.lineup, setup.activeOverride]), assignments);
});

test("un changement de formation conserve les priorités par identité du joueur", () => {
  const { team, setup } = fixture();
  setup.escalierOrder = ["c", "a", "b", "f", "e", "d"];
  setup.matchballOrder = null;
  const expected = [...setup.escalierOrder];
  setup.formation = "1-3-1-2";
  setup.assignments = ["keeper", "d", "b", "a", "e", "f", "c"];
  preparation.normalizeSetupOrders(setup, team);
  assert.deepEqual(setup.escalierOrder, expected);
  assert.equal(setup.matchballOrder, null);
});

test("les aperçus à 1, 2 et 3 joueurs prennent les premiers, gardien exclu", () => {
  const { team, setup } = fixture();
  const poolIds = preparation.getPool(team, setup).map(player => player.id);
  const order = ["f", "c", "a", "e", "b", "d"];
  assert.deepEqual(preparation.previewOrder(order, poolIds, 1), ["f"]);
  assert.deepEqual(preparation.previewOrder(order, poolIds, 2), ["f", "c"]);
  assert.deepEqual(preparation.previewOrder(order, poolIds, 3), ["f", "c", "a"]);
  assert.deepEqual(preparation.previewOrder(["keeper", "sold", "f"], poolIds, 3), ["f", "a", "b"]);
  assert.deepEqual(preparation.previewOrder(order, poolIds, -1), []);
  assert.deepEqual(preparation.previewOrder(order, poolIds, NaN), []);
  assert.deepEqual(preparation.previewOrder(null, poolIds, 3), []);
  assert.deepEqual(preparation.previewOrder([], poolIds, 3), []);
});

test("les aperçus sont compatibles avec applyOrderToCap pour les deux phases", () => {
  const source = fs.readFileSync(path.join(__dirname, "app.js"), "utf8");
  const definition = source.match(/function applyOrderToCap\(order, poolIds, cap\)\s*\{[\s\S]*?\n\}/);
  assert.ok(definition, "fonction de réduction du moteur d’interface présente");
  const applyOrderToCap = vm.runInNewContext("(" + definition[0] + ")");
  const poolIds = ["a", "b", "c", "d", "e", "f"];
  for (const order of [["f", "b", "d", "a", "c", "e"], ["e", "c", "a", "f", "d", "b"]]) {
    const normalized = preparation.normalizeOrder(order, poolIds);
    for (const cap of [1, 2, 3, 6]) {
      assert.deepEqual(preparation.previewOrder(order, poolIds, cap), Array.from(applyOrderToCap(normalized, poolIds, cap)));
    }
  }
});

test("les indisponibilités temporaires filtrent seulement les aperçus, pas l’ordre préparé", () => {
  const order = Object.freeze(["b", "a", "c", "d"]);
  const unavailable = Object.freeze([
    Object.freeze({ playerId: "b", reason: "yellow" }),
    Object.freeze({ playerId: "c", reason: "red" })
  ]);
  assert.deepEqual(preparation.previewOrder(order, ["a", "b", "c", "d"], 2, unavailable), ["a", "d"]);
  assert.deepEqual(preparation.previewOrder(order, ["a", "b", "c", "d"], 2, []), ["b", "a"]);
  assert.deepEqual(order, ["b", "a", "c", "d"]);
});

test("ouvrir la préparation live conserve la priorité du jaune et annote les exclus", () => {
  // Petit DOM de lecture : ce test exécute le vrai rendu et observe ses textes,
  // sans navigateur ni dépendance ajoutée au runner des suites pures.
  const doc = { activeElement: null };
  const makeNode = tagName => {
    const attributes = new Map();
    const node = { tagName, ownerDocument: doc, children: [], ownText: "", className: "", open: false,
      append(...children) { this.children.push(...children); },
      replaceChildren(...children) { this.children = children; },
      setAttribute(name, value) { attributes.set(name, String(value)); },
      getAttribute(name) { return attributes.get(name) ?? null; },
      addEventListener() {}, contains() { return false; },
      querySelectorAll() { return []; },
      classList: { add() {} },
      get textContent() { return this.ownText + this.children.map(child => child.textContent).join(" "); },
      set textContent(value) { this.ownText = String(value); this.children = []; }
    };
    return node;
  };
  doc.createElement = makeNode;
  const container = makeNode("div");
  const { team, setup } = fixture();
  setup.escalierOrder = ["b", "a", "c", "d", "e", "f"];
  setup.matchballOrder = ["c", "b", "a", "f", "e", "d"];
  const before = JSON.stringify([team, setup]);
  const unavailable = Object.freeze([
    Object.freeze({ playerId: "b", reason: "yellow", until: 10 }),
    Object.freeze({ playerId: "c", reason: "red", until: 12 })
  ]);
  preparation.render(container, { team, setup, live: true, unavailable });
  assert.equal(JSON.stringify([team, setup]), before, "ouvrir le panneau ne doit pas dégrader les priorités");
  assert.match(container.textContent, /Exclu temporairement/);
  assert.match(container.textContent, /Expulsé/);
  assert.match(container.textContent, /au prochain changement de format/);
  const visit = node => [node, ...node.children.flatMap(visit)];
  const previewNames = visit(container).filter(node => node.className === "kings-prep-preview-names");
  assert.equal(previewNames.length, 6);
  assert.ok(previewNames.every(node => !node.textContent.includes("Basile") && !node.textContent.includes("Chloé")));
  preparation.render(container, { team, setup, live: true, unavailable: [] });
  assert.equal(JSON.stringify([team, setup]), before);
  const afterReturn = visit(container).filter(node => node.className === "kings-prep-preview-names");
  assert.equal(afterReturn[0].textContent, "Basile", "le jaune retrouve sa priorité originale après expiration");
});

test("normalisations idempotentes, indépendantes et sans hasard", () => {
  const { team, setup } = fixture();
  const before = JSON.stringify([team, setup]);
  const random = Math.random;
  Math.random = () => { throw new Error("aucun tirage aléatoire autorisé"); };
  try {
    const first = preparation.normalizeOrder(["c", "a", "a"], ["a", "b", "c"]);
    const second = preparation.normalizeOrder(first, ["a", "b", "c"]);
    assert.deepEqual(second, first);
    assert.notEqual(first, second);
    const pool = preparation.getPool(team, setup);
    pool.pop();
    assert.equal(preparation.getPool(team, setup).length, 6);
    assert.equal(JSON.stringify([team, setup]), before);
  } finally { Math.random = random; }
});

test("le même module est disponible dans un navigateur sans CommonJS ni DOM", () => {
  const context = vm.createContext({});
  vm.runInContext(fs.readFileSync(path.join(__dirname, "kings-preparation.js"), "utf8"), context);
  assert.equal(typeof context.KingsPreparation.normalizeOrder, "function");
  assert.equal(typeof context.KingsPreparation.render, "function");
  assert.deepEqual(Array.from(context.KingsPreparation.normalizeOrder(["b"], ["a", "b"])), ["b", "a"]);
});

console.log(`${passed}/${passed + failed} tests de préparation réussis.`);
process.exitCode = failed ? 1 : 0;
