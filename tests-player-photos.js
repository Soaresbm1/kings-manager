"use strict";
// Vérifications hors ligne de l'identité des portraits et des preuves conservées.
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
const sync = require("./scripts/sync-player-photos.cjs");
const root = __dirname, observations = JSON.parse(fs.readFileSync(path.join(root, "research/player-photo-observations.json"), "utf8"));
const leagues = sync.loadLeagues(), generated = sync.build(leagues, observations);
const source = fs.readFileSync(path.join(root, "player-photos.js"), "utf8");
let passed = 0;
function test(name, body) { body(); passed++; console.log("OK " + name); }
function runtime(text) { const context = vm.createContext({}); vm.runInContext(text, context); return JSON.parse(vm.runInContext("JSON.stringify(PLAYER_PHOTOS)", context)); }
const data = runtime(source);
test("les 865 joueurs ont un statut vérifiable, sans promesse de portrait pour tous", () => {
  const actual = Object.values(leagues).reduce((n, league) => n + league.teams.reduce((s, team) => s + team.players.length, 0), 0);
  assert.equal(generated.report.players.length, actual);
  assert.equal(actual, 865);
  assert.equal(generated.report.verifiedPlayers + generated.report.unresolvedPlayers, actual);
  assert.equal(Object.keys(data.byIdentity).length, generated.report.verifiedPlayers);
  assert.ok(generated.report.unresolvedPlayers > 0);
});
test("la génération est reproductible sans réseau ni dossier de collecte", () => {
  assert.equal(sync.render(generated.runtime), source);
  assert.equal(sync.render(sync.build(leagues, observations).runtime), source);
  assert.deepEqual(generated.report, JSON.parse(fs.readFileSync(path.join(root, "research/player-photos-report.json"), "utf8")));
  assert.deepEqual(observations.imageRejections, JSON.parse(fs.readFileSync(path.join(root, "research/player-photo-rejections.json"), "utf8")));
});
test("chaque portrait est lié à une observation et au bon identifiant de profil officiel", () => {
  const evidence = new Map(observations.records.map(record => [record.id, record]));
  const ids = new Set();
  for (const [identity, p] of Object.entries(data.byIdentity)) {
    assert.equal(sync.officialId(p.profileUrl), p.officialPlayerId, `${p.name}: profil contradictoire`);
    assert.equal(data.byOfficialId[p.officialPlayerId], identity);
    assert.ok(!ids.has(p.officialPlayerId), `${p.name}: identifiant officiel attribué à deux personnes`); ids.add(p.officialPlayerId);
    assert.ok(p.sourceIds.length > 0);
    for (const id of p.sourceIds) {
      const record = evidence.get(id); assert.ok(record, `${p.name}: preuve absente`);
      assert.equal(record.status, "verified");
      assert.equal(record.officialPlayerId, p.officialPlayerId);
      assert.equal(record.imageUrl, p.imageUrl);
      assert.equal(sync.imageURL(record.observedImageUrl), p.imageUrl);
      assert.match(record.imageSha256 || "", /^[0-9a-f]{64}$/, `${p.name}: portrait téléchargé sans empreinte vérifiée`);
    }
  }
});
test("les URLs de portraits excluent blasons, présidents, placeholders et hôtes étrangers", () => {
  for (const p of Object.values(data.byIdentity)) assert.ok(sync.imageURL(p.imageUrl), `${p.name}: portrait non admissible`);
  for (const url of [
    "https://kingsleague.pro/_ipx/s_128x180/img/placeholder/kl-player-placeholder.png",
    "https://kingsleague-cdn.kama.football/account/production/team/123.png",
    "https://kingsleague-cdn.kama.football/account/production/president/123.png",
    "https://evil.example/account/production/player/123.png",
    "https://kingsleague-cdn.kama.football.evil.example/account/production/player/123.png"
  ]) assert.equal(sync.imageURL(url), null);
});
test("une observation d'IPX conserve l'image originale publique, sans redimensionnement intermédiaire", () => {
  const expected = "https://kingsleague-cdn.kama.football/account/production/player/image/123.png";
  assert.equal(sync.imageURL("https://kingsleague.pro/_ipx/s_128x180/" + expected), expected);
  assert.equal(sync.imageURL("https://kingsleague.pro/_ipx/fit_outside%26s_600x844/kama/production/player/image/123.png"), expected);
  assert.equal(sync.cardName({ label: "Tommaso Caldera\n\nDifensore" }), "Tommaso Caldera");
});
test("les deux Manu García de Skull restent non attribués en l'absence d'identifiant de carrière", () => {
  assert.equal(data.byIdentity.manugarcia, undefined);
  const gap = generated.report.players.find(p => p.rosterIdentity === "manugarcia");
  assert.equal(gap.reason, "ambiguous-official-identity");
  assert.deepEqual(gap.candidateIds, ["87484", "87592"]);
});
test("Pau Fer et Pau Fernández restent deux personnes, leur ancien alias demande un contexte", () => {
  assert.ok(data.byIdentity.paufer);
  assert.ok(data.byIdentity.paufernandez);
  assert.notEqual(data.byIdentity.paufer.officialPlayerId, data.byIdentity.paufernandez.officialPlayerId);
  assert.ok(data.byName.paufernandez.includes("paufer"));
  assert.ok(data.byName.paufernandez.includes("paufernandez"));
  assert.ok(data.byIdentity.paufer.origins.some(o => o.teamId === "jig"));
  assert.ok(data.byIdentity.paufernandez.origins.some(o => o.teamId === "ebr"));
});
test("les transferts et alias connus conservent leur identité et leur origine historique", () => {
  for (const identity of ["alexguti", "sidãopages", "aleixmarti", "diegodelamata"]) {
    const key = identity === "sidãopages" ? "sidaopages" : identity;
    const p = data.byIdentity[key]; assert.ok(p, key);
    assert.ok(p.origins.length > 0);
  }
  assert.ok(data.byIdentity.sidaopages.aliases.includes("Sidney Pages"));
  assert.ok(data.byIdentity.alexguti.aliases.includes("Álex Gutiérrez"));
  assert.ok(data.byIdentity.diegodelamata.origins.some(o => o.teamId === "g7f"));
});
function fixture(player, records) {
  return sync.build({ spain: { teams: [{ id: "skl", name: "Skull FC", players: [player] }] } }, { checkedAt: "2026-10-27", records }).runtime.byIdentity;
}
function observed(id, type, teamId = "skl", image = id) {
  return { id: "proof-" + id + type + teamId, type, leagueKey: "spain", teamId, teamName: "Skull FC", name: "Manu García", officialPlayerId: id,
    profileUrl: `https://kingsleague.pro/es/jugadores/${id}-manu-garcia`, imageUrl: sync.CDN_BASE + `production/player/${image}.png`, status: "verified" };
}
test("un identifiant officiel distingue un homonyme sans utiliser d'âge estimé ni de ressemblance", () => {
  const records = [observed("87484", "team-card"), observed("87592", "team-card")];
  const result = fixture({ name: "Manu García", rosterIdentity: "manugarcia", officialPlayerId: "87592" }, records);
  assert.equal(result.manugarcia.officialPlayerId, "87592");
  const missing = fixture({ name: "Manu García", rosterIdentity: "manugarcia", officialPlayerId: "999999" }, records);
  assert.equal(missing.manugarcia, undefined, "un identifiant contradictoire ne retombe pas sur un nom commun");
});
test("la carte de l'équipe actuelle prime sur la photo historique d'un profil du même joueur", () => {
  const current = observed("87592", "team-card", "skl", "current");
  const old = observed("87592", "profile-fallback", "skl", "historical");
  const otherTeam = observed("87592", "team-card", "pio", "other-team");
  const result = fixture({ name: "Manu García", rosterIdentity: "manugarcia", officialPlayerId: "87592" }, [old, otherTeam, current]);
  assert.equal(result.manugarcia.imageUrl, current.imageUrl);
});
test("un nom seulement ressemblant n'est pas une preuve d'identité", () => {
  const result = fixture({ name: "Manu Garciix", rosterIdentity: "manugarciix" }, [observed("87592", "team-card")]);
  assert.equal(result.manugarciix, undefined);
});
test("les preuves négatives restent explicites et aucun blason ne remplace un portrait absent", () => {
  const negatives = observations.records.filter(record => record.status !== "verified");
  assert.ok(negatives.some(record => record.name === "Youssef Hidasse"));
  assert.ok(negatives.some(record => record.name === "Marvin Gakpa"));
  assert.ok(negatives.some(record => record.name === "Smajo Jakupovic"));
  for (const record of negatives) assert.equal(record.imageUrl, null);
});
test("les silhouettes à URL opaque sont rejetées par hash et par URL originale, sans bloquer un nom", () => {
  const record = observed("87592", "team-card");
  const hash = "a".repeat(64);
  const rejection = { images: [{ sha256: hash, reason: "visually-confirmed-generic-silhouette", urls: [record.imageUrl] }] };
  assert.equal(sync.rejectImages([record], rejection)[0].status, "rejected-generic-image");
  assert.equal(sync.rejectImages([{ ...record, imageUrl: sync.CDN_BASE + "production/player/renamed.png", imageSha256: hash }], rejection)[0].imageUrl, null);
  assert.equal(sync.rejectImages([{ ...record, imageUrl: sync.CDN_BASE + "production/player/real-person.png" }], rejection)[0].status, "verified");
  const rejectedURLs = new Set(observations.imageRejections.images.flatMap(item => item.urls));
  for (const p of Object.values(data.byIdentity)) assert.ok(!rejectedURLs.has(p.imageUrl));
});
console.log(`\n${passed}/${passed} vérifications de portraits réussies; ${generated.report.verifiedPlayers}/${generated.report.totalPlayers} joueurs vérifiés.`);
