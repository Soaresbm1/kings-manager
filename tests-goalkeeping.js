// Un joueur de champ qui dépanne dans les buts ne doit jamais être présent
// deux fois, ni changer définitivement de poste dans la carrière.
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const assert = require("node:assert/strict");
let seed = Number(process.env.TEST_SEED || 20261026) >>> 0;
const math = Object.create(Math);
math.random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
const context = vm.createContext({ Math: math });
for (const filename of ["data.js", "matchengine-actions.js", "engine.js"]) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, filename), "utf8"), context, { filename });
}
const [home, away] = JSON.parse(vm.runInContext("JSON.stringify(LEAGUES.germany.teams.slice(0, 2))", context));
function setup(team) {
  const chosen = context.chooseAiFormation(team);
  return { lineup: chosen.assignments.filter(Boolean), assignments: [...chosen.assignments], formation: chosen.formation,
    attackPlan: "possession", defensePlan: "zone", mentality: "balanced" };
}
const engine = context.createMatchEngine(home, setup(home), away, setup(away));
home.players.filter(player => player.pos === "GK").forEach(player => { player.injured = true; });
const keeper = engine.getGK("home");
assert.ok(keeper, "une équipe privée de gardien doit pouvoir désigner un joueur de champ");
const originalPlayer = home.players.find(player => player.id === keeper.id);
assert.ok(originalPlayer && originalPlayer.pos !== "GK", "le remplaçant doit être un vrai joueur de champ de l'effectif");
assert.equal(keeper.pos, "GK", "le joueur doit être traité comme gardien pendant le match");
const originalRole = originalPlayer.pos;
assert.ok(keeper.physical < originalPlayer.physical, "le gardien de fortune ne doit pas avoir l'efficacité d'un gardien spécialisé");
const events = engine.simulateMinute(6, { withSequence: true });
const active = engine.getActiveLineupIds("home", 6);
assert.equal(active.filter(id => id === keeper.id).length, 1, "le gardien de fortune est dupliqué dans les joueurs actifs");
assert.equal(new Set(active).size, active.length, "aucun joueur ne doit occuper deux rôles à la fois");
const anchors = engine.getFormationAnchors("home", 6);
assert.equal(Object.keys(anchors).length, active.length, "un placement par joueur actif");
assert.equal(Object.values(anchors).filter(point => point.pos === "GK").length, 1, "un seul emplacement de gardien");
assert.equal(anchors[keeper.id].pos, "GK", "le gardien de fortune doit être placé dans les buts");
assert.equal(originalPlayer.pos, originalRole, "le dépannage ne doit pas modifier le poste dans la carrière");
assert.ok(events.sequence.every(beat => [beat.from.x, beat.from.y, beat.to.x, beat.to.y].every(Number.isFinite)), "le match doit rester simulable sans gardien spécialisé");
const result = engine.finalize();
assert.ok(result.participants.home.includes(keeper.id), "le gardien de fortune doit être enregistré parmi les participants");
assert.ok(result.minutesPlayed[keeper.id] > 0, "temps de jeu du gardien de fortune manquant");
console.log("OK gardien de fortune : un seul rôle actif, placement dans les buts, carrière préservée et participation comptabilisée");
