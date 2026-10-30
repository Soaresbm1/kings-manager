// Intégration du déplacement tactique avec indisponibilités et reprise du match.
// Sans navigateur : node tests-live-drag.js. Les rendus seuls sont remplacés par des bouchons.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const plain = value => JSON.parse(JSON.stringify(value));
let passed = 0, failed = 0;

function scenario() {
  const elements = new Map();
  const element = id => {
    if (!elements.has(id)) elements.set(id, { textContent: "", classes: new Set(),
      classList: { add(name) { elements.get(id).classes.add(name); }, remove(name) { elements.get(id).classes.delete(name); } },
      querySelector: () => ({ focus() {} }) });
    return elements.get(id);
  };
  const context = vm.createContext({ document: { addEventListener() {}, getElementById: element } });
  for (const file of ["data.js", "player-photos.js", "matchengine-actions.js", "engine.js", "matchchoreo.js", "app.js"]) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, file), "utf8"), context, { filename: file });
  }
  const run = source => vm.runInContext(source, context);
  run(`
    STATE.userTeamId = "live-drag-team";
    STATE.league = { teams: [{ id: "live-drag-team", players: [
      {id:"g",pos:"GK"}, {id:"g2",pos:"GK"}, {id:"d1",pos:"DEF"}, {id:"d2",pos:"DEF"},
      {id:"m1",pos:"MID"}, {id:"m2",pos:"MID"}, {id:"a1",pos:"ATT"}, {id:"a2",pos:"ATT"},
      {id:"bench",pos:"MID"}, {id:"bench2",pos:"ATT"}
    ] }] };
    STATE.savedTactic = { marker: "tactique habituelle" };
    let saveCalls = 0, anchorsCalls = 0, dashboardCalls = 0, resumeCalls = 0;
    let unavailable = [];
    saveGame = () => { saveCalls++; };
    renderPitch = () => {};
    renderBench = () => {};
    updateLineupCount = () => {};
    closePositionPicker = () => {};
    syncChoreoAnchors = () => { anchorsCalls++; };
    updateMatchDashboard = () => { dashboardCalls++; };
    resumeMatchFlow = () => { resumeCalls++; };
    const setup = {
      formation: "1-2-2-2", formationOOP: "1-2-2-2",
      assignments: ["g","d1","d2","m1","m2","a1","a2"],
      assignmentsOOP: ["g","d1","d2","m1","m2","a1","a2"],
      lineup: ["g","d1","d2","m1","m2","a1","a2"],
      attackPlan: "possession", defensePlan: "zone", mentality: "balanced", persist: false,
      activeOverride: ["m1","a1"], escalierOrder: ["m1","d1","m2","a1","d2","a2"],
      matchballOrder: ["a2","m1","d1","m2","a1","d2"]
    };
    lineupSetup = setup;
    matchState = { userSide: "home", minute: 8, sequenceActive: false, atHalfTime: false, finished: false };
    matchEngine = { getUnavailablePlayers: () => unavailable.map(entry => ({...entry})) };
  `);
  return { run, element };
}

function test(name, run) {
  try { run(); passed++; console.log("OK " + name); }
  catch (error) { failed++; console.error("FAIL " + name + ": " + error.stack); }
}

test("les cases indisponibles sont verrouillées sans empêcher les autres permutations ni muter le plan", () => {
  const s = scenario();
  s.run(`getUserTeam().players.find(player => player.id === "m2").injured = true;
    setup.assignmentsOOP = ["g","m2","a1","d2","d1","a2","m1"];
    const before = JSON.stringify(setup);`);
  for (const phase of ["in", "out"]) {
    const assignments = plain(s.run(phase === "in" ? "setup.assignments" : "setup.assignmentsOOP"));
    const allowed = plain(s.run(`planTacticDrop(setup,"d1",${assignments.indexOf("d2")},"${phase}",["m2"])`));
    assert.equal(allowed.valid, true);
    for (const key of ["assignments", "assignmentsOOP"]) {
      const original = plain(s.run(`setup.${key}`));
      assert.equal(allowed[key][original.indexOf("m2")], "m2", "le blessé verrouillé doit rester à sa case");
      assert.deepEqual(allowed[key], original.map(id => id === "d1" ? "d2" : id === "d2" ? "d1" : id));
    }
    assert.equal(s.run(`planTacticDrop(setup,"m2",${assignments.indexOf("d1")},"${phase}",["m2"]).valid`), false);
    assert.equal(s.run(`planTacticDrop(setup,"bench",${assignments.indexOf("m2")},"${phase}",["m2"]).valid`), false);
    assert.equal(s.run(`planTacticDrop(setup,"bench",${assignments.indexOf("d1")},"${phase}",["m2","bench"]).valid`), false);
    assert.equal(s.run("JSON.stringify(setup) === before"), true, "aucun dépôt préparé ne doit muter le setup");
  }
});

test("les indisponibilités du moteur s'appliquent au modal sans contaminer la préparation d'un autre match", () => {
  const s = scenario();
  s.run(`unavailable = [{playerId:"d1",reason:"red",until:12},{playerId:"m1",reason:"yellow",until:10}];`);
  assert.equal(s.run("planTacticDropForScreen(setup,MATCH_TACTICS_IDS,'d1',2,'in').valid"), false);
  assert.equal(s.run("planTacticDropForScreen(setup,MATCH_TACTICS_IDS,'bench',1,'in').valid"), false);
  assert.equal(s.run("planTacticDropForScreen(setup,MATCH_TACTICS_IDS,'bench',3,'in').valid"), false);
  assert.equal(s.run("planTacticDropForScreen(setup,LINEUP_IDS,'d1',2,'in').valid"), true);
  assert.equal(s.run("planTacticDropForScreen(setup,MATCH_TACTICS_IDS,'a1',6,'in').valid"), true);
});

test("un remplaçant peut sortir un blessé ou suspendu sans contourner un carton ni déplacer les autres absents", () => {
  for (const reason of ["injury", "suspended", "red", "yellow"]) {
    const s = scenario();
    s.run(`unavailable = [{playerId:"m1",reason:"${reason}"},{playerId:"m2",reason:"yellow",until:10},
      {playerId:"d1",reason:"injury"}];
      getUserTeam().players.find(player => player.id === "d1").injured = true;
      ${reason === "injury" ? 'getUserTeam().players.find(player => player.id === "m1").injured = true;' : ""}
      ${reason === "suspended" ? 'getUserTeam().players.find(player => player.id === "m1").suspended = true;' : ""}
      const snapshot = JSON.stringify([setup,STATE.savedTactic]);`);
    assert.equal(s.run("planTacticDropForScreen(setup,MATCH_TACTICS_IDS,'m1',5,'in').valid"), false,
      `un joueur indisponible (${reason}) ne peut jamais devenir la source du déplacement`);
    assert.equal(s.run("planTacticDropForScreen(setup,MATCH_TACTICS_IDS,'a1',3,'in').valid"), false,
      "un titulaire ne peut pas permuter sa case avec un joueur indisponible");
    const replaceable = reason === "injury" || reason === "suspended";
    const plan = plain(s.run("planTacticDropForScreen(setup,MATCH_TACTICS_IDS,'bench',3,'in')"));
    assert.equal(plan.valid, replaceable, `${reason} : seuls blessure et suspension autorisent un remplaçant`);
    assert.equal(s.run("JSON.stringify([setup,STATE.savedTactic]) === snapshot"), true,
      "la préparation d'un dépôt reste sans mutation");
    if (replaceable) {
      for (const key of ["assignments", "assignmentsOOP"]) {
        const original = plain(s.run(`setup.${key}`));
        assert.deepEqual(plan[key], original.map(id => id === "m1" ? "bench" : id));
        assert.equal(plan[key][original.indexOf("d1")], "d1", "l'autre blessé reste à sa place");
        assert.equal(plan[key][original.indexOf("m2")], "m2", "le joueur sous carton reste à sa place");
      }
      assert.equal(s.run("planTacticDropForScreen(setup,LINEUP_IDS,'bench',3,'in').valid"), true,
        "le remplacement médical est également possible avant le match");
    }
    assert.equal(s.run("moveTacticPlayer(setup,MATCH_TACTICS_IDS,'bench',3,'in')"), replaceable);
    if (replaceable) {
      assert.equal(s.run("setup.assignments[3]"), "bench");
      assert.equal(s.run("setup.assignments[1]"), "d1");
      assert.equal(s.run("setup.assignments[4]"), "m2");
    } else assert.equal(s.run("JSON.stringify([setup,STATE.savedTactic]) === snapshot"), true);
    assert.equal(s.run("saveCalls"), 0);
  }
});

test("un remplacement transfère les priorités des formats réduits et préserve la tactique habituelle", () => {
  const s = scenario();
  assert.equal(s.run("moveTacticPlayer(setup,MATCH_TACTICS_IDS,'bench',3,'in')"), true);
  assert.deepEqual(plain(s.run("setup.activeOverride")), ["bench", "a1"]);
  assert.deepEqual(plain(s.run("setup.escalierOrder")), ["bench", "d1", "m2", "a1", "d2", "a2"]);
  assert.deepEqual(plain(s.run("setup.matchballOrder")), ["a2", "bench", "d1", "m2", "a1", "d2"]);
  assert.equal(s.run("setup.assignments[3]"), "bench");
  assert.deepEqual(plain(s.run("setup.assignmentsOOP")), plain(s.run("setup.assignments")));
  assert.deepEqual(plain(s.run("STATE.savedTactic")), { marker: "tactique habituelle" });
  assert.equal(s.run("saveCalls"), 0);
  const orders = s.run("JSON.stringify([setup.activeOverride,setup.escalierOrder,setup.matchballOrder])");
  assert.equal(s.run("moveTacticPlayer(setup,MATCH_TACTICS_IDS,'d1',2,'in')"), true);
  assert.equal(s.run("JSON.stringify([setup.activeOverride,setup.escalierOrder,setup.matchballOrder])"), orders,
    "échanger deux titulaires conserve leurs priorités par identité");
});

test("un dépôt refusé conserve composition, priorités et sauvegarde", () => {
  const s = scenario();
  s.run(`unavailable = [{playerId:"m1",reason:"yellow",until:10}];
    const snapshot = JSON.stringify([setup,STATE.savedTactic]);`);
  assert.equal(s.run("moveTacticPlayer(setup,MATCH_TACTICS_IDS,'bench',3,'in')"), false);
  assert.equal(s.run("JSON.stringify([setup,STATE.savedTactic]) === snapshot"), true);
  assert.equal(s.run("saveCalls"), 0);
});

test("fermer le modal conserve le jaune, filtre les absences permanentes et respecte la séquence en cours", () => {
  const s = scenario();
  s.run(`unavailable = [{playerId:"d1",reason:"red"},{playerId:"m1",reason:"yellow",until:10},
    {playerId:"m2",reason:"injury"},{playerId:"a2",reason:"suspended"}];
    matchState.sequenceActive = true;
    closeMatchTactics();`);
  assert.deepEqual(plain(s.run("setup.lineup")), ["g", "d2", "m1", "a1"]);
  assert.equal(s.run("anchorsCalls"), 0, "les acteurs de la séquence déjà calculée doivent rester inchangés");
  assert.equal(s.run("dashboardCalls"), 1);
  assert.equal(s.run("resumeCalls"), 1);
  assert.deepEqual(plain(s.run("STATE.savedTactic")), { marker: "tactique habituelle" });
  assert.equal(s.run("saveCalls"), 0);
  s.run("matchState.sequenceActive = false; closeMatchTactics();");
  assert.equal(s.run("anchorsCalls"), 1, "à la frontière de séquence, les nouvelles ancres peuvent être synchronisées");
});

test("fermer à la mi-temps garde le match en pause", () => {
  const s = scenario();
  s.run("matchState.atHalfTime = true; closeMatchTactics();");
  assert.equal(s.run("resumeCalls"), 0);
  assert.ok(s.element("halftime-overlay").classes.has("active"));
});

test("les nouvelles ancres sont synchronisées une seule fois à la fin de la séquence", () => {
  const s = scenario();
  s.run(`let syncedMinute = null;
    syncChoreoAnchors = minute => { anchorsCalls++; syncedMinute = minute; };
    matchState.sequenceActive = true;
    closeMatchTactics();
    syncPendingMatchTactics();
    syncPendingMatchTactics();`);
  assert.equal(s.run("anchorsCalls"), 0, "aucune synchronisation ne doit couper la séquence calculée");
  assert.equal(s.run("matchState.pendingTacticsSync"), true, "la modification reste en attente de sa frontière");
  s.run("matchState.minute = 9; matchState.sequenceActive = false; syncPendingMatchTactics();");
  assert.equal(s.run("anchorsCalls"), 1);
  assert.equal(s.run("syncedMinute"), 9, "la synchronisation utilise la minute effectivement atteinte");
  assert.equal(s.run("matchState.pendingTacticsSync"), false);
  s.run("syncPendingMatchTactics(); syncPendingMatchTactics();");
  assert.equal(s.run("anchorsCalls"), 1, "les frames suivantes ne doivent pas rejouer la synchronisation");
});

console.log(`${passed}/${passed + failed} régressions d'intégration du glisser-déposer réussies`);
process.exitCode = failed ? 1 : 0;
