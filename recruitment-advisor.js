// Aide à la lecture du mercato : aucune offre, mutation ni utilisation du hasard.
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.RecruitmentAdvisor = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const POSITIONS = ["GK", "DEF", "MID", "ATT"];
  const DEFAULT_ROLES = { GK: "keeper", DEF: "stay_back", MID: "box_to_box", ATT: "runner" };
  const POSITION_ROLES = { GK: ["keeper"], DEF: ["stay_back", "overlap"], MID: ["creator", "ball_winner", "box_to_box"], ATT: ["runner", "target", "poacher"] };
  const PROFILES = {
    keeper: ["Gardien", { physical: .4, mental: .4, technique: .2 }],
    stay_back: ["Défenseur fixe", { physical: .45, mental: .35, speed: .2 }],
    overlap: ["Défenseur offensif", { speed: .45, physical: .3, technique: .25 }],
    creator: ["Créateur", { technique: .55, mental: .3, speed: .15 }],
    ball_winner: ["Récupérateur", { physical: .45, mental: .35, speed: .2 }],
    box_to_box: ["Relayeur", { physical: .4, speed: .35, technique: .25 }],
    runner: ["Profondeur", { speed: .5, technique: .3, physical: .2 }],
    target: ["Point d’appui", { physical: .45, technique: .35, mental: .2 }],
    poacher: ["Finisseur", { technique: .45, mental: .35, speed: .2 }]
  };
  const number = value => typeof value === "number" && Number.isFinite(value) ? value : null;
  const rating = value => number(value) !== null && value >= 0 && value <= 100 ? value : null;
  const available = player => player && !player.injured && !player.suspended;
  const text = (value, fallback = "") => typeof value === "string" ? value.slice(0, 160) : fallback;
  const order = (a, b) => String(a.id).localeCompare(String(b.id), "fr");
  function profile(player, key) {
    const definition = Object.prototype.hasOwnProperty.call(PROFILES, key) ? PROFILES[key] : PROFILES.box_to_box;
    const fields = Object.keys(definition[1]);
    if (fields.some(field => number(player[field]) === null || player[field] < 0 || player[field] > 100)) return { label: definition[0], score: null };
    return { label: definition[0], score: fields.reduce((sum, field) => sum + player[field] * definition[1][field], 0) };
  }
  function build({ team, leagueKey, leagues = [], setup = {}, slots = [], focus = "auto" } = {}) {
    const players = Array.isArray(team?.players) ? team.players : [];
    const budget = number(team?.budget) !== null && team.budget >= 0 && team.budget <= 1e12 ? team.budget : null;
    const assignments = Array.isArray(setup.assignments) ? setup.assignments : [];
    const needs = POSITIONS.map(pos => {
      const indices = slots.flatMap((slot, index) => slot.pos === pos ? [index] : []);
      const required = indices.length;
      const natural = players.filter(player => available(player) && player.pos === pos && rating(player.overall) !== null)
        .sort((a, b) => b.overall - a.overall || order(a, b));
      const assigned = indices.map(index => players.find(player => player.id === assignments[index])).filter(available);
      const comparison = [...assigned].sort((a, b) => (rating(a.overall) ?? 0) - (rating(b.overall) ?? 0))[0] || natural[Math.min(required, natural.length) - 1] || null;
      const roleId = comparison && setup.playerRoles?.[comparison.id];
      const role = POSITION_ROLES[pos].includes(roleId) ? roleId : DEFAULT_ROLES[pos];
      const missing = Math.max(0, required - natural.length);
      const reserve = required > 0 && natural.length <= required;
      const strength = natural.slice(0, required).reduce((sum, player) => sum + player.overall, 0) / Math.max(1, Math.min(required, natural.length));
      return { pos, required, available: natural.length, missing, reserve, role, comparisonId: comparison?.id || null,
        level: natural.length ? strength : null, comparisonOverall: rating(comparison?.overall), comparisonProfile: comparison ? profile(comparison, role).score : null,
        reason: missing ? `${missing} profil${missing > 1 ? "s" : ""} naturel${missing > 1 ? "s" : ""} manquant${missing > 1 ? "s" : ""}` : reserve ? "Pas de doublure naturelle disponible" : "Concurrence et amélioration du poste",
        priority: required ? missing * 1000 + (reserve ? 150 : 0) + 100 - strength : -1 };
    });
    const targets = focus === "auto" ? needs.filter(need => need.required > 0).sort((a, b) => b.priority - a.priority || POSITIONS.indexOf(a.pos) - POSITIONS.indexOf(b.pos))
      : needs.filter(need => need.pos === focus);
    const candidates = [];
    const seen = new Set();
    for (const league of Array.isArray(leagues) ? leagues : []) {
      for (const club of league.teams || []) {
        if ((club.id === team?.id && league.key === leagueKey) || !Array.isArray(club.players) || club.players.length <= 7) continue;
        for (const player of club.players) {
          if (!player || typeof player.id !== "string" || seen.has(player.id) || players.some(own => own.id === player.id)) continue;
          seen.add(player.id);
          const value = number(player.value), overall = number(player.overall);
          if (!available(player) || value === null || value <= 0 || value > 1e12 || overall === null || overall < 0 || overall > 100 || budget === null || value > budget) continue;
          const need = targets.find(target => target.pos === player.pos);
          if (!need) continue;
          const fit = profile(player, need.role);
          const gain = need.comparisonOverall === null ? null : overall - need.comparisonOverall;
          const score = overall * .65 + (fit.score ?? overall) * .35 + Math.max(-15, Math.min(15, gain ?? 0)) * .4 - value / Math.max(1, budget) * 3;
          candidates.push({ id: player.id, name: text(player.name, "Sans nom"), pos: player.pos,
            clubId: club.id, clubName: text(club.name, "Club inconnu"), leagueKey: league.key, leagueName: text(league.name),
            overall, value, remaining: budget - value, role: fit.label, profileScore: fit.score,
            gain, reason: need.reason, comparisonId: need.comparisonId, score,
            strengths: Object.keys(PROFILES[need.role][1]).slice(0, 2).map(key => ({ key, value: number(player[key]) })) });
        }
      }
    }
    const ranked = candidates.sort((a, b) => b.score - a.score || a.value - b.value || order(a, b));
    const selected = [];
    // En mode auto, une première piste pour chacun des besoins prioritaires.
    if (focus === "auto") for (const need of targets) {
      const candidate = ranked.find(entry => entry.pos === need.pos);
      if (candidate) selected.push(candidate);
      if (selected.length === 3) break;
    }
    for (const candidate of ranked) {
      if (selected.length >= 3) break;
      if (!selected.some(entry => entry.id === candidate.id)) selected.push(candidate);
    }
    return { budget, focus, needs, priority: targets[0]?.pos || null, candidates: selected, eligible: ranked.length };
  }
  return { build, profile, POSITIONS };
});
