// Toutes les suites pures sont découvertes à la racine ; aucune installation
// n'est nécessaire. La matrice varie les scénarios tout en gardant chaque échec reproductible.
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const suites = ["tests-node.js", ...fs.readdirSync(root).filter(name => /^tests-.+\.js$/.test(name) && name !== "tests-node.js").sort()];
const seeds = process.argv.includes("--matrix") ? [1, 42, 20261026] : [process.env.TEST_SEED || 20261026];
let failures = 0;
for (const seed of seeds) {
  for (const suite of suites) {
    console.log(`\n${suite} — graine ${seed}`);
    const result = spawnSync(process.execPath, [path.join(root, suite)], {
      cwd: root, env: { ...process.env, TEST_SEED: String(seed) }, stdio: "inherit", windowsHide: true
    });
    if (result.error) console.error(result.error.message);
    if (result.status !== 0) failures++;
  }
}
console.log(`\n${suites.length * seeds.length - failures}/${suites.length * seeds.length} suites réussies.`);
process.exitCode = failures ? 1 : 0;
