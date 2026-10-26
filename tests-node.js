// tests-node.js — lance tests.js sous Node, si Node est disponible dans l'environnement (voir
// CLAUDE.md : pas garanti dans ce projet — quand il ne l'est pas, ouvrir tests.html dans un
// navigateur à la place, ça marche sans aucune dépendance).
//
// Charge data.js + matchengine-actions.js + engine.js + matchchoreo.js + tests.js dans un contexte vm PARTAGÉ (exactement
// ce que fait un navigateur avec de simples balises <script> globales, sans bundler ni module) puis
// appelle runAllTests(). Usage : node tests-node.js — sort avec un code de retour non-nul si un
// test échoue, pour pouvoir être branché plus tard sur un hook CI/pre-commit.
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const inputSeed = process.env.TEST_SEED === undefined ? 20261026 : Number(process.env.TEST_SEED);
if (!Number.isInteger(inputSeed) || inputSeed < 0 || inputSeed > 0xffffffff) {
  console.error("TEST_SEED doit être un entier compris entre 0 et 4294967295.");
  process.exit(1);
}
let state = inputSeed >>> 0;
const seededMath = Object.create(Math);
seededMath.random = () => ((state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 4294967296);
const context = vm.createContext({ Math: seededMath });

["data.js", "matchengine-actions.js", "engine.js", "matchchoreo.js", "tests.js"].forEach(file => {
  const code = fs.readFileSync(path.join(__dirname, file), "utf8");
  vm.runInContext(code, context, { filename: file });
});

console.log(`Graine de simulation : ${inputSeed}`);
const report = context.runAllTests({ seed: inputSeed });
report.results.forEach(r => {
  console.log(`${r.pass ? "✅" : "❌"} ${r.name}` + (r.pass ? "" : `\n   ${r.error}`));
});
console.log(`\n${report.passed}/${report.passed + report.failed} tests réussis (graine ${inputSeed})`);
process.exit(report.failed === 0 ? 0 : 1);

