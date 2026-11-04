const assert = require("node:assert/strict");
const Bench = require("./bench-advisor.js");
let passed = 0;
const test = (name, run) => { run(); passed++; console.log("OK " + name); };
const p = (id, pos, energy, extra = {}) => ({ id, name: id, pos, energy, overall: 70, ...extra });
const input = () => ({ observation: { minute: 15, assignments: ["g", "d", "m", "a"], activeIds: ["g", "d", "m", "a"], unavailable: [],
  players: [p("g", "GK", 95), p("d", "DEF", 60), p("m", "MID", 68), p("a", "ATT", 85), p("bd", "DEF", 99), p("bm", "MID", 98)] },
  assignments: ["g", "d", "m", "a"], slots: ["GK", "DEF", "MID", "ATT"].map(pos => ({ pos })) });
test("les alertes et deux propositions utilisent uniquement les énergies observées", () => {
  const result = Bench.build(input());
  assert.deepEqual(result.alerts.map(p => p.id), ["d", "m"]);
  assert.equal(result.suggestions.length, 2);
  assert.deepEqual(result.suggestions.map(p => [p.outId, p.inId]), [["d", "bd"], ["m", "bm"]]);
  assert.equal(result.minute, 15);
});
test("les gardiens ne remplacent pas un joueur de champ", () => {
  const value = input(); value.observation.players = [p("d", "DEF", 50), p("bg", "GK", 100)];
  assert.deepEqual(Bench.build(value).suggestions, []);
  value.observation.players[1].pos = "__proto__";
  assert.deepEqual(Bench.build(value).suggestions, []);
});
test("blessures, suspensions et exclusions ne deviennent pas des remplacements illégaux", () => {
  for (const reason of ["injury", "suspended", "yellow", "red"]) {
    const value = input(); value.observation.unavailable = [{ playerId: "bd", reason }, { playerId: "bm", reason }];
    assert.deepEqual(Bench.build(value).suggestions, []);
  }
  const value = input(); value.observation.unavailable = [{ playerId: "d", reason: "red" }, { playerId: "m", reason: "yellow" }];
  assert.equal(Bench.build(value).alerts.length, 0);
});
test("un joueur sélectionné mais hors format Kings n'est pas utilisé comme remplaçant", () => {
  const value = input(); value.assignments.push("bd", "bm"); value.observation.activeIds = ["g", "d"];
  assert.equal(Bench.build(value).suggestions.length, 0);
});
test("un gain d'énergie trop faible ou inconnu ne déclenche pas de conseil", () => {
  const value = input(); value.observation.players = [p("d", "DEF", 60), p("bd", "DEF", 65), p("unknown", "MID", "100")];
  assert.equal(Bench.build(value).suggestions.length, 0);
  value.observation.players[0].energy = NaN;
  assert.equal(Bench.build(value).alerts.length, 0);
});
test("les postes de dépannage sont signalés et les choix restent déterministes", () => {
  const value = input(); value.observation.players = [p("d", "DEF", 60), p("bm", "MID", 99)];
  assert.equal(Bench.build(value).suggestions[0].natural, false);
  assert.deepEqual(Bench.build(value), Bench.build(value));
});
test("un changement de composition et un match terminé sont explicitement pris en compte", () => {
  const value = input(); value.assignments[1] = "bd";
  assert.equal(Bench.build(value).changed, true);
  assert(!Bench.build(value).suggestions.some(p => p.outId === "d"));
  assert.deepEqual(Bench.build({ ...input(), finished: true }).suggestions, []);
});
test("aucun état reçu ni hasard n'est touché, les observations absentes restent vides", () => {
  const value = input(), before = JSON.stringify(value), random = Math.random;
  Math.random = () => { throw new Error("Pas de hasard"); };
  try { Bench.build(value); } finally { Math.random = random; }
  assert.equal(JSON.stringify(value), before);
  assert.deepEqual(Bench.build().players, []);
});
console.log(`${passed} tests du banc réussis.`);
