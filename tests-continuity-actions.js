// Invariants du ballon et des joueurs entre deux tranches de simulation.
// Exécution : node tests-continuity-actions.js
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
let passed = 0, failed = 0;

function scenario(script, seed = 1205) {
  const context = vm.createContext({ seed });
  vm.runInContext(fs.readFileSync(path.join(__dirname, "matchengine-actions.js"), "utf8"), context);
  return JSON.parse(vm.runInContext(`
    let rngState = seed >>> 0;
    Math.random = () => { rngState = (Math.imul(1664525, rngState) + 1013904223) >>> 0; return rngState / 4294967296; };
    const makePlayer = (id, pos) => ({ id, name: id, pos: pos || "MID", speed: 70, technique: 70, physical: 70, mental: 70, form: 70 });
    const home = [makePlayer("h1"), makePlayer("h2", "ATT"), makePlayer("h3", "DEF")];
    const away = [makePlayer("a1"), makePlayer("a2", "DEF"), makePlayer("a3", "DEF")];
    const homeGK = makePlayer("hg", "GK"), awayGK = makePlayer("ag", "GK");
    const homeAnchors = { h1: { x: 25, y: 35 }, h2: { x: 75, y: 70 }, h3: { x: 40, y: 25 } };
    const awayAnchors = { a1: { x: 60, y: 60 }, a2: { x: 30, y: 75 }, a3: { x: 80, y: 80 } };
    const params = { side: "home", attackers: home, defenders: away, ownGK: homeGK, gk: awayGK,
      atkAnchors: homeAnchors, defAnchors: awayAnchors, attackPlanKey: "possession",
      attackMod: 1, defenseMod: 1, earlyPhaseBoost: 1, withSequence: true };
    const opposite = state => ({ ...params, side: "away", attackers: away, defenders: home,
      ownGK: awayGK, gk: homeGK, atkAnchors: awayAnchors, defAnchors: homeAnchors, initialState: state });
    const output = (() => { ${script} })();
    JSON.stringify(output);
  `, context));
}

function test(name, body) {
  try { body(); passed++; console.log(`PASS ${name}`); }
  catch (error) { failed++; console.error(`FAIL ${name}\n  ${error.message}`); }
}

test("une tranche épuisée conserve porteur, ballon et côté", () => {
  const result = scenario(`
    MATCH_BALANCE.chain.maxActions = 1; chooseActionType = () => "carry";
    const first = simulatePossessionChain({ ...params, defenders: [], initialState: {
      carrierId: "h1", ball: { x: 37, y: 46 }, positions: { h1: { x: 37, y: 46 } }, isCounter: true } });
    const second = simulatePossessionChain({ ...params, defenders: [], initialState: first.endState });
    return { first, second };
  `);
  assert.equal(result.first.outcome, "retained");
  assert.equal(result.first.endState.nextSide, "home");
  assert.equal(result.first.endState.carrierId, "h1");
  assert.deepEqual(result.first.beats[0].from, { x: 37, y: 46 });
  assert.deepEqual(result.second.beats[0].from, result.first.endState.ball);
  assert.deepEqual(result.second.beats[0].positionsBefore, result.first.endState.positions);
  assert.equal(result.second.endState.isCounter, true);
});

test("une passe cible la position réelle du partenaire", () => {
  const result = scenario(`
    MATCH_BALANCE.chain.maxActions = 1; chooseActionType = () => "short"; Math.random = () => 0;
    return simulatePossessionChain({ ...params, attackers: home.slice(0, 2), defenders: [], initialState: {
      carrierId: "h1", ball: { x: 30, y: 40 }, positions: { h1: { x: 30, y: 40 }, h2: { x: 70, y: 65 } } } });
  `);
  const pass = result.beats.find(b => b.type === "pass");
  assert.deepEqual(pass.to, { x: 70, y: 65 });
  assert.equal(result.endState.carrierId, "h2");
  assert.deepEqual(result.endState.ball, pass.to);
  assert.deepEqual(result.endState.positions.h2, pass.to);
});

test("une interception relance exactement au point de contact", () => {
  const result = scenario(`
    MATCH_BALANCE.chain.maxActions = 1; chooseActionType = () => "short"; Math.random = () => 0.999;
    const first = simulatePossessionChain({ ...params, attackers: home.slice(0, 2), defenders: away.slice(0, 2),
      atkAnchors: { h1: { x: 10, y: 50 }, h2: { x: 90, y: 50 } },
      defAnchors: { a1: { x: 10, y: 57 }, a2: { x: 50, y: 53 } },
      initialState: { carrierId: "h1", ball: { x: 10, y: 50 } } });
    chooseActionType = () => "carry";
    const second = simulatePossessionChain(opposite(first.endState));
    return { first, second };
  `);
  const interception = result.first.beats.find(b => b.type === "interception");
  assert.ok(interception);
  assert.equal(result.first.endState.nextSide, "away");
  assert.equal(result.first.endState.carrierId, interception.playerId);
  assert.equal(result.first.endState.restartType, null);
  assert.deepEqual(result.first.endState.ball, interception.to);
  const firstBallBeat = result.second.beats.find(b => b.type !== "press");
  assert.deepEqual(firstBallBeat.from, interception.to);
  assert.equal(firstBallBeat.playerId, interception.playerId);
});

test("un arrêt donne le ballon au gardien pour sa relance", () => {
  const result = scenario(`
    MATCH_BALANCE.chain.maxActions = 1; chooseActionType = () => "shot"; resolveShotOutcome = () => "save";
    const first = simulatePossessionChain({ ...params, defenders: [], initialState: {
      carrierId: "h2", ball: { x: 50, y: 80 }, isCounter: false, isHighRecovery: false } });
    chooseActionType = () => "short"; Math.random = () => 0;
    const second = simulatePossessionChain({ ...opposite(first.endState), defenders: [] });
    return { first, second };
  `);
  assert.equal(result.first.outcome, "save");
  assert.equal(result.first.endState.carrierId, "ag");
  assert.equal(result.first.endState.nextSide, "away");
  assert.deepEqual(result.first.endState.positions.ag, result.first.endState.ball);
  assert.equal(result.first.endState.isCounter, false);
  const pass = result.second.beats.find(b => b.type === "pass");
  assert.equal(pass.playerId, "ag");
  assert.deepEqual(pass.from, result.first.endState.ball);
});

for (const action of ["carry", "clear"]) {
  test(`un gardien seul peut ${action === "carry" ? "conduire" : "dégager"} sans perdre son état`, () => {
    const result = scenario(`
      MATCH_BALANCE.chain.maxActions = 1; chooseActionType = () => "${action}";
      return simulatePossessionChain({ ...params, attackers: [], defenders: [], initialState: {
        carrierId: "hg", ball: { x: 50, y: 5 }, positions: { hg: { x: 50, y: 5 } } } });
    `);
    assert.notEqual(result.outcome, "none");
    assert.equal(result.beats[0].playerId, "hg");
    assert.ok(Number.isFinite(result.endState.ball.x) && Number.isFinite(result.endState.ball.y));
    assert.ok(result.endState.positions.hg);
    if (action === "carry") {
      assert.equal(result.endState.nextSide, "home");
      assert.equal(result.endState.carrierId, "hg");
      assert.deepEqual(result.endState.positions.hg, result.endState.ball);
    } else {
      assert.equal(result.endState.restartType, "looseBall");
      assert.equal(result.endState.carrierId, null);
    }
  });
}

for (const [shotOutcome, restartType] of [["goal", "kickoff"], ["miss", "goalKick"]]) {
  test(`${shotOutcome} : reprise explicite et dernier point du ballon conservé`, () => {
    const result = scenario(`
      MATCH_BALANCE.chain.maxActions = 1; chooseActionType = () => "shot"; resolveShotOutcome = () => "${shotOutcome}";
      return simulatePossessionChain({ ...params, defenders: [], initialState: { carrierId: "h2", ball: { x: 50, y: 80 } } });
    `);
    assert.equal(result.endState.restartType, restartType);
    assert.equal(result.endState.nextSide, "away");
    assert.equal(result.endState.releasePoint.y, 100);
    assert.deepEqual(result.endState.releasePoint, result.beats.at(-1).to);
    if (shotOutcome === "goal") assert.deepEqual(result.endState.ball, { x: 50, y: 50 });
    else assert.equal(result.endState.carrierId, "ag");
  });
}

test("les positions sont continues et les courses ont une vitesse bornée", () => {
  const result = scenario(`
    MATCH_BALANCE.chain.maxActions = 6;
    return simulatePossessionChain({ ...params, initialState: { carrierId: "h1", ball: { x: 25, y: 35 } } });
  `);
  let previous = null;
  for (const beat of result.beats) {
    if (previous) assert.deepEqual(beat.positionsBefore, previous);
    for (const [id, position] of Object.entries(beat.positionsAfter)) {
      const origin = beat.positionsBefore[id];
      assert.ok(Math.hypot(position.x - origin.x, position.y - origin.y) <= 26 * beat.duration + 1e-7, `${id} dépasse la vitesse maximale`);
    }
    previous = beat.positionsAfter;
  }
  assert.deepEqual(result.endState.positions, previous);
});

test("les joueurs sans ballon se déplacent dans le même état que les actions", () => {
  const result = scenario(`
    MATCH_BALANCE.chain.maxActions = 1; chooseActionType = () => "carry";
    return simulatePossessionChain({ ...params, defenders: [], initialState: { carrierId: "h1", ball: { x: 37, y: 46 } } });
  `);
  assert.notDeepEqual(result.endState.positions.h2, result.beats[0].positionsBefore.h2);
  assert.deepEqual(result.endState.positions, result.beats.at(-1).positionsAfter);
});

test("aucune mutation du contexte fourni par l'appelant", () => {
  const result = scenario(`
    MATCH_BALANCE.chain.maxActions = 2; chooseActionType = () => "carry";
    const initialState = { carrierId: "h1", ball: { x: 37, y: 46 }, positions: {
      h1: { x: 37, y: 46 }, h2: { x: 70, y: 65 }, a1: { x: 80, y: 80 } } };
    const before = JSON.stringify(initialState);
    simulatePossessionChain({ ...params, initialState });
    return { before, after: JSON.stringify(initialState) };
  `);
  assert.equal(result.before, result.after);
});

test("les chemins animé et instantané produisent le même état", () => {
  const script = withSequence => `
    return simulatePossessionChain({ ...params, withSequence: ${withSequence}, initialState: {
      carrierId: "h1", ball: { x: 25, y: 35 }, isCounter: false, isHighRecovery: false } });
  `;
  const animated = scenario(script(true));
  const instant = scenario(script(false));
  assert.equal(instant.beats.length, 0);
  assert.equal(animated.outcome, instant.outcome);
  assert.deepEqual(animated.endState, instant.endState);
  assert.deepEqual(animated.attackStats, instant.attackStats);
  assert.deepEqual(animated.defenseStats, instant.defenseStats);
});

test("un dégagement sans receveur atteignable reste un ballon libre", () => {
  const result = scenario(`
    MATCH_BALANCE.chain.maxActions = 1; chooseActionType = () => "clear"; Math.random = () => 0.5;
    return simulatePossessionChain({ ...params, defenders: away.slice(0, 1), defAnchors: { a1: { x: 95, y: 95 } },
      initialState: { carrierId: "h1", ball: { x: 20, y: 20 } } });
  `);
  assert.equal(result.endState.restartType, "looseBall");
  assert.equal(result.endState.carrierId, null);
  assert.deepEqual(result.endState.ball, result.beats.at(-1).to);
});

test("une passe déclarée sortie ne traverse pas le but entre les poteaux", () => {
  const result = scenario(`
    MATCH_BALANCE.chain.maxActions = 1; chooseActionType = () => "short"; Math.random = () => 0.999;
    return simulatePossessionChain({ ...params, attackers: home.slice(0, 2), defenders: [], initialState: {
      carrierId: "h1", ball: { x: 50, y: 40 }, positions: { h1: { x: 50, y: 40 }, h2: { x: 50, y: 70 } } } });
  `);
  const out = result.beats.find(b => b.type === "out");
  assert.ok(out);
  assert.equal(out.to.y, 100);
  assert.ok(out.to.x < 41 || out.to.x > 59);
  assert.equal(result.endState.restartType, "goalKick");
});

test("la mentalité change les risques choisis sans changer le mode équilibré", () => {
  const result = scenario(`
    const ctx = { carrier: home[0], zone: "mid", pressure: 0.4, attackPlanKey: "possession",
      pos: { x: 50, y: 50 }, side: "home", actionsLeft: 4, hasPassOptions: true };
    const frequencies = {};
    ["legacy", "balanced", "cautious", "attacking"].forEach(mentality => {
      rngState = 12345;
      const counts = {};
      for (let i = 0; i < 10000; i++) {
        const action = chooseActionType(mentality === "legacy" ? ctx : { ...ctx, mentality });
        counts[action] = (counts[action] || 0) + 1;
      }
      frequencies[mentality] = counts;
    });
    return frequencies;
  `);
  assert.deepEqual(result.legacy, result.balanced);
  assert.ok(result.cautious.short > result.attacking.short);
  assert.ok(result.attacking.through > result.cautious.through);
  assert.ok(result.attacking.progressive > result.cautious.progressive);
});

test("la mentalité fait monter ou reculer le bloc sans téléportation", () => {
  const simulate = mentality => scenario(`
    MATCH_BALANCE.chain.maxActions = 1; chooseActionType = () => "carry";
    return simulatePossessionChain({ ...params, mentality: "${mentality}", defenseMentality: "${mentality}",
      initialState: { carrierId: "h1", ball: { x: 25, y: 35 } } });
  `);
  const cautious = simulate("cautious"), attacking = simulate("attacking");
  assert.ok(attacking.endState.positions.h2.y > cautious.endState.positions.h2.y);
  assert.ok(attacking.endState.positions.a3.y < cautious.endState.positions.a3.y);
});

console.log(`\n${passed}/${passed + failed} invariants de continuité réussis`);
process.exitCode = failed ? 1 : 0;
