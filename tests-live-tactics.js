// Disponibilités du coach : vrais cartons du moteur, copies de lecture et retours.
// Exécution : node tests-live-tactics.js.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const plain = value => JSON.parse(JSON.stringify(value));
let passed = 0, failed = 0;

function scenario() {
  let calls = 0, queue = [];
  const math = Object.create(Math);
  math.random = () => { calls++; return queue.length ? queue.shift() : 0.5; };
  const context = vm.createContext({ Math: math });
  for (const file of ["data.js", "matchengine-actions.js", "engine.js"]) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, file), "utf8"), context, { filename: file });
  }
  const [home, away] = plain(vm.runInContext("LEAGUES.germany.teams.slice(0, 2)", context));
  const setup = team => {
    const choice = context.chooseAiFormation(team);
    return { formation: choice.formation, assignments: [...choice.assignments], assignmentsOOP: [...choice.assignments],
      formationOOP: choice.formation, lineup: choice.assignments.filter(Boolean), attackPlan: "possession", defensePlan: "zone" };
  };
  const homeSetup = setup(home), awaySetup = setup(away);
  // Isoler les règles de cartons/blessures des duels et buts d'une possession.
  context.planChainCount = () => 0;
  const engine = context.createMatchEngine(home, homeSetup, away, awaySetup);
  return { home, away, homeSetup, awaySetup, engine,
    setRandom(values) { queue = [...values]; }, randomCalls: () => calls };
}

function test(name, run) {
  try { run(); passed++; console.log("OK " + name); }
  catch (error) { failed++; console.error("FAIL " + name + ": " + error.stack); }
}

test("le getter couvre le banc et ses résultats sont indépendants sans hasard ni mutation", () => {
  const s = scenario();
  const injured = s.home.players.find(player => !s.homeSetup.lineup.includes(player.id));
  assert.ok(injured);
  injured.injured = true;
  injured.suspended = true;
  const suspended = s.away.players.find(player => !s.awaySetup.lineup.includes(player.id));
  assert.ok(suspended);
  suspended.suspended = true;
  const before = JSON.stringify([s.home, s.away, s.homeSetup, s.awaySetup, s.engine.getPossessionState()]);
  const randomBefore = s.randomCalls();
  const first = s.engine.getUnavailablePlayers("home", 0);
  const second = s.engine.getUnavailablePlayers("home", 0);
  assert.deepEqual(plain(first), [{ playerId: injured.id, reason: "injury" }]);
  assert.notEqual(first, second);
  assert.notEqual(first[0], second[0]);
  first[0].reason = "red";
  first[0].until = 99;
  first.push({ playerId: "inventé", reason: "injury" });
  assert.deepEqual(plain(s.engine.getUnavailablePlayers("home", 0)), plain(second));
  assert.deepEqual(plain(s.engine.getUnavailablePlayers("away", 0)), [{ playerId: suspended.id, reason: "suspended" }]);
  assert.equal(s.randomCalls(), randomBefore);
  assert.equal(JSON.stringify([s.home, s.away, s.homeSetup, s.awaySetup, s.engine.getPossessionState()]), before);
});

test("un jaune réel expire sans retirer le joueur de la composition et respecte les priorités", () => {
  const s = scenario();
  // Pas de blessure, jaune à domicile, premier joueur de champ, pas de rouge.
  s.setRandom([0.5, 0, 0, 0, 0.5]);
  const events = s.engine.simulateMinute(6);
  const yellow = events.find(event => event.type === "yellow" && event.side === "home");
  assert.ok(yellow, "le moteur doit avoir réellement infligé le carton jaune");
  const id = yellow.playerId;
  const player = s.home.players.find(item => item.id === id);
  assert.ok(s.homeSetup.lineup.includes(id));
  assert.deepEqual(plain(s.engine.getUnavailablePlayers("home", 6)).find(item => item.playerId === id),
    { playerId: id, reason: "yellow", until: 8 });
  assert.ok(!s.engine.getActiveLineupIds("home", 8).includes(id));
  player.injured = true;
  player.suspended = true;
  assert.equal(s.engine.getUnavailablePlayers("home", 6).find(item => item.playerId === id).reason, "injury");
  player.injured = false;
  assert.equal(s.engine.getUnavailablePlayers("home", 6).find(item => item.playerId === id).reason, "suspended");
  player.suspended = false;
  assert.equal(s.engine.getUnavailablePlayers("home", 6).find(item => item.playerId === id).reason, "yellow");
  assert.ok(!s.engine.getUnavailablePlayers("home", 9).some(item => item.playerId === id));
  s.engine.simulateMinute(9);
  assert.ok(s.homeSetup.lineup.includes(id));
  assert.ok(s.engine.getActiveLineupIds("home", 9).includes(id), "le jaune doit retrouver le terrain automatiquement");
});

test("un rouge réel reste indisponible après le remplacement et prime les autres motifs", () => {
  const s = scenario();
  // Pas de blessure/jaune, rouge à domicile, dernier joueur du pool = gardien.
  s.setRandom([0.5, 0.5, 0, 0, 0.999]);
  const events = s.engine.simulateMinute(6);
  const red = events.find(event => event.type === "red" && event.side === "home");
  assert.ok(red, "le moteur doit avoir réellement infligé le carton rouge");
  const id = red.playerId;
  assert.equal(s.home.players.find(player => player.id === id).pos, "GK");
  assert.ok(!s.homeSetup.lineup.includes(id));
  assert.deepEqual(plain(s.engine.getUnavailablePlayers("home", 6)).find(item => item.playerId === id),
    { playerId: id, reason: "red", until: 11 });
  const player = s.home.players.find(item => item.id === id);
  player.injured = true;
  player.suspended = true;
  assert.equal(s.engine.getUnavailablePlayers("home", 6).find(item => item.playerId === id).reason, "red");
  player.injured = false;
  player.suspended = false;
  for (let minute = 7; minute <= 12; minute++) s.engine.simulateMinute(minute);
  assert.deepEqual(plain(s.engine.getUnavailablePlayers("home")).find(item => item.playerId === id),
    { playerId: id, reason: "red" });
  assert.ok(!s.homeSetup.lineup.includes(id), "un gardien expulsé ne revient jamais après les cinq minutes");
  assert.equal(s.homeSetup.lineup.length, 7, "un autre joueur doit avoir remplacé l'expulsé");
});

test("une blessure infligée par le moteur reste signalée après la sortie du joueur", () => {
  const s = scenario();
  s.setRandom([0, 0, 0, 0.5, 0.5, 0.5, 0.5]);
  const events = s.engine.simulateMinute(6);
  const injury = events.find(event => event.type === "injury" && event.side === "home");
  assert.ok(injury, "le moteur doit avoir réellement infligé une blessure");
  assert.ok(!s.homeSetup.lineup.includes(injury.playerId));
  assert.equal(s.engine.getUnavailablePlayers("home", 6).find(item => item.playerId === injury.playerId).reason, "injury");
});

console.log(`${passed}/${passed + failed} régressions de disponibilités réussies`);
process.exitCode = failed ? 1 : 0;
