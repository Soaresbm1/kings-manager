const assert = require("node:assert/strict");
const Advisor = require("./recruitment-advisor.js");
let passed = 0;
const test = (name, run) => { run(); passed++; console.log("OK " + name); };
const player = (id, pos = "MID", extra = {}) => ({ id, name: id, pos, overall: 70, speed: 70, technique: 70, physical: 70, mental: 70, value: 100, ...extra });
const team = { id: "own", budget: 1000, players: [player("g", "GK"), player("d", "DEF"), player("m", "MID"), player("a", "ATT")] };
const slots = ["GK", "DEF", "MID", "ATT"].map(pos => ({ pos }));
const opponents = [player("cg", "GK"), player("cd", "DEF"), player("cm", "MID"), player("ca", "ATT"), ...Array.from({ length: 5 }, (_, i) => player("spare" + i))];
const input = extra => ({ team, leagueKey: "fr", setup: { assignments: ["g", "d", "m", "a"] }, slots,
  leagues: [{ key: "fr", name: "France", teams: [team, { id: "other", name: "Autre", players: opponents }] }], ...extra });

test("trois pistes diversifient les besoins sans toucher aux effectifs ni consommer de hasard", () => {
  const value = input(), before = JSON.stringify(value), original = Math.random;
  Math.random = () => { throw new Error("Pas de hasard pour le conseil"); };
  try {
    const report = Advisor.build(value);
    assert.equal(report.candidates.length, 3);
    assert.equal(new Set(report.candidates.map(p => p.pos)).size, 3);
    assert.equal(JSON.stringify(value), before);
    assert.deepEqual(Advisor.build(value), report);
  } finally { Math.random = original; }
});
test("la formation détermine les manques et les doublures naturelles", () => {
  const report = Advisor.build(input({ slots: [{ pos: "GK" }, { pos: "DEF" }, { pos: "DEF" }, { pos: "MID" }] }));
  const defense = report.needs.find(n => n.pos === "DEF");
  assert.equal(defense.missing, 1);
  assert.equal(report.priority, "DEF");
  assert.equal(report.needs.find(n => n.pos === "ATT").required, 0);
});
test("un filtre explicite ne propose que le poste demandé", () => {
  const report = Advisor.build(input({ focus: "ATT" }));
  assert.equal(report.candidates.length, 1);
  assert.equal(report.candidates[0].id, "ca");
  assert.equal(report.candidates[0].remaining, 900);
  assert.equal(report.candidates[0].comparisonId, "a");
});
test("le profil du rôle départage les cibles sans inventer un bonus moteur", () => {
  const fast = player("fast", "ATT", { speed: 95, technique: 70, physical: 70 });
  const slow = player("slow", "ATT", { speed: 40, technique: 70, physical: 70 });
  const value = input({ focus: "ATT", setup: { assignments: ["g", "d", "m", "a"], playerRoles: { a: "runner" } } });
  value.leagues = [{ key: "es", name: "Espagne", teams: [{ id: "outside", players: [slow, fast, ...opponents] }] }];
  assert.equal(Advisor.build(value).candidates[0].id, "fast");
  assert.equal(Advisor.build(value).candidates[0].role, "Profondeur");
});
test("blessés, suspendus, prix inconnus, hors budget et clubs trop courts sont exclus", () => {
  const bad = [player("injury", "MID", { injured: true }), player("ban", "MID", { suspended: true }),
    player("expensive", "MID", { value: 1001 }), player("unknown", "MID", { value: "100" }), player("bad", "MID", { overall: Infinity })];
  const value = input({ focus: "MID" });
  value.leagues = [{ key: "fr", teams: [{ id: "short", players: opponents.slice(0, 7) }, { id: "bad", players: [...bad, ...Array.from({ length: 3 }, (_, i) => player("x" + i, "ATT"))] }] }];
  assert.deepEqual(Advisor.build(value).candidates, []);
});
test("un budget nul, absent ou malformé ne crée pas de pistes abordables fictives", () => {
  for (const budget of [0, undefined, -1, Infinity, "1000", 1e30]) assert.equal(Advisor.build(input({ team: { ...team, budget } })).candidates.length, 0);
});
test("les joueurs du club et identités dupliquées ne réapparaissent pas comme recrues", () => {
  const value = input(); value.leagues.push({ key: "other", teams: [{ id: "copy", players: [team.players[0], ...opponents, opponents[0]] }] });
  const report = Advisor.build(value);
  assert(!report.candidates.some(p => p.id === "g"));
  assert.equal(new Set(report.candidates.map(p => p.id)).size, report.candidates.length);
});
test("les rôles incompatibles et les attributs inconnus restent des données honnêtes", () => {
  const value = input({ focus: "ATT", setup: { assignments: ["g", "d", "m", "a"], playerRoles: { a: "keeper" } } });
  assert.equal(Advisor.build(value).candidates[0].role, "Profondeur");
  assert.equal(Advisor.profile(player("x", "ATT", { speed: "99" }), "runner").score, null);
  assert.equal(Advisor.profile(player("x"), "__proto__").label, "Relayeur");
});
test("données vides et textes hostiles restent lisibles sans mutation", () => {
  assert.deepEqual(Advisor.build().candidates, []);
  const value = input({ focus: "ATT" });
  value.leagues[0].teams[1] = { ...value.leagues[0].teams[1], name: "<img src=x>", players: opponents.map(p => ({ ...p, name: "王👑".repeat(200) })) };
  const report = Advisor.build(value);
  assert(report.candidates[0].name.length <= 160);
  assert.equal(report.candidates[0].clubName, "<img src=x>");
});
console.log(`${passed} tests de recrutement réussis.`);
