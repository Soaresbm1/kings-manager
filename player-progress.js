// Relevés observés de l'effectif. Les périodes non observées restent inconnues.
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.PlayerProgress = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const MAX_CHARS = 48000, MAX_PLAYERS = 80, MAX_SAMPLES = 60;
  const FIELDS = ["overall", "speed", "technique", "physical", "mental", "form", "value", "careerMatches"];
  const finite = value => typeof value === "number" && Number.isFinite(value);
  const integer = (value, low, high) => Number.isInteger(value) && value >= low && value <= high;
  const label = value => typeof value === "string" ? value.slice(0, 120) : "Sans nom";
  const sortSamples = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
  function sample(values) {
    if (!Array.isArray(values) || !integer(values[0], 1, 1000000) || !integer(values[1], 0, 1000000000) || !integer(values[2], 0, 1000000)) return null;
    return values.slice(0, 3).concat(FIELDS.map((field, index) => {
      const value = values[index + 3];
      return finite(value) && value >= 0 && value <= (index < 6 ? 100 : 1e12) ? value : null;
    }));
  }
  function trim(ledger) {
    let removed = 0;
    for (const player of ledger.players) {
      if (player.samples.length > MAX_SAMPLES) { removed += player.samples.length - MAX_SAMPLES; player.samples = player.samples.slice(-MAX_SAMPLES); }
    }
    ledger.players.sort((a, b) => sortSamples(b.samples.at(-1), a.samples.at(-1)) || a.id.localeCompare(b.id, "fr"));
    if (ledger.players.length > MAX_PLAYERS) { removed += ledger.players.slice(MAX_PLAYERS).reduce((n, player) => n + player.samples.length, 0); ledger.players.length = MAX_PLAYERS; }
    let size = JSON.stringify(ledger).length;
    while (size > MAX_CHARS - 32) {
      const eligible = ledger.players.filter(player => player.samples.length > 1).sort((a, b) => sortSamples(a.samples[0], b.samples[0]) || a.id.localeCompare(b.id, "fr"));
      if (eligible.length) size -= JSON.stringify(eligible[0].samples.shift()).length + 1;
      else if (ledger.players.length) size -= JSON.stringify(ledger.players.pop()).length + (ledger.players.length ? 1 : 0);
      else break;
      removed++;
    }
    ledger.omitted = Math.min(1000000000, ledger.omitted + removed);
    // Le compteur lui-même peut prendre quelques caractères supplémentaires.
    if (JSON.stringify(ledger).length > MAX_CHARS && ledger.players.length) { ledger.players.pop(); ledger.omitted++; }
    return ledger;
  }
  function normalize(input) {
    const ledger = { version: 1, omitted: integer(input?.omitted, 0, 1000000000) ? input.omitted : 0, players: [] };
    if (Array.isArray(input?.players)) ledger.omitted = Math.min(1000000000, ledger.omitted + Math.max(0, input.players.length - MAX_PLAYERS));
    const ids = new Set();
    for (const entry of Array.isArray(input?.players) ? input.players.slice(0, MAX_PLAYERS) : []) {
      if (!entry || typeof entry.id !== "string" || !entry.id.length || entry.id.length > 160 || ids.has(entry.id)) continue;
      if (Array.isArray(entry.samples)) ledger.omitted = Math.min(1000000000, ledger.omitted + Math.max(0, entry.samples.length - MAX_SAMPLES));
      const byDay = new Map();
      for (const raw of Array.isArray(entry.samples) ? entry.samples.slice(-MAX_SAMPLES) : []) {
        const point = sample(raw);
        if (point) byDay.set(point.slice(0, 3).join(":"), point);
      }
      const samples = [...byDay.values()].sort(sortSamples);
      if (!samples.length) continue;
      ids.add(entry.id);
      ledger.players.push({ id: entry.id, name: label(entry.name), samples });
    }
    return trim(ledger);
  }
  function observe(input, { players = [], season, day, round } = {}) {
    const ledger = normalize(input);
    if (!integer(season, 1, 1000000) || !integer(day, 0, 1000000000) || !integer(round, 0, 1000000)) return ledger;
    const seen = new Set();
    for (const player of players) {
      if (!player || typeof player.id !== "string" || !player.id.length || player.id.length > 160 || seen.has(player.id)) continue;
      seen.add(player.id);
      const point = sample([season, day, round, ...FIELDS.map(field => player[field])]);
      let entry = ledger.players.find(entry => entry.id === player.id);
      if (!entry) { entry = { id: player.id, name: label(player.name), samples: [] }; ledger.players.push(entry); }
      entry.name = label(player.name);
      const index = entry.samples.findIndex(previous => sortSamples(previous, point) === 0);
      if (index >= 0) entry.samples[index] = point;
      else entry.samples.push(point);
      entry.samples.sort(sortSamples);
    }
    return trim(ledger);
  }
  function series(input, playerId, field = "overall") {
    const ledger = normalize(input), index = FIELDS.indexOf(field);
    const player = ledger.players.find(entry => entry.id === playerId);
    const points = index < 0 ? [] : (player?.samples || []).map(point => ({ season: point[0], day: point[1], round: point[2], value: point[index + 3] }));
    const known = points.filter(point => point.value !== null);
    return { name: player?.name || "Sans nom", field, points, omitted: ledger.omitted,
      delta: known.length >= 2 ? known.at(-1).value - known[0].value : null };
  }
  return { normalize, observe, series, FIELDS, MAX_CHARS, MAX_PLAYERS, MAX_SAMPLES };
});
