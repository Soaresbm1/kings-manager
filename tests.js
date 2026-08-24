// ===================== TESTS AUTOMATISÉS (data.js + engine.js) =====================
// Suite de tests manuelle, sans framework ni node_modules : couvre la couche "pure" du jeu
// (données + moteur de simulation, aucun DOM) pour repérer une régression silencieuse à chaque
// changement du moteur, sans devoir tout re-vérifier à l'œil.
//
// Comment lancer :
//   - Dans un navigateur (toujours possible, aucun serveur requis, comme index.html) :
//     ouvrir tests.html.
//   - Avec Node, si disponible dans l'environnement (voir CLAUDE.md — pas garanti) :
//     node tests-node.js
//
// Beaucoup de fonctions testées ici utilisent Math.random() (résultat d'un match, décisions IA,
// mercato...) : on vérifie donc des INVARIANTS structurels (pas de match nul, l'argent total d'une
// ligue est conservé après un transfert, personne ne disparaît de l'effectif...) plutôt que des
// valeurs exactes, à quelques exceptions déterministes près (calendrier, classement, value()).

const TEST_CASES = [];
function test(name, fn) { TEST_CASES.push({ name, fn }); }

function assert(cond, msg) {
  if (!cond) throw new Error(msg || "assertion échouée");
}
function assertEqual(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error(`${msg || "valeurs différentes"} — attendu ${JSON.stringify(expected)}, reçu ${JSON.stringify(actual)}`);
  }
}

// Exécute tous les tests enregistrés via test(...) et renvoie un résumé ; ne lance rien tout
// seul (tests.html / tests-node.js appellent runAllTests() explicitement une fois tout le
// contexte — data.js, engine.js, ce fichier — chargé).
function runAllTests() {
  const results = TEST_CASES.map(({ name, fn }) => {
    try {
      fn();
      return { name, pass: true };
    } catch (e) {
      return { name, pass: false, error: e.message };
    }
  });
  return {
    passed: results.filter(r => r.pass).length,
    failed: results.filter(r => !r.pass).length,
    results
  };
}

// ----------------- INTÉGRITÉ DES DONNÉES (data.js) -----------------

test("les 6 ligues attendues existent et ont des équipes", () => {
  ["france", "brazil", "spain", "italy", "germany", "mexico"].forEach(key => {
    assert(LEAGUES[key] && LEAGUES[key].teams && LEAGUES[key].teams.length > 0, `ligue "${key}" manquante ou vide`);
  });
});

test("chaque club a assez de joueurs par poste pour composer n'importe quelle formation (MIN_PLAYERS_PER_POS)", () => {
  Object.values(LEAGUES).forEach(league => {
    league.teams.forEach(team => {
      Object.entries(MIN_PLAYERS_PER_POS).forEach(([pos, min]) => {
        const count = team.players.filter(p => p.pos === pos).length;
        assert(count >= min, `${team.name} (${league.name}) : ${count} ${pos}, minimum requis ${min}`);
      });
    });
  });
});

test("chaque joueur a des attributs dans les bornes (0-99) et un id unique dans son club", () => {
  Object.values(LEAGUES).forEach(league => {
    league.teams.forEach(team => {
      const seenIds = new Set();
      team.players.forEach(p => {
        ["speed", "technique", "physical", "mental"].forEach(attr => {
          assert(p[attr] >= 0 && p[attr] <= 99, `${p.name} (${team.name}) : ${attr}=${p[attr]} hors bornes`);
        });
        assert(POSITIONS.includes(p.pos), `${p.name} (${team.name}) : poste invalide "${p.pos}"`);
        assert(!seenIds.has(p.id), `id dupliqué dans ${team.name} : ${p.id}`);
        seenIds.add(p.id);
      });
    });
  });
});

test("value() : un profil 5 étoiles coûte proportionnellement plus cher qu'un profil 0-1 étoile", () => {
  const elite = player("Test Elite", "ATT", 95, 95, 95, 95, 24);   // overall ~95 -> 5 étoiles
  const weak = player("Test Faible", "DEF", 60, 60, 60, 60, 24);   // overall ~60 -> 0 étoile
  const ratioElite = elite.value / elite.overall;
  const ratioWeak = weak.value / weak.overall;
  assert(ratioElite > ratioWeak * 1.2,
    `prime étoile insuffisante : €/overall elite=${ratioElite.toFixed(1)} vs faible=${ratioWeak.toFixed(1)}`);
});

test("INJURY_SEVERITY_TIERS : paliers cohérents (seuils croissants, bornes de jours valides)", () => {
  let lastChance = 0;
  INJURY_SEVERITY_TIERS.forEach(tier => {
    assert(tier.chance > lastChance, `paliers non strictement croissants autour de "${tier.label}"`);
    assert(tier.minDays <= tier.maxDays, `${tier.label} : minDays (${tier.minDays}) > maxDays (${tier.maxDays})`);
    lastChance = tier.chance;
  });
  assert(lastChance >= 1, "le dernier palier doit couvrir tout tirage possible de Math.random() (toujours < 1)");
});

// ----------------- CALENDRIER (generateSchedule) -----------------

test("generateSchedule : round-robin double, chaque paire se rencontre 1 fois dans chaque sens", () => {
  const ids = ["a", "b", "c", "d", "e", "f"]; // nombre pair, pas de bye
  const schedule = generateSchedule(ids);
  assertEqual(schedule.length, (ids.length - 1) * 2, "nombre de journées");
  const seen = {};
  schedule.forEach(round => {
    const playedThisRound = new Set();
    round.forEach(m => {
      assert(m.home !== m.away, "une équipe ne peut pas se rencontrer elle-même");
      assert(!playedThisRound.has(m.home) && !playedThisRound.has(m.away), "une équipe joue 2 fois la même journée");
      playedThisRound.add(m.home);
      playedThisRound.add(m.away);
      const key = m.home + "|" + m.away;
      seen[key] = (seen[key] || 0) + 1;
    });
  });
  ids.forEach(a => ids.forEach(b => {
    if (a === b) return;
    assertEqual(seen[a + "|" + b] || 0, 1, `paire ${a}→${b} : ${seen[a + "|" + b] || 0} match(s) dans ce sens (attendu 1)`);
  }));
});

test("generateSchedule : un nombre impair d'équipes ne fuite jamais de bye dans le calendrier", () => {
  const schedule = generateSchedule(["a", "b", "c", "d", "e"]);
  schedule.forEach(round => round.forEach(m => {
    assert(m.home !== null && m.away !== null, "un bye a fuité dans un match du calendrier");
  }));
});

// ----------------- CLASSEMENT (computeStandings) -----------------

test("computeStandings : 1 point par match joué, personne aux tirs au but ne repart bredouille", () => {
  const league = {
    teams: [{ id: "a", name: "A", color: "#000" }, { id: "b", name: "B", color: "#000" }, { id: "c", name: "C", color: "#000" }],
    results: [
      { home: "a", away: "b", played: true, homeGoals: 2, awayGoals: 1, penaltyWinner: null },
      { home: "b", away: "c", played: true, homeGoals: 1, awayGoals: 1, penaltyWinner: "away" },
      { home: "c", away: "a", played: false, homeGoals: 0, awayGoals: 0, penaltyWinner: null }
    ]
  };
  const table = computeStandings(league);
  const totalPoints = table.reduce((s, t) => s + t.points, 0);
  assertEqual(totalPoints, 2, "2 matchs joués = 2 points distribués au total (pas de match nul)");
  assertEqual(table.find(t => t.id === "a").points, 1, "A bat B 2-1");
  assertEqual(table.find(t => t.id === "c").points, 1, "C gagne aux tirs au but contre B");
  assertEqual(table.find(t => t.id === "b").points, 0, "B a perdu ses 2 matchs joués");
});

// ----------------- MOTEUR DE MATCH (simulateMatch / simulateAIMatch) -----------------

test("simulateAIMatch : jamais de match nul (règle Kings League — tirs au but si égalité)", () => {
  const home = JSON.parse(JSON.stringify(LEAGUES.france.teams[0]));
  const away = JSON.parse(JSON.stringify(LEAGUES.france.teams[1]));
  const result = simulateAIMatch(home, away);
  assert(result.homeGoals !== result.awayGoals || result.penaltyWinner, "égalité sans vainqueur désigné aux tirs au but");
});

test("simulateAIMatch : chaque joueur aligné reçoit une note", () => {
  const home = JSON.parse(JSON.stringify(LEAGUES.brazil.teams[0]));
  const away = JSON.parse(JSON.stringify(LEAGUES.brazil.teams[1]));
  const homeChoice = chooseAiFormation(home); // déterministe (pas de Math.random) : même résultat que celui utilisé en interne par simulateAIMatch
  const result = simulateAIMatch(home, away);
  homeChoice.assignments.forEach(id => assert(result.ratings[id] !== undefined, `pas de note pour le joueur ${id}`));
});

test("simulateAIMatch : incrémente le total de matchs joués sur l'effectif aligné", () => {
  const home = JSON.parse(JSON.stringify(LEAGUES.spain.teams[0]));
  const away = JSON.parse(JSON.stringify(LEAGUES.spain.teams[1]));
  const totalBefore = home.players.reduce((s, p) => s + p.matches, 0);
  simulateAIMatch(home, away);
  const totalAfter = home.players.reduce((s, p) => s + p.matches, 0);
  assert(totalAfter > totalBefore, "aucun joueur de l'équipe à domicile n'a gagné de match joué");
});

// ----------------- STATS SAISON vs CARRIÈRE (applyMatchPlayerStats) -----------------

test("applyMatchPlayerStats : les stats carrière survivent à une remise à zéro des stats de saison", () => {
  const team = JSON.parse(JSON.stringify(LEAGUES.italy.teams[0]));
  const choice = chooseAiFormation(team);
  const lineup = choice.assignments.filter(Boolean);
  const result = { playerStats: {}, ratings: {} };
  lineup.forEach(id => { result.playerStats[id] = { goals: 1, assists: 0 }; result.ratings[id] = 7; });
  applyMatchPlayerStats(team, { lineup }, result);

  const scorerId = lineup[0];
  let p = team.players.find(pl => pl.id === scorerId);
  assertEqual(p.goals, 1, "but de saison compté");
  assertEqual(p.careerGoals, 1, "but de carrière compté");

  // simule ce que fait startNewSeason() : remise à zéro des stats de SAISON uniquement
  team.players.forEach(pl => { pl.goals = 0; pl.assists = 0; pl.matches = 0; pl.ratingSum = 0; });
  p = team.players.find(pl => pl.id === scorerId);
  assertEqual(p.goals, 0, "stats de saison bien remises à zéro");
  assertEqual(p.careerGoals, 1, "careerGoals n'aurait jamais dû être touché par un reset de saison");
});

// ----------------- MERCATO IA (fillPositionGaps / simulateAITransfers / neediestTeamForPosition) -----------------

test("simulateAITransfers (30 fenêtres) : conserve le nombre de joueurs ET l'argent total de la ligue", () => {
  const league = { teams: LEAGUES.mexico.teams.map(t => JSON.parse(JSON.stringify(t))) };
  const totalPlayersBefore = league.teams.reduce((s, t) => s + t.players.length, 0);
  const totalMoneyBefore = league.teams.reduce((s, t) => s + t.budget, 0);
  // une seule fenêtre a une chance non négligeable de ne déclencher aucun mouvement (probas
  // 20%/25% par équipe) : on en enchaîne 30 pour quasi-garantir qu'au moins un transfert ait
  // vraiment lieu, sinon le test ne vérifierait jamais rien.
  for (let i = 0; i < 30; i++) simulateAITransfers(league, null);
  const totalPlayersAfter = league.teams.reduce((s, t) => s + t.players.length, 0);
  const totalMoneyAfter = league.teams.reduce((s, t) => s + t.budget, 0);
  assertEqual(totalPlayersAfter, totalPlayersBefore, "des joueurs ont disparu ou été dupliqués pendant le mercato IA");
  assertEqual(totalMoneyAfter, totalMoneyBefore, "l'argent total de la ligue n'est pas conservé (un transfert n'a pas déplacé les fonds symétriquement)");
});

test("neediestTeamForPosition : ignore l'équipe exclue et priorise celle sans aucun joueur au poste", () => {
  const league = {
    teams: [
      { id: "a", players: [player("PA", "DEF", 90, 90, 90, 90, 25)] },
      { id: "b", players: [player("PB", "DEF", 60, 60, 60, 60, 25)] },
      { id: "c", players: [] } // aucun joueur à ce poste = besoin maximal
    ]
  };
  const needy = neediestTeamForPosition(league, "DEF", "a");
  assertEqual(needy.id, "c", "l'équipe sans joueur à ce poste devrait être jugée la plus prioritaire");
});

test("weakestPosition : identifie le poste à la moyenne d'overall la plus basse", () => {
  const team = {
    players: [
      player("G", "GK", 90, 90, 90, 90, 25),
      player("D1", "DEF", 60, 60, 60, 60, 25),
      player("D2", "DEF", 65, 65, 65, 65, 25),
      player("A", "ATT", 90, 90, 90, 90, 25)
    ]
  };
  assertEqual(weakestPosition(team), "DEF", "DEF a la moyenne d'overall la plus basse de cet effectif");
});

// ----------------- CLASSEMENTS INDIVIDUELS (computeTopScorers / computeTopAssists / computeTopRatings) -----------------

test("computeTopScorers : trie par buts décroissants et respecte la limite demandée", () => {
  const league = {
    teams: [{
      id: "a", name: "A", players: [
        Object.assign(player("P1", "ATT", 70, 70, 70, 70, 25), { goals: 5 }),
        Object.assign(player("P2", "ATT", 70, 70, 70, 70, 25), { goals: 9 }),
        Object.assign(player("P3", "ATT", 70, 70, 70, 70, 25), { goals: 0 })
      ]
    }]
  };
  const top = computeTopScorers(league, 1);
  assertEqual(top.length, 1, "la limite de 1 résultat n'est pas respectée");
  assertEqual(top[0].p.name, "P2", "le joueur avec le plus de buts devrait être en tête");
});

// ----------------- IA TACTIQUE (chooseAiFormation / chooseAiPlans) -----------------

test("chooseAiFormation : compose toujours un XI complet (7 postes) sur un vrai club", () => {
  const team = LEAGUES.germany.teams[0];
  const choice = chooseAiFormation(team);
  assertEqual(choice.assignments.length, 7, "une formation Kings League compte 7 postes (1 GK + 6 joueurs de champ)");
  assert(choice.assignments.every(Boolean), "au moins un poste est resté sans titulaire");
});

test("chooseAiPlans : renvoie toujours un plan d'attaque/défense parmi les valeurs valides", () => {
  const plans = chooseAiPlans({ overall: 80 }, { overall: 60 });
  assert(["direct", "possession", "transition"].includes(plans.attackPlan), `attackPlan invalide : ${plans.attackPlan}`);
  assert(["low", "high", "zone"].includes(plans.defensePlan), `defensePlan invalide : ${plans.defensePlan}`);
});
