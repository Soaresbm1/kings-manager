const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const Rules = require("./competition-rules.js");
const Training = require("./club-training.js");
const Promises = require("./player-promises.js");
let passed = 0;
const test = (name, run) => { run(); passed++; console.log("OK " + name); };
const plain = value => JSON.parse(JSON.stringify(value));
function fixture(selects = {}) {
  const team = { id: "club", players: [
    { id: "one", name: "Un joueur", pos: "MID", speed: 70, technique: 70, physical: 70, mental: 70, overall: 70, value: 40000, form: 80 },
    { id: "injured", pos: "ATT", form: 70, injured: true }, { id: "suspended", pos: "DEF", form: 70, suspended: true }
  ] };
  const context = vm.createContext({ CompetitionRules: Rules, ClubTraining: Training, PlayerPromises: Promises,
    STATE: { leagueKey: "france", league: { name: "France" }, season: 1, currentRound: 0, currentDay: 0,
      currentSlotId: "slot", schedule: Array.from({ length: 14 }, () => []), otherLeagues: [{ key: "spain" }, { key: "germany" }], pendingResult: null },
    document: { addEventListener() {}, getElementById: id => selects[id] ? { value: selects[id] } : null },
    VALUE_STAR_MIN: 60, VALUE_STAR_MAX: 95, getUserTeam: () => team, managerPendingEntry: null,
    advancing: false, formatMoney: value => value + " €", saveGame: () => true,
    updateTopbar() {}, showAlert(message) { context.alert = message; },
    showConfirm(message, callback) { context.confirm = callback; context.confirmText = message; }
  });
  vm.runInContext(fs.readFileSync("club-management.js", "utf8"), context);
  context.renderClubManagement = () => {};
  context.initializeClubManagement();
  return { context, team, state: context.STATE };
}
test("les sauvegardes antérieures migrent vers des copies historiques distinctes sans effet joueur", () => {
  const { context, state, team } = fixture(), before = plain(team);
  assert.equal(context.getCareerRules().profileId, Rules.LEGACY_ID);
  assert.equal(context.getCareerRules("tournament").competition, "international");
  assert.equal(context.getCareerRules("championship", "spain").competition, "league:spain");
  assert.deepEqual(plain(state.clubTraining), Training.normalize());
  assert.deepEqual(plain(state.playerPromises), Promises.normalize());
  assert.deepEqual(plain(team), before);
});
test("le choix initial s’applique au bon contexte, y compris les ligues simulées", () => {
  const { context } = fixture({ "rules-new-championship": Rules.GUIDE_ID, "rules-new-tournament": Rules.LEGACY_ID });
  context.initializeClubManagement(null, { newCareer: true });
  assert.equal(context.getCareerRules().config.totalMinutes, 36);
  assert.equal(context.getCareerRules("championship", "germany").config.totalMinutes, 36);
  assert.equal(context.getCareerRules("tournament").config.totalMinutes, 40);
});
test("des métadonnées de gestion malformées ne bloquent pas une carrière importée valide", () => {
  const { context, state } = fixture();
  context.initializeClubManagement({ competitionRules: { championship: "invalid", tournament: [], otherLeagues: {} },
    clubTraining: { history: {}, credits: "bad" }, playerPromises: { entries: {} }, nextSeasonRules: { championship: {}, tournament: "unknown" } });
  assert.equal(context.getCareerRules("championship", "spain").profileId, Rules.LEGACY_ID);
  assert.equal(context.getCareerRules().profileId, Rules.LEGACY_ID);
  assert.deepEqual(plain(state.nextSeasonRules), { championship: "keep", tournament: "keep" });
  assert.deepEqual(plain(state.playerPromises.entries), []);
});
test("une copie importée reste exacte et le choix suivant ne modifie aucune règle courante", () => {
  const { context, state } = fixture();
  const custom = plain(Rules.create(Rules.GUIDE_ID)); custom.config.cardDuration = 3;
  context.initializeClubManagement({ competitionRules: { championship: custom }, nextSeasonRules: { championship: "keep", tournament: Rules.GUIDE_ID } });
  assert.equal(context.getCareerRules().config.cardDuration, 3);
  const before = context.getCareerRules(); state.season++;
  context.advanceClubManagementSeason();
  assert.equal(before.season, 1);
  assert.equal(context.getCareerRules().season, 2);
  assert.equal(context.getCareerRules().config.cardDuration, 3);
  assert.equal(context.getCareerRules("tournament").profileId, Rules.GUIDE_ID);
  assert.deepEqual(plain(state.nextSeasonRules), { championship: "keep", tournament: "keep" });
});
test("un changement de championnat pour la saison suivante atteint toutes les ligues", () => {
  const { context, state } = fixture(); state.nextSeasonRules.championship = Rules.GUIDE_ID; state.season++;
  context.advanceClubManagementSeason();
  assert(state.competitionRules.otherLeagues.every(entry => entry.rules.profileId === Rules.GUIDE_ID && entry.rules.season === 2));
  assert.equal(context.getCareerRules().profileId, Rules.GUIDE_ID);
});
test("les preuves pré-match sont une capture indépendante des compositions et rôles ultérieurs", () => {
  const { context, team } = fixture();
  const setup = { isHome: true, lineup: ["one"], playerRoles: { one: "creator" } };
  const captured = context.captureMatchPromises(team, setup, { id: "opponent" }, false);
  setup.lineup.length = 0; setup.playerRoles.one = "anchor";
  assert.deepEqual(plain(captured.eligibleIds), ["one"]);
  assert.deepEqual(plain(captured.initialLineup), ["one"]);
  assert.equal(captured.initialRoles.one, "creator");
  assert.equal(captured.fixtureKey, '[1,"championship","france",0,"club","opponent"]');
});
test("l’évaluation applique une réaction bornée une fois après la forme habituelle du match", () => {
  const { context, team, state } = fixture();
  state.playerPromises = Promises.accept(state.playerPromises, { notification: { id: "request", type: "message", playerId: "one", templateIdx: 2 }, player: team.players[0], season: 1, day: 0 }).ledger;
  const captured = context.captureMatchPromises(team, { isHome: true, lineup: ["one"], playerRoles: {} }, { id: "opponent" }, false);
  team.players[0].form = 98;
  context.evaluateMatchPromises({ participants: { home: ["one"] }, minutesPlayed: { one: 8 } }, captured, "home");
  assert.equal(team.players[0].form, 99);
  assert.equal(state.playerPromises.entries[0].status, "kept");
  context.evaluateMatchPromises({ participants: { home: ["one"] }, minutesPlayed: { one: 8 } }, captured, "home");
  assert.equal(team.players[0].form, 99);
});
test("une confirmation périmée et un changement de carrière n’appliquent aucun effet", () => {
  const { context, team, state } = fixture();
  const preview = Training.preview(state.clubTraining, context.trainingContext({ mode: "recovery", playerIds: ["one"] }));
  context.confirmClubTraining({ mode: preview.mode, playerIds: preview.playerIds, token: preview.token });
  team.players[0].form--;
  context.confirm();
  assert.equal(team.players[0].form, 79); assert.equal(state.clubTraining.last, null); assert.match(context.alert, /changé/);
  const next = Training.preview(state.clubTraining, context.trainingContext({ mode: "recovery", playerIds: ["one"] }));
  context.confirmClubTraining({ mode: next.mode, playerIds: next.playerIds, token: next.token });
  state.currentSlotId = "another"; context.confirm();
  assert.equal(team.players[0].form, 79); assert.equal(state.clubTraining.last, null);
});
test("une écriture incertaine garde un ledger cohérent et interdit toute seconde application", () => {
  const { context, team, state } = fixture();
  context.saveGame = () => { context.managerPendingEntry = { slotId: "slot", entry: { data: plain(state) } }; return false; };
  const preview = Training.preview(state.clubTraining, context.trainingContext({ mode: "recovery", playerIds: ["one"] }));
  context.confirmClubTraining({ mode: preview.mode, playerIds: preview.playerIds, token: preview.token }); context.confirm();
  assert.equal(team.players[0].form, 82);
  assert.equal(state.clubTraining.last.round, 0);
  assert.deepEqual(plain(context.managerPendingEntry.entry.data.clubTraining), plain(state.clubTraining));
  assert(context.clubManagementBlocked());
  context.confirm(); assert.equal(team.players[0].form, 82);
  assert.match(context.trainingContext().blocked, /non enregistrée/);
});
test("une entrée de récupération antérieure empêche la séance sans l’écraser", () => {
  const { context, state } = fixture();
  const existing = { slotId: "slot", entry: { important: true } }; context.managerPendingEntry = existing;
  context.confirmClubTraining({ mode: "recovery", playerIds: ["one"], token: "old" });
  assert.equal(context.confirm, undefined); assert.equal(context.managerPendingEntry, existing); assert.equal(state.clubTraining.last, null);
});
console.log(`${passed} tests d’intégration des décisions de club réussis.`);
