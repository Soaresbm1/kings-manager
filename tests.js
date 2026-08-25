// ===================== TESTS AUTOMATISÉS (data.js + engine.js + matchchoreo.js) =====================
// Suite de tests manuelle, sans framework ni node_modules : couvre la couche "pure" du jeu
// (données + moteurs de simulation, aucun DOM) pour repérer une régression silencieuse à chaque
// changement du moteur, sans devoir tout re-vérifier à l'œil.
//
// Comment lancer :
//   - Dans un navigateur (toujours possible, aucun serveur requis, comme index.html) :
//     ouvrir tests.html.
//   - Avec Node, si disponible dans l'environnement (voir CLAUDE.md — pas garanti) :
//     node tests-node.js
//
// data.js/engine.js utilisent Math.random() (résultat d'un match, décisions IA, mercato, ET la
// génération des "beats" de simulateMinute({withSequence:true}) — voir engine.js) : on y vérifie
// donc des INVARIANTS structurels (pas de match nul, l'argent total d'une ligue est conservé après
// un transfert, chaque beat a des positions/ids valides...) plutôt que des valeurs exactes, à
// quelques exceptions déterministes près (calendrier, classement, value()).
// matchchoreo.js, à l'inverse, n'utilise AUCUN Math.random() (l'interpolation d'une séquence de
// beats déjà fixée est entièrement déterministe) : ses tests vérifient donc des valeurs exactes
// (à une tolérance flottante près) partout où c'est possible, plutôt que de se contenter
// d'invariants.

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
// Comparaison à tolérance flottante — nécessaire dès qu'un calcul passe par une racine carrée, une
// puissance non entière, ou une somme de nombreuses petites étapes (ex. friction sur plusieurs
// sous-pas) : l'égalité stricte échouerait sur du bruit d'arrondi IEEE-754 sans rapport avec une
// vraie régression.
function assertClose(actual, expected, tolerance, msg) {
  if (Math.abs(actual - expected) > tolerance) {
    throw new Error(`${msg || "valeurs trop différentes"} — attendu ≈${expected} (±${tolerance}), reçu ${actual}`);
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

// ===================== GÉOMÉTRIE DU TERRAIN (engine.js) =====================
// Helpers purs (migrés depuis l'ancien matchphysics.js, engine.js en a maintenant besoin lui-même
// pour placer les joueurs sur les beats — voir simulateMinute({withSequence:true}) plus bas).

test("clamp : borne bien aux deux extrémités et laisse passer une valeur déjà dans l'intervalle", () => {
  assertEqual(clamp(5, 0, 10), 5, "valeur déjà dans l'intervalle");
  assertEqual(clamp(-5, 0, 10), 0, "borne basse");
  assertEqual(clamp(15, 0, 10), 10, "borne haute");
});

test("computeOutfieldAnchors(n) : renvoie exactement n ancrages, tous dans des bornes plausibles", () => {
  for (let n = 1; n <= 6; n++) {
    const anchors = computeOutfieldAnchors(n);
    assertEqual(anchors.length, n, `n=${n}`);
    anchors.forEach(a => {
      assert(a.depth >= 0 && a.depth <= 1, `n=${n} : depth ${a.depth} hors [0,1]`);
      assert(a.x >= 0 && a.x <= 100, `n=${n} : x ${a.x} hors [0,100]`);
    });
  }
});

test("anchorToY : reste strictement dans sa propre moitié de terrain, quel que soit le côté", () => {
  [0, 0.5, 1].forEach(depth => {
    const yHome = anchorToY(depth, "home");
    const yAway = anchorToY(depth, "away");
    assert(yHome >= 4 && yHome <= 44, `home depth=${depth} : y=${yHome} déborde de sa moitié`);
    assert(yAway >= 56 && yAway <= 96, `away depth=${depth} : y=${yAway} déborde de sa moitié`);
  });
});

test("gkAnchorY : gardien collé à sa propre ligne de but", () => {
  assertEqual(gkAnchorY("home"), 5, "gardien home");
  assertEqual(gkAnchorY("away"), 95, "gardien away");
});

// ===================== SÉQUENCE ANIMÉE DU MATCH HUMAIN (engine.js) =====================
// simulateMinute(minute, {withSequence:true}) utilise Math.random() (mêmes décisions que le
// chemin IA) : on vérifie donc des invariants structurels sur les beats produits, pas des valeurs
// exactes — répété sur plusieurs minutes/graines pour couvrir les branches "chance ratée"/"but"/
// "arrêt" au moins une fois.
const CHOREO_BEAT_TYPES = ["pass", "dribble", "tackle", "shot", "goal", "save", "miss", "owngoal", "phase"];

function assertValidSequence(sequence, homeTeam, awayTeam, label) {
  assert(Array.isArray(sequence), `${label} : sequence doit être un tableau`);
  const allIds = new Set([...homeTeam.players.map(p => p.id), ...awayTeam.players.map(p => p.id)]);
  sequence.forEach((beat, i) => {
    assert(CHOREO_BEAT_TYPES.includes(beat.type), `${label} beat[${i}] : type invalide "${beat.type}"`);
    ["from", "to"].forEach(k => {
      assert(beat[k] && beat[k].x >= 0 && beat[k].x <= 100 && beat[k].y >= 0 && beat[k].y <= 100,
        `${label} beat[${i}].${k} hors du terrain [0,100]x[0,100]`);
    });
    assert(typeof beat.duration === "number" && beat.duration >= 0, `${label} beat[${i}] : duration invalide`);
    [beat.playerId, beat.toPlayerId, beat.gkId].forEach(id => {
      assert(id === null || id === undefined || allIds.has(id), `${label} beat[${i}] : id de joueur inconnu "${id}"`);
    });
    if (beat.type === "pass") {
      assert(beat.playerId !== beat.toPlayerId, `${label} beat[${i}] : passe d'un joueur à lui-même (${beat.playerId})`);
    }
    if (beat.mark) {
      assert(allIds.has(beat.mark.id), `${label} beat[${i}].mark : id de joueur inconnu "${beat.mark.id}"`);
      ["from", "to"].forEach(k => {
        assert(beat.mark[k] && beat.mark[k].x >= 0 && beat.mark[k].x <= 100 && beat.mark[k].y >= 0 && beat.mark[k].y <= 100,
          `${label} beat[${i}].mark.${k} hors du terrain [0,100]x[0,100]`);
      });
    }
  });
}

test("simulateMinute({withSequence:true}) : produit une séquence de beats structurellement valide, minute après minute", () => {
  const home = JSON.parse(JSON.stringify(LEAGUES.france.teams[0]));
  const away = JSON.parse(JSON.stringify(LEAGUES.france.teams[1]));
  const homeChoice = chooseAiFormation(home), awayChoice = chooseAiFormation(away);
  const homeSetup = { lineup: homeChoice.assignments.filter(Boolean), assignments: homeChoice.assignments, formation: homeChoice.formation, attackPlan: "possession", defensePlan: "zone" };
  const awaySetup = { lineup: awayChoice.assignments.filter(Boolean), assignments: awayChoice.assignments, formation: awayChoice.formation, attackPlan: "direct", defensePlan: "low" };
  const engine = createMatchEngine(home, homeSetup, away, awaySetup);
  for (let minute = 1; minute <= 40; minute++) {
    const evts = engine.simulateMinute(minute, { withSequence: true });
    assert(Array.isArray(evts.sequence), `minute ${minute} : sequence manquante sur les événements renvoyés`);
    assertValidSequence(evts.sequence, home, away, `minute ${minute}`);
    if (engine.isMatchDecided()) break;
  }
});

test("simulateMinute({withSequence:true}) : même en 1v1 (escalier, minute 1), le porteur de balle fait un vrai porté (beats \"dribble\"), pas un saut direct passe→tir", () => {
  const home = JSON.parse(JSON.stringify(LEAGUES.spain.teams[0]));
  const away = JSON.parse(JSON.stringify(LEAGUES.spain.teams[1]));
  const homeChoice = chooseAiFormation(home), awayChoice = chooseAiFormation(away);
  const homeSetup = { lineup: homeChoice.assignments.filter(Boolean), assignments: homeChoice.assignments, formation: homeChoice.formation, attackPlan: "direct", defensePlan: "zone" };
  const awaySetup = { lineup: awayChoice.assignments.filter(Boolean), assignments: awayChoice.assignments, formation: awayChoice.formation, attackPlan: "direct", defensePlan: "zone" };
  const engine = createMatchEngine(home, homeSetup, away, awaySetup);
  // Enchaîne plusieurs minutes en 1v1/2v2 (l'escalier ne dépasse pas la 5e minute) pour avoir de
  // bonnes chances qu'au moins une possession (réelle ou ambiante, désormais garanties par camp)
  // ait eu lieu — sur un tirage aussi favorable, ce n'est jamais un hasard malheureux à tester.
  let sawDribble = false, sawMark = false;
  for (let minute = 1; minute <= 4; minute++) {
    const evts = engine.simulateMinute(minute, { withSequence: true });
    evts.sequence.forEach(beat => {
      if (beat.type === "dribble") sawDribble = true;
      if (beat.mark) sawMark = true;
    });
  }
  assert(sawDribble, "aucun beat \"dribble\" (porté de balle) sur les 4 premières minutes en effectif réduit");
  assert(sawMark, "aucun beat n'a de défenseur en chasse (mark) sur les 4 premières minutes en effectif réduit");
});

test("simulateMinute sans options : ne construit aucune séquence (chemin IA inchangé, coût nul)", () => {
  const home = JSON.parse(JSON.stringify(LEAGUES.brazil.teams[0]));
  const away = JSON.parse(JSON.stringify(LEAGUES.brazil.teams[1]));
  const homeChoice = chooseAiFormation(home), awayChoice = chooseAiFormation(away);
  const homeSetup = { lineup: homeChoice.assignments.filter(Boolean), assignments: homeChoice.assignments, formation: homeChoice.formation, attackPlan: "direct", defensePlan: "zone" };
  const awaySetup = { lineup: awayChoice.assignments.filter(Boolean), assignments: awayChoice.assignments, formation: awayChoice.formation, attackPlan: "direct", defensePlan: "zone" };
  const engine = createMatchEngine(home, homeSetup, away, awaySetup);
  for (let minute = 1; minute <= 10; minute++) {
    const evts = engine.simulateMinute(minute);
    assertEqual(evts.sequence, undefined, `minute ${minute} : sequence ne devrait pas exister sans withSequence`);
  }
});

test("getFormationAnchors : une ancre par joueur actif (GK inclus), toutes sur le terrain", () => {
  const home = LEAGUES.italy.teams[0];
  const away = LEAGUES.italy.teams[1];
  const homeChoice = chooseAiFormation(home), awayChoice = chooseAiFormation(away);
  const homeSetup = { lineup: homeChoice.assignments.filter(Boolean), assignments: homeChoice.assignments, formation: homeChoice.formation, attackPlan: "direct", defensePlan: "zone" };
  const awaySetup = { lineup: awayChoice.assignments.filter(Boolean), assignments: awayChoice.assignments, formation: awayChoice.formation, attackPlan: "direct", defensePlan: "zone" };
  const engine = createMatchEngine(home, homeSetup, away, awaySetup);
  const anchors = engine.getFormationAnchors("home", 20); // 7v7 (hors escalier/dé géant/matchball)
  assertEqual(Object.keys(anchors).length, 7, "7 ancres attendues (1 GK + 6 joueurs de champ) en 7v7");
  Object.values(anchors).forEach(a => {
    assert(a.x >= 0 && a.x <= 100 && a.y >= 0 && a.y <= 100, "ancre hors du terrain");
  });
});

// ===================== CHORÉGRAPHIE (matchchoreo.js) =====================
// Aucun Math.random() dans ce fichier : une fois les beats fixés, l'interpolation est entièrement
// déterministe — on peut donc comparer des valeurs exactes plutôt que de se contenter d'invariants.

test("createChoreographer/setAnchors : place chaque nouvel entrant directement sur son ancre", () => {
  const choreo = createChoreographer();
  choreo.setAnchors({ h1: { x: 30, y: 20 } }, { a1: { x: 70, y: 80 } });
  const state = choreo.getState();
  assertEqual(state.players.length, 2, "2 joueurs actifs (1 par camp)");
  const h1 = state.players.find(p => p.id === "h1");
  assertEqual(h1.x, 30, "h1.x placé directement sur son ancre");
  assertEqual(h1.y, 20, "h1.y placé directement sur son ancre");
});

test("setAnchors : un joueur qui sort de l'ancrage (sub/carton) disparaît, sans toucher à l'autre camp", () => {
  const choreo = createChoreographer();
  choreo.setAnchors({ h1: { x: 10, y: 10 }, h2: { x: 20, y: 20 } }, { a1: { x: 80, y: 80 } });
  choreo.setAnchors({ h1: { x: 10, y: 10 } }, { a1: { x: 80, y: 80 } }); // h2 sort
  const ids = choreo.getState().players.map(p => p.id).sort();
  assertEqual(ids.join(","), "a1,h1", "h2 doit avoir disparu, h1 et a1 doivent rester");
});

test("step : une passe fait avancer le ballon de from vers to, exactement selon l'easing attendu", () => {
  const choreo = createChoreographer();
  choreo.setAnchors({ h1: { x: 20, y: 20 }, h2: { x: 40, y: 40 } }, {});
  choreo.loadSequence([{ type: "pass", side: "home", playerId: "h1", toPlayerId: "h2", from: { x: 20, y: 20 }, to: { x: 60, y: 60 }, duration: 1, event: null }]);
  choreo.step(0.5); // mi-parcours du beat
  const midT = 0.5, eased = midT < 0.5 ? 2 * midT * midT : 1 - Math.pow(-2 * midT + 2, 2) / 2; // easeInOutQuad(0.5) = 0.5
  const state = choreo.getState();
  assertClose(state.ball.x, 20 + (60 - 20) * eased, 1e-9, "ballon à mi-parcours de la passe (x)");
  assertClose(state.ball.y, 20 + (60 - 20) * eased, 1e-9, "ballon à mi-parcours de la passe (y)");
  assert(!choreo.isSequenceDone(), "le beat n'est pas terminé à mi-parcours");
});

test("step : un beat qui se termine restitue son event exactement une fois, dans consumeFinishedEvents", () => {
  const choreo = createChoreographer();
  choreo.setAnchors({ h1: { x: 50, y: 20 } }, {});
  const ev = { minute: 10, type: "goal", text: "but !" };
  choreo.loadSequence([{ type: "shot", side: "home", playerId: "h1", from: { x: 50, y: 20 }, to: { x: 50, y: 5 }, duration: 0.5, event: ev }]);
  choreo.step(0.5);
  assert(choreo.isSequenceDone(), "le beat unique doit être terminé après exactement sa durée");
  const finished = choreo.consumeFinishedEvents();
  assertEqual(finished.length, 1, "un seul event terminé");
  assertEqual(finished[0], ev, "l'event restitué doit être exactement celui du beat");
  assertEqual(choreo.consumeFinishedEvents().length, 0, "un event ne doit être restitué qu'une seule fois");
});

test("getState().ballCarrierId : le porteur du ballon pour le beat courant, null pendant une passe (ballon en vol) ou une annonce", () => {
  const choreo = createChoreographer();
  choreo.setAnchors({ h1: { x: 50, y: 20 }, h2: { x: 50, y: 30 } }, {});
  choreo.loadSequence([
    { type: "pass", side: "home", playerId: "h2", toPlayerId: "h1", from: { x: 50, y: 30 }, to: { x: 50, y: 20 }, duration: 0.5, event: null },
    { type: "dribble", side: "home", playerId: "h1", from: { x: 50, y: 20 }, to: { x: 60, y: 25 }, duration: 0.5, event: null },
    { type: "phase", side: "home", playerId: null, from: { x: 50, y: 50 }, to: { x: 50, y: 50 }, duration: 0.3, event: null }
  ]);
  assertEqual(choreo.getState().ballCarrierId, null, "pendant une passe, le ballon est en vol : personne ne le porte");
  choreo.step(0.5); // termine la passe, entre dans le beat "dribble"
  assertEqual(choreo.getState().ballCarrierId, "h1", "pendant le porté, h1 est le porteur du ballon");
  choreo.step(0.5); // termine le dribble, entre dans le beat "phase"
  assertEqual(choreo.getState().ballCarrierId, null, "une annonce de phase n'a pas de porteur de ballon");
});

test("step : un joueur non impliqué se rapproche de sa cible dynamique (ancre attirée vers le ballon selon son rôle), jamais figé sur un point fixe", () => {
  const choreo = createChoreographer();
  choreo.setAnchors({ h1: { x: 50, y: 20, role: "ATT" }, h2: { x: 10, y: 10, role: "DEF" } }, {});
  choreo.loadSequence([{ type: "shot", side: "home", playerId: "h1", from: { x: 50, y: 20 }, to: { x: 50, y: 5 }, duration: 1, event: null }]);
  const dt = 0.2;
  choreo.step(dt);
  const h2 = choreo.getState().players.find(p => p.id === "h2");
  // Reproduit exactement computeDynamicTarget (matchchoreo.js) : ancre attirée vers le ballon,
  // pondérée par CHOREO_ROLE_FOLLOW.DEF, puis lissage exponentiel (CHOREO_IDLE_EASE_RATE=2.6).
  // Le ballon utilisé ici est encore sa position INITIALE (50,50) : easeIdle s'exécute avant
  // qu'applyBeatFrame ne fasse avancer le ballon sur ce même sous-pas.
  const depthFollow = 0.16, lateralFollow = 0.22; // CHOREO_ROLE_FOLLOW.DEF
  const targetX = 10 + (50 - 10) * lateralFollow;
  const targetY = 10 + (50 - 10) * depthFollow;
  const factor = 1 - Math.exp(-2.6 * dt);
  assertClose(h2.x, 10 + (targetX - 10) * factor, 1e-9, "h2.x doit suivre la cible dynamique, pas rester figé sur son ancre brute");
  assertClose(h2.y, 10 + (targetY - 10) * factor, 1e-9, "h2.y doit suivre la cible dynamique, pas rester figé sur son ancre brute");
  assert(Math.abs(h2.x - 10) > 0.01, "h2 doit avoir réellement bougé, pas être resté figé");
});

test("computeDynamicTarget (via step) : le camp qui n'a pas le ballon se replie en continu vers sa propre ligne de but", () => {
  const choreo = createChoreographer();
  // a1 (away, DEF) est sur son ancre (50,50), loin de son but (y=96). Le beat appartient à
  // "home" : a1 ne possède donc pas le ballon et doit se rapprocher de sa ligne de but au fil du
  // temps (pas juste suivre le ballon comme s'il possédait, pas rester figé sur son ancre).
  choreo.setAnchors({ h1: { x: 50, y: 20, role: "ATT" } }, { a1: { x: 50, y: 50, role: "DEF" } });
  choreo.loadSequence([{ type: "shot", side: "home", playerId: "h1", from: { x: 50, y: 20 }, to: { x: 50, y: 5 }, duration: 1, event: null }]);
  choreo.step(0.05); // fixe activeSide="home" (a1 est donc bien identifié comme sans le ballon)
  const a1Before = choreo.getState().players.find(p => p.id === "a1").y;
  choreo.step(0.3);
  const a1After = choreo.getState().players.find(p => p.id === "a1").y;
  assert(a1After > a1Before, "a1 (away, sans le ballon) doit continuer à se rapprocher de sa ligne de but (y=96) au fil du temps");
  assert(a1After > 50, "a1 doit s'être déplacé vers son propre but, pas être resté figé sur son ancre (y=50)");
});

test("step : beat.mark déplace le défenseur en chasse indépendamment du porteur de balle, sans être rappelé vers son ancre", () => {
  const choreo = createChoreographer();
  choreo.setAnchors({ h1: { x: 20, y: 20 } }, { a1: { x: 80, y: 80 } }); // ancre de a1 très loin de son mark
  choreo.loadSequence([{
    type: "dribble", side: "home", playerId: "h1", from: { x: 20, y: 20 }, to: { x: 30, y: 30 }, duration: 1, event: null,
    mark: { id: "a1", from: { x: 25, y: 35 }, to: { x: 28, y: 32 } }
  }]);
  choreo.step(1); // beat entièrement joué (easeInOutQuad(1) = 1, donc from→to exact)
  const a1 = choreo.getState().players.find(p => p.id === "a1");
  assertClose(a1.x, 28, 1e-9, "le défenseur en chasse doit atteindre exactement mark.to.x");
  assertClose(a1.y, 32, 1e-9, "le défenseur en chasse doit atteindre exactement mark.to.y");
});

test("isSequenceDone : vrai immédiatement quand la séquence chargée est vide", () => {
  const choreo = createChoreographer();
  choreo.loadSequence([]);
  assert(choreo.isSequenceDone(), "une séquence vide doit être considérée comme terminée");
});

test("insertNext : intercale des beats après celui en cours sans perdre la progression déjà faite", () => {
  const choreo = createChoreographer();
  choreo.setAnchors({ h1: { x: 50, y: 20 } }, {});
  const ev1 = { minute: 5, type: "phase", text: "beat 1" };
  const ev2 = { minute: 5, type: "phase", text: "beat inséré" };
  const ev3 = { minute: 5, type: "phase", text: "beat 3" };
  choreo.loadSequence([
    { type: "dribble", side: "home", playerId: "h1", from: { x: 50, y: 20 }, to: { x: 50, y: 30 }, duration: 1, event: ev1 },
    { type: "dribble", side: "home", playerId: "h1", from: { x: 50, y: 30 }, to: { x: 50, y: 40 }, duration: 1, event: ev3 }
  ]);
  choreo.step(0.4); // en plein milieu du 1er beat
  choreo.insertNext([{ type: "phase", side: "home", playerId: null, from: { x: 50, y: 50 }, to: { x: 50, y: 50 }, duration: 0.5, event: ev2 }]);
  choreo.step(0.6); // termine le 1er beat (0.4+0.6=1.0)
  assertEqual(choreo.consumeFinishedEvents()[0], ev1, "le 1er beat doit se terminer normalement malgré l'insertion");
  choreo.step(0.5); // joue entièrement le beat inséré
  assertEqual(choreo.consumeFinishedEvents()[0], ev2, "le beat inséré doit se jouer juste après le 1er, avant le 3e");
  assert(!choreo.isSequenceDone(), "le 3e beat original doit encore être à jouer après l'insertion");
  choreo.step(1);
  assertEqual(choreo.consumeFinishedEvents()[0], ev3, "le 3e beat original doit bien jouer après l'insertion, sans avoir été perdu");
  assert(choreo.isSequenceDone(), "la séquence complète (originale + insérée) doit être terminée");
});
