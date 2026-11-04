const assert = require("node:assert/strict");
const Promises = require("./player-promises.js");
let passed = 0;
const test = (name, run) => { run(); passed++; console.log("OK " + name); };
const player = (extra = {}) => ({ id: "one", name: "Un joueur", pos: "MID", form: 70, ...extra });
const notification = (templateIdx, extra = {}) => ({ id: "request" + templateIdx, type: "message", templateIdx, playerId: "one", ...extra });
const accept = (kind = 0, ledger = null, options = {}) => Promises.accept(ledger, { notification: notification(kind), player: player(), season: 1, day: 0, ...options });
const match = (fixtureKey, options = {}) => ({ fixtureKey, season: 1, day: 7, teamPlayers: [player()], eligibleIds: ["one"], participants: ["one"], minutesPlayed: { one: 10 }, initialLineup: ["one"], initialRoles: { one: "creator" }, ...options });

test("les quatre demandes annoncent une exigence concrète avant l'accord", () => {
  for (let kind = 0; kind < 4; kind++) {
    const preview = Promises.preview(notification(kind), player(), null);
    assert.equal(preview.supported, true); assert.equal(preview.canAccept, true);
    assert(preview.requirement.length > 40); assert.match(preview.detail, /12 rencontres/);
  }
  assert.equal(Promises.preview({ type: "boardObjective" }, player()).supported, false);
});
test("accepter n'ajoute aucun bonus immédiat et ne modifie aucun argument", () => {
  const p = player(), n = notification(0), before = JSON.stringify({ p, n });
  const accepted = accept(0, null, { player: p, notification: n });
  assert.equal(accepted.accepted, true); assert.equal(accepted.ledger.entries[0].status, "active");
  assert.equal(JSON.stringify({ p, n }), before); assert.equal(p.form, 70);
});
test("le même message et les promesses contradictoires d'un joueur ne se cumulent pas", () => {
  const first = accept();
  assert.equal(accept(0, first.ledger).accepted, false);
  assert.equal(accept(1, first.ledger).accepted, false);
});
test("un message ancien sans identifiant reçoit une identité déterministe", () => {
  const first = accept(0, null, { notification: notification(0, { id: undefined }) });
  assert.equal(first.accepted, true);
  assert.deepEqual(first, accept(0, null, { notification: notification(0, { id: undefined }) }));
});
test("un gardien ne peut pas recevoir une fausse promesse de rôle offensif", () => {
  const proposal = Promises.preview(notification(3), player({ pos: "GK" }), null);
  assert.equal(proposal.canAccept, false); assert.match(proposal.reason, /Aucun rôle offensif/);
  assert.equal(accept(3, null, { player: player({ pos: "GK" }) }).accepted, false);
});
test("deux matchs de cinq minutes tiennent la promesse de temps de jeu", () => {
  let state = accept().ledger;
  let result = Promises.evaluate(state, match("first", { minutesPlayed: { one: 5 } }));
  assert.equal(result.ledger.entries[0].status, "active"); assert.deepEqual(result.effects, []);
  result = Promises.evaluate(result.ledger, match("second", { day: 14, minutesPlayed: { one: 5 } }));
  assert.equal(result.ledger.entries[0].status, "kept"); assert.equal(result.effects[0].delta, 2);
});
test("une participation trop courte ne suffit pas et la sanction n'arrive qu'à l'échéance", () => {
  let state = accept().ledger;
  for (let index = 0; index < 3; index++) {
    const result = Promises.evaluate(state, match("m" + index, { minutesPlayed: { one: 4 } })); state = result.ledger;
    assert.equal(result.effects.length, index === 2 ? 1 : 0);
    if (index === 2) { assert.equal(result.effects[0].delta, -3); assert.equal(state.entries[0].status, "broken"); }
  }
});
test("la même rencontre et la même résolution ne produisent pas deux réactions", () => {
  const state = accept().ledger;
  const first = Promises.evaluate(state, match("same"));
  assert.deepEqual(Promises.evaluate(first.ledger, match("same")), { ledger: first.ledger, effects: [] });
  const kept = Promises.evaluate(first.ledger, match("next"));
  assert.deepEqual(Promises.evaluate(kept.ledger, match("next")).effects, []);
});
test("le repos est jugé sur la participation réelle, pas le seul banc final", () => {
  const kept = Promises.evaluate(accept(1).ledger, match("rest", { participants: [], minutesPlayed: {} }));
  assert.equal(kept.ledger.entries[0].status, "kept");
  const broken = Promises.evaluate(accept(1).ledger, match("played", { participants: ["one"], minutesPlayed: { one: 1 } }));
  assert.equal(broken.ledger.entries[0].status, "broken");
});
test("la place dans le groupe utilise la vraie composition initiale", () => {
  const kept = Promises.evaluate(accept(2).ledger, match("selected", { participants: [], minutesPlayed: {} }));
  assert.equal(kept.ledger.entries[0].status, "kept");
  const waiting = Promises.evaluate(accept(2).ledger, match("bench", { initialLineup: [], participants: ["one"] }));
  assert.equal(waiting.ledger.entries[0].status, "active"); assert.equal(waiting.ledger.entries[0].ok, 0);
});
test("le rôle offensif exige la préparation initiale et cinq minutes réellement jouées", () => {
  const kept = Promises.evaluate(accept(3).ledger, match("offensive", { minutesPlayed: { one: 5 } }));
  assert.equal(kept.ledger.entries[0].status, "kept");
  const waiting = Promises.evaluate(accept(3).ledger, match("late-role", { initialRoles: { one: "ball_winner" } }));
  assert.equal(waiting.ledger.entries[0].ok, 0);
  assert.equal(Promises.evaluate(accept(3).ledger, match("unknown", { initialRoles: undefined })).ledger.entries[0].n, 0);
});
test("les blessures et suspensions au coup d'envoi reportent l'échéance sans sanction", () => {
  let state = accept().ledger;
  for (let index = 0; index < 4; index++) state = Promises.evaluate(state, match("unavailable" + index, { eligibleIds: [] })).ledger;
  assert.equal(state.entries[0].n, 0); assert.equal(state.entries[0].wait, 4); assert.equal(state.entries[0].status, "active");
});
test("une nouvelle blessure pendant le match reporte un échec, sans annuler un objectif déjà tenu", () => {
  const waiting = Promises.evaluate(accept().ledger, match("injured", { teamPlayers: [player({ injured: true })], minutesPlayed: { one: 1 } }));
  assert.equal(waiting.ledger.entries[0].n, 0); assert.equal(waiting.ledger.entries[0].last, "injured_during");
  const counted = Promises.evaluate(accept().ledger, match("played-enough", { teamPlayers: [player({ injured: true })], minutesPlayed: { one: 7 } }));
  assert.equal(counted.ledger.entries[0].n, 1); assert.equal(counted.ledger.entries[0].ok, 1);
});
test("les preuves manquantes restent inconnues et un ancien match n'est pas évalué", () => {
  const state = accept(0, null, { day: 10 }).ledger;
  assert.deepEqual(Promises.evaluate(state, match("past", { day: 3 })).ledger, state);
  const unknown = Promises.evaluate(state, match("unknown", { day: 11, participants: undefined, minutesPlayed: undefined }));
  assert.equal(unknown.ledger.entries[0].n, 0); assert.equal(unknown.ledger.entries[0].last, "unknown");
  assert.equal(Promises.evaluate(state, { fixtureKey: "absent-team" }).ledger.entries[0].status, "active");
});
test("un départ du club classe l'engagement sans malus, jamais sans preuve de l'effectif", () => {
  const state = accept().ledger;
  assert.deepEqual(Promises.reconcile(state), state);
  const cancelled = Promises.reconcile(state, { players: [], season: 1, day: 5 });
  assert.equal(cancelled.entries[0].status, "cancelled"); assert.equal(cancelled.entries[0].last, "left");
  assert.deepEqual(Promises.evaluate(state, match("gone", { teamPlayers: [] })).effects, []);
});
test("après douze rencontres inévaluables le classement est neutre et borné", () => {
  let state = accept().ledger;
  for (let index = 0; index < 12; index++) {
    const result = Promises.evaluate(state, match("missing" + index, { eligibleIds: [] }));
    assert.deepEqual(result.effects, []); state = result.ledger;
  }
  assert.equal(state.entries[0].status, "cancelled"); assert.equal(state.entries[0].last, "review_limit");
  assert.equal(state.entries[0].seen.length, 0);
});
test("le changement de saison conserve les engagements sans inventer des matchs", () => {
  const state = accept().ledger;
  const result = Promises.evaluate(state, match("next-season", { season: 2, day: 0 }));
  assert.equal(result.ledger.entries[0].s, 1); assert.equal(result.ledger.entries[0].n, 1);
});
test("normalisation et export/import conservent une promesse valide, sans hasard ni mutation", () => {
  const state = accept().ledger, context = match("one"), before = JSON.stringify({ state, context }), random = Math.random;
  Math.random = () => { throw new Error("Pas de hasard pour les promesses"); };
  try { Promises.evaluate(state, context); assert.deepEqual(Promises.normalize(JSON.parse(JSON.stringify(state))), state); }
  finally { Math.random = random; }
  assert.equal(JSON.stringify({ state, context }), before);
});
test("les noms hostiles et identités réservées restent du texte sans pollution", () => {
  const result = accept(0, null, { player: player({ id: "__proto__", name: '<img onerror=alert(1)>王👑'.repeat(20) }), notification: notification(0, { playerId: "__proto__" }) });
  assert.equal(result.accepted, true); assert.equal(result.ledger.entries[0].pid, "__proto__");
  assert(result.ledger.entries[0].name.length <= 64); assert.equal({}.polluted, undefined);
});
test("les promesses actives et archives gardent leurs bornes de nombre et de stockage", () => {
  let state = null;
  for (let index = 0; index < 20; index++) {
    const pid = "p" + index + "x".repeat(150), p = player({ id: pid, name: "王".repeat(200) });
    const result = accept(0, state, { player: p, notification: notification(0, { id: "n" + index, playerId: pid }), season: 1000000, day: 999999999 });
    assert.equal(result.accepted, true); state = result.ledger;
  }
  const players = state.entries.map(entry => player({ id: entry.pid }));
  for (let index = 0; index < 11; index++) state = Promises.evaluate(state, match("wait" + index, { season: 1000000, day: 1000000000, teamPlayers: players, eligibleIds: [] })).ledger;
  assert.equal(state.entries.filter(entry => entry.status === "active").length, 20);
  assert(JSON.stringify(state).length <= Promises.MAX_CHARS);
  assert.equal(accept(0, state, { player: player({ id: "extra" }), notification: notification(0, { playerId: "extra" }) }).accepted, false);
  for (let index = 0; index < 100; index++) {
    const pid = "history" + index, p = player({ id: pid });
    state = accept(1, { ...state, entries: state.entries.filter(entry => entry.status !== "active") }, { player: p, notification: notification(1, { id: pid, playerId: pid }) }).ledger;
    state = Promises.evaluate(state, match("rest" + index, { teamPlayers: [p], eligibleIds: [pid], participants: [], minutesPlayed: {} })).ledger;
  }
  assert(state.entries.length <= Promises.MAX_HISTORY); assert(state.omitted > 0); assert(JSON.stringify(state).length <= Promises.MAX_CHARS);
});
test("un enregistrement résolu en double ne peut pas redevenir actif", () => {
  const initial = accept(1).ledger;
  const kept = Promises.evaluate(initial, match("rest", { participants: [], minutesPlayed: {} })).ledger;
  const normalized = Promises.normalize({ entries: [...initial.entries, ...kept.entries] });
  assert.equal(normalized.entries.length, 1); assert.equal(normalized.entries[0].status, "kept");
  assert.deepEqual(Promises.evaluate(normalized, match("replay")).effects, []);
});
test("un message déjà archivé est annoncé comme traité avant une seconde réponse", () => {
  const kept = Promises.evaluate(accept(1).ledger, match("rest", { participants: [], minutesPlayed: {} })).ledger;
  const preview = Promises.preview(notification(1), player(), kept);
  assert.equal(preview.canAccept, false); assert.match(preview.reason, /déjà été traité/);
  assert.equal(accept(1, kept).accepted, false);
});
test("le contexte de calendrier identifie aussi un ancien message sans id déjà archivé", () => {
  const legacy = notification(1, { id: undefined });
  const accepted = accept(1, null, { notification: legacy }).ledger;
  const kept = Promises.evaluate(accepted, match("rest-legacy", { participants: [], minutesPlayed: {} })).ledger;
  assert.equal(Promises.preview(legacy, player(), kept, { season: 1, day: 0 }).canAccept, false);
  assert.equal(accept(1, kept, { notification: legacy }).accepted, false);
  assert.equal(Promises.preview(legacy, player(), kept, { season: 1, day: 8 }).canAccept, true);
});
test("les caractères JSON échappés ne permettent pas de dépasser le budget des données importées", () => {
  const oversized = "\u0000".repeat(160);
  assert.equal(accept(0, null, { player: player({ id: oversized }), notification: notification(0, { playerId: oversized }) }).accepted, false);
  let state = null;
  for (let index = 0; index < 20; index++) {
    const pid = "p" + index + "\\".repeat(75), p = player({ id: pid, name: "\u0000".repeat(64) });
    const next = accept(0, state, { player: p, notification: notification(0, { id: "escaped" + index, playerId: pid }), season: 1000000, day: 1000000000 });
    assert.equal(next.accepted, true); state = next.ledger;
  }
  const players = state.entries.map(entry => player({ id: entry.pid }));
  for (let index = 0; index < 11; index++) state = Promises.evaluate(state, match("escaped-wait" + index, { season: 1000000, day: 1000000000, teamPlayers: players, eligibleIds: [] })).ledger;
  assert.equal(state.entries.length, 20); assert(JSON.stringify(state).length <= Promises.MAX_CHARS);
});
console.log(`${passed} tests de promesses réussis.`);
