// Régressions déterministes : aucun événement ne doit suivre le but décisif du Matchball.
// node tests-simulation-engine.js [--original] compare aussi la version avant correction.
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const assert = require("node:assert/strict");

const original = process.argv.includes("--original");
function createScenario() {
  const math = Object.create(Math);
  let seed = 13579;
  math.random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  const context = vm.createContext({ Math: math });
  for (const name of ["data.js", "matchengine-actions.js", "engine.js"]) {
    const relative = original && name === "engine.js" ? path.join(".simulation-review", "original", name) : name;
    vm.runInContext(fs.readFileSync(path.join(__dirname, relative), "utf8"), context, { filename: relative });
  }
  math.random = () => 0.5;
  const [home, away] = vm.runInContext("JSON.parse(JSON.stringify(LEAGUES.germany.teams.slice(0, 2)))", context);
  const setup = team => {
    const chosen = context.chooseAiFormation(team);
    return { formation: chosen.formation, assignments: chosen.assignments, lineup: chosen.assignments.filter(Boolean), attackPlan: "direct", defensePlan: "zone" };
  };
  const engine = context.createMatchEngine(home, setup(home), away, setup(away));
  let goalsRemaining = 1;
  let calls = 0;
  context.planChainCount = () => 3;
  context.simulatePossessionChain = options => {
    calls++;
    if (goalsRemaining === 0 || options.side !== "home") return { outcome: "none" };
    goalsRemaining--;
    const scorer = options.attackers[0];
    return {
      outcome: "goal", scorer, assister: null, gk: options.gk, xG: 0.5,
      touchedIds: [scorer.id], attackStats: { shots: 1, shotsOnTarget: 1, passesAttempted: 0, passesCompleted: 0, clearances: 0, possessionActions: 1 },
      defenseStats: { interceptions: 0, tacklesWon: 0, fouls: 0 },
      beats: [{ type: "goal", side: options.side, playerId: scorer.id, from: { x: 50, y: 85 }, to: { x: 50, y: 100 }, duration: 1 }]
    };
  };
  engine.simulateMinute(35);
  assert.equal(engine.getScore().homeGoals, 1);
  assert.equal(engine.getScore().awayGoals, 0);
  calls = 0;
  return {
    engine,
    context,
    calls: () => calls,
    scoreEveryAttack: () => { goalsRemaining = Infinity; },
    randomSequence(values) {
      let i = 0;
      math.random = () => values[i++] ?? 0.5;
    }
  };
}

const cases = [
  ["Le but gagnant interrompt les possessions restantes de la minute", () => {
    const s = createScenario();
    s.scoreEveryAttack();
    const events = s.engine.simulateMinute(36, { withSequence: true });
    assert.equal(s.engine.isMatchDecided(), true);
    assert.equal(s.engine.getMatchballWinner(), "home");
    assert.equal(s.engine.getScore().homeGoals, 2);
    assert.equal(s.engine.getScore().awayGoals, 0);
    assert.equal(s.calls(), 1);
    assert.equal(events.filter(e => e.type === "goal").length, 1);
    assert.equal(events.sequence.at(-1).event.type, "goal");
  }],
  ["Une minute appelée après la fin ne change ni score, ni statistiques, ni événements", () => {
    const s = createScenario();
    s.scoreEveryAttack();
    s.engine.simulateMinute(36);
    const score = JSON.stringify(s.engine.getScore());
    const stats = JSON.stringify(s.engine.getPlayerStats());
    const calls = s.calls();
    const events = s.engine.simulateMinute(37, { withSequence: true });
    assert.equal(events.length, 0);
    assert.equal(events.sequence.length, 0);
    assert.equal(JSON.stringify(s.engine.getScore()), score);
    assert.equal(JSON.stringify(s.engine.getPlayerStats()), stats);
    assert.equal(s.calls(), calls);
  }],
  ["L'égalité au début du Matchball mène directement aux tirs au but", () => {
    const s = createScenario();
    // Un penalty adverse avant le Matchball remet les équipes à égalité.
    s.randomSequence([0.5, 0, 0.5]);
    s.engine.activateCard("away", "penalty", {}, 35);
    assert.equal(s.engine.getScore().awayGoals, 1);
    const calls = s.calls();
    s.scoreEveryAttack();
    s.randomSequence([]);
    const events = s.engine.simulateMinute(36, { withSequence: true });
    assert.equal(s.engine.isMatchDecided(), true);
    assert.equal(s.engine.getMatchballWinner(), null);
    assert.equal(events.length, 1);
    assert.equal(events[0].type, "phase");
    assert.equal(s.engine.getScore().homeGoals, 1);
    assert.equal(s.calls(), calls);
  }],
  ["Un shootout décisif sur carton jaune coupe les événements et possessions suivants", () => {
    const s = createScenario();
    // blessure évitée, jaune extérieur, choix victime/tireur, tir cadré, pas de fautes, but.
    s.randomSequence([0.5, 0, 0.9, 0.5, 0.5, 0.5, 0.5, 0.5, 0]);
    s.scoreEveryAttack();
    const events = s.engine.simulateMinute(36, { withSequence: true });
    assert.equal(s.engine.isMatchDecided(), true);
    assert.equal(s.engine.getScore().homeGoals, 2);
    assert.equal(s.calls(), 0);
    assert.equal(events.at(-1).type, "goal");
    assert.equal(events.sequence.at(-1).event.type, "goal");
  }],
  ["Un but contre son camp décisif coupe les possessions suivantes", () => {
    const s = createScenario();
    // Pas d'incident de phase ; CSC extérieur puis choix du joueur/placement de la frappe.
    s.randomSequence([0.5, 0.5, 0.5, 0.5, 0, 0.9, 0.5, 0.5]);
    s.scoreEveryAttack();
    const events = s.engine.simulateMinute(36, { withSequence: true });
    assert.equal(s.engine.isMatchDecided(), true);
    assert.equal(s.engine.getScore().homeGoals, 2);
    assert.equal(s.calls(), 0);
    assert.equal(events.at(-1).type, "owngoal");
  }],
  ["Cartes et penalty président ne peuvent plus modifier un match terminé", () => {
    const s = createScenario();
    s.scoreEveryAttack();
    s.engine.simulateMinute(36);
    const before = JSON.stringify(s.engine.getScore());
    // Même un appel tardif portant une ancienne minute valide reste sans effet.
    assert.equal(s.engine.activateCard("away", "penalty", {}, 5).length, 0);
    assert.equal(s.engine.triggerPresidentPenalty("away", 5).length, 0);
    assert.equal(s.engine.isCardUsed("away"), false);
    assert.equal(s.engine.isPresidentPenaltyUsed("away"), false);
    assert.equal(JSON.stringify(s.engine.getScore()), before);
  }]
];
let failed = 0;
for (const [name, run] of cases) {
  try { run(); console.log(`OK ${name}`); }
  catch (error) { failed++; console.error(`ECHEC ${name}\n${error.stack}`); }
}
console.log(`${cases.length - failed}/${cases.length} régressions Matchball réussies${original ? " (source originale)" : ""}`);
process.exitCode = failed ? 1 : 0;
