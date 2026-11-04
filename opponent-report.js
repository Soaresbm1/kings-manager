/* Rapport de préparation en lecture seule. Les résultats et statistiques sont ceux
 * de la saison de carrière reçue ; aucune composition IA ni donnée réelle externe.
 * API navigateur/CommonJS : OpponentReport.build({ team, opponent, league }),
 * puis OpponentReport.render(container, report). Les résultats sont récents d'abord.
 */
(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.OpponentReport = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const POSITIONS = ["GK", "DEF", "MID", "ATT"];
  const POSITION_NAMES = { GK: "Gardiens", DEF: "Défenseurs", MID: "Milieux", ATT: "Attaquants" };
  const object = value => value !== null && typeof value === "object" && !Array.isArray(value);
  const text = value => typeof value === "string" ? value : "";
  const identifier = value => typeof value === "string" ? value : Number.isFinite(value) ? String(value) : null;
  const count = value => Number.isInteger(value) && value >= 0 ? value : null;
  const rating = value => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 99 ? value : null;
  const round1 = value => Math.round(value * 10) / 10;
  const roster = team => object(team) && Array.isArray(team.players) ? team.players.filter(object) : [];
  const identity = (team, fallback) => ({ id: identifier(team && team.id), name: text(team && team.name) || fallback });
  const available = player => !player.injured && !player.suspended;
  const plural = (value, singular, multiple) => `${value} ${value === 1 ? singular : multiple}`;

  function positionProfile(players, pos, rosterAvailable) {
    if (!rosterAvailable) return { total: null, available: null, rated: null, average: null };
    const all = players.filter(player => player.pos === pos);
    const eligible = all.filter(available);
    const ratings = eligible.map(player => rating(player.overall)).filter(value => value !== null);
    return { total: all.length, available: eligible.length, rated: ratings.length,
      average: ratings.length ? round1(ratings.reduce((sum, value) => sum + value, 0) / ratings.length) : null };
  }

  function build(input) {
    input = object(input) ? input : {};
    if (!object(input.opponent)) return null;
    const team = identity(input.team, "Votre équipe");
    const opponent = identity(input.opponent, "Adversaire");
    const players = roster(input.opponent), humanPlayers = roster(input.team);
    const opponentRosterAvailable = Array.isArray(input.opponent.players);
    const teamRosterAvailable = Array.isArray(input.team && input.team.players);
    const league = object(input.league) ? input.league : {};
    const clubs = Array.isArray(league.teams) ? league.teams.filter(object) : [];
    const leagueAvailable = opponent.id !== null && clubs.some(club => identifier(club.id) === opponent.id);
    const clubsById = new Map(clubs.map(club => [identifier(club.id), club]));
    const limitations = [];
    let invalidResults = 0;
    const recentResults = (leagueAvailable && Array.isArray(league.results) ? league.results : [])
      .map((result, index) => ({ result, index }))
      .filter(({ result }) => object(result) && result.played === true &&
        (identifier(result.home) === opponent.id || identifier(result.away) === opponent.id))
      .filter(({ result }) => {
        const valid = count(result.homeGoals) !== null && count(result.awayGoals) !== null &&
          identifier(result.home) !== identifier(result.away);
        if (!valid) invalidResults++;
        return valid;
      })
      .sort((a, b) => (count(b.result.round) ?? b.index) - (count(a.result.round) ?? a.index) || b.index - a.index)
      .slice(0, 5)
      .map(({ result }) => {
        const side = identifier(result.home) === opponent.id ? "home" : "away";
        const otherId = identifier(side === "home" ? result.away : result.home);
        const goalsFor = side === "home" ? result.homeGoals : result.awayGoals;
        const goalsAgainst = side === "home" ? result.awayGoals : result.homeGoals;
        const tied = goalsFor === goalsAgainst;
        const penaltyWinner = tied && ["home", "away"].includes(result.penaltyWinner) ? result.penaltyWinner : null;
        const outcome = tied ? (penaltyWinner ? (penaltyWinner === side ? "W" : "L") : null)
          : (goalsFor > goalsAgainst ? "W" : "L");
        const other = clubsById.get(otherId);
        return { round: count(result.round), opponent: identity(other || { id: otherId }, "Club non renseigné"),
          opponentNameAvailable: !!text(other && other.name),
          venue: side === "home" ? "home" : "away", goalsFor, goalsAgainst, outcome,
          penalties: tied, penaltyWinner, decidedByPenalties: tied && penaltyWinner !== null };
      });
    const form = recentResults.reduce((summary, result) => {
      summary.played++;
      if (result.outcome === "W") summary.wins++;
      else if (result.outcome === "L") summary.losses++;
      else summary.unknown++;
      summary.goalsFor += result.goalsFor;
      summary.goalsAgainst += result.goalsAgainst;
      return summary;
    }, { played: 0, wins: 0, losses: 0, unknown: 0, goalsFor: 0, goalsAgainst: 0 });
    const scorers = players.filter(player => count(player.goals) !== null && player.goals > 0)
      .map(player => ({ id: identifier(player.id), name: text(player.name) || "Joueur non renseigné",
        pos: POSITIONS.includes(player.pos) ? player.pos : "", goals: player.goals, matches: count(player.matches),
        available: available(player) }))
      .sort((a, b) => b.goals - a.goals || a.name.localeCompare(b.name, "fr"))
      .slice(0, 3);
    const absences = players.filter(player => !available(player)).map(player => ({
      id: identifier(player.id), name: text(player.name) || "Joueur non renseigné",
      pos: POSITIONS.includes(player.pos) ? player.pos : "", injured: !!player.injured, suspended: !!player.suspended,
      injuryDaysLeft: player.injured && count(player.injuryDaysLeft) > 0 ? player.injuryDaysLeft : null
    }));
    const positions = POSITIONS.map(pos => {
      const human = positionProfile(humanPlayers, pos, teamRosterAvailable), rival = positionProfile(players, pos, opponentRosterAvailable);
      return { pos, label: POSITION_NAMES[pos], team: human, opponent: rival,
        delta: human.average !== null && rival.average !== null ? round1(rival.average - human.average) : null };
    });
    const missingScorerStats = players.filter(player => count(player.goals) === null || count(player.matches) === null).length;
    if (!leagueAvailable) limitations.push("L’adversaire n’est pas identifié dans la ligue fournie : son historique de championnat est indisponible.");
    else if (!recentResults.length) limitations.push("Aucun résultat de championnat joué et exploitable cette saison.");
    if (invalidResults) limitations.push("Des résultats sans score exploitable ont été écartés.");
    if (form.unknown) limitations.push("Une égalité est enregistrée sans vainqueur aux tirs au but : l’issue reste inconnue.");
    if (recentResults.some(result => !result.opponentNameAvailable)) limitations.push("Le nom d’un club rencontré n’est pas renseigné.");
    if (!players.length) limitations.push("L’effectif adverse n’est pas renseigné.");
    if (missingScorerStats) limitations.push("Les statistiques de buts ou de matchs sont incomplètes pour certains joueurs.");
    if (!teamRosterAvailable) limitations.push("Votre effectif n’est pas renseigné pour la comparaison.");
    if (positions.some(row => row.team.rated < row.team.available || row.opponent.rated < row.opponent.available)) {
      limitations.push("Les moyennes utilisent uniquement les notes du jeu renseignées parmi les joueurs disponibles.");
    }
    const availabilitySummary = opponentRosterAvailable ? `${plural(absences.length, "joueur indisponible", "joueurs indisponibles")}.` : "Disponibilité non renseignée.";
    const summary = form.played
      ? `${plural(form.played, "match récent", "matchs récents")} · ${plural(form.wins, "victoire", "victoires")} · ${plural(form.losses, "défaite", "défaites")}${form.unknown ? ` · ${plural(form.unknown, "issue inconnue", "issues inconnues")}` : ""}. ${availabilitySummary}`
      : `Forme récente indisponible. ${availabilitySummary}`;
    return { version: 1, team, opponent, leagueName: text(league.name), leagueAvailable,
      teamRosterAvailable, opponentRosterAvailable, recentResults, form, scorers, missingScorerStats, absences, positions, limitations, summary };
  }

  function node(doc, tag, className, value) {
    const element = doc.createElement(tag);
    if (className) element.className = className;
    if (value !== undefined) element.textContent = value;
    return element;
  }
  function section(doc, body, className, title) {
    const element = node(doc, "section", `scout-section ${className}`);
    element.appendChild(node(doc, "h4", "scout-section-title", title));
    body.appendChild(element);
    return element;
  }
  function note(doc, parent, value) { parent.appendChild(node(doc, "p", "scout-note", value)); }
  const scoreText = value => value === null ? "—" : String(value).replace(".", ",");

  function render(container, report) {
    if (!container || !container.ownerDocument) return null;
    const doc = container.ownerDocument;
    container.replaceChildren();
    if (!report) {
      note(doc, container, "Le rapport sur l’adversaire n’est pas disponible.");
      return null;
    }
    const details = node(doc, "details", "scout-report");
    const toggle = node(doc, "summary", "scout-toggle");
    const title = node(doc, "span", "scout-heading", "Rapport sur l’adversaire");
    toggle.appendChild(title);
    toggle.appendChild(node(doc, "span", "scout-opponent", report.opponent.name));
    toggle.appendChild(node(doc, "span", "scout-brief", report.summary));
    details.appendChild(toggle);
    const body = node(doc, "div", "scout-body");
    note(doc, body, `Carrière · Saison en cours${report.leagueAvailable && report.leagueName ? ` · ${report.leagueName}` : ""}.`);

    const recent = section(doc, body, "scout-recent", "Les 5 derniers résultats de championnat");
    if (!report.recentResults.length) note(doc, recent, "Aucun résultat récent disponible dans cette ligue.");
    else {
      note(doc, recent, `Du plus récent au plus ancien · ${report.form.goalsFor} buts pour, ${report.form.goalsAgainst} contre. Les buts de la séance de tirs au but ne sont pas ajoutés au score.`);
      const list = node(doc, "ol", "scout-results");
      report.recentResults.forEach(result => {
        const row = node(doc, "li", "scout-result");
        const outcome = result.outcome === "W" ? "Victoire" : result.outcome === "L" ? "Défaite" : "Issue non renseignée";
        row.appendChild(node(doc, "span", `scout-outcome scout-outcome-${result.outcome === "W" ? "win" : result.outcome === "L" ? "loss" : "unknown"}`, outcome));
        const info = node(doc, "div", "scout-result-info");
        info.appendChild(node(doc, "span", "scout-name", result.opponent.name));
        info.appendChild(node(doc, "span", "scout-meta", `${result.round === null ? "" : `J${result.round + 1} · `}${result.venue === "home" ? "Domicile" : "Extérieur"}${result.decidedByPenalties ? " · aux tirs au but" : result.penalties ? " · vainqueur aux tirs au but non renseigné" : ""}`));
        row.appendChild(info);
        row.appendChild(node(doc, "strong", "scout-score", `${result.goalsFor} – ${result.goalsAgainst}`));
        list.appendChild(row);
      });
      recent.appendChild(list);
    }

    const scorers = section(doc, body, "scout-scorers", "Meilleurs buteurs de la saison");
    if (!report.scorers.length) note(doc, scorers, report.missingScorerStats || !report.positions.some(row => row.opponent.total)
      ? "Statistiques de buts non disponibles ou incomplètes." : "Aucun but enregistré cette saison.");
    else {
      const list = node(doc, "ol", "scout-player-list");
      report.scorers.forEach(player => {
        const row = node(doc, "li", "scout-player");
        row.appendChild(node(doc, "span", "scout-name", player.name));
        row.appendChild(node(doc, "span", "scout-player-stat", `${plural(player.goals, "but", "buts")} · ${player.matches === null ? "matchs non renseignés" : plural(player.matches, "match", "matchs")}${player.available ? "" : " · indisponible"}`));
        list.appendChild(row);
      });
      scorers.appendChild(list);
    }
    note(doc, scorers, "Buts et matchs de la saison enregistrés dans cette carrière pour les joueurs de l’effectif actuel.");

    const absences = section(doc, body, "scout-absences", "Disponibilité de l’effectif adverse");
    if (!report.absences.length) note(doc, absences, report.positions.some(row => row.opponent.total)
      ? "Aucun joueur signalé blessé ou suspendu." : "Effectif non renseigné.");
    else {
      const list = node(doc, "ul", "scout-player-list");
      report.absences.forEach(player => {
        const row = node(doc, "li", "scout-player");
        row.appendChild(node(doc, "span", "scout-name", `${player.name}${player.pos ? ` · ${player.pos}` : ""}`));
        const reasons = [];
        if (player.injured) reasons.push(player.injuryDaysLeft === null ? "Blessé · durée non renseignée" : `Blessé · ${plural(player.injuryDaysLeft, "jour restant", "jours restants")} dans le jeu`);
        if (player.suspended) reasons.push("Suspendu · durée non renseignée");
        row.appendChild(node(doc, "span", "scout-player-stat", reasons.join(" ; ")));
        list.appendChild(row);
      });
      absences.appendChild(list);
    }

    const comparison = section(doc, body, "scout-comparison", "Comparaison par poste");
    note(doc, comparison, "Moyenne d’overall des joueurs disponibles : notes du jeu sur 99. Les blessés et suspendus sont exclus. Cette comparaison ne prédit pas la composition adverse.");
    const table = node(doc, "table", "scout-table");
    table.appendChild(node(doc, "caption", "scout-caption", "Joueurs disponibles et note moyenne du jeu par poste"));
    const head = node(doc, "thead");
    const headings = node(doc, "tr");
    ["Poste", report.team.name, report.opponent.name].forEach(label => {
      const cell = node(doc, "th", "", label); cell.scope = "col"; headings.appendChild(cell);
    });
    head.appendChild(headings); table.appendChild(head);
    const tableBody = node(doc, "tbody");
    report.positions.forEach(position => {
      const row = node(doc, "tr", "scout-position-row");
      const label = node(doc, "th", "scout-position", position.pos); label.scope = "row"; label.title = position.label;
      row.appendChild(label);
      [position.team, position.opponent].forEach(profile => {
        const cell = node(doc, "td");
        cell.appendChild(node(doc, "strong", "scout-average", scoreText(profile.average)));
        cell.appendChild(node(doc, "span", "scout-meta", profile.available === null ? "Effectif non renseigné" : plural(profile.available, "disponible", "disponibles")));
        if (profile.rated < profile.available) cell.appendChild(node(doc, "span", "scout-meta", `${profile.rated} avec note`));
        row.appendChild(cell);
      });
      tableBody.appendChild(row);
    });
    table.appendChild(tableBody); comparison.appendChild(table);
    if (report.limitations.length) {
      const limitations = section(doc, body, "scout-limitations", "Données disponibles");
      const list = node(doc, "ul", "scout-limit-list");
      report.limitations.forEach(value => list.appendChild(node(doc, "li", "", value)));
      limitations.appendChild(list);
    }
    details.appendChild(body); container.appendChild(details);
    return details;
  }
  return { build, render };
});
