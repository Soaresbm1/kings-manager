"use strict";
// Les anciennes carrières gardent leurs joueurs lors de la création des ligues manquantes.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const baseline = JSON.parse(fs.readFileSync(path.join(__dirname, "research/rosters-baseline.json"), "utf8"));
const clone = value => JSON.parse(JSON.stringify(value));

function fixture(leagueKey = "spain") {
  const context = vm.createContext({ document: { addEventListener() {} } });
  for (const file of ["data.js", "matchengine-actions.js", "engine.js", "matchchoreo.js", "app.js"]) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, file), "utf8"), context, { filename: file });
  }
  const league = clone(baseline.leagues[leagueKey]);
  league.results = [];
  let id = 0;
  for (const team of league.teams) for (const player of team.players) {
    player.id = "legacy_" + id++;
    player.statsBaselineCleared = true;
  }
  const save = { leagueKey, league, userTeamId: league.teams[0].id, schedule: [], currentRound: 0, seasonObjective: {} };
  const run = code => vm.runInContext(code, context);
  const load = data => { context.saveUnderTest = data; run("applySaveData(saveUnderTest)"); };
  const all = () => run("[{key:STATE.leagueKey,league:STATE.league},...(STATE.otherLeagues||[])].flatMap(l=>l.league.teams.flatMap(t=>t.players.map(p=>({key:l.key,team:t.id,player:p}))))");
  return { context, save, run, load, all };
}

let passed = 0;
function test(name, body) {
  body(); passed++;
  console.log("OK " + name);
}

test("une ancienne carrière garde Aleix et retire seulement sa nouvelle copie brésilienne", () => {
  const { save, load, all } = fixture();
  const original = save.league.teams.find(t => t.id === "umo").players.find(p => p.name === "Aleix Martí");
  Object.assign(original, { careerGoals: 47, form: 63, matches: 19, goals: 12 });
  const expected = { id: original.id, careerGoals: 47, form: 63, matches: 19, goals: 12 };
  load(save);
  const matches = all().filter(record => record.player.name === "Aleix Martí");
  assert.equal(matches.length, 1);
  assert.equal(matches[0].key, "spain");
  assert.equal(matches[0].team, "umo");
  assert.strictEqual(matches[0].player, original);
  for (const [field, value] of Object.entries(expected)) assert.equal(original[field], value);
});

test("les ligues déjà sauvegardées conservent les mouvements simulés et leurs identifiants", () => {
  const { save, load, all } = fixture();
  const existing = clone(save.league.teams.find(t => t.id === "umo").players.find(p => p.name === "Aleix Martí"));
  existing.id = "simulated_background_id";
  save.otherLeagues = [{ key: "brazil", league: { teams: [{ id: "g3x", name: "G3X FC", players: [existing] }], results: [] }, schedule: [], currentRound: 4 }];
  load(save);
  const matches = all().filter(record => record.player.name === "Aleix Martí");
  assert.equal(matches.length, 2, "ne pas réconcilier une carrière existante avec le mercato réel");
  assert.ok(matches.some(record => record.player.id === "simulated_background_id"));
  assert.equal(save.otherLeagues[0].currentRound, 4);
});

test("la migration historique des identifiants strictement dupliqués reste active", () => {
  const { save, load, all } = fixture();
  const original = save.league.teams.find(t => t.id === "umo").players.find(p => p.name === "Aleix Martí");
  save.otherLeagues = [{ key: "brazil", league: { teams: [{ id: "g3x", players: [clone(original)] }] } }];
  load(save);
  const matches = all().filter(record => record.player.id === original.id);
  assert.equal(matches.length, 1);
  assert.strictEqual(matches[0].player, original);
});

test("l'ancien nom de photo identifie Sidney même si le nouvel effectif affiche Sidão", () => {
  const { save, load, all } = fixture();
  const old = clone(baseline.leagues.brazil.teams.flatMap(t => t.players).find(p => p.name === "Sidney Pages"));
  Object.assign(old, { id: "legacy_transferred_sidney", photoClub: "Dibrados FC", photoLeague: "brazil", statsBaselineCleared: true });
  save.league.teams[0].players.push(old);
  load(save);
  const matches = all().filter(record => ["Sidney Pages", "Sidão Pages"].includes(record.player.name));
  assert.equal(matches.length, 1);
  assert.strictEqual(matches[0].player, old);
  assert.equal(old.name, "Sidney Pages");
  assert.equal(old.photoName, "Sidney Pages");
});

test("un identifiant officiel reconnaît une recrue renommée sans toucher à son nom", () => {
  const { save, run, load, all } = fixture();
  const current = run("LEAGUES.germany.teams.find(t=>t.id==='erc').players.find(p=>p.name==='Dylan Bos')");
  const old = clone(current);
  Object.assign(old, { id: "legacy_official_player", name: "Recrue renommée" });
  delete old.rosterIdentity;
  save.league.teams[0].players.push(old);
  load(save);
  const matches = all().filter(record => String(record.player.officialPlayerId) === String(old.officialPlayerId));
  assert.equal(matches.length, 1);
  assert.equal(matches[0].player.id, "legacy_official_player");
  assert.equal(matches[0].player.name, "Recrue renommée");
});

test("les homonymes Pau Fernández sont départagés par leur club de photo", () => {
  const { save, load, all } = fixture("france");
  const old = clone(baseline.leagues.spain.teams.find(t => t.id === "jig").players.find(p => p.name === "Pau Fernández"));
  Object.assign(old, { id: "legacy_transferred_pau", photoClub: "Jijantes FC", photoLeague: "spain", statsBaselineCleared: true });
  save.league.teams[0].players.push(old);
  load(save);
  assert.strictEqual(all().find(record => record.player.id === old.id).player, old);
  assert.equal(all().filter(record => record.key === "spain" && record.team === "jig" && record.player.name === "Pau Fer").length, 0);
  assert.equal(all().filter(record => record.key === "spain" && record.team === "ebr" && record.player.name === "Pau Fernández").length, 1);
});

test("le club photo historique de Diego reste allemand malgré son nouveau club italien", () => {
  const { save, load } = fixture("germany");
  const old = save.league.teams.find(t => t.id === "nrf").players.find(p => p.name === "Diego de la Mata");
  load(save);
  assert.equal(old.photoClub, "No Rules FC");
  assert.equal(old.photoLeague, "germany");
  assert.equal(old.photoName, "Diego de la Mata");
});

test("les noms et chemins de photo déjà sauvegardés ne sont jamais remplacés", () => {
  const { save, load } = fixture();
  const old = save.league.teams.find(t => t.id === "umo").players.find(p => p.name === "Aleix Martí");
  Object.assign(old, { photoClub: "Club historique", photoLeague: "spain", photoName: "Photo historique" });
  load(save);
  assert.equal(old.photoClub, "Club historique");
  assert.equal(old.photoLeague, "spain");
  assert.equal(old.photoName, "Photo historique");
});

test("un nom seulement ressemblant ne supprime aucun joueur du nouvel effectif", () => {
  const { save, load, all } = fixture();
  const old = save.league.teams.find(t => t.id === "umo").players.find(p => p.name === "Aleix Martí");
  old.name = "Aleix Martix";
  load(save);
  assert.ok(all().some(record => record.player.id === old.id));
  assert.ok(all().some(record => record.key === "brazil" && record.player.name === "Aleix Martí"));
});

test("un second chargement conserve le résultat de la migration", () => {
  const { save, run, load, all } = fixture();
  load(save);
  const before = all().map(record => record.key + "/" + record.team + "/" + record.player.id).sort();
  const migrated = JSON.parse(run("JSON.stringify(buildSaveData())"));
  load(migrated);
  assert.deepEqual(all().map(record => record.key + "/" + record.team + "/" + record.player.id).sort(), before);
});

console.log(`\n${passed}/${passed} migrations d'effectifs réussies`);
