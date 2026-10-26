// Serveur statique de développement, limité à la machine locale.
// --remote-assets aide une copie sans images ; la CI et la production utilisent
// les assets du dépôt, sans dépendance au déploiement précédent.
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const args = process.argv.slice(2);
const portIndex = args.indexOf("--port");
const port = Number(portIndex >= 0 ? args[portIndex + 1] : process.env.PORT || 4173);
const remoteAssets = args.includes("--remote-assets");
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error("Le port doit être un entier compris entre 1 et 65535.");
  process.exit(1);
}
const mimeTypes = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml", ".webp": "image/webp", ".gif": "image/gif", ".ico": "image/x-icon",
  ".woff": "font/woff", ".woff2": "font/woff2", ".mp3": "audio/mpeg", ".mp4": "video/mp4"
};
function insideRoot(filename) {
  const relative = path.relative(root, filename);
  return relative !== ".." && !relative.startsWith(".." + path.sep) && !path.isAbsolute(relative);
}
const server = http.createServer((request, response) => {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { Allow: "GET, HEAD" }).end();
    return;
  }
  let pathname;
  try { pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname); }
  catch { response.writeHead(400).end("URL invalide"); return; }
  if (pathname.includes("\0") || pathname.includes("\\") || pathname.split("/").some(segment => segment.startsWith(".") || segment === "node_modules")) {
    response.writeHead(404).end("Fichier introuvable");
    return;
  }
  const filename = path.resolve(root, "." + (pathname === "/" ? "/index.html" : pathname));
  if (!insideRoot(filename)) { response.writeHead(404).end("Fichier introuvable"); return; }
  fs.realpath(filename, (resolveError, realFilename) => {
    if (!resolveError && !insideRoot(realFilename)) { response.writeHead(404).end("Fichier introuvable"); return; }
    fs.readFile(realFilename || filename, (error, content) => {
      if (error) {
        if (remoteAssets && /^\/(images|equipes)\//.test(pathname)) {
          response.writeHead(302, { Location: "https://kings-manager.vercel.app" + encodeURI(pathname) }).end();
        } else response.writeHead(404).end("Fichier introuvable");
        return;
      }
      response.writeHead(200, {
        "Content-Type": mimeTypes[path.extname(filename).toLowerCase()] || "application/octet-stream",
        "Content-Length": content.length, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff"
      });
      response.end(request.method === "HEAD" ? undefined : content);
    });
  });
});
server.on("error", error => { console.error(error.message); process.exitCode = 1; });
server.listen(port, "127.0.0.1", () => console.log(`Kings Manager : http://127.0.0.1:${port}${remoteAssets ? " (images de production si absentes)" : ""}`));
