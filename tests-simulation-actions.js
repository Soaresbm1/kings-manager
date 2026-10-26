// Régressions géométriques du moteur d'actions. Sans dépendance :
// node tests-simulation-actions.js [dossier-des-sources]
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const sourceDir = path.resolve(process.argv[2] || __dirname);
let failed = 0;
let passed = 0;

function runScenario(options) {
  const context = vm.createContext({ options });
  vm.runInContext(fs.readFileSync(path.join(sourceDir, "matchengine-actions.js"), "utf8"), context);
  const serialized = vm.runInContext(`
    function makePlayer(id, pos) {
      return { id, name: id, pos: pos || "MID", speed: 70, technique: 70, physical: 70, mental: 70, form: 70 };
    }
    const carrier = makePlayer("carrier");
    const receiver = makePlayer("receiver", "ATT");
    const attackers = options.receiver ? [carrier, receiver] : [carrier];
    const defenders = (options.defenders || []).map(d => makePlayer(d.id, "DEF"));
    const defAnchors = {};
    (options.defenders || []).forEach(d => { defAnchors[d.id] = { x: d.x, y: d.y }; });
    const atkAnchors = { carrier: options.from || { x: 50, y: 40 } };
    if (options.receiver) atkAnchors.receiver = options.receiver;
    MATCH_BALANCE.chain.maxActions = 1;
    chooseActionType = () => options.action;
    let draw = 0;
    Math.random = () => draw++ === 0 ? 0 : 0.999;
    let shotContext = null;
    if (options.captureShot) {
      computeShotXG = ctx => { shotContext = ctx; return 0.2; };
      resolveShotOutcome = () => "miss";
    }
    const result = simulatePossessionChain({ side: "home", attackers, defenders,
      gk: null, atkAnchors, defAnchors, attackPlanKey: "possession",
      attackMod: 1, defenseMod: 1, earlyPhaseBoost: 1, withSequence: options.withSequence !== false });
    JSON.stringify({ result, shotContext });
  `, context);
  return JSON.parse(serialized);
}

function test(name, body) {
  try { body(); console.log(`PASS ${name}`); passed++; }
  catch (error) { console.error(`FAIL ${name}\n  ${error.message}`); failed++; }
}

test("aucun tacle ni faute sans adversaire", () => {
  const { result } = runScenario({ action: "dribble", defenders: [] });
  assert.equal(result.defenseStats.tacklesWon, 0);
  assert.equal(result.defenseStats.fouls, 0);
  assert.ok(!result.beats.some(b => b.type === "tackle"));
  assert.ok(result.beats.some(b => b.type === "carry" || b.type === "dribble"));
});

test("un défenseur éloigné ne peut pas gagner un duel", () => {
  const { result } = runScenario({ action: "dribble", defenders: [{ id: "far", x: 95, y: 85 }] });
  assert.equal(result.defenseStats.tacklesWon, 0);
  assert.ok(!result.beats.some(b => b.type === "tackle"));
});

test("un défenseur à portée conserve la possibilité de tacler", () => {
  const { result } = runScenario({ action: "dribble", defenders: [{ id: "near", x: 54, y: 40 }] });
  assert.equal(result.defenseStats.tacklesWon, 1);
  assert.ok(result.beats.some(b => b.type === "tackle" && b.playerId === "near"));
});

for (const action of ["short", "cross"]) {
  test(`${action} : l'intercepteur doit pouvoir rejoindre la trajectoire`, () => {
    const { result } = runScenario({ action, from: { x: 10, y: 50 }, receiver: { x: 90, y: 50 },
      defenders: [{ id: "nearPasser", x: 10, y: 57 }, { id: "inLane", x: 50, y: 53 }] });
    const interception = result.beats.find(b => b.type === "interception");
    assert.ok(interception);
    assert.equal(interception.playerId, "inLane");
    assert.deepEqual(interception.from, interception.to);
    assert.equal(interception.from.y, 50);
    const pass = result.beats.find(b => b.type === (action === "cross" ? "cross" : "pass"));
    assert.equal(pass.interceptorId, "inLane");
    assert.deepEqual(pass.interceptorFrom, pass.positionsBefore ? pass.positionsBefore.inLane : { x: 50, y: 53 });
    assert.deepEqual(pass.to, interception.from);
    const distance = Math.hypot(pass.to.x - pass.interceptorFrom.x, pass.to.y - pass.interceptorFrom.y);
    assert.ok(distance <= 26 * pass.duration + 3, "interception hors de portée pendant le vol");
  });
}

test("une passe ratée sans adversaire sur le trajet sort du terrain", () => {
  const { result } = runScenario({ action: "short", from: { x: 10, y: 50 }, receiver: { x: 90, y: 50 },
    defenders: [{ id: "far", x: 50, y: 95 }] });
  assert.equal(result.defenseStats.interceptions, 0);
  assert.ok(!result.beats.some(b => b.type === "interception"));
  const out = result.beats.find(b => b.type === "out");
  assert.ok(out);
  assert.ok(out.to.x === 0 || out.to.x === 100 || out.to.y === 0 || out.to.y === 100);
});

test("le bonus de contre n'est pas une récupération haute", () => {
  const { shotContext } = runScenario({ action: "shot", from: { x: 50, y: 20 }, captureShot: true });
  assert.equal(shotContext.isCounter, true);
  assert.equal(shotContext.isHighRecovery, false);
});

test("une récupération dans le tiers offensif reçoit son propre contexte", () => {
  const { shotContext } = runScenario({ action: "shot", from: { x: 50, y: 80 }, captureShot: true });
  assert.equal(shotContext.isCounter, false);
  assert.equal(shotContext.isHighRecovery, true);
});

test("les matchs sans animation utilisent la même géométrie défensive", () => {
  const { result } = runScenario({ action: "short", from: { x: 10, y: 50 }, receiver: { x: 90, y: 50 },
    defenders: [{ id: "far", x: 50, y: 95 }], withSequence: false });
  assert.equal(result.defenseStats.interceptions, 0);
  assert.equal(result.beats.length, 0);
});

console.log(`\n${passed}/${passed + failed} régressions réussies (${sourceDir})`);
process.exitCode = failed ? 1 : 0;
