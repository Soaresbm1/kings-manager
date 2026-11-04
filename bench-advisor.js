// Conseil déterministe sur des relevés déjà présentés, jamais sur une minute à venir.
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.BenchAdvisor = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const ELIGIBLE = { GK: ["GK"], DEF: ["DEF", "MID"], MID: ["DEF", "MID", "ATT"], ATT: ["MID", "ATT"] };
  const energy = value => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100 ? Math.round(value) : null;
  function build({ observation, assignments = [], slots = [], finished = false } = {}) {
    if (!observation) return { minute: null, players: [], alerts: [], suggestions: [] };
    const active = new Set(observation.activeIds || []);
    const unavailable = new Map((observation.unavailable || []).map(entry => [entry.playerId, entry.reason]));
    const players = (observation.players || []).map(player => ({ ...player, energy: energy(player.energy),
      active: active.has(player.id), selected: assignments.includes(player.id), unavailable: unavailable.get(player.id) || (player.injured ? "injury" : player.suspended ? "suspended" : null) }));
    const alerts = players.filter(player => player.active && !player.unavailable && player.energy !== null && player.energy < 72)
      .sort((a, b) => a.energy - b.energy || String(a.id).localeCompare(String(b.id), "fr"));
    const suggestions = [];
    const used = new Set();
    if (!finished) for (const outgoing of alerts) {
      const index = assignments.indexOf(outgoing.id), slot = slots[index];
      if (index < 0 || !slot) continue;
      const candidates = players.filter(incoming => !incoming.selected && !incoming.active && !incoming.unavailable && !used.has(incoming.id)
        && incoming.energy !== null && incoming.energy >= outgoing.energy + 8
        && (Object.prototype.hasOwnProperty.call(ELIGIBLE, incoming.pos) ? ELIGIBLE[incoming.pos] : []).includes(slot.pos))
        .sort((a, b) => Number(b.pos === slot.pos) - Number(a.pos === slot.pos) || b.energy - a.energy || (b.overall || 0) - (a.overall || 0) || String(a.id).localeCompare(String(b.id), "fr"));
      if (!candidates.length) continue;
      const incoming = candidates[0]; used.add(incoming.id);
      suggestions.push({ outId: outgoing.id, inId: incoming.id, outName: outgoing.name, inName: incoming.name,
        outEnergy: outgoing.energy, inEnergy: incoming.energy, slotIndex: index, pos: slot.pos, natural: incoming.pos === slot.pos });
      if (suggestions.length === 2) break;
    }
    return { minute: observation.minute, players, alerts, suggestions,
      changed: (observation.assignments || []).join("\0") !== assignments.join("\0") };
  }
  return { build };
});
