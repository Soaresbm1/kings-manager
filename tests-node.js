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

const context = {};
vm.createContext(context);

["data.js", "matchengine-actions.js", "engine.js", "matchchoreo.js", "tests.js"].forEach(file => {
  const code = fs.readFileSync(path.join(__dirname, file), "utf8");
  vm.runInContext(code, context, { filename: file });
});

const report = context.runAllTests();
report.results.forEach(r => {
  console.log(`${r.pass ? "✅" : "❌"} ${r.name}` + (r.pass ? "" : `\n   ${r.error}`));
});
console.log(`\n${report.passed}/${report.passed + report.failed} tests réussis`);
process.exit(report.failed === 0 ? 0 : 1);
