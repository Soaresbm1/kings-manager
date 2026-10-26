"use strict";
// Réconciliation hors ligne: les preuves sont les JSON; data.js reste autonome.
const fs = require("node:fs");
const path = require("node:path");
const ROOT = path.resolve(__dirname, "..");
const KEYS = ["france", "brazil", "spain", "italy", "germany", "mexico"];
const CHECKED_AT = "2026-10-26";
const BEGIN = "// BEGIN GENERATED ROSTERS — scripts/sync-rosters.cjs";
const END = "// END GENERATED ROSTERS";
const clone = value => JSON.parse(JSON.stringify(value));
function normalizeName(name) {
  return String(name).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ß/g, "ss").replace(/ł/g, "l").toLowerCase().replace(/[^a-z0-9]/g, "");
}
// Équivalences explicites; aucune recherche floue. Gabriel Felipe (Furia) et
// Gabriel Felipe Ribas Acosta (Fluxo) ont des profils officiels distincts.
const ALIAS_GROUPS = [
  ["Álex Guti", "Álex Gutiérrez", "Alex Gutierrez"], ["Sidão Pages", "Sidney Pages"],
  ["Thiago 'TH'", "Thiago 'TH' Brito"], ["Jefferson 'Gegeu'", "Jefferson 'Gegeu' Silva"],
  ["Sergio Fernández", "Sergio Fernández Ortiz"], ["Sergio Herrero", "Herrero"],
  ["Cani Martín", "Martín 'Cani' Rodríguez"], ["Carlos 'Camello' Valdez", "Carlos Camello Valdez"],
  ["José 'Shaggy' Martínez", "José Shaggy Martínez"], ["Marcelo Vieira", "Marcelo"],
  ["Mikhail Prokopev", "Mikhail Prokopiev"], ["Saif-Ayadi", "Saif Ayadi"],
  ["Jhon Palacios", "Jhon Eduar Palacios Mosquera"]
];
const ALIASES = new Map();
for (const group of ALIAS_GROUPS) for (const name of group) ALIASES.set(normalizeName(name), normalizeName(group[0]));
function identity(name, teamId) {
  // Pau Fer (Jijantes) et Pau Fernández (El Barrio) sont deux personnes.
  if (teamId === "jig" && normalizeName(name) === "paufernandez") return "paufer";
  return ALIASES.get(normalizeName(name)) || normalizeName(name);
}
function hash(text) {
  let value = 2166136261;
  for (const char of text) value = Math.imul(value ^ char.charCodeAt(0), 16777619) >>> 0;
  return value;
}
function ageAt(birthDate) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate || "")) return null;
  const [y, m, d] = birthDate.split("-").map(Number);
  const parsed = new Date(Date.UTC(y, m - 1, d));
  if (parsed.getUTCFullYear() !== y || parsed.getUTCMonth() !== m - 1 || parsed.getUTCDate() !== d) return null;
  const age = 2026 - y - (10 < m || (10 === m && 26 < d) ? 1 : 0);
  return age >= 16 && age <= 65 ? age : null;
}
function estimatePlayer(name, pos, birthDate) {
  const seed = hash(identity(name));
  const center = 73 + seed % 7;
  const offsets = { GK: [-12, -9, 5, 7], DEF: [0, -3, 5, 1], MID: [1, 5, -4, 2], ATT: [6, 4, -1, -2] }[pos];
  const attrs = offsets.map((n, i) => Math.max(55, Math.min(91, center + n + ((seed >>> (i * 5)) % 5) - 2)));
  const overall = Math.round(attrs.reduce((sum, n) => sum + n, 0) / 4);
  const stars = Math.max(0, Math.min(5, (overall - 60) / 35 * 5));
  const officialAge = ageAt(birthDate);
  return { name, pos, speed: attrs[0], technique: attrs[1], physical: attrs[2], mental: attrs[3], overall,
    age: officialAge === null ? 23 + seed % 7 : officialAge,
    value: Math.round(overall * 1000 * (0.55 + 0.85 * Math.pow(stars / 5, 1.8))),
    attributesSource: "estimated", ageSource: officialAge === null ? "estimated" : "official-birth-date",
    estimatedFields: ["speed", "technique", "physical", "mental", "overall", "value", ...(officialAge === null ? ["age"] : [])] };
}
function readInputs(root = ROOT) {
  const baseline = JSON.parse(fs.readFileSync(path.join(root, "research/rosters-baseline.json"), "utf8"));
  const docs = Object.fromEntries(KEYS.map(key => [key, JSON.parse(fs.readFileSync(path.join(root, `research/mercato-${key}.json`), "utf8"))]));
  return { baseline, docs };
}
function buildRosters({ baseline, docs }) {
  const sources = {}, oldPlayers = [], decisions = [], candidates = [], output = {};
  for (const key of KEYS) {
    const doc = docs[key];
    if (!doc || doc.leagueKey !== key || doc.checkedAt !== CHECKED_AT) throw new Error(`Source absente/date incohérente: ${key}`);
    for (const source of doc.sources) {
      if (!/^https:\/\//.test(source.url) || (source.publishedAt && source.publishedAt > CHECKED_AT)) throw new Error(`Source invalide/future: ${source.id}`);
      if (sources[source.id] && sources[source.id].url !== source.url) throw new Error(`Source ambiguë: ${source.id}`);
      sources[source.id] = source;
    }
    for (const team of baseline.leagues[key].teams) for (const player of team.players) oldPlayers.push({ player, team, league: key, identity: identity(player.name, team.id) });
  }
  const preferredOrigins = new Map((docs.spain.confirmedTransfers || []).map(move => [identity(move.name, move.fromTeamId), move.fromTeamId]));
  const domesticOwner = { cristianlobato: "jig" };
  function priorPlayer(record, teamId) {
    const matches = oldPlayers.filter(old => old.identity === identity(record.name, teamId));
    return matches.find(old => old.team.id === teamId) || matches.find(old => old.team.id === preferredOrigins.get(identity(record.name, teamId)))
      || matches.sort((a, b) => (b.player.matches || 0) - (a.player.matches || 0))[0];
  }
  function makePlayer(record, team, key, verified, baselineOnly = false) {
    const previous = priorPlayer(record, team.id), person = identity(record.name, team.id);
    const p = previous ? clone(previous.player) : estimatePlayer(record.name, record.pos, record.birthDate);
    delete p.id; delete p.form;
    Object.assign(p, { id: "roster_" + hash(person).toString(36), rosterIdentity: person, name: record.name, pos: record.pos,
      rosterStatus: verified ? "verified" : "retained-unverified", rosterSourceIds: baselineOnly ? [] : record.sourceIds || [], rosterCheckedAt: CHECKED_AT });
    p.attributesSource ||= "legacy-game"; p.ageSource ||= "legacy-game"; p.estimatedFields ||= [];
    const officialAge = ageAt(record.birthDate);
    if (officialAge !== null) {
      p.age = officialAge;
      p.ageSource = "official-birth-date";
      p.estimatedFields = p.estimatedFields.filter(field => field !== "age");
    }
    p.photoClub = previous ? (previous.player.photoClub || previous.team.name) : team.name;
    p.photoLeague = previous ? (previous.player.photoLeague || previous.league) : key;
    p.photoName = previous ? (previous.player.photoName || previous.player.name) : record.name;
    if (previous) p.baselineOrigin = { league: previous.league, teamId: previous.team.id, name: previous.player.name };
    for (const field of ["officialPlayerId", "birthDate", "registrationType", "registrationNote", "availability", "shirtNumber"]) if (record[field] !== undefined) p[field] = record[field];
    return { player: p, key, teamId: team.id, score: verified ? 100 : baselineOnly ? 10 : 40, person };
  }
  for (const key of KEYS) {
    const doc = docs[key], oldLeague = baseline.leagues[key];
    const definitions = doc.teams.every(t => t.rosterStatus === "complete") ? doc.teams : oldLeague.teams;
    const teams = [];
    for (const definition of definitions) {
      const evidence = doc.teams.find(t => t.id === definition.id), prior = oldLeague.teams.find(t => t.id === definition.id);
      if (!evidence) throw new Error(`Équipe sans couverture: ${key}/${definition.id}`);
      const team = { ...(prior ? clone(prior) : { color: "#666666", budget: 300000, coach: "", presidents: [] }), id: evidence.id, name: evidence.name, players: [],
        rosterStatus: evidence.rosterStatus, rosterCheckedAt: CHECKED_AT, rosterSourceIds: evidence.sourceIds || [] };
      if (evidence.coach) team.coach = evidence.coach;
      if (evidence.presidents) team.presidents = evidence.presidents;
      if (evidence.officialTeamId) team.officialTeamId = evidence.officialTeamId;
      teams.push(team);
      if (evidence.rosterStatus === "complete") for (const record of evidence.players) candidates.push(makePlayer(record, team, key, true));
      else for (const old of prior.players) {
        const correction = evidence.players.find(p => identity(p.name, team.id) === identity(old.name, team.id))
          || (evidence.lastPublishedRoster || []).find(p => identity(p.name, team.id) === identity(old.name, team.id));
        candidates.push(makePlayer(correction ? { ...old, ...correction } : old, team, key, false, !correction));
      }
    }
    output[key] = { name: oldLeague.name, teams };
  }
  // Un effectif officiel récent prime sur l'ancienne référence d'un autre tournoi.
  // Les simples observations MENA n'inventent ni départ ni résiliation en Allemagne.
  const byIdentity = new Map();
  for (const candidate of candidates) {
    const previous = byIdentity.get(candidate.person);
    if (!previous) { byIdentity.set(candidate.person, candidate); continue; }
    const owner = domesticOwner[candidate.person];
    const winner = candidate.score > previous.score || (candidate.score === previous.score && candidate.teamId === owner) ? candidate : previous;
    const loser = winner === candidate ? previous : candidate;
    if (winner.score >= 100 && loser.score >= 100 && winner.teamId !== loser.teamId) throw new Error(`Deux inscriptions complètes contradictoires: ${candidate.player.name}`);
    byIdentity.set(candidate.person, winner);
    decisions.push({ name: winner.player.name, retainedAt: `${winner.key}/${winner.teamId}`, historicalReferenceRemoved: `${loser.key}/${loser.teamId}`,
      basis: winner.score >= 100 ? "newer-complete-official-squad" : owner ? "domestic-profile-over-tournament-reference" : "duplicate-legacy-reference-current-affiliation-unverified" });
  }
  for (const candidate of byIdentity.values()) output[candidate.key].teams.find(t => t.id === candidate.teamId).players.push(candidate.player);
  const metadata = {};
  for (const key of KEYS) {
    const doc = docs[key], league = output[key], completeTeams = league.teams.filter(t => t.rosterStatus === "complete").length;
    metadata[key] = { checkedAt: CHECKED_AT, season: doc.season, competition: doc.competition,
      status: completeTeams === league.teams.length ? "complete" : "partial", completeTeams, partialTeams: league.teams.length - completeTeams,
      retainedUnverifiedPlayers: league.teams.reduce((s, t) => s + t.players.filter(p => p.rosterStatus === "retained-unverified").length, 0),
      sourceIds: doc.sources.map(s => s.id), sources: doc.sources, uncertainties: doc.uncertainties || [],
      withdrawnTeamIds: (doc.withdrawnTeams || []).map(t => t.id), observedOutsideAffiliations: doc.observedOutsideAffiliations || [] };
    league.rosterRevision = metadata[key];
    for (const team of league.teams) {
      if (!team.players.some(p => p.pos === "GK") || team.players.length < 7) throw new Error(`Effectif non jouable: ${key}/${team.id}`);
      for (const p of team.players) {
        if (!["GK", "DEF", "MID", "ATT"].includes(p.pos)) throw new Error(`Poste invalide: ${p.name}`);
        for (const id of p.rosterSourceIds) if (!sources[id]) throw new Error(`Source inconnue: ${id}`);
      }
    }
  }
  return { leagues: output, revision: { schemaVersion: 1, checkedAt: CHECKED_AT, leagues: metadata, identityDecisions: decisions }, sources };
}
function renderPlayer(p) {
  const { name, pos, speed, technique, physical, mental, age, ...extras } = p;
  // Évite de recopier les valeurs par défaut du constructeur pour chaque profil.
  for (const field of ["goals", "assists", "rating", "matches", "careerGoals", "careerAssists", "careerMatches", "careerRatingSum", "injuryDaysLeft"]) if (extras[field] === 0) delete extras[field];
  for (const field of ["injured", "suspended"]) if (extras[field] === false) delete extras[field];
  if (extras.injurySeverity === null) delete extras.injurySeverity;
  return `withStats(player(${[name, pos, speed, technique, physical, mental, age].map(v => JSON.stringify(v)).join(", ")}), ${JSON.stringify(extras)})`;
}
function renderGenerated(result) {
  const chunks = [BEGIN, "// Compositions sourcées; notes et âges hérités/estimés explicitement."];
  for (const key of KEYS) {
    chunks.push(`const ${key.toUpperCase()}_TEAMS = [`);
    for (const team of result.leagues[key].teams) {
      const { players, ...fields } = team;
      chunks.push(`  { ...${JSON.stringify(fields)}, players: [`);
      chunks.push(...players.map(p => `    ${renderPlayer(p)},`));
      chunks.push("  ] },");
    }
    chunks.push("];", "");
  }
  chunks.push(`const ROSTER_REVISION = ${JSON.stringify(result.revision, null, 2)};`);
  chunks.push("const ROSTER_SOURCES = Object.assign({}, ...Object.values(ROSTER_REVISION.leagues).map(revision => Object.fromEntries(revision.sources.map(source => [source.id, source]))));");
  chunks.push("const LEAGUES = {");
  for (const key of KEYS) chunks.push(`  ${key}: { name: ${JSON.stringify(result.leagues[key].name)}, teams: ${key.toUpperCase()}_TEAMS, rosterRevision: ROSTER_REVISION.leagues.${key} },`);
  chunks.push("};", END);
  return chunks.join("\n");
}
function updateData(source, result) {
  const block = renderGenerated(result);
  if (source.includes(BEGIN)) return source.slice(0, source.indexOf(BEGIN)) + block + source.slice(source.indexOf(END) + END.length);
  const start = source.indexOf("// ---------------------- LIGUE FRANCE"), stop = source.indexOf("// Plans tactiques offensifs et défensifs");
  if (start < 0 || stop < start) throw new Error("Bornes de génération introuvables");
  return (source.slice(0, start) + block + "\n\n" + source.slice(stop))
    .replace("// Ligues, équipes et joueurs réels de la Kings League (France & Brésil, saison 2025/26)", "// Six ligues: compositions vérifiées le 26/10/2026, couverture partielle signalée par ligue.")
    .replace("overall, // note générale (0-99), basée sur les attributs et les stats réelles du joueur", "overall, // note du jeu (0-99), aucune note officielle Kings League");
}
function main() {
  const dataPath = path.join(ROOT, "data.js"), source = fs.readFileSync(dataPath, "utf8"), result = buildRosters(readInputs()), next = updateData(source, result);
  if (process.argv.includes("--check")) {
    if (source !== next) throw new Error("data.js n'est pas à jour: node scripts/sync-rosters.cjs");
    console.log("Effectifs générés à jour; six dossiers de sources cohérents."); return;
  }
  fs.writeFileSync(dataPath, next);
  console.log(KEYS.map(k => `${k}: ${result.leagues[k].teams.length} équipes, ${result.leagues[k].teams.reduce((s, t) => s + t.players.length, 0)} joueurs, ${result.revision.leagues[k].status}`).join("\n"));
}
module.exports = { KEYS, CHECKED_AT, normalizeName, identity, ageAt, estimatePlayer, readInputs, buildRosters, renderGenerated, updateData };
if (require.main === module) main();
