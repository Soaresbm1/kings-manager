// ===================== MOTEUR DE SIMULATION =====================

// --- Calendrier ---
// Génère un calendrier aller-retour (round-robin double) pour une liste d'équipes
function generateSchedule(teamIds) {
  const teams = [...teamIds];
  // si nombre impair, ajoute un "bye"
  if (teams.length % 2 !== 0) teams.push(null);
  const n = teams.length;
  const rounds = [];
  const half = n / 2;
  let arr = [...teams];

  for (let r = 0; r < n - 1; r++) {
    const round = [];
    for (let i = 0; i < half; i++) {
      const home = arr[i];
      const away = arr[n - 1 - i];
      if (home !== null && away !== null) {
        round.push({ home, away });
      }
    }
    rounds.push(round);
    // rotation (sauf le premier élément)
    const last = arr.pop();
    arr.splice(1, 0, last);
  }

  // matchs retour (inverser domicile/extérieur)
  const returnRounds = rounds.map(round => round.map(m => ({ home: m.away, away: m.home })));

  return [...rounds, ...returnRounds];
}

// --- Effet de la disposition tactique (formation) selon la phase de jeu ---
// Une disposition avec plus d'attaquants/milieux renforce l'attaque quand l'équipe a le ballon ;
// une disposition avec plus de défenseurs/milieux renforce la solidité quand elle ne l'a pas.
function formationAttackFactor(formationKey) {
  const f = FORMATIONS[formationKey] || FORMATIONS["1-2-2-2"];
  return 0.92 + f.att * 0.06 + f.mid * 0.015;
}
function formationDefenseFactor(formationKey) {
  const f = FORMATIONS[formationKey] || FORMATIONS["1-2-2-2"];
  return 0.92 + f.def * 0.06 + f.mid * 0.01;
}

// --- Force d'une équipe pour un match, selon XI titulaire ---
function computeTeamStrength(team, lineup) {
  let speed = 0, technique = 0, physical = 0, mental = 0, form = 0, count = 0;
  lineup.forEach(pid => {
    const p = team.players.find(pl => pl.id === pid);
    if (!p) return;
    speed += p.speed;
    technique += p.technique;
    physical += p.physical;
    mental += p.mental;
    form += p.form;
    count++;
  });
  if (count === 0) return { overall: 50, speed: 50, technique: 50, physical: 50, mental: 50, form: 70 };
  return {
    speed: speed / count,
    technique: technique / count,
    physical: physical / count,
    mental: mental / count,
    form: form / count,
    overall: (speed + technique + physical + mental) / (count * 4) * (form / count / 80)
  };
}

// --- Moteur de simulation incrémental (minute par minute) ---
// homeSetup / awaySetup = { lineup: [ids], formation, attackPlan, defensePlan }
// Les lineups/plans peuvent être modifiés entre deux appels à simulateMinute()
// (changements tactiques, remplacements en cours de match).
// Le match humain en direct ne pilote plus ce moteur minute par minute (voir
// matchphysics.js/app.js:createTurnMatch pour le plateau physique en tours) : il
// n'appelle que advancePhase(minute) pour le bookkeeping de phase (escalier, Ballon
// Spécial, Dé Géant, Matchball, cartons, blessures) et recordGoalFromPlay/
// recordSaveFromPlay pour les buts réellement marqués sur le plateau. simulateMinute
// (occasions tirées au sort) ne sert plus qu'aux matchs IA vs IA en arrière-plan
// (simulateMatch/simulateAIMatch), inchangés.
function createMatchEngine(homeTeam, homeSetup, awayTeam, awaySetup) {
  const TOTAL_MINUTES = 40;
  const HALF_TIME = 20;
  const homeBonus = 1.08;

  // Début de match (effectifs réduits, 1 contre 1 jusqu'au 7v7) : plus d'occasions et de buts.
  const EARLY_PHASE_END_MINUTE = 7;
  const EARLY_PHASE_CHANCE_BOOST = 1.6;
  const EARLY_PHASE_GOAL_BOOST = 1.5;

  // --- Règlement Kings League : repères temporels officiels ---
  const ESCALIER_END_MINUTE = 5;        // 0'-5' : montée en puissance jusqu'au 7v7
  const DOUBLE_GOAL_START_MINUTE = 17;  // 17'-20' : tous les buts comptent double
  const DICE_START_MINUTE = 21;         // 20'-23' (reprise de la 2e mi-temps) : le Dé Géant
  const DICE_END_MINUTE = 23;
  const MATCHBALL_START_MINUTE = 36;    // 36'+ : Matchball, escalier inversé jusqu'au 1v1
  // Fenêtres d'activation des Cartes Secrètes / Penalty du Président
  const SPECIAL_WINDOW_1 = [5, 17];
  const SPECIAL_WINDOW_2 = [23, 36];
  const PRESIDENT_PENALTY_DEADLINE = 35; // doit être activé avant 35:59 (donc <= 35)

  const events = [];
  let homeGoals = 0, awayGoals = 0;
  let homeShots = 0, awayShots = 0;
  let possessionSum = 0, possessionCount = 0;
  const playerStats = {}; // id -> {goals, assists}

  // --- Règlement Kings League : formats réduits (début progressif / dé géant / Matchball) ---
  const diceState = { active: false, rolled: false, announced: false, count: 6 };
  // Tire le Dé Géant au plus tard la première fois qu'on en a besoin (mémoïsé) : permet de
  // connaître le format de la phase avant même qu'elle ne commence (sélection manuelle des
  // joueurs en amont), sans attendre que simulateMinute(21) ne s'exécute.
  function ensureDiceRolled() {
    if (!diceState.rolled) {
      diceState.rolled = true;
      diceState.count = 1 + Math.floor(Math.random() * 3);
    }
    return diceState.count;
  }
  let globalDoubleGoalActive = false; // ballon spécial 17'-20' : but double pour les deux équipes
  let matchballDecided = false;
  let matchballWinnerSide = null;
  let matchballTarget = null; // nombre de buts total à atteindre pour gagner immédiatement (= score du leader + 1 au début de la phase)
  const presidentState = { home: { used: false }, away: { used: false } };
  // Cartons : jaune (exclusion temporaire de 2 min hors Matchball) et rouge (exclusion
  // définitive du joueur, mais équipe renforcée par un remplaçant du banc après 5 min).
  const cardSanctions = {
    home: { yellow: [], redActive: [] },
    away: { yellow: [], redActive: [] }
  };

  // Nombre de joueurs de champ actifs par équipe pour une minute donnée, sans plancher (peut valoir 0 avant le coup d'envoi).
  function computeOutfieldCap(minute) {
    if (minute >= MATCHBALL_START_MINUTE) {
      // Escalier inversé du Matchball : 5v5 → 4v4 → 3v3 → 2v2 → 1v1 (et y reste ensuite).
      return Math.max(1, 6 - (minute - (MATCHBALL_START_MINUTE - 1)));
    }
    // Escalier de départ : 1v1 au coup d'envoi, 7v7 atteint à la 5e minute.
    let cap = Math.min(6, minute + 1);
    if (minute >= DICE_START_MINUTE && minute <= DICE_END_MINUTE) {
      cap = Math.min(cap, ensureDiceRolled());
    }
    return cap;
  }
  // Même chose, mais toujours au moins 1 joueur de champ sur le terrain.
  function getPhaseOutfieldCap(minute) { return Math.max(1, computeOutfieldCap(minute)); }

  // Sélectionne les joueurs de champ actifs pour le format réduit de la minute, en excluant
  // les joueurs actuellement suspendus (carton jaune en cours, hors Matchball). Si l'équipe a
  // fourni une présélection explicite (setup.activeOverride — choix manuel du joueur humain à
  // chaque changement de phase), elle est utilisée en priorité ; sinon les meilleurs disponibles.
  function getActiveOutfieldIds(team, setup, minute, side) {
    const cap = getPhaseOutfieldCap(minute);
    const suspended = side ? new Set(
      cardSanctions[side].yellow.filter(y => minute <= y.until).map(y => y.playerId)
    ) : new Set();
    const outfield = setup.lineup
      .map(id => team.players.find(p => p.id === id))
      .filter(p => p && p.pos !== "GK" && !suspended.has(p.id));
    if (outfield.length <= cap) return outfield.map(p => p.id);

    if (Array.isArray(setup.activeOverride) && setup.activeOverride.length) {
      const overrideIds = setup.activeOverride.filter(id => outfield.some(p => p.id === id));
      if (overrideIds.length >= cap) return overrideIds.slice(0, cap);
    }
    return [...outfield].sort((a, b) => b.overall - a.overall).slice(0, cap).map(p => p.id);
  }

  function isGlobalDoubleGoalActive(minute) { return globalDoubleGoalActive && minute <= HALF_TIME; }
  function isInWindow(minute, [start, end]) { return minute >= start && minute <= end; }
  // Fenêtre d'activation : Cartes Secrètes (5-17 puis 23-36) et Penalty du Président
  // (5-17 puis 23-35, doit être déclenché avant 35:59 — interdit pendant escalier/dé/Matchball).
  function isSpecialActionWindowOpen(minute, kind) {
    const deadline = kind === "president" ? PRESIDENT_PENALTY_DEADLINE : SPECIAL_WINDOW_2[1];
    return isInWindow(minute, SPECIAL_WINDOW_1) || isInWindow(minute, [SPECIAL_WINDOW_2[0], deadline]);
  }

  function isMatchDecided() { return matchballDecided; }
  function getMatchballWinner() { return matchballWinnerSide; }

  function getAttackers(team, setup) {
    return setup.lineup
      .map(id => team.players.find(p => p.id === id))
      .filter(p => p && p.pos !== "GK");
  }
  function getGK(team, setup) {
    return setup.lineup
      .map(id => team.players.find(p => p.id === id))
      .find(p => p && p.pos === "GK");
  }

  function weightedPick(players) {
    if (players.length === 0) return null;
    // weight by technique+physical, attackers more likely
    const weights = players.map(p => {
      let w = (p.technique + p.physical + p.speed) / 3;
      if (p.pos === "ATT") w *= 2.2;
      else if (p.pos === "MID") w *= 1.5;
      else w *= 0.6;
      return w;
    });
    const total = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (let i = 0; i < players.length; i++) {
      r -= weights[i];
      if (r <= 0) return players[i];
    }
    return players[players.length - 1];
  }

  function recordStat(id, field) {
    playerStats[id] = playerStats[id] || { goals: 0, assists: 0 };
    playerStats[id][field]++;
  }

  // --- Armes secrètes (cartes spéciales) ---
  const cardState = {
    home: { key: null, used: false, doubleUntil: 0, starPlayerId: null, starUsed: false, sanctionUntil: 0 },
    away: { key: null, used: false, doubleUntil: 0, starPlayerId: null, starUsed: false, sanctionUntil: 0 }
  };

  function setCard(side, key) { cardState[side].key = key; }
  function getCards() { return { home: cardState.home.key, away: cardState.away.key }; }
  function isCardUsed(side) { return cardState[side].used; }

  // Applique le bonus "but double" (Carte But Double active, but du Joueur Étoile, ou
  // ballon spécial 17'-20') et renvoie un texte à ajouter au commentaire du but.
  function applyGoalBonus(side, minute, scorerId) {
    const cs = cardState[side];
    let extra = 0, tag = "";
    if (minute <= cs.doubleUntil) {
      extra = 1;
      tag = " (BUT DOUBLE — Carte But Double !)";
    } else if (scorerId && cs.starPlayerId === scorerId && !cs.starUsed && minute <= 38) {
      extra = 1;
      cs.starUsed = true;
      cs.starPlayerId = null;
      tag = " (BUT DOUBLE — Joueur Étoile !)";
    } else if (isGlobalDoubleGoalActive(minute)) {
      extra = 1;
      tag = " (BUT DOUBLE — Ballon Spécial !)";
    }
    if (extra) {
      if (side === "home") homeGoals += extra; else awayGoals += extra;
    }
    return tag;
  }

  // Enregistre un but (avec ses éventuels bonus "but double") et détecte la fin
  // immédiate du match si l'on est en phase Matchball : la première équipe à atteindre
  // le total de buts cible (= score du leader + 1 au début de la phase) gagne.
  function registerGoal(side, minute, scorerId) {
    if (side === "home") homeGoals++; else awayGoals++;
    const tag = applyGoalBonus(side, minute, scorerId);
    if (matchballTarget !== null && !matchballDecided) {
      if (homeGoals >= matchballTarget) {
        matchballDecided = true;
        matchballWinnerSide = "home";
      } else if (awayGoals >= matchballTarget) {
        matchballDecided = true;
        matchballWinnerSide = "away";
      }
    }
    return tag;
  }

  // Retire un joueur de la composition (carton) sans le remplacer.
  function removeFromLineup(setupRef, playerId) {
    const idx = setupRef.lineup.indexOf(playerId);
    if (idx >= 0) setupRef.lineup.splice(idx, 1);
  }

  // Fait entrer le meilleur remplaçant disponible du banc (même poste si possible) :
  // utilisé après un carton rouge (5 minutes après, l'équipe redevient au complet) ou
  // immédiatement après un carton jaune en phase Matchball.
  function addBenchSubstitute(teamRef, setupRef, preferredPos) {
    const benchPool = teamRef.players.filter(p => !setupRef.lineup.includes(p.id));
    if (benchPool.length === 0) return null;
    const sameRole = benchPool.filter(p => p.pos === preferredPos);
    const candidates = sameRole.length > 0 ? sameRole : benchPool;
    const best = [...candidates].sort((a, b) => b.overall - a.overall)[0];
    setupRef.lineup.push(best.id);
    return best;
  }

  // Tentative de penalty générique (Carte Penalty, penalty aléatoire, Penalty du Président...).
  function performPenaltyAttempt(side, minute, options, label) {
    options = options || {};
    const team = side === "home" ? homeTeam : awayTeam;
    const setup = side === "home" ? homeSetup : awaySetup;
    const oppTeam = side === "home" ? awayTeam : homeTeam;
    const oppSetup = side === "home" ? awaySetup : homeSetup;
    const oppGK = getGK(oppTeam, oppSetup);
    const evts = [];
    const taker = options.taker || weightedPick(getAttackers(team, setup));
    if (!taker) return evts;

    if (side === "home") homeShots++; else awayShots++;
    const scored = Math.random() < (0.7 + taker.mental / 400 - (oppGK ? oppGK.physical / 600 : 0));
    if (scored) {
      recordStat(taker.id, "goals");
      const tag = registerGoal(side, minute, taker.id);
      evts.push({ minute, type: "goal", team: team.name, side, scorerId: taker.id, gkId: oppGK ? oppGK.id : null, text: `${minute}' — ⚽ ${label} ! ${taker.name} (${team.name}) transforme et marque !${tag}` });
    } else {
      evts.push({ minute, type: "save", team: team.name, side, takerId: taker.id, gkId: oppGK ? oppGK.id : null, text: `${minute}' — ⚽ ${label} ! ${taker.name} (${team.name}) tire... mais ${oppGK ? oppGK.name : "le gardien"} arrête !` });
    }
    return evts;
  }

  // Tentative de "shootout" générique (Carte Shootout, ou shootout déclenché par un carton
  // jaune adverse en Matchball) : le tireur part seul du milieu de terrain face au gardien.
  function performShootoutAttempt(side, minute, options, label) {
    options = options || {};
    const team = side === "home" ? homeTeam : awayTeam;
    const setup = side === "home" ? homeSetup : awaySetup;
    const oppTeam = side === "home" ? awayTeam : homeTeam;
    const oppSetup = side === "home" ? awaySetup : homeSetup;
    const oppGK = getGK(oppTeam, oppSetup);
    const evts = [];
    const shooter = options.taker || weightedPick(getAttackers(team, setup));
    if (!shooter) return evts;

    if (side === "home") homeShots++; else awayShots++;
    const fault = Math.random() < 0.08;
    if (fault) {
      evts.push({ minute, type: "miss", team: team.name, side, takerId: shooter.id, text: `${minute}' — 🥊 ${label} ! ${shooter.name} (${team.name}) commet une faute technique, le but est refusé !` });
      return evts;
    }
    const gkFault = Math.random() < 0.06;
    let chance = 0.55 + shooter.technique / 300 - (oppGK ? oppGK.physical / 500 : 0);
    if (gkFault) chance += 0.3;
    chance = Math.max(0.1, Math.min(0.95, chance));
    const scored = Math.random() < chance;
    if (scored) {
      recordStat(shooter.id, "goals");
      const tag = registerGoal(side, minute, shooter.id);
      evts.push({ minute, type: "goal", team: team.name, side, scorerId: shooter.id, gkId: oppGK ? oppGK.id : null, text: `${minute}' — 🥊 ${label} ! ${shooter.name} (${team.name}) élimine le gardien et marque !${tag}` });
    } else {
      evts.push({ minute, type: "save", team: team.name, side, takerId: shooter.id, gkId: oppGK ? oppGK.id : null, text: `${minute}' — 🥊 ${label} ! ${oppGK ? oppGK.name : "Le gardien"} sort vainqueur du face-à-face avec ${shooter.name} !` });
      if (gkFault) {
        evts.push({ minute, type: "phase", text: `🥊 Faute du gardien de ${oppTeam.name} ! Penalty immédiat accordé.` });
        evts.push(...performPenaltyAttempt(side, minute, { taker: shooter }, "Penalty"));
      }
    }
    return evts;
  }

  function isPresidentPenaltyUsed(side) { return presidentState[side].used; }
  function getPresidents(side) {
    const team = side === "home" ? homeTeam : awayTeam;
    return (team.presidents && team.presidents.length) ? team.presidents : [team.name + " (Président)"];
  }

  // Tir du président lui-même : ce n'est pas un footballeur, le tir est donc plus
  // hasardeux qu'un penalty classique (mais reste possible, comme dans la vraie Kings League).
  function performPresidentPenaltyKick(side, minute, presidentName) {
    const team = side === "home" ? homeTeam : awayTeam;
    const oppTeam = side === "home" ? awayTeam : homeTeam;
    const oppSetup = side === "home" ? awaySetup : homeSetup;
    const oppGK = getGK(oppTeam, oppSetup);
    const evts = [];

    if (side === "home") homeShots++; else awayShots++;
    const chance = Math.max(0.25, Math.min(0.7, 0.5 - (oppGK ? oppGK.physical / 700 : 0)));
    const scored = Math.random() < chance;
    if (scored) {
      const tag = registerGoal(side, minute, null);
      evts.push({ minute, type: "goal", team: team.name, side, scorerId: null, gkId: oppGK ? oppGK.id : null, text: `${minute}' — ⚽ Penalty du Président ! ${presidentName} (président de ${team.name}) s'élance... et MARQUE !${tag}` });
    } else {
      evts.push({ minute, type: "save", team: team.name, side, takerId: null, gkId: oppGK ? oppGK.id : null, text: `${minute}' — ⚽ Penalty du Président ! ${presidentName} (président de ${team.name}) tire... mais ${oppGK ? oppGK.name : "le gardien"} arrête !` });
    }
    return evts;
  }

  // "Buzzer" du Président : penalty immédiat tiré par le président lui-même, utilisable
  // une fois par match et par équipe, indépendant des Armes Secrètes.
  // options.presidentName permet de choisir lequel tire s'il y en a plusieurs (sinon tirage aléatoire).
  function triggerPresidentPenalty(side, minute, options) {
    if (presidentState[side].used) return [];
    if (!isSpecialActionWindowOpen(minute, "president")) return [];
    presidentState[side].used = true;
    options = options || {};
    const team = side === "home" ? homeTeam : awayTeam;
    const presidents = getPresidents(side);
    const presidentName = options.presidentName && presidents.includes(options.presidentName)
      ? options.presidentName
      : presidents[Math.floor(Math.random() * presidents.length)];
    const evts = [{ minute, type: "phase", text: `🛎️ ${presidentName} actionne le buzzer pour ${team.name} et s'apprête à tirer lui-même le penalty !` }];
    evts.push(...performPresidentPenaltyKick(side, minute, presidentName));
    return evts;
  }

  // Active une Arme Secrète pour l'équipe `side` ("home"/"away") et renvoie les
  // événements générés. `options` peut contenir { taker, player, targetName, copyKey, mode }.
  function activateCard(side, key, options, minute) {
    if (!isSpecialActionWindowOpen(minute, "card")) return [];
    options = options || {};
    const opp = side === "home" ? "away" : "home";
    const team = side === "home" ? homeTeam : awayTeam;
    const setup = side === "home" ? homeSetup : awaySetup;
    const oppTeam = side === "home" ? awayTeam : homeTeam;
    const oppSetup = side === "home" ? awaySetup : homeSetup;
    const evts = [];

    switch (key) {
      case "doubleGoal": {
        cardState[side].doubleUntil = minute + 4;
        evts.push({ minute, type: "phase", text: `🟡 ${team.name} active la Carte But Double ! Pendant 4 minutes, chaque but marqué comptera double.` });
        break;
      }
      case "sanction": {
        cardState[opp].sanctionUntil = minute + 4;
        const targetName = options.targetName || "un joueur adverse";
        evts.push({ minute, type: "phase", text: `🔴 ${team.name} active la Carte Sanction sur ${targetName} ! ${oppTeam.name} joue à 6 contre 7 pendant 4 minutes.` });
        break;
      }
      case "penalty": {
        evts.push(...performPenaltyAttempt(side, minute, options, "Carte Penalty"));
        break;
      }
      case "shootout": {
        evts.push(...performShootoutAttempt(side, minute, options, "Carte Shootout"));
        break;
      }
      case "reversePenalty": {
        // L'adversaire tire le penalty : s'il marque, le but ne compte pas ; s'il rate, but pour vous.
        const taker = options.taker || weightedPick(getAttackers(oppTeam, oppSetup));
        if (taker) {
          if (opp === "home") homeShots++; else awayShots++;
          const sideGK = getGK(team, setup);
          const scored = Math.random() < (0.7 + taker.mental / 400 - (sideGK ? sideGK.physical / 600 : 0));
          if (scored) {
            evts.push({ minute, type: "save", team: team.name, side: opp, takerId: taker.id, gkId: sideGK ? sideGK.id : null, text: `${minute}' — 🙃 Penalty Inverse ! ${taker.name} (${oppTeam.name}) marque... mais le but ne compte pas !` });
          } else {
            const tag = registerGoal(side, minute, null);
            evts.push({ minute, type: "goal", team: team.name, side, scorerId: null, gkId: sideGK ? sideGK.id : null, text: `${minute}' — 🙃 Penalty Inverse ! ${taker.name} (${oppTeam.name}) rate son tir... but accordé à ${team.name} !${tag}` });
          }
        }
        break;
      }
      case "starPlayer": {
        const p = options.player;
        if (p) {
          cardState[side].starPlayerId = p.id;
          cardState[side].starUsed = false;
          evts.push({ minute, type: "phase", text: `⭐ ${team.name} active la Carte Joueur Étoile sur ${p.name} ! Son prochain but avant la 38e minute comptera double.` });
        }
        break;
      }
      case "joker": {
        if (options.mode === "steal") {
          if (!cardState[opp].used && cardState[opp].key) {
            const stolenKey = cardState[opp].key;
            cardState[opp].used = true;
            evts.push({ minute, type: "phase", text: `🃏 ${team.name} active le Joker et VOLE la carte adverse !` });
            evts.push(...activateCard(side, stolenKey, options, minute));
          } else {
            evts.push({ minute, type: "phase", text: `🃏 ${team.name} active le Joker, mais le vol échoue (carte adverse déjà jouée) !` });
          }
        } else {
          evts.push({ minute, type: "phase", text: `🃏 ${team.name} active le Joker en copiant une autre Arme Secrète !` });
          evts.push(...activateCard(side, options.copyKey, options, minute));
        }
        break;
      }
    }

    cardState[side].used = true;
    return evts;
  }

  // Applique le résultat d'une tentative de but (BUT / arrêt / tir raté) à l'état interne du
  // moteur (stats, score, bonus "but double") et construit l'événement de commentaire
  // correspondant. Factorisé pour être partagé entre attemptAttack (résolution par tirage au
  // sort, matchs IA) et recordGoalFromPlay/recordSaveFromPlay (résolution par le plateau
  // physique du match humain, voir matchphysics.js/app.js).
  function resolveAttackOutcome(minute, attackingTeamName, side, outcome, scorer, gk, assister) {
    if (outcome === "goal") {
      recordStat(scorer.id, "goals");
      let assistText = "";
      if (assister) {
        recordStat(assister.id, "assists");
        assistText = ` (passe décisive de ${assister.name})`;
      }
      const goalTag = registerGoal(side, minute, scorer.id);
      return {
        minute, type: "goal", team: attackingTeamName, side, scorerId: scorer.id, assisterId: assister ? assister.id : null, gkId: gk ? gk.id : null,
        text: `${minute}' — BUT ! ${scorer.name} (${attackingTeamName}) marque${assistText} !${goalTag}`
      };
    }
    if (outcome === "save") {
      return {
        minute, type: "save", team: attackingTeamName, side, takerId: scorer.id, gkId: gk ? gk.id : null,
        text: `${minute}' — Tir de ${scorer.name}, arrêt magnifique du gardien ${gk ? gk.name : "adverse"} !`
      };
    }
    return {
      minute, type: "miss", team: attackingTeamName, side, takerId: scorer.id,
      text: `${minute}' — ${scorer.name} tente sa chance mais le tir passe à côté.`
    };
  }

  function attemptAttack(minute, minuteEvents, attackingTeamName, attackers, gk, attackPower, defenseFactor, isHome) {
    const scorer = weightedPick(attackers);
    if (!scorer) return;

    if (isHome) homeShots++; else awayShots++;

    // chance de but: dépend de l'écart de force, technique du tireur, gardien adverse
    const goalBoost = minute <= EARLY_PHASE_END_MINUTE ? EARLY_PHASE_GOAL_BOOST : 1;
    const baseChance = 0.28 + (attackPower - 50) / 200 - (gk ? gk.physical / 500 : 0.1);
    let chance = baseChance * defenseFactor * (0.7 + scorer.technique / 150) * (scorer.form / 85) * goalBoost;
    chance = Math.max(0.04, Math.min(0.85, chance));

    const side = isHome ? "home" : "away";
    const roll = Math.random();
    let outcome = null;
    if (roll < chance) outcome = "goal";
    else if (roll < chance + 0.25) outcome = "save";
    else if (roll < chance + 0.45) outcome = "miss";
    if (!outcome) return; // occasion ratée silencieuse

    let assister = null;
    if (outcome === "goal") {
      const assistCandidates = attackers.filter(p => p.id !== scorer.id);
      if (assistCandidates.length > 0 && Math.random() < 0.6) assister = weightedPick(assistCandidates);
    }
    minuteEvents.push(resolveAttackOutcome(minute, attackingTeamName, side, outcome, scorer, gk, assister));
  }

  // Fait avancer le bookkeeping de phase pour une minute donnée (indépendant de la façon dont
  // les buts sont marqués) : sub auto après carton rouge, annonces escalier/Ballon Spécial/Dé
  // Géant/Matchball, et les événements aléatoires rares (blessure/carton/penalty). Renvoie aussi
  // le contexte (compositions actives, attaquants, gardiens) pour que simulateMinute puisse
  // enchaîner sur les occasions sans tout recalculer. `stopAfterPenalty` signale qu'un penalty
  // aléatoire a déjà consommé l'action de cette minute (comme avant : plus d'occasions ce tour).
  function advancePhaseState(minute) {
    const minuteEvents = [];

    // Remplacements automatiques : 5 minutes après un carton rouge, un joueur du banc entre
    // pour ramener l'équipe à effectif complet (le joueur expulsé ne revient jamais).
    [["home", homeSetup, homeTeam], ["away", awaySetup, awayTeam]].forEach(([side, setupRef, teamRef]) => {
      const sanctions = cardSanctions[side];
      sanctions.redActive = sanctions.redActive.filter(entry => {
        if (minute > entry.until) {
          const sub = addBenchSubstitute(teamRef, setupRef, entry.pos);
          if (sub) {
            minuteEvents.push({
              minute, type: "phase", team: teamRef.name, side, inId: sub.id, outId: entry.playerId,
              text: `${minute}' — 🔁 ${teamRef.name} fait entrer ${sub.name} : l'équipe retrouve son effectif complet après le carton rouge.`
            });
          }
          return false;
        }
        return true;
      });
    });

    // Début progressif : 1 contre 1 au coup d'envoi, 7v7 atteint à la 5e minute.
    const prevCap = computeOutfieldCap(minute - 1);
    const curCap = computeOutfieldCap(minute);
    if (minute <= ESCALIER_END_MINUTE && curCap > prevCap) {
      minuteEvents.push({
        minute, type: "phase",
        text: `🔼 Un nouveau joueur entre sur le terrain pour chaque équipe (${curCap + 1}v${curCap + 1}) !`
      });
    }

    // Ballon spécial : à la 17e minute, tous les buts comptent double jusqu'à la pause (20').
    if (minute === DOUBLE_GOAL_START_MINUTE && !globalDoubleGoalActive) {
      globalDoubleGoalActive = true;
      minuteEvents.push({
        minute, type: "phase",
        text: `🟠 Un ballon d'une autre couleur entre en jeu ! Tous les buts comptent double jusqu'à la mi-temps !`
      });
    }

    // Le dé géant : à la reprise de la 2e mi-temps (20'-23'), format réduit (1v1/2v2/3v3).
    // Le tirage peut déjà avoir eu lieu en amont via ensureDiceRolled() (sélection manuelle de
    // la composition avant le début de la phase) : on ne le retire pas, on se contente d'annoncer.
    if (minute === DICE_START_MINUTE && !diceState.announced) {
      diceState.announced = true;
      diceState.active = true;
      const count = ensureDiceRolled();
      minuteEvents.push({
        minute, type: "phase",
        text: `🎲 LE DÉ GÉANT tombe sur ${count} ! Format ${count}v${count} jusqu'à la 23e minute !`
      });
    }
    if (minute === DICE_END_MINUTE + 1 && diceState.active) {
      diceState.active = false;
      minuteEvents.push({ minute, type: "phase", text: "🔼 Retour au format complet (7v7) !" });
    }

    // Le Matchball : à partir de la 36e minute, la première équipe à atteindre le score
    // du leader + 1 but remporte le match immédiatement (ex. 2-0 → objectif 3 buts).
    // L'escalier inversé commence aussitôt : 5v5 → 4v4 → 3v3 → 2v2 → 1v1.
    // Si les deux équipes sont à égalité au moment où le Matchball démarre, pas de prolongation :
    // le match s'arrête immédiatement et se décide directement aux tirs au but.
    if (minute === MATCHBALL_START_MINUTE && matchballTarget === null && !matchballDecided) {
      if (homeGoals === awayGoals) {
        matchballDecided = true;
        minuteEvents.push({
          minute, type: "phase",
          text: `🏆 MATCHBALL ! Égalité au coup d'envoi du Matchball : le match se décide directement aux tirs au but !`
        });
      } else {
        matchballTarget = Math.max(homeGoals, awayGoals) + 1;
        minuteEvents.push({
          minute, type: "phase",
          text: `🏆 MATCHBALL ! La première équipe à marquer son ${matchballTarget}e but remporte le match immédiatement ! L'escalier inversé commence.`
        });
      }
    }

    const homeActiveOutfield = getActiveOutfieldIds(homeTeam, homeSetup, minute, "home");
    const awayActiveOutfield = getActiveOutfieldIds(awayTeam, awaySetup, minute, "away");
    const homeGKPlayer = getGK(homeTeam, homeSetup);
    const awayGKPlayer = getGK(awayTeam, awaySetup);
    const homeActiveLineup = homeGKPlayer ? [homeGKPlayer.id, ...homeActiveOutfield] : homeActiveOutfield;
    const awayActiveLineup = awayGKPlayer ? [awayGKPlayer.id, ...awayActiveOutfield] : awayActiveOutfield;
    const homeAttackers = homeActiveOutfield.map(id => homeTeam.players.find(p => p.id === id)).filter(Boolean);
    const awayAttackers = awayActiveOutfield.map(id => awayTeam.players.find(p => p.id === id)).filter(Boolean);
    const homeGK = homeGKPlayer;
    const awayGK = awayGKPlayer;

    // événement spécial: blessure légère (rare)
    if (Math.random() < 0.004) {
      const side = Math.random() < 0.5 ? "home" : "away";
      const pool = side === "home" ? homeActiveLineup.map(id => homeTeam.players.find(p => p.id === id)) : awayActiveLineup.map(id => awayTeam.players.find(p => p.id === id));
      const victim = pool.filter(Boolean)[Math.floor(Math.random() * pool.filter(Boolean).length)];
      if (victim) {
        minuteEvents.push({
          minute, type: "injury", team: side === "home" ? homeTeam.name : awayTeam.name, side, playerId: victim.id,
          text: `${minute}' — ${victim.name} se fait soigner suite à un choc, ça repart !`
        });
      }
    }

    // événement spécial: carton jaune (rare)
    if (Math.random() < 0.012) {
      const side = Math.random() < 0.5 ? "home" : "away";
      const pool = side === "home" ? homeAttackers : awayAttackers;
      const victim = pool[Math.floor(Math.random() * pool.length)];
      if (victim) {
        const teamRef = side === "home" ? homeTeam : awayTeam;
        const setupRef = side === "home" ? homeSetup : awaySetup;
        if (minute >= MATCHBALL_START_MINUTE) {
          // En Matchball, le carton jaune ne réduit pas l'effectif : remplacement immédiat
          // et shootout accordé à l'adversaire.
          removeFromLineup(setupRef, victim.id);
          const sub = addBenchSubstitute(teamRef, setupRef, victim.pos);
          minuteEvents.push({
            minute, type: "yellow", team: teamRef.name, side, playerId: victim.id, inId: sub ? sub.id : null, outId: victim.id,
            text: `${minute}' — 🟨 Carton jaune pour ${victim.name} (${teamRef.name}) ! En Matchball, pas de réduction d'effectif${sub ? `, ${sub.name} le remplace` : ""} — shootout accordé à l'adversaire !`
          });
          const oppSide = side === "home" ? "away" : "home";
          const oppTeamRef = oppSide === "home" ? homeTeam : awayTeam;
          const oppSetupRef = oppSide === "home" ? homeSetup : awaySetup;
          const shooter = weightedPick(getAttackers(oppTeamRef, oppSetupRef));
          if (shooter) minuteEvents.push(...performShootoutAttempt(oppSide, minute, { taker: shooter }, "Shootout (carton jaune)"));
        } else {
          cardSanctions[side].yellow.push({ playerId: victim.id, until: minute + 2 });
          minuteEvents.push({
            minute, type: "yellow", team: teamRef.name, side, playerId: victim.id,
            text: `${minute}' — 🟨 Carton jaune pour ${victim.name} (${teamRef.name}) : exclu 2 minutes, ${teamRef.name} joue en infériorité numérique !`
          });
        }
      }
    }

    // événement spécial: carton rouge (très rare)
    if (Math.random() < 0.002) {
      const side = Math.random() < 0.5 ? "home" : "away";
      const pool = side === "home" ? homeAttackers.concat([homeGK]).filter(Boolean) : awayAttackers.concat([awayGK]).filter(Boolean);
      const victim = pool[Math.floor(Math.random() * pool.length)];
      if (victim) {
        const teamRef = side === "home" ? homeTeam : awayTeam;
        const setupRef = side === "home" ? homeSetup : awaySetup;
        minuteEvents.push({
          minute, type: "red", team: teamRef.name, side, playerId: victim.id,
          text: `${minute}' — CARTON ROUGE ! ${victim.name} est expulsé !`
        });
        removeFromLineup(setupRef, victim.id);
        if (minute >= MATCHBALL_START_MINUTE) {
          // En Matchball, le carton rouge octroie un penalty classique immédiat à l'adversaire.
          const oppSide = side === "home" ? "away" : "home";
          minuteEvents.push({ minute, type: "phase", text: "🔴 Carton rouge en Matchball : penalty immédiat accordé à l'adversaire !" });
          minuteEvents.push(...performPenaltyAttempt(oppSide, minute, {}, "Penalty (carton rouge)"));
        } else {
          // 5 minutes à un de moins, puis remplacé par le banc (retour à l'effectif complet).
          cardSanctions[side].redActive.push({ playerId: victim.id, pos: victim.pos, until: minute + 5 });
        }
      }
    }

    // événement spécial: penalty (rare) — tranche 50/50, consomme l'action de cette minute.
    let stopAfterPenalty = false;
    if (Math.random() < 0.006) {
      const isHome = Math.random() < 0.5;
      const side = isHome ? "home" : "away";
      const attackers = isHome ? homeAttackers : awayAttackers;
      const taker = weightedPick(attackers);
      minuteEvents.push(...performPenaltyAttempt(side, minute, { taker }, "PENALTY"));
      stopAfterPenalty = true;
    }

    return {
      minuteEvents, stopAfterPenalty,
      homeActiveOutfield, awayActiveOutfield, homeActiveLineup, awayActiveLineup,
      homeAttackers, awayAttackers, homeGK, awayGK
    };
  }

  // Simule une minute de jeu et renvoie les événements survenus durant cette minute. Utilisée
  // uniquement par simulateMatch/simulateAIMatch (matchs IA en arrière-plan, résolution par
  // tirage au sort) — le match humain en direct pilote le plateau physique et n'appelle que
  // advancePhase()/recordGoalFromPlay()/recordSaveFromPlay() (voir plus bas et app.js).
  function simulateMinute(minute) {
    const phase = advancePhaseState(minute);
    const minuteEvents = phase.minuteEvents;
    if (phase.stopAfterPenalty) {
      events.push(...minuteEvents);
      return minuteEvents;
    }

    const { homeActiveOutfield, awayActiveOutfield, homeActiveLineup, awayActiveLineup, homeAttackers, awayAttackers, homeGK, awayGK } = phase;

    const homeStrength = computeTeamStrength(homeTeam, homeActiveLineup);
    const awayStrength = computeTeamStrength(awayTeam, awayActiveLineup);

    const homeAtk = ATTACK_PLANS[homeSetup.attackPlan];
    const awayAtk = ATTACK_PLANS[awaySetup.attackPlan];
    const homeDef = DEFENSE_PLANS[homeSetup.defensePlan];
    const awayDef = DEFENSE_PLANS[awaySetup.defensePlan];

    // pénalité en cas d'infériorité numérique (carton rouge actif ou Carte Sanction active)
    const homeSanctioned = minute <= cardState.home.sanctionUntil;
    const awaySanctioned = minute <= cardState.away.sanctionUntil;
    const homeRedPenalty = 1 - (cardSanctions.home.redActive.length + (homeSanctioned ? 1 : 0)) * 0.12;
    const awayRedPenalty = 1 - (cardSanctions.away.redActive.length + (awaySanctioned ? 1 : 0)) * 0.12;

    // La disposition "avec balle" (formation) renforce l'attaque ; la disposition "sans balle"
    // (formationOOP, ou la même si liée) renforce la solidité défensive de l'adversaire.
    const homeAttackPower = homeStrength.overall * homeAtk.goalMod * homeBonus * homeRedPenalty * formationAttackFactor(homeSetup.formation);
    const awayAttackPower = awayStrength.overall * awayAtk.goalMod * awayRedPenalty * formationAttackFactor(awaySetup.formation);

    const homeDefenseFactor = (awayDef.concedeMod / homeRedPenalty) / formationDefenseFactor(awaySetup.formationOOP || awaySetup.formation);
    const awayDefenseFactor = (homeDef.concedeMod / awayRedPenalty) / formationDefenseFactor(homeSetup.formationOOP || homeSetup.formation);

    const possTotal = homeStrength.technique * homeAtk.possMod * homeRedPenalty + awayStrength.technique * awayAtk.possMod * awayRedPenalty;
    const homePossession = Math.round((homeStrength.technique * homeAtk.possMod * homeRedPenalty / possTotal) * 100);
    possessionSum += homePossession;
    possessionCount++;
    minuteEvents.possession = homePossession;

    // but contre son camp (très rare)
    if (Math.random() < 0.0006) {
      const isHomeOG = Math.random() < 0.5;
      const team = isHomeOG ? homeTeam : awayTeam;
      const activeOutfieldIds = isHomeOG ? homeActiveOutfield : awayActiveOutfield;
      const lineupPlayers = activeOutfieldIds.map(id => team.players.find(p => p.id === id)).filter(Boolean);
      const victim = lineupPlayers[Math.floor(Math.random() * lineupPlayers.length)];
      if (victim) {
        const tag = registerGoal(isHomeOG ? "away" : "home", minute, null);
        minuteEvents.push({ minute, type: "owngoal", team: team.name, side: isHomeOG ? "home" : "away", scorerId: victim.id, text: `${minute}' — Catastrophe ! But contre son camp de ${victim.name} (${team.name}) !${tag}` });
      }
    }

    // occasions normales basées sur possession (plus fréquentes en tout début de match)
    const chanceFreqBoost = minute <= EARLY_PHASE_END_MINUTE ? EARLY_PHASE_CHANCE_BOOST : 1;
    const homeChanceRoll = Math.random();
    const awayChanceRoll = Math.random();

    if (homeChanceRoll < 0.10 * (homePossession / 50) * chanceFreqBoost) {
      attemptAttack(minute, minuteEvents, homeTeam.name, homeAttackers, awayGK, homeAttackPower, homeDefenseFactor, true);
    }
    if (awayChanceRoll < 0.10 * ((100 - homePossession) / 50) * chanceFreqBoost) {
      attemptAttack(minute, minuteEvents, awayTeam.name, awayAttackers, homeGK, awayAttackPower, awayDefenseFactor, false);
    }

    events.push(...minuteEvents);
    return minuteEvents;
  }

  // Enregistre un but réellement marqué sur le plateau physique (match humain en tours) :
  // même construction d'événement/mêmes bonus (Ballon Spécial, Carte But Double, Joueur Étoile
  // via registerGoal) qu'un but issu du tirage au sort. gkId = gardien adverse (optionnel, pour
  // le texte/les stats).
  function recordGoalFromPlay(side, minute, scorerId, assisterId, gkId) {
    const team = side === "home" ? homeTeam : awayTeam;
    const oppTeam = side === "home" ? awayTeam : homeTeam;
    const scorer = team.players.find(p => p.id === scorerId);
    if (!scorer) return null;
    const assister = assisterId ? team.players.find(p => p.id === assisterId) : null;
    const gk = gkId ? oppTeam.players.find(p => p.id === gkId) : null;
    if (side === "home") homeShots++; else awayShots++;
    const ev = resolveAttackOutcome(minute, team.name, side, "goal", scorer, gk, assister);
    events.push(ev);
    return ev;
  }

  // But contre son camp détecté sur le plateau physique (le dernier disque à avoir touché le
  // ballon avant qu'il ne franchisse la ligne appartenait au camp qui encaisse).
  function recordOwnGoalFromPlay(concedingSide, minute, victimId) {
    const team = concedingSide === "home" ? homeTeam : awayTeam;
    const victim = team.players.find(p => p.id === victimId);
    if (!victim) return null;
    const benefitingSide = concedingSide === "home" ? "away" : "home";
    const tag = registerGoal(benefitingSide, minute, null);
    const ev = {
      minute, type: "owngoal", team: team.name, side: benefitingSide, scorerId: victim.id,
      text: `${minute}' — Catastrophe ! But contre son camp de ${victim.name} (${team.name}) !${tag}`
    };
    events.push(ev);
    return ev;
  }

  // Arrêt franc du gardien détecté sur le plateau physique (flavor pour le commentaire, n'affecte
  // pas le score). side = camp qui tirait ; gkId = gardien adverse qui a arrêté le ballon.
  function recordSaveFromPlay(side, minute, takerId, gkId) {
    const team = side === "home" ? homeTeam : awayTeam;
    const oppTeam = side === "home" ? awayTeam : homeTeam;
    const taker = team.players.find(p => p.id === takerId);
    if (!taker) return null;
    const gk = gkId ? oppTeam.players.find(p => p.id === gkId) : null;
    if (side === "home") homeShots++; else awayShots++;
    const ev = resolveAttackOutcome(minute, team.name, side, "save", taker, gk, null);
    events.push(ev);
    return ev;
  }

  // Calcule le résultat final (notes des joueurs, possession moyenne, etc.)
  // shootoutResult (optionnel) : résultat de simulatePenaltyShootout() si le score est à égalité
  function finalize(shootoutResult) {
    const ratings = {};
    function rateLineup(team, setup, won, draw) {
      setup.lineup.forEach(id => {
        const p = team.players.find(pl => pl.id === id);
        if (!p) return;
        let base = 5.5 + (p.form - 75) / 25 + (Math.random() * 1.2 - 0.6);
        const stat = playerStats[id];
        if (stat) base += stat.goals * 1.2 + stat.assists * 0.7;
        if (won) base += 0.4; else if (draw) base += 0.1; else base -= 0.3;
        ratings[id] = Math.max(1, Math.min(10, Math.round(base * 10) / 10));
      });
    }

    const tied = homeGoals === awayGoals;
    let won = homeGoals > awayGoals;
    let lost = homeGoals < awayGoals;
    let penaltyWinner = null;
    if (tied && shootoutResult) {
      penaltyWinner = shootoutResult.homeWins ? "home" : "away";
      won = shootoutResult.homeWins;
      lost = !shootoutResult.homeWins;
      events.push(...shootoutResult.events);
    }
    const draw = tied && !shootoutResult;
    rateLineup(homeTeam, homeSetup, won, draw);
    rateLineup(awayTeam, awaySetup, lost, draw);

    const homePossession = possessionCount ? Math.round(possessionSum / possessionCount) : 50;

    return {
      homeGoals, awayGoals,
      homeShots, awayShots,
      homePossession, awayPossession: 100 - homePossession,
      events,
      playerStats,
      ratings,
      penaltyWinner,
      shootout: shootoutResult || null
    };
  }

  return {
    totalMinutes: TOTAL_MINUTES,
    halfTime: HALF_TIME,
    simulateMinute,
    finalize,
    getScore: () => ({ homeGoals, awayGoals }),
    getPlayerStats: () => playerStats,
    setCard,
    getCards,
    isCardUsed,
    activateCard,
    getAttackers: (side) => getAttackers(side === "home" ? homeTeam : awayTeam, side === "home" ? homeSetup : awaySetup),
    getGK: (side) => getGK(side === "home" ? homeTeam : awayTeam, side === "home" ? homeSetup : awaySetup),
    // Joueurs réellement sur le terrain à la minute donnée (GK + joueurs de champ actifs) :
    // tient compte de l'escalier de départ, du Dé Géant et de l'escalier inversé du Matchball.
    getActiveLineupIds: (side, minute) => {
      const team = side === "home" ? homeTeam : awayTeam;
      const setup = side === "home" ? homeSetup : awaySetup;
      const gkPlayer = getGK(team, setup);
      const outfieldIds = getActiveOutfieldIds(team, setup, minute, side);
      return gkPlayer ? [gkPlayer.id, ...outfieldIds] : outfieldIds;
    },
    // Nombre de joueurs de champ actifs à la minute donnée (identique pour les deux équipes) :
    // permet à l'interface de détecter un changement de phase (escalier, Dé Géant, Matchball).
    getOutfieldCap: (minute) => getPhaseOutfieldCap(minute),
    // Repères temporels exposés pour que l'interface distingue un escalier progressif (où un
    // seul ordre de priorité suffit pour toute la montée/descente) d'un changement ponctuel
    // (Dé Géant) qui appelle une sélection à effectif fixe.
    ESCALIER_END_MINUTE,
    MATCHBALL_START_MINUTE,
    // Joueurs de champ disponibles (hors GK, hors suspendus) pour le côté donné : la base dans
    // laquelle l'utilisateur choisit manuellement sa composition à chaque changement de phase.
    getAvailableOutfieldIds: (side, minute) => {
      const team = side === "home" ? homeTeam : awayTeam;
      const setup = side === "home" ? homeSetup : awaySetup;
      const suspended = new Set(
        cardSanctions[side].yellow.filter(y => minute <= y.until).map(y => y.playerId)
      );
      return setup.lineup
        .map(id => team.players.find(p => p.id === id))
        .filter(p => p && p.pos !== "GK" && !suspended.has(p.id))
        .map(p => p.id);
    },
    triggerPresidentPenalty,
    isPresidentPenaltyUsed,
    getPresidents,
    isMatchDecided,
    getMatchballWinner,
    isSpecialActionWindowOpen,
    // Pour le match humain en tours (matchphysics.js/app.js) : bookkeeping de phase round par
    // round, et enregistrement des buts/arrêts réellement produits par le plateau physique.
    advancePhase: (minute) => {
      const phase = advancePhaseState(minute);
      events.push(...phase.minuteEvents);
      return phase.minuteEvents;
    },
    recordGoalFromPlay,
    recordOwnGoalFromPlay,
    recordSaveFromPlay
  };
}

// --- Simulation instantanée d'un match complet (utilisé pour les matchs IA) ---
const MAX_SIM_MATCH_MINUTE = 200; // garde-fou : le Matchball décide normalement bien avant

function simulateMatch(homeTeam, homeSetup, awayTeam, awaySetup) {
  const engine = createMatchEngine(homeTeam, homeSetup, awayTeam, awaySetup);
  // Le Matchball (dès la 36e minute) garantit une équipe gagnante : on simule en prolongation
  // au-delà du temps réglementaire si besoin, jusqu'au but décisif.
  for (let minute = 1; minute <= engine.totalMinutes || (!engine.isMatchDecided() && minute <= MAX_SIM_MATCH_MINUTE); minute++) {
    engine.simulateMinute(minute);
    if (engine.isMatchDecided()) break;
  }
  const score = engine.getScore();
  const shootout = score.homeGoals === score.awayGoals
    ? simulatePenaltyShootout(homeTeam, homeSetup, awayTeam, awaySetup)
    : null;
  return engine.finalize(shootout);
}

// Accumule buts/passes décisives/somme des notes sur les joueurs alignés à partir du résultat
// d'un match (playerStats/ratings, déjà calculés par finalize()) — partagé entre le match de
// l'utilisateur (app.js:continueAfterMatch) et les matchs IA vs IA (simulateAIMatch juste en
// dessous), pour que les classements individuels de saison (voir computeTopScorers/
// computeTopAssists/computeTopRatings) reflètent aussi bien les joueurs adverses.
function applyMatchPlayerStats(team, setup, result) {
  setup.lineup.forEach(id => {
    const p = team.players.find(pl => pl.id === id);
    if (!p) return;
    const stat = result.playerStats[id];
    if (stat) { p.goals += stat.goals || 0; p.assists += stat.assists || 0; }
    p.ratingSum = (p.ratingSum || 0) + (result.ratings[id] || 6);
  });
}

// --- Mise à jour de la forme après un match ---
function updateFormAfterMatch(team, setup, goalsFor, goalsAgainst, ratings) {
  team.players.forEach(p => {
    const inLineup = setup.lineup.includes(p.id);
    if (inLineup) {
      p.matches++;
      let delta = 0;
      const r = ratings[p.id] || 6;
      if (r >= 7) delta += 3;
      else if (r >= 6) delta += 1;
      else if (r < 5) delta -= 2;
      if (goalsFor > goalsAgainst) delta += 2;
      else if (goalsFor < goalsAgainst) delta -= 2;
      p.form = Math.max(40, Math.min(99, p.form + delta));
      developPlayer(p, r);
    } else {
      // joueurs non utilisés perdent un peu de forme (manque de rythme)
      p.form = Math.max(40, Math.min(99, p.form - 1));
    }
  });
}

// --- Progression/régression des attributs selon les performances en match ---
const DEV_ATTRS = ["speed", "technique", "physical", "mental"];

function developPlayer(p, rating) {
  // chances de progression/déclin selon l'âge : les jeunes progressent vite, les vétérans déclinent
  let growthChance, declineChance;
  if (p.age <= 21) { growthChance = 0.30; declineChance = 0; }
  else if (p.age <= 25) { growthChance = 0.18; declineChance = 0; }
  else if (p.age <= 29) { growthChance = 0.08; declineChance = 0.02; }
  else if (p.age <= 33) { growthChance = 0.02; declineChance = 0.10; }
  else { growthChance = 0; declineChance = 0.18; }

  if (rating >= 7.5 && Math.random() < growthChance + 0.1) {
    bumpAttribute(p, +1);
  } else if (rating >= 6.5 && Math.random() < growthChance) {
    bumpAttribute(p, +1);
  } else if (rating < 5 && Math.random() < declineChance) {
    bumpAttribute(p, -1);
  }

  p.overall = Math.round((p.speed + p.technique + p.physical + p.mental) / 4);
  p.value = Math.round((p.speed + p.technique + p.physical + p.mental) / 4 * 1000);
}

function bumpAttribute(p, delta) {
  const attr = DEV_ATTRS[Math.floor(Math.random() * DEV_ATTRS.length)];
  p[attr] = Math.max(30, Math.min(99, p[attr] + delta));
}

// --- Séance de tirs au but (format Kings League : pas de match nul) ---
// Renvoie { events, homeScore, awayScore, homeWins }
function simulatePenaltyShootout(homeTeam, homeSetup, awayTeam, awaySetup) {
  const events = [];

  function shooters(team, setup) {
    return setup.lineup
      .map(id => team.players.find(p => p.id === id))
      .filter(p => p && p.pos !== "GK")
      .sort((a, b) => (b.technique + b.mental) - (a.technique + a.mental));
  }
  function gk(team, setup) {
    return setup.lineup.map(id => team.players.find(p => p.id === id)).find(p => p && p.pos === "GK");
  }

  const homeShooters = shooters(homeTeam, homeSetup);
  const awayShooters = shooters(awayTeam, awaySetup);
  const homeGK = gk(homeTeam, homeSetup);
  const awayGK = gk(awayTeam, awaySetup);

  let homeScore = 0, awayScore = 0;

  events.push({ type: "phase", text: "🥅 Séance de tirs au but ! Chaque tireur s'élance depuis le rond central, seul face au gardien." });

  // Format Kings League : pas de penalty classique, le tireur part du milieu de terrain
  // en 1 contre 1 avec le gardien (comme la Carte Shootout).
  function takeKick(team, taker, opposingGK, round) {
    const fault = Math.random() < 0.05;
    if (fault) {
      events.push({ type: "shootout miss", text: `Tir n°${round} — ${taker.name} (${team.name}) part du milieu de terrain mais perd le contrôle du ballon !` });
      return false;
    }
    const gkFault = Math.random() < 0.05;
    let chance = 0.55 + taker.technique / 300 - (opposingGK ? opposingGK.physical / 500 : 0);
    if (gkFault) chance += 0.25;
    chance = Math.max(0.35, Math.min(0.92, chance));
    const scored = Math.random() < chance;
    if (scored) {
      events.push({ type: "shootout", text: `Tir n°${round} — ${taker.name} (${team.name}) part du milieu de terrain, élimine le gardien et marque !` });
    } else {
      events.push({ type: "shootout miss", text: `Tir n°${round} — ${taker.name} (${team.name}) s'élance depuis le milieu... mais ${opposingGK ? opposingGK.name : "le gardien"} sort vainqueur du face-à-face !` });
    }
    return scored;
  }

  // 5 tirs réglementaires par équipe
  for (let i = 0; i < 5; i++) {
    const homeTaker = homeShooters[i % homeShooters.length];
    const awayTaker = awayShooters[i % awayShooters.length];
    if (homeTaker && takeKick(homeTeam, homeTaker, awayGK, i + 1)) homeScore++;
    if (awayTaker && takeKick(awayTeam, awayTaker, homeGK, i + 1)) awayScore++;

    // arrêt anticipé si l'écart est mathématiquement irrattrapable
    const remaining = 5 - (i + 1);
    if (Math.abs(homeScore - awayScore) > remaining) break;
  }

  // mort subite si égalité après les 5 tirs
  let round = 6;
  while (homeScore === awayScore) {
    const homeTaker = homeShooters[(round - 1) % homeShooters.length];
    const awayTaker = awayShooters[(round - 1) % awayShooters.length];
    const homeScored = homeTaker ? takeKick(homeTeam, homeTaker, awayGK, round) : false;
    const awayScored = awayTaker ? takeKick(awayTeam, awayTaker, homeGK, round) : false;
    if (homeScored) homeScore++;
    if (awayScored) awayScore++;
    round++;
    if (round > 20) break; // garde-fou
  }

  const homeWins = homeScore > awayScore;
  events.push({
    type: "phase",
    text: `🏆 ${homeWins ? homeTeam.name : awayTeam.name} remporte la séance de tirs au but ${homeScore} - ${awayScore} !`
  });

  return { events, homeScore, awayScore, homeWins };
}

// --- Classement ---
function computeStandings(league) {
  const table = league.teams.map(t => ({
    id: t.id, name: t.name, color: t.color,
    played: 0, won: 0, draw: 0, lost: 0,
    goalsFor: 0, goalsAgainst: 0, points: 0
  }));
  const byId = {};
  table.forEach(t => byId[t.id] = t);

  league.results.forEach(r => {
    if (!r.played) return;
    const home = byId[r.home];
    const away = byId[r.away];
    home.played++; away.played++;
    home.goalsFor += r.homeGoals; home.goalsAgainst += r.awayGoals;
    away.goalsFor += r.awayGoals; away.goalsAgainst += r.homeGoals;

    // format Kings League : pas de match nul, l'égalité se joue aux tirs au but
    const homeWon = r.homeGoals !== r.awayGoals ? r.homeGoals > r.awayGoals : r.penaltyWinner === "home";
    if (homeWon) { home.won++; away.lost++; home.points += 1; }
    else { away.won++; home.lost++; away.points += 1; }
  });

  table.forEach(t => t.diff = t.goalsFor - t.goalsAgainst);
  table.sort((a, b) => b.points - a.points || b.diff - a.diff || b.goalsFor - a.goalsFor);
  return table;
}

// Classements individuels de la saison en cours (buteurs/passeurs/meilleures notes). Agrège
// directement league.teams[].players[] : goals/assists/matches/ratingSum y sont déjà scopés à
// la saison en cours (remis à 0 par startCareer/startNewSeason), pas besoin de repasser par
// league.results comme computeStandings.
function computeTopScorers(league, limit) {
  const rows = [];
  league.teams.forEach(t => t.players.forEach(p => {
    if (p.goals > 0) rows.push({ p, team: t });
  }));
  rows.sort((a, b) => b.p.goals - a.p.goals || b.p.assists - a.p.assists);
  return limit ? rows.slice(0, limit) : rows;
}

function computeTopAssists(league, limit) {
  const rows = [];
  league.teams.forEach(t => t.players.forEach(p => {
    if (p.assists > 0) rows.push({ p, team: t });
  }));
  rows.sort((a, b) => b.p.assists - a.p.assists || b.p.goals - a.p.goals);
  return limit ? rows.slice(0, limit) : rows;
}

// Un minimum de matchs joués évite qu'un seul match à note élevée écrase le classement.
const TOP_RATING_MIN_MATCHES = 3;
function computeTopRatings(league, limit) {
  const rows = [];
  league.teams.forEach(t => t.players.forEach(p => {
    if (p.matches >= TOP_RATING_MIN_MATCHES) rows.push({ p, team: t });
  }));
  rows.sort((a, b) => (b.p.ratingSum / b.p.matches) - (a.p.ratingSum / a.p.matches));
  return limit ? rows.slice(0, limit) : rows;
}

// --- IA: choix de la formation qui exploite le mieux l'effectif disponible ---
// Teste chaque formation, compose le meilleur onze possible pour chacune, et retient
// celle qui maximise la force totale obtenue (plutôt qu'une formation fixe pour tous).
function chooseAiFormation(team) {
  let bestKey = "1-2-2-2", bestScore = -Infinity, bestAssignments = null;
  Object.keys(FORMATION_SLOTS).forEach(key => {
    const used = new Set();
    let score = 0;
    const assignments = FORMATION_SLOTS[key].map(slot => {
      const candidates = team.players
        .filter(p => p.pos === slot.pos && !used.has(p.id))
        .sort((a, b) => (b.speed + b.technique + b.physical + b.mental + b.form) - (a.speed + a.technique + a.physical + a.mental + a.form));
      if (candidates.length === 0) return null;
      used.add(candidates[0].id);
      score += candidates[0].overall;
      return candidates[0].id;
    });
    if (assignments.some(id => id === null)) return; // effectif insuffisant pour cette formation
    if (score > bestScore) {
      bestScore = score;
      bestKey = key;
      bestAssignments = assignments;
    }
  });
  return { formation: bestKey, assignments: bestAssignments || team.players.slice(0, 7).map(p => p.id) };
}

// --- IA: choix des plans tactiques selon le rapport de force avec l'adversaire ---
// Une équipe plus faible joue le contre (direct/transition + bloc bas), une équipe plus
// forte impose son jeu (possession + pressing haut). Rapport de force équilibré = aléatoire.
function chooseAiPlans(teamStrength, oppStrength) {
  const diff = teamStrength.overall - oppStrength.overall;
  const plans = ["direct", "possession", "transition"];
  const defPlans = ["low", "high", "zone"];
  if (diff > 4) {
    return {
      attackPlan: Math.random() < 0.65 ? "possession" : "transition",
      defensePlan: Math.random() < 0.6 ? "high" : "zone"
    };
  }
  if (diff < -4) {
    return {
      attackPlan: Math.random() < 0.65 ? "direct" : "transition",
      defensePlan: Math.random() < 0.6 ? "low" : "zone"
    };
  }
  return {
    attackPlan: plans[Math.floor(Math.random() * plans.length)],
    defensePlan: defPlans[Math.floor(Math.random() * defPlans.length)]
  };
}

// --- IA: simulation rapide d'un match entre IA (pour les autres équipes de la journée) ---
// Chaque équipe choisit sa meilleure formation possible puis un plan tactique adapté
// au rapport de force avec son adversaire (au lieu d'un même schéma figé pour tous).
function simulateAIMatch(homeTeam, awayTeam) {
  const homeChoice = chooseAiFormation(homeTeam);
  const awayChoice = chooseAiFormation(awayTeam);
  const homeLineup = homeChoice.assignments.filter(Boolean);
  const awayLineup = awayChoice.assignments.filter(Boolean);
  const homeStrength = computeTeamStrength(homeTeam, homeLineup);
  const awayStrength = computeTeamStrength(awayTeam, awayLineup);
  const homePlans = chooseAiPlans(homeStrength, awayStrength);
  const awayPlans = chooseAiPlans(awayStrength, homeStrength);

  const homeSetup = { lineup: homeLineup, formation: homeChoice.formation, attackPlan: homePlans.attackPlan, defensePlan: homePlans.defensePlan };
  const awaySetup = { lineup: awayLineup, formation: awayChoice.formation, attackPlan: awayPlans.attackPlan, defensePlan: awayPlans.defensePlan };
  const result = simulateMatch(homeTeam, homeSetup, awayTeam, awaySetup);
  applyMatchPlayerStats(homeTeam, homeSetup, result);
  applyMatchPlayerStats(awayTeam, awaySetup, result);
  updateFormAfterMatch(homeTeam, homeSetup, result.homeGoals, result.awayGoals, result.ratings);
  updateFormAfterMatch(awayTeam, awaySetup, result.awayGoals, result.homeGoals, result.ratings);
  return result;
}

// Effectif minimum par poste pour pouvoir aligner n'importe quelle formation (1-2-2-2 / 1-3-2-1 / 1-2-3-1)
const MIN_PLAYERS_PER_POS = { GK: 1, DEF: 3, MID: 3, ATT: 2 };

// Comble les trous de poste d'une équipe IA en lui faisant acheter un joueur
// excédentaire à ce poste chez une autre équipe IA (jamais chez l'humain).
function fillPositionGaps(league, humanTeamId) {
  league.teams.forEach(buyerTeam => {
    if (buyerTeam.id === humanTeamId) return;
    Object.entries(MIN_PLAYERS_PER_POS).forEach(([pos, min]) => {
      const count = buyerTeam.players.filter(p => p.pos === pos).length;
      if (count >= min) return;

      let bestSeller = null, bestPlayer = null;
      league.teams.forEach(sellerTeam => {
        if (sellerTeam.id === buyerTeam.id || sellerTeam.id === humanTeamId) return;
        if (sellerTeam.players.length <= 7) return;
        const posPlayers = sellerTeam.players.filter(p => p.pos === pos);
        if (posPlayers.length - min <= 0) return;
        const cheapest = [...posPlayers].sort((a, b) => a.value - b.value)[0];
        if (!bestPlayer || cheapest.value < bestPlayer.value) {
          bestPlayer = cheapest;
          bestSeller = sellerTeam;
        }
      });

      if (bestPlayer && bestSeller && buyerTeam.budget >= bestPlayer.value) {
        buyerTeam.budget -= bestPlayer.value;
        bestSeller.budget += bestPlayer.value;
        bestSeller.players = bestSeller.players.filter(p => p.id !== bestPlayer.id);
        buyerTeam.players.push(bestPlayer);
      }
    });
  });
}

// Renvoie le poste où l'effectif d'une équipe est le plus faible en moyenne
// (cible prioritaire pour un renforcement).
function weakestPosition(team) {
  let weakestPos = null, weakestAvg = Infinity;
  Object.keys(MIN_PLAYERS_PER_POS).forEach(pos => {
    const players = team.players.filter(p => p.pos === pos);
    if (players.length === 0) return;
    const avg = players.reduce((sum, p) => sum + p.overall, 0) / players.length;
    if (avg < weakestAvg) { weakestAvg = avg; weakestPos = pos; }
  });
  return weakestPos;
}

// --- IA Mercato: les autres équipes achètent/vendent pour renforcer leur effectif ---
function simulateAITransfers(league, humanTeamId) {
  fillPositionGaps(league, humanTeamId);

  league.teams.forEach(team => {
    if (team.id === humanTeamId) return;

    // 20% de chance de vendre un joueur faible (sans descendre sous le minimum requis à son poste)
    if (Math.random() < 0.2 && team.players.length > 10) {
      const sellable = team.players.filter(p =>
        team.players.filter(pl => pl.pos === p.pos).length > (MIN_PLAYERS_PER_POS[p.pos] || 0));
      if (sellable.length > 0) {
        const sorted = sellable.sort((a, b) =>
          (a.speed + a.technique + a.physical + a.mental) - (b.speed + b.technique + b.physical + b.mental));
        const sold = sorted[0];
        team.players = team.players.filter(p => p.id !== sold.id);
        team.budget += sold.value;
      }
    }

    // 25% de chance de renforcer son poste le plus faible, si une équipe IA en surplus à ce
    // poste propose une nette amélioration et que le budget le permet (jamais chez l'humain).
    if (Math.random() < 0.25) {
      const pos = weakestPosition(team);
      if (!pos) return;
      const ownBest = Math.max(0, ...team.players.filter(p => p.pos === pos).map(p => p.overall));

      let bestSeller = null, bestPlayer = null;
      league.teams.forEach(sellerTeam => {
        if (sellerTeam.id === team.id || sellerTeam.id === humanTeamId) return;
        const posPlayers = sellerTeam.players.filter(p => p.pos === pos);
        if (posPlayers.length - (MIN_PLAYERS_PER_POS[pos] || 0) <= 0) return;
        const candidate = [...posPlayers].sort((a, b) => b.overall - a.overall)[0];
        if (candidate.overall <= ownBest + 2) return; // pas une vraie amélioration
        if (!bestPlayer || candidate.overall > bestPlayer.overall) {
          bestPlayer = candidate;
          bestSeller = sellerTeam;
        }
      });

      if (bestPlayer && bestSeller && team.budget >= bestPlayer.value) {
        team.budget -= bestPlayer.value;
        bestSeller.budget += bestPlayer.value;
        bestSeller.players = bestSeller.players.filter(p => p.id !== bestPlayer.id);
        team.players.push(bestPlayer);
      }
    }
  });
}
