"use strict";
// Récupère les originaux publics sans retouche. Le jeu utilise leurs URL CDN ;
// le cache local permet de contrôler les fichiers sans les dupliquer dans Git.
const fs = require("node:fs/promises"), path = require("node:path"), crypto = require("node:crypto"), vm = require("node:vm");
const ROOT = path.resolve(__dirname, ".."), CACHE = path.join(ROOT, ".cache/player-photos");
const digest = bytes => crypto.createHash("sha256").update(bytes).digest("hex");
async function main() {
  const context = vm.createContext({});
  vm.runInContext(await fs.readFile(path.join(ROOT, "player-photos.js"), "utf8"), context);
  const entries = JSON.parse(vm.runInContext("JSON.stringify(Object.entries(PLAYER_PHOTOS.byIdentity))", context));
  const rejections = JSON.parse(await fs.readFile(path.join(ROOT, "research/player-photo-rejections.json"), "utf8"));
  const rejectedHashes = new Set(rejections.images.map(image => image.sha256));
  await fs.mkdir(CACHE, { recursive: true });
  const records = [];
  let cursor = 0;
  await Promise.all(Array.from({ length: 6 }, async () => {
    while (cursor < entries.length) {
      const [identity, photo] = entries[cursor++];
      const record = { identity, name: photo.name, officialPlayerId: photo.officialPlayerId, imageUrl: photo.imageUrl };
      try {
        const url = new URL(photo.imageUrl);
        if (url.protocol !== "https:" || url.hostname !== "kingsleague-cdn.kama.football" || !/^\/account\/production\/(player|seasonTeamPlayer)\//.test(url.pathname)) throw Error("Source non officielle");
        const basename = digest(photo.imageUrl).slice(0, 20) + path.extname(url.pathname);
        const filename = path.join(CACHE, basename);
        let bytes;
        try { bytes = await fs.readFile(filename); } catch {}
        if (!bytes) {
          let lastError;
          for (let attempt = 0; attempt < 2; attempt++) {
            try {
              const response = await fetch(photo.imageUrl, { signal: AbortSignal.timeout(30000) });
              record.httpStatus = response.status;
              if (!response.ok) throw Error(`HTTP ${response.status}`);
              if (!/^image\/(png|jpeg|webp)(?:;|$)/i.test(response.headers.get("content-type") || "")) throw Error("Réponse non image");
              if (Number(response.headers.get("content-length") || 0) > 12 * 1024 * 1024) throw Error("Image trop volumineuse");
              bytes = Buffer.from(await response.arrayBuffer());
              if (bytes.length > 12 * 1024 * 1024) throw Error("Image trop volumineuse");
              break;
            } catch (error) { lastError = error; }
          }
          if (!bytes) throw lastError;
        }
        const png = bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
        const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
        const webp = bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
        if (!png && !jpeg && !webp) throw Error("Signature de fichier image invalide");
        if (png) {
          record.width = bytes.readUInt32BE(16); record.height = bytes.readUInt32BE(20);
          if (record.width < 64 || record.height < 64) throw Error("Image trop petite pour un portrait");
        }
        const sha256 = digest(bytes);
        if (rejectedHashes.has(sha256)) throw Error("Silhouette générique officielle exclue");
        await fs.writeFile(filename, bytes);
        Object.assign(record, { status: "verified", bytes: bytes.length, sha256, cacheFile: ".cache/player-photos/" + basename });
      } catch (error) { record.status = "failed"; record.error = error.message; }
      records.push(record);
      if (records.length % 100 === 0) console.log(`${records.length}/${entries.length} portraits contrôlés`);
    }
  }));
  records.sort((a, b) => a.identity.localeCompare(b.identity));
  const hashes = new Map();
  for (const r of records.filter(r => r.status === "verified")) {
    const list = hashes.get(r.sha256) || []; list.push(r.identity); hashes.set(r.sha256, list);
  }
  const report = { checkedAt: new Date().toISOString(), total: records.length, verified: records.filter(r => r.status === "verified").length,
    failed: records.filter(r => r.status !== "verified").length, duplicatePortraitGroups: [...hashes.values()].filter(ids => ids.length > 1), records };
  await fs.writeFile(path.join(CACHE, "report.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ total: report.total, verified: report.verified, failed: report.failed, duplicatePortraitGroups: report.duplicatePortraitGroups, report: ".cache/player-photos/report.json" }));
  process.exitCode = report.failed || report.duplicatePortraitGroups.length ? 1 : 0;
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
