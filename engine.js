// ===================== MOTEUR DE SIMULATION =====================

// --- Blessures --- paliers de gravité tirés au sort quand l'événement rare "blessure" se déclenche
// (voir le bookkeeping de phase plus bas) : chance cumulative (tirage < chance => ce palier),
// durée d'indisponibilité en jours tirée entre minDays et maxDays inclus.
const INJURY_SEVERITY_TIERS = [
  { label: "légère", chance: 0.7, minDays: 1, maxDays: 3 },
  { label: "modérée", chance: 0.95, minDays: 4, maxDays: 8 },
  { label: "grave", chance: 1.01, minDays: 9, maxDays: 20 }
];

// --- Géométrie du terrain (repère 0-100 x 0-100, y=0 but domicile / y=100 but extérieur) ---
// Utilisée pour placer les joueurs sur les "beats" de la séquence animée du match humain (voir
// simulateMinute({withSequence:true}) plus bas et matchchoreo.js, qui consomme ces positions).
// Ces helpers vivaient auparavant dans matchphysics.js (plateau physique, supprimé) : ils migrent
// ici car engine.js, chargé AVANT le module de chorégraphie, en a maintenant besoin lui-même.
const PITCH_W = 100;
const PITCH_H = 100;
const GOAL_X_MIN = 41;
const GOAL_X_MAX = 59;

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

// Répartit n joueurs de champ (1 à 6) en lignes def→att : utilisé pour les phases à effectif
// réduit (escalier de départ, Dé Géant, escalier inversé du Matchball) où FORMATION_SLOTS (figé à
// 6 joueurs de champ) ne s'applique pas.
function computeOutfieldAnchors(n) {
  if (n <= 0) return [];
  const rowCount = n <= 2 ? n : (n <= 4 ? 2 : 3);
  const base = Math.floor(n / rowCount);
  let extra = n - base * rowCount;
  const rowCounts = [];
  for (let r = 0; r < rowCount; r++) { rowCounts.push(base + (extra > 0 ? 1 : 0)); if (extra > 0) extra--; }
  const anchors = [];
  rowCounts.forEach((count, rowIdx) => {
    const depth = rowCount === 1 ? 0.5 : rowIdx / (rowCount - 1);
    for (let i = 0; i < count; i++) {
      anchors.push({ x: count === 1 ? 50 : 15 + (70 * i) / (count - 1), depth });
    }
  });
  return anchors;
}

// Convertit un ancrage (x, depth 0-1) + le côté en position y réelle. Reste strictement dans sa
// propre moitié de terrain (jamais au-delà de la ligne médiane), avec une marge autour du centre.
function anchorToY(depth, side) {
  if (side === "home") return clamp(8 + depth * 36, 4, 44);
  return clamp(92 - depth * 36, 56, 96);
}
function gkAnchorY(side) { return side === "home" ? 5 : 95; }

// Ancre x/y de chaque joueur de champ actif d'un côté donné, pour une minute du match humain
// (voir simulateMinute({withSequence:true})) : en formation complète (7v7), reprend directement
// FORMATION_SLOTS (data.js) + setup.assignments — la tactique choisie par le joueur/l'IA façonne
// donc littéralement les positions affichées. `possessing` sélectionne la disposition "avec balle"
// (setup.formation/assignments) ou "sans balle" (setup.formationOOP/assignmentsOOP, repli si absent
// — cohérent avec formationDefenseFactor). En dehors du 7v7 (escalier, Dé Géant, escalier inversé
// du Matchball), FORMATION_SLOTS ne s'applique pas (toujours 6 joueurs de champ) : repli sur
// computeOutfieldAnchors, comme le faisait l'ancien matchphysics.js.
// Repli défensif automatique (voir ci-dessous) : fraction du trajet vers sa propre ligne de but
// qu'un joueur parcourt en plus quand son équipe n'a pas le ballon. Appliqué systématiquement,
// que l'équipe ait ou non personnalisé une formation "sans balle" distincte dans l'onglet
// Tactique — sans ce filet, une IA (qui ne personnalise jamais sa formation OOP) resterait
// visuellement toujours poussée vers l'avant, y compris quand elle défend.
const DEFENSIVE_COMPACTION = 0.4;

function computeSideAnchors(setup, activeOutfieldIds, side, possessing) {
  const anchors = {};
  const formationKey = possessing ? setup.formation : (setup.formationOOP || setup.formation);
  const assignments = possessing ? setup.assignments : (setup.assignmentsOOP || setup.assignments);
  const slots = FORMATION_SLOTS[formationKey];
  let useSlots = !!(slots && Array.isArray(assignments) && activeOutfieldIds.length === 6);
  if (useSlots) {
    for (const id of activeOutfieldIds) {
      const idx = assignments.indexOf(id);
      if (idx < 0 || !slots[idx] || slots[idx].pos === "GK") { useSlots = false; break; }
    }
  }
  if (useSlots) {
    activeOutfieldIds.forEach(id => {
      const slot = slots[assignments.indexOf(id)];
      anchors[id] = { x: slot.x, y: side === "home" ? (PITCH_H - slot.y) : slot.y };
    });
  } else {
    const rowAnchors = computeOutfieldAnchors(activeOutfieldIds.length);
    activeOutfieldIds.forEach((id, i) => {
      const a = rowAnchors[i] || { x: 50, depth: 0.5 };
      anchors[id] = { x: a.x, y: anchorToY(a.depth, side) };
    });
  }
  if (!possessing) {
    const ownGoalY = side === "home" ? 4 : PITCH_H - 4;
    activeOutfieldIds.forEach(id => {
      const a = anchors[id];
      if (!a) return;
      anchors[id] = { x: a.x, y: a.y + (ownGoalY - a.y) * DEFENSIVE_COMPACTION };
    });
  }
  return anchors;
}

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
// Le match humain en direct appelle simulateMinute(minute, {withSequence:true}) : mêmes
// décisions statistiques (chance/weightedPick/registerGoal...) que le chemin IA, mais chaque
// événement de commentaire est en plus accompagné d'une chorégraphie de "beats" (passes,
// dribble, tir, tacle...) consommée par matchchoreo.js/app.js pour animer le match à l'écran.
// simulateMinute(minute) sans option (utilisée par simulateMatch/simulateAIMatch, matchs IA en
// arrière-plan) ne construit aucune séquence : comportement et coût strictement inchangés.
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
  let lastHomePossession = 50; // dernière possession connue (%), pour le repli défensif visuel (getFormationAnchors)
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
  // options.withSequence : ajoute evts.sequence (1 beat : course + tir depuis le point de penalty).
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
    let ev;
    if (scored) {
      recordStat(taker.id, "goals");
      const tag = registerGoal(side, minute, taker.id);
      ev = { minute, type: "goal", team: team.name, side, scorerId: taker.id, gkId: oppGK ? oppGK.id : null, text: `${minute}' — ⚽ ${label} ! ${taker.name} (${team.name}) transforme et marque !${tag}` };
    } else {
      ev = { minute, type: "save", team: team.name, side, takerId: taker.id, gkId: oppGK ? oppGK.id : null, text: `${minute}' — ⚽ ${label} ! ${taker.name} (${team.name}) tire... mais ${oppGK ? oppGK.name : "le gardien"} arrête !` };
    }
    evts.push(ev);
    if (options.withSequence) {
      const penaltySpot = { x: 50, y: side === "home" ? PITCH_H - 12 : 12 };
      const goalY = side === "home" ? PITCH_H : 0;
      const goalX = clamp(GOAL_X_MIN + Math.random() * (GOAL_X_MAX - GOAL_X_MIN), GOAL_X_MIN, GOAL_X_MAX);
      const finalY = scored ? goalY : (side === "home" ? goalY - 6 : goalY + 6);
      evts.sequence = [{ type: scored ? "goal" : "save", side, playerId: taker.id, gkId: oppGK ? oppGK.id : null, from: penaltySpot, to: { x: goalX, y: finalY }, duration: 0.9, event: ev }];
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
    if (options.withSequence) evts.sequence = [];
    const shooter = options.taker || weightedPick(getAttackers(team, setup));
    if (!shooter) return evts;

    if (side === "home") homeShots++; else awayShots++;
    const startPos = { x: 50, y: 50 };
    const goalY = side === "home" ? PITCH_H : 0;
    const goalX = clamp(GOAL_X_MIN + Math.random() * (GOAL_X_MAX - GOAL_X_MIN), GOAL_X_MIN, GOAL_X_MAX);

    const fault = Math.random() < 0.08;
    if (fault) {
      const ev = { minute, type: "miss", team: team.name, side, takerId: shooter.id, text: `${minute}' — 🥊 ${label} ! ${shooter.name} (${team.name}) commet une faute technique, le but est refusé !` };
      evts.push(ev);
      if (options.withSequence) evts.sequence.push({ type: "dribble", side, playerId: shooter.id, from: startPos, to: { x: goalX, y: side === "home" ? goalY - 12 : goalY + 12 }, duration: 0.6, event: ev });
      return evts;
    }
    const gkFault = Math.random() < 0.06;
    let chance = 0.55 + shooter.technique / 300 - (oppGK ? oppGK.physical / 500 : 0);
    if (gkFault) chance += 0.3;
    chance = Math.max(0.1, Math.min(0.95, chance));
    const scored = Math.random() < chance;
    let ev;
    if (scored) {
      recordStat(shooter.id, "goals");
      const tag = registerGoal(side, minute, shooter.id);
      ev = { minute, type: "goal", team: team.name, side, scorerId: shooter.id, gkId: oppGK ? oppGK.id : null, text: `${minute}' — 🥊 ${label} ! ${shooter.name} (${team.name}) élimine le gardien et marque !${tag}` };
    } else {
      ev = { minute, type: "save", team: team.name, side, takerId: shooter.id, gkId: oppGK ? oppGK.id : null, text: `${minute}' — 🥊 ${label} ! ${oppGK ? oppGK.name : "Le gardien"} sort vainqueur du face-à-face avec ${shooter.name} !` };
    }
    evts.push(ev);
    if (options.withSequence) {
      const finalY = scored ? goalY : (side === "home" ? goalY - 6 : goalY + 6);
      evts.sequence.push({ type: scored ? "goal" : "save", side, playerId: shooter.id, gkId: oppGK ? oppGK.id : null, from: startPos, to: { x: goalX, y: finalY }, duration: 1, event: ev });
    }
    if (!scored && gkFault) {
      const phaseEv = { minute, type: "phase", text: `🥊 Faute du gardien de ${oppTeam.name} ! Penalty immédiat accordé.` };
      evts.push(phaseEv);
      const penaltyEvts = performPenaltyAttempt(side, minute, { taker: shooter, withSequence: options.withSequence }, "Penalty");
      evts.push(...penaltyEvts);
      if (options.withSequence) {
        evts.sequence.push({ type: "phase", side, playerId: null, from: { x: 50, y: 50 }, to: { x: 50, y: 50 }, duration: 0.6, event: phaseEv });
        evts.sequence.push(...(penaltyEvts.sequence || []));
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
  // Toujours déclenché explicitement (jamais depuis le tirage au sort des matchs IA) : la
  // séquence visuelle est donc toujours construite, pas besoin de flag withSequence ici.
  function performPresidentPenaltyKick(side, minute, presidentName) {
    const team = side === "home" ? homeTeam : awayTeam;
    const oppTeam = side === "home" ? awayTeam : homeTeam;
    const oppSetup = side === "home" ? awaySetup : homeSetup;
    const oppGK = getGK(oppTeam, oppSetup);
    const evts = [];

    if (side === "home") homeShots++; else awayShots++;
    const chance = Math.max(0.25, Math.min(0.7, 0.5 - (oppGK ? oppGK.physical / 700 : 0)));
    const scored = Math.random() < chance;
    let ev;
    if (scored) {
      const tag = registerGoal(side, minute, null);
      ev = { minute, type: "goal", team: team.name, side, scorerId: null, gkId: oppGK ? oppGK.id : null, text: `${minute}' — ⚽ Penalty du Président ! ${presidentName} (président de ${team.name}) s'élance... et MARQUE !${tag}` };
    } else {
      ev = { minute, type: "save", team: team.name, side, takerId: null, gkId: oppGK ? oppGK.id : null, text: `${minute}' — ⚽ Penalty du Président ! ${presidentName} (président de ${team.name}) tire... mais ${oppGK ? oppGK.name : "le gardien"} arrête !` };
    }
    evts.push(ev);
    const penaltySpot = { x: 50, y: side === "home" ? PITCH_H - 12 : 12 };
    const goalY = side === "home" ? PITCH_H : 0;
    const goalX = clamp(GOAL_X_MIN + Math.random() * (GOAL_X_MAX - GOAL_X_MIN), GOAL_X_MIN, GOAL_X_MAX);
    const finalY = scored ? goalY : (side === "home" ? goalY - 6 : goalY + 6);
    evts.sequence = [{ type: scored ? "goal" : "save", side, playerId: null, gkId: oppGK ? oppGK.id : null, from: penaltySpot, to: { x: goalX, y: finalY }, duration: 0.9, event: ev }];
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
    const phaseEv = { minute, type: "phase", text: `🛎️ ${presidentName} actionne le buzzer pour ${team.name} et s'apprête à tirer lui-même le penalty !` };
    const evts = [phaseEv];
    const kickEvts = performPresidentPenaltyKick(side, minute, presidentName);
    evts.push(...kickEvts);
    evts.sequence = [
      { type: "phase", side, playerId: null, from: { x: 50, y: 50 }, to: { x: 50, y: 50 }, duration: 0.6, event: phaseEv },
      ...(kickEvts.sequence || [])
    ];
    return evts;
  }

  // Active une Arme Secrète pour l'équipe `side` ("home"/"away") et renvoie les
  // événements générés. `options` peut contenir { taker, player, targetName, copyKey, mode }.
  // Toujours déclenchée explicitement (jamais par le tirage au sort des matchs IA) : la séquence
  // visuelle (evts.sequence) est donc systématiquement construite, sans flag withSequence.
  function activateCard(side, key, options, minute) {
    if (!isSpecialActionWindowOpen(minute, "card")) return [];
    options = Object.assign({}, options, { withSequence: true });
    const opp = side === "home" ? "away" : "home";
    const team = side === "home" ? homeTeam : awayTeam;
    const setup = side === "home" ? homeSetup : awaySetup;
    const oppTeam = side === "home" ? awayTeam : homeTeam;
    const oppSetup = side === "home" ? awaySetup : homeSetup;
    const evts = [];
    const sequence = [];
    const announce = ev => sequence.push({ type: "phase", side, playerId: null, from: { x: 50, y: 50 }, to: { x: 50, y: 50 }, duration: 0.8, event: ev });

    switch (key) {
      case "doubleGoal": {
        cardState[side].doubleUntil = minute + 4;
        const ev = { minute, type: "phase", text: `🟡 ${team.name} active la Carte But Double ! Pendant 4 minutes, chaque but marqué comptera double.` };
        evts.push(ev); announce(ev);
        break;
      }
      case "sanction": {
        cardState[opp].sanctionUntil = minute + 4;
        const targetName = options.targetName || "un joueur adverse";
        const ev = { minute, type: "phase", text: `🔴 ${team.name} active la Carte Sanction sur ${targetName} ! ${oppTeam.name} joue à 6 contre 7 pendant 4 minutes.` };
        evts.push(ev); announce(ev);
        break;
      }
      case "penalty": {
        const penaltyEvts = performPenaltyAttempt(side, minute, options, "Carte Penalty");
        evts.push(...penaltyEvts);
        sequence.push(...(penaltyEvts.sequence || []));
        break;
      }
      case "shootout": {
        const shootoutEvts = performShootoutAttempt(side, minute, options, "Carte Shootout");
        evts.push(...shootoutEvts);
        sequence.push(...(shootoutEvts.sequence || []));
        break;
      }
      case "reversePenalty": {
        // L'adversaire tire le penalty : s'il marque, le but ne compte pas ; s'il rate, but pour vous.
        const taker = options.taker || weightedPick(getAttackers(oppTeam, oppSetup));
        if (taker) {
          if (opp === "home") homeShots++; else awayShots++;
          const sideGK = getGK(team, setup);
          const scored = Math.random() < (0.7 + taker.mental / 400 - (sideGK ? sideGK.physical / 600 : 0));
          const penaltySpot = { x: 50, y: opp === "home" ? PITCH_H - 12 : 12 };
          const goalY = opp === "home" ? PITCH_H : 0;
          const goalX = clamp(GOAL_X_MIN + Math.random() * (GOAL_X_MAX - GOAL_X_MIN), GOAL_X_MIN, GOAL_X_MAX);
          let ev;
          if (scored) {
            ev = { minute, type: "save", team: team.name, side: opp, takerId: taker.id, gkId: sideGK ? sideGK.id : null, text: `${minute}' — 🙃 Penalty Inverse ! ${taker.name} (${oppTeam.name}) marque... mais le but ne compte pas !` };
            sequence.push({ type: "save", side: opp, playerId: taker.id, gkId: sideGK ? sideGK.id : null, from: penaltySpot, to: { x: goalX, y: goalY }, duration: 0.9, event: ev });
          } else {
            const tag = registerGoal(side, minute, null);
            ev = { minute, type: "goal", team: team.name, side, scorerId: null, gkId: sideGK ? sideGK.id : null, text: `${minute}' — 🙃 Penalty Inverse ! ${taker.name} (${oppTeam.name}) rate son tir... but accordé à ${team.name} !${tag}` };
            sequence.push({ type: "goal", side: opp, playerId: taker.id, gkId: sideGK ? sideGK.id : null, from: penaltySpot, to: { x: goalX, y: opp === "home" ? goalY - 6 : goalY + 6 }, duration: 0.9, event: ev });
          }
          evts.push(ev);
        }
        break;
      }
      case "starPlayer": {
        const p = options.player;
        if (p) {
          cardState[side].starPlayerId = p.id;
          cardState[side].starUsed = false;
          const ev = { minute, type: "phase", text: `⭐ ${team.name} active la Carte Joueur Étoile sur ${p.name} ! Son prochain but avant la 38e minute comptera double.` };
          evts.push(ev); announce(ev);
        }
        break;
      }
      case "joker": {
        if (options.mode === "steal") {
          if (!cardState[opp].used && cardState[opp].key) {
            const stolenKey = cardState[opp].key;
            cardState[opp].used = true;
            const ev = { minute, type: "phase", text: `🃏 ${team.name} active le Joker et VOLE la carte adverse !` };
            evts.push(ev); announce(ev);
            const stolenEvts = activateCard(side, stolenKey, options, minute);
            evts.push(...stolenEvts);
            sequence.push(...(stolenEvts.sequence || []));
          } else {
            const ev = { minute, type: "phase", text: `🃏 ${team.name} active le Joker, mais le vol échoue (carte adverse déjà jouée) !` };
            evts.push(ev); announce(ev);
          }
        } else {
          const ev = { minute, type: "phase", text: `🃏 ${team.name} active le Joker en copiant une autre Arme Secrète !` };
          evts.push(ev); announce(ev);
          const copiedEvts = activateCard(side, options.copyKey, options, minute);
          evts.push(...copiedEvts);
          sequence.push(...(copiedEvts.sequence || []));
        }
        break;
      }
    }

    cardState[side].used = true;
    evts.sequence = sequence;
    return evts;
  }

  // Applique le résultat d'une tentative de but (BUT / arrêt / tir raté) à l'état interne du
  // moteur (stats, score, bonus "but double") et construit l'événement de commentaire
  // correspondant. Utilisée par attemptAttack, aussi bien pour le tirage au sort silencieux des
  // matchs IA que pour le match humain animé (même décision, juste racontée en plus via un beat).
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

  // Construit la chorégraphie visuelle d'une possession pour le match humain (voir
  // simulateMinute({withSequence:true})) : 1-2 passes de construction depuis un coéquipier
  // vers `actor`, puis soit un tir dont l'issue est déjà décidée (outcome), soit — si `outcome`
  // est null — un dribble suivi d'un tacle défensif qui coupe l'action (remplace le retour
  // silencieux qu'attemptAttack faisait auparavant quand aucune occasion n'était retenue).
  // Ne décide jamais rien statistiquement : se contente de "raconter" une décision déjà prise.
  function buildPossessionBeats(side, attackers, actor, atkAnchors, defenders, defAnchors, gk, outcome) {
    const beats = [];
    const passers = attackers.filter(p => p.id !== actor.id);
    let current = passers.length ? passers[Math.floor(Math.random() * passers.length)] : actor;
    let pos = atkAnchors[current.id] || { x: 50, y: side === "home" ? 25 : 75 };
    const buildLength = passers.length ? 1 + Math.floor(Math.random() * 2) : 0;
    for (let i = 0; i < buildLength; i++) {
      const isLast = i === buildLength - 1;
      const next = isLast ? actor : (passers[Math.floor(Math.random() * passers.length)] || actor);
      const nextPos = atkAnchors[next.id] || pos;
      beats.push({ type: "pass", side, playerId: current.id, toPlayerId: next.id, from: pos, to: nextPos, duration: 0.5 + Math.random() * 0.3, event: null });
      current = next; pos = nextPos;
    }
    const shooterPos = atkAnchors[actor.id] || pos;
    if (!outcome) {
      const defender = defenders.length ? defenders[Math.floor(Math.random() * defenders.length)] : null;
      const defPos = defender ? (defAnchors[defender.id] || shooterPos) : { x: shooterPos.x, y: side === "home" ? shooterPos.y + 8 : shooterPos.y - 8 };
      beats.push({ type: "dribble", side, playerId: actor.id, from: pos, to: shooterPos, duration: 0.4, event: null });
      beats.push({ type: "tackle", side: side === "home" ? "away" : "home", playerId: defender ? defender.id : null, from: shooterPos, to: defPos, duration: 0.5, event: null });
      return beats;
    }
    const goalY = side === "home" ? PITCH_H : 0;
    const goalX = clamp(GOAL_X_MIN + Math.random() * (GOAL_X_MAX - GOAL_X_MIN), GOAL_X_MIN, GOAL_X_MAX);
    const nearGoalY = side === "home" ? goalY - 6 : goalY + 6;
    beats.push({ type: "shot", side, playerId: actor.id, gkId: gk ? gk.id : null, from: shooterPos, to: { x: goalX, y: nearGoalY }, duration: 0.7, event: null });
    const finalY = outcome === "goal" ? goalY : nearGoalY;
    beats.push({ type: outcome, side, playerId: actor.id, gkId: gk ? gk.id : null, from: { x: goalX, y: nearGoalY }, to: { x: goalX, y: finalY }, duration: 0.4, event: null });
    return beats;
  }

  function attemptAttack(minute, minuteEvents, attackingTeamName, attackers, gk, attackPower, defenseFactor, isHome, ctx) {
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

    if (!outcome) {
      // occasion ratée : silencieuse côté commentaire (comme avant), mais on raconte quand même
      // la possession qui se casse pour le match humain animé.
      if (ctx) ctx.sequence.push(...buildPossessionBeats(side, attackers, scorer, ctx.atkAnchors, ctx.defenders, ctx.defAnchors, gk, null));
      return;
    }

    let assister = null;
    if (outcome === "goal") {
      const assistCandidates = attackers.filter(p => p.id !== scorer.id);
      if (assistCandidates.length > 0 && Math.random() < 0.6) assister = weightedPick(assistCandidates);
    }
    const ev = resolveAttackOutcome(minute, attackingTeamName, side, outcome, scorer, gk, assister);
    minuteEvents.push(ev);
    if (ctx) {
      const beats = buildPossessionBeats(side, attackers, scorer, ctx.atkAnchors, ctx.defenders, ctx.defAnchors, gk, outcome);
      beats[beats.length - 1].event = ev;
      ctx.sequence.push(...beats);
    }
  }

  // Fait avancer le bookkeeping de phase pour une minute donnée (indépendant de la façon dont
  // les buts sont marqués) : sub auto après carton rouge, annonces escalier/Ballon Spécial/Dé
  // Géant/Matchball, et les événements aléatoires rares (blessure/carton/penalty). Renvoie aussi
  // le contexte (compositions actives, attaquants, gardiens) pour que simulateMinute puisse
  // enchaîner sur les occasions sans tout recalculer. `stopAfterPenalty` signale qu'un penalty
  // aléatoire a déjà consommé l'action de cette minute (comme avant : plus d'occasions ce tour).
  function advancePhaseState(minute, withSequence) {
    const minuteEvents = [];
    const sequence = withSequence ? [] : null;
    const announce = ev => sequence.push({ type: "phase", side: ev.side || null, playerId: null, from: { x: 50, y: 50 }, to: { x: 50, y: 50 }, duration: 1, event: ev });

    // Remplacements automatiques : 5 minutes après un carton rouge, un joueur du banc entre
    // pour ramener l'équipe à effectif complet (le joueur expulsé ne revient jamais).
    [["home", homeSetup, homeTeam], ["away", awaySetup, awayTeam]].forEach(([side, setupRef, teamRef]) => {
      const sanctions = cardSanctions[side];
      sanctions.redActive = sanctions.redActive.filter(entry => {
        if (minute > entry.until) {
          const sub = addBenchSubstitute(teamRef, setupRef, entry.pos);
          if (sub) {
            const ev = {
              minute, type: "phase", team: teamRef.name, side, inId: sub.id, outId: entry.playerId,
              text: `${minute}' — 🔁 ${teamRef.name} fait entrer ${sub.name} : l'équipe retrouve son effectif complet après le carton rouge.`
            };
            minuteEvents.push(ev);
            if (withSequence) announce(ev);
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
      const ev = {
        minute, type: "phase",
        text: `🔼 Un nouveau joueur entre sur le terrain pour chaque équipe (${curCap + 1}v${curCap + 1}) !`
      };
      minuteEvents.push(ev);
      if (withSequence) announce(ev);
    }

    // Ballon spécial : à la 17e minute, tous les buts comptent double jusqu'à la pause (20').
    if (minute === DOUBLE_GOAL_START_MINUTE && !globalDoubleGoalActive) {
      globalDoubleGoalActive = true;
      const ev = {
        minute, type: "phase",
        text: `🟠 Un ballon d'une autre couleur entre en jeu ! Tous les buts comptent double jusqu'à la mi-temps !`
      };
      minuteEvents.push(ev);
      if (withSequence) announce(ev);
    }

    // Le dé géant : à la reprise de la 2e mi-temps (20'-23'), format réduit (1v1/2v2/3v3).
    // Le tirage peut déjà avoir eu lieu en amont via ensureDiceRolled() (sélection manuelle de
    // la composition avant le début de la phase) : on ne le retire pas, on se contente d'annoncer.
    if (minute === DICE_START_MINUTE && !diceState.announced) {
      diceState.announced = true;
      diceState.active = true;
      const count = ensureDiceRolled();
      const ev = {
        minute, type: "phase",
        text: `🎲 LE DÉ GÉANT tombe sur ${count} ! Format ${count}v${count} jusqu'à la 23e minute !`
      };
      minuteEvents.push(ev);
      if (withSequence) announce(ev);
    }
    if (minute === DICE_END_MINUTE + 1 && diceState.active) {
      diceState.active = false;
      const ev = { minute, type: "phase", text: "🔼 Retour au format complet (7v7) !" };
      minuteEvents.push(ev);
      if (withSequence) announce(ev);
    }

    // Le Matchball : à partir de la 36e minute, la première équipe à atteindre le score
    // du leader + 1 but remporte le match immédiatement (ex. 2-0 → objectif 3 buts).
    // L'escalier inversé commence aussitôt : 5v5 → 4v4 → 3v3 → 2v2 → 1v1.
    // Si les deux équipes sont à égalité au moment où le Matchball démarre, pas de prolongation :
    // le match s'arrête immédiatement et se décide directement aux tirs au but.
    if (minute === MATCHBALL_START_MINUTE && matchballTarget === null && !matchballDecided) {
      if (homeGoals === awayGoals) {
        matchballDecided = true;
        const ev = {
          minute, type: "phase",
          text: `🏆 MATCHBALL ! Égalité au coup d'envoi du Matchball : le match se décide directement aux tirs au but !`
        };
        minuteEvents.push(ev);
        if (withSequence) announce(ev);
      } else {
        matchballTarget = Math.max(homeGoals, awayGoals) + 1;
        const ev = {
          minute, type: "phase",
          text: `🏆 MATCHBALL ! La première équipe à marquer son ${matchballTarget}e but remporte le match immédiatement ! L'escalier inversé commence.`
        };
        minuteEvents.push(ev);
        if (withSequence) announce(ev);
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

    // Ancres de position (voir computeSideAnchors) pour placer les beats des événements aléatoires
    // ci-dessous (blessure/carton) sur le terrain — seulement calculées quand le match humain
    // demande une séquence visuelle, jamais sur le chemin chaud des matchs IA.
    const homeAtkAnchors = withSequence ? computeSideAnchors(homeSetup, homeActiveOutfield, "home", true) : null;
    const awayAtkAnchors = withSequence ? computeSideAnchors(awaySetup, awayActiveOutfield, "away", true) : null;
    function anchorFor(side, playerId) {
      const anchors = side === "home" ? homeAtkAnchors : awayAtkAnchors;
      return (anchors && anchors[playerId]) || { x: 50, y: side === "home" ? 30 : 70 };
    }

    // événement spécial: blessure (rare) — indisponibilise réellement le joueur pour plusieurs
    // jours (voir INJURY_SEVERITY_TIERS), décomptés au fil des jours côté app.js:advanceOneDayStep.
    // Math.max avec une blessure déjà en cours : ne raccourcit jamais une indisponibilité plus
    // longue déjà entamée (ex. rechute pendant la convalescence, cas rare mais possible puisque le
    // joueur reste "actif" tant qu'il joue le match en cours).
    if (Math.random() < 0.004) {
      const side = Math.random() < 0.5 ? "home" : "away";
      const pool = side === "home" ? homeActiveLineup.map(id => homeTeam.players.find(p => p.id === id)) : awayActiveLineup.map(id => awayTeam.players.find(p => p.id === id));
      const victim = pool.filter(Boolean)[Math.floor(Math.random() * pool.filter(Boolean).length)];
      if (victim) {
        const severityRoll = Math.random();
        const tier = INJURY_SEVERITY_TIERS.find(t => severityRoll < t.chance);
        const daysOut = tier.minDays + Math.floor(Math.random() * (tier.maxDays - tier.minDays + 1));
        victim.injuryDaysLeft = Math.max(victim.injuryDaysLeft || 0, daysOut);
        victim.injurySeverity = tier.label;
        victim.injured = true;
        const ev = {
          minute, type: "injury", team: side === "home" ? homeTeam.name : awayTeam.name, side, playerId: victim.id,
          text: `${minute}' — ${victim.name} se blesse (${tier.label}) : indisponible ${daysOut} jour${daysOut > 1 ? "s" : ""} !`
        };
        minuteEvents.push(ev);
        if (withSequence) {
          const pos = anchorFor(side, victim.id);
          sequence.push({ type: "phase", side, playerId: victim.id, from: pos, to: pos, duration: 1.4, event: ev });
        }
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
          const yellowEv = {
            minute, type: "yellow", team: teamRef.name, side, playerId: victim.id, inId: sub ? sub.id : null, outId: victim.id,
            text: `${minute}' — 🟨 Carton jaune pour ${victim.name} (${teamRef.name}) ! En Matchball, pas de réduction d'effectif${sub ? `, ${sub.name} le remplace` : ""} — shootout accordé à l'adversaire !`
          };
          minuteEvents.push(yellowEv);
          if (withSequence) announce(yellowEv);
          const oppSide = side === "home" ? "away" : "home";
          const oppTeamRef = oppSide === "home" ? homeTeam : awayTeam;
          const oppSetupRef = oppSide === "home" ? homeSetup : awaySetup;
          const shooter = weightedPick(getAttackers(oppTeamRef, oppSetupRef));
          if (shooter) {
            const shootoutEvts = performShootoutAttempt(oppSide, minute, { taker: shooter, withSequence }, "Shootout (carton jaune)");
            minuteEvents.push(...shootoutEvts);
            if (withSequence) sequence.push(...(shootoutEvts.sequence || []));
          }
        } else {
          cardSanctions[side].yellow.push({ playerId: victim.id, until: minute + 2 });
          const ev = {
            minute, type: "yellow", team: teamRef.name, side, playerId: victim.id,
            text: `${minute}' — 🟨 Carton jaune pour ${victim.name} (${teamRef.name}) : exclu 2 minutes, ${teamRef.name} joue en infériorité numérique !`
          };
          minuteEvents.push(ev);
          if (withSequence) {
            const pos = anchorFor(side, victim.id);
            sequence.push({ type: "phase", side, playerId: victim.id, from: pos, to: pos, duration: 1.4, event: ev });
          }
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
        const redEv = {
          minute, type: "red", team: teamRef.name, side, playerId: victim.id,
          text: `${minute}' — CARTON ROUGE ! ${victim.name} est expulsé !`
        };
        minuteEvents.push(redEv);
        if (withSequence) {
          const pos = anchorFor(side, victim.id);
          sequence.push({ type: "phase", side, playerId: victim.id, from: pos, to: pos, duration: 1.4, event: redEv });
        }
        removeFromLineup(setupRef, victim.id);
        if (minute >= MATCHBALL_START_MINUTE) {
          // En Matchball, le carton rouge octroie un penalty classique immédiat à l'adversaire.
          const oppSide = side === "home" ? "away" : "home";
          const phaseEv = { minute, type: "phase", text: "🔴 Carton rouge en Matchball : penalty immédiat accordé à l'adversaire !" };
          minuteEvents.push(phaseEv);
          if (withSequence) announce(phaseEv);
          const penaltyEvts = performPenaltyAttempt(oppSide, minute, { withSequence }, "Penalty (carton rouge)");
          minuteEvents.push(...penaltyEvts);
          if (withSequence) sequence.push(...(penaltyEvts.sequence || []));
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
      const penaltyEvts = performPenaltyAttempt(side, minute, { taker, withSequence }, "PENALTY");
      minuteEvents.push(...penaltyEvts);
      if (withSequence) sequence.push(...(penaltyEvts.sequence || []));
      stopAfterPenalty = true;
    }

    return {
      minuteEvents, stopAfterPenalty, sequence,
      homeActiveOutfield, awayActiveOutfield, homeActiveLineup, awayActiveLineup,
      homeAttackers, awayAttackers, homeGK, awayGK,
      homeAtkAnchors, awayAtkAnchors
    };
  }

  // Simule une minute de jeu et renvoie les événements survenus durant cette minute (+
  // `.sequence`, la chorégraphie de beats, quand opts.withSequence est vrai — voir plus haut).
  // simulateMatch/simulateAIMatch (matchs IA) l'appellent sans options : coût inchangé.
  function simulateMinute(minute, opts) {
    const withSequence = !!(opts && opts.withSequence);
    const phase = advancePhaseState(minute, withSequence);
    const minuteEvents = phase.minuteEvents;
    if (phase.stopAfterPenalty) {
      events.push(...minuteEvents);
      if (withSequence) minuteEvents.sequence = phase.sequence;
      return minuteEvents;
    }

    const { homeActiveOutfield, awayActiveOutfield, homeActiveLineup, awayActiveLineup, homeAttackers, awayAttackers, homeGK, awayGK } = phase;
    const sequence = phase.sequence;

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
    lastHomePossession = homePossession;

    // but contre son camp (très rare)
    if (Math.random() < 0.0006) {
      const isHomeOG = Math.random() < 0.5;
      const team = isHomeOG ? homeTeam : awayTeam;
      const activeOutfieldIds = isHomeOG ? homeActiveOutfield : awayActiveOutfield;
      const lineupPlayers = activeOutfieldIds.map(id => team.players.find(p => p.id === id)).filter(Boolean);
      const victim = lineupPlayers[Math.floor(Math.random() * lineupPlayers.length)];
      if (victim) {
        const ownGoalSide = isHomeOG ? "home" : "away";
        const tag = registerGoal(isHomeOG ? "away" : "home", minute, null);
        const ev = { minute, type: "owngoal", team: team.name, side: ownGoalSide, scorerId: victim.id, text: `${minute}' — Catastrophe ! But contre son camp de ${victim.name} (${team.name}) !${tag}` };
        minuteEvents.push(ev);
        if (withSequence) {
          const anchors = ownGoalSide === "home" ? phase.homeAtkAnchors : phase.awayAtkAnchors;
          const pos = (anchors && anchors[victim.id]) || { x: 50, y: ownGoalSide === "home" ? 30 : 70 };
          const ownGoalY = ownGoalSide === "home" ? 0 : PITCH_H; // csc : le tir part vers SON PROPRE but
          const goalX = clamp(GOAL_X_MIN + Math.random() * (GOAL_X_MAX - GOAL_X_MIN), GOAL_X_MIN, GOAL_X_MAX);
          sequence.push({ type: "owngoal", side: ownGoalSide, playerId: victim.id, from: pos, to: { x: goalX, y: ownGoalY }, duration: 0.8, event: ev });
        }
      }
    }

    // occasions normales basées sur possession (plus fréquentes en tout début de match)
    const chanceFreqBoost = minute <= EARLY_PHASE_END_MINUTE ? EARLY_PHASE_CHANCE_BOOST : 1;
    const homeChanceRoll = Math.random();
    const awayChanceRoll = Math.random();

    let homeCtx = null, awayCtx = null;
    if (withSequence) {
      const homeAtkAnchors = phase.homeAtkAnchors;
      const awayAtkAnchors = phase.awayAtkAnchors;
      const homeDefAnchors = computeSideAnchors(homeSetup, homeActiveOutfield, "home", false);
      const awayDefAnchors = computeSideAnchors(awaySetup, awayActiveOutfield, "away", false);
      homeCtx = { sequence, atkAnchors: homeAtkAnchors, defenders: awayAttackers, defAnchors: awayDefAnchors };
      awayCtx = { sequence, atkAnchors: awayAtkAnchors, defenders: homeAttackers, defAnchors: homeDefAnchors };
    }

    // Chaque minute (match humain animé) montre AU MOINS une possession par camp, que le tirage
    // au sort ci-dessus lui accorde ou non une vraie occasion — sans quoi la plupart des minutes
    // (le tirage échoue le plus souvent) n'affichaient RIEN, un match entier semblant alors se
    // résumer à une poignée d'actions isolées plutôt qu'un jeu continu. Ceci est PUREMENT visuel :
    // aucun tir, aucune statistique, aucun Math.random() supplémentaire ne peut faire basculer le
    // score — seul le camp SANS occasion ce tour-ci reçoit une possession "ambiante" qui se
    // termine par une perte de balle (buildPossessionBeats avec outcome=null, même mécanique que
    // l'occasion ratée silencieuse ci-dessous).
    if (homeChanceRoll < 0.10 * (homePossession / 50) * chanceFreqBoost) {
      attemptAttack(minute, minuteEvents, homeTeam.name, homeAttackers, awayGK, homeAttackPower, homeDefenseFactor, true, homeCtx);
    } else if (homeCtx) {
      const actor = weightedPick(homeAttackers);
      if (actor) sequence.push(...buildPossessionBeats("home", homeAttackers, actor, homeCtx.atkAnchors, homeCtx.defenders, homeCtx.defAnchors, awayGK, null));
    }
    if (awayChanceRoll < 0.10 * ((100 - homePossession) / 50) * chanceFreqBoost) {
      attemptAttack(minute, minuteEvents, awayTeam.name, awayAttackers, homeGK, awayAttackPower, awayDefenseFactor, false, awayCtx);
    } else if (awayCtx) {
      const actor = weightedPick(awayAttackers);
      if (actor) sequence.push(...buildPossessionBeats("away", awayAttackers, actor, awayCtx.atkAnchors, awayCtx.defenders, awayCtx.defAnchors, homeGK, null));
    }

    events.push(...minuteEvents);
    if (withSequence) minuteEvents.sequence = sequence;
    return minuteEvents;
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
    // Ancre x/y de chaque joueur actif (GK inclus) pour le côté/minute donnés, dans la formation
    // "avec balle" — utilisé par matchchoreo.js/app.js pour replacer les joueurs non impliqués
    // dans le beat courant (repositionnement tactique crédible entre deux actions).
    // `possessing` : reprend la possession de la DERNIÈRE minute simulée (lastHomePossession) —
    // le camp qui domine s'affiche en formation offensive, l'autre se replie sur sa formation
    // défensive (setup.formationOOP/assignmentsOOP) — visuellement, l'équipe sans le ballon
    // défend enfin, plutôt que de rester poussée vers l'avant en permanence comme avant.
    getFormationAnchors: (side, minute) => {
      const team = side === "home" ? homeTeam : awayTeam;
      const setup = side === "home" ? homeSetup : awaySetup;
      const gkPlayer = getGK(team, setup);
      const outfieldIds = getActiveOutfieldIds(team, setup, minute, side);
      const possessing = side === "home" ? lastHomePossession >= 50 : lastHomePossession < 50;
      const anchors = computeSideAnchors(setup, outfieldIds, side, possessing);
      if (gkPlayer) anchors[gkPlayer.id] = { x: 50, y: gkAnchorY(side) };
      return anchors;
    }
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
    const rating = result.ratings[id] || 6;
    if (stat) { p.goals += stat.goals || 0; p.assists += stat.assists || 0; }
    p.ratingSum = (p.ratingSum || 0) + rating;
    // stats "carrière" : cumulées sur toute la carrière (jamais remises à zéro par
    // startNewSeason, contrairement à goals/assists/ratingSum ci-dessus) — voir buildPlayerCardHTML.
    if (stat) { p.careerGoals = (p.careerGoals || 0) + (stat.goals || 0); p.careerAssists = (p.careerAssists || 0) + (stat.assists || 0); }
    p.careerRatingSum = (p.careerRatingSum || 0) + rating;
  });
}

// --- Mise à jour de la forme après un match ---
function updateFormAfterMatch(team, setup, goalsFor, goalsAgainst, ratings) {
  team.players.forEach(p => {
    const inLineup = setup.lineup.includes(p.id);
    if (inLineup) {
      p.matches++;
      p.careerMatches = (p.careerMatches || 0) + 1;
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
  // même courbe de valeur (étoiles) qu'à la création du joueur — voir data.js:player() — sinon la
  // progression/régression écraserait la prime/décote star au prochain recalcul de la valeur.
  const stars = Math.max(0, Math.min(5, (p.overall - VALUE_STAR_MIN) / (VALUE_STAR_MAX - VALUE_STAR_MIN) * 5));
  const valueMultiplier = 0.55 + 0.85 * Math.pow(stars / 5, 1.8);
  p.value = Math.round(p.overall * 1000 * valueMultiplier);
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
// Renvoie la liste des transferts effectués (pour l'historique des transferts côté app.js —
// engine.js reste pur/sans STATE, donc ne journalise rien lui-même, juste rapporte ce qui s'est passé).
function fillPositionGaps(league, humanTeamId) {
  const events = [];
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
        events.push({
          type: "transfer", playerId: bestPlayer.id, playerName: bestPlayer.name, pos: bestPlayer.pos,
          fromTeamId: bestSeller.id, fromTeamName: bestSeller.name, toTeamId: buyerTeam.id, toTeamName: buyerTeam.name,
          amount: bestPlayer.value
        });
      }
    });
  });
  return events;
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

// Parmi toutes les équipes de la ligue (hors excludeTeamId), renvoie celle qui a le plus besoin
// de renfort à ce poste précis — le niveau moyen des joueurs déjà présents à ce poste le plus
// bas (une équipe sans aucun joueur à ce poste est considérée en besoin maximal). Utilisé pour
// qu'un joueur vendu par l'utilisateur rejoigne une vraie équipe plutôt que de disparaître du jeu.
function neediestTeamForPosition(league, pos, excludeTeamId) {
  let best = null, bestAvg = Infinity;
  league.teams.forEach(team => {
    if (team.id === excludeTeamId) return;
    const players = team.players.filter(p => p.pos === pos);
    const avg = players.length === 0 ? -1 : players.reduce((sum, p) => sum + p.overall, 0) / players.length;
    if (avg < bestAvg) { bestAvg = avg; best = team; }
  });
  return best;
}

// --- IA Mercato: les autres équipes achètent/vendent pour renforcer leur effectif ---
function simulateAITransfers(league, humanTeamId) {
  const events = fillPositionGaps(league, humanTeamId);

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
        // rejoint l'équipe la plus faible à ce poste dans la ligue plutôt que de disparaître du
        // jeu (même logique que sellPlayer côté joueur humain — un joueur ne doit jamais devenir
        // introuvable via findPlayerAnywhere, sinon sa fiche technique ne peut plus s'ouvrir
        // depuis l'historique des transferts).
        const buyer = neediestTeamForPosition(league, sold.pos, team.id);
        if (buyer) { buyer.budget -= sold.value; buyer.players.push(sold); }
        events.push({
          type: buyer ? "transfer" : "release", playerId: sold.id, playerName: sold.name, pos: sold.pos,
          fromTeamId: team.id, fromTeamName: team.name,
          toTeamId: buyer ? buyer.id : null, toTeamName: buyer ? buyer.name : null,
          amount: sold.value
        });
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
        events.push({
          type: "transfer", playerId: bestPlayer.id, playerName: bestPlayer.name, pos: bestPlayer.pos,
          fromTeamId: bestSeller.id, fromTeamName: bestSeller.name, toTeamId: team.id, toTeamName: team.name,
          amount: bestPlayer.value
        });
      }
    }
  });
  return events;
}
