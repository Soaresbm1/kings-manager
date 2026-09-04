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

// ===================== GÉOMÉTRIE DU TERRAIN (matchengine-actions.js) =====================
// Helpers purs (migrés depuis l'ancien matchphysics.js, puis d'engine.js vers matchengine-actions.js
// avec le passage au moteur d'actions — voir simulateMinute({withSequence:true}) plus bas).

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

// ===================== MOTEUR D'ACTIONS (matchengine-actions.js) =====================
// simulatePossessionChain() décide et résout une possession entière (porteur, décision, passe/
// dribble/tir, xG...) action par action. Comme pour le reste du moteur, on vérifie des invariants
// structurels sur de nombreux tirages plutôt que des valeurs exactes (Math.random() partout).

// Mini-effectif (1 GK + 2 DEF + 2 MID + 2 ATT, formation "1-2-2-2") avec des attributs contrôlés :
// utile pour isoler un scénario précis sans dépendre des données réelles d'un club.
function buildTestSquad(overall) {
  const v = overall || 65;
  return [
    player("GK", "GK", v, v, v, v, 25),
    player("D1", "DEF", v, v, v, v, 25), player("D2", "DEF", v, v, v, v, 25),
    player("M1", "MID", v, v, v, v, 25), player("M2", "MID", v, v, v, v, 25),
    player("A1", "ATT", v, v, v, v, 25), player("A2", "ATT", v, v, v, v, 25)
  ];
}
function buildTestSetup(players) {
  return { formation: "1-2-2-2", assignments: players.map(p => p.id), lineup: players.map(p => p.id), attackPlan: "possession", defensePlan: "zone" };
}
// Construit tout ce dont simulatePossessionChain a besoin pour une possession "home" contre des
// joueurs "away" — `overrides` permet d'ajuster un paramètre précis (attackMod, defenseMod, forces
// des effectifs...) pour un scénario de test donné.
function buildChainScenario(homeOverall, awayOverall, overrides) {
  const homePlayers = buildTestSquad(homeOverall);
  const awayPlayers = buildTestSquad(awayOverall);
  const homeSetup = buildTestSetup(homePlayers);
  const awaySetup = buildTestSetup(awayPlayers);
  const homeOutfieldIds = homePlayers.filter(p => p.pos !== "GK").map(p => p.id);
  const awayOutfieldIds = awayPlayers.filter(p => p.pos !== "GK").map(p => p.id);
  const atkAnchors = computeSideAnchors(homeSetup, homeOutfieldIds, "home", true);
  const defAnchors = computeSideAnchors(awaySetup, awayOutfieldIds, "away", false);
  return Object.assign({
    side: "home",
    attackers: homePlayers.filter(p => p.pos !== "GK"),
    defenders: awayPlayers.filter(p => p.pos !== "GK"),
    gk: awayPlayers.find(p => p.pos === "GK"),
    atkAnchors, defAnchors,
    attackPlanKey: "possession", attackMod: 1, defenseMod: 1, earlyPhaseBoost: 1,
    withSequence: true, staminaFactorFor: () => 1
  }, overrides || {});
}
const ACTION_BEAT_TYPES = ["pass", "cross", "carry", "dribble", "tackle", "interception", "clear", "out", "press", "shot", "goal", "save", "miss"];

test("simulatePossessionChain : structure valide d'une action (chaque beat a des positions/durées cohérentes)", () => {
  const scenario = buildChainScenario(65, 65);
  const allIds = new Set([...scenario.attackers.map(p => p.id), ...scenario.defenders.map(p => p.id), scenario.gk.id]);
  for (let i = 0; i < 200; i++) {
    const chain = simulatePossessionChain(scenario);
    chain.beats.forEach((beat, bi) => {
      assert(ACTION_BEAT_TYPES.includes(beat.type), `essai ${i} beat[${bi}] : type invalide "${beat.type}"`);
      ["from", "to"].forEach(k => {
        assert(beat[k] && beat[k].x >= 0 && beat[k].x <= 100 && beat[k].y >= 0 && beat[k].y <= 100,
          `essai ${i} beat[${bi}].${k} hors du terrain [0,100]x[0,100]`);
      });
      assert(typeof beat.duration === "number" && beat.duration >= 0, `essai ${i} beat[${bi}] : duration invalide`);
      [beat.playerId, beat.toPlayerId, beat.gkId].forEach(id => {
        assert(id === null || allIds.has(id), `essai ${i} beat[${bi}] : id de joueur inconnu "${id}"`);
      });
    });
  }
});

test("simulatePossessionChain : continuité du porteur et du ballon (jamais de téléportation d'une action à l'autre)", () => {
  const scenario = buildChainScenario(65, 65);
  for (let i = 0; i < 200; i++) {
    const chain = simulatePossessionChain(scenario);
    // "press" est une piste à part (un défenseur se replace sans jamais toucher au ballon, voir
    // matchengine-actions.js:defShadow) : on ne vérifie la continuité qu'entre deux beats qui
    // portent effectivement le ballon.
    const ballBeats = chain.beats.filter(b => b.type !== "press");
    for (let b = 1; b < ballBeats.length; b++) {
      const prev = ballBeats[b - 1], cur = ballBeats[b];
      assertClose(cur.from.x, prev.to.x, 1e-6, `essai ${i} beat[${b}] : le ballon saute en x entre deux actions`);
      assertClose(cur.from.y, prev.to.y, 1e-6, `essai ${i} beat[${b}] : le ballon saute en y entre deux actions`);
    }
  }
});

test("simulatePossessionChain : une passe/un centre ne vise jamais un adversaire, toujours un coéquipier actif", () => {
  const scenario = buildChainScenario(65, 65);
  const attackerIds = new Set(scenario.attackers.map(p => p.id));
  let checked = 0;
  for (let i = 0; i < 300; i++) {
    const chain = simulatePossessionChain(scenario);
    chain.beats.forEach(beat => {
      if ((beat.type === "pass" || beat.type === "cross") && beat.side === "home" && beat.toPlayerId) {
        checked++;
        assert(attackerIds.has(beat.toPlayerId), `une passe "home" a été adressée à un id hors de l'effectif attaquant : ${beat.toPlayerId}`);
      }
    });
  }
  assert(checked > 0, "aucune passe complétée observée sur 300 essais — le scénario de test ne couvre pas ce cas");
});

test("simulatePossessionChain : une interception/un tacle provoque toujours un changement de possession (jamais un but)", () => {
  // porteurs très faibles face à des défenseurs très forts : maximise les pertes de balle pour couvrir ce cas.
  const scenario = buildChainScenario(35, 95);
  let sawTurnoverWithDefenseAction = false;
  for (let i = 0; i < 300; i++) {
    const chain = simulatePossessionChain(scenario);
    const hasDefensiveBeat = chain.beats.some(b => b.type === "interception" || b.type === "tackle");
    if (hasDefensiveBeat) {
      sawTurnoverWithDefenseAction = true;
      // "foul" : un tacle raté peut aussi être une vraie faute (voir computeFoulChance) plutôt
      // qu'une perte de balle propre — dans les deux cas, l'attaque perd la possession en cours,
      // jamais un but.
      assert(chain.outcome === "turnover" || chain.outcome === "foul", `une interception/un tacle a eu lieu mais l'issue de la possession est "${chain.outcome}" au lieu de "turnover"/"foul"`);
      if (chain.outcome === "foul") {
        assert(chain.foul && chain.foul.by && chain.foul.against, "issue \"foul\" sans détail de faute (by/against)");
        assert(["yellow", "penalty"].includes(chain.foul.severity), `sévérité de faute invalide : "${chain.foul.severity}"`);
      } else {
        assert(chain.defenseStats.interceptions + chain.defenseStats.tacklesWon > 0, "beat défensif présent sans stat défensive associée");
      }
    }
  }
  assert(sawTurnoverWithDefenseAction, "aucune interception/tacle observé sur 300 essais avec un effectif largement défavorisé");
});

test("simulatePossessionChain : xG toujours compris entre 0 et 1", () => {
  const scenario = buildChainScenario(65, 65);
  let shotsSeen = 0;
  for (let i = 0; i < 400; i++) {
    const chain = simulatePossessionChain(scenario);
    if (chain.outcome === "goal" || chain.outcome === "save" || chain.outcome === "miss") {
      shotsSeen++;
      assert(chain.xG >= 0 && chain.xG <= 1, `xG hors bornes [0,1] : ${chain.xG}`);
    }
  }
  assert(shotsSeen > 0, "aucun tir observé sur 400 essais — le scénario de test ne couvre pas ce cas");
});

test("simulatePossessionChain : un but ne survient jamais sans tir réel (xG > 0, scorer défini)", () => {
  const scenario = buildChainScenario(80, 50); // effectif attaquant nettement supérieur -> plus de buts à vérifier
  let goalsSeen = 0;
  for (let i = 0; i < 400; i++) {
    const chain = simulatePossessionChain(scenario);
    if (chain.outcome === "goal") {
      goalsSeen++;
      assert(chain.scorer, "but enregistré sans buteur");
      assert(chain.xG > 0, "but enregistré avec un xG nul");
      assert(chain.attackStats.shots >= 1, "but enregistré sans qu'aucun tir n'ait été comptabilisé");
    }
  }
  assert(goalsSeen > 0, "aucun but observé sur 400 essais — le scénario de test ne couvre pas ce cas");
});

test("simulatePossessionChain : statistiques d'attaque toujours cohérentes entre elles", () => {
  const scenario = buildChainScenario(65, 65);
  for (let i = 0; i < 300; i++) {
    const chain = simulatePossessionChain(scenario);
    const s = chain.attackStats;
    assert(s.shotsOnTarget <= s.shots, "plus de tirs cadrés que de tirs au total");
    assert(s.passesCompleted <= s.passesAttempted, "plus de passes réussies que de passes tentées");
    if (s.shots === 0) assertEqual(chain.xG, 0, "xG non nul alors qu'aucun tir n'a eu lieu");
  }
});

test("simulatePossessionChain : sans coéquipier de champ disponible (1 seul joueur actif), aucune passe n'est tentée", () => {
  const scenario = buildChainScenario(65, 65);
  scenario.attackers = scenario.attackers.slice(0, 1); // simule un format réduit (escalier/Dé Géant 1v1)
  scenario.atkAnchors = { [scenario.attackers[0].id]: { x: 50, y: 30 } };
  for (let i = 0; i < 100; i++) {
    const chain = simulatePossessionChain(scenario);
    assertEqual(chain.attackStats.passesAttempted, 0, "une passe a été tentée sans aucun coéquipier de champ disponible");
    chain.beats.forEach(b => assert(b.type !== "pass" && b.type !== "cross", `beat "${b.type}" alors qu'un seul joueur de champ est actif`));
  }
});

test("buildRecoveryLine : aucune phrase depuis le tiers offensif, sinon mentionne le joueur et la zone", () => {
  const player = { name: "Testeur" };
  assertEqual(buildRecoveryLine(player, { x: 50, y: 90 }, "final"), null, "pas de récupération depuis le tiers offensif");
  const own = buildRecoveryLine(player, { x: 50, y: 10 }, "own");
  assert(own.includes("Testeur") && own.includes("récupère le ballon") && own.includes("propre camp"), `phrase inattendue : "${own}"`);
  const mid = buildRecoveryLine(player, { x: 20, y: 50 }, "mid");
  assert(mid.includes("côté gauche") && mid.includes("milieu de terrain"), `phrase inattendue : "${mid}"`);
});

test("simulatePossessionChain : la récupération de balle est cohérente (jamais depuis le tiers offensif, toujours nommée)", () => {
  const scenario = buildChainScenario(65, 65);
  let sawRecovery = false;
  for (let i = 0; i < 300; i++) {
    const chain = simulatePossessionChain(scenario);
    if (chain.recoveryLine) {
      sawRecovery = true;
      assert(chain.recoveryLine.includes("récupère le ballon"), `phrase de récupération mal formée : "${chain.recoveryLine}"`);
    }
  }
  assert(sawRecovery, "aucune phrase de récupération générée sur 300 essais");
});

test("createMatchEngine : simulation complète (40 min) sans erreur, match humain et match IA structurellement compatibles", () => {
  const homeChoice = chooseAiFormation(LEAGUES.germany.teams[0]);
  const awayChoice = chooseAiFormation(LEAGUES.germany.teams[1]);
  function makeSetups() {
    return [
      { lineup: homeChoice.assignments.filter(Boolean), assignments: homeChoice.assignments, formation: homeChoice.formation, attackPlan: "transition", defensePlan: "high" },
      { lineup: awayChoice.assignments.filter(Boolean), assignments: awayChoice.assignments, formation: awayChoice.formation, attackPlan: "direct", defensePlan: "low" }
    ];
  }
  const [homeSetupA, awaySetupA] = makeSetups();
  const engineHuman = createMatchEngine(LEAGUES.germany.teams[0], homeSetupA, LEAGUES.germany.teams[1], awaySetupA);
  for (let m = 1; m <= 40; m++) engineHuman.simulateMinute(m, { withSequence: true });
  const resultHuman = engineHuman.finalize(null);

  const [homeSetupB, awaySetupB] = makeSetups();
  const engineAi = createMatchEngine(LEAGUES.germany.teams[0], homeSetupB, LEAGUES.germany.teams[1], awaySetupB);
  for (let m = 1; m <= 40; m++) engineAi.simulateMinute(m);
  const resultAi = engineAi.finalize(null);

  ["homeGoals", "awayGoals", "homeShots", "awayShots", "homeXG", "awayXG", "homePossession", "awayPossession"].forEach(key => {
    assert(typeof resultHuman[key] === "number" && !Number.isNaN(resultHuman[key]), `match humain : ${key} n'est pas un nombre valide`);
    assert(typeof resultAi[key] === "number" && !Number.isNaN(resultAi[key]), `match IA : ${key} n'est pas un nombre valide`);
  });
});

// ===================== ÉQUILIBRAGE (engine.js:runBalanceSimulation) =====================
// Verrouille les moyennes du moteur d'actions dans des bornes larges mais réelles, pour qu'une
// dérive de réglage future (MATCH_BALANCE mal ajusté, formule cassée...) fasse échouer un test
// plutôt que de se découvrir des semaines plus tard en jouant. Échantillons volontairement larges
// (100-300 matchs / milliers de tirages) pour que le bruit de Math.random() ne rende jamais ces
// tests flaky — les bornes elles-mêmes restent volontairement généreuses : l'objectif est de capter
// une régression franche, pas de figer un réglage fin qu'on voudra retoucher au fil du temps.

test("runBalanceSimulation : moyennes crédibles pour un 7v7 de 40 minutes (buts, tirs, xG, passes), jamais de match nul", () => {
  const report = runBalanceSimulation(LEAGUES.france.teams[0], LEAGUES.france.teams[1], 100);
  assert(report.avgGoalsPerMatch >= 2 && report.avgGoalsPerMatch <= 22, `buts/match hors bornes plausibles : ${report.avgGoalsPerMatch}`);
  assert(report.avgShotsPerMatch >= 8 && report.avgShotsPerMatch <= 70, `tirs/match hors bornes plausibles : ${report.avgShotsPerMatch}`);
  assert(report.avgXGPerMatch > 0 && report.avgXGPerMatch <= report.avgGoalsPerMatch * 4 + 1, `xG/match incohérent avec les buts/match : xG=${report.avgXGPerMatch}, buts=${report.avgGoalsPerMatch}`);
  assert(report.passCompletionRate >= 0.5 && report.passCompletionRate <= 0.95, `taux de passes réussies hors bornes réalistes : ${report.passCompletionRate}`);
  assertEqual(report.noDrawRate, 1, "règle Kings League : jamais de match nul (tirs au but si égalité)");
  assert(report.blowoutRate <= 0.4, `trop de scores extrêmes (écart >= 6 buts) entre deux équipes du même championnat : ${report.blowoutRate}`);
});

test("runBalanceSimulation : avantage du terrain mesurable mais pas écrasant (deux effectifs identiques)", () => {
  const clone = JSON.parse(JSON.stringify(LEAGUES.brazil.teams[0]));
  clone.players.forEach(p => { p.id = p.id + "_clone"; });
  const report = runBalanceSimulation(LEAGUES.brazil.teams[0], clone, 300);
  assert(report.homeWinRate > 0.45, `l'avantage du terrain a disparu (ou s'est inversé) entre deux effectifs identiques : homeWinRate=${report.homeWinRate}`);
  assert(report.homeWinRate < 0.85, `l'avantage du terrain devient écrasant entre deux effectifs identiques : homeWinRate=${report.homeWinRate}`);
});

test("runBalanceSimulation : un favori net gagne nettement plus souvent, sans que l'outsider soit condamné d'avance", () => {
  const strong = JSON.parse(JSON.stringify(LEAGUES.spain.teams[0]));
  strong.players.forEach(p => {
    ["speed", "technique", "physical", "mental"].forEach(a => { p[a] = Math.min(99, p[a] + 12); });
    p.overall = Math.round((p.speed + p.technique + p.physical + p.mental) / 4);
  });
  const weak = JSON.parse(JSON.stringify(LEAGUES.spain.teams[1]));
  weak.players.forEach(p => {
    ["speed", "technique", "physical", "mental"].forEach(a => { p[a] = Math.max(30, p[a] - 12); });
    p.overall = Math.round((p.speed + p.technique + p.physical + p.mental) / 4);
  });
  const report = runBalanceSimulation(strong, weak, 150);
  assert(report.homeWinRate >= 0.55, `le favori net (domicile) devrait gagner nettement plus souvent : ${report.homeWinRate}`);
  assert(report.awayWinRate > 0, `l'outsider (extérieur) ne devrait jamais être condamné à 0% de victoires sur 150 matchs : ${report.awayWinRate}`);
  assert(report.awayWinRate < 0.45, `l'outsider gagne trop souvent pour un si net écart de niveau : ${report.awayWinRate}`);
});

test("chooseActionType : le plan offensif influence réellement la fréquence des décisions (possession/direct)", () => {
  const carrier = { pos: "MID" };
  function frequencyOf(decisionType, attackPlanKey, n) {
    let count = 0;
    for (let i = 0; i < n; i++) {
      const decision = chooseActionType({ carrier, zone: "mid", pressure: 0.2, attackPlanKey, pos: { x: 50, y: 50 }, side: "home", actionsLeft: 4, hasPassOptions: true });
      if (decision === decisionType) count++;
    }
    return count / n;
  }
  const N = 3000;
  const shortPossession = frequencyOf("short", "possession", N);
  const shortDirect = frequencyOf("short", "direct", N);
  assert(shortPossession > shortDirect, `"possession" devrait privilégier la passe courte bien plus que "direct" (possession=${shortPossession}, direct=${shortDirect})`);

  const throughDirect = frequencyOf("through", "direct", N);
  const throughPossession = frequencyOf("through", "possession", N);
  assert(throughDirect > throughPossession, `"direct" devrait privilégier la passe en profondeur bien plus que "possession" (direct=${throughDirect}, possession=${throughPossession})`);
});

// ===================== SÉQUENCE ANIMÉE DU MATCH HUMAIN (engine.js) =====================
// simulateMinute(minute, {withSequence:true}) utilise Math.random() (mêmes décisions que le
// chemin IA) : on vérifie donc des invariants structurels sur les beats produits, pas des valeurs
// exactes — répété sur plusieurs minutes/graines pour couvrir les branches "chance ratée"/"but"/
// "arrêt" au moins une fois.
const CHOREO_BEAT_TYPES = ["pass", "cross", "carry", "dribble", "tackle", "interception", "clear", "out", "press", "shot", "goal", "save", "miss", "owngoal", "phase"];

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

test("step : centre (cross) — le ballon rejoint le coéquipier visé, comme une passe", () => {
  const choreo = createChoreographer();
  choreo.setAnchors({ h1: { x: 10, y: 20 }, h2: { x: 55, y: 12 } }, {});
  choreo.loadSequence([{ type: "cross", side: "home", playerId: "h1", toPlayerId: "h2", from: { x: 10, y: 20 }, to: { x: 55, y: 12 }, duration: 1, event: null }]);
  choreo.step(1);
  const state = choreo.getState();
  const h2 = state.players.find(p => p.id === "h2");
  assertClose(h2.x, 55, 1e-9, "le receveur du centre doit avoir rejoint le point d'arrivée du ballon (x)");
  assertClose(h2.y, 12, 1e-9, "le receveur du centre doit avoir rejoint le point d'arrivée du ballon (y)");
});

test("step : conduite de balle (carry) — le porteur garde le ballon collé à lui, comme un dribble", () => {
  const choreo = createChoreographer();
  choreo.setAnchors({ h1: { x: 50, y: 40 } }, {});
  choreo.loadSequence([{ type: "carry", side: "home", playerId: "h1", from: { x: 50, y: 40 }, to: { x: 50, y: 49 }, duration: 1, event: null }]);
  choreo.step(1);
  const h1 = choreo.getState().players.find(p => p.id === "h1");
  assertClose(h1.y, 49, 1e-9, "le porteur doit avoir suivi le ballon jusqu'à la fin de sa conduite");
  assertEqual(choreo.getState().ballCarrierId, null, "carrier connu seulement PENDANT le beat, plus après la fin de la séquence");
});

test("step : interception — le ballon rejoint le défenseur qui coupe l'action, qui en devient alors porteur", () => {
  const choreo = createChoreographer();
  choreo.setAnchors({}, { a1: { x: 45, y: 55 } });
  choreo.loadSequence([{ type: "interception", side: "away", playerId: "a1", from: { x: 50, y: 50 }, to: { x: 45, y: 55 }, duration: 0.6, event: null }]);
  choreo.step(0.3);
  assertEqual(choreo.getState().ballCarrierId, "a1", "le défenseur qui intercepte doit porter le ballon pendant le beat");
  choreo.step(0.3);
  const a1 = choreo.getState().players.find(p => p.id === "a1");
  assertClose(a1.x, 45, 1e-9, "le défenseur doit avoir rejoint le point d'interception (x)");
  assertClose(a1.y, 55, 1e-9, "le défenseur doit avoir rejoint le point d'interception (y)");
});

test("step : pressing (press) — le défenseur avance vers le porteur sans jamais toucher au ballon", () => {
  const choreo = createChoreographer();
  choreo.setAnchors({ h1: { x: 50, y: 40 } }, { a1: { x: 45, y: 60 } });
  const ballBefore = { x: 12, y: 34 }; // position arbitraire, sans rapport avec le beat "press"
  choreo.loadSequence([
    { type: "carry", side: "home", playerId: "h1", from: { x: 50, y: 40 }, to: ballBefore, duration: 0.4, event: null },
    { type: "press", side: "away", playerId: "a1", from: { x: 45, y: 60 }, to: { x: 40, y: 45 }, duration: 0.5, event: null }
  ]);
  choreo.step(0.4); // termine la conduite : le ballon (et h1) arrivent à ballBefore
  choreo.step(0.25); // mi-parcours du beat "press"
  const state = choreo.getState();
  assertClose(state.ball.x, ballBefore.x, 1e-9, "le ballon ne doit pas bouger pendant un beat \"press\" (x)");
  assertClose(state.ball.y, ballBefore.y, 1e-9, "le ballon ne doit pas bouger pendant un beat \"press\" (y)");
  const a1 = state.players.find(p => p.id === "a1");
  assert(a1.x > 40 && a1.x < 45, "le défenseur doit être à mi-chemin de son avancée (x)");
  assertEqual(state.ballCarrierId, null, "un beat \"press\" ne rend jamais le défenseur porteur du ballon");
});

test("step : dégagement (clear) et sortie de balle (out) — le ballon part librement, sans joueur attaché", () => {
  const choreo = createChoreographer();
  choreo.setAnchors({ h1: { x: 50, y: 10 } }, {});
  choreo.loadSequence([{ type: "clear", side: "home", playerId: "h1", from: { x: 50, y: 10 }, to: { x: 80, y: 40 }, duration: 1, event: null }]);
  choreo.step(1);
  let state = choreo.getState();
  assertClose(state.ball.x, 80, 1e-9, "le ballon dégagé doit arriver à destination (x)");
  assertClose(state.ball.y, 40, 1e-9, "le ballon dégagé doit arriver à destination (y)");
  const h1AfterClear = state.players.find(p => p.id === "h1");
  assertClose(h1AfterClear.x, 50, 1e-9, "le joueur qui dégage reste sur place, seul le ballon avance (x)");

  choreo.loadSequence([{ type: "out", side: "home", playerId: null, from: { x: 80, y: 40 }, to: { x: 95, y: 40 }, duration: 1, event: null }]);
  choreo.step(1);
  state = choreo.getState();
  assertClose(state.ball.x, 95, 1e-9, "le ballon doit sortir jusqu'au point de sortie (x)");
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

test("step : un joueur non impliqué dans le beat courant reçoit une cible dynamique et s'en approche progressivement (jamais figé, jamais téléporté)", () => {
  const choreo = createChoreographer();
  choreo.setAnchors({ h1: { x: 50, y: 20, pos: "MID" }, h2: { x: 10, y: 10, pos: "DEF" } }, {});
  choreo.loadSequence([{ type: "shot", side: "home", playerId: "h1", from: { x: 50, y: 20 }, to: { x: 50, y: 5 }, duration: 1, event: null }]);
  const before = choreo.getState().players.find(p => p.id === "h2");
  choreo.step(0.2);
  const after = choreo.getState().players.find(p => p.id === "h2");
  const moved = Math.hypot(after.x - before.x, after.y - before.y);
  // le slot de base ("ancre") de h2 est resté le même, mais sa CIBLE réelle (targetX/targetY) est
  // recalculée en continu (position du ballon, possession, rôle...) : h2 doit donc bouger, même
  // sans toucher le ballon — mais jamais au-delà de la vitesse maximale (voir MOVE.maxSpeedRun).
  assert(moved > 0, "h2 (non impliqué) devrait bouger vers sa cible dynamique, pas rester figé sur son ancre");
  assert(moved <= 26 * 0.2 + 1e-6, `déplacement de h2 au-delà de la vitesse maximale : ${moved} en 0.2s`);
  assert(typeof after.targetX === "number" && typeof after.targetY === "number", "cible dynamique (targetX/targetY) non exposée par getState()");
  assert(typeof after.role === "string" && after.role.length > 0, "rôle temporaire non exposé par getState()");
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

// ===================== DÉPLACEMENT COLLECTIF (matchchoreo.js) =====================
// La formation ne fixe qu'une structure de départ (setAnchors) ; la cible réelle de chaque joueur
// non impliqué dans le beat en cours est recalculée en continu (computeDynamicTarget) et rejointe
// progressivement (steerTowards) — voir l'en-tête de matchchoreo.js. Aucun Math.random() dans ce
// module : à scénario fixé, le comportement est entièrement déterministe.

test("déplacement collectif : chaque joueur actif a une cible valide dans le terrain ; un joueur exclu n'en reçoit plus", () => {
  const choreo = createChoreographer();
  choreo.setAnchors(
    { h1: { x: 50, y: 20, pos: "MID" }, h2: { x: 20, y: 30, pos: "DEF" }, h3: { x: 80, y: 30, pos: "DEF" } },
    { a1: { x: 50, y: 80, pos: "MID" } }
  );
  choreo.loadSequence([{ type: "carry", side: "home", playerId: "h1", from: { x: 50, y: 20 }, to: { x: 50, y: 28 }, duration: 1, event: null }]);
  choreo.step(0.3);
  let state = choreo.getState();
  state.players.forEach(p => {
    assert(typeof p.targetX === "number" && typeof p.targetY === "number", `${p.id} sans cible valide`);
    assert(p.targetX >= 0 && p.targetX <= 100 && p.targetY >= 0 && p.targetY <= 100, `${p.id} : cible hors du terrain`);
  });
  // h3 sort de l'ancrage (carton rouge, suspension...) : il ne doit plus apparaître, donc plus recevoir de cible.
  choreo.setAnchors({ h1: { x: 50, y: 20, pos: "MID" }, h2: { x: 20, y: 30, pos: "DEF" } }, { a1: { x: 50, y: 80, pos: "MID" } });
  choreo.step(0.1);
  state = choreo.getState();
  assert(!state.players.some(p => p.id === "h3"), "h3 (exclu) ne devrait plus apparaître ni recevoir de cible");
});

test("déplacement collectif : plusieurs joueurs non impliqués bougent simultanément pendant une possession", () => {
  const choreo = createChoreographer();
  choreo.setAnchors(
    { h1: { x: 50, y: 20, pos: "MID" }, h2: { x: 20, y: 30, pos: "DEF" }, h3: { x: 80, y: 30, pos: "DEF" }, h4: { x: 50, y: 85, pos: "ATT" } },
    { a1: { x: 50, y: 80, pos: "MID" }, a2: { x: 25, y: 65, pos: "DEF" }, a3: { x: 75, y: 65, pos: "DEF" } }
  );
  choreo.loadSequence([{ type: "carry", side: "home", playerId: "h1", from: { x: 50, y: 20 }, to: { x: 55, y: 35 }, duration: 0.6, event: null }]);
  const before = new Map(choreo.getState().players.map(p => [p.id, { x: p.x, y: p.y }]));
  choreo.step(0.3);
  let moved = 0;
  choreo.getState().players.forEach(p => {
    const b = before.get(p.id);
    if (b && Math.hypot(p.x - b.x, p.y - b.y) > 0.05) moved++;
  });
  assert(moved >= 3, `seulement ${moved} joueur(s) ont bougé — attendu au moins 3 (mouvement collectif, pas juste le porteur)`);
});

test("déplacement collectif : l'équipe qui possède remonte, la même équipe recule quand c'est l'adversaire qui possède", () => {
  function homeAvgYWhenPossessedBy(possessingSide) {
    const choreo = createChoreographer();
    choreo.setAnchors(
      { h1: { x: 50, y: 20, pos: "MID" }, h2: { x: 20, y: 15, pos: "DEF" }, h3: { x: 80, y: 15, pos: "DEF" } },
      { a1: { x: 50, y: 80, pos: "MID" } }
    );
    choreo.setTactics({ attackPlan: "possession", defensePlan: "zone" }, { attackPlan: "possession", defensePlan: "zone" });
    const carrierId = possessingSide === "home" ? "h1" : "a1";
    const y0 = possessingSide === "home" ? 20 : 80;
    choreo.loadSequence([{ type: "carry", side: possessingSide, playerId: carrierId, from: { x: 50, y: y0 }, to: { x: 50, y: y0 + (possessingSide === "home" ? 2 : -2) }, duration: 3, event: null }]);
    for (let i = 0; i < 90; i++) choreo.step(1 / 30);
    const outfield = choreo.getState().players.filter(p => p.side === "home" && p.id !== "h1");
    return outfield.reduce((s, p) => s + p.y, 0) / outfield.length;
  }
  const avgWhenHomePossesses = homeAvgYWhenPossessedBy("home");
  const avgWhenAwayPossesses = homeAvgYWhenPossessedBy("away");
  assert(avgWhenHomePossesses > avgWhenAwayPossesses,
    `home devrait être plus haut quand il possède (${avgWhenHomePossesses.toFixed(1)}) que quand il défend (${avgWhenAwayPossesses.toFixed(1)})`);
});

test("déplacement collectif : l'équipe qui défend coulisse latéralement vers le ballon", () => {
  const choreo = createChoreographer();
  choreo.setAnchors(
    { h1: { x: 50, y: 20, pos: "MID" }, h2: { x: 20, y: 15, pos: "DEF" }, h3: { x: 80, y: 15, pos: "DEF" } },
    { a1: { x: 50, y: 80, pos: "MID" } }
  );
  choreo.setTactics({ attackPlan: "direct", defensePlan: "zone" }, { attackPlan: "direct", defensePlan: "zone" });
  // ballon très excentré à gauche, tenu par away : home défend
  choreo.loadSequence([{ type: "carry", side: "away", playerId: "a1", from: { x: 10, y: 80 }, to: { x: 10, y: 78 }, duration: 3, event: null }]);
  for (let i = 0; i < 90; i++) choreo.step(1 / 30);
  const h3 = choreo.getState().players.find(p => p.id === "h3"); // ancre x=80, loin du ballon (x=10)
  assert(h3.x < 78, `h3 (défenseur côté opposé au ballon) devrait avoir coulissé vers la gauche (x=${h3.x.toFixed(1)}, ancre=80)`);
});

test("déplacement collectif : le défenseur le plus proche presse, les autres ne se ruent pas tous sur le ballon", () => {
  const choreo = createChoreographer();
  choreo.setAnchors({ h1: { x: 50, y: 50, pos: "MID" } }, { a1: { x: 52, y: 52, pos: "DEF" }, a2: { x: 20, y: 56, pos: "DEF" }, a3: { x: 80, y: 56, pos: "DEF" } });
  choreo.loadSequence([{ type: "carry", side: "home", playerId: "h1", from: { x: 50, y: 50 }, to: { x: 50, y: 55 }, duration: 2, event: null }]);
  for (let i = 0; i < 30; i++) choreo.step(1 / 30);
  const state = choreo.getState();
  const roles = new Map(state.players.map(p => [p.id, p.role]));
  assertEqual(roles.get("a1"), "primaryPresser", "le défenseur le plus proche du ballon devrait presser");
  assert(roles.get("a2") !== "primaryPresser" && roles.get("a3") !== "primaryPresser", "un seul défenseur presse à la fois");
  const a2 = state.players.find(p => p.id === "a2");
  assert(Math.hypot(a2.x - state.ball.x, a2.y - state.ball.y) > 5, "a2 ne devrait pas se ruer sur le ballon comme le presseur");
});

test("déplacement collectif : les cibles ne sont jamais toutes identiques au sein d'une même équipe", () => {
  const choreo = createChoreographer();
  choreo.setAnchors(
    { h1: { x: 50, y: 20, pos: "MID" }, h2: { x: 20, y: 15, pos: "DEF" }, h3: { x: 80, y: 15, pos: "DEF" }, h4: { x: 50, y: 40, pos: "ATT" } },
    {}
  );
  choreo.loadSequence([]);
  choreo.step(0.3);
  const targets = choreo.getState().players.map(p => `${p.targetX.toFixed(2)},${p.targetY.toFixed(2)}`);
  assertEqual(new Set(targets).size, targets.length, "au moins deux joueurs visent exactement la même position");
});

test("déplacement collectif : jamais plus vite que la vitesse maximale, jamais hors du terrain", () => {
  const choreo = createChoreographer();
  choreo.setAnchors(
    { h1: { x: 50, y: 20, pos: "MID" }, h2: { x: 2, y: 2, pos: "DEF" }, h3: { x: 98, y: 98, pos: "ATT" } },
    { a1: { x: 50, y: 80, pos: "MID" } }
  );
  choreo.loadSequence([{ type: "carry", side: "home", playerId: "h1", from: { x: 50, y: 20 }, to: { x: 50, y: 22 }, duration: 5, event: null }]);
  const DT = 1 / 60;
  let last = new Map(choreo.getState().players.map(p => [p.id, { x: p.x, y: p.y }]));
  for (let i = 0; i < 120; i++) {
    choreo.step(DT);
    const state = choreo.getState();
    state.players.forEach(p => {
      assert(p.x >= 0 && p.x <= 100 && p.y >= 0 && p.y <= 100, `${p.id} hors du terrain`);
      if (p.id === "h1") return; // impliqué (porteur) : suit le ballon par construction, hors périmètre
      const prev = last.get(p.id);
      const speed = Math.hypot(p.x - prev.x, p.y - prev.y) / DT;
      assert(speed <= 26 + 1e-6, `${p.id} dépasse la vitesse maximale du déplacement collectif : ${speed.toFixed(2)}`);
    });
    last = new Map(state.players.map(p => [p.id, { x: p.x, y: p.y }]));
  }
});

test("déplacement collectif : une transition (perte de balle) fait évoluer la forme progressivement, jamais instantanément", () => {
  const choreo = createChoreographer();
  choreo.setAnchors({ h1: { x: 50, y: 20, pos: "MID" }, h2: { x: 20, y: 15, pos: "DEF" } }, { a1: { x: 50, y: 80, pos: "MID" } });
  choreo.loadSequence([{ type: "carry", side: "home", playerId: "h1", from: { x: 50, y: 20 }, to: { x: 50, y: 22 }, duration: 3, event: null }]);
  for (let i = 0; i < 90; i++) choreo.step(1 / 30);
  const yBeforeTurnover = choreo.getState().players.find(p => p.id === "h2").y;
  // interception : away récupère (side="away") -> home doit maintenant défendre/reculer
  choreo.loadSequence([{ type: "interception", side: "away", playerId: "a1", from: { x: 50, y: 22 }, to: { x: 50, y: 80 }, duration: 0.4, event: null }]);
  choreo.step(1 / 30); // un seul pas juste après la transition
  const yJustAfter = choreo.getState().players.find(p => p.id === "h2").y;
  assert(Math.abs(yJustAfter - yBeforeTurnover) < 3, "h2 ne devrait presque pas avoir bougé un seul pas après la transition (pas de téléportation)");
  for (let i = 0; i < 90; i++) choreo.step(1 / 30);
  const yLongAfter = choreo.getState().players.find(p => p.id === "h2").y;
  assert(yLongAfter < yBeforeTurnover, `h2 devrait avoir reculé après la transition (avant=${yBeforeTurnover.toFixed(1)}, longtemps après=${yLongAfter.toFixed(1)})`);
});
