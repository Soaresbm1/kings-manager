"use strict";
// Régressions de données: sources, conservation des profils, alias et génération.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const sync = require("./scripts/sync-rosters.cjs");
const root = __dirname;
const input = sync.readInputs(root);
const generated = sync.buildRosters(input);
const source = fs.readFileSync(path.join(root, "data.js"), "utf8");
assert.ok(sync.updateData(source, generated) === source, "data.js doit être reproductible depuis les six dossiers de preuves");
assert.equal(sync.renderGenerated(sync.buildRosters(input)), sync.renderGenerated(generated), "la génération doit être déterministe");
const context = vm.createContext({});
vm.runInContext(source, context, { filename: "data.js" });
const data = JSON.parse(vm.runInContext("JSON.stringify({leagues:LEAGUES,revision:ROSTER_REVISION,sources:ROSTER_SOURCES})", context));
assert.deepEqual(Object.keys(data.leagues), sync.KEYS);
assert.equal(data.revision.checkedAt, "2026-10-26");
const all = [];
const ids = new Set(), people = new Set();
let known = 0, estimated = 0;
for (const [key, league] of Object.entries(data.leagues)) {
  const evidence = input.docs[key];
  assert.equal(league.rosterRevision.status, ["brazil", "italy", "mexico"].includes(key) ? "complete" : "partial");
  assert.ok(league.rosterRevision.sources.length > 0);
  for (const team of league.teams) {
    assert.ok(team.players.length >= 7, `${key}/${team.id}: sept joueurs minimum`);
    assert.ok(team.players.some(p => p.pos === "GK"), `${key}/${team.id}: gardien manquant`);
    const observedTeam = evidence.teams.find(t => t.id === team.id);
    if (team.rosterStatus === "complete") {
      assert.equal(team.players.length, observedTeam.players.length, `${team.id}: tous les profils de la page officielle, sans suppression de wildcard`);
      for (const observed of observedTeam.players) {
        const actual = team.players.find(p => p.rosterIdentity === sync.identity(observed.name, team.id));
        assert.ok(actual, `${team.id}: profil officiel absent ${observed.name}`);
        assert.equal(actual.pos, observed.pos, `${observed.name}: poste officiel`);
      }
    }
    for (const p of team.players) {
      all.push({ key, team, p });
      assert.ok(!ids.has(p.id), `identifiant dupliqué: ${p.id}`); ids.add(p.id);
      assert.ok(!people.has(p.rosterIdentity), `personne dupliquée: ${p.name}`); people.add(p.rosterIdentity);
      assert.ok(["GK", "DEF", "MID", "ATT"].includes(p.pos));
      for (const field of ["speed", "technique", "physical", "mental", "overall"]) assert.ok(Number.isFinite(p[field]) && p[field] >= 0 && p[field] <= 99, `${p.name}/${field}`);
      assert.ok(Number.isInteger(p.age) && p.age >= 16 && p.age <= 65, `${p.name}: âge`);
      assert.ok(Number.isFinite(p.value) && p.value > 0);
      assert.ok(p.photoClub && p.photoLeague && p.photoName, `${p.name}: origine de photo`);
      for (const id of p.rosterSourceIds) assert.ok(data.sources[id], `${p.name}: source ${id} inconnue`);
      if (p.rosterStatus === "verified") assert.ok(p.rosterSourceIds.length > 0);
      if (p.baselineOrigin) {
        known++;
        const b = p.baselineOrigin;
        const oldTeam = input.baseline.leagues[b.league].teams.find(t => t.id === b.teamId);
        const old = oldTeam.players.find(candidate => candidate.name === b.name);
        assert.ok(old, `${p.name}: profil d'origine`);
        for (const field of ["speed", "technique", "physical", "mental", "overall", "value"]) assert.equal(p[field], old[field], `${p.name}: préserver ${field}`);
        if (p.ageSource === "official-birth-date") assert.equal(p.age, sync.ageAt(p.birthDate), `${p.name}: âge officiel vérifié`);
        else assert.equal(p.age, old.age, `${p.name}: conserver l'âge hérité sans date vérifiée`);
        assert.equal(p.photoName, old.photoName || old.name);
        assert.equal(p.photoClub, old.photoClub || oldTeam.name);
        assert.equal(p.photoLeague, old.photoLeague || b.league);
        assert.equal(p.attributesSource, "legacy-game");
      } else {
        estimated++;
        assert.equal(p.attributesSource, "estimated");
        for (const field of ["speed", "technique", "physical", "mental", "overall", "value"]) assert.ok(p.estimatedFields.includes(field), `${p.name}: estimation non signalée ${field}`);
        if (p.ageSource === "estimated") assert.ok(p.estimatedFields.includes("age"));
      }
    }
  }
}
function find(name) { return all.filter(({ p, team }) => p.rosterIdentity === sync.identity(name, team.id)); }
for (const [name, target] of [["Diego de la Mata", "g7f"], ["Luis García", "g7f"], ["Aleix Martí", "g3x"], ["Roc Bancells", "boo"], ["Iván Torres", "cir"], ["Álex Gutiérrez", "cap"], ["Pablo Beguer", "trm"], ["Nadir Louah", "und"], ["Joan Oriol", "g7f"], ["Carles Planas", "stl"], ["Adri Espinar", "g7f"], ["Nico Santos", "stl"]]) {
  const matches = find(name);
  assert.equal(matches.length, 1, `${name}: une seule identité courante`);
  assert.equal(matches[0].team.id, target);
  assert.ok(matches[0].p.baselineOrigin, `${name}: attributs existants conservés malgré le transfert`);
}
assert.equal(find("Sidney Pages")[0].p.photoName, "Sidney Pages", "l'alias Sidão garde le nom de photo initial");
assert.equal(find("Dylan Bos")[0].p.age, 22, "Dylan Bos, né le 21/02/2004, a 22 ans au contrôle");
assert.equal(find("Moritz Leitner")[0].p.age, 33, "Moritz Leitner, né le 08/12/1992, a 33 ans au contrôle");
assert.equal(find("Dylan Bos")[0].p.ageSource, "official-birth-date");
assert.equal(sync.ageAt("2000-02-31"), null, "une date invalide ne remplace pas un âge");
assert.equal(find("Noah Kurmali").length, 0, "une équivalence de noms non prouvée ne crée pas de joueur");
assert.ok(all.some(({ key, p }) => key === "germany" && sync.normalizeName(p.name) === "nicksalihamidzic" && p.rosterStatus === "retained-unverified"), "une affiliation MENA observée sans exclusivité ne supprime pas la base allemande");
assert.ok(all.some(({ team, p }) => team.id === "jig" && p.name === "Pau Fer"));
assert.ok(all.some(({ team, p }) => team.id === "ebr" && p.name === "Pau Fernández"));
assert.equal(data.leagues.mexico.teams.length, 10);
assert.ok(!data.leagues.mexico.teams.some(t => ["lal", "sim"].includes(t.id)));
assert.ok(input.baseline.leagues.mexico.teams.some(t => t.id === "lal"));
assert.ok(input.baseline.leagues.mexico.teams.some(t => t.id === "sim"));
for (const name of ["Roberto Ratti", "David Grifell", "Riccardo Ottaviani", "Marco Longoni", "Raoul Squitieri"]) {
  assert.equal(find(name).length, 1, `${name}: wildcard officiel maintenu`);
  assert.equal(find(name)[0].p.registrationType, "wildcard");
}
for (const source of Object.values(data.sources)) if (source.publishedAt) assert.ok(source.publishedAt <= sync.CHECKED_AT, "aucune annonce future");
const fresh = vm.runInContext('player("Contrôle", "MID", 70, 71, 72, 73, 24)', context);
assert.equal(fresh.overall, 72, "le constructeur public player reste utilisable par le moteur");
assert.equal(fresh.age, 24);
console.log(`Effectifs: ${all.length} joueurs, ${known} profils de jeu conservés, ${estimated} nouveaux profils estimés; sources, identités, photos et génération validées.`);
