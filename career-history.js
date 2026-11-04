/* Rapports persistants : snapshots de scalaires uniquement, sans dépendance au moteur/STATE.
 * Ordre de stockage : du plus ancien au plus récent. Conservation : 200 rapports au maximum,
 * et 900 000 caractères JSON (~1,8 Mo UTF-16), afin de laisser de la place à la carrière.
 * Le premier rapport d'une fixtureKey gagne : continuer/recharger ne réécrit pas le passé.
 * Les compositions fournies sont celles de FIN de match ; participants indique qui a joué.
 * Les statistiques absentes restent null et sont affichées « — », jamais reconstruites.
 */
(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CareerHistory = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const VERSION = 1;
  const MAX_REPORTS = 200;
  const MAX_STORAGE_CHARS = 900000;
  const MAX_EVENTS = 80;
  const MAX_PLAYERS = 32;
  const STAT_FIELDS = [
    ["possession", "Possession", "%"], ["shots", "Tirs"], ["shotsOnTarget", "Tirs cadrés"],
    ["xG", "Buts attendus (xG)"], ["passesAttempted", "Passes tentées"],
    ["passesCompleted", "Passes réussies"], ["interceptions", "Interceptions"],
    ["tackles", "Tacles"], ["saves", "Arrêts"], ["clearances", "Dégagements"], ["fouls", "Fautes"]
  ];
  const ROLE_LABELS = {
    keeper: "Gardien", stay_back: "Défenseur fixe", overlap: "Défenseur offensif", creator: "Créateur",
    ball_winner: "Récupérateur", box_to_box: "Relayeur", runner: "Profondeur", target: "Point d’appui", poacher: "Finisseur"
  };
  const PLAN_LABELS = {
    possession: "Possession", direct: "Jeu direct", transition: "Transition", zone: "Zone",
    high: "Pressing haut", low: "Bloc bas", balanced: "Équilibrée", attacking: "Offensive", cautious: "Prudente"
  };
  const object = value => value !== null && typeof value === "object" && !Array.isArray(value);
  const own = (value, key) => object(value) && Object.prototype.hasOwnProperty.call(value, key) ? value[key] : undefined;
  const string = (value, limit = 120) => typeof value === "string" ? value.slice(0, limit) : "";
  const identifier = value => typeof value === "string" ? string(value) : Number.isFinite(value) ? String(value) : null;
  const number = value => typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
  const scalar = value => typeof value === "string" ? string(value) : number(value);
  const uniqueIds = value => Array.isArray(value)
    ? [...new Set(value.map(identifier).filter(value => value !== null))].slice(0, MAX_PLAYERS) : [];
  const slots = value => Array.isArray(value) ? value.slice(0, 16).map(identifier) : [];

  function normalizeSetup(value) {
    const source = object(value) ? value : {};
    return {
      formation: string(source.formation, 40), formationOOP: string(source.formationOOP, 40),
      attackPlan: string(source.attackPlan, 40), defensePlan: string(source.defensePlan, 40),
      mentality: string(source.mentality, 40), teamStyle: string(source.teamStyle, 40),
      lineup: uniqueIds(source.lineup), assignments: slots(source.assignments), assignmentsOOP: slots(source.assignmentsOOP),
      playerRoles: Object.fromEntries(Object.entries(object(source.playerRoles) ? source.playerRoles : {})
        .slice(0, MAX_PLAYERS).map(([id, role]) => [string(id), string(role, 40)]))
    };
  }

  function snapshotTeam(team, setup, result, side) {
    team = object(team) ? team : {};
    const roster = Array.isArray(team.players) ? team.players.filter(object) : [];
    const byId = new Map(roster.map(player => [identifier(player.id), player]));
    const savedSetup = normalizeSetup(setup);
    const explicit = own(result.participants, side);
    let participationSource = "unknown", participantIds = [];
    if (Array.isArray(explicit)) {
      participantIds = uniqueIds(explicit);
      participationSource = "engine";
    } else {
      participantIds = uniqueIds(Object.keys(object(result.ratings) ? result.ratings : {}).filter(id => byId.has(id)));
      if (participantIds.length) participationSource = "ratings";
      else {
        participantIds = uniqueIds(Object.keys(object(result.minutesPlayed) ? result.minutesPlayed : {})
          .filter(id => byId.has(id) && number(own(result.minutesPlayed, id)) > 0));
        if (participantIds.length) participationSource = "minutes";
      }
    }
    const ids = uniqueIds([...participantIds, ...savedSetup.lineup, ...savedSetup.assignments, ...savedSetup.assignmentsOOP]);
    const players = ids.map(id => {
      const player = byId.get(id) || {};
      const stat = own(result.playerStats, id);
      return {
        id, name: string(player.name), pos: string(player.pos, 12), role: string(own(savedSetup.playerRoles, id), 40),
        rating: number(own(result.ratings, id)), goals: number(own(stat, "goals")),
        assists: number(own(stat, "assists")), minutesPlayed: number(own(result.minutesPlayed, id))
      };
    });
    // Ne conserve pas les rôles de joueurs du banc qui n'ont jamais été concernés.
    savedSetup.playerRoles = Object.fromEntries(ids.filter(id => own(savedSetup.playerRoles, id) !== undefined)
      .map(id => [id, own(savedSetup.playerRoles, id)]));
    return { id: identifier(team.id) || identifier(result[side + "TeamId"]), name: string(team.name),
      setup: savedSetup, participantIds, participationSource, players };
  }

  function importantEvent(event) {
    const type = string(event.type, 40).toLowerCase();
    if (["goal", "owngoal", "yellow", "red", "injury", "penalty", "substitution", "shootout", "shootout miss"].includes(type)) return true;
    if (type === "miss") return /penalty|shootout/i.test(string(event.text, 300));
    if (type.startsWith("phase")) return event.inId != null || event.outId != null ||
      /carte|joker|penalty|shootout|matchball|dé géant|buts? (?:comptent|comptera)|but double|nouveau joueur|format complet|tirs au but/i.test(string(event.text, 300));
    return false;
  }

  function snapshotEvent(source) {
    const event = { type: string(source.type, 40), minute: number(source.minute),
      text: string(source.text, 300), side: source.side === "home" || source.side === "away" ? source.side : null };
    for (const key of ["team", "playerId", "scorerId", "assisterId", "inId", "outId", "takerId", "gkId"]) {
      const value = key === "team" ? string(source[key]) : identifier(source[key]);
      if (value) event[key] = value;
    }
    if (object(source.score)) event.score = { homeGoals: number(source.score.homeGoals), awayGoals: number(source.score.awayGoals) };
    return event;
  }

  function normalizeEvents(value) {
    const important = Array.isArray(value) ? value.filter(event => object(event) && importantEvent(event)) : [];
    return { events: important.slice(-MAX_EVENTS).map(snapshotEvent), omitted: Math.max(0, important.length - MAX_EVENTS) };
  }

  function normalizeScore(source) {
    source = object(source) ? source : {};
    const shootout = object(source.shootout) ? {
      homeScore: number(source.shootout.homeScore), awayScore: number(source.shootout.awayScore),
      homeWins: typeof source.shootout.homeWins === "boolean" ? source.shootout.homeWins : null
    } : null;
    return { homeGoals: number(source.homeGoals), awayGoals: number(source.awayGoals),
      penaltyWinner: source.penaltyWinner === "home" || source.penaltyWinner === "away" ? source.penaltyWinner : null, shootout };
  }

  function fixtureIdentity(report) {
    return report.fixtureKey || "match:" + JSON.stringify([
      report.competition, report.season, report.round, report.home.id, report.away.id, report.date
    ]);
  }

  /** result : retour de engine.finalize(). date/competition : libellés figés fournis par l'appelant.
   * round : indice 0 du championnat, ou libellé du tour de tournoi. fixtureKey : clé stable de fixture.
   * Retourne null si aucun score n'est disponible. N'altère jamais ses arguments.
   */
  function buildReport(options) {
    if (!object(options) || !object(options.result)) return null;
    const result = options.result;
    const score = normalizeScore(result);
    if (score.homeGoals === null && score.awayGoals === null) return null;
    const captured = normalizeEvents(result.events);
    const statistics = { home: {}, away: {} };
    for (const side of ["home", "away"]) for (const [key] of STAT_FIELDS) {
      const resultKey = side + key.charAt(0).toUpperCase() + key.slice(1);
      statistics[side][key] = number(result[resultKey]);
    }
    const report = {
      version: VERSION, fixtureKey: string(options.fixtureKey, 300), season: scalar(options.season),
      round: scalar(options.round), date: scalar(options.date), competition: string(options.competition),
      userTeamId: identifier(options.userTeamId), home: snapshotTeam(options.homeTeam, options.homeSetup, result, "home"),
      away: snapshotTeam(options.awayTeam, options.awaySetup, result, "away"), score, statistics,
      events: captured.events, eventsOmitted: captured.omitted
    };
    report.id = fixtureIdentity(report);
    return report;
  }

  function normalizeTeam(value) {
    value = object(value) ? value : {};
    const setup = normalizeSetup(value.setup);
    const participantIds = uniqueIds(value.participantIds);
    const seen = new Set();
    const players = (Array.isArray(value.players) ? value.players : []).filter(object).slice(0, MAX_PLAYERS)
      .map(player => ({ id: identifier(player.id), name: string(player.name), pos: string(player.pos, 12),
        role: string(player.role, 40), rating: number(player.rating), goals: number(player.goals),
        assists: number(player.assists), minutesPlayed: number(player.minutesPlayed) }))
      .filter(player => player.id !== null && !seen.has(player.id) && seen.add(player.id));
    return { id: identifier(value.id), name: string(value.name), setup, participantIds,
      participationSource: ["engine", "ratings", "minutes"].includes(value.participationSource) ? value.participationSource : "unknown", players };
  }

  function normalizeReport(value) {
    if (!object(value) || !object(value.home) || !object(value.away)) return null;
    const score = normalizeScore(value.score);
    if (score.homeGoals === null && score.awayGoals === null) return null;
    const statistics = { home: {}, away: {} };
    for (const side of ["home", "away"]) for (const [key] of STAT_FIELDS) {
      statistics[side][key] = number(own(own(value.statistics, side), key));
    }
    const captured = normalizeEvents(value.events);
    const report = {
      version: VERSION, fixtureKey: string(value.fixtureKey, 300), season: scalar(value.season), round: scalar(value.round),
      date: scalar(value.date), competition: string(value.competition), userTeamId: identifier(value.userTeamId),
      home: normalizeTeam(value.home), away: normalizeTeam(value.away), score, statistics,
      events: captured.events, eventsOmitted: (number(value.eventsOmitted) || 0) + captured.omitted
    };
    report.id = fixtureIdentity(report);
    return report;
  }

  function boundReports(reports) {
    const bounded = reports.slice(-MAX_REPORTS);
    let size = 2 + Math.max(0, bounded.length - 1) + bounded.reduce((total, report) => total + JSON.stringify(report).length, 0);
    while (bounded.length && size > MAX_STORAGE_CHARS) {
      const oldest = bounded.shift();
      size -= JSON.stringify(oldest).length + (bounded.length ? 1 : 0);
    }
    return bounded;
  }

  /** Accepte undefined, null ou une ancienne sauvegarde sans rapports ; renvoie [].
   * Une entrée invalide est ignorée. Ne réhydrate aucune donnée depuis les effectifs courants.
   */
  function normalizeReports(value) {
    if (!Array.isArray(value)) return [];
    const seen = new Set();
    const reports = [];
    for (const entry of value) {
      const report = normalizeReport(entry);
      if (report && !seen.has(report.id)) { seen.add(report.id); reports.push(report); }
    }
    return boundReports(reports);
  }

  function addReport(reports, report) {
    const normalized = normalizeReports(reports);
    const incoming = normalizeReport(report);
    if (!incoming || normalized.some(existing => existing.id === incoming.id)) return normalized;
    return boundReports([...normalized, incoming]);
  }

  function node(doc, tag, className, text) {
    const element = doc.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = String(text);
    return element;
  }
  function name(team) { return team.name || "Équipe inconnue"; }
  function scoreText(score) { return `${score.homeGoals ?? "—"} – ${score.awayGoals ?? "—"}`; }
  function details(report) {
    return [report.season != null ? `Saison ${report.season}` : "Saison inconnue", report.competition,
      typeof report.round === "number" ? `Journée ${report.round + 1}` : report.round, report.date].filter(value => value !== null && value !== "").join(" · ");
  }
  function shootoutText(report) {
    const score = report.score;
    if (score.shootout) return `Tirs au but : ${score.shootout.homeScore ?? "—"} – ${score.shootout.awayScore ?? "—"}`;
    if (score.penaltyWinner) return `Victoire aux tirs au but : ${name(report[score.penaltyWinner])}`;
    return "";
  }

  /** Le propriétaire ouvre/ferme son modal et gère son focus. onOpen(report, boutonDéclencheur).
   * Retourne { refresh(nextReports) } ; un refresh conserve le filtre de saison si possible.
   */
  function renderList(container, reports, options) {
    const doc = container.ownerDocument;
    let values = normalizeReports(reports);
    options = object(options) ? options : {};
    container.replaceChildren();
    container.classList.add("history-list");
    const toolbar = node(doc, "div", "history-toolbar");
    const label = node(doc, "label", "history-filter-label", "Saison ");
    const select = node(doc, "select", "history-season-filter");
    label.append(select); toolbar.append(label);
    const clubLabel = node(doc, "label", "history-filter-label", "Rencontres ");
    const clubSelect = node(doc, "select", "history-season-filter");
    for (const [value, text] of [["all", "Toutes les rencontres"], ["mine", "Mon club"]]) {
      const option = node(doc, "option", "", text); option.value = value; clubSelect.append(option);
    }
    clubLabel.append(clubSelect); toolbar.append(clubLabel);
    const count = node(doc, "p", "history-count");
    count.setAttribute("aria-live", "polite"); count.setAttribute("role", "status");
    toolbar.append(count);
    const list = node(doc, "ul", "history-fixtures");
    const note = node(doc, "p", "history-note", "Conservation des 200 derniers rapports au maximum ; la limite de taille peut réduire ce nombre. Les anciens scores n’ont pas de rapport : les prochaines rencontres seront enregistrées.");
    container.append(toolbar, list, note);
    function draw() {
      const visible = values.filter(report => (select.value === "all" || String(report.season ?? "unknown") === select.value) &&
        (clubSelect.value !== "mine" || report.userTeamId && [report.home.id, report.away.id].includes(report.userTeamId))).slice().reverse();
      count.textContent = `${visible.length} rencontre${visible.length === 1 ? "" : "s"}`;
      list.replaceChildren();
      if (!visible.length) {
        const empty = node(doc, "li", "history-empty", "Aucun rapport enregistré pour cette sélection.");
        list.append(empty); return;
      }
      for (const report of visible) {
        const item = node(doc, "li", "history-fixture");
        const description = node(doc, "div", "history-fixture-info");
        description.append(node(doc, "p", "history-meta", details(report)));
        const fixture = node(doc, "p", "history-matchup");
        fixture.append(node(doc, "span", "history-team-name", name(report.home)),
          node(doc, "strong", "history-score", scoreText(report.score)), node(doc, "span", "history-team-name", name(report.away)));
        description.append(fixture);
        const penalties = shootoutText(report);
        if (penalties) description.append(node(doc, "p", "history-meta", penalties));
        const button = node(doc, "button", "history-open", "Rapport");
        button.type = "button";
        button.setAttribute("aria-label", `Rapport : ${name(report.home)} ${scoreText(report.score)} ${name(report.away)}, ${details(report)}`);
        if (typeof options.onOpen === "function") button.addEventListener("click", () => options.onOpen(report, button));
        else { button.disabled = true; button.title = "Ouverture du rapport indisponible"; }
        item.append(description, button); list.append(item);
      }
    }
    function refresh(nextReports) {
      const selected = select.value || "all";
      values = normalizeReports(nextReports);
      select.replaceChildren();
      const seasons = [...new Set(values.map(report => String(report.season ?? "unknown")))].reverse();
      const all = node(doc, "option", "", "Toutes les saisons"); all.value = "all"; select.append(all);
      for (const season of seasons) {
        const option = node(doc, "option", "", season === "unknown" ? "Saison inconnue" : `Saison ${season}`);
        option.value = season; select.append(option);
      }
      select.value = seasons.includes(selected) ? selected : "all";
      draw();
    }
    select.addEventListener("change", draw);
    clubSelect.addEventListener("change", draw);
    refresh(values);
    return { refresh };
  }

  function table(doc, heading, columns, rows) {
    const wrapper = node(doc, "div", "history-table-scroll");
    wrapper.tabIndex = 0; wrapper.setAttribute("role", "region"); wrapper.setAttribute("aria-label", heading);
    const element = node(doc, "table", "history-table");
    element.append(node(doc, "caption", "history-sr-only", heading));
    const thead = node(doc, "thead"); const tr = node(doc, "tr");
    for (const column of columns) { const th = node(doc, "th", "", column); th.scope = "col"; tr.append(th); }
    thead.append(tr); element.append(thead);
    const tbody = node(doc, "tbody");
    for (const row of rows) {
      const rowNode = node(doc, "tr");
      row.forEach((value, i) => { const cell = node(doc, i === 0 ? "th" : "td", "", value ?? "—"); if (i === 0) cell.scope = "row"; rowNode.append(cell); });
      tbody.append(rowNode);
    }
    element.append(tbody); wrapper.append(element); return wrapper;
  }

  function display(value, field) {
    if (value === null) return "—";
    if (field === "xG") return value.toFixed(2);
    return field === "possession" ? `${value} %` : String(value);
  }

  /** Remplit seulement le corps fourni. Ne touche ni au titre ni à l'état du modal statique. */
  function renderReport(container, value) {
    const doc = container.ownerDocument;
    const report = normalizeReport(value);
    container.replaceChildren(); container.classList.add("history-report");
    if (!report) { container.append(node(doc, "p", "history-empty", "Ce rapport n’est pas disponible.")); return; }
    container.append(node(doc, "p", "history-meta", details(report)));
    const scoreboard = node(doc, "div", "history-scoreboard");
    scoreboard.append(node(doc, "strong", "history-team-name", name(report.home)),
      node(doc, "strong", "history-score", scoreText(report.score)), node(doc, "strong", "history-team-name", name(report.away)));
    container.append(scoreboard);
    const penalties = shootoutText(report);
    if (penalties) container.append(node(doc, "p", "history-shootout", penalties));
    container.append(node(doc, "p", "history-note", "Les données absentes sont indiquées par —. Les buts comptant double et les buts spéciaux peuvent différer du total des buteurs."));
    const stats = node(doc, "section", "history-section");
    stats.append(node(doc, "h4", "history-section-title", "Statistiques"));
    const rows = STAT_FIELDS.filter(([key]) => report.statistics.home[key] !== null || report.statistics.away[key] !== null)
      .map(([key, label]) => [label, display(report.statistics.home[key], key), display(report.statistics.away[key], key)]);
    if (rows.length) stats.append(table(doc, `Statistiques : ${name(report.home)} à domicile, ${name(report.away)} à l’extérieur`, ["Statistique", "Domicile", "Extérieur"], rows));
    else stats.append(node(doc, "p", "history-empty", "Aucune statistique détaillée disponible pour ce match."));
    container.append(stats);
    for (const side of ["home", "away"]) {
      const team = report[side]; const setup = team.setup;
      const section = node(doc, "section", "history-section");
      section.append(node(doc, "h4", "history-section-title", name(team)));
      const tactics = [setup.formation, setup.attackPlan && (PLAN_LABELS[setup.attackPlan] || setup.attackPlan),
        setup.defensePlan && (PLAN_LABELS[setup.defensePlan] || setup.defensePlan), setup.mentality && (PLAN_LABELS[setup.mentality] || setup.mentality)].filter(Boolean);
      section.append(node(doc, "p", "history-tactics", `Composition à la fin du match${tactics.length ? " · " + tactics.join(" · ") : " : indisponible"}`));
      const playerNames = new Map(team.players.map(player => [player.id, player.name || "Joueur inconnu"]));
      const composition = setup.assignments.length ? setup.assignments : setup.lineup;
      if (composition.length) section.append(node(doc, "p", "history-lineup", composition.map(id => id ? playerNames.get(id) || "Joueur inconnu" : "Place libre").join(" · ")));
      const known = team.participationSource !== "unknown";
      const participants = team.players.filter(player => known ? team.participantIds.includes(player.id) : true);
      section.append(node(doc, "p", "history-note", known ? "Participants et performances" : "Composition enregistrée ; participation réelle et performances parfois indisponibles dans les anciennes données."));
      const playerRows = participants.map(player => [player.name || "Joueur inconnu", player.pos || "—",
        ROLE_LABELS[player.role] || player.role || "—", player.rating === null ? "—" : player.rating.toFixed(1),
        player.goals, player.assists, player.minutesPlayed === null ? "—" : Math.round(player.minutesPlayed * 10) / 10]);
      if (playerRows.length) {
        const playerTable = table(doc, `Participants — ${name(team)}`, ["Joueur", "Poste", "Rôle", "Note", "Buts", "Passes D.", "Min."], playerRows);
        playerTable.classList.add("history-player-table"); section.append(playerTable);
      }
      else section.append(node(doc, "p", "history-empty", "Aucun participant enregistré."));
      container.append(section);
    }
    const eventsSection = node(doc, "section", "history-section");
    eventsSection.append(node(doc, "h4", "history-section-title", "Faits marquants"));
    if (report.eventsOmitted) eventsSection.append(node(doc, "p", "history-note", `${report.eventsOmitted} événement(s) ancien(s) omis pour limiter la taille du rapport.`));
    const timeline = node(doc, "ol", "history-events");
    for (const event of report.events) {
      const item = node(doc, "li", "history-event");
      if (event.minute !== null) item.append(node(doc, "span", "history-event-minute", `${event.minute}′`));
      const text = event.minute !== null ? event.text.replace(/^\d+(?:\.\d+)?['′]\s*(?:—|-)\s*/, "") : event.text;
      item.append(node(doc, "span", "history-event-text", text || event.type)); timeline.append(item);
    }
    if (report.events.length) eventsSection.append(timeline);
    else eventsSection.append(node(doc, "p", "history-empty", "Aucun événement important enregistré."));
    container.append(eventsSection);
  }

  return Object.freeze({ VERSION, MAX_REPORTS, MAX_STORAGE_CHARS, MAX_EVENTS, buildReport, normalizeReports, addReport, renderList, renderReport });
});
