const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const Training = require("./club-training.js");
let passed = 0;
const test = (name, run) => { run(); passed++; console.log("OK " + name); };
const player = (id = "one", extra = {}) => ({ id, name: id, form: 80, speed: 70, technique: 70, physical: 70, mental: 70, overall: 70, value: 44747, age: 26, ...extra });
const context = (extra = {}) => ({ team: { id: "own", players: [player(), player("two")] }, season: 1, round: 0, totalRounds: 14, mode: "recovery", ...extra });
const completed = (state, ctx) => { const plan = Training.preview(state, ctx); assert.equal(plan.ok, true, plan.message); const result = Training.commit(state, ctx, { expectedToken: plan.token }); assert.equal(result.ok, true, result.message); return result; };
const apply = (team, result) => ({ ...team, players: team.players.map(player => ({ ...player, ...(result.updates.find(update => update.playerId === player.id)?.patch || {}) })) });

test("une ancienne carrière sans entraînement ne reçoit aucun effet automatique", () => {
  assert.deepEqual(Training.normalize(), { version: 1, last: null, credits: [], history: [] });
  const ctx = context(), before = JSON.stringify(ctx);
  Training.normalize(null); Training.preview(null, ctx);
  assert.equal(JSON.stringify(ctx), before);
});
test("récupération : +2 de forme plafonné à99, sans toucher aux autres attributs", () => {
  const ctx = context({ team: { id: "own", players: [player("one", { form: 98 }), player("two")] } });
  const result = completed(null, ctx);
  assert.deepEqual(result.updates, [{ playerId: "one", patch: { form: 99 } }, { playerId: "two", patch: { form: 82 } }]);
  assert.equal(result.state.history[0].players, 2);
  assert.deepEqual(result.state.credits, []);
});
test("la sélection explicite laisse les autres joueurs inchangés", () => {
  const ctx = context({ playerIds: ["one"] }), before = JSON.stringify(ctx.team.players);
  const result = completed(null, ctx);
  assert.equal(result.updates.length, 1);
  assert.equal(result.updates[0].playerId, "one");
  assert.equal(JSON.stringify(ctx.team.players), before);
});
test("trois séances techniques ne donnent que des crédits, la quatrième ajoute un seul point", () => {
  let state = null, team = context().team;
  for (let round = 0; round < 4; round++) {
    const result = completed(state, context({ team, round, mode: "technique", playerIds: ["one"] }));
    const effect = result.effects[0];
    assert.equal(effect.gain, round === 3);
    assert.equal(effect.creditsAfter, round === 3 ? 0 : round + 1);
    if (round < 3) assert.deepEqual(Object.keys(result.updates[0].patch), ["form"]);
    team = apply(team, result); state = result.state;
  }
  assert.equal(team.players[0].technique, 71);
  assert.equal(team.players[0].form, 72);
  assert.equal(team.players[1].technique, 70);
  assert.equal(team.players[1].form, 80);
});
test("les crédits technique et physique restent indépendants", () => {
  let state = null, team = context().team;
  for (let round = 0; round < 8; round++) {
    const result = completed(state, context({ team, round, mode: round % 2 ? "physical" : "technique", playerIds: ["one"] }));
    team = apply(team, result); state = result.state;
  }
  assert.equal(team.players[0].technique, 71); assert.equal(team.players[0].physical, 71);
  assert.equal(team.players[0].speed, 70); assert.equal(team.players[0].mental, 70);
  assert.deepEqual(state.credits, []);
});
test("la valorisation après gain correspond exactement à la formule existante du moteur", () => {
  const current = player("one", { technique: 71, speed: 68, physical: 77, mental: 72 });
  const ctx = context({ team: { id: "own", players: [current] }, mode: "technique", valueStarMin: 60, valueStarMax: 95 });
  const state = { credits: [{ id: "one", technique: 3, physical: 0 }] };
  const result = completed(state, ctx), expected = { ...current, ...result.updates[0].patch };
  const code = vm.createContext({ target: { ...expected } });
  for (const file of ["data.js", "matchengine-actions.js", "engine.js"]) vm.runInContext(fs.readFileSync(require.resolve("./" + file), "utf8"), code);
  vm.runInContext('Math.random=()=>{throw new Error("Aucun tirage");}; developPlayer(target,6);', code);
  assert.equal(result.updates[0].patch.overall, code.target.overall);
  assert.equal(result.updates[0].patch.value, code.target.value);
});
test("blessés, suspendus et joueurs déjà au plafond sont écartés et ne sont jamais guéris", () => {
  const ctx = context({ team: { id: "own", players: [player("one", { injured: true, injuryDaysLeft: 9 }), player("two", { suspended: true }), player("max", { form: 99 })] } });
  assert.equal(Training.preview(null, ctx).ok, false);
  assert.equal(Training.preview(null, { ...ctx, playerIds: ["one"] }).code, "unavailable-player");
  assert.equal(ctx.team.players[0].injuryDaysLeft, 9);
  assert.equal(Training.preview(null, context({ mode: "physical", team: { id: "own", players: [player("one", { physical: 99 })] } })).ok, false);
});
test("une sélection devenue indisponible invalide tout l’aperçu, sans application partielle", () => {
  const ctx = context({ playerIds: ["one", "two"] }), plan = Training.preview(null, ctx);
  ctx.team.players[1].injured = true;
  const result = Training.commit(null, ctx, { expectedToken: plan.token });
  assert.equal(result.ok, false); assert.equal(result.code, "unavailable-player");
  assert.equal(result.updates, undefined); assert.equal(ctx.team.players[0].form, 80);
});
test("doubleclic, rechargement et import JSON ne permettent pas deux séances sur la même journée", () => {
  const ctx = context(), plan = Training.preview(null, ctx), result = completed(null, ctx);
  assert.equal(Training.commit(result.state, ctx, { expectedToken: plan.token }).code, "already-trained");
  const restored = Training.normalize(JSON.parse(JSON.stringify(result.state)));
  assert.deepEqual(restored, result.state);
  assert.equal(Training.preview(restored, ctx).code, "already-trained");
});
test("la journée suivante et la saison suivante ouvrent une nouvelle séance sans perdre les crédits", () => {
  const ctx = context({ mode: "technique", playerIds: ["one"] }), result = completed(null, ctx);
  assert.equal(Training.preview(result.state, { ...ctx, round: 1 }).ok, true);
  const next = completed(result.state, { ...ctx, season: 2 });
  assert.equal(next.effects[0].creditsBefore, 1); assert.equal(next.effects[0].creditsAfter, 2);
  assert.equal(Training.preview(next.state, ctx).code, "already-trained");
});
test("une confirmation périmée ne remplace pas la forme, les joueurs ou le type de séance", () => {
  const ctx = context(), plan = Training.preview(null, ctx);
  assert.equal(Training.commit(null, { ...ctx, playerIds: ["one"] }, { expectedToken: plan.token }).code, "stale-preview");
  assert.equal(Training.commit(null, { ...ctx, mode: "physical" }, { expectedToken: plan.token }).code, "stale-preview");
  ctx.team.players[0].form--;
  assert.equal(Training.commit(null, ctx, { expectedToken: plan.token }).code, "stale-preview");
  assert.equal(Training.commit(null, ctx).code, "stale-preview");
});
test("partie, composition, résultat non validé, avance du calendrier et fin de saison bloquent la séance", () => {
  for (const blocked of [{ blocked: true }, { activeMatch: true }, { lineupActive: true }, { pendingResult: true }, { advancing: true }])
    assert.equal(Training.preview(null, context(blocked)).code, "busy");
  assert.equal(Training.preview(null, context({ round: 14 })).code, "season-finished");
});
test("les données inconnues ne sont ni réparées silencieusement ni converties en gains", () => {
  assert.equal(Training.preview(null, context({ season: "1" })).code, "invalid-context");
  assert.equal(Training.preview(null, context({ totalRounds: 0 })).code, "invalid-context");
  assert.equal(Training.preview(null, context({ mode: "__proto__" })).code, "invalid-mode");
  assert.equal(Training.preview(null, context({ valueStarMax: 60 })).code, "invalid-values");
  assert.equal(Training.preview(null, context({ playerIds: ["absent"] })).code, "unavailable-player");
  const ctx = context({ mode: "physical", team: { id: "own", players: [player("one", { physical: "70" })] } });
  assert.equal(Training.preview(null, ctx).ok, false);
});
test("les identités sélectionnées sont uniques et un effectif ambigu est refusé", () => {
  assert.equal(completed(null, context({ playerIds: ["one", "one"] })).updates.length, 1);
  assert.equal(Training.preview(null, context({ team: { id: "own", players: [player(), player()] } })).code, "ambiguous-players");
});
test("les crédits hors effectif sont retirés lors d'une séance confirmée seulement", () => {
  const state = { credits: [{ id: "sold", technique: 3, physical: 2 }, { id: "one", technique: 1, physical: 0 }] }, before = JSON.stringify(state);
  const plan = Training.preview(state, context()); assert.equal(plan.ok, true);
  assert.equal(JSON.stringify(state), before);
  const result = completed(state, context());
  assert.deepEqual(result.state.credits, [{ id: "one", technique: 1, physical: 0 }]);
});
test("un historique importé ne peut pas effacer la dernière journée déjà consommée", () => {
  const state = Training.normalize({ history: [{ season: 2, round: 8, mode: "physical", players: 1, gains: 0 }], last: { season: 1, round: 0 } });
  assert.deepEqual(state.last, { season: 2, round: 8 });
  assert.equal(Training.preview(state, context({ season: 2, round: 8 })).code, "already-trained");
});
test("les carrières longues et noms/identités extrêmes restent sous le budget de métadonnées", () => {
  const state = Training.normalize({ credits: Array.from({ length: 500 }, (_, i) => ({ id: String(i) + "x".repeat(155), technique: 3, physical: 3 })),
    history: Array.from({ length: 500 }, (_, i) => ({ season: i + 1, round: 3, mode: "technique", players: 80, gains: 80 })) });
  assert(JSON.stringify(state).length <= Training.MAX_CHARS);
  assert(state.credits.length <= Training.MAX_CREDITS); assert(state.history.length <= Training.MAX_HISTORY);
  assert.deepEqual(state.last, { season: 500, round: 3 });
  const ctx = context({ team: { id: "__proto__", players: [player("__proto__", { name: "王👑<img>".repeat(100) })] } });
  const result = completed(null, ctx); assert.equal(result.updates[0].playerId, "__proto__"); assert.equal({}.polluted, undefined);
});
test("une saison entière de technique donne au plus3points ciblés avec un coût de forme réel", () => {
  let state = null, team = { id: "own", players: [player()] };
  for (let round = 0; round < 14; round++) {
    const result = completed(state, context({ team, round, mode: "technique" }));
    state = result.state; team = apply(team, result);
  }
  assert.equal(team.players[0].technique, 73); assert.equal(team.players[0].physical, 70);
  assert.equal(team.players[0].form, 52); assert.equal(team.players[0].overall, 71);
});
test("des séances alternées récupération/physique restent bornées sur plusieurs saisons", () => {
  let state = null, team = { id: "own", players: [player()] };
  for (let season = 1; season <= 10; season++) for (let round = 0; round < 14; round++) {
    const result = completed(state, context({ team, season, round, mode: round % 2 ? "recovery" : "physical" }));
    state = result.state; team = apply(team, result);
  }
  assert.equal(team.players[0].physical, 87); assert.equal(team.players[0].form, 80);
  assert.equal(team.players[0].speed, 70); assert.equal(team.players[0].technique, 70); assert.equal(team.players[0].mental, 70);
  assert(JSON.stringify(state).length <= Training.MAX_CHARS);
});
test("les aperçus et validations ne consomment aucun hasard et ne mutent aucune entrée", () => {
  const ctx = context({ mode: "technique" }), state = Training.normalize(null), before = JSON.stringify({ ctx, state }), random = Math.random;
  Math.random = () => { throw new Error("Aucun hasard pour l’entraînement"); };
  try { completed(state, ctx); Training.normalize(state); } finally { Math.random = random; }
  assert.equal(JSON.stringify({ ctx, state }), before);
});
console.log(`${passed} tests d’entraînement réussis.`);
