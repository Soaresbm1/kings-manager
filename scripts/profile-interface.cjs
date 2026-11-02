"use strict";
// Comparaison locale et reproductible, sans seuil temporel fragile dans la CI.
// Le HEAD Git sert de référence, le disque de version améliorée. Rien n'est écrit dans le jeu.
const fs = require("node:fs"), path = require("node:path"), http = require("node:http");
const { execFileSync } = require("node:child_process");
const { chromium } = require("playwright");
const root = path.resolve(__dirname, "..");
const reference = new Map();
for (const file of ["index.html", "style.css", "app.js"]) reference.set(file, execFileSync("git", ["show", `HEAD:${file}`], { cwd: root, maxBuffer: 4e6 }));
const types = { ".js": "text/javascript", ".css": "text/css", ".html": "text/html", ".png": "image/png" };
let baseline = true;
const server = http.createServer((request, response) => {
  const name = decodeURIComponent(new URL(request.url, "http://localhost").pathname).replace(/^\//, "") || "index.html";
  const filename = path.resolve(root, name);
  const relative = path.relative(root, filename);
  if (relative.startsWith("..") || path.isAbsolute(relative)) { response.writeHead(404).end(); return; }
  try {
    const content = baseline && reference.has(name) ? reference.get(name) : fs.readFileSync(filename);
    response.writeHead(200, { "Content-Type": types[path.extname(filename)] || "application/octet-stream" }); response.end(content);
  } catch { response.writeHead(404).end(); }
});
const percentile = (values, fraction) => [...values].sort((a, b) => a - b)[Math.max(0, Math.ceil(values.length * fraction) - 1)] || 0;
async function measure(browser, baseURL) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  await page.route("**/*", route => new URL(route.request().url()).hostname === "127.0.0.1" ? route.continue() : route.abort());
  await page.addInitScript(() => { let seed = 20261102; Math.random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296); });
  const cdp = await context.newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await page.goto(baseURL);
  await page.locator('#league-sidebar').getByText('France', { exact: false }).click();
  await page.locator('#team-choice').getByText('FC Silmi', { exact: true }).click();
  await page.locator('#btn-start').click();
  await page.locator('#btn-view-notifications').click();
  await page.getByRole('button', { name: 'Compris', exact: true }).click();
  const market = await page.evaluate(() => {
    const samples = [];
    for (let i = 0; i < 5; i++) {
      const start = performance.now(); showTab("transfers"); samples.push(performance.now() - start);
    }
    return { samples, rows: document.querySelectorAll("#market-list tr").length, images: document.querySelectorAll("#market-list img").length };
  });
  await page.locator('[data-tab="calendar"]').click();
  await page.locator('#btn-prepare-match').click();
  await page.locator('#btn-play-match').click();
  await page.locator('#btn-phase-lineup-auto').click();
  const match = await page.evaluate(async () => {
    const costs = [], intervals = [];
    const draw = renderMatchPitchFrame;
    const canvas = document.getElementById("match-pitch-canvas");
    const bounds = canvas.getBoundingClientRect.bind(canvas);
    let geometryReads = 0, draws = 0;
    canvas.getBoundingClientRect = () => { geometryReads++; return bounds(); };
    renderMatchPitchFrame = () => { const start = performance.now(); draw(); costs.push(performance.now() - start); draws++; };
    await new Promise(resolve => {
      let previous = null;
      function frame(time) {
        if (previous !== null) intervals.push(time - previous);
        previous = time;
        if (intervals.length < 120) requestAnimationFrame(frame); else resolve();
      }
      requestAnimationFrame(frame);
    });
    togglePauseMatch();
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const pausedStart = draws;
    await new Promise(resolve => setTimeout(resolve, 500));
    return { costs, intervals, geometryReads, pausedDrawsIn500ms: draws - pausedStart };
  });
  await context.close();
  return {
    market: { rows: market.rows, imageElements: market.images, medianRenderMs: +percentile(market.samples, 0.5).toFixed(2) },
    match: { renderP95Ms: +percentile(match.costs, 0.95).toFixed(2), frameIntervalP95Ms: +percentile(match.intervals, 0.95).toFixed(2), geometryReads: match.geometryReads, pausedDrawsIn500ms: match.pausedDrawsIn500ms }
  };
}
(async () => {
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const browser = await chromium.launch();
  try {
    const baseURL = `http://127.0.0.1:${server.address().port}`;
    const before = await measure(browser, baseURL);
    baseline = false;
    const after = await measure(browser, baseURL);
    const report = { measuredAt: new Date().toISOString(), environment: "Chromium, 1280×800, DPR 2, CPU ralenti ×4 ; réseau externe bloqué. Ce profil ne remplace pas un téléphone physique.", before, after };
    fs.mkdirSync(path.join(root, "test-results"), { recursive: true });
    fs.writeFileSync(path.join(root, "test-results/interface-profile.json"), JSON.stringify(report, null, 2) + "\n");
    console.log(JSON.stringify(report, null, 2));
  } finally { await browser.close(); server.close(); }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
