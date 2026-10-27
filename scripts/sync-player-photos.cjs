"use strict";
// Portraits officiels : collecte séparée, génération hors ligne et identités exactes.
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm"), crypto = require("node:crypto");
const roster = require("./sync-rosters.cjs");
const ROOT = path.resolve(__dirname, ".."), CHECKED_AT = "2026-10-27";
const CDN_BASE = "https://kingsleague-cdn.kama.football/account/";
const OBSERVATIONS = "research/player-photo-observations.json";
const REJECTIONS = "research/player-photo-rejections.json";
const normalize = roster.normalizeName;
const stableId = text => crypto.createHash("sha256").update(text).digest("hex").slice(0, 14);
function officialId(url) {
  try { const u = new URL(url); return /^(?:www\.)?kingsleague\.pro$/.test(u.hostname) && u.protocol === "https:"
    ? (u.pathname.match(/^\/(?:en\/players|fr\/joueurs|es\/jugadores|pt\/jogadores|it\/giocatori|de\/spieler)\/(\d+)-/) || [])[1] || null : null; }
  catch { return null; }
}
function imageURL(observed) {
  const text = String(observed || "");
  if (/placeholder|default[-_]?player|silhouette|avatar[-_]?default/i.test(text)) return null;
  let result = text.match(/https:\/\/kingsleague-cdn\.kama\.football\/account\/[^?#\s]+/)?.[0];
  if (!result) { const alias = text.match(/(?:^|\/)kama\/(production\/(?:player|seasonTeamPlayer)\/[^?#\s]+)/); if (alias) result = CDN_BASE + alias[1]; }
  if (!result) return null;
  try { const u = new URL(result); return u.protocol === "https:" && u.hostname === "kingsleague-cdn.kama.football" && !u.username && !u.password
    && /^\/account\/production\/(?:player|seasonTeamPlayer)\/[\w./%-]+\.(?:png|jpe?g|webp)$/i.test(u.pathname) && !u.pathname.includes("..") ? u.href : null; }
  catch { return null; }
}
function cardName(card, supplemental = false) {
  const lines = String(card.label || "").split(/\n+/).map(s => s.trim()).filter(Boolean);
  // Certains joueurs publiés n'ont aucun numéro de maillot (Tommaso Caldera).
  // Le lien doit dans tous les cas être un profil joueur officiel vérifié ensuite.
  if (!lines[0]?.startsWith("#")) return lines[0] || null;
  return lines[0].replace(/^#\d*[\s\u2060]*/, "") || lines[1] || null;
}
function observation(fields) {
  const id = officialId(fields.profileUrl), direct = imageURL(fields.observedImageUrl);
  return { id: "photo-" + stableId([fields.type, fields.leagueKey, fields.teamId, id, fields.observedImageUrl].join("|")),
    ...fields, officialPlayerId: id, imageUrl: direct,
    status: !id ? "rejected-profile-url" : !direct ? "unavailable-image" : "verified" };
}
function collect(root = ROOT) {
  const records = [], sources = [], gaps = [];
  const oldFile = path.join(root, OBSERVATIONS), prior = fs.existsSync(oldFile) ? JSON.parse(fs.readFileSync(oldFile, "utf8")) : { records: [] };
  const hashes = new Map(prior.records.filter(o => o.imageSha256).map(o => [o.imageUrl || o.rejectedImageUrl, o.imageSha256]));
  const rejectionFile = path.join(root, REJECTIONS), imageRejections = JSON.parse(fs.readFileSync(rejectionFile, "utf8"));
  const cacheFile = path.join(root, ".cache/player-photos/report.json");
  if (fs.existsSync(cacheFile)) {
    const downloaded = JSON.parse(fs.readFileSync(cacheFile, "utf8"));
    for (const item of downloaded.records || []) if (item.sha256 && imageURL(item.imageUrl)) hashes.set(imageURL(item.imageUrl), item.sha256);
  }
  for (const rejected of imageRejections.images) {
    rejected.urls = [...new Set([...rejected.urls, ...[...hashes].filter(([, hash]) => hash === rejected.sha256).map(([url]) => url)])].sort();
  }
  fs.writeFileSync(rejectionFile, JSON.stringify(imageRejections, null, 2) + "\n");
  const rosterAliases = {};
  for (const league of Object.values(roster.readInputs(root).baseline.leagues)) for (const team of league.teams) for (const p of team.players) {
    const key = roster.identity(p.name, team.id), names = rosterAliases[key] || (rosterAliases[key] = []);
    for (const name of [p.name, p.photoName]) if (name && !names.includes(name)) names.push(name);
  }
  const folder = path.join(root, ".simulation-review/photo-dom");
  const teamFiles = fs.readdirSync(folder).filter(name => /^(?:france|brazil|spain|italy|germany|mexico)-[a-z0-9]+\.json$/.test(name)).sort();
  if (teamFiles.length !== 60) throw new Error(`Collecte incomplète : ${teamFiles.length}/60 équipes`);
  const extraFiles = fs.readdirSync(folder).filter(name => /^(?:france|brazil|spain|italy|germany|mexico)-(?:directory|profile)-[a-z0-9]+\.json$/.test(name)).sort();
  const files = [...teamFiles, ...extraFiles];
  for (const file of files) {
    const raw = JSON.parse(fs.readFileSync(path.join(folder, file), "utf8"));
    const type = file.includes("-directory-") ? "directory-card" : file.includes("-profile-") ? "profile-fallback" : "team-card";
    sources.push({ leagueKey: raw.leagueKey, teamId: raw.teamId, teamName: raw.name, url: raw.url, checkedAt: raw.checkedAt });
    for (const card of raw.cards || []) {
      const name = cardName(card, type !== "team-card"); if (!name || !officialId(card.profileUrl)) continue;
      const images = (card.images || []).filter(img => imageURL(img.currentSrc || img.src));
      const matching = images.filter(img => normalize(img.alt) === normalize(name));
      const img = matching.length === 1 ? matching[0] : images.length === 1 ? images[0] : null;
      // Le portrait doit être l'image personnelle de la carte de profil, jamais le blason.
      const observed = img?.currentSrc || img?.src || (!images.length ? (card.images?.[0]?.currentSrc || card.images?.[0]?.src) : "") || "";
      records.push(observation({ type, leagueKey: raw.leagueKey, teamId: raw.teamId, teamName: raw.teamId ? raw.name : "",
        name, imageAlt: img?.alt || card.images?.[0]?.alt || "", profileUrl: card.profileUrl,
        evidenceUrl: raw.url, observedImageUrl: observed, checkedAt: raw.checkedAt || CHECKED_AT }));
    }
  }
  const fallbacks = fs.readdirSync(path.join(root, "research")).filter(name => /^player-photos-.+\.json$/.test(name) && name !== "player-photos-report.json").sort().map(name => "research/" + name);
  for (const file of fallbacks) {
    const filename = path.join(root, file); if (!fs.existsSync(filename)) continue;
    const doc = JSON.parse(fs.readFileSync(filename, "utf8"));
    for (const record of doc.records || []) {
      if (!["verified", "official-profile-linked"].includes(record.status)) continue;
      if (record.officialPlayerId != null && String(record.officialPlayerId) !== officialId(record.profileUrl)) throw new Error(`Identifiant de profil contradictoire : ${record.name}`);
      records.push(observation({ type: "profile-fallback", leagueKey: record.leagueKey, teamId: record.teamId,
      teamName: record.teamName || "", name: record.name, rosterIdentity: record.rosterIdentity, imageAlt: record.imageAlt || record.name,
      profileUrl: record.profileUrl, evidenceUrl: record.evidenceUrl || record.profileUrl, observedImageUrl: record.imageUrl, checkedAt: doc.checkedAt || CHECKED_AT }));
    }
    gaps.push(...(doc.gaps || []).map(gap => ({ ...gap, evidenceFile: file })));
  }
  return { schemaVersion: 1, checkedAt: CHECKED_AT, method: "Official named team profile cards and explicitly named profile portraits; exact IDs and published aliases only.",
    sources, rosterAliases, imageRejections, records: rejectImages([...new Map(records.map(record => [record.id, record])).values()].map(o => ({ ...o, imageSha256: hashes.get(o.imageUrl) || null })), imageRejections).sort((a, b) => a.id.localeCompare(b.id)), supplementalGaps: gaps };
}
function rejectImages(records, rejections = { images: [] }) {
  const byHash = new Map(rejections.images.map(item => [item.sha256, item]));
  const byURL = new Map(rejections.images.flatMap(item => item.urls.map(url => [url, item])));
  return records.map(o => {
    const rejected = byHash.get(o.imageSha256) || byURL.get(o.imageUrl || o.rejectedImageUrl);
    return rejected ? { ...o, rejectedImageUrl: o.imageUrl || o.rejectedImageUrl, imageUrl: null, imageSha256: rejected.sha256, status: "rejected-generic-image", rejectionReason: rejected.reason } : o;
  });
}
function loadLeagues(root = ROOT) {
  const context = vm.createContext({}); vm.runInContext(fs.readFileSync(path.join(root, "data.js"), "utf8"), context);
  return JSON.parse(vm.runInContext("JSON.stringify(LEAGUES)", context));
}
function build(leagues, observations) {
  const byIdentity = {}, report = [], all = rejectImages(observations.records, observations.imageRejections);
  const teamNames = Object.fromEntries(Object.entries(leagues).flatMap(([key, league]) => league.teams.map(t => [`${key}/${t.id}`, t.name])));
  const unique = values => [...new Set(values.filter(Boolean))];
  for (const [leagueKey, league] of Object.entries(leagues)) for (const team of league.teams) for (const p of team.players) {
    const person = p.rosterIdentity || roster.identity(p.name, team.id);
    const aliases = unique([p.name, p.photoName, p.baselineOrigin?.name, ...(observations.rosterAliases?.[person] || [])]);
    const names = new Set(aliases.map(name => roster.identity(name, team.id)));
    const explicitId = p.officialPlayerId == null ? null : String(p.officialPlayerId);
    let candidates = all.filter(o => explicitId ? o.officialPlayerId === explicitId
      : (o.rosterIdentity && o.rosterIdentity === person) || names.has(roster.identity(o.name, o.teamId)));
    const related = candidates;
    const sameTeam = candidates.filter(o => o.leagueKey === leagueKey && o.teamId === team.id);
    if (sameTeam.length) candidates = sameTeam;
    const ids = unique(candidates.map(o => o.officialPlayerId));
    const valid = candidates.filter(o => o.status === "verified");
    const base = { leagueKey, teamId: team.id, rosterIdentity: person, name: p.name };
    if (ids.length > 1) { report.push({ ...base, status: "unresolved", reason: "ambiguous-official-identity", candidateIds: ids.sort() }); continue; }
    if (!valid.length) { report.push({ ...base, status: "unresolved", reason: related.some(o => o.status === "rejected-generic-image") ? "generic-portrait-rejected" : related.length ? "official-portrait-unavailable" : "official-identity-not-found", candidateIds: ids }); continue; }
    const priority = { "team-card": 0, "directory-card": 1, "profile-fallback": 2 };
    const chosen = [...valid].sort((a, b) => priority[a.type] - priority[b.type] || a.id.localeCompare(b.id))[0];
    const matchingProfile = all.filter(o => o.officialPlayerId === chosen.officialPlayerId && o.status === "verified");
    const origins = [{ leagueKey, teamId: team.id, teamName: team.name }];
    if (p.baselineOrigin) origins.push({ leagueKey: p.baselineOrigin.league, teamId: p.baselineOrigin.teamId,
      teamName: p.photoClub || teamNames[`${p.baselineOrigin.league}/${p.baselineOrigin.teamId}`] || "" });
    for (const o of matchingProfile) if (o.type === "team-card") origins.push({ leagueKey: o.leagueKey, teamId: o.teamId, teamName: o.teamName });
    byIdentity[person] = { officialPlayerId: chosen.officialPlayerId, name: p.name, imageUrl: chosen.imageUrl, profileUrl: chosen.profileUrl,
      aliases: unique([...aliases, ...matchingProfile.map(o => o.name)]), origins: [...new Map(origins.map(o => [`${o.leagueKey}/${o.teamId}`, o])).values()], sourceIds: [chosen.id] };
    report.push({ ...base, status: "verified", officialPlayerId: chosen.officialPlayerId, observationId: chosen.id, method: chosen.type });
  }
  const verified = report.filter(p => p.status === "verified").length;
  return { runtime: { schemaVersion: 1, checkedAt: observations.checkedAt, byIdentity, unresolvedIdentities: report.filter(p => p.status !== "verified").map(p => p.rosterIdentity) },
    report: { schemaVersion: 1, checkedAt: observations.checkedAt, totalPlayers: report.length, verifiedPlayers: verified, unresolvedPlayers: report.length - verified,
      byLeague: Object.fromEntries(Object.keys(leagues).map(key => [key, { total: report.filter(p => p.leagueKey === key).length, verified: report.filter(p => p.leagueKey === key && p.status === "verified").length }])), players: report } };
}
function render(runtime) {
  const compact = JSON.parse(JSON.stringify(runtime));
  for (const p of Object.values(compact.byIdentity)) { p.imageUrl = p.imageUrl.slice(CDN_BASE.length); p.profileUrl = p.profileUrl.replace(/^https:\/\/(?:www\.)?kingsleague\.pro/, ""); }
  return "// Généré par scripts/sync-player-photos.cjs ; preuves dans research/player-photo-observations.json.\nconst PLAYER_PHOTOS = (() => {\n  const data = " + JSON.stringify(compact) + ";\n"
    + "  const normalize = value => String(value || '').normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').replace(/ß/g,'ss').replace(/ł/g,'l').toLowerCase().replace(/[^a-z0-9]/g,'');\n"
    + "  data.byOfficialId = {}; data.byName = {};\n  Object.entries(data.byIdentity).forEach(([identity,p]) => {\n"
    + `    p.imageUrl = ${JSON.stringify(CDN_BASE)} + p.imageUrl; p.profileUrl = 'https://kingsleague.pro' + p.profileUrl;\n`
    + "    if (data.byOfficialId[p.officialPlayerId] && data.byOfficialId[p.officialPlayerId] !== identity) throw new Error('Portrait officiel ambigu');\n"
    + "    data.byOfficialId[p.officialPlayerId] = identity;\n    p.aliases.forEach(name => { const key=normalize(name); const ids=data.byName[key] || (data.byName[key]=[]); if(!ids.includes(identity)) ids.push(identity); });\n  });\n  return data;\n})();\n";
}
function main() {
  const file = path.join(ROOT, OBSERVATIONS);
  if (process.argv.includes("--collect")) fs.writeFileSync(file, JSON.stringify(collect(), null, 2) + "\n");
  const observations = JSON.parse(fs.readFileSync(file, "utf8")), result = build(loadLeagues(), observations);
  if (JSON.stringify(observations.imageRejections) !== JSON.stringify(JSON.parse(fs.readFileSync(path.join(ROOT, REJECTIONS), "utf8")))) throw new Error("Preuves de rejet modifiées : relancer --collect");
  const outputs = [["player-photos.js", render(result.runtime)], ["research/player-photos-report.json", JSON.stringify(result.report, null, 2) + "\n"]];
  for (const [name, content] of outputs) {
    const filename = path.join(ROOT, name);
    if (process.argv.includes("--check")) { if (fs.readFileSync(filename, "utf8") !== content) throw new Error(`Fichier non reproductible : ${name}`); }
    else fs.writeFileSync(filename, content);
  }
  console.log(JSON.stringify({ verified: result.report.verifiedPlayers, unresolved: result.report.unresolvedPlayers, byLeague: result.report.byLeague }));
}
module.exports = { CHECKED_AT, CDN_BASE, normalize, officialId, imageURL, cardName, rejectImages, collect, loadLeagues, build, render };
if (require.main === module) main();
