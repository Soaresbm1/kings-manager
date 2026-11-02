document.addEventListener("DOMContentLoaded", () => {
  const config = window.KINGS_LAB || {};
  document.addEventListener("keydown", event => {
    if (event.ctrlKey || event.metaKey || event.altKey || event.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName)) return;
    if (/^[123rR]$/.test(event.key) || ["ArrowLeft", "ArrowRight"].includes(event.key)) parent.postMessage({ type: "kings-lab-shortcut", key: event.key }, "*");
  });
  // Seule la fixture modifie les données. Les composants, les règles et le hasard
  // sont exactement ceux du jeu, et la graine est réinitialisée à chaque variante.
  selectLeague("france");
  selectTeam(LEAGUES.france.teams.find(team => team.name === "FC Silmi").id);
  startCareer();
  STATE.notifications = [];
  const team = getUserTeam();
  if (config.data === "worst") {
    team.name = "Athletic Dragon Blanc — Kings League France";
    team.budget = 12345678;
    const names = ["Mohammed-Karim Berrabah", "J", "Jo", "Florent Sinama-Pongolle", "Đặng Thị Ngọc Hân", "王秀英", "María José de la Cruz y Fernández", "Seán O'Brien-Ó Súilleabháin"];
    team.players.forEach((player, index) => {
      player.name = names[index % names.length];
      if (index % 3 === 0) { player.officialPlayerId = -1; player.photoName = "Portrait non publié"; }
      if (index === 3) { player.injured = true; player.injuryDaysLeft = 21; player.injurySeverity = "modérée"; }
    });
  }
  updateTopbar();
  const screen = config.screen || "match";
  if (screen === "market") {
    if (config.data === "one") {
      const target = STATE.league.teams.find(other => other.id !== team.id).players[0];
      target.name = "Joueur unique de démonstration";
      document.getElementById("filter-name").value = target.name;
    } else if (config.data === "empty") document.getElementById("filter-name").value = "Zlatan Ibrahimović";
    showTab("transfers");
  } else if (screen === "squad" || screen === "player") {
    if (config.data === "empty") team.players = [];
    if (config.data === "one") team.players = team.players.slice(0, 1);
    showTab("squad");
    if (screen === "player" && team.players.length) {
      if (config.data === "worst") {
        team.players[0].ratingSum = undefined;
        team.players[0].careerRatingSum = undefined;
        team.players[0].form = undefined;
      }
      openPlayerInfoModal(team.players[0], team);
    }
  } else if (screen === "tactics") showTab("tactics");
  else {
    openLineupScreen();
    startMatch();
    autoPhaseLineup();
    if (screen === "summary") { skipMatch(); showMatchSummary(); }
    else if (!matchState.paused) togglePauseMatch();
  }
  if (config.variant === "broadcast") {
    const layout = document.querySelector(".match-layout");
    const toggle = document.createElement("button");
    toggle.className = "secondary broadcast-toggle"; toggle.type = "button";
    toggle.textContent = "Ouvrir le fil du match"; toggle.setAttribute("aria-expanded", "false");
    layout.classList.add("broadcast-focused");
    toggle.onclick = () => {
      const focused = layout.classList.toggle("broadcast-focused");
      toggle.setAttribute("aria-expanded", String(!focused));
      toggle.textContent = focused ? "Ouvrir le fil du match" : "Masquer le fil du match";
      invalidatePitchGeometry();
    };
    document.querySelector(".match-scoreboard").append(toggle);
  }
  document.body.dataset.labReady = "true";
});
