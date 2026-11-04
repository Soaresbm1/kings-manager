// node tests-tactical-debrief.js — contrats purs, vrais relevés du moteur et chronologie.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const debrief = require("./tactical-debrief.js");
let passed = 0;
function test(label, run) { run(); passed++; console.log("OK " + label); }
function stats(shots, xG, awayShots = 0, awayXG = 0) {
  return {
    home: { shots, shotsOnTarget: shots, xG, passesAttempted: shots * 3, passesCompleted: shots * 2, interceptions: 0, tackles: 0, stamina: 98 },
    away: { shots: awayShots, shotsOnTarget: awayShots, xG: awayXG, passesAttempted: awayShots * 3, passesCompleted: awayShots * 2, interceptions: 0, tackles: 0, stamina: 97 },
    possessionHome: 60
  };
}
function point(capture, minute, shots, xG, homeGoals = 0, awayGoals = 0) {
  return debrief.recordSample(capture, { minute, stats: stats(shots, xG), score: { homeGoals, awayGoals } });
}

test("les captures sont pures, scalaires et indépendantes du setup vivant", () => {
  const input = { formation: "1-2-2-2", attackPlan: "direct", assignments: ["p", null], playerRoles: { p: "creator" },
    positions: { p: { x: 20, y: 30 } }, photo: "data:image/png;base64," + "x".repeat(10000), sequence: [{ type: "shot" }] };
  const capture = debrief.create({ side: "home", setup: input });
  const frozen = JSON.stringify(capture);
  const live = stats(1, .37);
  const next = debrief.recordSample(capture, { minute: 1, stats: live, score: { homeGoals: 0, awayGoals: 0 } });
  input.playerRoles.p = "target"; live.home.xG = 99;
  assert.equal(JSON.stringify(capture), frozen);
  assert.equal(next.samples[0].stats.home.xG, .37);
  assert.equal(capture.initialSetup.playerRoles.p, "creator");
  assert.equal(JSON.stringify(capture).includes("positions"), false);
  assert.equal(JSON.stringify(capture).includes("base64"), false);
  assert.deepEqual(capture.initialSetup.assignments, ["p", null]);
});

test("l'ordre humain et événements à minute identique est l'ordre enregistré", () => {
  let capture = point(debrief.create(), 17, 0, 0);
  capture = debrief.recordEvent(capture, { minute: 17, type: "phase", text: "Tous les buts comptent double jusqu'à la mi-temps !" });
  capture = debrief.recordDecision(capture, { minute: 17, kind: "mentality", text: "Passage en offensive", setup: { mentality: "attacking" } });
  capture = debrief.recordEvent(capture, { minute: 17, type: "goal", text: "But double", side: "home", score: { homeGoals: 2, awayGoals: 0 } });
  capture = point(capture, 17, 1, .31, 2);
  const snapshot = debrief.build({ capture, result: { homeGoals: 2, awayGoals: 0, homeXG: .31, homeShots: 1 } });
  assert.deepEqual(debrief.read(snapshot).timeline.map(event => event.kind), ["format", "mentality", "goal"]);
  assert.equal(debrief.read(snapshot).timeline[1].source, "human");
  assert.equal(debrief.read(snapshot).timeline[0].source, "event");
  assert.equal(snapshot.samples.length, 2);
  const interval = debrief.delta(snapshot.samples[0], snapshot.samples[1]);
  assert.equal(interval.stats.home.goals, 2);
  assert.equal(interval.stats.home.shots, 1);
  assert.equal(interval.stats.home.xG, .31);
});

test("une vraie shape getLiveStats est collectée sans finaliser ni tirer de hasard", () => {
  let calls = 0, seed = 13;
  const math = Object.create(Math);
  math.random = () => { calls++; return ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296); };
  const context = vm.createContext({ Math: math });
  for (const file of ["data.js", "matchengine-actions.js", "engine.js"]) vm.runInContext(fs.readFileSync(path.join(__dirname, file), "utf8"), context, { filename: file });
  const [home, away] = vm.runInContext("JSON.parse(JSON.stringify(LEAGUES.france.teams.slice(0, 2)))", context);
  const setup = team => { const choice = context.chooseAiFormation(team); return { formation: choice.formation, assignments: choice.assignments, lineup: choice.assignments.filter(Boolean), attackPlan: "direct", defensePlan: "zone" }; };
  const engine = context.createMatchEngine(home, setup(home), away, setup(away));
  let capture = debrief.create({ side: "away" });
  const baseline = calls;
  capture = debrief.recordSample(capture, { minute: 0, stats: engine.getLiveStats(), score: engine.getScore() });
  assert.equal(calls, baseline);
  engine.simulateMinute(1);
  const beforeRead = calls, live = engine.getLiveStats();
  capture = debrief.recordSample(capture, { minute: 1, stats: live, score: engine.getScore() });
  const read = debrief.read(capture);
  assert.equal(calls, beforeRead);
  assert.equal(read.hasTemporalStats, true);
  assert.equal(capture.samples[1].stats.home.xG, live.home.xG);
  assert.equal(capture.samples[1].stats.away.shots, live.away.shots);
  assert.equal(capture.samples[1].score.homeGoals, engine.getScore().homeGoals);
});

test("les deltas avant/après sont exacts et bornés aux relevés disponibles", () => {
  let capture = debrief.create();
  for (let minute = 0; minute <= 10; minute++) capture = point(capture, minute, minute, minute * .11);
  capture = debrief.recordDecision(capture, { minute: 10, text: "Pressing haut", setup: { defensePlan: "high" } });
  capture = point(capture, 10, 10, 1.1);
  for (let minute = 11; minute <= 17; minute++) capture = point(capture, minute, minute, minute * .11);
  const frozen = JSON.stringify(capture);
  const comparison = debrief.read(capture).comparisons[0];
  assert.deepEqual([comparison.before.from, comparison.before.to], [5, 10]);
  assert.deepEqual([comparison.after.from, comparison.after.to], [10, 15]);
  assert.equal(comparison.before.stats.home.shots, 5);
  assert.equal(comparison.after.stats.home.xG, .55);
  assert.equal(JSON.stringify(capture), frozen);
});

test("les phases proviennent des annonces réelles et les bornes sont des vrais points", () => {
  let capture = point(debrief.create(), 16, 2, .45);
  capture = debrief.recordEvent(capture, { minute: 17, type: "phase", text: "Un ballon d'une autre couleur entre en jeu ! Tous les buts comptent double." });
  capture = point(capture, 17, 3, .8, 2);
  capture = point(capture, 20, 6, 1.4, 4);
  capture = debrief.recordEvent(capture, { minute: 21, type: "phase", text: "LE DÉ GÉANT tombe sur 2 ! 2 joueurs de champ et un gardien par équipe (3v3)." });
  capture = point(capture, 21, 7, 1.6, 4);
  const phases = debrief.read(capture).phases;
  assert.equal(phases.length, 3);
  assert.equal(phases[0].observed, null);
  assert.equal(phases[1].observed.from, 16);
  assert.equal(phases[1].observed.to, 20);
  assert.equal(phases[1].observed.stats.home.xG, .95);
  assert.equal(phases[1].observed.stats.home.goals, 4);
  assert.equal(phases[2].observed.stats.home.shots, 1);
});

test("tous les moments importants sont gardés, les possessions et géométries sont exclues", () => {
  const events = [
    { type: "phase", minute: 1, text: "Construction de l’attaque" },
    { type: "phase cardevent", minute: 6, text: "Équipe active la Carte But Double !", sequence: [{ x: 1 }] },
    { type: "yellow", minute: 7, playerId: "p", text: "Jaune" },
    { type: "red", minute: 8, text: "Rouge" }, { type: "injury", minute: 9, text: "Blessure" },
    { type: "phase", minute: 10, text: "Un président actionne le buzzer pour tirer lui-même le penalty !" },
    { type: "save", minute: 10, text: "Penalty du Président arrêté" },
    { type: "phase", minute: 11, inId: "q", outId: "p", text: "Remplacement" },
    { type: "phase", minute: 23, text: "Retour au format complet (7v7) !" },
    { type: "phase", minute: 36, text: "MATCHBALL !" },
    { type: "shootout miss", text: "Tir manqué" },
    { type: "pass", minute: 5, text: "Une passe", positionsAfter: { p: { x: 1, y: 2 } } }
  ];
  const snapshot = debrief.build({ result: { homeGoals: 0, awayGoals: 0, events } });
  assert.deepEqual(snapshot.events.map(event => event.kind), ["card", "yellow", "red", "injury", "president", "penalty", "substitution", "format", "format", "shootout"]);
  assert.equal(snapshot.events.at(-1).minute, null);
  assert.equal(JSON.stringify(snapshot).includes("sequence"), false);
  assert.equal(JSON.stringify(snapshot).includes("positionsAfter"), false);
});

test("le résultat final complète les événements sans dupliquer les événements capturés", () => {
  const goal = { type: "goal", minute: 9, text: "Un but", side: "home", score: { homeGoals: 1, awayGoals: 0 } };
  const card = { type: "phase", minute: 5, text: "La Carte But Double est activée !" };
  let capture = debrief.recordEvent(debrief.create(), { ...card, type: "phase cardevent" });
  capture = debrief.recordEvent(capture, goal);
  const snapshot = debrief.build({ capture, result: { homeGoals: 1, awayGoals: 0, events: [card, goal, { type: "shootout", text: "But en séance" }] } });
  assert.equal(snapshot.events.length, 3);
  assert.deepEqual(debrief.normalize(snapshot), snapshot);
});

test("les tirs au but sans minute dans result ne sont pas dupliqués après horodatage live", () => {
  const shootout = { type: "shootout", text: "Tir n°1 — Le joueur marque !" };
  const capture = debrief.recordEvent(debrief.create(), { ...shootout, minute: 36 });
  const snapshot = debrief.build({ capture, result: { homeGoals: 1, awayGoals: 1, events: [shootout] } });
  assert.equal(snapshot.events.length, 1);
  assert.equal(snapshot.events[0].minute, 36);
});

test("les données manquantes ne sont ni zéro ni interpolées depuis les totaux", () => {
  for (const value of [undefined, null, {}, [], { version: 0 }]) {
    assert.equal(debrief.normalize(value), null);
    assert.equal(debrief.read(value).hasTemporalStats, false);
  }
  const snapshot = debrief.build({ result: { homeGoals: 2, awayGoals: 0, homeXG: 2.34, homeShots: 9 } });
  assert.equal(snapshot.samples.length, 0);
  assert.equal(snapshot.totals.home.xG, 2.34);
  assert.equal(debrief.read(snapshot).hasTemporalStats, false);
  let capture = debrief.recordSample(debrief.create(), { minute: 0, stats: { home: { shots: 0 } } });
  capture = debrief.recordSample(capture, { minute: 5, stats: { home: { shots: 2, xG: 1 } } });
  const interval = debrief.delta(capture.samples[0], capture.samples[1]);
  assert.equal(interval.stats.home.shots, 2);
  assert.equal(interval.stats.home.xG, null);
  assert.equal(interval.stats.home.goals, null);
  assert.equal(interval.stats.away.shots, null);
});

test("les compteurs qui régressent restent absents plutôt que de créer un faux delta", () => {
  let capture = point(debrief.create(), 1, 3, 1);
  capture = point(capture, 2, 1, .5);
  const interval = debrief.delta(capture.samples[0], capture.samples[1]);
  assert.equal(interval.stats.home.shots, null);
  assert.equal(interval.stats.home.xG, null);
});

test("les bornes restent compactes, préservent le premier point et comptent les omissions", () => {
  let capture = debrief.create();
  for (let minute = 0; minute < 140; minute++) {
    capture = point(capture, minute, minute, minute / 10);
    capture = debrief.recordDecision(capture, { minute, text: "Décision ".repeat(90), setup: { position: { x: 1 } } });
    capture = debrief.recordEvent(capture, { minute, type: "goal", text: "But", positionsAfter: { p: { x: 1 } } });
  }
  assert.equal(capture.samples.length, 100);
  assert.equal(capture.decisions.length, 60);
  assert.equal(capture.events.length, 100);
  assert.equal(capture.samples[0].minute, 0);
  assert.equal(capture.samples.at(-1).minute, 139);
  assert.deepEqual(capture.omitted, { samples: 40, decisions: 80, events: 40 });
  assert.deepEqual(debrief.normalize(capture), capture);
  assert.ok(JSON.stringify(capture).length < 125000);
  const snapshot = debrief.build({ capture, result: { homeGoals: 139, awayGoals: 0,
    events: Array.from({ length: 140 }, (_, minute) => ({ minute, type: "goal", text: "But" })) } });
  assert.equal(snapshot.omitted.events, 40);
  assert.equal(snapshot.events[0].minute, 40);
});

test("un point éloigné conservé par compression ne couvre pas artificiellement une phase", () => {
  let capture = point(debrief.create(), 0, 0, 0);
  capture = debrief.recordEvent(capture, { minute: 17, type: "phase", text: "Tous les buts comptent double." });
  capture = point(capture, 19, 3, 1);
  capture = point(capture, 20, 4, 1.2);
  const phase = debrief.read(capture).phases[1];
  assert.equal(phase.observed.from, 19);
  assert.equal(phase.observed.stats.home.xG, .2);
});

test("les décisions IA ne deviennent pas des décisions humaines", () => {
  const capture = debrief.recordDecision(debrief.create({ side: "away" }), { minute: 5, text: "IA", source: "ai" });
  assert.equal(capture.decisions.length, 0);
  const next = debrief.recordDecision(capture, { minute: 5, text: "Ma décision" });
  assert.equal(next.decisions[0].side, "away");
});

test("les valeurs invalides et les textes malicieux restent des données, jamais du HTML", () => {
  const source = "<img src=x onerror=alert(1)>";
  let capture = debrief.recordDecision(debrief.create(), { minute: 10, text: source, setup: { playerRoles: { "__proto__": "target" } } });
  capture = debrief.recordSample(capture, { minute: 10, stats: { home: { xG: "1", shots: NaN } }, score: { homeGoals: -1 } });
  assert.equal(capture.decisions[0].text, source);
  assert.equal(capture.samples[0].stats.home.xG, null);
  assert.equal(capture.samples[0].stats.home.shots, null);
  assert.equal(capture.samples[0].score.homeGoals, null);
  assert.equal(debrief.recordDecision(capture, { minute: -1 }).decisions.length, 1);
  const script = fs.readFileSync(path.join(__dirname, "tactical-debrief.js"), "utf8");
  assert.equal(script.includes("innerHTML"), false);
  assert.equal(script.includes("Math.random"), false);
});

console.log(`${passed} tests de débrief réussis.`);
