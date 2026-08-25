// ===================== ÉTAT & UI =====================

let STATE = {
  leagueKey: null,
  league: null,        // { name, teams: [...with deep-copied players], results: [...] }
  userTeamId: null,
  schedule: [],         // array of rounds, each round = [{home, away}]
  currentRound: 0,
  season: 1,
  currentDay: 0,        // nombre de jours écoulés depuis le 1er Août de la saison en cours
  notifications: [],     // file d'attente : interviews, messages de joueurs, demandes de transfert IA
  pendingLineup: null,  // setup en cours de préparation
  pendingResult: null,
  mercatoOpen: false,
  shortlist: [],        // ids de joueurs (n'importe quelle ligue) ajoutés à la liste de suivi
  savedTactic: null,    // { formation, assignments, attackPlan, defensePlan }
  currentSlotId: null,  // identifiant de la carrière active (parmi plusieurs)
  seasonPrizeAwarded: false, // évite de créditer deux fois la prime de fin de saison (voir awardSeasonPrizeMoney)
  lastSeasonPrize: null,     // détail de la dernière prime versée, pour l'affichage dans le panneau "Saison terminée"
  transferLog: [],           // historique des transferts (achats/ventes du joueur + IA de sa ligue) — voir logTransferEvent
  trophyHistory: [],         // palmarès : un résumé par saison terminée (classement + résultat tournoi) — voir awardSeasonPrizeMoney
  seasonObjective: null      // objectif de la direction pour la saison en cours — voir generateSeasonObjective
};

const POS_ORDER = { GK: 0, DEF: 1, MID: 2, ATT: 3 };

// Postes qu'un joueur peut occuper sur le terrain en plus de son poste habituel
// (un attaquant peut dépanner au milieu, un milieu peut couvrir toute la largeur du terrain, etc.).
const ELIGIBLE_POS = { GK: ["GK"], DEF: ["DEF", "MID"], MID: ["DEF", "MID", "ATT"], ATT: ["MID", "ATT"] };

// ----------------- SAUVEGARDE MULTI-CARRIÈRES -----------------
// Plusieurs carrières peuvent coexister, chacune dans son propre "slot".
// Exporter/importer un slot en JSON permet de reprendre une carrière sur un autre PC.
const SAVES_KEY = "kingsManager7v7_saves";
const ACTIVE_SLOT_KEY = "kingsManager7v7_activeSlot";

function getSavesMap() {
  try {
    const raw = localStorage.getItem(SAVES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

function persistSavesMap(map) {
  try {
    localStorage.setItem(SAVES_KEY, JSON.stringify(map));
  } catch (e) {
    console.warn("Impossible de sauvegarder la partie :", e);
  }
}

function buildSaveData() {
  return {
    leagueKey: STATE.leagueKey,
    league: STATE.league,
    userTeamId: STATE.userTeamId,
    schedule: STATE.schedule,
    currentRound: STATE.currentRound,
    season: STATE.season,
    currentDay: STATE.currentDay,
    notifications: STATE.notifications,
    mercatoOpen: STATE.mercatoOpen,
    shortlist: STATE.shortlist,
    savedTactic: STATE.savedTactic,
    otherLeagues: STATE.otherLeagues,
    tournament: STATE.tournament,
    seasonPrizeAwarded: STATE.seasonPrizeAwarded,
    lastSeasonPrize: STATE.lastSeasonPrize,
    transferLog: STATE.transferLog,
    trophyHistory: STATE.trophyHistory,
    seasonObjective: STATE.seasonObjective
  };
}

function saveGame() {
  if (!STATE.league || !STATE.currentSlotId) return;
  const map = getSavesMap();
  map[STATE.currentSlotId] = {
    meta: {
      teamName: getUserTeam() ? getUserTeam().name : "",
      leagueName: STATE.league.name,
      round: STATE.currentRound,
      totalRounds: STATE.schedule.length,
      season: STATE.season,
      updatedAt: Date.now()
    },
    data: buildSaveData()
  };
  persistSavesMap(map);
  try { localStorage.setItem(ACTIVE_SLOT_KEY, STATE.currentSlotId); } catch (e) {}
}

function applySaveData(data) {
  STATE.leagueKey = data.leagueKey;
  STATE.league = data.league;
  STATE.userTeamId = data.userTeamId;
  STATE.schedule = data.schedule;
  STATE.currentRound = data.currentRound;
  STATE.season = data.season || 1;
  // sauvegardes antérieures à l'ajout du calendrier : on place le jour sur la journée en cours
  // au lieu de forcer un rattrapage depuis le jour 0
  STATE.currentDay = data.currentDay !== undefined ? data.currentDay : matchDayForRound(data.currentRound || 0);
  STATE.notifications = data.notifications || [];
  STATE.mercatoOpen = data.mercatoOpen;
  STATE.shortlist = data.shortlist || [];
  STATE.savedTactic = data.savedTactic || null;
  STATE.pendingLineup = null;
  STATE.pendingResult = null;
  STATE.seasonPrizeAwarded = data.seasonPrizeAwarded || false;
  STATE.lastSeasonPrize = data.lastSeasonPrize || null;
  STATE.transferLog = data.transferLog || [];
  STATE.trophyHistory = data.trophyHistory || [];
  STATE.seasonObjective = data.seasonObjective || null;
  STATE.otherLeagues = data.otherLeagues || null;
  STATE.tournament = data.tournament || null;
  STATE.tournamentMatchRef = null;
  // migration : sauvegardes créées avant les ligues en arrière-plan — démarre leur saison
  // maintenant plutôt que de laisser cette carrière sans classement pour le futur tournoi.
  if (!STATE.otherLeagues) STATE.otherLeagues = buildOtherLeagues(STATE.leagueKey);
  // migration : corrige les sauvegardes touchées par un bug de startNewSeason() (avant ce
  // correctif) qui recréait entièrement les 5 ligues en arrière-plan depuis data.js à chaque
  // nouvelle saison — un joueur déjà acheté par l'utilisateur (ou transféré par l'IA au sein
  // d'une de ces ligues) réapparaissait dans son club d'origine, achetable une seconde fois avec
  // le même id (bug remonté par l'utilisateur : "j'ai 2 Kelvin Oliveira").
  dedupePlayersById();
  backfillPhotoClub();
  backfillSeasonStats();
  // migration : sauvegardes créées avant les objectifs de saison — en génère un pour la saison en
  // cours plutôt que de laisser le badge de la topbar vide jusqu'à la saison suivante.
  if (!STATE.seasonObjective) STATE.seasonObjective = generateSeasonObjective();
  // JSON a rompu les références d'objets équipe du bracket (cf. relinkTournamentTeamRefs) : on
  // les ré-associe aux vraies équipes maintenant que STATE.league/STATE.otherLeagues sont prêts.
  relinkTournamentTeamRefs();
}

// Migration : retire tout id de joueur en double, qu'il apparaisse deux fois dans la même équipe
// ou dans deux équipes différentes (ligue du joueur ou l'une des 5 en arrière-plan) — la ligue du
// joueur est scannée en premier, donc en cas de collision c'est toujours la copie qui t'appartient
// réellement qui est conservée. Idempotente (ne fait rien si tout est déjà propre), sûre à
// ré-exécuter à chaque chargement de sauvegarde.
function dedupePlayersById() {
  const seen = new Set();
  const dedupeTeams = teams => teams.forEach(t => {
    t.players = t.players.filter(p => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });
  });
  dedupeTeams(STATE.league.teams);
  (STATE.otherLeagues || []).forEach(ol => dedupeTeams(ol.league.teams));
}

// Migration pour les sauvegardes créées avant l'ajout de photoClub/photoLeague (voir
// startCareer/playerPhotoUrl) : retrouve le club ET la ligue d'origine de chaque joueur qui n'en a
// pas encore, en le cherchant par nom dans TOUTES les ligues (pas seulement la sienne — un joueur
// recruté sur le mercato depuis une autre ligue doit garder la photo de son vrai club d'origine,
// pas être rattaché à tort à la ligue de l'équipe qui l'a acheté).
function backfillPhotoClub() {
  if (!STATE.league) return;
  const originByName = {};
  Object.keys(LEAGUES).forEach(key => {
    LEAGUES[key].teams.forEach(t => t.players.forEach(p => {
      if (!(p.name in originByName)) originByName[p.name] = { club: t.name, league: key };
    }));
  });
  const fillPlayer = (t, leagueKey) => p => {
    const origin = originByName[p.name];
    if (!p.photoClub) p.photoClub = origin ? origin.club : t.name;
    if (!p.photoLeague) p.photoLeague = origin ? origin.league : leagueKey;
  };
  STATE.league.teams.forEach(t => t.players.forEach(fillPlayer(t, STATE.leagueKey)));
  (STATE.otherLeagues || []).forEach(ol => ol.league.teams.forEach(t => t.players.forEach(fillPlayer(t, ol.key))));
}

// Migration pour les sauvegardes créées avant que startCareer() ne remette les stats de saison à
// zéro : ces joueurs ont encore la vraie saison 2025/26 (data.js/withStats) mélangée à leurs
// vrais matchs joués dans cette carrière. On retranche cette base d'origine une seule fois
// (marquée par statsBaselineCleared) pour ne garder que ce qui s'est passé dans la carrière.
function backfillSeasonStats() {
  const league = LEAGUES[STATE.leagueKey];
  if (!league || !STATE.league) return;
  const baseByName = {};
  league.teams.forEach(t => t.players.forEach(p => {
    baseByName[p.name] = { goals: p.goals || 0, assists: p.assists || 0, matches: p.matches || 0, ratingSum: p.ratingSum || 0 };
  }));
  STATE.league.teams.forEach(t => t.players.forEach(p => {
    if (p.statsBaselineCleared) return;
    const base = baseByName[p.name];
    if (base) {
      p.goals = Math.max(0, (p.goals || 0) - base.goals);
      p.assists = Math.max(0, (p.assists || 0) - base.assists);
      p.matches = Math.max(0, (p.matches || 0) - base.matches);
      p.ratingSum = Math.max(0, (p.ratingSum || 0) - base.ratingSum);
    }
    p.statsBaselineCleared = true;
  }));
}

function loadGame(slotId) {
  const map = getSavesMap();
  const entry = map[slotId];
  if (!entry || !entry.data || !entry.data.league) return false;
  applySaveData(entry.data);
  STATE.currentSlotId = slotId;
  try { localStorage.setItem(ACTIVE_SLOT_KEY, slotId); } catch (e) {}
  return true;
}

function deleteSaveSlot(slotId) {
  const map = getSavesMap();
  delete map[slotId];
  persistSavesMap(map);
  let activeSlot = null;
  try { activeSlot = localStorage.getItem(ACTIVE_SLOT_KEY); } catch (e) {}
  if (activeSlot === slotId) {
    try { localStorage.removeItem(ACTIVE_SLOT_KEY); } catch (e) {}
  }
}

function generateSlotId() {
  return "career_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
}

function exportSaveSlot(slotId) {
  const map = getSavesMap();
  const entry = map[slotId];
  if (!entry) return;
  const blob = new Blob([JSON.stringify(entry)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const safeName = (entry.meta.teamName || "carriere").replace(/[^a-z0-9]+/gi, "_");
  const dateStr = new Date(entry.meta.updatedAt || Date.now()).toISOString().slice(0, 10);
  a.href = url;
  a.download = `KingsManager7v7_${safeName}_${dateStr}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function importSaveFile(file) {
  const feedback = document.getElementById("import-save-feedback");
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      const entry = parsed && parsed.data ? parsed : { meta: {}, data: parsed };
      if (!entry.data || !entry.data.league || !entry.data.schedule) {
        throw new Error("format invalide");
      }
      const slotId = generateSlotId();
      const map = getSavesMap();
      map[slotId] = {
        meta: Object.assign({
          teamName: "",
          leagueName: entry.data.league.name,
          round: entry.data.currentRound,
          totalRounds: entry.data.schedule.length,
          updatedAt: Date.now()
        }, entry.meta || {}),
        data: entry.data
      };
      persistSavesMap(map);
      feedback.style.color = "#00ff88";
      feedback.textContent = "Carrière importée avec succès !";
      renderSavesList();
    } catch (e) {
      feedback.style.color = "#ff4444";
      feedback.textContent = "Fichier de sauvegarde invalide.";
    }
  };
  reader.readAsText(file);
}

// ----------------- NAVIGATION -----------------
function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.getElementById(id).classList.add("active");
}

function showTab(name) {
  document.querySelectorAll(".nav button").forEach(b => b.classList.toggle("active", b.dataset.tab === name));
  document.querySelectorAll(".tab").forEach(t => t.classList.toggle("active", t.id === "tab-" + name));
  if (name === "calendar") renderCalendarTab();
  if (name === "standings") renderStandingsTab();
  if (name === "squad") renderSquadTab();
  if (name === "tactics") renderTacticsTab();
  if (name === "transfers") renderTransfersTab();
  if (name === "stats") renderStatsTab();
}

// ----------------- CONFIRMATION / ALERTE STYLÉES (remplace confirm()/alert() natifs) -----------------
// showConfirm : modale à deux boutons, onConfirm n'est appelé que si l'utilisateur valide.
// showAlert : même modale, bouton "Annuler" masqué, un seul bouton pour fermer.
function showConfirm(message, onConfirm, opts = {}) {
  document.getElementById("confirm-title").textContent = opts.title || "Confirmation";
  document.getElementById("confirm-body").textContent = message;
  const okBtn = document.getElementById("btn-confirm-ok");
  const cancelBtn = document.getElementById("btn-confirm-cancel");
  okBtn.className = opts.danger ? "danger" : "primary";
  okBtn.textContent = opts.confirmLabel || "Confirmer";
  cancelBtn.style.display = "";
  const modal = document.getElementById("confirm-modal");
  const close = () => modal.classList.remove("active");
  okBtn.onclick = () => { close(); onConfirm(); };
  cancelBtn.onclick = close;
  modal.classList.add("active");
}

function showAlert(message, title) {
  document.getElementById("confirm-title").textContent = title || "Information";
  document.getElementById("confirm-body").textContent = message;
  const okBtn = document.getElementById("btn-confirm-ok");
  const cancelBtn = document.getElementById("btn-confirm-cancel");
  okBtn.className = "primary";
  okBtn.textContent = "OK";
  cancelBtn.style.display = "none";
  const modal = document.getElementById("confirm-modal");
  okBtn.onclick = () => modal.classList.remove("active");
  modal.classList.add("active");
}

// ----------------- ÉCRAN D'ACCUEIL -----------------
function renderSavesList() {
  const panel = document.getElementById("saves-panel");
  const list = document.getElementById("saves-list");
  const map = getSavesMap();
  const slots = Object.entries(map).sort((a, b) => (b[1].meta.updatedAt || 0) - (a[1].meta.updatedAt || 0));

  if (!slots.length) {
    panel.style.display = "none";
    return;
  }
  panel.style.display = "block";
  list.innerHTML = "";
  slots.forEach(([slotId, entry]) => {
    const meta = entry.meta || {};
    const row = document.createElement("div");
    row.className = "transfer-row";
    row.innerHTML = `<div><b>${meta.teamName || "?"}</b> — ${meta.leagueName || ""}
        <div class="stats">Saison ${meta.season || 1} — Journée ${(meta.round || 0) + 1} / ${meta.totalRounds || "?"}</div></div>
      <div class="actions">
        <button class="primary" data-action="continue">Continuer</button>
        <button class="secondary" data-action="export">Exporter</button>
        <button class="secondary" data-action="delete">Supprimer</button>
      </div>`;
    row.querySelector("[data-action='continue']").onclick = () => {
      if (loadGame(slotId)) {
        showScreen("screen-main");
        showTab("calendar");
        updateTopbar();
      }
    };
    row.querySelector("[data-action='export']").onclick = () => exportSaveSlot(slotId);
    row.querySelector("[data-action='delete']").onclick = () => {
      showConfirm(`Supprimer définitivement la carrière "${meta.teamName || ""}" ?`, () => {
        deleteSaveSlot(slotId);
        renderSavesList();
      }, { title: "Supprimer cette carrière ?", confirmLabel: "Supprimer", danger: true });
    };
    list.appendChild(row);
  });
}

// Drapeaux d'accueil uniquement (flavor visuel dans la sidebar de ligues) : la Kings League
// Mexico n'est pas une ligue 100% mexicaine (cf. CLAUDE.md/MEXICO_TEAMS), le drapeau reste un
// raccourci d'identification de l'édition, pas une déclaration de nationalité des équipes.
const LEAGUE_FLAGS = {
  france: "🇫🇷", brazil: "🇧🇷", spain: "🇪🇸", italy: "🇮🇹", germany: "🇩🇪", mexico: "🇲🇽"
};

function initHomeScreen() {
  renderSavesList();
  document.getElementById("btn-start").disabled = true;
  const sidebar = document.getElementById("league-sidebar");
  sidebar.innerHTML = "";
  const sortedKeys = Object.keys(LEAGUES).sort((a, b) => LEAGUES[a].name.localeCompare(LEAGUES[b].name, "fr"));
  sortedKeys.forEach(key => {
    const league = LEAGUES[key];
    const row = document.createElement("div");
    row.className = "league-row";
    row.dataset.key = key;
    row.innerHTML = `<span class="league-row-flag">${LEAGUE_FLAGS[key] || "⚽"}</span>
      <span class="league-row-name">${league.name}</span>
      <span class="league-row-count">${league.teams.length}</span>`;
    row.onclick = () => selectLeague(key);
    sidebar.appendChild(row);
  });
  // Sélectionne la première ligue par défaut (ordre alphabétique) pour ne pas laisser la grille
  // d'équipes vide au chargement de l'accueil.
  selectLeague(sortedKeys[0]);
}

function selectLeague(key) {
  STATE.leagueKey = key;
  document.querySelectorAll("#league-sidebar .league-row").forEach(row => {
    row.classList.toggle("selected", row.dataset.key === key);
  });
  const league = LEAGUES[key];
  document.getElementById("team-select-header").innerHTML =
    `<span class="league-flag-lg">${LEAGUE_FLAGS[key] || "⚽"}</span><h3>${league.name}</h3>
     <span class="league-row-count">${league.teams.length} équipes</span>`;
  const teamChoice = document.getElementById("team-choice");
  teamChoice.innerHTML = "";
  const sortedTeams = [...league.teams].sort((a, b) => a.name.localeCompare(b.name, "fr"));
  sortedTeams.forEach(team => {
    const div = document.createElement("div");
    div.className = "card team-card";
    div.innerHTML = `${renderTeamCrest(team, "crest-lg")}<h3>${team.name}</h3>`;
    div.onclick = () => selectTeam(team.id);
    teamChoice.appendChild(div);
  });
  STATE.userTeamId = null;
  document.getElementById("btn-start").disabled = true;
}

function selectTeam(teamId) {
  STATE.userTeamId = teamId;
  document.querySelectorAll("#team-choice .card").forEach(c => {
    c.classList.toggle("selected", c.querySelector("h3").textContent === LEAGUES[STATE.leagueKey].teams.find(t => t.id === teamId).name);
  });
  document.getElementById("btn-start").disabled = false;
}

function startCareer() {
  STATE.currentSlotId = generateSlotId();
  STATE.season = 1;

  // deep copy de la ligue choisie pour ne pas modifier les données originales
  const sourceTeams = LEAGUES[STATE.leagueKey].teams;
  const teams = JSON.parse(JSON.stringify(sourceTeams));

  teams.forEach(t => t.players.forEach(p => {
    // le dossier des photos est organisé par ligue puis par club d'origine
    // (images/players/<ligue>/<club>/...) ; on fige club ET ligue sur chaque joueur dès la
    // création de la carrière, pour que sa photo reste trouvable même après un transfert vers une
    // autre équipe — y compris une équipe d'une AUTRE ligue via le mercato (cf. playerPhotoUrl)
    p.photoClub = t.name;
    p.photoLeague = STATE.leagueKey;
    // data.js encode les vraies stats de la saison 2025/26 (via withStats) uniquement pour
    // calibrer la note de départ des joueurs connus — cette carrière doit repartir de zéro,
    // pas hériter des buts/passes/matchs déjà joués dans la vraie vie (cf. backfillSeasonStats
    // pour la migration des sauvegardes créées avant ce correctif).
    p.goals = 0; p.assists = 0; p.matches = 0; p.ratingSum = 0; p.rating = 0;
    p.careerGoals = 0; p.careerAssists = 0; p.careerMatches = 0; p.careerRatingSum = 0;
    p.statsBaselineCleared = true;
  }));

  STATE.league = {
    name: LEAGUES[STATE.leagueKey].name,
    teams: teams,
    results: []
  };

  const teamIds = teams.map(t => t.id);
  STATE.schedule = generateSchedule(teamIds);

  // initialise les résultats vides
  STATE.schedule.forEach((round, idx) => {
    round.forEach(m => {
      STATE.league.results.push({ round: idx, home: m.home, away: m.away, played: false, homeGoals: 0, awayGoals: 0 });
    });
  });

  STATE.currentRound = 0;
  STATE.currentDay = 0;
  STATE.notifications = [];
  STATE.shortlist = [];
  STATE.mercatoOpen = false;
  STATE.seasonPrizeAwarded = false;
  STATE.lastSeasonPrize = null;
  STATE.transferLog = [];
  STATE.trophyHistory = [];
  STATE.otherLeagues = buildOtherLeagues(STATE.leagueKey);
  STATE.seasonObjective = generateSeasonObjective();
  STATE.notifications.push({
    type: "boardObjective", title: "🎯 Objectif de la direction",
    body: "Voici l'objectif fixé par la direction pour cette première saison :",
    objectiveLabel: STATE.seasonObjective.label
  });

  showScreen("screen-main");
  showTab("calendar");
  updateTopbar();
  saveGame();
}

// ----------------- LIGUES EN ARRIÈRE-PLAN (toutes celles que le joueur ne joue pas) -----------------
// Chacune joue sa propre saison IA vs IA, en parallèle de la ligue du joueur, sur le même calendrier
// (matchDayForRound est indépendant du nombre d'équipes) — résultats/classement, et depuis peu son
// propre mercato IA aussi (voir simulateOtherLeagueRound/isMercatoWindowRound).
function buildOtherLeagues(userLeagueKey) {
  return Object.keys(LEAGUES).filter(key => key !== userLeagueKey).map(key => {
    const teams = JSON.parse(JSON.stringify(LEAGUES[key].teams));
    teams.forEach(t => {
      t.photoLeague = key;
      t.players.forEach(p => {
        p.photoClub = t.name;
        p.photoLeague = key;
        p.goals = 0; p.assists = 0; p.matches = 0; p.ratingSum = 0; p.rating = 0;
        p.careerGoals = 0; p.careerAssists = 0; p.careerMatches = 0; p.careerRatingSum = 0;
        p.statsBaselineCleared = true;
      });
    });
    const schedule = generateSchedule(teams.map(t => t.id));
    const results = [];
    schedule.forEach((round, idx) => round.forEach(m => {
      results.push({ round: idx, home: m.home, away: m.away, played: false, homeGoals: 0, awayGoals: 0 });
    }));
    return { key, name: LEAGUES[key].name, league: { name: LEAGUES[key].name, teams, results }, schedule, currentRound: 0 };
  });
}

function simulateOtherLeagueRound(ol) {
  const round = ol.schedule[ol.currentRound];
  round.forEach(m => {
    const home = ol.league.teams.find(t => t.id === m.home);
    const away = ol.league.teams.find(t => t.id === m.away);
    const result = simulateAIMatch(home, away);
    const r = ol.league.results.find(r => r.round === ol.currentRound && r.home === m.home && r.away === m.away);
    r.played = true; r.homeGoals = result.homeGoals; r.awayGoals = result.awayGoals; r.penaltyWinner = result.penaltyWinner;
  });
  // mercato IA pour cette ligue en arrière-plan, sur SA propre fenêtre de journées (chaque ligue a
  // son propre calendrier/nombre d'équipes, cf. advanceOtherLeagues) — humanTeamId=null puisque
  // aucune équipe de cette ligue n'appartient au joueur, donc aucune à exclure des transferts.
  if (isMercatoWindowRound(ol.currentRound, ol.schedule.length)) {
    simulateAITransfers(ol.league, null);
  }
  ol.currentRound++;
}

// Fait avancer chaque ligue en arrière-plan jusqu'au jour courant (appelé à chaque jour qui passe,
// indépendamment du calendrier de la ligue du joueur — chacune termine sa saison à son propre rythme
// selon son nombre d'équipes).
function advanceOtherLeagues() {
  if (!STATE.otherLeagues) return;
  STATE.otherLeagues.forEach(ol => {
    while (ol.currentRound < ol.schedule.length && STATE.currentDay >= matchDayForRound(ol.currentRound)) {
      simulateOtherLeagueRound(ol);
    }
  });
}

// Termine instantanément toute ligue en arrière-plan pas encore finie (appelé dès que la saison du
// joueur se termine, pour garantir un classement final partout au même moment — utile pour le futur
// tournoi de fin de saison). Idempotent : ne fait rien si tout est déjà joué.
function finalizeOtherLeagues() {
  if (!STATE.otherLeagues) return;
  STATE.otherLeagues.forEach(ol => {
    while (ol.currentRound < ol.schedule.length) {
      simulateOtherLeagueRound(ol);
    }
  });
}

// Classements des ligues en arrière-plan (utilisé par le futur tournoi de fin de saison).
function getOtherLeaguesStandings() {
  if (!STATE.otherLeagues) return [];
  return STATE.otherLeagues.map(ol => ({ key: ol.key, name: ol.name, standings: computeStandings(ol.league) }));
}

// ----------------- TOURNOI DE FIN DE SAISON (top 2 de chaque ligue, bracket à élimination directe) -----------------
// 6 ligues × 2 qualifiés = 12 équipes, ce qui n'est pas une puissance de 2 : les 4 meilleurs
// champions de ligue (seeds 1-4) reçoivent un bye direct en quarts, les 8 autres (seeds 5-12,
// classés champions de ligue puis vices-champions, triés par points) se départagent en barrage
// (5v12, 6v11, 7v10, 8v9). Chaque "qualifieur" référence directement l'objet équipe réel (pas une
// copie) pour que les stats/forme se mettent à jour sur la vraie équipe pendant le tournoi — voir
// relinkTournamentTeamRefs() pour la ré-association après un chargement de sauvegarde (JSON perd
// les références d'objets).
function makeTournamentMatchEntry(home, away) {
  return { home, away, played: false, homeGoals: null, awayGoals: null, penaltyWinner: null, winner: null };
}

function buildTournamentBracket() {
  const userQualifiers = computeStandings(STATE.league).slice(0, 2).map((row, idx) => ({
    team: STATE.league.teams.find(t => t.id === row.id),
    leagueKey: STATE.leagueKey, leagueName: STATE.league.name,
    points: row.points, rank: idx,
    isUser: row.id === STATE.userTeamId
  }));

  const otherQualifiers = [];
  (STATE.otherLeagues || []).forEach(ol => {
    computeStandings(ol.league).slice(0, 2).forEach((row, idx) => {
      otherQualifiers.push({
        team: ol.league.teams.find(t => t.id === row.id),
        leagueKey: ol.key, leagueName: ol.name,
        points: row.points, rank: idx,
        isUser: false
      });
    });
  });

  // seeds 1-6 : champions de chaque ligue (rank 0), triés par points ; seeds 7-12 : vice-champions (rank 1)
  const seeds = [...userQualifiers, ...otherQualifiers].sort((a, b) => a.rank - b.rank || b.points - a.points);
  const byes = seeds.slice(0, 4);        // seeds 1-4
  const r1Seeds = seeds.slice(4, 12);    // seeds 5-12

  const round1 = [
    makeTournamentMatchEntry(r1Seeds[0], r1Seeds[7]), // 5 vs 12
    makeTournamentMatchEntry(r1Seeds[1], r1Seeds[6]), // 6 vs 11
    makeTournamentMatchEntry(r1Seeds[2], r1Seeds[5]), // 7 vs 10
    makeTournamentMatchEntry(r1Seeds[3], r1Seeds[4])  // 8 vs 9
  ];

  return {
    roundIndex: 0,
    rounds: [
      { name: "Barrage", matches: round1 },
      { name: "Quarts de finale", matches: [] },
      { name: "Demi-finales", matches: [] },
      { name: "Finale", matches: [] }
    ],
    byes,
    champion: null,
    finished: false
  };
}

// Simule un match IA vs IA du tournoi (jamais appelé si l'une des deux équipes est celle du joueur).
function simulateTournamentMatchAuto(m) {
  const result = simulateAIMatch(m.home.team, m.away.team);
  m.played = true; m.homeGoals = result.homeGoals; m.awayGoals = result.awayGoals; m.penaltyWinner = result.penaltyWinner;
  m.winner = result.homeGoals !== result.awayGoals
    ? (result.homeGoals > result.awayGoals ? m.home : m.away)
    : (result.penaltyWinner === "home" ? m.home : m.away);
}

// Résout tous les matchs IA vs IA non encore joués du tour courant (laisse intact le/les match(s)
// impliquant l'équipe du joueur, en attente d'être joués depuis l'écran du tournoi), puis passe au
// tour suivant dès que tout le tour courant est complet.
function resolveTournamentRoundMatches() {
  const t = STATE.tournament;
  if (!t || t.finished) return;
  const round = t.rounds[t.roundIndex];
  round.matches.forEach(m => {
    if (m.played) return;
    if (m.home.isUser || m.away.isUser) return;
    simulateTournamentMatchAuto(m);
  });
  if (round.matches.every(m => m.played)) advanceTournamentRound();
}

function advanceTournamentRound() {
  const t = STATE.tournament;
  const round = t.rounds[t.roundIndex];
  const winners = round.matches.map(m => m.winner);

  if (t.roundIndex === 0) {
    // barrage -> quarts : les 4 têtes de série exemptées de barrage rejoignent les 4 vainqueurs
    t.rounds[1].matches = [
      makeTournamentMatchEntry(t.byes[0], winners[3]),
      makeTournamentMatchEntry(t.byes[3], winners[0]),
      makeTournamentMatchEntry(t.byes[1], winners[2]),
      makeTournamentMatchEntry(t.byes[2], winners[1])
    ];
  } else if (t.roundIndex === 1) {
    t.rounds[2].matches = [
      makeTournamentMatchEntry(winners[0], winners[1]),
      makeTournamentMatchEntry(winners[2], winners[3])
    ];
  } else if (t.roundIndex === 2) {
    t.rounds[3].matches = [makeTournamentMatchEntry(winners[0], winners[1])];
  } else {
    t.champion = winners[0];
    t.finished = true;
    return;
  }
  t.roundIndex++;
}

// Enchaîne la résolution automatique tant qu'aucun match du joueur n'est en attente dans le tour
// courant (et que le tournoi n'est pas terminé) — appelé à l'ouverture de l'écran du tournoi et
// après chaque match du joueur.
function processTournamentAutoRounds() {
  const t = STATE.tournament;
  if (!t || t.finished) return;
  let guard = 0;
  while (!t.finished && guard++ < 10) {
    resolveTournamentRoundMatches();
    if (findPendingUserTournamentMatch()) break;
  }
}

function findPendingUserTournamentMatch() {
  const t = STATE.tournament;
  if (!t || t.finished) return null;
  const round = t.rounds[t.roundIndex];
  return round.matches.find(m => !m.played && (m.home.isUser || m.away.isUser)) || null;
}

// Jusqu'où l'équipe du joueur est allée dans le tournoi de fin de saison, une fois celui-ci
// terminé : null si elle n'était pas qualifiée (pas top 2 de sa ligue), sinon le nom du dernier
// tour joué ("barrage"/"quarts"/"demies"/"finale") ou "champion" si elle a remporté la finale.
function getUserTournamentResult() {
  const t = STATE.tournament;
  if (!t || !t.finished) return null;
  if (t.champion && t.champion.isUser) return "champion";
  let lastRoundIdx = -1;
  const roundKeys = ["barrage", "quarts", "demies", "finale"];
  t.rounds.forEach((round, idx) => {
    round.matches.forEach(m => {
      if (m.played && (m.home.isUser || m.away.isUser)) lastRoundIdx = idx;
    });
  });
  return lastRoundIdx === -1 ? null : roundKeys[lastRoundIdx];
}

// Force moyenne de l'effectif d'un club (moyenne d'overall) — sert uniquement à estimer un rang de
// départ plausible pour l'objectif de saison de la toute première saison d'une carrière, avant
// qu'il n'existe le moindre historique réel (STATE.trophyHistory) sur lequel se baser.
function estimateSquadStrength(league, teamId) {
  const team = league.teams.find(t => t.id === teamId);
  if (!team || !team.players.length) return 0;
  return team.players.reduce((s, p) => s + p.overall, 0) / team.players.length;
}

// Paliers d'ambition de la direction, du meilleur au pire, sélectionnés par percentile de rang
// (0 = meilleure équipe de la ligue, 1 = pire) — plus l'équipe a bien terminé la saison précédente
// (ou paraît forte pour une 1ère saison), plus l'objectif fixé est ambitieux.
const SEASON_OBJECTIVE_TIERS = [
  { maxPercentile: 0.2, label: "🏆 Remporter le championnat", shortLabel: "🏆 Titre visé", targetRank: () => 1 },
  { maxPercentile: 0.45, label: "🥉 Terminer sur le podium (top 3)", shortLabel: "🥉 Top 3 visé", targetRank: () => 3 },
  { maxPercentile: 0.7, label: null, shortLabel: null, targetRank: n => Math.max(3, Math.ceil(n / 2)) },
  { maxPercentile: 1.01, label: "🛡️ Assurer le maintien (éviter la dernière place)", shortLabel: "🛡️ Maintien visé", targetRank: n => Math.max(1, n - 1) }
];

// Objectif de la direction pour la saison en cours : basé sur le classement final de la saison
// précédente (STATE.trophyHistory), ou sur la force de l'effectif s'il n'existe pas encore
// d'historique (1ère saison de la carrière). Ne va jamais jusqu'au licenciement (hors scope) — juste
// une conséquence financière (voir awardSeasonPrizeMoney) et une trace dans le palmarès.
function generateSeasonObjective() {
  const totalTeams = STATE.league.teams.length;
  let baseRank;
  const lastEntry = STATE.trophyHistory[STATE.trophyHistory.length - 1];
  if (lastEntry) {
    baseRank = lastEntry.rank;
  } else {
    const scored = STATE.league.teams.map(t => ({ id: t.id, strength: estimateSquadStrength(STATE.league, t.id) }));
    scored.sort((a, b) => b.strength - a.strength);
    baseRank = scored.findIndex(s => s.id === STATE.userTeamId) + 1;
  }
  const percentile = totalTeams > 1 ? (baseRank - 1) / (totalTeams - 1) : 0;
  const tier = SEASON_OBJECTIVE_TIERS.find(t => percentile <= t.maxPercentile);
  const targetRank = tier.targetRank(totalTeams);
  return {
    targetRank, totalTeams,
    label: tier.label || `Terminer dans la première moitié du classement (top ${targetRank})`,
    shortLabel: tier.shortLabel || `Top ${targetRank} visé`,
    met: null
  };
}

// Prime de fin de saison, versée une seule fois (STATE.seasonPrizeAwarded) dès que le championnat
// ET le tournoi international sont terminés : une part liée au classement final du championnat
// (du dernier au premier), une part liée au parcours dans le tournoi (0 si pas qualifié, jusqu'au
// titre international) — cf. demande utilisateur "gagner plus ou moins d'argent selon nos résultats".
const TOURNAMENT_PRIZE_BY_RESULT = {
  barrage: 15000, quarts: 30000, demies: 55000, finale: 90000, champion: 150000
};
function awardSeasonPrizeMoney() {
  if (STATE.seasonPrizeAwarded) return;
  const team = getUserTeam();
  const standings = computeStandings(STATE.league);
  const rank = standings.findIndex(row => row.id === STATE.userTeamId) + 1;
  const totalTeams = standings.length;
  const percentile = totalTeams > 1 ? (totalTeams - rank) / (totalTeams - 1) : 1;
  const championshipAmount = Math.round(20000 + percentile * 130000);
  const tournamentResult = getUserTournamentResult();
  const tournamentAmount = tournamentResult ? TOURNAMENT_PRIZE_BY_RESULT[tournamentResult] : 0;
  // enjeu de club : bonus si l'objectif de la direction est atteint, malus sinon (voir
  // generateSeasonObjective) — appliqué en % du total plutôt qu'un montant fixe, pour rester
  // proportionné quel que soit le niveau de la saison (petite ou grosse prime).
  const objective = STATE.seasonObjective;
  const objectiveMet = objective ? rank <= objective.targetRank : null;
  const objectiveAmount = objective ? Math.round((championshipAmount + tournamentAmount) * (objectiveMet ? 0.25 : -0.15)) : 0;
  const total = championshipAmount + tournamentAmount + objectiveAmount;
  team.budget += total;
  STATE.lastSeasonPrize = {
    rank, totalTeams, tournamentResult, championshipAmount, tournamentAmount,
    objective, objectiveMet, objectiveAmount, total
  };
  STATE.seasonPrizeAwarded = true;

  // records de saison : meilleur buteur/passeur du CLUB cette saison — capturés maintenant (stats
  // encore scopées à la saison qui vient de se terminer, avant que startNewSeason() ne les remette
  // à zéro) pour alimenter le "livre des records" du palmarès (voir renderPalmaresPanel, qui
  // recalcule les records de CARRIÈRE en comparant ces entrées entre elles à l'affichage).
  const scorers = team.players.filter(p => p.goals > 0).sort((a, b) => b.goals - a.goals);
  const topScorer = scorers.length ? { name: scorers[0].name, goals: scorers[0].goals } : null;
  const assisters = team.players.filter(p => p.assists > 0).sort((a, b) => b.assists - a.assists);
  const topAssister = assisters.length ? { name: assisters[0].name, assists: assisters[0].assists } : null;

  // palmarès : un résumé permanent de cette saison (jamais remis à zéro sauf startCareer, contrairement
  // à STATE.lastSeasonPrize qui ne garde que la toute dernière) — voir renderPalmaresPanel.
  STATE.trophyHistory.push({
    season: STATE.season, leagueName: STATE.league.name, rank, totalTeams, tournamentResult,
    objectiveLabel: objective ? objective.label : null, objectiveMet, topScorer, topAssister
  });
}

const TOURNAMENT_RESULT_LABELS = {
  barrage: "éliminé en barrage", quarts: "éliminé en quarts de finale",
  demies: "éliminé en demi-finale", finale: "finaliste", champion: "🏆 champion international"
};

// Retrouve l'équipe réelle (pas une copie) à partir de sa ligue + son id — une équipe hors de
// STATE.league.teams vit dans STATE.otherLeagues, indexé par leagueKey (voir buildOtherLeagues).
// Nécessaire dès qu'on référence une équipe d'une AUTRE ligue que celle du joueur (tournoi,
// marché des transferts inter-ligues) : les id de club sont courts et propres à data.js, un
// simple id ne suffit pas à lever toute ambiguïté entre deux ligues différentes.
function findLeagueTeam(leagueKey, teamId) {
  if (leagueKey === STATE.leagueKey) return STATE.league.teams.find(t => t.id === teamId);
  const ol = (STATE.otherLeagues || []).find(x => x.key === leagueKey);
  return ol ? ol.league.teams.find(t => t.id === teamId) : null;
}

// Après un chargement de sauvegarde, les qualifieurs du tournoi pointent vers des copies JSON
// des équipes (pas les objets réels de STATE.league/STATE.otherLeagues) : on les ré-associe pour
// que les stats/forme continuent de se mettre à jour sur la vraie équipe pendant le reste du tournoi.
function relinkTournamentTeamRefs() {
  if (!STATE.tournament) return;
  const relink = q => { if (q) { const live = findLeagueTeam(q.leagueKey, q.team.id); if (live) q.team = live; } };
  STATE.tournament.byes.forEach(relink);
  STATE.tournament.rounds.forEach(round => round.matches.forEach(m => { relink(m.home); relink(m.away); }));
  relink(STATE.tournament.champion);
}

// ----------------- ÉCRAN TOURNOI -----------------
function openTournamentScreen() {
  if (!STATE.tournament) STATE.tournament = buildTournamentBracket();
  processTournamentAutoRounds();
  saveGame();
  showScreen("screen-tournament");
  renderTournamentScreen();
}

function renderTournamentQualifierLabel(q) {
  return `${renderTeamCrest(q.team, "crest-sm")}<span>${q.team.name}</span>
    <span class="tourn-league-tag">${q.leagueName}</span>`;
}

function renderTournamentScreen() {
  const t = STATE.tournament;
  const bracket = document.getElementById("tournament-bracket");
  bracket.innerHTML = t.rounds.filter(r => r.matches.length).map(round => `
    <div class="panel">
      <h3>${round.name}</h3>
      ${round.matches.map(m => `
        <div class="fixture${(m.home.isUser || m.away.isUser) ? " user" : ""}">
          <span class="fixture-team home">${renderTournamentQualifierLabel(m.home)}</span>
          <span class="score">${m.played ? `${m.homeGoals} - ${m.awayGoals}${m.penaltyWinner ? " (tab)" : ""}` : "vs"}</span>
          <span class="fixture-team away">${renderTournamentQualifierLabel(m.away)}</span>
        </div>`).join("")}
    </div>`).join("");

  const actions = document.getElementById("tournament-actions");
  const pending = findPendingUserTournamentMatch();
  if (t.finished) {
    actions.innerHTML = `
      <div class="panel" style="text-align:center;">
        <h2>🏆 Champion international — Saison ${STATE.season}</h2>
        <div class="hero-match-teams" style="margin:14px 0;">
          <div class="hero-team">${renderTeamCrest(t.champion.team, "crest-lg")}<span class="hero-team-name">${t.champion.team.name}</span><span class="tourn-league-tag">${t.champion.leagueName}</span></div>
        </div>
        <button class="primary" id="btn-tournament-continue">Retour au calendrier</button>
      </div>`;
    document.getElementById("btn-tournament-continue").onclick = () => { showScreen("screen-main"); showTab("calendar"); };
  } else if (pending) {
    actions.innerHTML = `<button class="primary" id="btn-play-tournament-match">🏆 Jouer mon match</button>`;
    document.getElementById("btn-play-tournament-match").onclick = () => openTournamentLineupScreen(pending);
  } else {
    actions.innerHTML = `<button class="secondary" id="btn-tournament-back">Retour au calendrier</button>`;
    document.getElementById("btn-tournament-back").onclick = () => { showScreen("screen-main"); showTab("calendar"); };
  }
}

// ----------------- DATE & NOTIFICATIONS -----------------
// Calendrier simplifié : 12 mois de 30 jours chacun, la saison commence le 1er Août.
const DAYS_PER_ROUND = 4; // nombre de jours entre deux journées de championnat
const MONTH_NAMES = ["Août", "Septembre", "Octobre", "Novembre", "Décembre", "Janvier",
  "Février", "Mars", "Avril", "Mai", "Juin", "Juillet"];

function matchDayForRound(round) {
  return round * DAYS_PER_ROUND;
}

// `season` optionnel : par défaut la saison en cours, mais l'historique des transferts a besoin
// d'afficher une date figée dans une saison PASSÉE (celle où le transfert a eu lieu), pas la saison
// courante de STATE.
function formatGameDate(dayCount, season) {
  const day = (dayCount % 30) + 1;
  const monthIdx = Math.floor(dayCount / 30) % 12;
  return `${day} ${MONTH_NAMES[monthIdx]} An ${season !== undefined ? season : STATE.season}`;
}

// Chaque interview propose plusieurs réponses possibles, qui ont un petit effet sur la
// forme de tout l'effectif (une réponse confiante motive le groupe, une réponse maladroite
// peut le déstabiliser légèrement).
function bumpTeamForm(delta) {
  const team = getUserTeam();
  if (!team) return;
  team.players.forEach(p => { p.form = Math.max(40, Math.min(99, p.form + delta)); });
}

const INTERVIEW_TEMPLATES = [
  {
    text: "Un journaliste te demande comment se prépare l'équipe pour la suite de la saison.",
    answers: [
      { label: "« On travaille dur, l'objectif est clair. »", effect: () => bumpTeamForm(2) },
      { label: "« On prend match par match, sans pression. »", effect: () => bumpTeamForm(0) },
      { label: "« Je préfère ne pas trop en dire. »", effect: () => bumpTeamForm(-1) }
    ]
  },
  {
    text: "On t'interroge sur l'ambiance dans le vestiaire en ce moment.",
    answers: [
      { label: "« Excellente, le groupe est uni. »", effect: () => bumpTeamForm(2) },
      { label: "« Normale, comme dans toute équipe. »", effect: () => bumpTeamForm(0) },
      { label: "« Il y a quelques tensions, on règle ça en interne. »", effect: () => bumpTeamForm(-2) }
    ]
  },
  {
    text: "Un média local veut connaître ton objectif pour cette saison.",
    answers: [
      { label: "« On vise le titre, rien de moins. »", effect: () => bumpTeamForm(3) },
      { label: "« On veut progresser match après match. »", effect: () => bumpTeamForm(1) },
      { label: "« On va voir comment ça se passe. »", effect: () => bumpTeamForm(-1) }
    ]
  },
  {
    text: "On te demande ton avis sur le niveau du championnat cette année.",
    answers: [
      { label: "« Très relevé, il faudra être prêts. »", effect: () => bumpTeamForm(1) },
      { label: "« Dans nos cordes, on peut rivaliser. »", effect: () => bumpTeamForm(2) },
      { label: "« Sans intérêt particulier. »", effect: () => bumpTeamForm(-1) }
    ]
  },
  {
    text: "Un journaliste veut savoir quel joueur t'impressionne le plus actuellement.",
    answers: [
      { label: "« Tout le groupe répond présent, difficile d'en citer un seul. »", effect: () => bumpTeamForm(2) },
      { label: "« Je préfère garder ça pour le vestiaire. »", effect: () => bumpTeamForm(0) }
    ]
  }
];

// Chaque message de joueur est une demande à laquelle on peut répondre Oui ou Non,
// avec un petit effet sur sa forme selon la réponse.
const MESSAGE_TEMPLATES = [
  {
    text: p => `${p.name} t'envoie un message : « J'aimerais avoir un peu plus de temps de jeu, tu es d'accord coach ? »`,
    yes: p => { p.form = Math.min(99, p.form + 3); },
    no: p => { p.form = Math.max(40, p.form - 2); }
  },
  {
    text: p => `${p.name} te demande : « Je suis un peu fatigué, je peux avoir du repos au prochain match ? »`,
    yes: p => { p.form = Math.min(99, p.form + 2); },
    no: p => { p.form = Math.max(40, p.form - 1); }
  },
  {
    text: p => `${p.name} t'envoie un message : « Merci pour la confiance coach, je peux compter sur une place dans le groupe ? »`,
    yes: p => { p.form = Math.min(99, p.form + 1); },
    no: p => { p.form = Math.max(40, p.form - 1); }
  },
  {
    text: p => `${p.name} te demande : « La forme est excellente, tu peux me prévoir un rôle plus offensif ? »`,
    yes: p => { p.form = Math.min(99, p.form + 2); },
    no: p => { p.form = Math.max(40, p.form - 1); }
  }
];

function createInterviewNotification() {
  const templateIdx = Math.floor(Math.random() * INTERVIEW_TEMPLATES.length);
  const template = INTERVIEW_TEMPLATES[templateIdx];
  return {
    id: Math.random().toString(36).slice(2, 10), type: "interview", title: "🎤 Interview",
    body: template.text, templateIdx
  };
}

function createMessageNotification() {
  const team = getUserTeam();
  if (!team || !team.players.length) return null;
  const player = team.players[Math.floor(Math.random() * team.players.length)];
  const templateIdx = Math.floor(Math.random() * MESSAGE_TEMPLATES.length);
  const text = MESSAGE_TEMPLATES[templateIdx].text(player);
  return {
    id: Math.random().toString(36).slice(2, 10),
    type: "message",
    title: "💬 Message de joueur",
    body: text,
    playerId: player.id,
    templateIdx
  };
}

function createTransferRequestNotification() {
  const team = getUserTeam();
  if (!team || team.players.length <= 7) return null;
  const otherTeams = STATE.league.teams.filter(t => t.id !== team.id);
  if (!otherTeams.length) return null;
  const otherTeam = otherTeams[Math.floor(Math.random() * otherTeams.length)];
  const player = team.players[Math.floor(Math.random() * team.players.length)];
  const amount = Math.round(player.value * (0.8 + Math.random() * 0.5));
  return {
    id: Math.random().toString(36).slice(2, 10),
    type: "transferRequest",
    title: "📝 Demande de transfert",
    body: `${otherTeam.name} propose ${formatMoney(amount)} pour ${player.name} (${player.pos}, valeur estimée ${formatMoney(player.value)}).`,
    otherTeamId: otherTeam.id,
    playerId: player.id,
    amount
  };
}

// Tire au hasard les notifications du jour : interviews, messages de joueurs,
// et demandes de transfert d'équipes IA (seulement si le mercato est ouvert)
function rollNotificationsForToday() {
  let added = 0;
  if (Math.random() < 0.08) { STATE.notifications.push(createInterviewNotification()); added++; }
  if (Math.random() < 0.10) {
    const notif = createMessageNotification();
    if (notif) { STATE.notifications.push(notif); added++; }
  }
  if (STATE.mercatoOpen && Math.random() < 0.12) {
    const notif = createTransferRequestNotification();
    if (notif) { STATE.notifications.push(notif); added++; }
  }
  return added;
}

// Décompte d'un jour les blessures en cours (voir engine.js : l'événement rare "blessure" pose
// injuryDaysLeft/injurySeverity/injured sur le joueur pendant un match) — sur TOUTES les ligues
// (pas juste celle du joueur) pour rester cohérent si un joueur blessé change de club en cours de
// convalescence via le mercato inter-ligues.
function decayInjuries() {
  const decay = teams => teams.forEach(t => t.players.forEach(p => {
    if (p.injuryDaysLeft > 0) {
      p.injuryDaysLeft--;
      p.injured = p.injuryDaysLeft > 0;
      if (!p.injured) p.injurySeverity = null;
    }
  }));
  decay(STATE.league.teams);
  (STATE.otherLeagues || []).forEach(ol => decay(ol.league.teams));
}

// Avance le temps jour par jour, de façon visible (un léger temps de pause entre chaque jour),
// jusqu'au prochain match de l'utilisateur (les journées sans match pour lui sont résolues
// automatiquement), en s'arrêtant dès qu'une notification arrive.
let advancing = false;
const ADVANCE_DAY_DELAY = 220; // ms entre chaque jour affiché

function advanceDays() {
  if (advancing) return;
  advancing = true;
  advanceOneDayStep(0);
}

function advanceOneDayStep(i) {
  if (i >= 60) { finishAdvanceDays(); return; }

  STATE.currentDay++;
  decayInjuries();
  advanceOtherLeagues();
  const notifAdded = rollNotificationsForToday();
  updateTopbar();
  renderCalendarTab();

  if (notifAdded > 0) { finishAdvanceDays(); return; }
  if (STATE.currentRound >= STATE.schedule.length) { finalizeOtherLeagues(); finishAdvanceDays(); return; }

  if (STATE.currentDay >= matchDayForRound(STATE.currentRound)) {
    const round = STATE.schedule[STATE.currentRound];
    const userMatch = round.find(m => m.home === STATE.userTeamId || m.away === STATE.userTeamId);
    if (userMatch) { finishAdvanceDays(); return; }
    simulateRoundAI();
    STATE.currentRound++;
  }

  setTimeout(() => advanceOneDayStep(i + 1), ADVANCE_DAY_DELAY);
}

function finishAdvanceDays() {
  advancing = false;
  updateTopbar();
  renderCalendarTab();
  saveGame();
}

// ----------------- MODAL NOTIFICATIONS -----------------
function openNotificationModal() {
  renderCurrentNotification();
  document.getElementById("notification-modal").classList.add("active");
}

// Bloc "identité joueur" (photo, poste, club) réutilisé par les notifications message/transferRequest.
function renderNotifPlayerRow(player, team) {
  return `<div class="notif-player-row">
    <div class="avatar-sm notif-player-avatar">
      <div class="avatar-sm-fallback">${playerInitials(player.name)}</div>
      <img src="${playerPhotoUrl(player, team)}" alt="" class="avatar-sm-img"
        onload="this.style.display='block'; this.previousElementSibling.style.display='none';"
        onerror="this.style.display='none';">
    </div>
    <div class="notif-player-id">
      <div class="player-card-name-row">
        <span class="pos-tag pos-${player.pos}">${player.pos}</span>
        <span class="player-card-name">${player.name}</span>
      </div>
    </div>
  </div>`;
}

function renderCurrentNotification() {
  const notif = STATE.notifications[0];
  if (!notif) { closeNotificationModal(); return; }
  document.getElementById("notif-title").textContent = notif.title;
  const bodyEl = document.getElementById("notif-body");
  bodyEl.textContent = notif.body;
  bodyEl.style.display = "";

  const box = document.getElementById("notification-box");
  box.className = "modal-box modal-notification notif-type-" + notif.type;

  // En-tête joueur enrichi (photo, poste, club, comparaison de valeur pour une offre de
  // transfert) au lieu du simple paragraphe de texte.
  const extra = document.getElementById("notif-extra");
  extra.innerHTML = "";
  const team = getUserTeam();
  if (notif.type === "transferRequest") {
    const player = team.players.find(p => p.id === notif.playerId);
    const otherTeam = STATE.league.teams.find(t => t.id === notif.otherTeamId);
    if (player && otherTeam) {
      const isGoodOffer = notif.amount >= player.value;
      extra.innerHTML = `
        <div class="notif-player-row">
          <div class="avatar-sm notif-player-avatar">
            <div class="avatar-sm-fallback">${playerInitials(player.name)}</div>
            <img src="${playerPhotoUrl(player, team)}" alt="" class="avatar-sm-img"
              onload="this.style.display='block'; this.previousElementSibling.style.display='none';"
              onerror="this.style.display='none';">
          </div>
          <div class="notif-player-id">
            <div class="player-card-name-row">
              <span class="pos-tag pos-${player.pos}">${player.pos}</span>
              <span class="player-card-name">${player.name}</span>
            </div>
            <div class="market-club-cell">${renderTeamCrest(otherTeam, "crest-sm")}<span>Offre de ${otherTeam.name}</span></div>
          </div>
        </div>
        <div class="notif-offer-compare">
          ${renderStatTile(formatMoney(player.value), "Valeur estimée")}
          <div class="stat-tile ${isGoodOffer ? "stat-tile-good" : "stat-tile-bad"}">
            <span class="stat-tile-value">${formatMoney(notif.amount)}</span><span class="stat-tile-label">Offre reçue</span>
          </div>
        </div>`;
      bodyEl.style.display = "none";
    }
  } else if (notif.type === "message") {
    const player = team.players.find(p => p.id === notif.playerId);
    if (player) extra.innerHTML = renderNotifPlayerRow(player, team);
  } else if (notif.type === "shortlistMoved") {
    const found = findPlayerAnywhere(notif.playerId);
    if (found) {
      extra.innerHTML = `
        ${renderNotifPlayerRow(found.p, found.team)}
        <div class="notif-transfer-route">
          ${transferHistoryClubHTML(notif.fromTeamId, notif.leagueKey, notif.fromTeamName)}
          <span class="transfer-history-arrow">→</span>
          ${transferHistoryClubHTML(notif.toTeamId, notif.leagueKey, notif.toTeamName)}
        </div>`;
      bodyEl.style.display = "none";
    }
  } else if (notif.type === "boardObjective") {
    // objectiveLabel porte déjà son propre pictogramme pour la plupart des paliers (🏆/🥉/🛡️) —
    // pas de 🎯 en plus ici, le titre de la notification le porte déjà.
    extra.innerHTML = `<div class="notif-objective-card">${notif.objectiveLabel}</div>`;
  }

  const queueBadge = document.getElementById("notif-queue-badge");
  const remaining = STATE.notifications.length - 1;
  queueBadge.style.display = remaining > 0 ? "inline-block" : "none";
  queueBadge.textContent = remaining > 0 ? `+${remaining} en attente` : "";

  const actions = document.getElementById("notif-actions");
  actions.innerHTML = "";
  actions.classList.toggle("stacked", notif.type === "interview");
  if (notif.type === "transferRequest") {
    const rejectBtn = document.createElement("button");
    rejectBtn.className = "secondary";
    rejectBtn.textContent = "Refuser";
    rejectBtn.onclick = () => respondToTransferRequest(false);
    const acceptBtn = document.createElement("button");
    acceptBtn.className = "primary";
    acceptBtn.textContent = "Accepter";
    acceptBtn.onclick = () => respondToTransferRequest(true);
    actions.appendChild(rejectBtn);
    actions.appendChild(acceptBtn);
  } else if (notif.type === "message") {
    const infoBtn = document.createElement("button");
    infoBtn.className = "secondary";
    infoBtn.textContent = "Voir la fiche";
    infoBtn.onclick = () => {
      const team = getUserTeam();
      const player = team.players.find(p => p.id === notif.playerId);
      if (player) openPlayerInfoModal(player, team);
    };
    const noBtn = document.createElement("button");
    noBtn.className = "secondary";
    noBtn.textContent = "Non";
    noBtn.onclick = () => respondToMessage(false);
    const yesBtn = document.createElement("button");
    yesBtn.className = "primary";
    yesBtn.textContent = "Oui";
    yesBtn.onclick = () => respondToMessage(true);
    actions.appendChild(infoBtn);
    actions.appendChild(noBtn);
    actions.appendChild(yesBtn);
  } else if (notif.type === "shortlistMoved") {
    const infoBtn = document.createElement("button");
    infoBtn.className = "secondary";
    infoBtn.textContent = "Voir la fiche";
    infoBtn.onclick = () => {
      const found = findPlayerAnywhere(notif.playerId);
      if (found) openPlayerInfoModal(found.p, found.team);
    };
    const okBtn = document.createElement("button");
    okBtn.className = "primary";
    okBtn.textContent = "OK";
    okBtn.onclick = () => dismissCurrentNotification();
    actions.appendChild(infoBtn);
    actions.appendChild(okBtn);
  } else if (notif.type === "boardObjective") {
    const okBtn = document.createElement("button");
    okBtn.className = "primary";
    okBtn.textContent = "Compris";
    okBtn.onclick = () => dismissCurrentNotification();
    actions.appendChild(okBtn);
  } else if (notif.type === "interview" && INTERVIEW_TEMPLATES[notif.templateIdx]) {
    // Toutes les réponses sont des choix neutres (aucune n'est "la bonne") : même style pour
    // toutes, pas de bouton "primary" qui suggérerait une réponse recommandée.
    const template = INTERVIEW_TEMPLATES[notif.templateIdx];
    template.answers.forEach((answer, idx) => {
      const btn = document.createElement("button");
      btn.className = "secondary";
      btn.textContent = answer.label;
      btn.onclick = () => respondToInterview(idx);
      actions.appendChild(btn);
    });
  } else {
    const closeBtn = document.createElement("button");
    closeBtn.className = "primary";
    closeBtn.textContent = "Fermer";
    closeBtn.onclick = dismissCurrentNotification;
    actions.appendChild(closeBtn);
  }
}

function dismissCurrentNotification() {
  STATE.notifications.shift();
  if (STATE.notifications.length) {
    renderCurrentNotification();
  } else {
    closeNotificationModal();
  }
}

function respondToTransferRequest(accept) {
  const notif = STATE.notifications[0];
  const team = getUserTeam();
  if (accept) {
    const player = team.players.find(p => p.id === notif.playerId);
    const otherTeam = STATE.league.teams.find(t => t.id === notif.otherTeamId);
    if (player && otherTeam && team.players.length > 7) {
      team.players = team.players.filter(p => p.id !== player.id);
      team.budget += notif.amount;
      otherTeam.budget -= notif.amount;
      otherTeam.players.push(player);
      logTransferEvents([{
        type: "transfer", playerId: player.id, playerName: player.name, pos: player.pos,
        fromTeamId: team.id, fromTeamName: team.name, toTeamId: otherTeam.id, toTeamName: otherTeam.name,
        amount: notif.amount
      }], STATE.leagueKey, STATE.leagueKey);
      updateTopbar();
    }
  }
  dismissCurrentNotification();
  saveGame();
}

function respondToMessage(accept) {
  const notif = STATE.notifications[0];
  const team = getUserTeam();
  const player = team.players.find(p => p.id === notif.playerId);
  const template = MESSAGE_TEMPLATES[notif.templateIdx];
  if (player && template) {
    if (accept) template.yes(player); else template.no(player);
  }
  dismissCurrentNotification();
  saveGame();
}

function respondToInterview(answerIdx) {
  const notif = STATE.notifications[0];
  const template = INTERVIEW_TEMPLATES[notif.templateIdx];
  const answer = template && template.answers[answerIdx];
  if (answer) answer.effect();
  dismissCurrentNotification();
  saveGame();
}

function closeNotificationModal() {
  document.getElementById("notification-modal").classList.remove("active");
  renderCalendarTab();
  saveGame();
}

// ----------------- TOPBAR -----------------
function getUserTeam() {
  return STATE.league.teams.find(t => t.id === STATE.userTeamId);
}

// Fenêtres de mercato (journées 1-2, journées 8-9, et les 2 dernières journées + fin de saison) —
// factorisé pour être réutilisé par la ligue du joueur (updateTopbar) ET par chacune des 5 ligues
// en arrière-plan, qui ont chacune leur propre calendrier/nombre d'équipes (voir
// simulateOtherLeagueRound) donc leur propre position de journée à évaluer indépendamment.
function isMercatoWindowRound(round, totalRounds) {
  return round >= totalRounds || round <= 1 || round === 7 || round === 8 || round >= totalRounds - 2;
}

function updateTopbar() {
  const team = getUserTeam();
  document.getElementById("topbar-crest").innerHTML = renderTeamCrest(team, "crest-md");
  document.getElementById("topbar-team").textContent = team.name;
  document.getElementById("topbar-budget").textContent = "💰 " + formatMoney(team.budget);
  document.getElementById("topbar-season").textContent = "📅 Saison " + STATE.season;
  document.getElementById("topbar-date").textContent = "🗓️ " + formatGameDate(STATE.currentDay);
  document.getElementById("topbar-matchday").textContent = `Journée ${STATE.currentRound + 1} / ${STATE.schedule.length}`;

  const objectiveBadge = document.getElementById("topbar-objective");
  if (STATE.seasonObjective) {
    objectiveBadge.style.display = "";
    objectiveBadge.textContent = STATE.seasonObjective.shortLabel;
    objectiveBadge.title = STATE.seasonObjective.label;
  } else {
    objectiveBadge.style.display = "none";
  }

  // fenêtres de mercato : journées 1-2, journées 8-9, et les 2 dernières journées (+ fin de saison)
  const totalRounds = STATE.schedule.length;
  const cr = STATE.currentRound;
  const banner = document.getElementById("mercato-banner");

  let open = false, message = "";
  if (cr >= totalRounds) {
    open = true;
    message = "🔄 MERCATO D'ÉTÉ — La saison est terminée, prépare la suivante !";
  } else if (cr <= 1) {
    open = true;
    message = "🔄 MERCATO D'OUVERTURE — Fenêtre de transferts ouverte (journées 1-2) !";
  } else if (cr === 7 || cr === 8) {
    open = true;
    message = "🔄 MERCATO DE MI-SAISON — Fenêtre de transferts ouverte (journées 8-9) !";
  } else if (cr >= totalRounds - 2) {
    open = true;
    message = "🔄 MERCATO DE FIN DE SAISON — Fenêtre de transferts ouverte (2 dernières journées) !";
  }

  STATE.mercatoOpen = open;
  banner.style.display = open ? "block" : "none";
  banner.textContent = message;
}

function formatMoney(v) {
  return "€" + Math.round(v).toLocaleString("fr-FR");
}

// ----------------- ONGLET CALENDRIER -----------------
function renderCalendarTab() {
  const team = getUserTeam();
  const totalRounds = STATE.schedule.length;
  const nextPanel = document.getElementById("next-match-panel");

  if (STATE.notifications.length > 0) {
    nextPanel.innerHTML = `<h3>🔔 ${formatGameDate(STATE.currentDay)}</h3>
      <p style="margin:8px 0;">Tu as ${STATE.notifications.length} notification(s) en attente. Consulte-les pour pouvoir continuer.</p>
      <button class="primary" id="btn-view-notifications">Voir mes notifications</button>`;
    document.getElementById("btn-view-notifications").onclick = openNotificationModal;
  } else if (STATE.currentRound >= totalRounds) {
    // garantit un classement final dans toutes les ligues en arrière-plan dès que la saison
    // du joueur se termine, peu importe le chemin qui a mené ici (avancée de jours ou dernier
    // match joué directement) — idempotent, ne fait rien si déjà fait.
    finalizeOtherLeagues();
    if (!STATE.tournament) STATE.tournament = buildTournamentBracket();
    if (!STATE.tournament.finished) {
      nextPanel.innerHTML = `<h3>Saison terminée !</h3>
        <p>Les 2 meilleures équipes de chacune des 6 ligues s'affrontent maintenant pour le titre international.</p>
        <button class="primary" id="btn-view-tournament">🏆 Voir le tournoi de fin de saison</button>`;
      document.getElementById("btn-view-tournament").onclick = openTournamentScreen;
    } else {
      const alreadyAwarded = STATE.seasonPrizeAwarded;
      awardSeasonPrizeMoney();
      if (!alreadyAwarded) { updateTopbar(); saveGame(); }
      const prize = STATE.lastSeasonPrize;
      const resultLabel = prize.tournamentResult ? TOURNAMENT_RESULT_LABELS[prize.tournamentResult] : "non qualifié pour le tournoi";
      const objectiveLine = prize.objective ? `
        <p style="margin:8px 0; color:${prize.objectiveMet ? "#b6ffd9" : "#ffd6d6"};">
          🎯 Objectif de la direction (${prize.objective.label}) : <b>${prize.objectiveMet ? "atteint" : "manqué"}</b>
          (${prize.objectiveAmount >= 0 ? "+" : ""}${formatMoney(prize.objectiveAmount)})
        </p>` : "";
      nextPanel.innerHTML = `<h3>Saison terminée !</h3>
        <p>🏆 Champion international : <b>${STATE.tournament.champion.team.name}</b> (${STATE.tournament.champion.leagueName})</p>
        <p style="margin:8px 0;">${prize.rank}${prize.rank === 1 ? "er" : "e"} de ${STATE.league.name} · ${resultLabel}</p>
        ${objectiveLine}
        <p style="margin:8px 0; color:var(--accent); font-weight:700;">
          💰 Prime de fin de saison : ${prize.total >= 0 ? "+" : ""}${formatMoney(prize.total)}
          <span style="color:#8391a8; font-weight:500; font-size:0.85em;">(${formatMoney(prize.championshipAmount)} championnat + ${formatMoney(prize.tournamentAmount)} tournoi)</span>
        </p>
        <button class="primary" id="btn-new-season">Démarrer la saison suivante</button>`;
      document.getElementById("btn-new-season").onclick = startNewSeason;
    }
  } else {
    const round = STATE.schedule[STATE.currentRound];
    const userMatch = round.find(m => m.home === team.id || m.away === team.id);
    const isMatchDay = STATE.currentDay >= matchDayForRound(STATE.currentRound);
    if (userMatch && isMatchDay) {
      const home = STATE.league.teams.find(t => t.id === userMatch.home);
      const away = STATE.league.teams.find(t => t.id === userMatch.away);
      nextPanel.innerHTML = `
        <div class="hero-match-header"><span>Journée ${STATE.currentRound + 1}</span><span>${formatGameDate(STATE.currentDay)}</span></div>
        <div class="hero-match-teams">
          <div class="hero-team">
            ${renderTeamCrest(home, "crest-lg")}
            <span class="hero-team-name">${home.name}</span>
          </div>
          <span class="hero-vs">VS</span>
          <div class="hero-team">
            ${renderTeamCrest(away, "crest-lg")}
            <span class="hero-team-name">${away.name}</span>
          </div>
        </div>
        <button class="primary" id="btn-prepare-match">Préparer le match</button>`;
      document.getElementById("btn-prepare-match").onclick = openLineupScreen;
    } else {
      const daysLeft = matchDayForRound(STATE.currentRound) - STATE.currentDay;
      const btnHtml = advancing
        ? `<button class="primary" id="btn-advance-day" disabled>⏳ Avancer...</button>`
        : `<button class="primary" id="btn-advance-day">▶ Avancer</button>`;
      nextPanel.innerHTML = `<h3>${formatGameDate(STATE.currentDay)}</h3>
        <p style="margin:8px 0;">${userMatch ? `Prochain match dans ${daysLeft} jour(s) (Journée ${STATE.currentRound + 1}).` : `Ton équipe n'a pas de match cette journée (repos).`}</p>
        ${btnHtml}`;
      if (!advancing) document.getElementById("btn-advance-day").onclick = advanceDays;
    }
  }

  // liste du calendrier
  const list = document.getElementById("calendar-list");
  list.innerHTML = "";
  STATE.schedule.forEach((round, idx) => {
    const roundDiv = document.createElement("div");
    roundDiv.innerHTML = `<h4 style="margin:10px 0 4px;">Journée ${idx + 1}</h4>`;
    round.forEach(m => {
      const home = STATE.league.teams.find(t => t.id === m.home);
      const away = STATE.league.teams.find(t => t.id === m.away);
      const result = STATE.league.results.find(r => r.round === idx && r.home === m.home && r.away === m.away);
      const isUser = m.home === team.id || m.away === team.id;
      const fixtureDiv = document.createElement("div");
      fixtureDiv.className = "fixture" + (isUser ? " user" : "");
      const scoreText = result.played
        ? `${result.homeGoals} - ${result.awayGoals}${result.penaltyWinner ? " (tab)" : ""}`
        : "vs";
      fixtureDiv.innerHTML = `<span class="fixture-team home">${home.name}${renderTeamCrest(home, "crest-sm")}</span>
        <span class="score">${scoreText}</span>
        <span class="fixture-team away">${renderTeamCrest(away, "crest-sm")}${away.name}</span>`;
      roundDiv.appendChild(fixtureDiv);
    });
    list.appendChild(roundDiv);
  });

  renderMiniStandingsPanel();
  renderRecentFormPanel();
}

// ----- Panneaux latéraux du tableau de bord Calendrier -----
function renderMiniStandingsPanel() {
  const table = computeStandings(STATE.league);
  document.getElementById("mini-standings-list").innerHTML = table.map((row, idx) => `
    <div class="mini-standing-row${row.id === STATE.userTeamId ? " user-team" : ""}">
      <span class="mini-standing-pos">${idx + 1}</span>
      ${renderTeamCrest(row, "crest-sm")}
      <span class="mini-standing-name">${row.name}</span>
      <span class="mini-standing-pts">${row.points} pts</span>
    </div>`).join("");
}

function renderRecentFormPanel() {
  const team = getUserTeam();
  const list = document.getElementById("recent-form-list");
  const played = STATE.league.results
    .filter(r => r.played && (r.home === team.id || r.away === team.id))
    .sort((a, b) => b.round - a.round)
    .slice(0, 5)
    .reverse();
  if (!played.length) {
    list.innerHTML = `<p style="color:#8391a8; font-size:0.85em;">Aucun match joué pour l'instant.</p>`;
    return;
  }
  list.innerHTML = `<div class="form-strip">${played.map(r => {
    const isHome = r.home === team.id;
    const won = r.homeGoals !== r.awayGoals
      ? (isHome ? r.homeGoals > r.awayGoals : r.awayGoals > r.homeGoals)
      : (r.penaltyWinner === (isHome ? "home" : "away"));
    const oppId = isHome ? r.away : r.home;
    const opp = STATE.league.teams.find(t => t.id === oppId);
    const score = isHome ? `${r.homeGoals}-${r.awayGoals}` : `${r.awayGoals}-${r.homeGoals}`;
    return `<span class="form-dot ${won ? "form-win" : "form-loss"}" title="${won ? "Victoire" : "Défaite"} ${score} vs ${opp.name}">${won ? "V" : "D"}</span>`;
  }).join("")}</div>`;
}

// Remet une ligue à zéro pour une nouvelle saison SANS recréer les clubs depuis data.js
// (contrairement à buildOtherLeagues, réservée au tout début d'une carrière — startCareer) :
// régénère juste calendrier/résultats, vieillit et remet à zéro les stats de SAISON (pas
// carrière, cf. careerGoals etc. jamais touchés ici) des joueurs déjà en place. Préserve donc les
// transferts et budgets déjà accumulés — sinon un joueur acheté par l'utilisateur à une des 5
// ligues en arrière-plan (ou transféré par leur propre IA) réapparaîtrait dans son ancien club
// l'année suivante, en double avec sa version achetée (bug remonté par l'utilisateur). Renvoie le
// nouveau calendrier ; à l'appelant de l'assigner (STATE.schedule ou ol.schedule) et de remettre
// currentRound à 0.
function resetLeagueForNewSeason(league) {
  league.teams.forEach(t => t.players.forEach(p => {
    p.form = Math.max(50, Math.min(95, p.form));
    p.age += 1;
    p.goals = 0; p.assists = 0; p.matches = 0; p.ratingSum = 0; p.rating = 0;
    // tout le monde repart apte pour la nouvelle saison (une longue blessure entamée en toute
    // fin de saison précédente ne doit pas déborder sur la suivante).
    p.injured = false; p.injuryDaysLeft = 0; p.injurySeverity = null;
  }));
  const schedule = generateSchedule(league.teams.map(t => t.id));
  league.results = [];
  schedule.forEach((round, idx) => {
    round.forEach(m => {
      league.results.push({ round: idx, home: m.home, away: m.away, played: false, homeGoals: 0, awayGoals: 0 });
    });
  });
  return schedule;
}

function startNewSeason() {
  // filet de sécurité : garantit que les ligues en arrière-plan ont bien un classement final
  // avant qu'on ne les régénère pour la nouvelle saison (normalement déjà fait par
  // renderCalendarTab dès l'arrivée en "Saison terminée", cf. plus haut).
  finalizeOtherLeagues();

  STATE.schedule = resetLeagueForNewSeason(STATE.league);
  STATE.currentRound = 0;
  STATE.currentDay = 0;
  STATE.season++;

  // nouvelle saison pour toutes les ligues en arrière-plan aussi (même vieillissement/forme),
  // sans recréer leurs clubs depuis data.js — voir resetLeagueForNewSeason.
  (STATE.otherLeagues || []).forEach(ol => {
    ol.schedule = resetLeagueForNewSeason(ol.league);
    ol.currentRound = 0;
  });
  // un nouveau bracket sera reconstruit à la fin de cette nouvelle saison (cf. renderCalendarTab)
  STATE.tournament = null;
  STATE.seasonPrizeAwarded = false;
  STATE.lastSeasonPrize = null;
  STATE.seasonObjective = generateSeasonObjective();
  STATE.notifications.push({
    type: "boardObjective", title: "🎯 Objectif de la direction",
    body: "Voici l'objectif fixé par la direction pour cette nouvelle saison :",
    objectiveLabel: STATE.seasonObjective.label
  });

  updateTopbar();
  renderCalendarTab();
  saveGame();
}

// simule tous les matchs de la journée actuelle qui ne concernent pas l'utilisateur (IA)
// Nombre max d'entrées gardées dans l'historique des transferts (les plus anciennes sont perdues
// en premier) — évite d'alourdir indéfiniment la sauvegarde sur une longue carrière.
const TRANSFER_LOG_MAX = 150;

// Ajoute des événements de transfert (voir engine.js:fillPositionGaps/simulateAITransfers, qui
// restent purs et se contentent de RENVOYER ce qui s'est passé) à STATE.transferLog, avec le
// contexte temporel courant. `events` peut être un tableau vide (rien ne s'est passé ce tour-ci).
// fromLeagueKey/toLeagueKey sont distincts (pas juste un seul `leagueKey`) car un achat du joueur
// peut traverser deux ligues différentes (recrue d'une autre ligue vers la sienne) — nécessaire
// pour résoudre le bon blason de chaque club via findLeagueTeam à l'affichage (renderTransferHistoryTab).
function logTransferEvents(events, fromLeagueKey, toLeagueKey) {
  events.forEach(ev => {
    STATE.transferLog.push(Object.assign({}, ev, { fromLeagueKey, toLeagueKey, day: STATE.currentDay, season: STATE.season }));
  });
  if (STATE.transferLog.length > TRANSFER_LOG_MAX) {
    STATE.transferLog.splice(0, STATE.transferLog.length - TRANSFER_LOG_MAX);
  }
}

function simulateRoundAI(excludeMatch) {
  const round = STATE.schedule[STATE.currentRound];
  round.forEach(m => {
    if (excludeMatch && m.home === excludeMatch.home && m.away === excludeMatch.away) return;
    const home = STATE.league.teams.find(t => t.id === m.home);
    const away = STATE.league.teams.find(t => t.id === m.away);
    const result = simulateAIMatch(home, away);
    const r = STATE.league.results.find(r => r.round === STATE.currentRound && r.home === m.home && r.away === m.away);
    r.played = true; r.homeGoals = result.homeGoals; r.awayGoals = result.awayGoals; r.penaltyWinner = result.penaltyWinner;
  });
  // IA transferts à la mi-saison et fin de saison
  if (STATE.mercatoOpen) {
    const events = simulateAITransfers(STATE.league, STATE.userTeamId);
    logTransferEvents(events, STATE.leagueKey, STATE.leagueKey);
    checkShortlistTransferAlerts(events);
  }
}

// Prévient le joueur quand un des joueurs de sa liste de suivi est transféré par l'IA vers un
// autre club (sans ça, il ne le découvre qu'en retombant par hasard sur sa fiche — la liste de
// suivi se met à jour silencieusement puisqu'elle résout toujours le club ACTUEL du joueur).
function checkShortlistTransferAlerts(events) {
  events.forEach(ev => {
    if (ev.type !== "transfer" || !ev.toTeamId) return;
    if (!STATE.shortlist.includes(ev.playerId)) return;
    STATE.notifications.push({
      type: "shortlistMoved",
      title: "🔔 Joueur suivi transféré",
      body: `${ev.playerName} a quitté ${ev.fromTeamName} pour rejoindre ${ev.toTeamName}.`,
      playerId: ev.playerId,
      fromTeamId: ev.fromTeamId, fromTeamName: ev.fromTeamName,
      toTeamId: ev.toTeamId, toTeamName: ev.toTeamName,
      leagueKey: STATE.leagueKey
    });
  });
}

// ----------------- ONGLET CLASSEMENT -----------------
function renderStandingsTab() {
  const table = computeStandings(STATE.league);
  const tbody = document.querySelector("#standings-table tbody");
  tbody.innerHTML = "";
  table.forEach((row, idx) => {
    const tr = document.createElement("tr");
    if (row.id === STATE.userTeamId) tr.className = "user-team";
    const diffColor = row.diff > 0 ? "#00ff88" : row.diff < 0 ? "#ff5a5a" : "#8391a8";
    const diffText = row.diff > 0 ? `+${row.diff}` : row.diff;
    tr.innerHTML = `<td class="standing-pos">${idx + 1}</td>
      <td class="name"><div class="market-club-cell">${renderTeamCrest(row, "crest-sm")}<span>${row.name}</span></div></td>
      <td>${row.played}</td><td>${row.won}</td><td>${row.draw}</td><td>${row.lost}</td>
      <td>${row.goalsFor}</td><td>${row.goalsAgainst}</td>
      <td class="standing-diff" style="color:${diffColor};">${diffText}</td>
      <td class="standing-pts">${row.points}</td>`;
    tbody.appendChild(tr);
  });
}

// ----------------- ONGLET STATISTIQUES -----------------
function renderStatsTab() {
  renderPalmaresPanel();
  renderStatsTable("scorers-table", computeTopScorers(STATE.league, 10), p => p.goals);
  renderStatsTable("assists-table", computeTopAssists(STATE.league, 10), p => p.assists);
  renderStatsTable("ratings-table", computeTopRatings(STATE.league, 10), p => (p.ratingSum / p.matches).toFixed(1));
}

// Palmarès : un résumé permanent par saison terminée (classement du championnat + parcours au
// tournoi international), alimenté par awardSeasonPrizeMoney à la toute fin de chaque saison —
// donne un aperçu de la progression sur toute la carrière, pas juste la saison en cours.
function renderPalmaresPanel() {
  const history = STATE.trophyHistory;
  const summaryEl = document.getElementById("palmares-summary");
  const recordsEl = document.getElementById("palmares-records");
  const listEl = document.getElementById("palmares-list");
  const emptyEl = document.getElementById("palmares-empty");

  const leagueTitles = history.filter(h => h.rank === 1).length;
  const intlTitles = history.filter(h => h.tournamentResult === "champion").length;
  const finals = history.filter(h => h.tournamentResult === "finale").length;
  const objectivesMet = history.filter(h => h.objectiveMet === true).length;
  const objectivesSet = history.filter(h => h.objectiveMet !== null && h.objectiveMet !== undefined).length;
  summaryEl.innerHTML = `
    ${renderStatTile(history.length, "Saisons")}
    ${renderStatTile(leagueTitles, "Titres de champion")}
    ${renderStatTile(intlTitles, "🏆 Titres internationaux")}
    ${renderStatTile(finals, "Finales perdues")}
    ${renderStatTile(objectivesSet ? `${objectivesMet}/${objectivesSet}` : "-", "🎯 Objectifs atteints")}
  `;

  // records de carrière : recalculés à l'affichage en comparant les meilleurs performeurs déjà
  // capturés saison par saison (voir awardSeasonPrizeMoney) — pas besoin de les stocker séparément.
  const bestScorer = history.reduce((best, h) =>
    (h.topScorer && (!best || h.topScorer.goals > best.goals)) ? { ...h.topScorer, season: h.season } : best, null);
  const bestAssister = history.reduce((best, h) =>
    (h.topAssister && (!best || h.topAssister.assists > best.assists)) ? { ...h.topAssister, season: h.season } : best, null);
  recordsEl.innerHTML = [
    bestScorer ? `<div class="palmares-record">⚽ Record de buts en une saison : <b>${bestScorer.goals}</b> — ${bestScorer.name} (saison ${bestScorer.season})</div>` : "",
    bestAssister ? `<div class="palmares-record">🅰️ Record de passes décisives en une saison : <b>${bestAssister.assists}</b> — ${bestAssister.name} (saison ${bestAssister.season})</div>` : ""
  ].join("");

  emptyEl.style.display = history.length ? "none" : "block";
  listEl.innerHTML = history.slice().reverse().map(h => {
    const tournamentLabel = h.tournamentResult ? TOURNAMENT_RESULT_LABELS[h.tournamentResult] : "non qualifié";
    const objectiveTag = h.objectiveMet === true ? `<span class="palmares-objective palmares-objective-met">🎯 objectif atteint</span>`
      : h.objectiveMet === false ? `<span class="palmares-objective palmares-objective-missed">🎯 objectif manqué</span>` : "";
    const scorerTag = h.topScorer ? `<span class="palmares-scorer">⚽ ${h.topScorer.name} (${h.topScorer.goals})</span>` : "";
    return `<div class="palmares-row${h.rank === 1 || h.tournamentResult === "champion" ? " palmares-row-title" : ""}">
      <span class="palmares-season">Saison ${h.season}</span>
      <span class="palmares-rank">${h.rank}${h.rank === 1 ? "er" : "e"} / ${h.totalTeams} — ${h.leagueName}</span>
      <span class="palmares-tournament">${tournamentLabel}</span>
      ${scorerTag}
      ${objectiveTag}
    </div>`;
  }).join("");
}

function renderStatsTable(tableId, rows, formatStat) {
  const tbody = document.querySelector(`#${tableId} tbody`);
  tbody.innerHTML = "";
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#8391a8;">Aucune donnée pour l'instant</td></tr>`;
    return;
  }
  rows.forEach(({ p, team }, idx) => {
    const tr = document.createElement("tr");
    tr.className = team.id === STATE.userTeamId ? "user-team clickable" : "clickable";
    tr.innerHTML = `<td class="standing-pos">${idx + 1}</td>
      <td class="name">
        <div class="player-cell">
          <div class="avatar-sm">
            <div class="avatar-sm-fallback">${playerInitials(p.name)}</div>
            <img src="${playerPhotoUrl(p, team)}" alt="" class="avatar-sm-img"
              onload="this.style.display='block'; this.previousElementSibling.style.display='none';"
              onerror="this.style.display='none';">
          </div>
          <span class="player-cell-name">${p.name}</span>
        </div>
      </td>
      <td><div class="market-club-cell">${renderTeamCrest(team, "crest-sm")}<span>${team.name}</span></div></td>
      <td>${p.matches}</td>
      <td class="standing-pts">${formatStat(p)}</td>`;
    tr.onclick = () => openPlayerInfoModal(p, team);
    tbody.appendChild(tr);
  });
}

// ----------------- ONGLET EFFECTIF -----------------
// Tri courant de la table Effectif (persiste tant que l'onglet reste ouvert, pas sauvegardé).
let squadSortState = { key: "pos", dir: 1 };

function squadSortValue(p, key) {
  switch (key) {
    case "name": return p.name;
    case "pos": return POS_ORDER[p.pos];
    case "avgRating": return p.matches > 0 ? p.ratingSum / p.matches : -1;
    default: return p[key];
  }
}

function renderSquadTab() {
  const team = getUserTeam();
  const tbody = document.querySelector("#squad-table tbody");
  tbody.innerHTML = "";
  const { key, dir } = squadSortState;
  const sorted = [...team.players].sort((a, b) => {
    const av = squadSortValue(a, key), bv = squadSortValue(b, key);
    if (av < bv) return -1 * dir;
    if (av > bv) return 1 * dir;
    return POS_ORDER[a.pos] - POS_ORDER[b.pos];
  });
  sorted.forEach(p => {
    const tr = document.createElement("tr");
    tr.className = "clickable" + (p.injured ? " squad-row-injured" : "");
    const avgRating = p.matches > 0 ? (p.ratingSum / p.matches).toFixed(1) : "-";
    const injuryBadge = p.injured
      ? `<span class="injury-badge" title="Blessure ${p.injurySeverity} — indisponible encore ${p.injuryDaysLeft} jour(s)">🩹 ${p.injuryDaysLeft}j</span>`
      : "";
    tr.innerHTML = `<td class="name">
        <div class="player-cell">
          <div class="avatar-sm">
            <div class="avatar-sm-fallback">${playerInitials(p.name)}</div>
            <img src="${playerPhotoUrl(p, team)}" alt="" class="avatar-sm-img"
              onload="this.style.display='block'; this.previousElementSibling.style.display='none';"
              onerror="this.style.display='none';">
          </div>
          <span class="player-cell-name">${p.name}</span>
          ${injuryBadge}
        </div>
      </td>
      <td><span class="pos-tag pos-${p.pos}">${p.pos}</span></td>
      <td>${renderStarRating(p.overall)}</td>
      <td>${p.speed}</td><td>${p.technique}</td><td>${p.physical}</td><td>${p.mental}</td>
      <td>${renderFormBar(p.form)}</td><td>${p.age}</td><td>${formatMoney(p.value)}</td>
      <td>${p.goals}</td><td>${p.assists}</td><td>${avgRating}</td>
      <td><button class="secondary" data-action="sell" data-player="${p.id}">Vendre</button></td>`;
    tr.onclick = () => openPlayerInfoModal(p, team);
    tbody.appendChild(tr);
  });
  // clic sur "Vendre" : ne doit pas aussi ouvrir la fiche technique de la ligne
  tbody.querySelectorAll("[data-action='sell']").forEach(btn => {
    btn.onclick = (e) => { e.stopPropagation(); sellPlayer(btn.dataset.player); };
  });
  bindSortableTable("squad-table", squadSortState, renderSquadTab);
}

// En-têtes triables partagés par toutes les tables denses façon FM (Effectif, Mercato) :
// bascule ascendant/descendant au clic, ré-affiche la flèche ▲▼ sur la colonne triée.
function bindSortableTable(tableId, sortState, rerender) {
  document.querySelectorAll(`#${tableId} th.sortable`).forEach(th => {
    const isActive = th.dataset.sortKey === sortState.key;
    th.classList.toggle("sort-active", isActive);
    th.classList.toggle("sort-asc", isActive && sortState.dir === 1);
    th.classList.toggle("sort-desc", isActive && sortState.dir === -1);
    th.onclick = () => {
      if (sortState.key === th.dataset.sortKey) {
        sortState.dir *= -1;
      } else {
        sortState.key = th.dataset.sortKey;
        sortState.dir = (th.dataset.sortKey === "name" || th.dataset.sortKey === "pos" || th.dataset.sortKey === "club") ? 1 : -1;
      }
      rerender();
    };
  });
}

// Étoiles fac. Football Manager : 5 étoiles pleines superposées, remplissage clippé selon la note /100.
// Les notes générales des joueurs de ce jeu se situent presque toutes entre 68 et 92 (rarement
// en dessous ou au-dessus) : une mise à l'échelle directe sur 0-100 écrase donc tout le monde
// entre 3 et 5 étoiles. On réétalonne sur cette amplitude réelle pour qu'un joueur faible affiche
// nettement moins d'étoiles qu'un joueur élite.
const STAR_RATING_MIN = 60;
const STAR_RATING_MAX = 95;
function renderStarRating(overall) {
  const pct = Math.max(0, Math.min(100, (overall - STAR_RATING_MIN) / (STAR_RATING_MAX - STAR_RATING_MIN) * 100));
  return `<span class="star-rating" title="${overall}/100">
    <span class="star-bg">★★★★★</span>
    <span class="star-fill" style="width:${pct}%">★★★★★</span>
  </span>`;
}

function renderFormBar(form) {
  const color = form >= 80 ? "#00ff88" : form >= 60 ? "#ffaa00" : "#ff4444";
  return `<div class="form-bar"><div class="fill" style="width:${form}%; background:${color};"></div></div> ${form}`;
}

// Chip de note moyenne façon Football Manager (banc/effectif), sur les vrais matchs déjà joués.
function renderRatingChip(player) {
  if (player.matches <= 0) return `<span class="rating-chip rc-none">-</span>`;
  const avg = player.ratingSum / player.matches;
  const cls = avg >= 7 ? "rc-high" : avg >= 6 ? "rc-mid" : "rc-low";
  return `<span class="rating-chip ${cls}">${avg.toFixed(2).replace(".", ",")}</span>`;
}

function overallClass(value) {
  if (value >= 85) return "ovr-elite";
  if (value >= 78) return "ovr-good";
  if (value < 70) return "ovr-low";
  return "ovr-avg";
}

function renderOverallBadge(overall) {
  return `<span class="ovr-badge ${overallClass(overall)}">${overall}</span>`;
}

// Attribut individuel façon fiche joueur FM : badge coloré (mêmes seuils que la note générale) + libellé.
function renderAttributeTile(label, value) {
  return `<div class="attr-tile"><span class="ovr-badge ${overallClass(value)}">${value}</span><span class="attr-tile-label">${label}</span></div>`;
}

// Tuile stat façon fiche joueur FM (âge, valeur, buts, passes, note moy.).
function renderStatTile(value, label) {
  return `<div class="stat-tile"><span class="stat-tile-value">${value}</span><span class="stat-tile-label">${label}</span></div>`;
}

// ----------------- ONGLET MERCATO -----------------
// Tri courant de la table de recherche (pas sauvegardé).
let marketSortState = { key: "overall", dir: -1 };

function renderTransfersTab() {
  const team = getUserTeam();
  populateMarketLeagueFilter();
  renderMarketTable(team);
  renderShortlistTable(team);
  updateShortlistCount();
  renderCompareTray();
  renderTransferHistoryTab();
}

// Un club dans une ligne d'historique : blason (résolu en direct via findLeagueTeam — le nom
// texte stocké sur l'événement ne sert que de repli si jamais le club n'était plus résolvable) +
// nom + petit drapeau si ce club n'est pas dans TA ligue (transfert inter-ligues).
function transferHistoryClubHTML(teamId, leagueKey, fallbackName) {
  const team = teamId ? findLeagueTeam(leagueKey, teamId) : null;
  const crest = team ? renderTeamCrest(team, "crest-sm") : "";
  const leagueTag = leagueKey && leagueKey !== STATE.leagueKey
    ? `<span class="tourn-league-tag">${LEAGUE_FLAGS[leagueKey] || "⚽"}</span>` : "";
  return `<span class="transfer-history-club">${crest}<span>${team ? team.name : fallbackName}</span>${leagueTag}</span>`;
}

// Sous-onglet "Historique" du Mercato : le plus récent en premier, cliquable pour ouvrir la fiche
// technique à jour du joueur (findPlayerAnywhere — sa situation actuelle, pas figée au moment du
// transfert). STATE.transferLog ne contient que tes propres transferts (n'importe quelle ligue) et
// ceux de l'IA au sein de TA ligue — voir logTransferEvents/simulateRoundAI ; les transferts
// internes aux 5 autres ligues ne sont pas journalisés (bruit trop important, peu pertinent pour toi).
function renderTransferHistoryTab() {
  const list = document.getElementById("transfer-history-list");
  const emptyMsg = document.getElementById("transfer-history-empty");
  const entries = STATE.transferLog.slice().reverse();
  emptyMsg.style.display = entries.length ? "none" : "block";
  list.innerHTML = entries.map((ev, idx) => {
    const involvesUser = ev.fromTeamId === STATE.userTeamId || ev.toTeamId === STATE.userTeamId;
    const route = ev.type === "release"
      ? `<span class="transfer-history-release">🔓 libéré par</span>${transferHistoryClubHTML(ev.fromTeamId, ev.fromLeagueKey, ev.fromTeamName)}`
      : `${transferHistoryClubHTML(ev.fromTeamId, ev.fromLeagueKey, ev.fromTeamName)}
         <span class="transfer-history-arrow">→</span>
         ${transferHistoryClubHTML(ev.toTeamId, ev.toLeagueKey, ev.toTeamName)}`;
    return `<div class="transfer-history-row${involvesUser ? " transfer-history-user" : ""}" data-idx="${idx}" title="Voir la fiche technique">
      <span class="transfer-history-date">${formatGameDate(ev.day, ev.season)}</span>
      <span class="pos-tag pos-${ev.pos}">${ev.pos}</span>
      <span class="transfer-history-name">${ev.playerName}</span>
      <span class="transfer-history-route">${route}</span>
      <span class="transfer-history-amount">${formatMoney(ev.amount)}</span>
    </div>`;
  }).join("");

  list.querySelectorAll(".transfer-history-row").forEach(row => {
    row.onclick = () => {
      const ev = entries[Number(row.dataset.idx)];
      const found = findPlayerAnywhere(ev.playerId);
      if (found) openPlayerInfoModal(found.p, found.team);
    };
  });
}

// Bascule entre les deux sous-onglets du Mercato (Rechercher / Ma liste) — les deux restent
// toujours accessibles, contrairement à l'ancien onglet Mercato qui se masquait hors fenêtre
// de transferts (seule l'action "Offre" dans Ma liste reste bloquée hors fenêtre, voir
// renderShortlistTable/STATE.mercatoOpen).
function showMercatoSubtab(name) {
  document.querySelectorAll(".mercato-subtab-btn").forEach(b => b.classList.toggle("active", b.dataset.subtab === name));
  document.querySelectorAll(".mercato-subpanel").forEach(p => p.classList.toggle("active", p.id === "mercato-subtab-" + name));
}

// Peuple le filtre "Ligue" une seule fois (les ligues d'une carrière ne changent pas en cours de
// saison) : ré-exécuter au clic recréerait les options et perdrait la sélection en cours.
function populateMarketLeagueFilter() {
  const select = document.getElementById("filter-league");
  if (select.options.length > 1) return;
  select.innerHTML = `<option value="all">Toutes</option>
    <option value="${STATE.leagueKey}">${LEAGUE_FLAGS[STATE.leagueKey] || "⚽"} ${STATE.league.name}</option>`;
  (STATE.otherLeagues || []).forEach(ol => {
    select.innerHTML += `<option value="${ol.key}">${LEAGUE_FLAGS[ol.key] || "⚽"} ${ol.name}</option>`;
  });
}

function marketSortValue(entry, key) {
  if (key === "club") return entry.team.name;
  if (key === "pos") return POS_ORDER[entry.p.pos];
  return entry.p[key];
}

function renderMarketTable(team) {
  const tbody = document.getElementById("market-list");
  const emptyMsg = document.getElementById("market-empty");
  tbody.innerHTML = "";

  const posFilter = document.getElementById("filter-pos").value;
  const ovrFilter = parseInt(document.getElementById("filter-ovr").value, 10);
  const nameFilter = document.getElementById("filter-name").value.trim().toLowerCase();
  const leagueFilter = document.getElementById("filter-league").value;

  const entries = [];
  const addFromTeam = (otherTeam, leagueKey, leagueName) => {
    if (otherTeam.id === team.id) return;
    if (leagueFilter !== "all" && leagueKey !== leagueFilter) return;
    otherTeam.players.forEach(p => {
      if (posFilter !== "all" && p.pos !== posFilter) return;
      if (p.overall < ovrFilter) return;
      if (nameFilter && !p.name.toLowerCase().includes(nameFilter)) return;
      entries.push({ p, team: otherTeam, leagueKey, leagueName });
    });
  };
  STATE.league.teams.forEach(otherTeam => addFromTeam(otherTeam, STATE.leagueKey, STATE.league.name));
  (STATE.otherLeagues || []).forEach(ol => {
    ol.league.teams.forEach(otherTeam => addFromTeam(otherTeam, ol.key, ol.name));
  });

  const { key, dir } = marketSortState;
  entries.sort((a, b) => {
    const av = marketSortValue(a, key), bv = marketSortValue(b, key);
    if (av < bv) return -1 * dir;
    if (av > bv) return 1 * dir;
    return b.p.overall - a.p.overall;
  });

  emptyMsg.style.display = entries.length ? "none" : "block";

  entries.forEach(({ p, team: otherTeam, leagueKey, leagueName }) => {
    const tr = document.createElement("tr");
    tr.className = "clickable";
    tr.title = "Voir la fiche technique";
    const leagueTag = leagueKey !== STATE.leagueKey
      ? `<span class="tourn-league-tag">${LEAGUE_FLAGS[leagueKey] || "⚽"} ${leagueName}</span>` : "";
    tr.innerHTML = `<td class="name">
        <div class="player-cell">
          <div class="avatar-sm">
            <div class="avatar-sm-fallback">${playerInitials(p.name)}</div>
            <img src="${playerPhotoUrl(p, otherTeam)}" alt="" class="avatar-sm-img"
              onload="this.style.display='block'; this.previousElementSibling.style.display='none';"
              onerror="this.style.display='none';">
          </div>
          <span class="player-cell-name">${p.name}</span>
        </div>
      </td>
      <td><div class="market-club-cell">${renderTeamCrest(otherTeam, "crest-sm")}<span>${otherTeam.name}</span>${leagueTag}</div></td>
      <td><span class="pos-tag pos-${p.pos}">${p.pos}</span></td>
      <td>${renderStarRating(p.overall)}</td>
      <td>${renderFormBar(p.form)}</td>
      <td>${p.age}</td>
      <td>${formatMoney(p.value)}</td>
      <td class="shortlist-actions">
        <button class="secondary compare-toggle-btn${compareIds.includes(p.id) ? " selected" : ""}" data-action="compare" data-player="${p.id}" title="Comparer">⚖</button>
        <button class="secondary${STATE.shortlist.includes(p.id) ? " selected" : ""}" data-action="shortlist" data-player="${p.id}">${STATE.shortlist.includes(p.id) ? "✓ Dans ma liste" : "+ Ajouter"}</button>
      </td>`;
    tr.onclick = () => openPlayerInfoModal(p, otherTeam);
    tbody.appendChild(tr);
  });

  // clic sur un bouton d'action : ne doit pas aussi ouvrir la fiche technique de la ligne
  tbody.querySelectorAll("[data-action='shortlist']").forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      toggleShortlist(btn.dataset.player);
    };
  });
  tbody.querySelectorAll("[data-action='compare']").forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      toggleCompare(btn.dataset.player);
    };
  });

  bindSortableTable("market-table", marketSortState, () => renderMarketTable(team));
}

// Retrouve un joueur n'importe où dans la ligue du joueur ou les 5 autres ligues (les shortlists
// stockent uniquement un id de joueur, pas une référence figée club/ligue, pour rester valides
// même si le joueur est transféré ailleurs par l'IA entre-temps).
function findPlayerAnywhere(playerId) {
  let found = null;
  const scan = (teams, leagueKey, leagueName) => {
    teams.forEach(t => {
      if (found) return;
      const p = t.players.find(pl => pl.id === playerId);
      if (p) found = { p, team: t, leagueKey, leagueName };
    });
  };
  scan(STATE.league.teams, STATE.leagueKey, STATE.league.name);
  (STATE.otherLeagues || []).forEach(ol => { if (!found) scan(ol.league.teams, ol.key, ol.name); });
  return found;
}

function toggleShortlist(playerId) {
  const idx = STATE.shortlist.indexOf(playerId);
  if (idx === -1) STATE.shortlist.push(playerId); else STATE.shortlist.splice(idx, 1);
  if (selectedShortlistId === playerId && idx !== -1) selectedShortlistId = null;
  saveGame();
  const team = getUserTeam();
  renderMarketTable(team);
  renderShortlistTable(team);
  updateShortlistCount();
}

function updateShortlistCount() {
  document.getElementById("shortlist-count").textContent = STATE.shortlist.length ? `(${STATE.shortlist.length})` : "";
}

// Joueur actuellement sélectionné dans la liste de gauche de "Ma liste" (dont la fiche
// détaillée s'affiche dans le panneau de droite) — façon EA FC : liste compacte + fiche.
let selectedShortlistId = null;

// Rumeurs de mercato : combien de clubs de TA ligue (pas les 5 autres, comme les alertes de
// transfert — cf. checkShortlistTransferAlerts) auraient un intérêt réel pour ce joueur au
// prochain mercato. Reprend EXACTEMENT le critère utilisé par l'IA elle-même pour se renforcer
// (simulateAITransfers : une nette amélioration au poste — overall > meilleur actuel + 2 — et le
// budget pour se l'offrir), donc ce n'est pas du flavor gratuit : si le badge dit "3 clubs
// intéressés", ce sont bien 3 clubs qui achèteraient réellement ce joueur s'ils en avaient l'occasion.
function computeShortlistInterest(playerId) {
  const found = findPlayerAnywhere(playerId);
  if (!found || found.leagueKey !== STATE.leagueKey) return 0;
  const { p, team } = found;
  let interested = 0;
  STATE.league.teams.forEach(rival => {
    if (rival.id === team.id || rival.id === STATE.userTeamId) return;
    const ownBest = Math.max(0, ...rival.players.filter(pl => pl.pos === p.pos).map(pl => pl.overall));
    if (p.overall > ownBest + 2 && rival.budget >= p.value) interested++;
  });
  return interested;
}

function shortlistInterestBadgeHTML(count, compact) {
  if (count <= 0) return "";
  const icon = count >= 3 ? "🔥🔥" : count === 2 ? "🔥" : "👀";
  const label = compact ? count : (count === 1 ? "1 club s'y intéresse" : `${count} clubs s'y intéressent`);
  return `<span class="shortlist-interest-badge" title="D'autres clubs de ta ligue auraient les moyens et le besoin de recruter ce joueur au prochain mercato">${icon} ${label}</span>`;
}

function renderShortlistTable(team) {
  const wrap = document.getElementById("shortlist-rows");
  const emptyMsg = document.getElementById("shortlist-empty");
  const notice = document.getElementById("mercato-window-notice");
  wrap.innerHTML = "";
  notice.style.display = STATE.mercatoOpen ? "none" : "block";

  // nettoie les entrées obsolètes : joueur déjà recruté par l'utilisateur (n'a plus de sens dans
  // une liste de repérage) ou introuvable (ne devrait pas arriver, les joueurs ne sont jamais
  // supprimés, juste transférés — filet de sécurité).
  STATE.shortlist = STATE.shortlist.filter(id => {
    const found = findPlayerAnywhere(id);
    return found && found.team.id !== team.id;
  });

  const rows = STATE.shortlist.map(id => findPlayerAnywhere(id)).filter(Boolean);
  emptyMsg.style.display = rows.length ? "none" : "block";

  if (rows.length && !rows.some(r => r.p.id === selectedShortlistId)) selectedShortlistId = rows[0].p.id;
  if (!rows.length) selectedShortlistId = null;

  rows.forEach(({ p, team: otherTeam }) => {
    const row = document.createElement("div");
    row.className = "shortlist-row" + (p.id === selectedShortlistId ? " selected" : "");
    const interest = computeShortlistInterest(p.id);
    row.innerHTML = `${renderTeamCrest(otherTeam, "crest-sm")}
      <span class="pos-tag pos-${p.pos}">${p.pos}</span>
      <span class="shortlist-row-name">${p.name}</span>
      ${shortlistInterestBadgeHTML(interest, true)}
      <span class="shortlist-row-age">${p.age} ans</span>
      <span class="shortlist-row-ovr">${p.overall}</span>`;
    row.onclick = () => { selectedShortlistId = p.id; renderShortlistTable(team); };
    wrap.appendChild(row);
  });

  renderShortlistDetail();
}

// Panneau de droite de "Ma liste" : réutilise la fiche joueur complète (buildPlayerCardHTML,
// partagée avec la modale d'info joueur) façon fiche de scouting EA FC/FM, avec l'étiquette de
// ligue d'origine et les actions Offre/Retirer directement en bas de la fiche.
function renderShortlistDetail() {
  const wrap = document.getElementById("shortlist-detail");
  const found = selectedShortlistId ? findPlayerAnywhere(selectedShortlistId) : null;
  if (!found) {
    wrap.innerHTML = `<p class="shortlist-detail-placeholder">Sélectionne un joueur dans la liste pour voir sa fiche.</p>`;
    return;
  }
  const { p, team: otherTeam, leagueKey, leagueName } = found;
  const leagueTag = leagueKey !== STATE.leagueKey
    ? `<div class="tourn-league-tag" style="margin-top:8px;">${LEAGUE_FLAGS[leagueKey] || "⚽"} ${leagueName}</div>` : "";
  const interest = computeShortlistInterest(p.id);
  const interestTag = interest > 0 ? `<div style="margin-top:8px;">${shortlistInterestBadgeHTML(interest, false)}</div>` : "";
  const actionsHtml = `
    <div class="shortlist-detail-actions">
      <button class="primary" id="shortlist-detail-offer"${STATE.mercatoOpen ? "" : " disabled"}>Offre</button>
      <button class="secondary compare-toggle-btn${compareIds.includes(p.id) ? " selected" : ""}" id="shortlist-detail-compare">⚖ ${compareIds.includes(p.id) ? "Retirer du comparateur" : "Comparer"}</button>
      <button class="secondary" id="shortlist-detail-remove">Retirer de ma liste</button>
    </div>`;
  wrap.innerHTML = buildPlayerCardHTML(p, otherTeam, leagueTag + interestTag + actionsHtml);
  document.getElementById("shortlist-detail-offer").onclick = () => openOfferModal(leagueKey, otherTeam.id, p.id);
  document.getElementById("shortlist-detail-compare").onclick = () => { toggleCompare(p.id); renderShortlistDetail(); };
  document.getElementById("shortlist-detail-remove").onclick = () => toggleShortlist(p.id);
}

// ----------------- COMPARATEUR DE JOUEURS -----------------
// Jusqu'à 2 joueurs sélectionnés (id seulement, comme la shortlist — résolus à chaque rendu via
// findPlayerAnywhere pour rester valides même après un transfert IA). Purement une aide à la
// décision côté UI : pas persisté dans STATE/la sauvegarde, se réinitialise au rechargement.
let compareIds = [];

function toggleCompare(playerId) {
  const idx = compareIds.indexOf(playerId);
  if (idx !== -1) {
    compareIds.splice(idx, 1);
  } else {
    compareIds.push(playerId);
    if (compareIds.length > 2) compareIds.shift(); // remplace le plus ancien (FIFO) au-delà de 2
  }
  const team = getUserTeam();
  renderCompareTray();
  renderMarketTable(team);
  renderShortlistTable(team);
}

function renderCompareTray() {
  const tray = document.getElementById("compare-tray");
  const slots = document.getElementById("compare-tray-slots");
  const openBtn = document.getElementById("btn-open-compare");
  // nettoie les entrées obsolètes (joueur introuvable — ne devrait pas arriver, filet de sécurité
  // identique à celui de la shortlist)
  compareIds = compareIds.filter(id => findPlayerAnywhere(id));
  tray.style.display = compareIds.length ? "flex" : "none";
  slots.innerHTML = compareIds.map(id => {
    const found = findPlayerAnywhere(id);
    return `<span class="compare-chip">
      <span class="pos-tag pos-${found.p.pos}">${found.p.pos}</span> ${found.p.name}
      <button class="compare-chip-remove" data-player="${id}" title="Retirer">×</button>
    </span>`;
  }).join("");
  slots.querySelectorAll(".compare-chip-remove").forEach(btn => {
    btn.onclick = () => toggleCompare(btn.dataset.player);
  });
  openBtn.disabled = compareIds.length !== 2;
}

// Ligne du tableau de comparaison : met en évidence la meilleure valeur (vert) / la moins bonne
// (rouge) entre les deux joueurs — higherBetter=null pour une stat purement informative (Âge,
// Valeur) qui n'a pas de "meilleur" objectif. displayA/B permettent un affichage formaté
// (formatMoney, "-" si aucun match...) distinct de la valeur numérique brute utilisée pour comparer.
function compareRowHTML(label, rawA, rawB, higherBetter, displayA, displayB) {
  displayA = displayA !== undefined ? displayA : rawA;
  displayB = displayB !== undefined ? displayB : rawB;
  let clsA = "", clsB = "";
  if (higherBetter !== null && rawA !== rawB) {
    const aWins = higherBetter ? rawA > rawB : rawA < rawB;
    clsA = aWins ? "compare-better" : "compare-worse";
    clsB = aWins ? "compare-worse" : "compare-better";
  }
  return `<div class="compare-row">
    <span class="compare-value ${clsA}">${displayA}</span>
    <span class="compare-label">${label}</span>
    <span class="compare-value ${clsB}">${displayB}</span>
  </div>`;
}

function buildCompareModalHTML(pA, teamA, pB, teamB) {
  const avgA = pA.matches > 0 ? pA.ratingSum / pA.matches : -1;
  const avgB = pB.matches > 0 ? pB.ratingSum / pB.matches : -1;
  const cmA = pA.careerMatches || 0, cmB = pB.careerMatches || 0;
  const cAvgA = cmA > 0 ? pA.careerRatingSum / cmA : -1;
  const cAvgB = cmB > 0 ? pB.careerRatingSum / cmB : -1;

  const headerCol = (p, t) => `
    <div class="compare-player-col">
      <div class="compare-photo">
        <div class="player-photo-fallback-lg">${playerInitials(p.name)}</div>
        <img src="${playerPhotoUrl(p, t)}" alt="" class="player-photo-lg"
          onload="this.style.display='block'; this.previousElementSibling.style.display='none';"
          onerror="this.style.display='none';">
      </div>
      <span class="pos-tag pos-${p.pos}">${p.pos}</span>
      <div class="compare-player-name">${p.name}</div>
      <div class="player-card-club" style="justify-content:center;">${renderTeamCrest(t, "crest-sm")}<span>${t.name}</span></div>
      ${renderStarRating(p.overall)}
    </div>`;

  return `
    <div class="compare-header">
      ${headerCol(pA, teamA)}
      <div class="compare-vs">VS</div>
      ${headerCol(pB, teamB)}
    </div>
    <div class="compare-rows">
      ${compareRowHTML("Note globale", pA.overall, pB.overall, true)}
      ${compareRowHTML("Vitesse", pA.speed, pB.speed, true)}
      ${compareRowHTML("Technique", pA.technique, pB.technique, true)}
      ${compareRowHTML("Physique", pA.physical, pB.physical, true)}
      ${compareRowHTML("Mental", pA.mental, pB.mental, true)}
      ${compareRowHTML("Forme", pA.form, pB.form, true)}
      ${compareRowHTML("Âge", pA.age, pB.age, null)}
      ${compareRowHTML("Valeur", pA.value, pB.value, null, formatMoney(pA.value), formatMoney(pB.value))}
      ${compareRowHTML("Buts (saison)", pA.goals, pB.goals, true)}
      ${compareRowHTML("Passes (saison)", pA.assists, pB.assists, true)}
      ${compareRowHTML("Note (saison)", avgA, avgB, true, avgA < 0 ? "-" : avgA.toFixed(1), avgB < 0 ? "-" : avgB.toFixed(1))}
      ${compareRowHTML("Matchs (carrière)", cmA, cmB, true)}
      ${compareRowHTML("Buts (carrière)", pA.careerGoals || 0, pB.careerGoals || 0, true)}
      ${compareRowHTML("Passes (carrière)", pA.careerAssists || 0, pB.careerAssists || 0, true)}
      ${compareRowHTML("Note (carrière)", cAvgA, cAvgB, true, cAvgA < 0 ? "-" : cAvgA.toFixed(1), cAvgB < 0 ? "-" : cAvgB.toFixed(1))}
    </div>`;
}

function openCompareModal() {
  if (compareIds.length !== 2) return;
  const [foundA, foundB] = compareIds.map(findPlayerAnywhere);
  if (!foundA || !foundB) return;
  document.getElementById("compare-body").innerHTML = buildCompareModalHTML(foundA.p, foundA.team, foundB.p, foundB.team);
  document.getElementById("compare-modal").classList.add("active");
}

function closeCompareModal() {
  document.getElementById("compare-modal").classList.remove("active");
}

// Vendre un joueur se fait maintenant directement depuis l'onglet Effectif (voir renderSquadTab)
// plutôt que via une table dédiée dans le Mercato.
function sellPlayer(playerId) {
  const team = getUserTeam();
  if (team.players.length <= 7) {
    showAlert("Tu ne peux pas descendre en dessous de 7 joueurs !");
    return;
  }
  const player = team.players.find(p => p.id === playerId);
  showConfirm(`Vendre ${player.name} pour ${formatMoney(player.value)} ?`, () => {
    team.players = team.players.filter(p => p.id !== playerId);
    team.budget += player.value;
    // le joueur rejoint l'équipe IA la plus faible à son poste plutôt que de disparaître du jeu
    const buyer = neediestTeamForPosition(STATE.league, player.pos, team.id);
    if (buyer) {
      buyer.budget -= player.value;
      buyer.players.push(player);
    }
    logTransferEvents([{
      type: "transfer", playerId: player.id, playerName: player.name, pos: player.pos,
      fromTeamId: team.id, fromTeamName: team.name,
      toTeamId: buyer ? buyer.id : null, toTeamName: buyer ? buyer.name : null,
      amount: player.value
    }], STATE.leagueKey, STATE.leagueKey);
    updateTopbar();
    renderSquadTab();
    saveGame();
  }, { title: "Vendre ce joueur ?", confirmLabel: "Vendre" });
}

let currentOffer = null;

function openOfferModal(leagueKey, otherTeamId, playerId) {
  // garde-fou : même si l'UI est restée affichée après la fermeture du mercato (l'utilisateur
  // était sur l'onglet Mercato quand la fenêtre s'est refermée), aucune offre ne doit passer.
  if (!STATE.mercatoOpen) {
    showAlert("Le mercato est fermé — reviens pendant une fenêtre de transferts pour faire une offre.");
    return;
  }
  const otherTeam = findLeagueTeam(leagueKey, otherTeamId);
  const player = otherTeam.players.find(p => p.id === playerId);
  currentOffer = { leagueKey, otherTeamId, playerId };

  document.getElementById("offer-title").textContent = `Offre pour ${player.name}`;
  document.getElementById("offer-text").textContent = `${player.name} (${player.pos}) — ${otherTeam.name}. Valeur estimée : ${formatMoney(player.value)}. Ton budget : ${formatMoney(getUserTeam().budget)}`;
  document.getElementById("offer-amount").value = player.value;
  document.getElementById("offer-result").textContent = "";
  document.getElementById("offer-submit").disabled = false;
  document.getElementById("offer-modal").classList.add("active");
}

function submitOffer() {
  const { leagueKey, otherTeamId, playerId } = currentOffer;
  const otherTeam = findLeagueTeam(leagueKey, otherTeamId);
  const player = otherTeam.players.find(p => p.id === playerId);
  const team = getUserTeam();
  const amount = parseFloat(document.getElementById("offer-amount").value);
  const resultEl = document.getElementById("offer-result");

  // le joueur a déjà été transféré (double clic sur "Proposer" pendant le délai avant fermeture
  // automatique de la modale) : il n'y a plus rien à proposer, on referme simplement.
  if (!player) { closeOfferModal(); return; }

  if (!STATE.mercatoOpen) { resultEl.textContent = "Le mercato est fermé."; return; }
  if (!amount || amount <= 0) { resultEl.textContent = "Montant invalide."; return; }
  if (amount > team.budget) { resultEl.textContent = "Tu n'as pas assez de budget !"; return; }
  if (otherTeam.players.length <= 7) { resultEl.textContent = `${otherTeam.name} ne peut pas vendre, effectif trop juste.`; return; }

  // probabilité d'acceptation selon offre/valeur
  const ratio = amount / player.value;
  let acceptChance;
  if (ratio >= 1.15) acceptChance = 0.95;
  else if (ratio >= 1.0) acceptChance = 0.7;
  else if (ratio >= 0.85) acceptChance = 0.35;
  else acceptChance = 0.08;

  if (Math.random() < acceptChance) {
    // transfert accepté — on bloque le bouton le temps du délai avant fermeture pour éviter
    // qu'un second clic ne retente l'offre sur un joueur déjà transféré (cf. garde ci-dessus)
    document.getElementById("offer-submit").disabled = true;
    team.budget -= amount;
    otherTeam.budget += amount;
    otherTeam.players = otherTeam.players.filter(p => p.id !== player.id);
    team.players.push(player);
    const shortlistIdx = STATE.shortlist.indexOf(player.id);
    if (shortlistIdx !== -1) STATE.shortlist.splice(shortlistIdx, 1);
    logTransferEvents([{
      type: "transfer", playerId: player.id, playerName: player.name, pos: player.pos,
      fromTeamId: otherTeam.id, fromTeamName: otherTeam.name, toTeamId: team.id, toTeamName: team.name,
      amount
    }], leagueKey, STATE.leagueKey);
    resultEl.style.color = "#ffc700";
    resultEl.textContent = `Transfert accepté ! ${player.name} rejoint ${team.name}.`;
    updateTopbar();
    saveGame();
    setTimeout(() => { closeOfferModal(); renderTransfersTab(); }, 1200);
  } else if (ratio < 1.0) {
    // contre-offre
    const counter = Math.round(player.value * (1 + Math.random() * 0.2));
    resultEl.style.color = "#ffaa00";
    resultEl.textContent = `${otherTeam.name} refuse mais propose une contre-offre à ${formatMoney(counter)}.`;
    document.getElementById("offer-amount").value = counter;
  } else {
    resultEl.style.color = "#ff4444";
    resultEl.textContent = `${otherTeam.name} refuse cette offre.`;
  }
}

function closeOfferModal() {
  document.getElementById("offer-modal").classList.remove("active");
  currentOffer = null;
}

// ===================== TACTIQUE (terrain partagé) =====================
let lineupSetup = null;
let tacticsSetup = null;

// Choisit automatiquement les meilleurs joueurs disponibles pour chaque poste de la formation
function autoAssignFormation(formationKey) {
  const team = getUserTeam();
  const slots = FORMATION_SLOTS[formationKey];
  const used = new Set();
  return slots.map(slot => {
    const candidates = team.players
      .filter(p => p.pos === slot.pos && !used.has(p.id))
      .sort((a, b) => b.overall - a.overall);
    if (candidates.length > 0) {
      used.add(candidates[0].id);
      return candidates[0].id;
    }
    return null;
  });
}

// Lors d'un changement de formation, conserve les joueurs déjà placés par poste
function remapAssignmentsTo(team, oldFormationKey, oldAssignments, newFormationKey) {
  const oldSlots = FORMATION_SLOTS[oldFormationKey];
  const newSlots = FORMATION_SLOTS[newFormationKey];
  const starters = oldAssignments.filter(Boolean);

  // joueurs déjà assignés, regroupés par poste
  const byPos = { GK: [], DEF: [], MID: [], ATT: [] };
  oldSlots.forEach((slot, i) => {
    if (oldAssignments[i]) byPos[slot.pos].push(oldAssignments[i]);
  });

  const used = new Set();
  const result = newSlots.map(slot => {
    const pool = byPos[slot.pos] || [];
    const playerId = pool.find(id => !used.has(id));
    if (playerId) used.add(playerId);
    return playerId || null;
  });

  // les deux formations n'ont pas forcément la même répartition par poste (ex. 2 ATT vs 1 ATT) :
  // les titulaires excédentaires s'adaptent aux postes restants plutôt que d'être remplacés par le banc.
  const leftoverStarters = starters.filter(id => !used.has(id));
  result.forEach((id, i) => {
    if (id || leftoverStarters.length === 0) return;
    const playerId = leftoverStarters.shift();
    used.add(playerId);
    result[i] = playerId;
  });

  // dernier recours (XI incomplet) : complète avec les meilleurs joueurs du banc disponibles
  newSlots.forEach((slot, i) => {
    if (result[i]) return;
    const candidates = team.players
      .filter(p => p.pos === slot.pos && !used.has(p.id))
      .sort((a, b) => b.overall - a.overall);
    if (candidates.length > 0) {
      used.add(candidates[0].id);
      result[i] = candidates[0].id;
    }
  });

  return result;
}

function remapAssignments(setup, newFormationKey) {
  return remapAssignmentsTo(getUserTeam(), setup.formation, setup.assignments, newFormationKey);
}

// Vérifie/répare une composition sauvegardée pour un jeu de slots donné (joueurs vendus,
// doublons, postes incompatibles...), en complétant les postes vides avec les meilleurs
// joueurs disponibles de l'effectif.
function sanitizeAssignments(team, slots, rawAssignments) {
  const validIds = new Set(team.players.map(p => p.id));
  const used = new Set();

  let assignments = Array.isArray(rawAssignments) ? rawAssignments.slice(0, slots.length) : [];
  while (assignments.length < slots.length) assignments.push(null);

  assignments = assignments.map((id, i) => {
    if (id && validIds.has(id) && !used.has(id)) {
      const player = team.players.find(p => p.id === id);
      if (ELIGIBLE_POS[player.pos].includes(slots[i].pos)) {
        used.add(id);
        return id;
      }
    }
    return null;
  });

  slots.forEach((slot, i) => {
    if (assignments[i]) return;
    const candidates = team.players
      .filter(p => p.pos === slot.pos && !used.has(p.id))
      .sort((a, b) => b.overall - a.overall);
    if (candidates.length > 0) {
      used.add(candidates[0].id);
      assignments[i] = candidates[0].id;
    }
  });

  return assignments;
}

// Vérifie/répare une tactique sauvegardée (joueurs vendus, formation invalide...)
function sanitizeTactic(tactic) {
  const team = getUserTeam();
  const formation = (tactic && FORMATION_SLOTS[tactic.formation]) ? tactic.formation : "1-2-2-2";
  const slots = FORMATION_SLOTS[formation];
  const assignments = sanitizeAssignments(team, slots, tactic && tactic.assignments);

  const formationOOP = (tactic && FORMATION_SLOTS[tactic.formationOOP]) ? tactic.formationOOP : formation;
  const oopSlots = FORMATION_SLOTS[formationOOP];
  // par défaut, la disposition "sans balle" reprend les mêmes titulaires que "avec balle" ;
  // si elle a déjà été personnalisée (postes choisis via les carrés de l'effectif), on la conserve.
  const assignmentsOOP = (tactic && Array.isArray(tactic.assignmentsOOP))
    ? sanitizeAssignments(team, oopSlots, tactic.assignmentsOOP)
    : remapAssignmentsTo(team, formation, assignments, formationOOP);

  return {
    formation,
    assignments,
    attackPlan: (tactic && ATTACK_PLANS[tactic.attackPlan]) ? tactic.attackPlan : "possession",
    defensePlan: (tactic && DEFENSE_PLANS[tactic.defensePlan]) ? tactic.defensePlan : "zone",
    formationOOP,
    assignmentsOOP,
    // Vue du plateau tactique : "in" (avec balle), "out" (sans balle) ou "both" (les deux)
    viewMode: (tactic && VIEW_MODES.includes(tactic.viewMode)) ? tactic.viewMode : "in"
  };
}

const VIEW_MODES = ["in", "out", "both"];

function getSavedTacticOrDefault() {
  return sanitizeTactic(STATE.savedTactic);
}

// Sauvegarde la tactique courante comme tactique par défaut.
// Seul l'onglet Tactique (setup.persist === true) modifie la tactique par défaut : les
// changements faits en préparation d'avant-match ou en plein match (lineupSetup) ne valent
// que pour le match en cours et ne doivent jamais écraser la tactique sauvegardée.
function saveTactic(setup) {
  if (!setup.persist) return;
  STATE.savedTactic = {
    formation: setup.formation,
    assignments: [...setup.assignments],
    attackPlan: setup.attackPlan,
    defensePlan: setup.defensePlan,
    formationOOP: setup.formationOOP || setup.formation,
    assignmentsOOP: [...setup.assignmentsOOP],
    viewMode: setup.viewMode || "in"
  };
  saveGame();
}

function renderFormationChoice(setup, ids) {
  const container = document.getElementById(ids.formation);
  container.innerHTML = "";
  Object.entries(FORMATIONS).forEach(([key, f]) => {
    const div = document.createElement("div");
    div.className = "option-card" + (setup.formation === key ? " selected" : "");
    div.innerHTML = `<h4>${f.name}</h4><p>${f.gk} GK / ${f.def} DEF / ${f.mid} MID / ${f.att} ATT</p>`;
    div.onclick = () => {
      if (setup.formation === key) return;
      setup.assignments = remapAssignments(setup, key);
      setup.formation = key;
      setup.selectedSlot = null;
      renderFormationChoice(setup, ids);
      renderPitch(setup, ids);
      renderBench(setup, ids);
      renderOOPSection(setup, ids);
      if (ids.count) updateLineupCount(setup, ids);
      saveTactic(setup);
    };
    container.appendChild(div);
  });
}

// Détermine le côté d'un emplacement (gauche/droit/axial) à partir de sa position sur le terrain,
// pour distinguer par ex. un défenseur central droit d'un défenseur central gauche.
const SLOT_POS_NAME = { GK: "Gardien", DEF: "Défenseur", MID: "Milieu", ATT: "Attaquant" };
function slotSide(slot) {
  if (slot.x < 45) return "G";
  if (slot.x > 55) return "D";
  return "C";
}
function slotShortTag(slot) {
  const side = slotSide(slot);
  return (slot.pos === "GK" || side === "C") ? slot.pos : `${slot.pos} (${side})`;
}
function slotRoleLabel(slot) {
  const side = slotSide(slot);
  if (slot.pos === "GK" || side === "C") return SLOT_POS_NAME[slot.pos];
  return `${SLOT_POS_NAME[slot.pos]} ${side === "D" ? "droit" : "gauche"}`;
}

// Affiche le terrain avec les 7 emplacements de la formation actuelle
function renderPitch(setup, ids) {
  const team = getUserTeam();
  const slots = FORMATION_SLOTS[setup.formation];
  const container = document.getElementById(ids.pitch);
  container.innerHTML = "";

  slots.forEach((slot, i) => {
    const playerId = setup.assignments[i];
    const player = playerId ? team.players.find(p => p.id === playerId) : null;

    const div = document.createElement("div");
    div.className = "pitch-slot pos-" + slot.pos + (player ? " filled" : " empty") + (setup.selectedSlot === i ? " selected" : "");
    div.style.left = slot.x + "%";
    div.style.top = slot.y + "%";

    div.title = slotRoleLabel(slot);
    if (player) {
      div.innerHTML = `<span class="slot-tag pos-${slot.pos}">${slotShortTag(slot)}</span>
        <span class="slot-name">${player.name}</span>
        ${renderStarRating(player.overall)}`;
    } else {
      div.innerHTML = `<span class="slot-tag pos-${slot.pos}">${slotShortTag(slot)}</span>
        <span class="slot-empty">Vide</span>`;
    }

    div.onclick = () => selectSlot(setup, ids, i);
    container.appendChild(div);
  });
}

// Affiche le banc / effectif complet. Chaque joueur a deux carrés cliquables : un pour choisir
// son poste "avec balle" et un pour son poste "sans balle" (indépendants l'un de l'autre).
function renderBench(setup, ids) {
  const team = getUserTeam();
  const container = document.getElementById(ids.bench);
  container.innerHTML = "";

  const sorted = [...team.players].sort((a, b) => POS_ORDER[a.pos] - POS_ORDER[b.pos] || b.overall - a.overall);
  sorted.forEach(p => {
    const isStarter = setup.assignments.includes(p.id);
    const inIdx = setup.assignments.indexOf(p.id);
    const outIdx = setup.assignmentsOOP.indexOf(p.id);
    const inTag = inIdx >= 0 ? slotShortTag(FORMATION_SLOTS[setup.formation][inIdx]) : "–";
    const outTag = outIdx >= 0 ? slotShortTag(FORMATION_SLOTS[setup.formationOOP][outIdx]) : "–";

    // un joueur blessé ne peut pas être ajouté à la composition (mais reste retirable normalement
    // s'il y était déjà — cas rare où il se blesse en cours de saison alors qu'il était titulaire
    // d'un plan sauvegardé) ; reste visible dans la liste, juste non cliquable, pour que l'utilisateur
    // comprenne pourquoi il ne peut pas le sélectionner plutôt que de le voir disparaître.
    const blocked = p.injured && !isStarter;

    const row = document.createElement("div");
    row.className = "player-row" + (isStarter ? " selected" : "") + (blocked ? " player-row-injured" : "");
    const injuryBadge = p.injured
      ? `<span class="injury-badge" title="Blessure ${p.injurySeverity} — indisponible encore ${p.injuryDaysLeft} jour(s)">🩹 ${p.injuryDaysLeft}j</span>`
      : "";
    row.innerHTML = `<div><span class="pos-tag pos-${p.pos}">${p.pos}</span>${renderOverallBadge(p.overall)} <b>${p.name}</b> ${injuryBadge}
      <div class="stats">Vit ${p.speed} | Tec ${p.technique} | Phy ${p.physical} | Men ${p.mental} | Forme ${p.form}</div></div>
      <div class="player-row-right">
        ${renderRatingChip(p)}
        <div class="player-phase-squares">
          <button type="button" class="phase-square phase-in${inIdx >= 0 ? " filled" : ""}" title="Poste avec balle"${blocked ? " disabled" : ""}>${inTag}</button>
          <button type="button" class="phase-square phase-out${outIdx >= 0 ? " filled" : ""}" title="Poste sans balle"${blocked ? " disabled" : ""}>${outTag}</button>
        </div>
      </div>`;
    if (blocked) {
      row.title = `Blessé (${p.injurySeverity}) — indisponible encore ${p.injuryDaysLeft} jour(s)`;
    } else {
      row.querySelector(".phase-in").onclick = (e) => {
        e.stopPropagation();
        showPositionPicker(setup, ids, p, row, "in");
      };
      row.querySelector(".phase-out").onclick = (e) => {
        e.stopPropagation();
        showPositionPicker(setup, ids, p, row, "out");
      };
      row.onclick = () => handlePlayerClick(setup, ids, p, row);
    }
    container.appendChild(row);
  });
}

// Affiche un sélecteur de postes cliquable (GK, DEF (D), DEF (G), ...) pour le poste "avec
// balle" (phase "in") ou "sans balle" (phase "out") d'un joueur, qu'ils soient libres ou déjà
// occupés par un autre titulaire (choisir un poste occupé renvoie son titulaire au banc).
function closePositionPicker() {
  const existing = document.getElementById("active-position-picker");
  if (existing) existing.remove();
}

function showPositionPicker(setup, ids, player, rowEl, phase) {
  closePositionPicker();
  const team = getUserTeam();
  const formationKey = phase === "out" ? setup.formationOOP : setup.formation;
  const assignments = phase === "out" ? setup.assignmentsOOP : setup.assignments;
  const slots = FORMATION_SLOTS[formationKey];
  const eligible = ELIGIBLE_POS[player.pos];
  const slotIndices = slots.reduce((acc, slot, i) => {
    if (eligible.includes(slot.pos)) acc.push(i);
    return acc;
  }, []);

  const picker = document.createElement("div");
  picker.id = "active-position-picker";
  picker.className = "position-picker";

  slotIndices.forEach(i => {
    const occupantId = assignments[i];
    const occupant = occupantId ? team.players.find(pl => pl.id === occupantId) : null;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "position-picker-btn" + (occupantId === player.id ? " current" : "");
    btn.innerHTML = `<span class="position-picker-tag">${slotShortTag(slots[i])}</span>
      <span class="position-picker-occupant">${occupant ? occupant.name : "Vide"}</span>`;
    btn.title = slotRoleLabel(slots[i]);
    btn.onclick = (e) => {
      e.stopPropagation();
      assignments[i] = player.id;
      closePositionPicker();
      applyAssignmentChange(setup, ids, phase);
    };
    picker.appendChild(btn);
  });

  if (assignments.includes(player.id)) {
    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "position-picker-btn position-picker-remove";
    removeBtn.textContent = "🪑 Banc";
    removeBtn.onclick = (e) => {
      e.stopPropagation();
      assignments[assignments.indexOf(player.id)] = null;
      closePositionPicker();
      applyAssignmentChange(setup, ids, phase);
    };
    picker.appendChild(removeBtn);
  }

  rowEl.appendChild(picker);
  // attaché après la fin du clic courant pour ne pas se fermer immédiatement
  setTimeout(() => document.addEventListener("click", closePositionPicker, { once: true }), 0);
}

// Les titulaires doivent être les mêmes 7 joueurs avec et sans ballon (seul leur poste peut
// différer) : après une modification côté `changedPhase` ("in" = avec balle, "out" = sans
// balle), répercute l'ajout/retrait d'un joueur sur l'autre phase, en conservant les postes déjà
// choisis pour tous les joueurs non concernés par le changement.
function syncStartersAcrossPhases(setup, changedPhase) {
  const team = getUserTeam();
  const sourceAssignments = changedPhase === "out" ? setup.assignmentsOOP : setup.assignments;
  const targetAssignments = changedPhase === "out" ? setup.assignments : setup.assignmentsOOP;
  const targetFormationKey = changedPhase === "out" ? setup.formation : setup.formationOOP;
  const targetSlots = FORMATION_SLOTS[targetFormationKey];
  const sourceIds = new Set(sourceAssignments.filter(Boolean));

  // libère côté opposé les emplacements des joueurs qui ne sont plus titulaires côté modifié
  targetAssignments.forEach((id, i) => {
    if (id && !sourceIds.has(id)) targetAssignments[i] = null;
  });

  // place côté opposé les nouveaux titulaires absents de ce côté : uniquement dans des
  // emplacements vides (jamais en délogeant un joueur qui doit lui aussi rester), en
  // privilégiant un poste compatible avant de se contenter du premier emplacement libre.
  const missing = [...sourceIds].filter(id => !targetAssignments.includes(id));
  missing.forEach(id => {
    const player = team.players.find(p => p.id === id);
    if (!player) return;
    let slotIndex = targetSlots.findIndex((slot, i) => !targetAssignments[i] && ELIGIBLE_POS[player.pos].includes(slot.pos));
    if (slotIndex === -1) slotIndex = targetAssignments.findIndex(a => !a);
    if (slotIndex !== -1) targetAssignments[slotIndex] = id;
  });
}

function applyAssignmentChange(setup, ids, changedPhase) {
  syncStartersAcrossPhases(setup, changedPhase || "in");
  renderPitch(setup, ids);
  renderBench(setup, ids);
  renderOOPSection(setup, ids);
  if (ids.count) updateLineupCount(setup, ids);
  saveTactic(setup);
}

function selectSlot(setup, ids, i) {
  setup.selectedSlot = (setup.selectedSlot === i) ? null : i;
  renderPitch(setup, ids);
}

// Affiche le plateau tactique selon la vue choisie : "avec ballon", "sans ballon" ou "les deux"
// en même temps. Chaque joueur a un poste indépendant pour chaque phase (choisi via les carrés
// de l'effectif dans renderBench) ; par défaut la disposition "sans balle" reprend les mêmes
// titulaires que "avec balle", mais peut être personnalisée librement.
const VIEW_MODE_LABELS = { in: "⚽ Avec ballon", out: "🚫 Sans ballon", both: "🔀 Les deux" };

function renderOOPSection(setup, ids) {
  if (!ids.viewMode) return;
  const pitchEl = document.getElementById(ids.pitch);
  const iopWrap = pitchEl.closest(".iop-wrap");
  const pitchRow = pitchEl.closest(".tactics-pitch-row");
  const panel = document.getElementById(ids.oopPanel);
  const formationWrap = document.getElementById(ids.oopFormationWrap);
  const formationContainer = document.getElementById(ids.oopFormation);
  const viewModeContainer = document.getElementById(ids.viewMode);

  viewModeContainer.innerHTML = "";
  VIEW_MODES.forEach(mode => {
    const div = document.createElement("div");
    div.className = "option-card" + (setup.viewMode === mode ? " selected" : "");
    div.innerHTML = `<h4>${VIEW_MODE_LABELS[mode]}</h4>`;
    div.onclick = () => {
      setup.viewMode = mode;
      saveTactic(setup);
      renderOOPSection(setup, ids);
    };
    viewModeContainer.appendChild(div);
  });

  const showIn = setup.viewMode !== "out";
  const showOut = setup.viewMode !== "in";
  if (iopWrap) iopWrap.style.display = showIn ? "" : "none";
  panel.style.display = showOut ? "flex" : "none";
  formationWrap.style.display = showOut ? "flex" : "none";
  if (pitchRow) {
    pitchRow.classList.toggle("oop-only", showOut && !showIn);
    pitchRow.classList.toggle("view-both", showIn && showOut);
  }

  if (!showOut) return;

  const oopFormation = (setup.formationOOP && FORMATION_SLOTS[setup.formationOOP]) ? setup.formationOOP : setup.formation;
  formationContainer.innerHTML = "";
  Object.entries(FORMATIONS).forEach(([key, f]) => {
    const div = document.createElement("div");
    div.className = "option-card" + (oopFormation === key ? " selected" : "");
    div.innerHTML = `<h4>${f.name}</h4>`;
    div.onclick = () => {
      if (setup.formationOOP === key) return;
      setup.assignmentsOOP = remapAssignmentsTo(getUserTeam(), setup.formationOOP, setup.assignmentsOOP, key);
      setup.formationOOP = key;
      saveTactic(setup);
      renderBench(setup, ids);
      renderOOPSection(setup, ids);
    };
    formationContainer.appendChild(div);
  });

  // aperçu : reflète les postes "sans balle" choisis pour chaque joueur (carrés de l'effectif)
  const team = getUserTeam();
  const slots = FORMATION_SLOTS[oopFormation];
  const oopAssignments = setup.assignmentsOOP;
  const oopPitchEl = document.getElementById(ids.oopPitch);
  oopPitchEl.innerHTML = "";
  slots.forEach((slot, i) => {
    const playerId = oopAssignments[i];
    const player = playerId ? team.players.find(p => p.id === playerId) : null;
    const div = document.createElement("div");
    div.className = "pitch-slot pitch-slot-mini pos-" + slot.pos + (player ? " filled" : " empty");
    div.style.left = slot.x + "%";
    div.style.top = slot.y + "%";
    div.title = slotRoleLabel(slot);
    div.innerHTML = player
      ? `<span class="slot-tag pos-${slot.pos}">${slotShortTag(slot)}</span><span class="slot-name">${player.name}</span>`
      : `<span class="slot-tag pos-${slot.pos}">${slotShortTag(slot)}</span>`;
    oopPitchEl.appendChild(div);
  });
}

// Gère le clic sur un joueur du banc/effectif : assignation, échange ou retrait
function handlePlayerClick(setup, ids, p, rowEl) {
  const slots = FORMATION_SLOTS[setup.formation];
  const assignments = setup.assignments;
  const currentIdx = assignments.indexOf(p.id);
  closePositionPicker();

  if (setup.selectedSlot !== null) {
    const slot = slots[setup.selectedSlot];
    if (!ELIGIBLE_POS[p.pos].includes(slot.pos)) {
      showAlert(`Ce poste nécessite un joueur "${slot.pos}" (${slotRoleLabel(slot)}).`);
      return;
    }
    if (currentIdx >= 0) {
      // échange avec le joueur déjà sur le slot sélectionné, s'il peut occuper l'ancien poste de p
      const tmp = assignments[setup.selectedSlot];
      const tmpPlayer = tmp ? getUserTeam().players.find(pl => pl.id === tmp) : null;
      assignments[setup.selectedSlot] = p.id;
      assignments[currentIdx] = (tmpPlayer && ELIGIBLE_POS[tmpPlayer.pos].includes(slots[currentIdx].pos)) ? tmp : null;
    } else {
      assignments[setup.selectedSlot] = p.id;
    }
    setup.selectedSlot = null;
  } else if (currentIdx >= 0) {
    // retire le joueur titulaire vers le banc
    assignments[currentIdx] = null;
  } else {
    // s'il y a plusieurs emplacements compatibles avec ce joueur (poste habituel + postes
    // voisins qu'il peut couvrir, ex. DEF (D) et DEF (G) mais aussi MID), libres ou déjà
    // occupés, l'utilisateur choisit lequel via le sélecteur de poste.
    const eligible = ELIGIBLE_POS[p.pos];
    const sameIndices = slots.reduce((acc, slot, i) => {
      if (eligible.includes(slot.pos)) acc.push(i);
      return acc;
    }, []);
    if (sameIndices.length === 0) {
      showAlert("Aucun poste libre pour cette position. Sélectionne d'abord un emplacement sur le terrain.");
      return;
    } else if (sameIndices.length === 1) {
      assignments[sameIndices[0]] = p.id;
    } else {
      // plusieurs emplacements compatibles : affiche un sélecteur cliquable (GK, DEF (D), DEF (G)...)
      showPositionPicker(setup, ids, p, rowEl, "in");
      return;
    }
  }

  applyAssignmentChange(setup, ids, "in");
}

function updateLineupCount(setup, ids) {
  const filled = setup.assignments.filter(Boolean).length;
  document.getElementById(ids.count).textContent = filled;
  const team = getUserTeam();
  const hasGK = setup.assignments.some(id => id && team.players.find(p => p.id === id).pos === "GK");
  document.getElementById("btn-play-match").disabled = !(filled === 7 && hasGK);
}

function renderPlanChoices(setup, ids) {
  const atkContainer = document.getElementById(ids.attack);
  atkContainer.innerHTML = "";
  Object.entries(ATTACK_PLANS).forEach(([key, plan]) => {
    const div = document.createElement("div");
    div.className = "option-card" + (setup.attackPlan === key ? " selected" : "");
    div.innerHTML = `<h4>${plan.name}</h4><p>${plan.desc}</p>`;
    div.onclick = () => { setup.attackPlan = key; renderPlanChoices(setup, ids); saveTactic(setup); };
    atkContainer.appendChild(div);
  });

  const defContainer = document.getElementById(ids.defense);
  defContainer.innerHTML = "";
  Object.entries(DEFENSE_PLANS).forEach(([key, plan]) => {
    const div = document.createElement("div");
    div.className = "option-card" + (setup.defensePlan === key ? " selected" : "");
    div.innerHTML = `<h4>${plan.name}</h4><p>${plan.desc}</p>`;
    div.onclick = () => { setup.defensePlan = key; renderPlanChoices(setup, ids); saveTactic(setup); };
    defContainer.appendChild(div);
  });
}

// IDs des éléments DOM pour chaque écran utilisant le plateau tactique
const LINEUP_IDS = { formation: "formation-choice", pitch: "pitch-field", bench: "bench-list", attack: "attack-plan-choice", defense: "defense-plan-choice", count: "lineup-count", viewMode: "lineup-view-mode-choice", oopFormation: "lineup-oop-formation-choice", oopFormationWrap: "lineup-oop-formation-wrap", oopPanel: "lineup-oop-panel", oopPitch: "lineup-oop-pitch-field" };
const TACTICS_IDS = { formation: "tactics-formation-choice", pitch: "tactics-pitch-field", bench: "tactics-bench-list", attack: "tactics-attack-plan-choice", defense: "tactics-defense-plan-choice", viewMode: "tactics-view-mode-choice", oopFormation: "tactics-oop-formation-choice", oopFormationWrap: "tactics-oop-formation-wrap", oopPanel: "tactics-oop-panel", oopPitch: "tactics-oop-pitch-field" };

// ===================== SÉLECTION DU XI (avant match) =====================
function openLineupScreen() {
  const team = getUserTeam();
  const round = STATE.schedule[STATE.currentRound];
  const userMatch = round.find(m => m.home === team.id || m.away === team.id);
  const isHome = userMatch.home === team.id;
  const opponent = STATE.league.teams.find(t => t.id === (isHome ? userMatch.away : userMatch.home));

  const tactic = getSavedTacticOrDefault();
  lineupSetup = {
    lineup: [], formation: tactic.formation, attackPlan: tactic.attackPlan, defensePlan: tactic.defensePlan,
    isHome, opponentId: opponent.id, userMatch,
    assignments: tactic.assignments, selectedSlot: null,
    formationOOP: tactic.formationOOP, assignmentsOOP: tactic.assignmentsOOP, viewMode: tactic.viewMode
  };

  document.getElementById("lineup-match-info").innerHTML =
    `<h3>${isHome ? team.name + " (Domicile)" : opponent.name + " (Domicile)"} vs ${isHome ? opponent.name : team.name + " (Extérieur)"}</h3>
     <p style="color:#aaa; margin-top:5px;">Place tes joueurs sur le terrain et choisis tes plans tactiques.</p>`;

  renderFormationChoice(lineupSetup, LINEUP_IDS);
  renderPitch(lineupSetup, LINEUP_IDS);
  renderBench(lineupSetup, LINEUP_IDS);
  renderOOPSection(lineupSetup, LINEUP_IDS);
  renderPlanChoices(lineupSetup, LINEUP_IDS);
  updateLineupCount(lineupSetup, LINEUP_IDS);
  renderSecretCardChoice(lineupSetup);

  showScreen("screen-lineup");
}

// Même écran de composition que pour un match de championnat, mais l'adversaire peut appartenir
// à n'importe laquelle des 5 autres ligues (cf. STATE.tournament) — pas de STATE.schedule/round ici,
// donc pas de userMatch ; STATE.tournamentMatchRef indique à startMatch()/continueAfterMatch() quel
// match du bracket résoudre une fois la rencontre terminée.
function openTournamentLineupScreen(match) {
  const team = getUserTeam();
  const isHome = match.home.isUser;
  const opponent = (isHome ? match.away : match.home).team;
  STATE.tournamentMatchRef = match;

  const tactic = getSavedTacticOrDefault();
  lineupSetup = {
    lineup: [], formation: tactic.formation, attackPlan: tactic.attackPlan, defensePlan: tactic.defensePlan,
    isHome, opponentId: opponent.id, userMatch: null, tournamentOpponent: opponent,
    assignments: tactic.assignments, selectedSlot: null,
    formationOOP: tactic.formationOOP, assignmentsOOP: tactic.assignmentsOOP, viewMode: tactic.viewMode
  };

  document.getElementById("lineup-match-info").innerHTML =
    `<h3>🏆 ${isHome ? team.name + " (Domicile)" : opponent.name + " (Domicile)"} vs ${isHome ? opponent.name : team.name + " (Extérieur)"}</h3>
     <p style="color:#aaa; margin-top:5px;">Tournoi international — place tes joueurs sur le terrain et choisis tes plans tactiques.</p>`;

  renderFormationChoice(lineupSetup, LINEUP_IDS);
  renderPitch(lineupSetup, LINEUP_IDS);
  renderBench(lineupSetup, LINEUP_IDS);
  renderOOPSection(lineupSetup, LINEUP_IDS);
  renderPlanChoices(lineupSetup, LINEUP_IDS);
  updateLineupCount(lineupSetup, LINEUP_IDS);
  renderSecretCardChoice(lineupSetup);

  showScreen("screen-lineup");
}

// ===================== ARMES SECRÈTES =====================
// La carte est tirée au hasard et reste cachée jusqu'à ce que le joueur clique
// pour la révéler (pioche face cachée).
function renderSecretCardChoice(setup) {
  const container = document.getElementById("secret-card-choice");
  container.innerHTML = "";

  if (!setup.secretCard) {
    const div = document.createElement("div");
    div.className = "secret-card secret-card-hidden";
    div.innerHTML = `<div class="icon">🂠</div><h4>Carte mystère</h4><p>Clique pour piocher ta Arme Secrète pour ce match.</p>`;
    div.onclick = () => {
      setup.secretCard = SECRET_CARD_ORDER[Math.floor(Math.random() * SECRET_CARD_ORDER.length)];
      renderSecretCardChoice(setup);
    };
    container.appendChild(div);
    return;
  }

  const card = SECRET_CARDS[setup.secretCard];
  const div = document.createElement("div");
  div.className = "secret-card selected";
  div.innerHTML = `<div class="icon">${card.icon}</div><h4>${card.name}</h4><p>${card.desc}</p><div class="risk">${"⭐".repeat(card.risk)}</div>`;
  container.appendChild(div);
}

// ===================== ONGLET TACTIQUE =====================
function renderTacticsTab() {
  const tactic = getSavedTacticOrDefault();
  tacticsSetup = {
    formation: tactic.formation, attackPlan: tactic.attackPlan, defensePlan: tactic.defensePlan,
    assignments: tactic.assignments, selectedSlot: null,
    formationOOP: tactic.formationOOP, assignmentsOOP: tactic.assignmentsOOP, viewMode: tactic.viewMode,
    persist: true
  };

  renderFormationChoice(tacticsSetup, TACTICS_IDS);
  renderPitch(tacticsSetup, TACTICS_IDS);
  renderBench(tacticsSetup, TACTICS_IDS);
  renderOOPSection(tacticsSetup, TACTICS_IDS);
  renderPlanChoices(tacticsSetup, TACTICS_IDS);
  renderPositionOverview();
}

// Aperçu rapide de la force de l'effectif par poste (moyenne d'overall + effectif dispo), pour
// repérer d'un coup d'œil où renforcer avant un match ou une séance de mercato — réutilise
// MIN_PLAYERS_PER_POS (engine.js) pour signaler un poste en sous-effectif.
function renderPositionOverview() {
  const team = getUserTeam();
  const wrap = document.getElementById("tactics-position-overview");
  wrap.innerHTML = POSITIONS.map(pos => {
    const players = team.players.filter(p => p.pos === pos);
    const avg = players.length ? Math.round(players.reduce((s, p) => s + p.overall, 0) / players.length) : 0;
    const min = MIN_PLAYERS_PER_POS[pos] || 0;
    const understaffed = players.length < min;
    return `<div class="pos-overview-tile">
      <span class="pos-tag pos-${pos}">${pos}</span>
      <div class="pos-overview-bar"><div class="pos-overview-fill ${overallClass(avg)}" style="width:${Math.min(100, avg)}%"></div></div>
      <span class="pos-overview-avg">${players.length ? avg : "-"}</span>
      <span class="pos-overview-count${understaffed ? " pos-overview-warn" : ""}" title="${understaffed ? `Minimum recommandé : ${min}` : ""}">${players.length} joueur${players.length > 1 ? "s" : ""}${understaffed ? " ⚠️" : ""}</span>
    </div>`;
  }).join("");
}

// ===================== SIMULATION DU MATCH =====================
const SHOOTOUT_TICK_MS = 1300;
// Au-delà du temps réglementaire, le Matchball joue en prolongation jusqu'au but décisif :
// ce plafond n'est qu'un garde-fou pour éviter une boucle infinie en cas de scénario extrême.
const MAX_MATCH_MINUTE = 200;
const MATCH_TACTICS_IDS = { formation: "match-formation-choice", pitch: "match-tactics-pitch-field", bench: "match-tactics-bench-list", attack: "match-attack-plan-choice", defense: "match-defense-plan-choice", viewMode: "match-tactics-view-mode-choice", oopFormation: "match-tactics-oop-formation-choice", oopFormationWrap: "match-tactics-oop-formation-wrap", oopPanel: "match-tactics-oop-panel", oopPitch: "match-tactics-oop-pitch-field" };

let matchEngine = null;
let matchState = null;

// --- Simulation animée du match humain (voir matchchoreo.js) ---
let choreo = null;          // instance courante (createChoreographer)
let pitchRaf = null;        // id requestAnimationFrame de la boucle d'animation continue
let lastPitchTs = null;

function startMatch() {
  const team = getUserTeam();
  const opponent = lineupSetup.tournamentOpponent || STATE.league.teams.find(t => t.id === lineupSetup.opponentId);

  lineupSetup.lineup = lineupSetup.assignments.filter(Boolean);

  // l'IA adverse choisit la formation qui exploite le mieux son effectif, puis un plan
  // tactique adapté au rapport de force avec l'équipe du joueur (cf. chooseAiFormation /
  // chooseAiPlans dans engine.js).
  const aiChoice = chooseAiFormation(opponent);
  const aiAssignments = aiChoice.assignments;
  const aiLineup = aiAssignments.filter(Boolean);
  const humanStrength = computeTeamStrength(team, lineupSetup.lineup);
  const aiStrength = computeTeamStrength(opponent, aiLineup);
  const aiPlans = chooseAiPlans(aiStrength, humanStrength);
  const aiSetup = {
    lineup: aiLineup,
    assignments: aiAssignments,
    formation: aiChoice.formation,
    attackPlan: aiPlans.attackPlan,
    defensePlan: aiPlans.defensePlan
  };

  const homeTeam = lineupSetup.isHome ? team : opponent;
  const awayTeam = lineupSetup.isHome ? opponent : team;
  const homeSetup = lineupSetup.isHome ? lineupSetup : aiSetup;
  const awaySetup = lineupSetup.isHome ? aiSetup : lineupSetup;

  homeSetup.activeOverride = null;
  awaySetup.activeOverride = null;
  homeSetup.escalierOrder = null;
  awaySetup.escalierOrder = null;
  homeSetup.matchballOrder = null;
  awaySetup.matchballOrder = null;

  const userSide = lineupSetup.isHome ? "home" : "away";
  matchEngine = createMatchEngine(homeTeam, homeSetup, awayTeam, awaySetup);
  matchState = {
    minute: 0, homeTeam, awayTeam, homeSetup, awaySetup, team, opponent,
    paused: false, userPaused: false, atHalfTime: false, finished: false, subTimers: [],
    userSide, playbackSpeed: 1, sequenceActive: false, onSequenceDone: null, pendingMinute: null,
    lastOutfieldCap: matchEngine.getOutfieldCap(0)
  };

  // Armes secrètes : sélection du joueur + tirage IA, révélées simultanément au coup d'envoi
  const aiSide = matchState.userSide === "home" ? "away" : "home";
  const userCardKey = lineupSetup.secretCard || SECRET_CARD_ORDER[0];
  const aiCardKey = SECRET_CARD_ORDER[Math.floor(Math.random() * SECRET_CARD_ORDER.length)];
  matchEngine.setCard(matchState.userSide, userCardKey);
  matchEngine.setCard(aiSide, aiCardKey);

  // affichage
  document.getElementById("match-home-name").textContent = homeTeam.name;
  document.getElementById("match-away-name").textContent = awayTeam.name;
  document.getElementById("match-score").textContent = "0 - 0";
  document.getElementById("match-minute").textContent = "0'";
  document.getElementById("commentary").innerHTML = "";
  document.getElementById("halftime-overlay").classList.remove("active");
  document.getElementById("match-tactics-modal").classList.remove("active");

  const pauseBtn = document.getElementById("btn-pause-match");
  pauseBtn.textContent = "⏸ Pause";
  pauseBtn.disabled = false;
  document.getElementById("btn-tactics-match").disabled = false;
  document.getElementById("btn-match-speed").disabled = false;
  const skipBtn = document.getElementById("btn-skip-match");
  skipBtn.textContent = "Avancer rapidement";
  skipBtn.onclick = skipMatch;
  document.getElementById("btn-match-speed").textContent = "▶ x1";

  showScreen("screen-match");
  const kickoffText = userSide === "home" ? "🟢 Coup d'envoi — à toi de jouer !" : `🟢 Coup d'envoi — ${homeTeam.name} commence.`;
  appendCommentaryEvent({ type: "phase", text: kickoffText });
  const userCard = SECRET_CARDS[userCardKey];
  appendCommentaryEvent({
    type: "phase cardevent",
    text: `🃏 Ta Arme Secrète — ${team.name} : ${userCard.icon} ${userCard.name}`
  });
  updateSecretCardButton();
  updatePresidentPenaltyButton();
  updateMatchStatusBanner();

  choreo = createChoreographer();
  syncChoreoAnchors(0);
  startMatchPitchLoop();
  runMinute();
}

// L'IA adverse réévalue son plan tactique toutes les 5 minutes à partir de la 25e :
// elle se montre plus offensive (transition + pressing haut) si elle est menée, et
// se replie (jeu direct + bloc bas) si elle protège une avance en fin de match.
function maybeAdjustAiTactics(minute) {
  if (minute < 25 || minute % 5 !== 0) return;
  const aiSide = matchState.userSide === "home" ? "away" : "home";
  const aiSetupRef = aiSide === "home" ? matchState.homeSetup : matchState.awaySetup;
  const score = matchEngine.getScore();
  const aiGoals = aiSide === "home" ? score.homeGoals : score.awayGoals;
  const oppGoals = aiSide === "home" ? score.awayGoals : score.homeGoals;

  if (aiGoals < oppGoals) {
    aiSetupRef.attackPlan = "transition";
    aiSetupRef.defensePlan = "high";
  } else if (aiGoals > oppGoals && minute >= 30) {
    aiSetupRef.attackPlan = "direct";
    aiSetupRef.defensePlan = "low";
  }
}

// Active la carte secrète choisie pour l'IA selon une heuristique simple :
// si elle perd, elle l'active entre la 25e et la 35e minute ; si elle gagne ou est à égalité,
// elle attend une phase plus défensive en fin de match. Le Joker tente un vol si possible.
function maybeActivateAiCard(minute) {
  const aiSide = matchState.userSide === "home" ? "away" : "home";
  if (matchEngine.isCardUsed(aiSide)) return;
  if (!matchEngine.isSpecialActionWindowOpen(minute, "card")) return;
  const aiKey = matchEngine.getCards()[aiSide];
  if (!aiKey) return;

  const score = matchEngine.getScore();
  const aiGoals = aiSide === "home" ? score.homeGoals : score.awayGoals;
  const oppGoals = aiSide === "home" ? score.awayGoals : score.homeGoals;
  const losing = aiGoals < oppGoals;
  const winning = aiGoals > oppGoals;

  let shouldActivate = false;
  if (aiKey === "joker") {
    const userSide = matchState.userSide;
    if (!matchEngine.isCardUsed(userSide) && matchEngine.getCards()[userSide] && minute >= 23) {
      shouldActivate = true;
    } else if (losing && minute >= 25 && minute <= 35) {
      shouldActivate = true;
    }
  } else if (losing) {
    shouldActivate = minute >= 25 && minute <= 35;
  } else if (winning) {
    shouldActivate = minute >= 30 && minute <= 36;
  } else {
    shouldActivate = minute >= 30 && minute <= 36;
  }

  if (!shouldActivate) return;

  let options = {};
  if (aiKey === "sanction") {
    const target = matchEngine.getAttackers(matchState.userSide)[0];
    options = { targetName: target ? target.name : undefined };
  } else if (aiKey === "joker") {
    const userSide = matchState.userSide;
    if (!matchEngine.isCardUsed(userSide) && matchEngine.getCards()[userSide]) {
      options = { mode: "steal" };
    } else {
      const others = SECRET_CARD_ORDER.filter(k => k !== "joker");
      options = { mode: "copy", copyKey: others[Math.floor(Math.random() * others.length)] };
    }
  }

  return matchEngine.activateCard(aiSide, aiKey, options, minute);
}

// L'IA actionne son propre "buzzer" du Président quand elle est en retard au score
// en fin de match (chance croissante par minute), mais ne le garde jamais en réserve :
// si la fenêtre est sur le point de se refermer sans qu'elle l'ait utilisé, elle est
// forcée de le tirer à la dernière minute possible (une seule fois par match).
function maybeActivatePresidentPenaltyAi(minute) {
  const aiSide = matchState.userSide === "home" ? "away" : "home";
  if (matchEngine.isPresidentPenaltyUsed(aiSide)) return;
  if (!matchEngine.isSpecialActionWindowOpen(minute, "president")) return;
  if (minute < 28) return;

  const score = matchEngine.getScore();
  const aiGoals = aiSide === "home" ? score.homeGoals : score.awayGoals;
  const oppGoals = aiSide === "home" ? score.awayGoals : score.homeGoals;
  const isLastChance = !matchEngine.isSpecialActionWindowOpen(minute + 1, "president");

  if (!isLastChance) {
    if (aiGoals >= oppGoals) return;
    if (Math.random() > 0.12) return;
  }

  return matchEngine.triggerPresidentPenalty(aiSide, minute, {});
}

// Dossier d'images des joueurs : images/players/<france|bresil>/<club-slug>/<joueur-slug>.png
const LEAGUE_IMAGE_FOLDER = {
  france: "france", brazil: "bresil", spain: "espagne", italy: "italie", germany: "allemagne", mexico: "mexique"
};

function slugifyName(str) {
  return str
    .replace(/['"]/g, "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function playerPhotoUrl(player, team) {
  // player.photoLeague : ligue d'origine du joueur, figée à la création de la carrière (voir
  // startCareer/buildOtherLeagues) — prioritaire sur team.photoLeague, car un joueur recruté sur
  // le mercato depuis une AUTRE ligue change d'équipe (donc de team.photoLeague) mais sa photo
  // reste dans le dossier de sa ligue d'origine, pas celle de l'équipe qui l'a acheté.
  // team.photoLeague reste utile en repli pour les équipes des ligues en arrière-plan
  // (buildOtherLeagues) quand le joueur n'a pas encore ce champ (vieille sauvegarde non migrée).
  const leagueKey = player.photoLeague || team.photoLeague || STATE.leagueKey;
  const leagueFolder = LEAGUE_IMAGE_FOLDER[leagueKey] || leagueKey;
  // photoClub = club d'origine du joueur (fixé à la création de la carrière) : un joueur recruté
  // depuis une autre équipe garde la photo de son club de départ, là où le fichier existe réellement.
  const clubName = player.photoClub || team.name;
  return `images/players/${leagueFolder}/${slugifyName(clubName)}/${slugifyName(player.name)}.png`;
}

function playerInitials(name) {
  const parts = name.replace(/['"]/g, "").trim().split(/\s+/);
  const first = parts[0] ? parts[0][0] : "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

// Initiales pour le blason généré (utilisées tant qu'aucun fichier logo réel n'est fourni).
function teamInitials(name) {
  const words = name.replace(/['"]/g, "").trim().split(/\s+/).filter(Boolean);
  return words.slice(0, 3).map(w => w[0]).join("").toUpperCase();
}

// Dossier des logos de club : images/clubs/<france|bresil>/<club-slug>.png (facultatif — dépose
// les fichiers toi-même comme pour les photos de joueurs). Tant qu'un fichier n'existe pas pour un
// club, renderTeamCrest retombe sur un blason généré (couleur du club + initiales).
function teamCrestUrl(team) {
  const leagueKey = team.photoLeague || STATE.leagueKey;
  const leagueFolder = LEAGUE_IMAGE_FOLDER[leagueKey] || leagueKey;
  return `images/clubs/${leagueFolder}/${slugifyName(team.name)}.png`;
}

// Blason d'un club en forme d'écusson : image réelle si présente, sinon dégradé + initiales.
// sizeClass: "crest-lg" (56px), "crest-md" (38px) ou "crest-sm" (20px).
function renderTeamCrest(team, sizeClass) {
  return `<span class="crest-wrap ${sizeClass}">
    <span class="crest-fallback" style="background:linear-gradient(135deg, ${team.color || "#8b5cf6"}, #05070d);">${teamInitials(team.name)}</span>
    <img src="${teamCrestUrl(team)}" alt="" class="crest-img"
      onload="this.style.display='block'; this.previousElementSibling.style.display='none';"
      onerror="this.style.display='none';">
  </span>`;
}

// Fiche joueur détaillée (photo, poste, club, étoiles, attributs, forme, stats) — partagée entre
// la modale d'info joueur et le panneau de détail de "Ma liste" au Mercato (voir
// renderShortlistDetail). extraHtml s'insère en bas de la colonne info (live-stat de match,
// étiquette de ligue, boutons d'action...).
function buildPlayerCardHTML(player, team, extraHtml) {
  const avgRating = player.matches > 0 ? (player.ratingSum / player.matches).toFixed(1) : "-";
  const careerMatches = player.careerMatches || 0;
  const careerAvgRating = careerMatches > 0 ? (player.careerRatingSum / careerMatches).toFixed(1) : "-";
  return `
    <div class="player-card-layout">
      <div class="player-card-photo-col">
        <div class="player-photo-fallback-lg">${playerInitials(player.name)}</div>
        <img src="${playerPhotoUrl(player, team)}" alt="" class="player-photo-lg"
          onload="this.style.display='block'; this.previousElementSibling.style.display='none';"
          onerror="this.style.display='none';">
      </div>
      <div class="player-card-info-col">
        <div class="player-card-name-row">
          <span class="pos-tag pos-${player.pos}">${player.pos}</span>
          <span class="player-card-name">${player.name}</span>
        </div>
        <div class="player-card-club">${renderTeamCrest(team, "crest-sm")}<span>${team.name}</span></div>
        <div class="player-card-stars">${renderStarRating(player.overall)}<span class="star-rating-num">${player.overall}/100</span></div>
        ${player.injured ? `<div class="player-card-injury">🩹 Blessure ${player.injurySeverity} — indisponible encore ${player.injuryDaysLeft} jour${player.injuryDaysLeft > 1 ? "s" : ""}</div>` : ""}

        <div class="attr-grid">
          ${renderAttributeTile("Vitesse", player.speed)}
          ${renderAttributeTile("Technique", player.technique)}
          ${renderAttributeTile("Physique", player.physical)}
          ${renderAttributeTile("Mental", player.mental)}
        </div>

        <div class="player-card-form"><span class="attr-tile-label">Forme</span>${renderFormBar(player.form)}</div>

        <div class="player-card-stats">
          ${renderStatTile(player.age, "Âge")}
          ${renderStatTile(formatMoney(player.value), "Valeur")}
          ${renderStatTile(player.goals, "Buts (saison)")}
          ${renderStatTile(player.assists, "Passes (saison)")}
          ${renderStatTile(avgRating, "Note (saison)")}
        </div>
        <div class="player-card-career">
          <span class="attr-tile-label">Carrière</span>
          <div class="player-card-stats">
            ${renderStatTile(careerMatches, "Matchs")}
            ${renderStatTile(player.careerGoals || 0, "Buts")}
            ${renderStatTile(player.careerAssists || 0, "Passes")}
            ${renderStatTile(careerAvgRating, "Note moy.")}
          </div>
        </div>
        ${extraHtml || ""}
      </div>
    </div>
  `;
}

// Affiche les statistiques détaillées d'un joueur dans une petite fenêtre,
// utilisable aussi bien pendant la préparation que pendant le match.
function openPlayerInfoModal(player, team, liveStat) {
  const liveHtml = liveStat
    ? `<p style="margin-top:10px; color:var(--accent); font-weight:700;">Ce match : ⚽ ${liveStat.goals || 0} but(s) — 🅰️ ${liveStat.assists || 0} passe(s) décisive(s)</p>`
    : "";
  document.getElementById("player-info-body").innerHTML = buildPlayerCardHTML(player, team, liveHtml);
  document.getElementById("player-info-modal").classList.add("active");
}

function closePlayerInfoModal() {
  document.getElementById("player-info-modal").classList.remove("active");
}

// ----- Simulation animée du match (matchchoreo.js) -----
// Le match humain entier (coup d'envoi à la fin) se joue minute par minute, automatiquement :
// runMinute()/advanceToMinute() demandent au moteur (engine.js:simulateMinute avec
// {withSequence:true}) la chorégraphie de la minute à venir, la chargent dans `choreo`, et la
// boucle continue ci-dessous l'anime jusqu'à son terme avant d'enchaîner sur la suivante. Le
// canvas dessine à la fois le terrain et les acteurs, transposés dans un affichage paysage.

// Ancre chaque joueur actif de la minute donnée à sa position de formation courante (voir
// engine.js:getFormationAnchors) — les joueurs déjà affichés ne sont jamais téléportés (ils sont
// rappelés en douceur par matchchoreo.js), seuls les nouveaux entrants apparaissent directement
// dessus (escalier, Dé Géant, Matchball, remplacement après carton rouge).
function syncChoreoAnchors(minute) {
  if (!choreo || !matchEngine) return;
  choreo.setAnchors(matchEngine.getFormationAnchors("home", minute), matchEngine.getFormationAnchors("away", minute));
}

function stopMatchPitch() {
  if (pitchRaf) cancelAnimationFrame(pitchRaf);
  pitchRaf = null;
}

function startMatchPitchLoop() {
  lastPitchTs = null;
  if (pitchRaf) cancelAnimationFrame(pitchRaf);
  pitchRaf = requestAnimationFrame(pitchFrameLoop);
}

// Boucle continue : fait avancer l'animation (à la vitesse de lecture choisie) tant que le match
// n'est pas en pause, redessine à chaque frame, pousse au commentaire les événements des beats qui
// viennent de se terminer, et déclenche onSequenceDone (chargé par playSequence) une seule fois
// quand la séquence en cours (celle de la minute, éventuellement complétée par un beat inséré —
// voir choreo.insertNext) est entièrement jouée.
function pitchFrameLoop(ts) {
  if (!choreo) return;
  if (lastPitchTs !== null && matchState && !matchState.paused) {
    const dt = Math.min(0.1, (ts - lastPitchTs) / 1000) * (matchState.playbackSpeed || 1);
    choreo.step(dt);
    const finished = choreo.consumeFinishedEvents();
    if (finished.length) {
      finished.forEach(appendCommentaryEvent);
      refreshScoreDisplay();
      updateSecretCardButton();
      updatePresidentPenaltyButton();
    }
    if (matchState.sequenceActive && choreo.isSequenceDone()) {
      matchState.sequenceActive = false;
      const done = matchState.onSequenceDone;
      matchState.onSequenceDone = null;
      if (done) done();
    }
  }
  lastPitchTs = ts;
  renderMatchPitchFrame();
  pitchRaf = requestAnimationFrame(pitchFrameLoop);
}

// Charge une chorégraphie et rappelle `onDone` une fois qu'elle est entièrement jouée (utilisé
// pour la séquence de chaque minute). Une action ponctuelle en cours de match (Arme Secrète,
// Penalty du Président) n'appelle jamais cette fonction : elle utilise choreo.insertNext() pour
// s'intercaler dans la séquence déjà en cours de lecture, sans perturber onSequenceDone.
function playSequence(beats, onDone) {
  matchState.sequenceActive = true;
  matchState.onSequenceDone = onDone;
  choreo.loadSequence(beats || []);
}

// Les annonces générées par une Arme Secrète/le Penalty du Président (activateCard/
// triggerPresidentPenalty, toujours "phase") sont visuellement distinguées du reste du
// commentaire — même transformation que l'ancien evts.forEach(ev => ev.type==="phase" ? ... ).
function tagCardBeats(seqBeats) {
  return (seqBeats || []).map(b => (b.event && b.event.type === "phase")
    ? Object.assign({}, b, { event: Object.assign({}, b.event, { type: "phase cardevent" }) })
    : b);
}

function findPitchPlayer(id) {
  if (!matchState) return null;
  return matchState.homeTeam.players.find(p => p.id === id) || matchState.awayTeam.players.find(p => p.id === id) || null;
}

// Cache des photos des disques du plateau physique (playerId -> HTMLImageElement prête, ou
// "error" si absente) : évite de recréer un Image() à chaque frame (~60/s). Le chargement est
// asynchrone — le disque affiche le remplissage couleur d'équipe habituel le temps que la photo
// arrive, puis la frame suivante la dessine automatiquement une fois prête.
const pitchPhotoCache = new Map();
function getPitchPhotoImage(player, team) {
  const cached = pitchPhotoCache.get(player.id);
  if (cached === "error") return null;
  if (cached) return (cached.complete && cached.naturalWidth > 0) ? cached : null;
  const img = new Image();
  img.onerror = () => pitchPhotoCache.set(player.id, "error");
  img.src = playerPhotoUrl(player, team);
  pitchPhotoCache.set(player.id, img);
  return null;
}

// Les navigateurs suspendent quasiment totalement requestAnimationFrame dans un onglet en
// arrière-plan (économie de batterie) — si le joueur change d'onglet, l'animation semble figée
// pendant son absence puis reprend normalement dès qu'il revient (dt resynchronisé pour éviter un
// gros saut d'un coup après une longue pause).
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") lastPitchTs = null;
});

// Dessine le terrain (marquages + joueurs + ballon) sur le canvas, à partir de choreo.getState().
// Terrain affiché en PAYSAGE (façon Football Manager) alors que le repère logique interne
// (engine.js/matchchoreo.js) reste 0-100×0-100 avec l'axe but-à-but sur Y (y=0 but domicile) —
// on transpose donc les axes UNIQUEMENT ici, au moment du rendu : `screenX ← logiqueY` (axe large
// de l'écran), `screenY ← logiqueX` (axe court). Rien dans le moteur/la chorégraphie n'a besoin
// de connaître l'orientation d'affichage.
const PITCH_PLAYER_R = 3.2, PITCH_GK_R = 3.6, PITCH_BALL_R = 1.8;

// Marquages du terrain (surfaces, buts, ligne médiane, arcs) dessinés directement dans le canvas
// avec la même transposition que les joueurs/le ballon — remplace l'ancien SVG séparé
// (`<svg class="pitch-markings">`, retiré d'index.html), qui aurait dû, lui aussi, être réorienté
// pour le paysage : plus simple de tout dessiner au même endroit, avec la même échelle.
function drawPitchMarkings(ctx, sx, sy) {
  const scale = Math.min(sx, sy);
  const W = 100 * sx, H = 100 * sy;
  // rect logique (x,y,w,h) — x/touche-à-touche, y/but-à-but — tracé transposé en écran.
  function rectL(x, y, w, h) { ctx.rect(y * sx, x * sy, h * sx, w * sy); }
  function dotL(x, y, r) { ctx.beginPath(); ctx.arc(y * sx, x * sy, r * scale, 0, Math.PI * 2); ctx.fill(); }
  function goalNet(x, y, w, h) {
    const steps = 4;
    for (let i = 0; i <= steps; i++) {
      const t = x + (w * i) / steps;
      ctx.beginPath(); ctx.moveTo(y * sx, t * sy); ctx.lineTo((y + h) * sx, t * sy); ctx.stroke();
    }
  }

  ctx.save();
  ctx.lineWidth = Math.max(1, 0.55 * scale);
  ctx.strokeStyle = "rgba(255,255,255,0.38)";
  ctx.fillStyle = "rgba(0,0,0,0.05)";
  ctx.beginPath(); rectL(19, 0, 62, 18); ctx.fill(); ctx.stroke();   // grande surface (gauche)
  ctx.beginPath(); rectL(19, 82, 62, 18); ctx.fill(); ctx.stroke();  // grande surface (droite)
  ctx.beginPath(); rectL(32, 0, 36, 7); ctx.stroke();                // petite surface (gauche)
  ctx.beginPath(); rectL(32, 93, 36, 7); ctx.stroke();               // petite surface (droite)

  ctx.strokeStyle = "rgba(255,255,255,0.7)";
  ctx.lineWidth = Math.max(1, 0.7 * scale);
  ctx.beginPath(); rectL(41, 0, 18, 3.5); ctx.stroke();              // but (gauche)
  ctx.beginPath(); rectL(41, 96.5, 18, 3.5); ctx.stroke();           // but (droite)
  ctx.strokeStyle = "rgba(255,255,255,0.22)";
  ctx.lineWidth = Math.max(0.5, 0.3 * scale);
  goalNet(41, 0, 18, 3.5);
  goalNet(41, 96.5, 18, 3.5);

  ctx.fillStyle = "rgba(255,255,255,0.65)";
  dotL(50, 12, 0.9); dotL(50, 88, 0.9); dotL(50, 50, 0.9);           // points de penalty + centre

  ctx.strokeStyle = "rgba(255,255,255,0.38)";
  ctx.lineWidth = Math.max(1, 0.55 * scale);
  ctx.beginPath(); ctx.moveTo(50 * sx, 0); ctx.lineTo(50 * sx, H); ctx.stroke(); // ligne médiane
  ctx.beginPath(); ctx.arc(50 * sx, 50 * sy, 14 * scale, 0, Math.PI * 2); ctx.stroke(); // rond central

  // Arcs de penalty : portion de cercle (rayon 12, centré sur le point de penalty) tournée vers
  // le centre du terrain — approximation visuelle, pas une reprise exacte de la géométrie FIFA.
  ctx.beginPath(); ctx.arc(12 * sx, 50 * sy, 12 * scale, -0.85, 0.85); ctx.stroke();
  ctx.beginPath(); ctx.arc(88 * sx, 50 * sy, 12 * scale, Math.PI - 0.85, Math.PI + 0.85); ctx.stroke();

  ctx.strokeStyle = "rgba(255,255,255,0.32)";
  ctx.lineWidth = Math.max(1, 0.5 * scale);
  const cr = 3.5 * scale;
  ctx.beginPath(); ctx.arc(0, 0, cr, 0, Math.PI / 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(W, 0, cr, Math.PI / 2, Math.PI); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, H, cr, -Math.PI / 2, 0); ctx.stroke();
  ctx.beginPath(); ctx.arc(W, H, cr, Math.PI, Math.PI * 1.5); ctx.stroke();
  ctx.restore();
}

function renderMatchPitchFrame() {
  const canvas = document.getElementById("match-pitch-canvas");
  if (!canvas || !choreo) return;
  const state = choreo.getState();
  const ctx = canvas.getContext("2d");
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const wantW = Math.max(1, Math.round(rect.width * dpr));
  const wantH = Math.max(1, Math.round(rect.height * dpr));
  if (canvas.width !== wantW || canvas.height !== wantH) { canvas.width = wantW; canvas.height = wantH; }
  const sx = canvas.width / 100;
  const sy = canvas.height / 100;
  const scale = Math.min(sx, sy); // rayons/épaisseurs : une seule échelle pour rester ronds malgré sx≠sy

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawPitchMarkings(ctx, sx, sy);

  const gkIds = new Set();
  if (matchEngine) {
    ["home", "away"].forEach(side => { const gk = matchEngine.getGK(side); if (gk) gkIds.add(gk.id); });
  }

  state.players.forEach(d => {
    const player = findPitchPlayer(d.id);
    const team = matchState ? (d.side === "home" ? matchState.homeTeam : matchState.awayTeam) : null;
    const teamColor = d.side === "home" ? "#3aa0ff" : "#ff5d5d";
    const r = (gkIds.has(d.id) ? PITCH_GK_R : PITCH_PLAYER_R) * scale;
    const cx = d.y * sx, cy = d.x * sy; // transposé : logique (x,y) -> écran (y,x)
    // Le porteur du ballon affiche ses initiales à la place de sa photo le temps qu'il l'ait
    // (façon Football Manager, dont le nom du porteur apparaît près de lui) — reprend le même
    // repli "initiales" déjà utilisé quand la photo est absente.
    const isBallCarrier = state.ballCarrierId === d.id;
    const photo = (!isBallCarrier && player && team) ? getPitchPhotoImage(player, team) : null;

    // fond plein couleur d'équipe, toujours dessiné en premier (même avec une photo : on garde
    // un anneau de fond visible autour du visage plutôt que la photo pleine largeur du disque).
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = teamColor;
    ctx.fill();

    if (photo) {
      const innerR = r * 0.8;
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
      ctx.clip();
      // recadrage "cover" : la photo remplit le disque intérieur sans être déformée
      const pscale = Math.max((innerR * 2) / photo.naturalWidth, (innerR * 2) / photo.naturalHeight);
      const dw = photo.naturalWidth * pscale, dh = photo.naturalHeight * pscale;
      ctx.drawImage(photo, cx - dw / 2, cy - dh / 2, dw, dh);
      ctx.restore();
    }

    // contour toujours affiché (par-dessus la photo) : la couleur identifie l'équipe (comme
    // l'ancien remplissage), l'épaisseur distingue les joueurs de TON équipe.
    const isUserSide = matchState && d.side === matchState.userSide;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.lineWidth = Math.max(1, (isUserSide ? 0.55 : 0.3) * scale);
    ctx.strokeStyle = teamColor;
    ctx.stroke();

    if (!photo) {
      ctx.fillStyle = "#ffffff";
      ctx.font = `${Math.max(8, 2.1 * scale)}px "Rajdhani", sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(player ? playerInitials(player.name) : "", cx, cy + 0.5);
    }
  });

  ctx.beginPath();
  ctx.arc(state.ball.y * sx, state.ball.x * sy, PITCH_BALL_R * scale, 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.lineWidth = Math.max(1, 0.25 * scale);
  ctx.strokeStyle = "#333333";
  ctx.stroke();
}

// Le joueur ne pilote plus aucune action : un clic sur un joueur (sien ou adverse) ouvre juste sa
// fiche. Câblé une seule fois (le canvas est un élément statique de la page, réutilisé d'un match
// à l'autre). Transposition inverse de celle du rendu (écran -> logique) pour retrouver le bon
// joueur sous le doigt/curseur.
function setupMatchPitchPointerEvents() {
  const canvas = document.getElementById("match-pitch-canvas");
  if (!canvas) return;

  canvas.onclick = evt => {
    if (!choreo || !matchState) return;
    const rect = canvas.getBoundingClientRect();
    const pt = {
      x: (evt.clientY - rect.top) / rect.height * 100,
      y: (evt.clientX - rect.left) / rect.width * 100
    };
    const found = choreo.getState().players.find(p => Math.hypot(p.x - pt.x, p.y - pt.y) <= PITCH_GK_R + 1.5);
    if (!found) return;
    const player = findPitchPlayer(found.id);
    if (!player) return;
    const team = found.side === "home" ? matchState.homeTeam : matchState.awayTeam;
    openPlayerInfoModal(player, team, matchEngine ? matchEngine.getPlayerStats()[found.id] : null);
  };
}

function appendCommentaryEvent(ev) {
  const commentary = document.getElementById("commentary");
  const div = document.createElement("div");
  div.className = "ev " + ev.type;
  div.textContent = ev.text;
  commentary.appendChild(div);
  commentary.scrollTop = commentary.scrollHeight;
}

// Bannière au-dessus du terrain : seul le statut pause/lecture a encore un sens (le joueur ne
// prend plus jamais la main directement sur les actions).
function updateMatchStatusBanner() {
  const banner = document.getElementById("turn-banner");
  if (!banner || !matchState) return;
  if (matchState.finished || !matchState.paused) { banner.style.display = "none"; return; }
  banner.textContent = "⏸ Match en pause";
  banner.className = "turn-banner paused";
  banner.style.display = "block";
}

function refreshScoreDisplay() {
  const score = matchEngine.getScore();
  document.getElementById("match-score").textContent = `${score.homeGoals} - ${score.awayGoals}`;
}

function checkMatchDecidedAndMaybeFinish() {
  if (!matchEngine.isMatchDecided()) return false;
  const winnerSide = matchEngine.getMatchballWinner();
  if (winnerSide) {
    const winnerName = winnerSide === "home" ? matchState.homeTeam.name : matchState.awayTeam.name;
    appendCommentaryEvent({ minute: matchState.minute, type: "phase", text: `🏆 MATCHBALL ! ${winnerName} inscrit le but décisif et remporte le match immédiatement !` });
  }
  finishMatchDisplay();
  return true;
}

// Point d'entrée unique pour "il faut que le match progresse" : reprend un changement de minute
// resté en attente (composition de phase demandée pendant une pause utilisateur), sinon ne fait
// rien de plus — la boucle d'animation (pitchFrameLoop) se charge seule de finir la séquence en
// cours et d'enchaîner sur runMinute() via onSequenceDone.
function continueMatchFlow() {
  if (!matchState || matchState.finished || matchState.atHalfTime) return;
  if (matchState.pendingMinute != null) {
    const m = matchState.pendingMinute;
    matchState.pendingMinute = null;
    advanceToMinute(m);
  }
}

// Lève la pause (sauf pause manuelle de l'utilisateur) et fait progresser le match.
function resumeMatchFlow() {
  if (matchState.userPaused) { updateMatchStatusBanner(); return; }
  matchState.paused = false;
  document.getElementById("btn-pause-match").textContent = "⏸ Pause";
  updateMatchStatusBanner();
  continueMatchFlow();
}

// Demande au moteur la minute suivante, dès que la précédente (ou le coup d'envoi) est terminée.
// Vérifie d'abord si un vrai choix de composition doit être posé au joueur (escalier, Dé Géant,
// escalier inversé du Matchball) — auquel cas le match se met en pause et la minute reste en
// attente (matchState.pendingMinute) jusqu'à ce que le modal soit validé.
function runMinute() {
  if (!matchState || matchState.finished || matchState.atHalfTime) return;
  const nextMinute = matchState.minute + 1;
  if (maybeAskPhaseLineup(nextMinute)) {
    matchState.pendingMinute = nextMinute;
    return;
  }
  advanceToMinute(nextMinute);
}

// Simule la minute donnée (bookkeeping de phase + occasions, voir engine.js) et anime sa
// chorégraphie. Les actions IA (carte secrète/Penalty du Président/ajustement tactique) sont
// évaluées AVANT les occasions de la minute, comme dans l'ancien système à base de tours — leurs
// éventuels beats sont donc joués en premier dans la séquence de la minute.
function advanceToMinute(nextMinute) {
  matchState.minute = nextMinute;
  document.getElementById("match-minute").textContent = matchState.minute + "'";

  const combined = [];
  const cardEvts = maybeActivateAiCard(matchState.minute);
  if (cardEvts && cardEvts.sequence) combined.push(...tagCardBeats(cardEvts.sequence));
  const presEvts = maybeActivatePresidentPenaltyAi(matchState.minute);
  if (presEvts && presEvts.sequence) combined.push(...tagCardBeats(presEvts.sequence));
  maybeAdjustAiTactics(matchState.minute);
  updateSecretCardButton();
  updatePresidentPenaltyButton();

  const evts = matchEngine.simulateMinute(matchState.minute, { withSequence: true });
  if (evts.sequence) combined.push(...evts.sequence);

  syncChoreoAnchors(matchState.minute);
  playSequence(combined, () => {
    if (checkMatchDecidedAndMaybeFinish()) return;
    if (matchState.minute === matchEngine.halfTime) { showHalfTime(); return; }
    // Le Matchball (dès la 36e minute, donc toujours avant la fin du temps réglementaire à 40')
    // garantit une équipe gagnante : le match continue en prolongation tant que personne n'a
    // atteint l'objectif de buts. MAX_MATCH_MINUTE n'est qu'un garde-fou de sécurité.
    if (matchState.minute >= MAX_MATCH_MINUTE) { finishMatchDisplay(); return; }
    runMinute();
  });
}

// Détecte, AVANT de jouer la minute donnée, un changement de format. Pour un escalier progressif
// (départ du match ou escalier inversé du Matchball, qui changent de format à chaque minute), on
// ne demande l'ordre de priorité QU'UNE FOIS pour toute la montée/descente : les minutes suivantes
// réutilisent cet ordre silencieusement, sans rouvrir de fenêtre. Pour un changement ponctuel (Dé
// Géant, qui ne change qu'une fois), on garde la sélection classique à effectif fixe. Renvoie true
// si une fenêtre a été ouverte (le tick courant doit alors s'arrêter et attendre la validation).
function maybeAskPhaseLineup(minute) {
  const curCap = matchEngine.getOutfieldCap(minute);
  if (curCap === matchState.lastOutfieldCap) return false;
  matchState.lastOutfieldCap = curCap;

  const userSide = matchState.userSide;
  const setup = userSide === "home" ? matchState.homeSetup : matchState.awaySetup;
  const poolIds = matchEngine.getAvailableOutfieldIds(userSide, minute);
  if (poolIds.length <= curCap) return false; // tout le monde joue déjà, pas de vrai choix

  const isEscalier = minute >= 1 && minute <= matchEngine.ESCALIER_END_MINUTE;
  const isMatchball = minute >= matchEngine.MATCHBALL_START_MINUTE;

  if (isEscalier || isMatchball) {
    const orderKey = isEscalier ? "escalierOrder" : "matchballOrder";
    if (Array.isArray(setup[orderKey]) && setup[orderKey].length) {
      // Ordre déjà choisi pour cette phase : on l'applique directement, sans rouvrir de fenêtre.
      setup.activeOverride = applyOrderToCap(setup[orderKey], poolIds, curCap);
      return false;
    }
    openPhaseOrderModal(userSide, poolIds, isEscalier ? "escalier" : "matchball");
    return true;
  }

  openPhaseLineupModal(userSide, curCap, poolIds);
  return true;
}

// Déduit la composition active pour un format donné à partir d'un ordre de priorité (le joueur
// en position 0 est le plus prioritaire). Comble avec le reste du groupe si l'ordre ne couvre pas
// tout le monde (ex. joueur suspendu entre-temps).
function applyOrderToCap(order, poolIds, cap) {
  const filtered = order.filter(id => poolIds.includes(id));
  let ids = filtered.slice(0, cap);
  if (ids.length < cap) {
    const rest = poolIds.filter(id => !ids.includes(id));
    ids = ids.concat(rest.slice(0, cap - ids.length));
  }
  return ids;
}

let phaseLineupState = null;

// ----- Sélection classique à effectif fixe (utilisée pour le Dé Géant : un seul changement
// ponctuel, donc une seule fenêtre suffit déjà naturellement). -----
function openPhaseLineupModal(side, cap, poolIds) {
  pauseMatchForPhaseModal();

  const team = side === "home" ? matchState.homeTeam : matchState.awayTeam;
  const setup = side === "home" ? matchState.homeSetup : matchState.awaySetup;
  const players = poolIds.map(id => team.players.find(p => p.id === id)).filter(Boolean);

  // présélection : les joueurs déjà actifs juste avant (s'ils sont toujours disponibles),
  // complétés par les meilleurs restants pour atteindre le nombre requis.
  const prevActive = new Set(Array.isArray(setup.activeOverride) ? setup.activeOverride : []);
  let preselected = players.filter(p => prevActive.has(p.id)).map(p => p.id);
  if (preselected.length < cap) {
    const rest = players.filter(p => !preselected.includes(p.id)).sort((a, b) => b.overall - a.overall);
    preselected = preselected.concat(rest.slice(0, cap - preselected.length).map(p => p.id));
  }
  preselected = preselected.slice(0, cap);

  phaseLineupState = { mode: "select", side, cap, players, selected: new Set(preselected) };

  document.getElementById("phase-lineup-title").textContent = "Dé Géant";
  document.getElementById("phase-lineup-desc").textContent = `Format ${cap}v${cap}`;
  renderPhaseLineupList();
  document.getElementById("phase-lineup-modal").classList.add("active");
}

// ----- Ordre de priorité, demandé une seule fois pour tout un escalier (départ du match ou
// escalier inversé du Matchball) : "escalier" = ordre d'entrée, "matchball" = ordre de sortie. -----
function openPhaseOrderModal(side, poolIds, kind) {
  pauseMatchForPhaseModal();

  const team = side === "home" ? matchState.homeTeam : matchState.awayTeam;
  const players = poolIds.map(id => team.players.find(p => p.id === id)).filter(Boolean);

  phaseLineupState = { mode: "order", side, kind, players, order: [] };

  if (kind === "escalier") {
    document.getElementById("phase-lineup-title").textContent = "Escalier de départ";
    document.getElementById("phase-lineup-desc").textContent = "Ordre d'entrée";
  } else {
    document.getElementById("phase-lineup-title").textContent = "Matchball";
    document.getElementById("phase-lineup-desc").textContent = "Ordre de sortie";
  }
  renderPhaseLineupList();
  document.getElementById("phase-lineup-modal").classList.add("active");
}

function pauseMatchForPhaseModal() {
  matchState.paused = true;
  document.getElementById("btn-pause-match").textContent = "▶ Reprendre";
  updateMatchStatusBanner();
}

function renderPhaseLineupList() {
  const list = document.getElementById("phase-lineup-list");
  list.innerHTML = "";

  if (phaseLineupState.mode === "order") {
    const { players, order } = phaseLineupState;
    [...players].sort((a, b) => b.overall - a.overall).forEach(p => {
      const rank = order.indexOf(p.id);
      const row = document.createElement("div");
      row.className = "player-row" + (rank >= 0 ? " selected" : "");
      const rankBadge = rank >= 0 ? `<span class="phase-tag">#${rank + 1}</span>` : "";
      row.innerHTML = `<span><span class="pos-tag pos-${p.pos}">${p.pos}</span> ${p.name} ${rankBadge}</span>${renderOverallBadge(p.overall)}`;
      row.onclick = () => {
        const idx = order.indexOf(p.id);
        if (idx >= 0) order.splice(idx, 1);
        else order.push(p.id);
        renderPhaseLineupList();
      };
      list.appendChild(row);
    });
    document.getElementById("btn-phase-lineup-confirm").disabled = order.length !== players.length;
    return;
  }

  const { players, selected, cap } = phaseLineupState;
  [...players].sort((a, b) => b.overall - a.overall).forEach(p => {
    const row = document.createElement("div");
    row.className = "player-row" + (selected.has(p.id) ? " selected" : "");
    row.innerHTML = `<span><span class="pos-tag pos-${p.pos}">${p.pos}</span> ${p.name}</span>${renderOverallBadge(p.overall)}`;
    row.onclick = () => {
      if (selected.has(p.id)) {
        selected.delete(p.id);
      } else if (selected.size < cap) {
        selected.add(p.id);
      }
      renderPhaseLineupList();
    };
    list.appendChild(row);
  });
  document.getElementById("btn-phase-lineup-confirm").disabled = selected.size !== cap;
}

function closePhaseModalAndResume() {
  document.getElementById("phase-lineup-modal").classList.remove("active");
  phaseLineupState = null;
  syncChoreoAnchors(matchState.minute);
  resumeMatchFlow();
}

function applyPhaseLineupSelection(ids) {
  const setup = phaseLineupState.side === "home" ? matchState.homeSetup : matchState.awaySetup;
  setup.activeOverride = ids;
  closePhaseModalAndResume();
}

// Enregistre l'ordre de priorité choisi pour tout l'escalier (départ ou Matchball) et applique
// immédiatement la composition correspondant au format de la minute en cours.
function applyPhaseOrderSelection(rankedIds) {
  const { side, kind } = phaseLineupState;
  const setup = side === "home" ? matchState.homeSetup : matchState.awaySetup;
  // "escalier" : ordre d'entrée tel que cliqué (priorité = ordre de jeu).
  // "matchball" : l'utilisateur clique l'ordre de SORTIE, donc on l'inverse pour obtenir la
  // priorité à RESTER (1er à rester = dernier à sortir), cohérente avec applyOrderToCap().
  const order = kind === "escalier" ? rankedIds : [...rankedIds].reverse();
  setup[kind === "escalier" ? "escalierOrder" : "matchballOrder"] = order;

  const poolIds = phaseLineupState.players.map(p => p.id);
  setup.activeOverride = applyOrderToCap(order, poolIds, matchState.lastOutfieldCap);
  closePhaseModalAndResume();
}

function confirmPhaseLineup() {
  if (!phaseLineupState) return;
  if (phaseLineupState.mode === "order") {
    if (phaseLineupState.order.length !== phaseLineupState.players.length) return;
    applyPhaseOrderSelection([...phaseLineupState.order]);
    return;
  }
  if (phaseLineupState.selected.size !== phaseLineupState.cap) return;
  applyPhaseLineupSelection([...phaseLineupState.selected]);
}

function autoPhaseLineup() {
  if (!phaseLineupState) return;
  if (phaseLineupState.mode === "order") {
    // Auto : meilleurs en premier pour l'ordre d'entrée, plus faibles en premier pour l'ordre
    // de sortie du Matchball (les meilleurs restent sur le terrain le plus longtemps possible).
    const sorted = [...phaseLineupState.players].sort((a, b) =>
      phaseLineupState.kind === "escalier" ? b.overall - a.overall : a.overall - b.overall);
    applyPhaseOrderSelection(sorted.map(p => p.id));
    return;
  }
  const best = [...phaseLineupState.players].sort((a, b) => b.overall - a.overall).slice(0, phaseLineupState.cap);
  applyPhaseLineupSelection(best.map(p => p.id));
}

function showHalfTime() {
  const score = matchEngine.getScore();
  matchState.atHalfTime = true;
  matchState.paused = true;
  document.getElementById("halftime-score").textContent =
    `${matchState.homeTeam.name} ${score.homeGoals} - ${score.awayGoals} ${matchState.awayTeam.name}`;
  document.getElementById("halftime-overlay").classList.add("active");
}

function continueAfterHalfTime() {
  document.getElementById("halftime-overlay").classList.remove("active");
  matchState.atHalfTime = false;
  appendCommentaryEvent({ type: "phase", text: "🟢 Reprise — 2ème mi-temps" });
  syncChoreoAnchors(matchState.minute);
  if (matchState.userPaused) { updateMatchStatusBanner(); return; }
  matchState.paused = false;
  document.getElementById("btn-pause-match").textContent = "⏸ Pause";
  updateMatchStatusBanner();
  runMinute();
}

const MATCH_SPEED_STEPS = [1, 2, 4];

// Vitesse de lecture de l'animation (indépendante d'"Avancer rapidement", qui saute directement à
// la fin) : multiplie le dt passé à choreo.step() à chaque frame.
function cycleMatchSpeed() {
  if (!matchState) return;
  const idx = MATCH_SPEED_STEPS.indexOf(matchState.playbackSpeed);
  matchState.playbackSpeed = MATCH_SPEED_STEPS[(idx + 1) % MATCH_SPEED_STEPS.length];
  document.getElementById("btn-match-speed").textContent = `▶ x${matchState.playbackSpeed}`;
}

function togglePauseMatch() {
  if (!matchState || matchState.finished || matchState.atHalfTime || phaseLineupState) return;
  matchState.paused = !matchState.paused;
  matchState.userPaused = matchState.paused;
  const btn = document.getElementById("btn-pause-match");
  if (matchState.paused) {
    btn.textContent = "▶ Reprendre";
    updateMatchStatusBanner();
  } else {
    btn.textContent = "⏸ Pause";
    resumeMatchFlow();
  }
}

// Ouvre le panneau tactique en cours de match (mise en pause automatique)
function openMatchTactics() {
  if (!matchState || matchState.finished || phaseLineupState) return;
  matchState.paused = true;
  document.getElementById("btn-pause-match").textContent = "▶ Reprendre";
  document.getElementById("halftime-overlay").classList.remove("active");
  updateMatchStatusBanner();

  renderFormationChoice(lineupSetup, MATCH_TACTICS_IDS);
  renderPitch(lineupSetup, MATCH_TACTICS_IDS);
  renderBench(lineupSetup, MATCH_TACTICS_IDS);
  renderOOPSection(lineupSetup, MATCH_TACTICS_IDS);
  renderPlanChoices(lineupSetup, MATCH_TACTICS_IDS);

  document.getElementById("match-tactics-modal").classList.add("active");
}

function closeMatchTactics() {
  document.getElementById("match-tactics-modal").classList.remove("active");
  lineupSetup.lineup = lineupSetup.assignments.filter(Boolean);
  syncChoreoAnchors(matchState.minute);

  if (matchState.atHalfTime) {
    document.getElementById("halftime-overlay").classList.add("active");
    return;
  }
  if (!matchState.finished) resumeMatchFlow();
}

// L'Arme Secrète et le Penalty du Président ne s'activent que dans les fenêtres réglementaires
// (5'-17' puis 23'-36', le Penalty du Président devant être déclenché avant 35:59).
function updateSecretCardButton() {
  const btn = document.getElementById("btn-secret-card");
  const used = matchEngine.isCardUsed(matchState.userSide);
  const windowOpen = matchEngine.isSpecialActionWindowOpen(matchState.minute, "card");
  btn.disabled = used || matchState.finished || !windowOpen;
  btn.classList.toggle("used", used);
  btn.title = windowOpen ? "" : "Activable entre la 5e et la 17e minute, puis entre la 23e et la 36e minute.";
}

function updatePresidentPenaltyButton() {
  const btn = document.getElementById("btn-president-penalty");
  const used = matchEngine.isPresidentPenaltyUsed(matchState.userSide);
  const windowOpen = matchEngine.isSpecialActionWindowOpen(matchState.minute, "president");
  btn.disabled = used || matchState.finished || !windowOpen;
  btn.classList.toggle("used", used);
  btn.title = windowOpen ? "" : "Activable entre la 5e et la 17e minute, puis entre la 23e et la 35e minute.";
}

// Le coach humain actionne le buzzer du Président : penalty immédiat, une fois par match. Ne met
// jamais le match en pause : les beats s'intercalent dans l'animation en cours via insertNext,
// exactement comme sur le plateau ils s'exécutaient sans perturber le tour en cours.
function executeUserPresidentPenalty(presidentName) {
  const evts = matchEngine.triggerPresidentPenalty(matchState.userSide, matchState.minute, { presidentName });
  if (choreo && evts.sequence) choreo.insertNext(tagCardBeats(evts.sequence));
  updatePresidentPenaltyButton();
}

// Le coach humain actionne le buzzer du Président : si l'équipe a plusieurs présidents,
// on lui demande lequel tire ; sinon le penalty est immédiat.
function triggerUserPresidentPenalty() {
  if (!matchState || matchState.finished) return;
  if (!matchEngine.isSpecialActionWindowOpen(matchState.minute, "president")) return;
  if (matchEngine.isPresidentPenaltyUsed(matchState.userSide)) return;

  const presidents = matchEngine.getPresidents(matchState.userSide);
  if (presidents.length <= 1) {
    executeUserPresidentPenalty(presidents[0]);
    return;
  }

  const list = document.getElementById("president-select-list");
  list.innerHTML = "";
  presidents.forEach(name => {
    const btn = document.createElement("button");
    btn.className = "primary";
    btn.textContent = name;
    btn.onclick = () => {
      document.getElementById("president-select-modal").classList.remove("active");
      executeUserPresidentPenalty(name);
    };
    list.appendChild(btn);
  });
  document.getElementById("president-select-modal").classList.add("active");
}

function playerOptionsHtml(players, selectId) {
  return `<select id="${selectId}" style="width:100%; padding:6px; border-radius:6px; margin-top:4px;">` +
    players.map(p => `<option value="${p.id}">${p.name} (${p.pos})</option>`).join("") +
    `</select>`;
}

// Construit le HTML des options spécifiques à une carte (utilisé pour la carte
// choisie ainsi que pour la sous-sélection du Joker en mode "copie").
function buildCardSubOptionsHtml(key, userSide, oppSide) {
  switch (key) {
    case "sanction": {
      const targets = matchEngine.getAttackers(oppSide);
      return `<label>Joueur adverse à sanctionner :</label>` + playerOptionsHtml(targets, "card-target-select");
    }
    case "penalty":
    case "shootout": {
      const attackers = matchEngine.getAttackers(userSide);
      return `<label>Tireur :</label>` + playerOptionsHtml(attackers, "card-taker-select");
    }
    case "reversePenalty": {
      const oppAttackers = matchEngine.getAttackers(oppSide);
      return `<label>Tireur adverse désigné :</label>` + playerOptionsHtml(oppAttackers, "card-opp-taker-select");
    }
    case "starPlayer": {
      const attackers = matchEngine.getAttackers(userSide);
      return `<label>Joueur étoile :</label>` + playerOptionsHtml(attackers, "card-star-select");
    }
    default:
      return "";
  }
}

// Lit les options choisies par l'utilisateur pour la carte `key`.
function gatherCardOptions(key, userSide, oppSide) {
  switch (key) {
    case "sanction": {
      const sel = document.getElementById("card-target-select");
      const p = matchEngine.getAttackers(oppSide).find(pl => String(pl.id) === sel.value);
      return { targetName: p ? p.name : undefined };
    }
    case "penalty":
    case "shootout": {
      const sel = document.getElementById("card-taker-select");
      const p = matchEngine.getAttackers(userSide).find(pl => String(pl.id) === sel.value);
      return { taker: p };
    }
    case "reversePenalty": {
      const sel = document.getElementById("card-opp-taker-select");
      const p = matchEngine.getAttackers(oppSide).find(pl => String(pl.id) === sel.value);
      return { taker: p };
    }
    case "starPlayer": {
      const sel = document.getElementById("card-star-select");
      const p = matchEngine.getAttackers(userSide).find(pl => String(pl.id) === sel.value);
      return { player: p };
    }
    default:
      return {};
  }
}

function openSecretCardModal() {
  if (!matchState || matchState.finished) return;
  if (!matchEngine.isSpecialActionWindowOpen(matchState.minute, "card")) return;
  const userSide = matchState.userSide;
  if (matchEngine.isCardUsed(userSide)) return;
  matchState.paused = true;
  document.getElementById("btn-pause-match").textContent = "▶ Reprendre";
  document.getElementById("halftime-overlay").classList.remove("active");
  updateMatchStatusBanner();

  const oppSide = userSide === "home" ? "away" : "home";
  const key = matchEngine.getCards()[userSide];
  const card = SECRET_CARDS[key];
  document.getElementById("secret-card-title").textContent = `${card.icon} ${card.name}`;

  const body = document.getElementById("secret-card-body");
  let html = `<p style="color:#aaa; font-size:0.85em; margin-bottom:10px;">${card.desc}</p>`;

  if (key === "joker") {
    html += `<label>Mode :</label>
      <select id="card-joker-mode" style="width:100%; padding:6px; border-radius:6px; margin-top:4px;">
        <option value="copy">Copier une autre Arme Secrète</option>
        <option value="steal">Voler la carte adverse</option>
      </select>
      <div id="card-joker-sub" style="margin-top:10px;"></div>`;
  } else {
    html += buildCardSubOptionsHtml(key, userSide, oppSide);
  }

  body.innerHTML = html;

  if (key === "joker") {
    const modeSelect = document.getElementById("card-joker-mode");
    const subDiv = document.getElementById("card-joker-sub");
    const updateSub = () => {
      if (modeSelect.value === "copy") {
        const others = SECRET_CARD_ORDER.filter(k => k !== "joker");
        subDiv.innerHTML = `<label>Carte à copier :</label>
          <select id="card-joker-copy-key" style="width:100%; padding:6px; border-radius:6px; margin-top:4px;">` +
          others.map(k => `<option value="${k}">${SECRET_CARDS[k].icon} ${SECRET_CARDS[k].name}</option>`).join("") +
          `</select><div id="card-joker-copy-sub" style="margin-top:10px;"></div>`;
        const copySelect = document.getElementById("card-joker-copy-key");
        const updateCopySub = () => {
          document.getElementById("card-joker-copy-sub").innerHTML = buildCardSubOptionsHtml(copySelect.value, userSide, oppSide);
        };
        copySelect.onchange = updateCopySub;
        updateCopySub();
      } else {
        const oppKey = matchEngine.getCards()[oppSide];
        const oppUsed = matchEngine.isCardUsed(oppSide);
        if (!oppKey || oppUsed) {
          subDiv.innerHTML = `<p style="color:#ff6b6b; margin-top:8px;">⚠️ Le vol échouera : l'adversaire a déjà activé sa carte.</p>`;
        } else {
          subDiv.innerHTML = `<p style="color:#aaa; margin-top:8px;">Tu voles et actives immédiatement la carte secrète adverse.</p>`;
        }
      }
    };
    modeSelect.onchange = updateSub;
    updateSub();
  }

  document.getElementById("btn-secret-card-confirm").disabled = false;
  document.getElementById("secret-card-modal").classList.add("active");
}

// Referme un modal qui avait mis le match en pause (Arme Secrète) et reprend la lecture — si des
// beats sont fournis (carte effectivement activée), ils s'intercalent dans la séquence en cours
// via insertNext AVANT que la lecture ne reprenne, pour que l'effet s'anime dès la reprise.
function resumeMatchAfterModal(beats) {
  if (choreo && beats && beats.length) choreo.insertNext(beats);
  if (matchState.atHalfTime) {
    document.getElementById("halftime-overlay").classList.add("active");
    return;
  }
  if (!matchState.finished) resumeMatchFlow();
}

function cancelSecretCard() {
  document.getElementById("secret-card-modal").classList.remove("active");
  resumeMatchAfterModal();
}

function confirmSecretCard() {
  const userSide = matchState.userSide;
  const oppSide = userSide === "home" ? "away" : "home";
  const key = matchEngine.getCards()[userSide];

  let options = {};
  if (key === "joker") {
    const mode = document.getElementById("card-joker-mode").value;
    if (mode === "steal") {
      options = { mode: "steal" };
    } else {
      const copyKey = document.getElementById("card-joker-copy-key").value;
      options = Object.assign({ mode: "copy", copyKey }, gatherCardOptions(copyKey, userSide, oppSide));
    }
  } else {
    options = gatherCardOptions(key, userSide, oppSide);
  }

  const evts = matchEngine.activateCard(userSide, key, options, matchState.minute);

  document.getElementById("secret-card-modal").classList.remove("active");
  updateSecretCardButton();
  resumeMatchAfterModal(tagCardBeats(evts.sequence));
}

// Appelé en fin de temps réglementaire. Si le score est à égalité, lance la
// séance de tirs au but (animée tir par tir) avant de finaliser le match.
function finishMatchDisplay() {
  matchState.paused = true;
  (matchState.subTimers || []).forEach(clearTimeout);
  matchState.subTimers = [];

  const score = matchEngine.getScore();
  if (score.homeGoals === score.awayGoals) {
    const tieText = matchEngine.isMatchDecided()
      ? "🥅 Place aux tirs au but !"
      : "⏱️ Fin du temps réglementaire — égalité ! Place aux tirs au but.";
    appendCommentaryEvent({ type: "phase", text: tieText });
    const shootout = simulatePenaltyShootout(matchState.homeTeam, matchState.homeSetup, matchState.awayTeam, matchState.awaySetup);
    matchState.shootoutPending = shootout;
    playShootoutStep(0);
  } else {
    completeMatch(null);
  }
}

// Diffuse les tirs au but un par un dans les commentaires.
function playShootoutStep(idx) {
  const shootout = matchState.shootoutPending;
  if (idx >= shootout.events.length) {
    completeMatch(shootout);
    return;
  }
  appendCommentaryEvent(shootout.events[idx]);
  matchState.subTimers.push(setTimeout(() => playShootoutStep(idx + 1), SHOOTOUT_TICK_MS));
}

// Finalise le match (avec ou sans séance de tirs au but) et affiche le résultat.
function completeMatch(shootout) {
  matchState.finished = true;
  matchState.paused = true;
  stopMatchPitch();
  const result = matchEngine.finalize(shootout);
  STATE.pendingResult = {
    result, homeTeam: matchState.homeTeam, awayTeam: matchState.awayTeam,
    homeSetup: matchState.homeSetup, awaySetup: matchState.awaySetup,
    team: matchState.team, opponent: matchState.opponent
  };

  document.getElementById("match-score").textContent = `${result.homeGoals} - ${result.awayGoals}`;
  document.getElementById("match-minute").textContent = matchState.minute + "'";
  const div = document.createElement("div");
  div.className = "ev";
  div.style.fontWeight = "bold";
  div.style.marginTop = "10px";
  div.textContent = "⏱️ Fin du match !";
  document.getElementById("commentary").appendChild(div);
  document.getElementById("commentary").scrollTop = document.getElementById("commentary").scrollHeight;

  document.getElementById("btn-pause-match").disabled = true;
  document.getElementById("btn-tactics-match").disabled = true;
  document.getElementById("btn-secret-card").disabled = true;
  document.getElementById("btn-president-penalty").disabled = true;
  document.getElementById("btn-match-speed").disabled = true;
  const skipBtn = document.getElementById("btn-skip-match");
  skipBtn.textContent = "Voir le résumé";
  skipBtn.onclick = showMatchSummary;
}

// Termine instantanément les minutes restantes du match (et la séance de tirs au but si besoin).
// Abandonne l'animation pour le reste du match : appelle simulateMinute SANS {withSequence:true}
// (donc aussi rapide et sans le moindre coût de séquence, exactement comme un match IA vs IA).
function appendCardEvents(evts) {
  (evts || []).forEach(ev => appendCommentaryEvent(ev.type === "phase" ? { ...ev, type: "phase cardevent" } : ev));
}

function skipMatch() {
  if (!matchState || matchState.finished) return;
  stopMatchPitch();
  (matchState.subTimers || []).forEach(clearTimeout);
  matchState.subTimers = [];
  document.getElementById("halftime-overlay").classList.remove("active");
  document.getElementById("match-tactics-modal").classList.remove("active");
  document.getElementById("phase-lineup-modal").classList.remove("active");
  phaseLineupState = null;
  matchState.atHalfTime = false;
  matchState.paused = true;

  // Le Matchball garantit une équipe gagnante avant la fin du temps réglementaire (40') : on
  // simule donc en prolongation au-delà si besoin, jusqu'au but décisif. MAX_MATCH_MINUTE n'est
  // qu'un garde-fou de sécurité contre une boucle interminable en cas de scénario extrême.
  while (matchState.minute < matchEngine.totalMinutes || (matchState.minute < MAX_MATCH_MINUTE && !matchEngine.isMatchDecided())) {
    matchState.minute++;
    const minuteEvents = matchEngine.simulateMinute(matchState.minute);
    minuteEvents.forEach(appendCommentaryEvent);
    appendCardEvents(maybeActivateAiCard(matchState.minute));
    appendCardEvents(maybeActivatePresidentPenaltyAi(matchState.minute));
    maybeAdjustAiTactics(matchState.minute);
    if (matchEngine.isMatchDecided()) break;
  }

  const score = matchEngine.getScore();
  document.getElementById("match-score").textContent = `${score.homeGoals} - ${score.awayGoals}`;
  document.getElementById("match-minute").textContent = matchState.minute + "'";

  if (matchEngine.isMatchDecided() && matchEngine.getMatchballWinner()) {
    const winnerSide = matchEngine.getMatchballWinner();
    const winnerName = winnerSide === "home" ? matchState.homeTeam.name : matchState.awayTeam.name;
    appendCommentaryEvent({ type: "phase", text: `🏆 MATCHBALL ! ${winnerName} inscrit le but décisif et remporte le match immédiatement !` });
    completeMatch(null);
  } else if (score.homeGoals === score.awayGoals) {
    const tieText = matchEngine.isMatchDecided()
      ? "🥅 Place aux tirs au but !"
      : "⏱️ Fin du temps réglementaire — égalité ! Place aux tirs au but.";
    appendCommentaryEvent({ type: "phase", text: tieText });
    const shootout = simulatePenaltyShootout(matchState.homeTeam, matchState.homeSetup, matchState.awayTeam, matchState.awaySetup);
    shootout.events.forEach(appendCommentaryEvent);
    completeMatch(shootout);
  } else {
    completeMatch(null);
  }
}

function showMatchSummary() {
  const { result, homeTeam, awayTeam, homeSetup, awaySetup } = STATE.pendingResult;

  document.getElementById("summary-home-name").textContent = homeTeam.name;
  document.getElementById("summary-away-name").textContent = awayTeam.name;
  let scoreText = `${result.homeGoals} - ${result.awayGoals}`;
  if (result.shootout) {
    scoreText += ` (tab ${result.shootout.homeScore} - ${result.shootout.awayScore})`;
  }
  document.getElementById("summary-score").textContent = scoreText;

  document.getElementById("bar-poss").style.width = result.homePossession + "%";
  document.getElementById("txt-poss").textContent = `${result.homePossession}% - ${result.awayPossession}%`;

  const totalShots = result.homeShots + result.awayShots || 1;
  document.getElementById("bar-shots").style.width = (result.homeShots / totalShots * 100) + "%";
  document.getElementById("txt-shots").textContent = `${result.homeShots} - ${result.awayShots}`;

  document.getElementById("summary-home-title").textContent = homeTeam.name + " — Notes";
  document.getElementById("summary-away-title").textContent = awayTeam.name + " — Notes";

  function renderRatings(team, setup, tbodyId) {
    const tbody = document.getElementById(tbodyId);
    tbody.innerHTML = "";
    setup.lineup.forEach(id => {
      const p = team.players.find(pl => pl.id === id);
      if (!p) return;
      const stat = result.playerStats[id];
      const goalsText = stat && stat.goals ? ` ⚽x${stat.goals}` : "";
      const assistText = stat && stat.assists ? ` 🅰️x${stat.assists}` : "";
      const tr = document.createElement("tr");
      tr.innerHTML = `<td class="name">${p.name}${goalsText}${assistText}</td><td><b>${result.ratings[id].toFixed(1)}</b></td>`;
      tbody.appendChild(tr);
    });
  }
  renderRatings(homeTeam, homeSetup, "summary-home-ratings");
  renderRatings(awayTeam, awaySetup, "summary-away-ratings");

  showScreen("screen-summary");
}

function continueAfterMatch() {
  const { result, homeTeam, awayTeam, homeSetup, awaySetup } = STATE.pendingResult;

  // applique les stats aux joueurs (partagé avec les matchs IA vs IA, voir engine.js:applyMatchPlayerStats)
  applyMatchPlayerStats(homeTeam, homeSetup, result);
  applyMatchPlayerStats(awayTeam, awaySetup, result);

  updateFormAfterMatch(homeTeam, homeSetup, result.homeGoals, result.awayGoals, result.ratings);
  updateFormAfterMatch(awayTeam, awaySetup, result.awayGoals, result.homeGoals, result.ratings);

  // match du tournoi de fin de saison (pas un match de championnat) : résout le match du bracket
  // concerné et retourne à l'écran du tournoi plutôt qu'au calendrier.
  if (STATE.tournamentMatchRef) {
    const m = STATE.tournamentMatchRef;
    m.played = true; m.homeGoals = result.homeGoals; m.awayGoals = result.awayGoals; m.penaltyWinner = result.penaltyWinner;
    m.winner = result.homeGoals !== result.awayGoals
      ? (result.homeGoals > result.awayGoals ? m.home : m.away)
      : (result.penaltyWinner === "home" ? m.home : m.away);
    STATE.tournamentMatchRef = null;
    saveGame();
    openTournamentScreen();
    return;
  }

  // enregistre le résultat
  const round = STATE.schedule[STATE.currentRound];
  const userMatch = lineupSetup.userMatch;
  const r = STATE.league.results.find(rr => rr.round === STATE.currentRound && rr.home === userMatch.home && rr.away === userMatch.away);
  r.played = true; r.homeGoals = result.homeGoals; r.awayGoals = result.awayGoals; r.penaltyWinner = result.penaltyWinner;

  // simule les autres matchs de la journée (IA)
  simulateRoundAI(userMatch);

  STATE.currentRound++;
  rollNotificationsForToday();
  updateTopbar();
  showScreen("screen-main");
  showTab("calendar");
  saveGame();
}

// ===================== INIT =====================
document.addEventListener("DOMContentLoaded", () => {
  initHomeScreen();
  showScreen("screen-home");

  document.getElementById("btn-start").onclick = startCareer;
  document.getElementById("btn-restart").onclick = () => {
    STATE.leagueKey = null;
    STATE.league = null;
    STATE.userTeamId = null;
    STATE.schedule = [];
    STATE.currentRound = 0;
    STATE.currentDay = 0;
    STATE.notifications = [];
    STATE.pendingLineup = null;
    STATE.pendingResult = null;
    STATE.mercatoOpen = false;
    STATE.savedTactic = null;
    STATE.currentSlotId = null;
    STATE.otherLeagues = null;
    STATE.tournament = null;
    STATE.tournamentMatchRef = null;
    initHomeScreen();
    showScreen("screen-home");
  };

  document.getElementById("import-save-input").onchange = (e) => {
    const file = e.target.files[0];
    if (file) importSaveFile(file);
    e.target.value = "";
  };

  document.querySelectorAll(".nav button").forEach(btn => {
    btn.onclick = () => showTab(btn.dataset.tab);
  });

  document.getElementById("btn-play-match").onclick = startMatch;
  document.getElementById("btn-skip-match").onclick = skipMatch;
  document.getElementById("btn-continue").onclick = continueAfterMatch;

  document.getElementById("btn-pause-match").onclick = togglePauseMatch;
  document.getElementById("btn-tactics-match").onclick = openMatchTactics;
  document.getElementById("btn-match-speed").onclick = cycleMatchSpeed;
  document.getElementById("btn-halftime-continue").onclick = continueAfterHalfTime;
  document.getElementById("btn-halftime-tactics").onclick = openMatchTactics;
  document.getElementById("btn-close-tactics-modal").onclick = closeMatchTactics;

  document.getElementById("btn-phase-lineup-confirm").onclick = confirmPhaseLineup;
  document.getElementById("btn-phase-lineup-auto").onclick = autoPhaseLineup;

  document.getElementById("btn-secret-card").onclick = openSecretCardModal;
  document.getElementById("btn-president-penalty").onclick = triggerUserPresidentPenalty;
  document.getElementById("btn-president-select-cancel").onclick = () => {
    document.getElementById("president-select-modal").classList.remove("active");
  };
  document.getElementById("btn-secret-card-cancel").onclick = cancelSecretCard;
  document.getElementById("btn-secret-card-confirm").onclick = confirmSecretCard;

  setupMatchPitchPointerEvents();

  document.getElementById("btn-player-info-close").onclick = closePlayerInfoModal;

  document.getElementById("btn-compare-close").onclick = closeCompareModal;
  document.getElementById("btn-open-compare").onclick = openCompareModal;
  document.getElementById("btn-clear-compare").onclick = () => {
    compareIds = [];
    renderCompareTray();
    renderMarketTable(getUserTeam());
    renderShortlistTable(getUserTeam());
  };

  document.getElementById("offer-cancel").onclick = closeOfferModal;
  document.getElementById("offer-submit").onclick = submitOffer;

  document.getElementById("filter-pos").onchange = renderTransfersTab;
  document.getElementById("filter-ovr").onchange = renderTransfersTab;
  document.getElementById("filter-name").oninput = renderTransfersTab;
  document.getElementById("filter-league").onchange = renderTransfersTab;

  document.querySelectorAll(".mercato-subtab-btn").forEach(btn => {
    btn.onclick = () => showMercatoSubtab(btn.dataset.subtab);
  });

  window.addEventListener("beforeunload", saveGame);
});
