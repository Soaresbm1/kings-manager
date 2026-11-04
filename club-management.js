// Pont des décisions de club : les modules calculent, cette couche confirme et sauvegarde.
let clubManagementMessage = "";

function normalizeNextSeasonRules(value) {
  const choice = key => value && ["keep", ...CompetitionRules.PROFILE_IDS].includes(value[key]) ? value[key] : "keep";
  return { championship: choice("championship"), tournament: choice("tournament") };
}

function initializeClubManagement(data, { newCareer = false } = {}) {
  const source = data || {};
  STATE.clubTraining = ClubTraining.normalize(source.clubTraining);
  STATE.playerPromises = PlayerPromises.normalize(source.playerPromises);
  const savedOtherRules = Array.isArray(source.competitionRules?.otherLeagues) ? source.competitionRules.otherLeagues : [];
  const selected = kind => document.getElementById("rules-new-" + kind)?.value || CompetitionRules.LEGACY_ID;
  const snapshot = (kind, key) => {
    const competition = kind === "tournament" ? "international" : "league:" + key;
    const options = { competition, season: STATE.season };
    if (newCareer) return CompetitionRules.create(selected(kind), options);
    const saved = kind === "tournament" ? source.competitionRules?.tournament
      : key === STATE.leagueKey ? source.competitionRules?.championship
        : savedOtherRules.find(entry => entry?.key === key)?.rules;
    return CompetitionRules.normalize(saved, options);
  };
  STATE.competitionRules = {
    championship: snapshot("championship", STATE.leagueKey),
    tournament: snapshot("tournament"),
    otherLeagues: (STATE.otherLeagues || []).map(league => ({ key: league.key, rules: snapshot("championship", league.key) }))
  };
  STATE.nextSeasonRules = normalizeNextSeasonRules(source.nextSeasonRules);
  clubManagementMessage = "";
}

function resetClubManagement() {
  STATE.clubTraining = null;
  STATE.playerPromises = null;
  STATE.competitionRules = null;
  STATE.nextSeasonRules = null;
  clubManagementMessage = "";
}

function getCareerRules(kind = "championship", leagueKey = STATE.leagueKey) {
  if (kind === "tournament") return STATE.competitionRules?.tournament;
  return leagueKey === STATE.leagueKey ? STATE.competitionRules?.championship
    : STATE.competitionRules?.otherLeagues?.find(entry => entry.key === leagueKey)?.rules;
}

function advanceClubManagementSeason() {
  const choices = normalizeNextSeasonRules(STATE.nextSeasonRules);
  const advance = (saved, kind, competition) => choices[kind] === "keep"
    ? CompetitionRules.normalize(saved, { competition, season: STATE.season })
    : CompetitionRules.create(choices[kind], { competition, season: STATE.season });
  const previous = STATE.competitionRules;
  STATE.competitionRules = {
    championship: advance(previous?.championship, "championship", "league:" + STATE.leagueKey),
    tournament: advance(previous?.tournament, "tournament", "international"),
    otherLeagues: (STATE.otherLeagues || []).map(league => ({ key: league.key,
      rules: advance(previous?.otherLeagues?.find(entry => entry.key === league.key)?.rules, "championship", "league:" + league.key) }))
  };
  STATE.nextSeasonRules = normalizeNextSeasonRules();
  clubManagementMessage = "Les règlements de cette nouvelle saison sont épinglés.";
}

function clubElement(tag, text, className) {
  const element = document.createElement(tag);
  if (text !== undefined && text !== null) element.textContent = text;
  if (className) element.className = className;
  return element;
}

function populateRulesPicker(select, value, { keep = false } = {}) {
  select.replaceChildren();
  if (keep) {
    const option = clubElement("option", "Conserver le règlement actuel"); option.value = "keep"; select.append(option);
  }
  CompetitionRules.list().forEach(profile => {
    const option = clubElement("option", profile.label); option.value = profile.profileId; select.append(option);
  });
  select.value = value || (keep ? "keep" : CompetitionRules.LEGACY_ID);
}

function renderRulesSummary(container, snapshot, heading) {
  const summary = CompetitionRules.summary(snapshot), timing = summary.config;
  const section = clubElement("section", null, "rules-summary");
  const header = clubElement("div", null, "rules-summary__header");
  header.append(clubElement("h4", heading + " · " + summary.label, "rules-summary__title"),
    clubElement("span", summary.status === "adaptation" ? "Adaptation du guide" : "Format du jeu", "rules-summary__status"));
  section.append(header, clubElement("p", summary.description, "club-muted"));
  const metrics = clubElement("dl", null, "rules-summary__metrics");
  const windows = kind => timing.specialWindows.map(([start, end]) => `${start}’–${Math.min(end, kind === "president" ? timing.presidentDeadline : end)}’`).join(" / ");
  [["Durée nominale", timing.totalMinutes + " min"], ["Mi-temps", timing.halfTime + "’"],
    ["Double but", `${timing.doubleGoalStartMinute}’–${timing.halfTime}’`], ["Dé Géant", `${timing.diceStartMinute}’–${timing.diceEndMinute}’`],
    ["Matchball", timing.matchballStartMinute + "’"], ["Arme secrète", windows("card")], ["Président", windows("president")]].forEach(([label, value]) => {
      const metric = clubElement("div"); metric.append(clubElement("dt", label), clubElement("dd", value)); metrics.append(metric);
    });
  section.append(metrics);
  const notes = clubElement("ul", null, "rules-summary__notes"); summary.notes.forEach(note => notes.append(clubElement("li", note))); section.append(notes);
  const source = clubElement("p", null, "rules-summary__source");
  if (summary.sourceUrl) {
    const link = clubElement("a", summary.sourceLabel); link.href = summary.sourceUrl; link.target = "_blank"; link.rel = "noopener noreferrer"; source.append(link);
  } else source.textContent = summary.sourceLabel;
  if (summary.checkedAt) source.append(document.createTextNode(" · vérifié le " + summary.checkedAt));
  section.append(source); container.append(section);
}

function renderCompetitionRules() {
  const container = document.getElementById("competition-rules-content"); if (!container || !STATE.league) return;
  container.replaceChildren();
  container.append(clubElement("p", `Saison ${STATE.season} : chaque règlement reste fixé jusqu’à la fin de la saison. Le choix championnat s’applique aussi aux cinq ligues simulées.`, "club-muted"));
  renderRulesSummary(container, getCareerRules(), "Championnat");
  renderRulesSummary(container, getCareerRules("tournament"), "Tournoi international");
  const next = clubElement("fieldset", null, "club-rules-next"); next.append(clubElement("legend", "Préparer la saison suivante"));
  const choices = normalizeNextSeasonRules(STATE.nextSeasonRules);
  for (const [kind, label] of [["championship", "Championnats"], ["tournament", "Tournoi international"]]) {
    const field = clubElement("label", label, "rules-picker"); field.htmlFor = "rules-next-" + kind;
    const select = clubElement("select"); select.id = field.htmlFor; populateRulesPicker(select, choices[kind], { keep: true }); field.append(select); next.append(field);
  }
  const save = clubElement("button", "Enregistrer pour la saison suivante", "secondary"); save.type = "button"; save.id = "rules-next-save";
  save.disabled = clubManagementBlocked();
  save.onclick = () => {
    const slot = STATE.currentSlotId, season = STATE.season;
    const nextChoices = { championship: document.getElementById("rules-next-championship").value, tournament: document.getElementById("rules-next-tournament").value };
    const label = kind => nextChoices[kind] === "keep" ? "conserver la copie actuelle" : CompetitionRules.summary(CompetitionRules.create(nextChoices[kind])).label;
    showConfirm(`Saison ${season + 1} : championnats — ${label("championship")} ; tournoi — ${label("tournament")}. Les règlements de la saison ${season} restent fixés.`, () => {
      if (STATE.currentSlotId !== slot || STATE.season !== season || clubManagementBlocked()) return;
      STATE.nextSeasonRules = normalizeNextSeasonRules(nextChoices);
      if (saveGame() === false) clubManagementMessage = "Choix conservé en mémoire, mais son enregistrement n’a pas pu être vérifié. Réessaie ou exporte la progression depuis le message de sauvegarde.";
      else clubManagementMessage = "Choix enregistré : il sera appliqué au démarrage de la saison suivante.";
      renderCompetitionRules();
    }, { title: "Règlements de la saison suivante", confirmLabel: "Enregistrer" });
  };
  next.append(save); container.append(next);
  const status = clubElement("p", clubManagementMessage, "club-muted"); status.id = "rules-save-status"; status.setAttribute("role", "status"); container.append(status);
}

function clubManagementBlocked() {
  return !!(!STATE.currentSlotId || typeof managerPendingEntry !== "undefined" && managerPendingEntry
    || typeof advancing !== "undefined" && advancing
    || document.getElementById("screen-lineup")?.classList.contains("active")
    || document.getElementById("screen-match")?.classList.contains("active")
    || STATE.pendingResult && !STATE.pendingResult.committed);
}

function trainingContext(extra = {}) {
  return { team: getUserTeam(), careerId: STATE.currentSlotId, season: STATE.season, round: STATE.currentRound, totalRounds: STATE.schedule.length,
    blocked: typeof managerPendingEntry !== "undefined" && managerPendingEntry
      ? "Réessaie ou exporte la progression non enregistrée avant de lancer une autre séance." : clubManagementBlocked(),
    valueStarMin: VALUE_STAR_MIN, valueStarMax: VALUE_STAR_MAX, ...extra };
}

function confirmClubTraining(request) {
  const slot = STATE.currentSlotId, team = getUserTeam();
  const plan = ClubTraining.preview(STATE.clubTraining, trainingContext(request));
  if (!plan.ok || plan.token !== request.token) { renderClubManagement(); return; }
  const effects = plan.effects.map(effect => `${effect.name} : forme ${effect.formBefore} → ${effect.formAfter}`
    + (effect.attribute ? effect.gain ? ` ; ${effect.attribute === "technique" ? "technique" : "physique"} ${effect.attributeBefore} → ${effect.attributeAfter}, note ${effect.overallBefore} → ${effect.patch.overall}, valeur ${formatMoney(effect.valueBefore)} → ${formatMoney(effect.patch.value)}`
      : ` ; progression ${effect.creditsBefore}/4 → ${effect.creditsAfter}/4` : "")).join("\n");
  showConfirm(`${ClubTraining.MODES[plan.mode].label} · Journée ${STATE.currentRound + 1}\n${effects}\nCette séance consomme l’unique séance de cette journée.`, () => {
    if (STATE.currentSlotId !== slot || getUserTeam() !== team) return;
    const result = ClubTraining.commit(STATE.clubTraining, trainingContext({ mode: request.mode, playerIds: request.playerIds }), { expectedToken: request.token });
    if (!result.ok) { renderClubManagement(); showAlert(result.message, "Séance non effectuée"); return; }
    result.updates.forEach(update => Object.assign(team.players.find(player => player.id === update.playerId), update.patch));
    STATE.clubTraining = result.state;
    if (saveGame() === false) {
      // Une écriture non vérifiable peut avoir atteint le stockage. Garder la séance
      // consommée et l’entrée de récupération évite de lui appliquer ses effets deux fois.
      renderClubManagement(); updateTopbar();
      const feedback = document.getElementById("training-feedback");
      if (feedback) feedback.textContent = "Séance effectuée en mémoire, mais son enregistrement n’a pas pu être vérifié. Réessaie ou exporte la progression depuis le message de sauvegarde.";
      return;
    }
    renderClubManagement(); updateTopbar();
    const feedback = document.getElementById("training-feedback"); if (feedback) feedback.textContent = "Séance effectuée et enregistrée.";
  }, { title: "Confirmer l’entraînement", confirmLabel: "Effectuer la séance" });
}

function renderClubManagement() {
  if (!STATE.league) return;
  const team = getUserTeam();
  STATE.playerPromises = PlayerPromises.reconcile(STATE.playerPromises, { players: team.players, season: STATE.season, day: STATE.currentDay });
  ClubTraining.render(document.getElementById("club-training-content"), { state: STATE.clubTraining, context: trainingContext(), onCommit: confirmClubTraining });
  PlayerPromises.render(document.getElementById("club-promises-content"), { state: STATE.playerPromises, team, onPlayer: player => openPlayerInfoModal(player, team) });
  renderCompetitionRules();
}

function renderPromisePreview(notification, player, acceptButton) {
  const container = document.getElementById("notif-promise-preview"); if (!container) return;
  container.replaceChildren(); container.hidden = notification?.type !== "message";
  if (container.hidden) return;
  const proposal = PlayerPromises.preview(notification, player, STATE.playerPromises, { season: STATE.season, day: STATE.currentDay });
  container.append(clubElement("strong", proposal.label || "Engagement indisponible"));
  [proposal.requirement, proposal.detail, proposal.reason].filter(Boolean).forEach(text => container.append(clubElement("p", text)));
  if (acceptButton) { acceptButton.disabled = !proposal.canAccept; acceptButton.id = "notif-promise-accept"; }
}

function respondToPlayerPromise(notification, player, accept) {
  const proposal = PlayerPromises.preview(notification, player, STATE.playerPromises, { season: STATE.season, day: STATE.currentDay });
  if (!proposal.supported) return false;
  if (accept) {
    const accepted = PlayerPromises.accept(STATE.playerPromises, { notification, player, season: STATE.season, day: STATE.currentDay });
    STATE.playerPromises = accepted.ledger;
    if (!accepted.accepted) { renderCurrentNotification(); return true; }
  } else if (proposal.canAccept && player && MESSAGE_TEMPLATES[notification.templateIdx]) MESSAGE_TEMPLATES[notification.templateIdx].no(player);
  dismissCurrentNotification(); saveGame(); return true;
}

function captureMatchPromises(team, setup, opponent, tournament) {
  const match = STATE.tournamentMatchRef;
  const fixture = [STATE.season, tournament ? "tournament" : "championship", STATE.leagueKey,
    tournament ? STATE.tournament?.roundIndex : STATE.currentRound, tournament ? match?.home?.team?.id : setup.isHome ? team.id : opponent.id,
    tournament ? match?.away?.team?.id : setup.isHome ? opponent.id : team.id];
  return { fixtureKey: JSON.stringify(fixture), season: STATE.season, day: STATE.currentDay,
    eligibleIds: team.players.filter(player => !player.injured && !player.suspended).map(player => player.id),
    initialLineup: [...setup.lineup], initialRoles: { ...setup.playerRoles } };
}

function evaluateMatchPromises(result, capture, userSide) {
  if (!capture) return;
  const team = getUserTeam();
  const evaluated = PlayerPromises.evaluate(STATE.playerPromises, { ...capture, teamPlayers: team.players,
    participants: result.participants?.[userSide], minutesPlayed: result.minutesPlayed });
  STATE.playerPromises = evaluated.ledger;
  evaluated.effects.forEach(effect => {
    const player = team.players.find(player => player.id === effect.playerId);
    if (player) player.form = Math.max(40, Math.min(99, player.form + effect.delta));
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const renderPreview = () => {
    const container = document.getElementById("rules-new-preview"); if (!container) return;
    container.replaceChildren();
    for (const [kind, label] of [["championship", "Championnats"], ["tournament", "Tournoi international"]]) {
      renderRulesSummary(container, CompetitionRules.create(document.getElementById("rules-new-" + kind).value), label);
    }
  };
  for (const kind of ["championship", "tournament"]) {
    const select = document.getElementById("rules-new-" + kind);
    if (select) { populateRulesPicker(select); select.addEventListener("change", renderPreview); }
  }
  renderPreview();
});
