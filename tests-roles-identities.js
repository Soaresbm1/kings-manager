// Rôles et profils de carrière : contrats de sauvegarde, IA et coûts réels.
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const assert = require("node:assert/strict");
let seed = Number(process.env.TEST_SEED || 20261026) >>> 0;
let draws = 0;
const math = Object.create(Math);
math.random = () => { draws++; return ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296); };
const context = vm.createContext({ Math: math });
for (const file of ["data.js", "matchengine-actions.js", "engine.js"]) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, file), "utf8"), context, { filename: file });
}
const read = code => JSON.parse(vm.runInContext(`JSON.stringify(${code})`, context));
function team(id, style) {
  return { id, name: id, playStyle: style, players: [
    ["g", "GK"], ["d1", "DEF"], ["d2", "DEF"], ["d3", "DEF"],
    ["m1", "MID"], ["m2", "MID"], ["m3", "MID"], ["a1", "ATT"], ["a2", "ATT"]
  ].map(([key, pos]) => ({ id: id + key, pos, name: key, speed: 80, technique: 80, physical: 80, mental: 80, overall: 80, form: 80 })) };
}
function setup(club) {
  const ids = ["g", "d1", "d2", "m1", "m2", "a1", "a2"].map(id => club.id + id);
  return { formation: "1-2-2-2", assignments: ids, lineup: ids, attackPlan: "possession", defensePlan: "zone", mentality: "balanced" };
}

{
  const clubs = read("Object.values(LEAGUES).flatMap(league => league.teams)");
  const before = draws;
  const profiles = new Set();
  clubs.forEach(club => {
    const profile = context.getTeamStyle(club);
    profiles.add(profile.key);
    assert.equal(context.getTeamStyle({ ...JSON.parse(JSON.stringify(club)), name: "Nom changé" }).key, profile.key);
    for (const coefficient of ["width", "depth", "pressing", "tempo"]) assert.ok(profile[coefficient] >= 0.8 && profile[coefficient] <= 1.2);
  });
  assert.equal(profiles.size, 5, "les six ligues doivent contenir les cinq profils");
  assert.equal(draws, before, "retrouver un profil ne doit consommer aucun hasard de match");
  assert.equal(context.getTeamStyle({ id: "ancien", playStyle: "wide" }).key, "wide");
  assert.equal(context.getTeamStyle({ id: "ancien", playStyle: "inconnu" }).key, context.getTeamStyle({ id: "ancien" }).key);
  console.log("OK profils : stables après sauvegarde/renommage, diversifiés et sans tirage supplémentaire");
}

{
  const club = team("h");
  const plan = setup(club);
  plan.assignments[1] = "hm3";
  plan.playerRoles = { hm3: "creator", hd1: "overlap", ha1: "poacher", hg: "runner", vendu: "creator" };
  const snapshot = JSON.stringify(plan);
  const roles = context.normalizePlayerRoles(club, plan);
  assert.equal(roles.hm3, "stay_back", "un milieu aligné en défense utilise les rôles du poste défensif");
  assert.equal(roles.hd1, "overlap", "un choix valide suit le joueur au banc");
  assert.equal(roles.ha1, "poacher");
  assert.equal(roles.hg, "keeper");
  assert.equal(Object.hasOwn(roles, "vendu"), false);
  assert.equal(Object.keys(roles).length, club.players.length);
  assert.equal(JSON.stringify(plan), snapshot, "normaliser ne modifie pas la sauvegarde en entrée");
  const reloaded = JSON.parse(JSON.stringify({ ...plan, playerRoles: roles }));
  assert.deepEqual(JSON.parse(JSON.stringify(context.normalizePlayerRoles(club, reloaded))), JSON.parse(JSON.stringify(roles)));
  console.log("OK rôles : validation selon le poste occupé, banc, ventes et aller-retour JSON");
}

{
  const snapshots = [];
  for (const key of ["control", "pressing", "counter", "compact", "wide"]) {
    const club = team(key, key);
    const before = JSON.stringify(club.players);
    const choice = context.chooseAiFormation(club);
    const plans = context.chooseAiPlans({ overall: 80 }, { overall: 80 }, club);
    assert.equal(choice.formation, context.getTeamStyle(club).formation, "à effectif égal le profil départage la formation");
    assert.equal(plans.teamStyle, key);
    const plan = { ...choice, ...plans };
    const roles = context.createAiPlayerRoles(club, plan);
    const slots = read(`FORMATION_SLOTS[${JSON.stringify(choice.formation)}]`);
    choice.assignments.forEach((id, i) => {
      assert.ok(context.getPlayerRole({ playerRoles: roles }, id, slots[i].pos).positions.includes(slots[i].pos));
      assert.equal(club.players.find(player => player.id === id).pos, slots[i].pos);
    });
    assert.equal(JSON.stringify(club.players), before, "le profil ne change aucun attribut de joueur");
    snapshots.push(JSON.stringify({ attack: plans.attackPlan, defense: plans.defensePlan, formation: choice.formation, roles: Object.values(roles) }));
  }
  assert.equal(new Set(snapshots).size, 5);
  console.log("OK IA : cinq comportements distincts, formations naturelles et attributs préservés");
}

{
  const home = team("h", "wide"), away = team("a", "compact");
  const human = setup(home), opponent = setup(away);
  human.playerRoles = { hd1: "stay_back", hd2: "overlap" };
  const choices = { formation: human.formation, attackPlan: human.attackPlan, defensePlan: human.defensePlan };
  const engine = context.createMatchEngine(home, human, away, opponent);
  assert.deepEqual({ formation: human.formation, attackPlan: human.attackPlan, defensePlan: human.defensePlan }, choices);
  assert.equal(human.teamStyle, "wide");
  assert.equal(human.playerRoles.hd2, "overlap");
  context.planChainCount = () => 0;
  math.random = () => 0.5;
  engine.simulateMinute(6);
  assert.ok(engine.getStamina("home", "hd2") < engine.getStamina("home", "hd1"), "les montées du défenseur offensif doivent coûter davantage d'énergie");
  const anchors = engine.getFormationAnchors("home", 6);
  assert.equal(anchors.hd2.roleKey, "overlap");
  assert.equal(anchors.hd2.pos, "DEF");
  assert.equal(anchors.hg.roleKey, "keeper");
  console.log("OK moteur : consignes humaines conservées, rôles transmis et effort individuel réel");
}

{
  let randomState = 5797;
  const probeMath = Object.create(Math);
  probeMath.random = () => ((randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0) / 4294967296);
  const probe = vm.createContext({ Math: probeMath });
  for (const file of ["data.js", "matchengine-actions.js", "engine.js"]) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, file), "utf8"), probe, { filename: file });
  }
  const home = team("cal-h", "compact"), away = team("cal-a", "counter");
  const snapshot = JSON.stringify([home, away]);
  const observed = [];
  const simulate = probe.simulateMatch;
  // Observer les entrées du vrai moteur, sans remplacer sa simulation.
  probe.simulateMatch = (h, hs, a, as) => {
    observed.push([hs.teamStyle, as.teamStyle]);
    return simulate(h, hs, a, as);
  };
  const balanced = probe.runBalanceSimulation(home, away, 5);
  assert.equal(balanced.styleSampling, "balanced");
  assert.equal(balanced.matches, 5);
  assert.equal(new Set(observed.map(pair => pair[0])).size, 5);
  assert.equal(new Set(observed.map(pair => pair[1])).size, 5);
  observed.length = 0;
  const clubs = probe.runBalanceSimulation(home, away, 2, { clubStyles: true });
  assert.equal(clubs.styleSampling, "club");
  assert.equal(clubs.matches, 2);
  assert.deepEqual(observed, [["compact", "counter"], ["compact", "counter"]]);
  assert.equal(JSON.stringify([home, away]), snapshot);
  console.log("OK calibration : exposition équilibrée ou profils des clubs, sans mutation des équipes");
}
