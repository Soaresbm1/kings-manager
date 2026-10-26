// Intégration déterministe du ballon continu : moteur → état → chorégraphie.
// Exécution : node tests-continuity-engine.js ; TEST_SEED permet la matrice npm test.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const plain = value => JSON.parse(JSON.stringify(value));
const envSeed = Number(process.env.TEST_SEED || 20261026) >>> 0;
let passed = 0, failed = 0;

function scenario(seed = envSeed) {
  let state = seed >>> 0, randomCalls = 0;
  const math = Object.create(Math);
  const seeded = () => { randomCalls++; state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
  math.random = seeded;
  const context = vm.createContext({ Math: math });
  for (const file of ["data.js", "matchengine-actions.js", "engine.js", "matchchoreo.js"]) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, file), "utf8"), context, { filename: file });
  }
  const [home, away] = plain(vm.runInContext("LEAGUES.germany.teams.slice(0, 2)", context));
  const setup = team => {
    const choice = context.chooseAiFormation(team);
    return { formation: choice.formation, assignments: [...choice.assignments], lineup: choice.assignments.filter(Boolean), attackPlan: "possession", defensePlan: "zone", mentality: "balanced" };
  };
  const homeSetup = setup(home), awaySetup = setup(away);
  const traces = [];
  let minute = 0;
  const original = context.simulatePossessionChain;
  context.simulatePossessionChain = params => {
    const input = plain(params.initialState);
    const result = original(params);
    traces.push({ minute, side: params.side, input, result: plain(result) });
    return result;
  };
  const engine = context.createMatchEngine(home, homeSetup, away, awaySetup);
  return {
    context, engine, home, away, homeSetup, awaySetup, traces,
    simulate(n, withSequence = true) { minute = n; return engine.simulateMinute(n, { withSequence }); },
    randomCalls: () => randomCalls,
    constantRandom(value = 0.5) { math.random = () => { randomCalls++; return value; }; },
    queueRandom(values) { let i = 0; math.random = () => { randomCalls++; return values[i++] ?? 0.5; }; },
    restoreRandom() { math.random = seeded; }
  };
}

function test(name, run) {
  try { run(); passed++; console.log(`PASS ${name}`); }
  catch (error) { failed++; console.error(`FAIL ${name}\n  ${error.stack}`); }
}
function closePoint(actual, expected, label) {
  assert.ok(actual && expected && Math.hypot(actual.x - expected.x, actual.y - expected.y) < 1e-6,
    `${label} : ${JSON.stringify(actual)} ≠ ${JSON.stringify(expected)}`);
}
function ballBeat(beat) { return !["phase", "press"].includes(beat.type); }

test("une possession retenue garde le même porteur et les mêmes positions entre les minutes", () => {
  const s = scenario();
  s.constantRandom();
  s.context.chooseActionType = () => "carry";
  s.context.planChainCount = () => 1;
  vm.runInContext("MATCH_BALANCE.chain.maxActions = 1", s.context);
  s.simulate(6);
  const before = plain(s.engine.getPossessionState());
  const events = s.simulate(7);
  const next = s.traces.find(trace => trace.minute === 7);
  assert.equal(next.side, before.side);
  assert.equal(next.input.carrierId, before.carrierId);
  assert.deepEqual(next.input.ball, before.ball);
  assert.deepEqual(next.input.positions, before.positions);
  assert.equal(next.result.outcome, "retained");
  closePoint(events.sequence.find(ballBeat).from, before.ball, "première action de la minute suivante");
});

test("les pertes de balle relancent l'adversaire au vrai point de récupération", () => {
  const s = scenario(42);
  for (let minute = 1; minute <= 30; minute++) s.simulate(minute);
  let recoveries = 0;
  for (let i = 0; i + 1 < s.traces.length; i++) {
    const current = s.traces[i], next = s.traces[i + 1], end = current.result.endState;
    if (current.result.outcome !== "turnover" || !end || end.restartType || next.minute !== current.minute) continue;
    recoveries++;
    assert.equal(next.side, end.nextSide);
    assert.equal(next.input.carrierId, end.carrierId);
    closePoint(next.input.ball, end.ball, "reprise après récupération");
    closePoint(next.result.beats.find(ballBeat).from, end.ball, "ballon récupéré puis joué");
  }
  assert.ok(recoveries >= 3, `scénario insuffisant : ${recoveries} récupérations`);
});

test("les trajectoires réelles du ballon restent continues sur un match complet", () => {
  for (const seed of new Set([1, 42, envSeed])) {
    const s = scenario(seed);
    let ball = { x: 50, y: 50 }, actions = 0;
    for (let minute = 1; minute <= 40; minute++) {
      const events = s.simulate(minute);
      for (const beat of events.sequence || []) {
        if (!ballBeat(beat)) continue;
        if (beat.type !== "restart") closePoint(beat.from, ball, `graine ${seed}, ${minute}', ${beat.type}`);
        ball = plain(beat.to);
        actions++;
      }
    }
    assert.ok(actions >= 100, `scénario trop court : ${actions} actions`);
  }
});

test("les instantanés de placement se raccordent entre toutes les actions vivantes", () => {
  const s = scenario(1205);
  let previous = null, count = 0;
  for (let minute = 1; minute <= 40; minute++) {
    for (const beat of s.simulate(minute).sequence || []) {
      if (!beat.positionsAfter) continue;
      assert.ok(beat.positionsBefore, `${minute}' ${beat.type} sans positionsBefore`);
      if (previous && beat.type !== "restart") {
        for (const [id, p] of Object.entries(beat.positionsBefore)) {
          if (previous[id]) closePoint(p, previous[id], `${minute}' ${beat.type}, joueur ${id}`);
        }
      }
      previous = plain(beat.positionsAfter);
      count++;
    }
  }
  assert.ok(count >= 100);
});

test("animation activée ou désactivée : même résultat, statistiques et état physique", () => {
  for (const seed of new Set([1, 42, envSeed])) {
    const animated = scenario(seed), instant = scenario(seed);
    for (let minute = 1; minute <= 40; minute++) {
      animated.simulate(minute, true);
      const events = instant.simulate(minute, false);
      assert.equal(events.sequence, undefined);
      assert.deepEqual(plain(animated.engine.getScore()), plain(instant.engine.getScore()), `score graine ${seed}, ${minute}'`);
      assert.deepEqual(plain(animated.engine.getLiveStats()), plain(instant.engine.getLiveStats()), `stats graine ${seed}, ${minute}'`);
      assert.deepEqual(plain(animated.engine.getPossessionState()), plain(instant.engine.getPossessionState()), `positions graine ${seed}, ${minute}'`);
    }
    assert.equal(animated.randomCalls(), instant.randomCalls(), "le rendu ne consomme pas de hasard de simulation");
    const a = animated.engine.finalize(), b = instant.engine.finalize();
    assert.deepEqual(plain(a.ratings), plain(b.ratings));
    assert.deepEqual(plain(a.participants), plain(b.participants));
    assert.deepEqual(plain(a.minutesPlayed), plain(b.minutesPlayed));
  }
});

test("un CSC rare consomme le même hasard avec ou sans animation", () => {
  const animated = scenario(42), instant = scenario(42);
  for (const s of [animated, instant]) {
    s.constantRandom();
    s.simulate(6);
    // Aucun incident de phase, puis CSC extérieur : le dessin du tir ne doit
    // jamais décaler le générateur partagé qui décide des actions suivantes.
    s.queueRandom([0.5, 0.5, 0.5, 0.5, 0, 0.9, 0.5]);
  }
  const a = animated.simulate(7, true), b = instant.simulate(7, false);
  assert.ok(a.some(event => event.type === "owngoal") && b.some(event => event.type === "owngoal"));
  assert.equal(animated.randomCalls(), instant.randomCalls(), "le placement visuel d'un CSC ne doit pas consommer un tirage supplémentaire");
  assert.deepEqual(plain(animated.engine.getScore()), plain(instant.engine.getScore()));
  assert.deepEqual(plain(animated.engine.getPossessionState()), plain(instant.engine.getPossessionState()));
});

test("un CSC rare conserve aussi la trajectoire continue du ballon", () => {
  const s = scenario(42);
  s.constantRandom();
  const previous = s.simulate(6).sequence.filter(ballBeat).at(-1);
  s.queueRandom([0.5, 0.5, 0.5, 0.5, 0, 0.9, 0.5, 0.8]);
  const events = s.simulate(7);
  assert.ok(events.some(event => event.type === "owngoal"));
  let ball = plain(previous.to);
  for (const beat of events.sequence.filter(ballBeat)) {
    if (beat.type !== "restart") closePoint(beat.from, ball, `CSC, ${beat.type}`);
    ball = plain(beat.to);
  }
});

test("les getters fournissent des copies sans muter l'état ni consommer le hasard", () => {
  const s = scenario();
  for (let minute = 1; minute <= 12; minute++) s.simulate(minute);
  const before = plain(s.engine.getPossessionState()), statsBefore = plain(s.engine.getLiveStats()), calls = s.randomCalls();
  const state = s.engine.getPossessionState(), stats = s.engine.getLiveStats();
  state.ball.x = -999;
  state.releasePoint.y = -999;
  state.positions[Object.keys(state.positions)[0]].x = -999;
  state.side = "invalid";
  stats.home.shots = -999;
  stats.away.xG = -999;
  assert.deepEqual(plain(s.engine.getPossessionState()), before);
  assert.deepEqual(plain(s.engine.getLiveStats()), statsBefore);
  assert.equal(s.randomCalls(), calls);
});

test("les joueurs remplacés restent participants, notés et crédités de leurs minutes", () => {
  const s = scenario();
  s.constantRandom();
  s.context.chooseActionType = () => "carry";
  s.simulate(6);
  const outgoing = s.homeSetup.lineup.find(id => s.home.players.find(p => p.id === id).pos !== "GK");
  const outgoingPlayer = s.home.players.find(p => p.id === outgoing);
  const incoming = s.home.players.find(p => p.pos === outgoingPlayer.pos && !s.homeSetup.lineup.includes(p.id))
    || s.home.players.find(p => p.pos !== "GK" && !s.homeSetup.lineup.includes(p.id));
  assert.ok(incoming);
  s.homeSetup.lineup = s.homeSetup.lineup.map(id => id === outgoing ? incoming.id : id);
  s.homeSetup.assignments = s.homeSetup.assignments.map(id => id === outgoing ? incoming.id : id);
  s.simulate(7);
  s.simulate(8);
  const result = s.engine.finalize();
  assert.ok(result.participants.home.includes(outgoing));
  assert.ok(result.participants.home.includes(incoming.id));
  assert.equal(result.minutesPlayed[outgoing], 1);
  assert.equal(result.minutesPlayed[incoming.id], 2);
  assert.ok(Number.isFinite(result.ratings[outgoing]));
  assert.ok(Number.isFinite(result.ratings[incoming.id]));
  assert.ok(!Object.hasOwn(s.engine.getPossessionState().positions, outgoing));
});

test("penalty marqué : tirs, cadrés, xG et score restent cohérents", () => {
  const s = scenario();
  s.constantRandom();
  s.simulate(6);
  const before = s.engine.getLiveStats(), score = s.engine.getScore();
  s.constantRandom(0);
  const events = s.engine.activateCard("home", "penalty", {}, 7);
  assert.ok(events.some(e => e.type === "goal"));
  const after = s.engine.getLiveStats();
  assert.equal(after.home.shots, before.home.shots + 1);
  assert.equal(after.home.shotsOnTarget, before.home.shotsOnTarget + 1);
  assert.ok(after.home.xG > before.home.xG);
  assert.equal(s.engine.getScore().homeGoals, score.homeGoals + 1);
  assert.equal(s.engine.getPossessionState().restartType, "kickoff");
  const result = s.engine.finalize();
  assert.equal(result.homeShots, after.home.shots);
  assert.equal(result.homeShotsOnTarget, after.home.shotsOnTarget);
  assert.equal(result.homeXG, after.home.xG);
});

test("penalty arrêté : l'arrêt, la relance et les statistiques du gardien concordent", () => {
  const s = scenario();
  s.constantRandom();
  s.simulate(6);
  const before = s.engine.getLiveStats(), score = plain(s.engine.getScore());
  s.constantRandom(0.999);
  const events = s.engine.activateCard("away", "penalty", {}, 7);
  assert.ok(events.some(e => e.type === "save"));
  assert.deepEqual(plain(s.engine.getScore()), score);
  const after = s.engine.getLiveStats(), result = s.engine.finalize();
  assert.equal(after.away.shots, before.away.shots + 1);
  assert.equal(after.away.shotsOnTarget, before.away.shotsOnTarget + 1);
  assert.ok(result.homeSaves >= 1);
  assert.equal(s.engine.getPossessionState().side, "home");
  assert.equal(s.engine.getPossessionState().carrierId, s.engine.getGK("home").id);
});

test("la chorégraphie rejoint exactement les positions du moteur, sans dépassement de vitesse", () => {
  const s = scenario(42), choreo = s.context.createChoreographer();
  let checked = 0, movingOffBall = 0;
  for (let minute = 1; minute <= 20; minute++) {
    choreo.setAnchors(s.engine.getFormationAnchors("home", minute), s.engine.getFormationAnchors("away", minute));
    const events = s.simulate(minute);
    for (const beat of events.sequence || []) {
      if (!beat.positionsAfter) continue;
      choreo.loadSequence([beat]);
      let last = plain(choreo.getState());
      let steps = 0;
      while (!choreo.isSequenceDone() && steps++ < 20000) {
        choreo.step(1 / 120);
        const current = plain(choreo.getState());
        const prior = Object.fromEntries(last.players.map(p => [p.id, p]));
        for (const p of current.players) {
          if (!prior[p.id]) continue;
          assert.ok(Math.hypot(p.x - prior[p.id].x, p.y - prior[p.id].y) <= 26 / 120 + 1e-6,
            `${minute}' ${beat.type} : ${p.id} dépasse la vitesse des joueurs`);
          if (p.id !== beat.playerId && p.id !== beat.toPlayerId && Math.hypot(p.x - prior[p.id].x, p.y - prior[p.id].y) > 1e-5) movingOffBall++;
        }
        last = current;
      }
      assert.ok(choreo.isSequenceDone(), "une action doit finir en temps borné");
      const positions = Object.fromEntries(choreo.getState().players.map(p => [p.id, p]));
      for (const [id, p] of Object.entries(beat.positionsAfter)) if (positions[id]) closePoint(positions[id], p, `${minute}' ${beat.type}, position finale ${id}`);
      checked++;
    }
  }
  assert.ok(checked >= 100);
  assert.ok(movingOffBall > 100, "les joueurs sans ballon doivent aussi suivre les placements autoritaires");
});

console.log(`\n${passed}/${passed + failed} intégrations du moteur continu réussies`);
process.exitCode = failed ? 1 : 0;
