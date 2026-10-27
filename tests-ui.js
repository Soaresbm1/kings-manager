// Régressions du banc de touche, des sauvegardes tactiques et du score animé.
// Sans navigateur ni dépendance : node tests-ui.js.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

class TestElement {
  constructor() {
    this.children = [];
    this.dataset = {};
    this.attributes = {};
    this.style = {};
    this.textContent = "";
    this.styles = new Set();
    this.classList = { toggle: (key, selected) => selected ? this.styles.add(key) : this.styles.delete(key) };
  }
  appendChild(child) { this.children.push(child); return child; }
  setAttribute(key, value) { this.attributes[key] = value; }
  querySelector(selector) {
    const match = selector.match(/data-mentality="([^"]+)"/);
    return match ? this.children.find(child => child.dataset.mentality === match[1]) || null : null;
  }
}

function createUI() {
  const elements = new Map();
  const document = {
    addEventListener() {},
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, new TestElement());
      return elements.get(id);
    },
    createElement() { return new TestElement(); }
  };
  const context = vm.createContext({ document });
  for (const file of ["data.js", "player-photos.js", "matchengine-actions.js", "engine.js", "matchchoreo.js", "app.js"]) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, file), "utf8"), context, { filename: file });
  }
  const run = code => vm.runInContext(code, context);
  run("STATE.league = JSON.parse(JSON.stringify(LEAGUES.germany)); STATE.userTeamId = STATE.league.teams[0].id;");
  return { run, elements };
}

let passed = 0, failed = 0;
function test(name, body) {
  try { body(); passed++; console.log("OK " + name); }
  catch (error) { failed++; console.error("FAIL " + name + ": " + error.message); }
}

test("le résumé d'un match réduit ignore les titulaires qui ne sont jamais entrés", () => {
  const { run, elements } = createUI();
  run(`
    const homeTeam = STATE.league.teams[0], awayTeam = STATE.league.teams[1];
    const setup = team => ({formation:'1-2-3-1',attackPlan:'possession',defensePlan:'zone',lineup:sanitizeAssignments(team,FORMATION_SLOTS['1-2-3-1'],null)});
    const homeSetup = setup(homeTeam), awaySetup = setup(awayTeam);
    const summaryEngine = createMatchEngine(homeTeam,homeSetup,awayTeam,awaySetup);
    summaryEngine.simulateMinute(1);
    const result = summaryEngine.finalize();
    STATE.pendingResult = {result,homeTeam,awayTeam,homeSetup,awaySetup};
    let displayedScreen = null;
    showScreen = id => {displayedScreen=id;};
    showMatchSummary();
  `);
  assert.equal(run("displayedScreen"), "screen-summary");
  assert.ok(run("result.participants.home.length < homeSetup.lineup.length"));
  assert.equal(elements.get("summary-home-ratings").children.length, run("result.participants.home.length"));
  assert.equal(elements.get("summary-away-ratings").children.length, run("result.participants.away.length"));
});

test("le résumé conserve un joueur sorti et tolère une ancienne note manquante", () => {
  const { run, elements } = createUI();
  run(`
    const homeTeam = STATE.league.teams[0], awayTeam = STATE.league.teams[1];
    const exited = homeTeam.players[0], active = homeTeam.players[1];
    const homeSetup = {lineup:[active.id]}, awaySetup = {lineup:[]};
    const result = {homeGoals:0,awayGoals:0,homeXG:0,awayXG:0,participants:{home:[exited.id,active.id],away:[]},playerStats:{},ratings:{[exited.id]:7.2}};
    STATE.pendingResult = {result,homeTeam,awayTeam,homeSetup,awaySetup};
    showScreen = () => {};
    showMatchSummary();
  `);
  const rows = elements.get("summary-home-ratings").children;
  assert.equal(rows.length, 2);
  assert.ok(rows[0].innerHTML.includes(run("exited.name")));
  assert.ok(rows[0].innerHTML.includes("7.2"));
  assert.ok(rows[1].innerHTML.includes("—"));
  run("delete result.participants; showMatchSummary();");
});

test("ancienne sauvegarde sans intention : une tactique équilibrée reste jouable", () => {
  const { run } = createUI();
  assert.equal(run("sanitizeTactic(null).mentality"), "balanced");
  assert.equal(run("sanitizeTactic({mentality:'unknown'}).mentality"), "balanced");
  assert.equal(run("sanitizeTactic({mentality:'attacking'}).mentality"), "attacking");
});

test("un joueur renommé et transféré conserve le chemin de sa photo d'origine", () => {
  const { run } = createUI();
  assert.equal(run(`legacyPlayerPhotoUrl({name:'Álex Guti',photoName:'Álex Gutiérrez',photoClub:'Porcinos FC',photoLeague:'spain'},{name:'Capim FC',photoLeague:'brazil'})`),
    "images/players/espagne/porcinos-fc/alex-gutierrez.png");
  assert.equal(run(`legacyPlayerPhotoUrl({name:'Kelvin Oliveira'},{name:'G3X FC',photoLeague:'brazil'})`),
    "images/players/bresil/g3x-fc/kelvin-oliveira.png");
});

test("le portrait officiel reste lié à une recrue après transfert et renommage", () => {
  const { run } = createUI();
  assert.equal(run(`officialPlayerPhoto({name:'Nom modifié',officialPlayerId:53010},{name:'Nouveau club',photoLeague:'italy'}).officialPlayerId`), "53010");
  assert.ok(run(`playerPhotoUrl({name:'Kelvin Oliveira',rosterIdentity:'kelvinoliveira'},{name:'G3X FC',photoLeague:'brazil'}).startsWith('https://kingsleague-cdn.kama.football/account/production/')`));
});

test("une ancienne carrière retrouve Sidney et distingue les deux Pau par leur origine", () => {
  const { run } = createUI();
  assert.equal(run(`officialPlayerPhoto({name:'Sidney Pages',photoClub:'Dibrados FC',photoLeague:'brazil'},{name:'Club acheteur'}).name`), "Sidão Pages");
  assert.equal(run(`officialPlayerPhoto({name:'Pau Fernández',photoClub:'Jijantes FC',photoLeague:'spain'},{name:'Club acheteur'}).officialPlayerId`), "72");
  assert.notEqual(run(`officialPlayerPhoto({name:'Pau Fernández',photoClub:'El Barrio',photoLeague:'spain'},{name:'Club acheteur'}).officialPlayerId`), "72");
});

test("une identité non vérifiée ou contradictoire ne reçoit pas le portrait d'un homonyme", () => {
  const { run } = createUI();
  assert.equal(run(`officialPlayerPhoto({name:'Manu García',rosterIdentity:'manugarcia'},{name:'Skull FC',photoLeague:'spain'})`), null);
  assert.equal(run(`playerPhotoUrl({name:'Manu García',rosterIdentity:'manugarcia'},{name:'Skull FC',photoLeague:'spain'})`), "");
  assert.equal(run(`playerPhotoUrl({name:'Charly Dosso',rosterIdentity:'charlydosso'},{name:'360 Nation',photoLeague:'france'})`), "");
  assert.equal(run(`officialPlayerPhoto({name:'Kelvin Oliveira',officialPlayerId:'inconnu',rosterIdentity:'kelvinoliveira'},{name:'G3X FC'})`), null);
  assert.ok(run(`playerPhotoUrl({name:'Joueur non documenté'},{name:'Club test',photoLeague:'france'}).startsWith('images/players/france/club-test/')`));
});

test("un ancien transfert sans origine ne devient pas le portrait d'un homonyme du club acheteur", () => {
  const { run } = createUI();
  run(`
    const oldPau = {id:'pau-transfere-ancien',name:'Pau Fernández',goals:12};
    const buyer = {id:'ebr',name:'El Barrio',players:[oldPau]};
    STATE.leagueKey='spain'; STATE.league={teams:[buyer]}; STATE.otherLeagues=[];
    backfillPhotoClub();
  `);
  assert.equal(run("oldPau.photoIdentityAmbiguous"), true);
  assert.equal(run("officialPlayerPhoto(oldPau,buyer)"), null);
  assert.equal(run("playerPhotoUrl(oldPau,buyer)"), "");
  run("backfillPhotoClub();");
  assert.equal(run("officialPlayerPhoto(oldPau,buyer)"), null, "l'origine de repli ne devient pas une preuve au deuxième chargement");
  assert.equal(run("oldPau.goals"), 12);
  assert.equal(run("oldPau.id"), "pau-transfere-ancien");
  assert.equal(run("officialPlayerPhoto({name:'Pau Fernández'},buyer)"), null);
});

test("l'intention choisie est enregistrée avec la tactique par défaut", () => {
  const { run } = createUI();
  run("tacticsSetup = sanitizeTactic({mentality:'cautious'}); tacticsSetup.persist = true; saveTactic(tacticsSetup);");
  assert.equal(run("STATE.savedTactic.mentality"), "cautious");
});

test("un changement ponctuel en préparation n'écrase pas la tactique par défaut", () => {
  const { run } = createUI();
  run("STATE.savedTactic = {mentality:'cautious'}; tacticsSetup = sanitizeTactic({mentality:'attacking'}); saveTactic(tacticsSetup);");
  assert.equal(run("STATE.savedTactic.mentality"), "cautious");
});

test("les trois consignes restent sélectionnables sans dupliquer les commandes", () => {
  const { run, elements } = createUI();
  run("tacticsSetup = sanitizeTactic({mentality:'cautious'}); renderMentalityChoices(tacticsSetup,'test-choices'); renderMentalityChoices(tacticsSetup,'test-choices');");
  const buttons = elements.get("test-choices").children;
  assert.equal(buttons.length, 3);
  assert.equal(buttons.filter(button => button.attributes["aria-pressed"] === "true").length, 1);
  buttons.find(button => button.dataset.mentality === "attacking").onclick();
  assert.equal(run("tacticsSetup.mentality"), "attacking");
  assert.equal(buttons.filter(button => button.attributes["aria-pressed"] === "true").length, 1);
});

test("les statistiques attendent la fin de la séquence animée", () => {
  const { run, elements } = createUI();
  run(`
    let dashboardReads = 0;
    let futureShots = 3;
    const setup = {mentality:'balanced',defensePlan:'zone'};
    matchState = {userSide:'home',homeSetup:setup,awaySetup:{},homeTeam:{name:'Domicile',players:[]},awayTeam:{name:'Extérieur',players:[]},minute:6,completedMinute:5,sequenceActive:true,dashboardStats:null};
    matchEngine = {
      getLiveStats: () => { dashboardReads++; return {possessionHome:62,home:{shots:futureShots,xG:0.4,passesAttempted:12,passesCompleted:10,stamina:88},away:{shots:2,xG:0.2}}; },
      getActiveLineupIds: () => [1,2,3,4,5,6,7], ESCALIER_END_MINUTE:5, MATCHBALL_START_MINUTE:36
    };
    updateMatchDashboard(true);
    futureShots = 9;
    updateMatchDashboard(false);
  `);
  assert.equal(run("dashboardReads"), 1);
  assert.equal(elements.get("match-live-shots").textContent, "3 — 2");
  run("updateMatchDashboard(true);");
  assert.equal(elements.get("match-live-shots").textContent, "9 — 2");
});

test("le score affiche l'événement joué plutôt que le futur résultat du moteur", () => {
  const { run, elements } = createUI();
  run("matchState = {}; matchEngine = {getScore: () => ({homeGoals:9,awayGoals:7})}; refreshScoreDisplay({homeGoals:1,awayGoals:0});");
  assert.equal(elements.get("match-score").textContent, "1 - 0");
});

test("tous les effectifs réels permettent un sept distinct avec un seul gardien", () => {
  const { run } = createUI();
  const violations = JSON.parse(run(`JSON.stringify(Object.values(LEAGUES).flatMap(league => league.teams.flatMap(team => Object.entries(FORMATION_SLOTS).flatMap(([key,slots]) => {
    const assignments = sanitizeAssignments(team,slots,null);
    const players = assignments.map(id => team.players.find(player => player.id === id));
    return assignments.length === 7 && new Set(assignments).size === 7 && players.every(Boolean) && players.filter(player => player.pos === 'GK').length === 1 ? [] : [team.name+' / '+key];
  }))))`));
  assert.deepEqual(violations, []);
});

test("la composition automatique remplace un titulaire blessé par un joueur disponible", () => {
  const { run } = createUI();
  run("tacticsSetup = sanitizeTactic(null); const injuredId = tacticsSetup.assignments[2]; getUserTeam().players.find(player => player.id === injuredId).injured = true;");
  assert.equal(run("sanitizeAssignments(getUserTeam(),FORMATION_SLOTS[tacticsSetup.formation],tacticsSetup.assignments).includes(injuredId)"), false);
});

function installSpecialScenario(run) {
  run(`
    let specialCalls = [], continuationCalls = 0, decided = false, cardUsed = false, presidentUsed = false;
    matchState = {userSide:'home',homeSetup:{mentality:'balanced',defensePlan:'zone'},awaySetup:{},homeTeam:{name:'Domicile',players:[]},awayTeam:{name:'Extérieur',players:[]},minute:16,completedMinute:15,sequenceActive:true,pendingSpecialActions:[],paused:false,userPaused:false,finished:false};
    function specialResult(kind,minute) {
      specialCalls.push({kind,minute});
      const ev = {type:'phase',text:kind};
      const events = [ev];
      events.sequence = [{type:'phase',duration:0.2,event:ev,from:{x:50,y:50},to:{x:50,y:50}}];
      return events;
    }
    matchEngine = {
      isSpecialActionWindowOpen: minute => minute >= 5 && minute <= 17,
      isCardUsed: () => cardUsed, isPresidentPenaltyUsed: () => presidentUsed,
      isMatchDecided: () => decided,
      activateCard: (side,key,options,minute) => {cardUsed=true; return specialResult('card',minute);},
      triggerPresidentPenalty: (side,minute) => {presidentUsed=true; return specialResult('president',minute);},
      getActiveLineupIds: () => [1,2,3,4,5,6,7], ESCALIER_END_MINUTE:5, MATCHBALL_START_MINUTE:36
    };
    choreo = {loadSequence() {},getState: () => ({})};
    function finishSpecialSequence() {
      const done = matchState.onSequenceDone;
      matchState.onSequenceDone = null;
      matchState.sequenceActive = false;
      if (done) done();
    }
  `);
}

test("une action spéciale attend l'action animée et conserve sa minute de demande", () => {
  const { run, elements } = createUI();
  installSpecialScenario(run);
  assert.equal(run("queueUserSpecialAction('card',{key:'penalty',cardOptions:{}},16)"), true);
  assert.equal(run("specialCalls.length"), 0, "le moteur ne résout pas un penalty au milieu d'une possession déjà calculée");
  assert.equal(elements.get("btn-secret-card").disabled, true);
  assert.equal(elements.get("match-special-status").hidden, false);
  run("matchState.minute=18; matchState.sequenceActive=false; playPendingSpecialActions(() => continuationCalls++);");
  assert.equal(run("specialCalls[0].minute"), 16, "la fenêtre est contrôlée à la demande, pas à la fin de l'animation");
  assert.equal(run("continuationCalls"), 0);
  run("finishSpecialSequence();");
  assert.equal(run("continuationCalls"), 1);
});

test("une demande répétée ne déclenche pas deux fois la même action spéciale", () => {
  const { run } = createUI();
  installSpecialScenario(run);
  assert.equal(run("queueUserSpecialAction('president',{presidentName:'Président'},16)"), true);
  assert.equal(run("queueUserSpecialAction('president',{presidentName:'Président'},16)"), false);
  assert.equal(run("matchState.pendingSpecialActions.length"), 1);
});

test("la mise en attente conserve la continuation et la pause manuelle du joueur", () => {
  const { run } = createUI();
  installSpecialScenario(run);
  run("const originalContinuation = () => continuationCalls++; matchState.onSequenceDone=originalContinuation; matchState.userPaused=true; matchState.paused=true; queueUserSpecialAction('card',{key:'penalty',cardOptions:{}},16); resumeMatchAfterModal();");
  assert.equal(run("matchState.onSequenceDone === originalContinuation"), true);
  assert.equal(run("matchState.paused"), true);
  assert.equal(run("matchState.userPaused"), true);
  assert.equal(run("specialCalls.length"), 0);
});

test("carte et président sont résolus dans l'ordre de leurs animations", () => {
  const { run } = createUI();
  installSpecialScenario(run);
  run("queueUserSpecialAction('card',{key:'penalty',cardOptions:{}},16); queueUserSpecialAction('president',{},16); matchState.sequenceActive=false; playPendingSpecialActions(() => continuationCalls++);");
  assert.equal(run("specialCalls.length"), 1);
  assert.equal(run("specialCalls[0].kind"), "card");
  run("finishSpecialSequence();");
  assert.equal(run("specialCalls.length"), 2);
  assert.equal(run("specialCalls[1].kind"), "president");
  assert.equal(run("continuationCalls"), 0);
  run("finishSpecialSequence();");
  assert.equal(run("continuationCalls"), 1);
});

test("le but décisif annule une action spéciale encore en attente", () => {
  const { run, elements } = createUI();
  installSpecialScenario(run);
  run("queueUserSpecialAction('card',{key:'penalty',cardOptions:{}},16); decided=true; matchState.sequenceActive=false; playPendingSpecialActions(() => continuationCalls++);");
  assert.equal(run("specialCalls.length"), 0);
  assert.equal(run("matchState.pendingSpecialActions.length"), 0);
  assert.equal(run("continuationCalls"), 1);
  assert.equal(elements.get("match-special-status").hidden, true);
  assert.equal(elements.get("btn-secret-card").textContent.includes("en attente"), false);
});

test("avancer rapidement applique la file sans attendre une animation", () => {
  const { run } = createUI();
  installSpecialScenario(run);
  run("queueUserSpecialAction('card',{key:'penalty',cardOptions:{}},16); queueUserSpecialAction('president',{},16); playPendingSpecialActions(() => continuationCalls++,false);");
  assert.equal(run("specialCalls.length"), 2);
  assert.equal(run("continuationCalls"), 1);
  assert.equal(run("matchState.pendingSpecialActions.length"), 0);
});

console.log(`\n${passed}/${passed + failed} vérifications UI réussies`);
process.exitCode = failed ? 1 : 0;
