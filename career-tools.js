// Relie les outils de carrière à l'interface existante. Le moteur reste inchangé.
function initializeCareerFeatures(data) {
  const source = data || {};
  STATE.matchReports = CareerHistory.normalizeReports(data ? source.matchReports : STATE.matchReports);
  STATE.tacticPresets = TacticPresets.normalizePresets(data ? source.tacticPresets : STATE.tacticPresets, STATE.savedTactic);
  const activeId = data ? source.activeTacticPreset : STATE.activeTacticPreset;
  STATE.activeTacticPreset = TacticPresets.getPreset(STATE.tacticPresets, activeId) ? activeId : "usual";
  // savedTactic reste le miroir compatible avec les exports antérieurs.
  const active = TacticPresets.getPreset(STATE.tacticPresets, STATE.activeTacticPreset);
  STATE.savedTactic = TacticPresets.capture(sanitizeTactic(STATE.savedTactic || active?.tactic));
  STATE.tacticPresets = TacticPresets.upsert(STATE.tacticPresets, STATE.activeTacticPreset, STATE.savedTactic);
}

function careerSetupContext(ids) {
  return ids === TACTICS_IDS ? "tactics" : ids === MATCH_TACTICS_IDS ? "match" : "lineup";
}

function syncCareerPresetFromSetup(setup) {
  STATE.tacticPresets = TacticPresets.upsert(STATE.tacticPresets, STATE.activeTacticPreset || "usual", STATE.savedTactic);
  renderCareerPresets(setup, TACTICS_IDS);
}

function renderCareerPresets(setup, ids) {
  const prefix = careerSetupContext(ids);
  const container = document.getElementById(prefix + "-presets");
  if (!container) return;
  TacticPresets.render(container, {
    presets: STATE.tacticPresets,
    activeId: setup.persist ? STATE.activeTacticPreset : setup.careerPresetId || STATE.activeTacticPreset,
    currentSetup: setup,
    onLoad: id => loadCareerPreset(id, setup, ids),
    onSave: id => {
      const save = () => {
        const snapshot = TacticPresets.capture(setup);
        STATE.tacticPresets = TacticPresets.upsert(STATE.tacticPresets, id, snapshot);
        if (setup.persist) STATE.activeTacticPreset = id;
        if (id === STATE.activeTacticPreset) STATE.savedTactic = TacticPresets.capture(snapshot);
        const saved = saveGame();
        renderCareerPresets(setup, ids);
        const status = document.getElementById(prefix + "-preset-status");
        if (status) status.textContent = saved ? "Configuration enregistrée dans « " + TacticPresets.getPreset(STATE.tacticPresets, id).name + " »." : "Configuration en mémoire, mais non enregistrée sur cet appareil.";
        if (status) { if (saved) delete status.dataset.saveError; else status.dataset.saveError = "true"; }
      };
      const previous = TacticPresets.getPreset(STATE.tacticPresets, id);
      if (previous?.tactic && JSON.stringify(previous.tactic) !== JSON.stringify(TacticPresets.capture(setup))) {
        showConfirm("Remplacer la configuration enregistrée dans « " + previous.name + " » ?", save);
      } else save();
    },
    onRename: (id, name) => {
      STATE.tacticPresets = TacticPresets.upsert(STATE.tacticPresets, id, undefined, name);
      saveGame();
      renderCareerPresets(setup, ids);
    }
  });
  if (typeof updateCareerPresetPersistenceLabels === "function") updateCareerPresetPersistenceLabels();
}

function loadCareerPreset(id, setup, ids) {
  const preset = TacticPresets.getPreset(STATE.tacticPresets, id);
  if (!preset?.tactic) return;
  const target = sanitizeTactic(preset.tactic);
  if (ids === MATCH_TACTICS_IDS) {
    const team = getUserTeam();
    const unavailable = getTacticUnavailablePlayers(setup, ids);
    const blocked = setup.assignments.filter(playerId => ["red", "yellow"].includes(unavailable.get(playerId)?.reason));
    // Une tactique chargée ne remplace jamais un joueur exclu par un nouveau titulaire.
    const eligibleTeam = { ...team, players: team.players.map(player => unavailable.has(player.id) ? { ...player, injured: true } : player) };
    const slots = FORMATION_SLOTS[target.formation];
    target.assignments = sanitizeAssignments(eligibleTeam, slots, target.assignments);
    const locked = new Set();
    blocked.forEach(playerId => {
      const player = team.players.find(candidate => candidate.id === playerId);
      if (!player) return;
      const originalIndex = setup.assignments.indexOf(playerId);
      const fits = index => !locked.has(index) && (slots[index].pos === "GK") === (player.pos === "GK");
      const index = fits(originalIndex) ? originalIndex : slots.findIndex((slot, position) => fits(position));
      if (index >= 0) { target.assignments[index] = playerId; locked.add(index); }
    });
  }
  Object.assign(setup, target, { careerPresetId: id, selectedSlot: null });
  syncSingleComposition(setup);
  if (typeof queueHumanTacticDecision === "function") queueHumanTacticDecision(setup);
  let saved = true;
  if (setup.persist) {
    STATE.activeTacticPreset = id;
    saved = saveTactic(setup);
  }
  renderFormationChoice(setup, ids);
  renderPitch(setup, ids);
  renderBench(setup, ids);
  renderPlanChoices(setup, ids);
  if (ids.count) updateLineupCount(setup, ids);
  renderCareerSetupTools(setup, ids);
  const prefix = careerSetupContext(ids);
  const status = document.getElementById(prefix + "-preset-status");
  if (status) status.textContent = "« " + preset.name + " » chargée." + (setup.persist ? saved ? " Tactique active enregistrée." : " Configuration en mémoire, non enregistrée." : ids === MATCH_TACTICS_IDS ? " Valide pour l'appliquer à la prochaine séquence." : " Pour ce match uniquement.");
  if (status) { if (saved || !setup.persist) delete status.dataset.saveError; else status.dataset.saveError = "true"; }
  document.querySelector("#" + prefix + "-presets [data-preset-id='" + id + "'][data-preset-action='load']")?.focus({ preventScroll: true });
}

function renderCareerPhases(setup, ids) {
  const prefix = careerSetupContext(ids);
  const container = document.getElementById(prefix + "-phase-preparation");
  if (!container) return;
  const team = getUserTeam();
  const unavailable = ids === MATCH_TACTICS_IDS ? getTacticUnavailablePlayers(setup, ids) : new Map();
  KingsPreparation.render(container, { team, setup, unavailable: [...unavailable.values()], live: ids === MATCH_TACTICS_IDS, onChange: () => saveTactic(setup) });
}

function renderCareerSetupTools(setup, ids) {
  renderCareerPresets(setup, ids);
  renderCareerPhases(setup, ids);
}

function applyPreparedCareerPhases(minute) {
  const setup = matchState.userSide === "home" ? matchState.homeSetup : matchState.awaySetup;
  const key = minute >= matchEngine.MATCHBALL_START_MINUTE ? "matchballOrder"
    : minute <= matchEngine.ESCALIER_END_MINUTE ? "escalierOrder" : null;
  if (!key || !Array.isArray(setup[key]) || !setup[key].length) return;
  const pool = matchEngine.getAvailableOutfieldIds(matchState.userSide, minute);
  setup.activeOverride = applyOrderToCap(setup[key], pool, matchEngine.getOutfieldCap(minute));
}

function careerLeagueFixtureKey(homeId, awayId, round) {
  return ["league", STATE.leagueKey, STATE.season, round, homeId, awayId].join(":");
}

function careerTournamentFixtureKey(match) {
  const rounds = STATE.tournament?.rounds || [];
  const roundIndex = rounds.findIndex(round => round.matches.includes(match));
  return ["tournament", STATE.season, roundIndex, rounds[roundIndex]?.matches.indexOf(match), match.home.team.id, match.away.team.id].join(":");
}

function archiveCareerMatch(result, homeTeam, awayTeam, homeSetup, awaySetup, tournamentMatch) {
  const round = tournamentMatch ? (STATE.tournament?.rounds || []).findIndex(entry => entry.matches.includes(tournamentMatch)) : STATE.currentRound;
  const report = CareerHistory.buildReport({
    result, homeTeam, awayTeam, homeSetup, awaySetup, season: STATE.season,
    round: tournamentMatch ? STATE.tournament?.rounds[round]?.name || "Tournoi" : round,
    date: formatGameDate(STATE.currentDay, STATE.season),
    competition: tournamentMatch ? "Tournoi international" : STATE.league.name,
    fixtureKey: tournamentMatch ? careerTournamentFixtureKey(tournamentMatch) : careerLeagueFixtureKey(homeTeam.id, awayTeam.id, round),
    userTeamId: STATE.userTeamId,
    debrief: typeof TacticalDebrief !== "undefined" ? (STATE.pendingResult?.result === result
      ? STATE.pendingResult.debrief : TacticalDebrief.build({ result })) : null
  });
  STATE.matchReports = CareerHistory.addReport(STATE.matchReports, report);
  if (tournamentMatch && report) tournamentMatch.reportId = report.id;
  return report;
}

function openCareerReport(report) {
  if (!report) return;
  CareerHistory.renderReport(document.getElementById("history-report-body"), report);
  document.getElementById("history-report-title").textContent = "Rapport de match";
  document.getElementById("match-history-modal").classList.add("active");
}

function renderCareerHistory() {
  const container = document.getElementById("career-match-history");
  if (container) CareerHistory.renderList(container, STATE.matchReports, { onOpen: openCareerReport });
}

function addCareerReportButton(fixture, report) {
  if (!report) return;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "secondary history-fixture-button";
  button.textContent = "Voir le rapport";
  button.setAttribute("aria-label", "Voir le rapport : " + report.home.name + " contre " + report.away.name);
  button.onclick = () => openCareerReport(report);
  fixture.classList.add("fixture-with-report");
  fixture.appendChild(button);
}

function addCareerFixtureReport(fixture, homeId, awayId, round) {
  const key = careerLeagueFixtureKey(homeId, awayId, round);
  addCareerReportButton(fixture, STATE.matchReports.find(report => report.fixtureKey === key));
}

function addCareerTournamentReports() {
  const matches = (STATE.tournament?.rounds || []).filter(round => round.matches.length).flatMap(round => round.matches);
  document.querySelectorAll("#tournament-bracket .fixture").forEach((fixture, index) => {
    const match = matches[index];
    if (match?.reportId) addCareerReportButton(fixture, STATE.matchReports.find(report => report.id === match.reportId));
  });
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("btn-history-close").onclick = () => document.getElementById("match-history-modal").classList.remove("active");
});
