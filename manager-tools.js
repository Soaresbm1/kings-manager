// Outils de lecture et stockage : aucune décision de simulation ni aucun tirage aléatoire.
let managerStorageService = null;
let managerLastSaveResult = null;
let managerPendingEntry = null;

function getManagerStorage() {
  managerStorageService ||= CareerStorage.create({ validateEntry: entry => !!entry && isPlayableCareerData(entry.data) });
  return managerStorageService;
}

function showCareerSaveResult(result, retry) {
  managerLastSaveResult = result;
  const container = document.getElementById("career-save-status");
  const timestamp = result.ok && result.verifiedAt
    ? " · " + new Date(result.verifiedAt).toLocaleTimeString("fr-CH", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "";
  CareerStorage.renderStatus(container, { ...result, message: result.message + timestamp }, {
    onRetry: retry,
    onExport: STATE.league || typeof result.raw === "string" ? () => exportUnsavedCareer(result) : undefined
  });
  updateCareerPresetPersistenceLabels();
}

function updateCareerPresetPersistenceLabels() {
  const unconfirmed = !!managerPendingEntry && managerPendingEntry.slotId === STATE.currentSlotId;
  document.querySelectorAll(".preset-card").forEach(card => {
    const label = card.querySelector(".preset-status");
    const empty = card.classList.contains("preset-card-empty");
    const active = card.classList.contains("preset-card-active");
    if (label) label.textContent = empty ? "Vide" : unconfirmed ? (active ? "Active · non enregistrée" : "Non enregistrée") : active ? "Active" : "Enregistrée";
  });
  if (!unconfirmed && managerLastSaveResult?.ok) document.querySelectorAll("[data-save-error='true'].career-tools-status").forEach(status => {
    status.textContent = "Configuration enregistrée sur cet appareil.";
    delete status.dataset.saveError;
  });
}

function readCareerSaveMap() {
  const result = getManagerStorage().read();
  if (!result.ok) {
    showCareerSaveResult(result, () => {
      const next = getManagerStorage().read();
      if (next.ok) { CareerStorage.renderStatus(document.getElementById("career-save-status"), null); renderSavesList(); }
      else showCareerSaveResult(next, () => renderSavesList());
    });
    return {};
  }
  return result.map;
}

function writeCareerSave(slotId, entry) {
  const result = getManagerStorage().write(slotId, entry);
  if (!result.ok && slotId === STATE.currentSlotId && STATE.league) managerPendingEntry = { slotId, entry };
  else if (result.ok && managerPendingEntry?.slotId === slotId) managerPendingEntry = null;
  const importFeedback = document.getElementById("import-save-feedback");
  if (result.ok && importFeedback?.dataset.saveError === slotId) {
    importFeedback.textContent = "Carrière importée avec succès !";
    importFeedback.style.color = "#00ff88";
    delete importFeedback.dataset.saveError;
  }
  showCareerSaveResult(result, () => {
    if (slotId === STATE.currentSlotId && STATE.league) saveGame();
    else { const retried = writeCareerSave(slotId, entry); if (retried.ok) renderSavesList(); }
  });
  return result;
}

function removeCareerSave(slotId) {
  const result = getManagerStorage().remove(slotId);
  showCareerSaveResult(result, () => { if (deleteSaveSlot(slotId)) renderSavesList(); });
  return result;
}

function downloadRecoveryJson(content, filename) {
  const url = URL.createObjectURL(new Blob([content], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url; link.download = filename;
  document.body.appendChild(link); link.click(); link.remove();
  URL.revokeObjectURL(url);
}

function exportUnsavedCareer(result) {
  if (STATE.league) {
    const entry = { meta: { teamName: getUserTeam().name, leagueName: STATE.league.name,
      season: STATE.season, round: STATE.currentRound, totalRounds: STATE.schedule.length, updatedAt: Date.now() }, data: buildSaveData() };
    downloadRecoveryJson(JSON.stringify(entry), "KingsManager_progression_en_memoire.json");
  } else if (typeof result?.raw === "string") {
    downloadRecoveryJson(result.raw, "KingsManager_donnees_a_recuperer.json");
  }
}

function confirmUnsavedCareerExit(leave) {
  if (!managerPendingEntry || !STATE.league) { leave(); return; }
  showConfirm("Cette progression n’a pas pu être enregistrée. Réessaie ou exporte-la depuis le message de sauvegarde avant de quitter. Quitter quand même ?", () => {
    managerPendingEntry = null;
    CareerStorage.renderStatus(document.getElementById("career-save-status"), null);
    leave();
  }, { title: "Progression non enregistrée", confirmLabel: "Quitter sans enregistrer" });
}

window.addEventListener("beforeunload", event => {
  if (!managerPendingEntry) return;
  event.preventDefault(); event.returnValue = "";
});

function addCareerRestoreControl(row, slotId) {
  const info = getManagerStorage().getRestoreInfo(slotId);
  if (!info.ok || !info.available) return;
  const button = document.createElement("button");
  button.type = "button"; button.className = "secondary save-restore-button";
  button.textContent = "Restaurer";
  button.setAttribute("aria-label", "Restaurer le point précédent de « " + (info.currentEntry?.meta?.teamName || "cette carrière") + " »");
  button.onclick = () => {
    const current = getManagerStorage().getRestoreInfo(slotId);
    if (!current.ok || !current.available || !isPlayableCareerData(current.entry?.data)) {
      showCareerSaveResult({ ok: false, message: "Aucun point de restauration valide n’est disponible pour cette carrière." }); return;
    }
    const meta = current.entry.meta || {};
    const moment = Number.isFinite(meta.updatedAt) ? new Date(meta.updatedAt).toLocaleString("fr-CH") : "date non renseignée";
    showConfirm("Rétablir le point du " + moment + " (saison " + (meta.season || 1) + ", journée " + ((meta.round || 0) + 1) + ") ? La progression actuellement enregistrée deviendra le point de retour.", () => {
      const result = getManagerStorage().restore(slotId, { expectedToken: current.token, entry: current.entry });
      showCareerSaveResult(result);
      if (!result.ok) return;
      renderSavesList();
      if (loadGame(slotId)) { showScreen("screen-main"); showTab("calendar"); updateTopbar(); }
    }, { title: "Restaurer cette carrière ?", confirmLabel: "Restaurer" });
  };
  row.querySelector(".actions").appendChild(button);
}

function renderOpponentCareerReport(opponent) {
  const container = document.getElementById("opponent-report");
  if (!container) return;
  const leagues = [STATE.league, ...(STATE.otherLeagues || []).map(entry => entry.league)].filter(Boolean);
  const league = leagues.find(candidate => candidate.teams.some(team => team.id === opponent.id));
  OpponentReport.render(container, OpponentReport.build({ team: getUserTeam(), opponent, league }));
}

function startTacticalDebrief() {
  const setup = matchState.userSide === "home" ? matchState.homeSetup : matchState.awaySetup;
  matchState.debriefCapture = TacticalDebrief.create({ side: matchState.userSide,
    homeName: matchState.homeTeam.name, awayName: matchState.awayTeam.name, setup });
  matchState.debriefAppliedTactic = JSON.stringify(TacticPresets.capture(setup));
  matchState.debriefPendingTactic = null;
  sampleTacticalDebrief(0);
}

function sampleTacticalDebrief(minute) {
  if (!matchState?.debriefCapture || !matchEngine) return;
  matchState.debriefCapture = TacticalDebrief.recordSample(matchState.debriefCapture,
    { minute, stats: matchEngine.getLiveStats(), score: matchEngine.getScore() });
}

function captureDebriefEvent(event) {
  if (!matchState?.debriefCapture || !event) return;
  matchState.debriefCapture = TacticalDebrief.recordEvent(matchState.debriefCapture,
    { ...event, minute: Number.isFinite(event.minute) ? event.minute : matchState.minute });
}

function queueHumanTacticDecision(setup) {
  if (!matchState?.debriefCapture || matchState.finished || setup.persist
    || ![matchState.homeSetup, matchState.awaySetup].includes(setup)) return;
  const snapshot = TacticPresets.capture(setup);
  const key = JSON.stringify(snapshot);
  matchState.debriefPendingTactic = key === matchState.debriefAppliedTactic ? null : { setup: snapshot, key };
}

function flushHumanTacticDecision(minute) {
  const pending = matchState?.debriefPendingTactic;
  if (!pending || !matchState.debriefCapture) return;
  sampleTacticalDebrief(minute);
  matchState.debriefCapture = TacticalDebrief.recordDecision(matchState.debriefCapture,
    { minute, kind: "tactic", text: "Changement tactique appliqué", setup: pending.setup, side: matchState.userSide });
  sampleTacticalDebrief(minute);
  matchState.debriefAppliedTactic = pending.key;
  matchState.debriefPendingTactic = null;
}

function recordPhaseDebriefDecision(text, setup) {
  if (!matchState?.debriefCapture) return;
  const minute = matchState.pendingMinute ?? matchState.minute + 1;
  sampleTacticalDebrief(minute);
  matchState.debriefCapture = TacticalDebrief.recordDecision(matchState.debriefCapture,
    { minute, kind: "phase", text, setup, side: matchState.userSide });
  sampleTacticalDebrief(minute);
  matchState.debriefAppliedTactic = JSON.stringify(TacticPresets.capture(setup));
}

function finishTacticalDebrief() {
  if (!STATE.pendingResult) return;
  STATE.pendingResult.debrief = TacticalDebrief.build({ result: STATE.pendingResult.result, capture: matchState.debriefCapture });
}

function renderSummaryDebrief() {
  TacticalDebrief.render(document.getElementById("summary-tactical-debrief"), STATE.pendingResult?.debrief);
}
