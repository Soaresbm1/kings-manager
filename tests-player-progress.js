const assert = require("node:assert/strict");
const Progress = require("./player-progress.js");
let passed = 0;
const test = (name, run) => { run(); passed++; console.log("OK " + name); };
const player = (id = "one", extra = {}) => ({ id, name: "Un joueur", overall: 70, speed: 65, technique: 75, physical: 70, mental: 70, form: 80, value: 1000, careerMatches: 0, ...extra });
const observe = (ledger, players, day = 0, round = 0, season = 1) => Progress.observe(ledger, { players, day, round, season });
test("les carrières anciennes ne reçoivent aucun passé inventé", () => {
  assert.deepEqual(Progress.normalize(null).players, []);
  const ledger = observe(null, [player()]);
  assert.equal(ledger.players[0].samples.length, 1);
  assert.equal(Progress.series(ledger, "one").delta, null);
});
test("les relevés conservent les attributs, forme, valeur et matchs réellement observés", () => {
  let ledger = observe(null, [player()]);
  ledger = observe(ledger, [player("one", { overall: 72, form: 75, value: 1200, careerMatches: 1 })], 7, 1);
  assert.equal(Progress.series(ledger, "one").delta, 2);
  assert.equal(Progress.series(ledger, "one", "form").delta, -5);
  assert.equal(Progress.series(ledger, "one", "value").delta, 200);
  assert.equal(Progress.series(ledger, "one", "careerMatches").delta, 1);
});
test("les écritures répétées d'une même étape remplacent le dernier relevé", () => {
  let ledger = observe(null, [player()]);
  for (let i = 0; i < 20; i++) ledger = observe(ledger, [player("one", { form: 60 + i })]);
  assert.equal(ledger.players[0].samples.length, 1);
  assert.equal(Progress.series(ledger, "one", "form").points[0].value, 79);
});
test("le changement de saison ne mélange pas les dates ni la progression", () => {
  let ledger = observe(null, [player()], 300, 10);
  ledger = observe(ledger, [player("one", { overall: 71 })], 0, 0, 2);
  const points = Progress.series(ledger, "one").points;
  assert.deepEqual(points.map(p => p.season), [1, 2]);
});
test("les entrées et joueurs reçus ne sont pas modifiés, sans aucun hasard", () => {
  const players = [player()], ledger = observe(null, players), before = JSON.stringify({ players, ledger }), random = Math.random;
  Math.random = () => { throw new Error("Aucun hasard"); };
  try { observe(ledger, players, 1); Progress.series(ledger, "one"); } finally { Math.random = random; }
  assert.equal(JSON.stringify({ players, ledger }), before);
});
test("l'import/export JSON conserve exactement les relevés valides", () => {
  const ledger = observe(observe(null, [player()]), [player()], 1, 1);
  assert.deepEqual(Progress.normalize(JSON.parse(JSON.stringify(ledger))), ledger);
});
test("les valeurs manquantes ou malformées deviennent inconnues, jamais zéro", () => {
  const ledger = observe(null, [player("one", { overall: "70", form: NaN, value: -2 })]);
  assert.equal(Progress.series(ledger, "one").points[0].value, null);
  assert.equal(Progress.series(ledger, "one", "form").points[0].value, null);
  assert.equal(Progress.series(ledger, "one", "value").points[0].value, null);
  assert.deepEqual(Progress.series(ledger, "absent").points, []);
});
test("les identités réservées, noms longs et caractères Unicode restent du texte", () => {
  const ledger = observe(null, [player("__proto__", { name: "王👑<img>".repeat(100) })]);
  assert.equal(ledger.players[0].id, "__proto__");
  assert(ledger.players[0].name.length <= 120);
  assert.equal({}.polluted, undefined);
});
test("les dates invalides et relevés tronqués ne créent pas d'observations", () => {
  assert.equal(observe(null, [player()], -1).players.length, 0);
  assert.equal(Progress.normalize({ players: [{ id: "one", samples: [[], [-1, 0, 0], [1, Infinity, 0]] }] }).players.length, 0);
});
test("les longues carrières restent sous le budget et indiquent les relevés retirés", () => {
  const players = Array.from({ length: 18 }, (_, i) => player("p" + i));
  let ledger = null;
  for (let day = 0; day < 150; day++) ledger = observe(ledger, players.map((p, i) => ({ ...p, form: (day + i) % 60 + 40, value: day * 100 + i })), day, day);
  assert(JSON.stringify(ledger).length <= Progress.MAX_CHARS);
  assert(ledger.players.every(p => p.samples.length <= Progress.MAX_SAMPLES));
  assert(ledger.omitted > 0);
  assert.equal(Progress.series(ledger, "p0").points.at(-1).day, 149);
});
test("le budget résiste à de nombreux joueurs, grands nombres et métadonnées", () => {
  const raw = { players: Array.from({ length: 500 }, (_, i) => ({ id: "player" + i, name: "名".repeat(500), samples: Array.from({ length: 100 }, (_, day) => [1, day, day, 99, 99, 99, 99, 99, 99, 999999999999, 999999999999]) })) };
  const ledger = Progress.normalize(raw);
  assert(ledger.players.length <= Progress.MAX_PLAYERS);
  assert(JSON.stringify(ledger).length <= Progress.MAX_CHARS);
});
console.log(`${passed} tests de progression réussis.`);
