// Régressions visuelles déterministes. Passer --original pour vérifier les défauts de main.
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("node:assert/strict");
const context = vm.createContext({});
const sourceRoot = process.argv.includes("--original") ? path.join(__dirname, ".simulation-review/original") : __dirname;
vm.runInContext(fs.readFileSync(path.join(sourceRoot, "matchchoreo.js"), "utf8"), context);
let failures = 0;
function test(name, run) {
  try { run(); console.log("OK " + name); }
  catch (error) { failures++; console.error("FAIL " + name + ": " + error.message); }
}
function player(choreo, id) { return choreo.getState().players.find(p => p.id === id); }
function distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

for (const type of ["pass", "cross"]) {
  test(type + " : le receveur attend loin du passeur, puis rejoint la réception sans saut", () => {
    const c = context.createChoreographer();
    c.setAnchors({ passer: { x: 10, y: 20 }, receiver: { x: 70, y: 65 } }, {});
    c.loadSequence([{ type, side: "home", playerId: "passer", toPlayerId: "receiver", from: { x: 10, y: 20 }, to: { x: 75, y: 65 }, duration: 1 }]);
    const before = player(c, "receiver");
    c.step(1 / 60);
    const after = player(c, "receiver");
    assert(distance(before, after) <= 26 / 60 + 1e-8, "le receveur a été téléporté près du passeur");
    assert(distance(after, c.getState().ball) > 40, "receveur et ballon doivent avoir des trajectoires distinctes");
    c.step(1 - 1 / 60);
    assert(distance(player(c, "receiver"), { x: 75, y: 65 }) < 1e-8);
  });
}

test("réception éloignée : le temps de vol permet au receveur de rejoindre le point visé", () => {
  const c = context.createChoreographer();
  c.setAnchors({ h1: { x: 10, y: 20 }, h2: { x: 80, y: 70 } }, {});
  c.loadSequence([{ type: "pass", side: "home", playerId: "h1", toPlayerId: "h2", from: { x: 10, y: 20 }, to: { x: 30, y: 60 }, duration: 0.2 }]);
  let before = player(c, "h2");
  for (let i = 0; i < 150 && !c.isSequenceDone(); i++) {
    c.step(1 / 60);
    const after = player(c, "h2");
    assert(distance(before, after) <= 26 / 60 + 1e-8, "vitesse du receveur supérieure à celle d'un joueur");
    before = after;
  }
  assert(c.isSequenceDone());
  assert(distance(player(c, "h2"), { x: 30, y: 60 }) < 0.1);
});

test("gardien : le plongeon se déroule pendant le tir, sans saut latéral", () => {
  const c = context.createChoreographer();
  c.setAnchors({ h1: { x: 50, y: 80 } }, { gk: { x: 50, y: 98, pos: "GK" } });
  c.loadSequence([{ type: "shot", side: "home", playerId: "h1", gkId: "gk", from: { x: 50, y: 80 }, to: { x: 59, y: 99 }, duration: 0.5 }]);
  const before = player(c, "gk");
  c.step(1 / 60);
  assert(distance(before, player(c, "gk")) <= 26 / 60 + 1e-8, "plongeon instantané du gardien");
  c.step(0.5);
  assert(Math.abs(player(c, "gk").x - 59) < 0.1);
});

test("interception : le défenseur coupe le trajet pendant la passe", () => {
  const c = context.createChoreographer();
  c.setAnchors({ h1: { x: 20, y: 40 } }, { a1: { x: 50, y: 55 } });
  c.loadSequence([{ type: "pass", side: "home", playerId: "h1", from: { x: 20, y: 40 }, to: { x: 50, y: 50 }, duration: 0.5, interceptorId: "a1", interceptorFrom: { x: 50, y: 55 }, interceptorTo: { x: 50, y: 50 } }]);
  c.step(0.5);
  assert(distance(player(c, "a1"), { x: 50, y: 50 }) < 1e-8, "le défenseur doit être au point d'interception quand le ballon y arrive");
});

test("pressing : un défenseur part de sa position affichée, même si son ancre est éloignée", () => {
  const c = context.createChoreographer();
  c.setAnchors({}, { a1: { x: 80, y: 75 } });
  c.loadSequence([{ type: "press", side: "away", playerId: "a1", from: { x: 50, y: 50 }, to: { x: 45, y: 45 }, duration: 0.2 }]);
  const before = player(c, "a1");
  c.step(1 / 60);
  assert(distance(before, player(c, "a1")) <= 26 / 60 + 1e-8, "le défenseur a sauté sur son ancre au début du pressing");
});
process.exitCode = failures ? 1 : 0;
