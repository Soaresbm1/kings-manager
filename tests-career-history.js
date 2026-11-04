// Rapports compacts et indépendants : node tests-career-history.js
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const history = require("./career-history.js");
let passed = 0;
function test(label, run) { run(); passed++; console.log("OK " + label); }

function fixture(overrides = {}) {
  return {
    fixtureKey: "league:s2:r0:h:a", season: 2, round: 0, date: "1 Août An 2", competition: "Championnat", userTeamId: "h",
    homeTeam: { id: "h", name: "Club historique", players: [
      { id: "g", name: "Gardien", pos: "GK", photo: "data:image/png;base64," + "x".repeat(1000) },
      { id: "p", name: "Buteur initial", pos: "ATT", careerGoals: 99 },
      { id: "sub", name: "Remplaçant", pos: "MID" }, { id: "unused", name: "Banc inutilisé", pos: "DEF" }
    ] },
    awayTeam: { id: "a", name: "Adversaires", players: [{ id: "a1", name: "Joueur adverse", pos: "MID" }] },
    homeSetup: { formation: "1-2-2-2", formationOOP: "1-2-2-2", assignments: ["g", "sub", null],
      assignmentsOOP: ["g", "sub"], lineup: ["g", "sub"], playerRoles: { g: "keeper", p: "poacher", sub: "creator", unused: "stay_back" },
      attackPlan: "direct", defensePlan: "low", mentality: "balanced", positions: { p: { x: 20, y: 30 } } },
    awaySetup: { lineup: ["a1"] },
    result: {
      homeGoals: 2, awayGoals: 1, homeTeamId: "h", awayTeamId: "a",
      participants: { home: ["g", "p", "sub", "p"], away: ["a1"] },
      ratings: { g: 6.3, p: 8.1, sub: 6.8, a1: 6.5 }, minutesPlayed: { g: 36, p: 21, sub: 10, a1: 36 },
      playerStats: { p: { goals: 1, assists: 0 }, sub: { goals: 0, assists: 1 } },
      homeShots: 8, awayShots: 3, homePossession: 62, awayPossession: 38, homeXG: 1.73, awayXG: 0.61,
      homePassesAttempted: 82, homePassesCompleted: 64, homeSaves: 2, awaySaves: 1,
      events: [
        { type: "restart", minute: 1, text: "Engagement" },
        { type: "phase", minute: 2, text: "Construction de l’attaque" },
        { type: "goal", minute: 18, side: "home", scorerId: "p", assisterId: "sub", text: "Buteur initial marque : but double", score: { homeGoals: 2, awayGoals: 0 }, positionsAfter: { p: { x: 20, y: 2 } }, sequence: [{ type: "shot" }] },
        { type: "yellow", minute: 21, side: "away", playerId: "a1", text: "Carton jaune" },
        { type: "injury", minute: 24, side: "home", outId: "p", inId: "sub", text: "Blessure et remplacement" },
        { type: "phase", minute: 36, text: "MATCHBALL : but décisif" }
      ], beats: [{ type: "shot" }], positions: { p: { x: 10, y: 20 } }
    }, ...overrides
  };
}

test("les noms, participants, rôles et performances survivent aux renommages et transferts", () => {
  const input = fixture();
  const report = history.buildReport(input);
  const frozen = JSON.stringify(report);
  input.homeTeam.name = "Nouveau club";
  input.homeTeam.players[1].name = "Nom modifié";
  input.awayTeam.players.push(input.homeTeam.players.splice(1, 1)[0]);
  input.homeSetup.playerRoles.p = "target";
  input.homeSetup.lineup.push("unused");
  input.result.playerStats.p.goals = 15;
  input.result.participants.home.length = 0;
  input.result.events[2].text = "Texte modifié";
  assert.equal(JSON.stringify(report), frozen);
  assert.deepEqual(report.home.participantIds, ["g", "p", "sub"]);
  assert.equal(report.home.players.find(player => player.id === "p").role, "poacher");
  assert.equal(report.home.players.find(player => player.id === "p").name, "Buteur initial");
  assert.ok(!report.home.players.some(player => player.id === "unused"));
  assert.ok(!Object.hasOwn(report.home.setup.playerRoles, "unused"));
});

test("continuer deux fois conserve le premier rapport sans modifier les listes reçues", () => {
  const report = history.buildReport(fixture());
  const first = history.addReport([], report);
  const altered = history.buildReport(fixture()); altered.score.homeGoals = 42; altered.home.name = "Après renommage";
  const second = history.addReport(first, altered);
  assert.deepEqual(second, first);
  second[0].home.name = "Mutation extérieure";
  assert.equal(first[0].home.name, "Club historique");
  assert.equal(report.home.name, "Club historique");
  assert.deepEqual(history.normalizeReports([report, altered]), first);
});

test("la clé de secours est stable sans dépendre des noms ni du score", () => {
  const input = fixture({ fixtureKey: "" });
  const first = history.buildReport(input);
  input.homeTeam.name = "Renommé"; input.result.homeGoals = 5;
  assert.equal(history.buildReport(input).id, first.id);
  input.season++;
  assert.notEqual(history.buildReport(input).id, first.id);
  input.season--; input.competition = "Tournoi";
  assert.notEqual(history.buildReport(input).id, first.id);
});

test("les anciennes sauvegardes et les valeurs invalides restent honnêtes", () => {
  for (const value of [undefined, null, {}, "[]", 1, [null, false, {}, "ancien"]]) assert.deepEqual(history.normalizeReports(value), []);
  assert.equal(history.buildReport(), null);
  assert.equal(history.buildReport({ result: {} }), null);
  const report = history.buildReport({ result: { homeGoals: 0, awayGoals: 0, homeShots: NaN, homeXG: "1.2" },
    homeTeam: fixture().homeTeam, awayTeam: fixture().awayTeam, homeSetup: { lineup: ["p"] } });
  assert.equal(report.score.homeGoals, 0);
  assert.equal(report.statistics.home.shots, null);
  assert.equal(report.statistics.home.xG, null);
  assert.equal(report.home.players[0].rating, null);
  assert.equal(report.home.players[0].goals, null);
  assert.deepEqual(report.home.participantIds, []);
  assert.equal(report.home.participationSource, "unknown");
  assert.equal(history.normalizeReports([report])[0].statistics.home.possession, null);
});

test("l'absence de setup IA préserve les véritables participants et n'invente pas de composition", () => {
  const report = history.buildReport(fixture({ homeSetup: undefined, awaySetup: null }));
  assert.equal(report.home.setup.formation, "");
  assert.deepEqual(report.home.setup.lineup, []);
  assert.equal(report.home.participationSource, "engine");
  assert.equal(report.home.players.find(player => player.id === "p").rating, 8.1);
  assert.equal(report.home.players.find(player => player.id === "p").role, "");
});

test("les notes ou minutes anciennes identifient les participants seulement si elles existent", () => {
  const input = fixture(); delete input.result.participants;
  const report = history.buildReport(input);
  assert.equal(report.home.participationSource, "ratings");
  assert.deepEqual(report.home.participantIds, ["g", "p", "sub"]);
  delete input.result.ratings;
  input.result.minutesPlayed.unused = 0;
  const minutes = history.buildReport(input);
  assert.equal(minutes.home.participationSource, "minutes");
  assert.ok(!minutes.home.participantIds.includes("unused"));
});

test("les tirs au but, buts doubles et événements conservent le score réel sans recomptage", () => {
  const input = fixture(); input.result.homeGoals = 2; input.result.awayGoals = 2;
  input.result.penaltyWinner = "away";
  input.result.shootout = { homeScore: 3, awayScore: 4, homeWins: false, events: [{ type: "shootout", text: "déjà présent" }], sequence: [1, 2] };
  input.result.events.push({ type: "shootout", text: "Tir décisif" }, { type: "shootout miss", text: "Tir manqué" });
  const report = history.buildReport(input);
  assert.deepEqual(report.score, { homeGoals: 2, awayGoals: 2, penaltyWinner: "away", shootout: { homeScore: 3, awayScore: 4, homeWins: false } });
  assert.equal(report.home.players.find(player => player.id === "p").goals, 1);
  assert.deepEqual(report.events.map(event => event.type), ["goal", "yellow", "injury", "phase", "shootout", "shootout miss"]);
  assert.deepEqual(report.events[0].score, { homeGoals: 2, awayGoals: 0 });
  assert.equal(report.events[0].assisterId, "sub");
  assert.equal(report.events[2].outId, "p");
  assert.ok(!JSON.stringify(report).includes("déjà présent"), "ne duplique pas les événements déjà fusionnés par finalize");
});

test("les rapports excluent les images, objets de carrière et coordonnées même importés", () => {
  const report = history.buildReport(fixture());
  report.image = "data:image/png;base64,binary";
  report.home.players[0].careerGoals = 99;
  report.home.setup.positions = { p: { x: 1, y: 2 } };
  report.events[0].beats = [{ type: "shot" }];
  const serialized = JSON.stringify(history.normalizeReports([report]));
  for (const forbidden of ["positions", "sequence", "beats", "careerGoals", "data:image", '"photo"', '"image"']) assert.ok(!serialized.includes(forbidden), forbidden);
  assert.deepEqual(history.normalizeReports([report]), history.normalizeReports(history.normalizeReports([report])));
});

test("la borne garde les 200 plus récents et n'altère pas la source", () => {
  const reports = Array.from({ length: 215 }, (_, i) => history.buildReport(fixture({ fixtureKey: "fixture:" + i, round: i })));
  const bounded = history.normalizeReports(reports);
  assert.equal(bounded.length, history.MAX_REPORTS);
  assert.equal(bounded[0].fixtureKey, "fixture:15");
  assert.equal(bounded.at(-1).fixtureKey, "fixture:214");
  assert.equal(reports.length, 215);
  assert.deepEqual(history.addReport(bounded, bounded[0]), bounded);
});

test("les événements et le budget JSON bornent aussi les rapports anormalement volumineux", () => {
  const input = fixture(); input.result.events = Array.from({ length: 91 }, (_, i) => ({ type: "goal", minute: i, text: "g".repeat(5000) }));
  const report = history.buildReport(input);
  assert.equal(report.events.length, history.MAX_EVENTS);
  assert.equal(report.events[0].minute, 11);
  assert.equal(report.events[0].text.length, 300);
  assert.equal(report.eventsOmitted, 11);
  const reports = Array.from({ length: 200 }, (_, i) => ({ ...report, fixtureKey: "big:" + i }));
  const bounded = history.normalizeReports(reports);
  assert.ok(bounded.length > 0 && bounded.length < history.MAX_REPORTS);
  assert.ok(JSON.stringify(bounded).length <= history.MAX_STORAGE_CHARS);
  assert.equal(bounded.at(-1).fixtureKey, "big:199");
});

test("un résultat réel du moteur reste un rapport pur sans setups", () => {
  const context = vm.createContext({ console, Math });
  for (const file of ["data.js", "matchengine-actions.js", "engine.js"]) vm.runInContext(fs.readFileSync(path.join(__dirname, file), "utf8"), context, { filename: file });
  const data = vm.runInContext(`(() => {
    const [homeTeam, awayTeam] = JSON.parse(JSON.stringify(LEAGUES.germany.teams.slice(0, 2)));
    const setup = team => { const c = chooseAiFormation(team); return { formation: c.formation, lineup: c.assignments.filter(Boolean), assignments: c.assignments, attackPlan: "possession", defensePlan: "zone" }; };
    const result = simulateMatch(homeTeam, setup(homeTeam), awayTeam, setup(awayTeam));
    return JSON.stringify({homeTeam, awayTeam, result});
  })()`, context);
  const input = JSON.parse(data); const before = JSON.stringify(input);
  const report = history.buildReport({ ...input, season: 1, round: 0, competition: "Championnat" });
  assert.equal(JSON.stringify(input), before);
  assert.deepEqual(report.home.participantIds, input.result.participants.home);
  assert.equal(report.statistics.home.shotsOnTarget, input.result.homeShotsOnTarget);
  assert.equal(report.statistics.home.xG, input.result.homeXG);
  assert.equal(report.statistics.away.clearances, input.result.awayClearances);
  for (const player of report.home.players) assert.equal(player.rating, input.result.ratings[player.id] ?? null);
});

// Petit DOM de test : vérifie les interactions et les créations de texte sans navigateur.
class Element {
  constructor(doc, tag) { this.ownerDocument = doc; this.tagName = tag; this.children = []; this.attributes = {}; this.listeners = {}; this.className = ""; this._text = ""; this._value = undefined; this.classList = { add: value => { this.className += " " + value; } }; }
  set textContent(value) { this._text = String(value); this.children = []; }
  get textContent() { return this._text + this.children.map(child => child.textContent).join(""); }
  set innerHTML(_) { throw new Error("HTML brut interdit dans l'historique"); }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this._text = ""; this.children = children; }
  setAttribute(key, value) { this.attributes[key] = value; }
  addEventListener(type, callback) { this.listeners[type] = callback; }
  set value(value) { this._value = value; }
  get value() { return this._value ?? (this.tagName === "select" ? this.children[0]?.value || "" : ""); }
}
const doc = { createElement: tag => new Element(doc, tag) };
function descendants(element, tag) { return element.children.flatMap(child => [child.tagName === tag ? child : null, ...descendants(child, tag)]).filter(Boolean); }

test("le rendu est sûr et propose filtres saison/club, ouverture et rafraîchissement", () => {
  const input = fixture(); input.homeTeam.name = '<img src=x onerror="alert(1)">';
  const report = history.buildReport(input);
  const other = history.buildReport(fixture({ fixtureKey: "other", season: 1, userTeamId: "elsewhere" }));
  const container = doc.createElement("div"); let opened, trigger;
  const view = history.renderList(container, [other, report], { onOpen: (value, button) => { opened = value; trigger = button; } });
  assert.equal(descendants(container, "button").length, 2);
  assert.equal(descendants(container, "img").length, 0);
  assert.ok(container.textContent.includes("<img src=x"));
  const [season, club] = descendants(container, "select");
  season.value = "2"; season.listeners.change();
  assert.equal(descendants(container, "button").length, 1);
  const button = descendants(container, "button")[0]; button.listeners.click();
  assert.equal(opened.fixtureKey, report.fixtureKey); assert.equal(trigger, button);
  season.value = "all"; club.value = "mine"; club.listeners.change();
  assert.equal(descendants(container, "button").length, 1);
  view.refresh([other]);
  assert.equal(descendants(container, "button").length, 0);
  assert.ok(container.textContent.includes("Les anciens scores n’ont pas de rapport"));
  const body = doc.createElement("div"); history.renderReport(body, report);
  assert.ok(body.textContent.includes("Composition à la fin du match"));
  assert.ok(body.textContent.includes("Buteur initial"));
  assert.equal(descendants(body, "img").length, 0);
  assert.ok(descendants(body, "table").every(table => descendants(table, "caption").length === 1));
  history.renderReport(body, undefined); assert.ok(body.textContent.includes("pas disponible"));
});

test("les rapports figent les repères du règlement joué sans attribuer de format aux anciennes rencontres", () => {
  const Rules = require("./competition-rules.js");
  const snapshot = Rules.create("guide-2026-11-04", { competition: "league:france", season: 2 });
  const rules = { ...snapshot, label: Rules.summary(snapshot).label };
  const report = history.buildReport(fixture({ rules }));
  const retained = history.normalizeReports(JSON.parse(JSON.stringify([report])))[0];
  assert.equal(retained.rules.profileId, "guide-2026-11-04");
  assert.equal(retained.rules.config.totalMinutes, 36);
  assert.deepEqual(retained.rules.config.specialWindows, snapshot.config.specialWindows);
  rules.label = "Autre saison";
  assert.notEqual(retained.rules.label, rules.label);
  assert.equal(history.buildReport(fixture()).rules, undefined);
  assert.equal(history.normalizeReports([{ ...report, rules: { ...rules, config: { totalMinutes: Infinity } } }])[0].rules, undefined);
});

console.log(`${passed} tests d’historique réussis.`);
