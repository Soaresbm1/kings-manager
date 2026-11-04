// Relie les conseils aux commandes existantes. Aucun tirage ni règle de simulation.
let recruitmentFocus = "auto";
let decisionsSlot = null;
let progressPlayerId = null;
let benchRenderKey = "";
const DECISION_ATTRS = { overall: "Note globale", speed: "Vitesse", technique: "Technique", physical: "Physique", mental: "Mental", form: "Forme", value: "Valeur", careerMatches: "Matchs joués en carrière" };

function decisionElement(tag, text, className) {
  const element = document.createElement(tag);
  if (text !== undefined && text !== null) element.textContent = String(text);
  if (className) element.className = className;
  return element;
}
function decisionButton(label, action, className = "secondary") {
  const button = decisionElement("button", label, className);
  button.type = "button";
  button.addEventListener("click", action);
  return button;
}
function decisionValue(value, field) {
  if (!Number.isFinite(value)) return "Non mesuré";
  return field === "value" ? formatMoney(value) : String(Math.round(value * 10) / 10);
}
function capturePlayerProgress() {
  const team = getUserTeam();
  if (!team) return;
  if (decisionsSlot !== STATE.currentSlotId) { decisionsSlot = STATE.currentSlotId; recruitmentFocus = "auto"; progressPlayerId = null; }
  STATE.playerProgress = PlayerProgress.observe(STATE.playerProgress, {
    players: team.players, season: STATE.season, day: STATE.currentDay, round: STATE.currentRound
  });
}
function renderRecruitmentAdvisor() {
  const container = document.getElementById("recruitment-advisor-content"), team = getUserTeam();
  if (!container || !team) return;
  if (decisionsSlot !== STATE.currentSlotId) { decisionsSlot = STATE.currentSlotId; recruitmentFocus = "auto"; progressPlayerId = null; }
  const setup = sanitizeTactic(STATE.savedTactic);
  const leagues = [{ key: STATE.leagueKey, name: STATE.league.name, teams: STATE.league.teams },
    ...(STATE.otherLeagues || []).map(league => ({ key: league.key, name: league.name, teams: league.league.teams }))];
  const report = RecruitmentAdvisor.build({ team, leagueKey: STATE.leagueKey, leagues, setup,
    slots: FORMATION_SLOTS[setup.formation] || [], focus: recruitmentFocus });
  container.replaceChildren();
  const toolbar = decisionElement("div", null, "decision-toolbar");
  const label = decisionElement("label", "Besoin à explorer"); label.htmlFor = "recruitment-focus";
  const focus = decisionElement("select"); focus.id = "recruitment-focus";
  for (const [id, name] of [["auto", "Priorités de la composition"], ["GK", "Gardien"], ["DEF", "Défense"], ["MID", "Milieu"], ["ATT", "Attaque"]]) {
    const option = decisionElement("option", name); option.value = id; focus.append(option);
  }
  focus.value = recruitmentFocus;
  focus.onchange = () => { recruitmentFocus = focus.value; renderRecruitmentAdvisor(); document.getElementById("recruitment-focus").focus(); };
  toolbar.append(label, focus, decisionElement("span", "Budget : " + decisionValue(report.budget, "value"), "decision-muted"));
  container.append(toolbar);
  const needs = decisionElement("ul", null, "recruitment-needs");
  report.needs.filter(need => need.required).forEach(need => {
    needs.append(decisionElement("li", `${need.pos} · ${need.available} profil${need.available === 1 ? "" : "s"} naturel${need.available === 1 ? "" : "s"} disponible${need.available === 1 ? "" : "s"} pour ${need.required} place${need.required === 1 ? "" : "s"} · ${need.reason}`));
  });
  container.append(needs);
  const priority = report.needs.find(need => need.pos === report.priority);
  if (priority) container.append(decisionElement("p", `Priorité proposée : ${priority.pos} · ${priority.reason}.`
    + (priority.level !== null ? ` Niveau moyen des meilleurs profils naturels pour ces places : ${decisionValue(priority.level, "overall")}/100.` : "")));
  container.append(decisionElement("p", "Pistes indicatives pour la composition enregistrée. Valeurs estimées, sans garantie de prix ni d’acceptation ; les coûts des trois pistes ne sont pas cumulés.", "decision-muted"));
  if (!STATE.mercatoOpen) container.append(decisionElement("p", "Mercato fermé : tu peux consulter, comparer et suivre ces joueurs en attendant son ouverture.", "decision-muted"));
  const cards = decisionElement("div", null, "recruitment-cards");
  for (const candidate of report.candidates) {
    const card = decisionElement("article", null, "recruitment-card"); card.dataset.recruitId = candidate.id;
    card.append(decisionElement("h4", candidate.name), decisionElement("p", `${candidate.pos} · ${candidate.clubName} · ${candidate.leagueName}`, "decision-muted"));
    card.append(decisionElement("p", candidate.reason));
    card.append(decisionElement("p", `Rôle visé : ${candidate.role} · Note globale ${candidate.overall}/100`));
    card.append(decisionElement("p", candidate.strengths.map(strength => `${DECISION_ATTRS[strength.key]} ${decisionValue(strength.value, strength.key)}`).join(" · "), "decision-muted"));
    card.append(decisionElement("p", `Valeur ${formatMoney(candidate.value)} · Budget restant indicatif ${formatMoney(candidate.remaining)}`));
    if (candidate.gain !== null) card.append(decisionElement("p", `${candidate.gain > 0 ? "+" : ""}${candidate.gain} point${Math.abs(candidate.gain) === 1 ? "" : "s"} de note globale face au joueur de référence du poste.`, "decision-muted"));
    const current = () => {
      const found = findPlayerAnywhere(candidate.id);
      if (!found || found.team.id === team.id) { showAlert("Ce joueur n’est plus disponible dans ce club. Les pistes ont été actualisées."); renderRecruitmentAdvisor(); return null; }
      return found;
    };
    const actions = decisionElement("div", null, "decision-actions");
    actions.append(decisionButton("Voir la fiche", () => { const found = current(); if (found) openPlayerInfoModal(found.p, found.team); }));
    const comparison = decisionButton("Comparer au joueur de référence", () => {
      if (!current()) return;
      const reference = getUserTeam().players.find(player => player.id === candidate.comparisonId);
      if (!reference) { renderRecruitmentAdvisor(); return; }
      compareIds = [reference.id, candidate.id]; renderCompareTray(); openCompareModal();
    });
    comparison.disabled = !candidate.comparisonId;
    actions.append(comparison);
    const follow = decisionButton(STATE.shortlist.includes(candidate.id) ? "Retirer du suivi" : "Suivre", () => {
      if (!current()) return;
      toggleShortlist(candidate.id);
      follow.textContent = STATE.shortlist.includes(candidate.id) ? "Retirer du suivi" : "Suivre";
      follow.setAttribute("aria-pressed", String(STATE.shortlist.includes(candidate.id)));
    });
    follow.setAttribute("aria-pressed", String(STATE.shortlist.includes(candidate.id))); follow.dataset.recruitFollow = candidate.id;
    actions.append(follow);
    const offer = decisionButton("Faire une offre", () => { const found = current(); if (found) openOfferModal(found.leagueKey, found.team.id, found.p.id); });
    offer.disabled = !STATE.mercatoOpen;
    actions.append(offer); card.append(actions); cards.append(card);
  }
  if (!report.candidates.length) cards.append(decisionElement("p", "Aucune piste disponible dans ce budget pour ce besoin. Les joueurs indisponibles et les clubs de sept joueurs sont écartés."));
  container.append(cards);
}

function renderPlayerProgress(container, player) {
  if (!container || !player) return;
  container.replaceChildren();
  const label = decisionElement("label", "Indicateur observé"); label.htmlFor = container.id + "-metric";
  const metric = decisionElement("select"); metric.id = label.htmlFor;
  for (const [field, name] of Object.entries(DECISION_ATTRS)) {
    const option = decisionElement("option", name); option.value = field; metric.append(option);
  }
  const toolbar = decisionElement("div", null, "decision-toolbar"); toolbar.append(label, metric);
  const chart = decisionElement("div", null, "progress-chart");
  container.append(toolbar, chart);
  function draw() {
    const result = PlayerProgress.series(STATE.playerProgress, player.id, metric.value);
    chart.replaceChildren();
    if (!result.points.length) { chart.append(decisionElement("p", "Aucun relevé conservé pour ce joueur. Le suivi porte sur les joueurs observés dans ton effectif.")); return; }
    const known = result.points.filter(point => point.value !== null);
    if (known.length) {
      const first = known[0], last = known.at(-1);
      chart.append(decisionElement("p", `${decisionValue(first.value, metric.value)} → ${decisionValue(last.value, metric.value)}`
        + (result.delta !== null ? ` (${result.delta > 0 ? "+" : ""}${decisionValue(result.delta, metric.value)})` : ""), "progress-total"));
    }
    if (known.length >= 2) {
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("viewBox", "0 0 480 130"); svg.setAttribute("role", "img");
      svg.setAttribute("aria-label", `${DECISION_ATTRS[metric.value]} : ${known.length} relevés. Les valeurs et dates sont disponibles dans le tableau.`);
      const min = Math.min(...known.map(point => point.value)), max = Math.max(...known.map(point => point.value));
      let segment = [];
      const flush = () => {
        if (!segment.length) return;
        const line = document.createElementNS(svg.namespaceURI, "polyline"); line.setAttribute("points", segment.join(" ")); svg.append(line); segment = [];
      };
      result.points.forEach((point, index) => {
        if (point.value === null) { flush(); return; }
        const x = 12 + index / Math.max(1, result.points.length - 1) * 456;
        const y = max === min ? 65 : 114 - (point.value - min) / (max - min) * 98;
        segment.push(`${x},${y}`);
        const circle = document.createElementNS(svg.namespaceURI, "circle"); circle.setAttribute("cx", String(x)); circle.setAttribute("cy", String(y)); circle.setAttribute("r", "3"); svg.append(circle);
      });
      flush(); chart.append(svg);
    }
    chart.append(decisionElement("p", known.length < 2
      ? "Le suivi commence avec ce relevé. Une courbe apparaîtra après de nouvelles observations. Les anciennes valeurs ne sont pas reconstituées."
      : "Relevés conservés, espacés uniformément. L’évolution entre deux observations n’est pas connue.", "decision-muted"));
    if (result.omitted) chart.append(decisionElement("p", "Les relevés les plus anciens peuvent être retirés pour limiter la taille de la sauvegarde.", "decision-muted"));
    const details = decisionElement("details", null, "progress-records"); details.append(decisionElement("summary", `Voir les relevés (${result.points.length})`));
    const table = decisionElement("table"); const head = decisionElement("thead"); const row = decisionElement("tr");
    row.append(decisionElement("th", "Date observée"), decisionElement("th", DECISION_ATTRS[metric.value])); head.append(row); table.append(head);
    const body = decisionElement("tbody");
    result.points.slice().reverse().forEach(point => {
      const tr = decisionElement("tr"); tr.append(decisionElement("td", `${formatGameDate(point.day, point.season)} · ${point.round} journée(s) terminée(s)`), decisionElement("td", decisionValue(point.value, metric.value))); body.append(tr);
    });
    table.append(body); details.append(table); chart.append(details);
  }
  metric.onchange = draw; draw();
}
function renderSquadProgress() {
  const container = document.getElementById("squad-progress-content"), team = getUserTeam();
  if (!container || !team) return;
  const previous = progressPlayerId;
  progressPlayerId = team.players.some(player => player.id === previous) ? previous : team.players[0]?.id;
  container.replaceChildren();
  if (!progressPlayerId) { container.append(decisionElement("p", "Aucun joueur dans cet effectif.")); return; }
  const label = decisionElement("label", "Joueur à suivre"); label.htmlFor = "progress-player";
  const select = decisionElement("select"); select.id = label.htmlFor;
  team.players.forEach(player => { const option = decisionElement("option", player.name || "Sans nom"); option.value = player.id; select.append(option); });
  select.value = progressPlayerId;
  const toolbar = decisionElement("div", null, "decision-toolbar"); toolbar.append(label, select);
  const chart = decisionElement("div"); chart.id = "squad-progress-chart";
  select.onchange = () => { progressPlayerId = select.value; renderPlayerProgress(chart, team.players.find(player => player.id === progressPlayerId)); };
  container.append(toolbar, chart); renderPlayerProgress(chart, team.players.find(player => player.id === progressPlayerId));
}
function appendPlayerProgress(player, team) {
  if (team.id !== STATE.userTeamId && !STATE.playerProgress?.players?.some(entry => entry.id === player.id)) return;
  const section = decisionElement("details", null, "decision-panel player-progress-panel");
  section.append(decisionElement("summary", "Évolution observée dans ton effectif"));
  const content = decisionElement("div"); content.id = "player-progress-chart";
  section.append(content); document.getElementById("player-info-body").append(section);
  renderPlayerProgress(content, player);
}

function captureBenchObservation() {
  if (!matchState || !matchEngine || matchState.sequenceActive) return;
  const side = matchState.userSide, minute = matchState.minute;
  const setup = side === "home" ? matchState.homeSetup : matchState.awaySetup;
  matchState.benchObservation = {
    minute, assignments: [...setup.assignments], activeIds: matchEngine.getActiveLineupIds(side, minute),
    unavailable: matchEngine.getUnavailablePlayers(side, minute).map(entry => ({ ...entry })),
    players: matchState.team.players.map(player => ({ id: player.id, name: player.name, pos: player.pos,
      overall: player.overall, injured: !!player.injured, suspended: !!player.suspended, energy: matchEngine.getStamina(side, player.id) }))
  };
}
function renderBenchAdvisor() {
  const container = document.getElementById("bench-advisor-content"), button = document.getElementById("btn-bench-advisor");
  if (!container || !button || !matchState) return;
  const setup = matchState.userSide === "home" ? matchState.homeSetup : matchState.awaySetup;
  const report = BenchAdvisor.build({ observation: matchState.benchObservation, assignments: setup.assignments,
    slots: FORMATION_SLOTS[setup.formation] || [], finished: matchState.finished });
  button.textContent = "Assistant de banc" + (report.alerts.length ? ` · ${report.alerts.length} alerte${report.alerts.length > 1 ? "s" : ""}` : "");
  button.disabled = matchState.finished || !!phaseLineupState;
  const key = JSON.stringify([report, setup.formation]);
  if (key === benchRenderKey && container.childElementCount) return;
  benchRenderKey = key; container.replaceChildren();
  container.append(decisionElement("p", report.minute === null ? "Les énergies apparaîtront après le premier relevé." : `Énergies relevées après les séquences jouées : ${report.minute}’.`, "decision-muted"));
  if (report.changed) container.append(decisionElement("p", "La composition a changé depuis ce relevé. Les prochaines séquences actualiseront les joueurs sur le terrain.", "decision-muted"));
  const suggestions = decisionElement("div", null, "bench-suggestions");
  for (const suggestion of report.suggestions) {
    const card = decisionElement("article", null, "bench-suggestion");
    card.append(decisionElement("p", `${suggestion.outName} (${suggestion.outEnergy} %) → ${suggestion.inName} (${suggestion.inEnergy} %) · ${suggestion.pos}`));
    if (!suggestion.natural) card.append(decisionElement("p", "Poste compatible en dépannage, avec les limites habituelles du moteur.", "decision-muted"));
    const confirm = decisionButton("Proposer ce remplacement", () => proposeBenchReplacement(suggestion));
    confirm.dataset.benchIn = suggestion.inId; confirm.dataset.benchOut = suggestion.outId;
    card.append(confirm); suggestions.append(card);
  }
  if (!report.suggestions.length) suggestions.append(decisionElement("p", report.alerts.length ? "Pas de remplaçant suffisamment plus frais et compatible dans ce relevé. Tu peux ajuster la tactique manuellement." : "Aucune alerte de fatigue individuelle dans ce relevé.", "decision-muted"));
  container.append(suggestions);
  const list = decisionElement("ul", null, "bench-energy-list");
  report.players.forEach(player => {
    const li = decisionElement("li");
    const status = player.unavailable ? tacticUnavailableLabel({ reason: player.unavailable }) : player.active ? "Terrain au dernier relevé" : player.selected ? "Hors du format actif" : "Banc";
    li.append(decisionElement("span", player.name || "Sans nom"), decisionElement("span", `${player.energy === null ? "—" : player.energy + " %"} · ${status}`, "decision-muted"));
    if (player.energy !== null) { const meter = decisionElement("meter"); meter.min = 0; meter.max = 100; meter.value = player.energy; meter.setAttribute("aria-label", `Énergie de ${player.name || "ce joueur"}`); li.append(meter); }
    list.append(li);
  });
  container.append(list);
}
function proposeBenchReplacement(suggestion) {
  if (!matchState || matchState.finished || phaseLineupState) return;
  const setup = matchState.userSide === "home" ? matchState.homeSetup : matchState.awaySetup;
  const valid = () => setup.assignments[suggestion.slotIndex] === suggestion.outId
    && !setup.assignments.includes(suggestion.inId)
    && planTacticDropForScreen(setup, MATCH_TACTICS_IDS, suggestion.inId, suggestion.slotIndex, "in").valid;
  if (!valid()) { showAlert("Ce remplacement n’est plus disponible. Consulte la composition actuelle."); return; }
  openMatchTactics();
  showConfirm(`Remplacer ${suggestion.outName} par ${suggestion.inName} au poste ${suggestion.pos} ? Les énergies sont celles du dernier relevé présenté. Le changement utilisera les commandes tactiques habituelles.`, () => {
    if (!matchState || matchState.finished || !valid()) { showAlert("La composition a changé. Aucun remplacement n’a été effectué."); return; }
    if (moveTacticPlayer(setup, MATCH_TACTICS_IDS, suggestion.inId, suggestion.slotIndex, "in")) closeMatchTactics();
  }, { title: "Confirmer le remplacement", confirmLabel: "Confirmer le remplacement" });
}
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("btn-bench-advisor")?.addEventListener("click", () => {
    openMatchTactics();
    const details = document.getElementById("bench-advisor");
    details.open = true; details.scrollIntoView({ block: "nearest" });
    details.querySelector("summary").focus();
  });
});
