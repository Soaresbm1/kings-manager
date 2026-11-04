// Inventaire déterministe : node scripts/build-pwa-assets.cjs [--check].
// À relancer après une modification du shell. Aucun outil n'est requis en prod.
"use strict";
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const root = path.resolve(__dirname, "..");
const hash = bytes => crypto.createHash("sha256").update(bytes).digest("hex");
function source(relative) { return fs.readFileSync(path.join(root, relative)); }
function text(relative) { return source(relative).toString("utf8").replace(/\r\n/g, "\n"); }
function build() {
  const html = text("index.html"), files = new Set(["index.html", "images/favicon.png"]);
  function include(url) {
    const parsed = new URL(url, "https://kings-manager.invalid/");
    if (parsed.origin !== "https://kings-manager.invalid") return;
    const file = decodeURIComponent(parsed.pathname).replace(/^\//, "");
    if (!file || file.includes("\\") || file.split("/").includes("..")) throw new Error("Asset non local : " + url);
    files.add(file);
  }
  for (const tag of html.matchAll(/<(script|link)\b[^>]*>/gi)) {
    const url = tag[0].match(/\b(?:src|href)=["']([^"']+)["']/i)?.[1];
    if (!url) continue;
    if (tag[1].toLowerCase() === "script" || /\brel=["'](?:stylesheet|manifest|icon|apple-touch-icon)["']/i.test(tag[0])) include(url);
  }
  // Les fontes importées par le CSS font partie du shell ; les portraits lourds
  // restent un cache opportuniste borné, avec les initiales existantes en repli.
  const fontDir = path.join(root, "assets/fonts");
  if (fs.existsSync(fontDir)) for (const file of fs.readdirSync(fontDir)) if (/\.(?:css|woff2)$/.test(file)) files.add("assets/fonts/" + file);
  const manifest = Array.from(files).find(file => /\.(?:webmanifest|json)$/.test(file));
  if (manifest) {
    const data = JSON.parse(text(manifest));
    for (const icon of data.icons || []) include(new URL(icon.src, "https://kings-manager.invalid/" + manifest).href);
  }
  function clubs(dir) {
    for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
      const relative = dir + "/" + entry.name;
      if (entry.isDirectory()) clubs(relative);
      else if (/\.(?:png|jpe?g|svg|webp)$/.test(entry.name)) files.add(relative);
    }
  }
  clubs("images/clubs");
  const assets = Array.from(files).sort().map(file => {
    const isText = /\.(?:html|js|css|json|webmanifest|svg)$/.test(file);
    return { url: "/" + file, sha256: hash(isText ? Buffer.from(text(file), "utf8") : source(file)), text: isText };
  });
  const revision = hash(text("service-worker.js") + "\n" + JSON.stringify(assets));
  return "// Généré par scripts/build-pwa-assets.cjs ; ne pas modifier à la main.\nself.KINGS_PWA_ASSETS = " + JSON.stringify({ schema: 1, revision, assets }, null, 2) + ";\n";
}
if (require.main === module) {
  try {
    const result = build(), output = path.join(root, "pwa-assets.js");
    if (process.argv.includes("--check")) {
      if (!fs.existsSync(output) || text("pwa-assets.js") !== result) throw new Error("Le shell a changé : exécuter node scripts/build-pwa-assets.cjs");
      console.log("Inventaire PWA et empreintes vérifiés.");
    } else { fs.writeFileSync(output, result); console.log("Inventaire PWA généré."); }
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { build };
