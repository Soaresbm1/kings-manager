// Rapport adverse indépendant du moteur et du navigateur : node tests-opponent-report.js
const assert = require("node:assert/strict");
const reportApi = require("./opponent-report.js");
let passed = 0;
function test(label, run) { run(); passed++; console.log("OK " + label); }
function player(id, pos, overall, extra = {}) {
  return { id, name: id, pos, overall, goals: 0, matches: 0, injured: false, suspended: false, ...extra };
}
function fixture() {
  const team = { id: "human", name: "Votre club", players: [
    player("gk", "GK", 70), player("def", "DEF", 60), player("mid", "MID", 80), player("att", "ATT", 75)
  ] };
  const opponent = { id: "rival", name: "Club adverse", players: [
    player("R Gardien", "GK", 80), player("R Défenseur", "DEF", 70),
    player("R Milieu", "MID", 60), player("R Buteur", "ATT", 90, { goals: 8, matches: 4 })
  ] };
  const others = Array.from({ length: 8 }, (_, i) => ({ id: "club" + i, name: "Club " + i, players: [] }));
  return { team, opponent, league: { name: "Ligue de la carrière", teams: [team, opponent, ...others], results: [] } };
}
function result(round, options = {}) {
  return { round, home: "rival", away: "club" + round, played: true, homeGoals: 2, awayGoals: 1, ...options };
}

test("les cinq derniers matchs réellement joués sont triés sans inclure les fixtures futures ni d’autres clubs", () => {
  const input = fixture();
  input.league.results = [result(2), result(6), result(0), result(5), result(4), result(1), result(3),
    result(12, { played: false, homeGoals: 90 }),
    result(10, { home: "human", away: "club0", homeGoals: 99 }),
    result(11, { homeGoals: null })];
  const report = reportApi.build(input);
  assert.deepEqual(report.recentResults.map(row => row.round), [6, 5, 4, 3, 2]);
  assert.deepEqual(report.recentResults.map(row => row.opponent.name), ["Club 6", "Club 5", "Club 4", "Club 3", "Club 2"]);
  assert.deepEqual(report.form, { played: 5, wins: 5, losses: 0, unknown: 0, goalsFor: 10, goalsAgainst: 5 });
  assert.ok(report.limitations.some(line => /score exploitable/.test(line)));
});

test("buts pour/contre et domicile/extérieur suivent le point de vue de l’adversaire", () => {
  const input = fixture();
  input.league.results = [result(0, { homeGoals: 4, awayGoals: 1 }),
    result(1, { home: "club1", away: "rival", homeGoals: 3, awayGoals: 2 })];
  const report = reportApi.build(input);
  assert.deepEqual(report.recentResults.map(row => [row.venue, row.goalsFor, row.goalsAgainst, row.outcome]),
    [["away", 2, 3, "L"], ["home", 4, 1, "W"]]);
  assert.equal(report.form.goalsFor, 6); assert.equal(report.form.goalsAgainst, 4);
});

test("les égalités Kings distinguent victoire/défaite aux tirs au but sans ajouter de buts de séance", () => {
  const input = fixture();
  input.league.results = [result(0, { homeGoals: 2, awayGoals: 2, penaltyWinner: "home", shootout: { homeScore: 7, awayScore: 6 } }),
    result(1, { home: "club1", away: "rival", homeGoals: 3, awayGoals: 3, penaltyWinner: "home" }),
    result(2, { homeGoals: 1, awayGoals: 1 })];
  const report = reportApi.build(input);
  assert.deepEqual(report.recentResults.map(row => [row.outcome, row.decidedByPenalties]), [[null, false], ["L", true], ["W", true]]);
  assert.deepEqual(report.form, { played: 3, wins: 1, losses: 1, unknown: 1, goalsFor: 6, goalsAgainst: 6 });
  assert.ok(!report.recentResults.some(row => row.outcome === "D"));
  assert.ok(report.limitations.some(line => /issue reste inconnue/.test(line)));
  assert.ok(report.summary.includes("1 issue inconnue"));
});

test("une mauvaise ligue n’emprunte jamais les résultats de la ligue humaine", () => {
  const input = fixture();
  input.league.teams = input.league.teams.filter(team => team.id !== "rival");
  input.league.results = [result(0, { homeGoals: 10 })];
  const missing = reportApi.build(input);
  assert.equal(missing.leagueAvailable, false); assert.deepEqual(missing.recentResults, []);
  assert.ok(missing.limitations.some(line => /n’est pas identifié/.test(line)));
  const foreignLeague = { name: "Autre ligue de carrière", teams: [input.opponent, { id: "foreign", name: "Club étranger" }],
    results: [result(3, { away: "foreign", homeGoals: 5, awayGoals: 2 })] };
  const foreign = reportApi.build({ ...input, league: foreignLeague });
  assert.equal(foreign.recentResults[0].opponent.name, "Club étranger");
  assert.equal(foreign.leagueName, "Autre ligue de carrière");
  assert.equal(foreign.form.goalsFor, 5);
});

test("avant tout match, aucune forme ni statistique fictive n’est reconstruite", () => {
  const input = fixture();
  input.opponent.players.forEach(player => { player.goals = 0; player.matches = 0; player.careerGoals = 99; });
  input.league.results = [result(0, { played: false })];
  const report = reportApi.build(input);
  assert.deepEqual(report.recentResults, []); assert.deepEqual(report.scorers, []);
  assert.ok(report.summary.includes("Forme récente indisponible"));
  assert.ok(report.limitations.some(line => /Aucun résultat/.test(line)));
});

test("les buteurs utilisent les buts de saison avec leurs matchs, jamais les cumuls de carrière", () => {
  const input = fixture();
  input.opponent.players.push(player("Autre buteur", "MID", 77, { goals: 10, matches: 6, careerGoals: 1000 }),
    player("Buteur transféré", "ATT", 77, { goals: 9, matches: 5 }),
    player("Carrière seulement", "ATT", 77, { careerGoals: 3000 }),
    player("Quatrième", "DEF", 77, { goals: 1, matches: 6 }));
  const report = reportApi.build(input);
  assert.deepEqual(report.scorers.map(row => [row.name, row.goals, row.matches]),
    [["Autre buteur", 10, 6], ["Buteur transféré", 9, 5], ["R Buteur", 8, 4]]);
});

test("la disponibilité suit les drapeaux du jeu, une durée périmée ne crée aucune blessure", () => {
  const input = fixture();
  input.opponent.players = [
    player("Blessé", "ATT", 99, { injured: true, injuryDaysLeft: 4 }),
    player("Sans durée", "MID", 88, { injured: true }),
    player("Suspendu", "DEF", 99, { suspended: true, suspensionMatches: 12 }),
    player("Les deux", "GK", 99, { suspended: true, injured: true, injuryDaysLeft: 0 }),
    player("Rétabli", "DEF", 60, { injuryDaysLeft: 20 }), player("Apte", "DEF", 80)
  ];
  const report = reportApi.build(input);
  assert.deepEqual(report.absences.map(row => [row.name, row.injured, row.suspended, row.injuryDaysLeft]),
    [["Blessé", true, false, 4], ["Sans durée", true, false, null], ["Suspendu", false, true, null], ["Les deux", true, true, null]]);
  const def = report.positions.find(row => row.pos === "DEF");
  assert.deepEqual(def.opponent, { total: 3, available: 2, rated: 2, average: 70 });
  assert.equal(report.positions.find(row => row.pos === "GK").opponent.average, null);
  assert.equal(report.positions.find(row => row.pos === "ATT").opponent.available, 0);
});

test("la comparaison utilise l’overall des joueurs disponibles de chaque poste des deux équipes", () => {
  const input = fixture();
  input.team.players.push(player("Défenseur absent", "DEF", 99, { suspended: true }), player("Défenseur apte", "DEF", 65));
  input.opponent.players.push(player("Défenseur adverse", "DEF", 71));
  const report = reportApi.build(input);
  assert.deepEqual(report.positions.map(row => row.pos), ["GK", "DEF", "MID", "ATT"]);
  const def = report.positions[1];
  assert.deepEqual(def.team, { total: 3, available: 2, rated: 2, average: 62.5 });
  assert.deepEqual(def.opponent, { total: 2, available: 2, rated: 2, average: 70.5 });
  assert.equal(def.delta, 8);
});

test("les statistiques manquantes restent inconnues sans note ni match zéro inventé", () => {
  const input = fixture();
  input.opponent.players = [player("Note absente", "DEF", undefined, { goals: 2, matches: undefined }),
    player("Note texte", "DEF", "99", { goals: undefined }), player("Note valide", "DEF", 70),
    player("Note invalide", "ATT", Infinity, { goals: NaN, matches: "12" })];
  const report = reportApi.build(input);
  assert.equal(report.scorers[0].matches, null);
  assert.equal(report.missingScorerStats, 3);
  assert.deepEqual(report.positions[1].opponent, { total: 3, available: 3, rated: 1, average: 70 });
  assert.equal(report.positions[3].opponent.average, null);
  assert.ok(report.limitations.some(line => /notes du jeu renseignées/.test(line)));
  assert.equal(reportApi.build(), null);
  assert.equal(reportApi.build({ opponent: null }), null);
});

test("un effectif absent reste inconnu et un club sans fiche conserve son identifiant de résultat", () => {
  const input = fixture(); delete input.team.players; delete input.opponent.players;
  input.league.results = [result(0, { away: "club-sans-fiche" })];
  const report = reportApi.build(input);
  assert.equal(report.teamRosterAvailable, false); assert.equal(report.opponentRosterAvailable, false);
  assert.equal(report.positions[0].team.available, null); assert.equal(report.positions[0].opponent.available, null);
  assert.equal(report.recentResults[0].opponent.id, "club-sans-fiche");
  assert.equal(report.recentResults[0].opponent.name, "Club non renseigné");
  assert.ok(report.summary.includes("Disponibilité non renseignée"));
  assert.ok(!report.summary.includes("0 joueurs indisponibles"));
});

function freeze(value) {
  if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
test("build ne tire aucun hasard, ne modifie aucune donnée et produit un snapshot détaché", () => {
  const input = fixture(); input.league.results.push(result(0));
  const before = JSON.stringify(input);
  const rng = Math.random;
  Math.random = () => { throw new Error("Le rapport ne doit pas simuler de match"); };
  let report;
  try { report = reportApi.build(freeze(input)); } finally { Math.random = rng; }
  assert.equal(JSON.stringify(input), before);
  assert.deepEqual(report, reportApi.build(input));
  report.recentResults[0].opponent.name = "Mutation externe";
  report.scorers[0].name = "Autre nom";
  report.positions[0].opponent.average = 0;
  assert.equal(JSON.stringify(input), before);
});

// DOM volontairement minimal : tout recours à innerHTML échoue, même pour un nom hostile.
class Element {
  constructor(doc, tag) { this.ownerDocument = doc; this.tagName = tag; this.children = []; this.className = ""; this.value = ""; }
  set textContent(value) { this.value = String(value); this.children = []; }
  get textContent() { return this.value + this.children.map(child => child.textContent).join(" "); }
  set innerHTML(value) { throw new Error("Le rapport doit construire le DOM avec textContent"); }
  appendChild(child) { this.children.push(child); return child; }
  replaceChildren(...children) { this.value = ""; this.children = children; }
}
function documentFixture() { const doc = { createElement(tag) { return new Element(doc, tag); } }; return doc; }
function descendants(element, predicate) {
  return element.children.flatMap(child => [ ...(predicate(child) ? [child] : []), ...descendants(child, predicate) ]);
}
function byClass(element, className) { return descendants(element, child => child.className.split(" ").includes(className)); }

test("rendu repliable, noms longs/hostiles intacts, disponibilité précise et tableaux accessibles", () => {
  const input = fixture();
  const longName = "<img src=x onerror=alert(1)>" + "NomTrèsLong".repeat(70);
  input.opponent.name = longName;
  input.opponent.players[3].name = longName;
  input.opponent.players[3].injured = true;
  input.opponent.players[3].injuryDaysLeft = 3;
  input.opponent.players[0].suspended = true;
  input.opponent.players[0].suspensionMatches = 15;
  input.league.results = [result(0, { homeGoals: 2, awayGoals: 2, penaltyWinner: "away" })];
  const report = reportApi.build(input), snapshot = JSON.stringify(report);
  const doc = documentFixture(), container = doc.createElement("div");
  const details = reportApi.render(container, report);
  assert.equal(details.tagName, "details"); assert.ok(!details.open);
  assert.ok(container.textContent.includes("Rapport sur l’adversaire"));
  assert.ok(container.textContent.includes(longName));
  assert.equal(descendants(container, element => element.tagName === "img").length, 0);
  assert.equal(byClass(container, "scout-result").length, 1);
  assert.ok(container.textContent.includes("aux tirs au but"));
  assert.ok(container.textContent.includes("3 jours restants dans le jeu"));
  assert.ok(container.textContent.includes("Suspendu · durée non renseignée"));
  assert.ok(!container.textContent.includes("15 matchs"));
  assert.ok(container.textContent.includes("ne prédit pas la composition adverse"));
  const table = descendants(container, element => element.tagName === "table")[0];
  assert.equal(descendants(table, element => element.tagName === "caption").length, 1);
  assert.equal(descendants(table, element => element.scope === "row").length, 4);
  assert.equal(JSON.stringify(report), snapshot);
  reportApi.render(container, report);
  assert.equal(byClass(container, "scout-report").length, 1);
  reportApi.render(container, null);
  assert.ok(container.textContent.includes("n’est pas disponible"));
  assert.equal(reportApi.render(null, report), null);
});

test("le rendu des données partielles n’annonce ni zéro but ni zéro match pour un joueur sans statistiques", () => {
  const input = fixture(); input.opponent.players = [player("Stats partielles", "ATT", 70, { goals: 2, matches: undefined })];
  const doc = documentFixture(), container = doc.createElement("div");
  reportApi.render(container, reportApi.build(input));
  assert.ok(container.textContent.includes("2 buts · matchs non renseignés"));
  delete input.opponent.players[0].goals;
  reportApi.render(container, reportApi.build(input));
  assert.ok(container.textContent.includes("Statistiques de buts non disponibles ou incomplètes"));
  assert.ok(!container.textContent.includes("Aucun but enregistré"));
  delete input.team.players; delete input.opponent.players;
  reportApi.render(container, reportApi.build(input));
  assert.ok(container.textContent.includes("Effectif non renseigné"));
});

console.log(`${passed} tests du rapport adverse réussis.`);
