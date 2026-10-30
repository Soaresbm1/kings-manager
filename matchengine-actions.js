// ===================== MOTEUR D'ACTIONS (football manager mobile-like) =====================
// Module pur (pas de DOM, pas de STATE) : construit, action par action, ce qui se passe pendant
// UNE possession (qui a le ballon, quelle décision, contre qui, avec quel résultat), jusqu'à un
// but/arrêt/tir manqué ou une perte de balle. engine.js (chargé juste après ce fichier) orchestre
// la partie "match" (minutes, cartons, Kings League) et appelle simulatePossessionChain() à la
// place de l'ancien tirage au sort global ; matchchoreo.js anime ensuite les beats produits ici,
// sans jamais décider lui-même de ce qui s'est passé.
//
// Chargé AVANT engine.js (voir CLAUDE.md) : les helpers de géométrie du terrain vivent ici (et
// plus dans engine.js) puisque ce fichier en a besoin pour positionner les joueurs pendant une
// action, et qu'engine.js/matchchoreo.js les réutilisent tels quels ensuite.

// ----- Géométrie du terrain (repère 0-100 x 0-100, y=0 but domicile / y=100 but extérieur) -----
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

// Les rôles changent les intentions, jamais les notes de technique ou les chances
// de marquer un tir déjà donné. Sans consigne (anciens appels), le réglage reste neutre.
const ROLE_ACTION_WEIGHTS = {
  keeper: { short: 1.2 },
  stay_back: { short: 1.35, progressive: 1.1, carry: 0.65, dribble: 0.6, shot: 0.4 },
  overlap: { cross: 1.5, carry: 1.3, through: 1.1, short: 0.9 },
  creator: { short: 1.3, progressive: 1.35, through: 1.4, shot: 0.65, dribble: 0.85 },
  ball_winner: { short: 1.25, clear: 1.15, carry: 0.8, dribble: 0.7, shot: 0.6 },
  box_to_box: { carry: 1.2, progressive: 1.1 },
  runner: { carry: 1.3, dribble: 1.25, shot: 1.1, short: 0.85 },
  target: { short: 1.4, carry: 0.65, dribble: 0.7, shot: 0.9 },
  poacher: { shot: 1.5, carry: 0.75, dribble: 0.8, short: 0.7 }
};

function actionSlotPosition(setup, playerId, fallback) {
  const slots = typeof FORMATION_SLOTS !== "undefined" && setup && FORMATION_SLOTS[setup.formation];
  const index = setup && Array.isArray(setup.assignments) ? setup.assignments.indexOf(playerId) : -1;
  return slots && slots[index] ? slots[index].pos : fallback || "MID";
}

function actionRoleKey(setup, playerId, slotPos) {
  if (!setup || !setup.playerRoles) return null;
  const key = typeof getPlayerRole === "function" ? getPlayerRole(setup, playerId, slotPos).key : setup.playerRoles[playerId];
  return Object.prototype.hasOwnProperty.call(ROLE_ACTION_WEIGHTS, key) ? key : null;
}

function actionTeamStyle(setup) {
  const style = typeof TEAM_STYLES !== "undefined" && setup
    && Object.prototype.hasOwnProperty.call(TEAM_STYLES, setup.teamStyle) && TEAM_STYLES[setup.teamStyle];
  return style || { key: "neutral", width: 1, depth: 1, pressing: 1, tempo: 1 };
}

function roleAnchorAdjustment(roleKey, attacking, x) {
  const outward = x < 50 ? -1 : x > 50 ? 1 : 0;
  if (!attacking) return { x: roleKey === "ball_winner" ? -outward * 2 : 0,
    depth: roleKey === "stay_back" ? -2 : roleKey === "runner" || roleKey === "poacher" ? 2 : 0 };
  const depth = { stay_back: -5, overlap: 5, creator: -2, ball_winner: -4, box_to_box: 1, runner: 5, target: -6, poacher: 4 };
  return { x: roleKey === "overlap" ? outward * 4 : roleKey === "poacher" || roleKey === "target" ? -outward * 3 : 0,
    depth: depth[roleKey] || 0 };
}

// Cible commune du moteur et du repli d'animation des anciens beats. La position
// réellement atteinte est ensuite bornée par la vitesse et la durée de l'action.
function tacticalOffBallTarget(base, ball, side, attacking, roleKey, style, mentality) {
  const dir = side === "home" ? 1 : -1;
  const wide = base.x < 50 ? -1 : base.x > 50 ? 1 : 0;
  let pull = attacking ? 0.22 : 0.38;
  if (roleKey === "overlap" && attacking) pull *= 0.55;
  if (roleKey === "creator" && attacking) pull *= 1.4;
  if (roleKey === "ball_winner" && !attacking) pull *= 1.35;
  if (roleKey === "stay_back" && !attacking) pull *= 0.75;
  if (style && style.key === "wide" && attacking) pull *= 0.7;
  let lateral = clamp((ball.x - base.x) * pull, -14, 14);
  let depth = attacking ? (ball.y - 50) * 0.18 : (ball.y - base.y) * 0.12;
  if (attacking) {
    if (roleKey === "stay_back" || roleKey === "ball_winner") depth = Math.min(depth * dir, 1) * dir;
    else if (roleKey === "overlap") { depth += dir * 3; lateral += wide * 2; }
    else if (roleKey === "creator") depth = clamp((ball.y - base.y) * 0.12, -5, 5) - dir * 2;
    else if (roleKey === "runner") depth = Math.max(depth * dir, 3) * dir + dir * 2;
    else if (roleKey === "target") depth = Math.min(depth * dir, 1) * dir - dir * 3;
    else if (roleKey === "poacher") { depth += dir * 2; lateral -= wide * 2; }
  } else if (roleKey === "stay_back") depth -= dir * 2;
  const intent = mentality === "attacking" ? 4 : mentality === "cautious" ? -4 : 0;
  return { x: clamp(base.x + lateral, 3, 97), y: clamp(base.y + depth + intent * dir, 3, 97) };
}

// Ancre x/y de chaque joueur de champ actif d'un côté donné, pour une minute du match : en
// formation complète (7v7), reprend directement FORMATION_SLOTS (data.js) + setup.assignments —
// la tactique choisie par le joueur/l'IA façonne donc littéralement les positions utilisées, aussi
// bien pour l'affichage que pour la prise de décision du moteur d'actions ci-dessous. `possessing`
// sélectionne la disposition "avec balle" (setup.formation/assignments) ou "sans balle"
// (setup.formationOOP/assignmentsOOP, repli si absent). En dehors du 7v7 (escalier, Dé Géant,
// escalier inversé du Matchball), FORMATION_SLOTS ne s'applique pas : repli sur computeOutfieldAnchors.
// Repli défensif : fraction du trajet vers sa propre ligne de but qu'un joueur parcourt en plus sans
// le ballon — dépend du plan défensif choisi (voir MATCH_BALANCE.defenseShape) : bloc bas = ligne
// nettement plus basse (repli marqué), pressing haut = ligne qui reste haute (repli minime, les
// joueurs pressent loin de leur but), zone = compromis inchangé par rapport à avant ce réglage.
function defensiveCompactionFor(defensePlanKey) {
  const byPlan = MATCH_BALANCE.defenseShape.compactionByPlan;
  return byPlan[defensePlanKey] != null ? byPlan[defensePlanKey] : MATCH_BALANCE.defenseShape.compactionDefault;
}

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
  // Repli défensif : uniquement en formation complète (7v7, FORMATION_SLOTS). En dehors (escalier,
  // Dé Géant, escalier inversé du Matchball), la grille d'ancrage de secours (computeOutfieldAnchors)
  // ne compte que quelques points fixes déjà très rapprochés — la compacter selon `possessing`
  // ferait facilement coïncider la position "avec balle" d'un joueur avec la position "sans balle"
  // (compactée) d'un autre, provoquant un chevauchement visuel pendant qu'une passe cible l'une
  // pendant que les autres joueurs sont ramenés vers l'autre (voir matchengine-actions.js history).
  if (!possessing && useSlots) {
    const ownGoalY = side === "home" ? 4 : PITCH_H - 4;
    const compaction = defensiveCompactionFor(setup.defensePlan);
    activeOutfieldIds.forEach(id => {
      const a = anchors[id];
      if (!a) return;
      anchors[id] = { x: a.x, y: a.y + (ownGoalY - a.y) * compaction };
    });
  }
  const style = actionTeamStyle(setup);
  activeOutfieldIds.forEach(id => {
    const anchor = anchors[id];
    const pos = actionSlotPosition(setup, id, "MID");
    const roleKey = actionRoleKey(setup, id, pos);
    const adjustment = roleAnchorAdjustment(roleKey, possessing, anchor.x);
    anchor.x = clamp(50 + (anchor.x - 50) * style.width + adjustment.x, 3, 97);
    anchor.y = clamp(50 + (anchor.y - 50) * style.depth + adjustment.depth * (side === "home" ? 1 : -1), 3, 97);
    anchor.pos = pos;
    if (roleKey) anchor.roleKey = roleKey;
    if (style.key !== "neutral") anchor.teamStyle = style.key;
  });
  return anchors;
}

function attackingGoalY(side) { return side === "home" ? PITCH_H : 0; }
function ownGoalY(side) { return side === "home" ? 0 : PITCH_H; }

// ===================== CONSTANTES D'ÉQUILIBRAGE (point d'entrée unique pour ajuster le jeu) =====================
const MATCH_BALANCE = {
  // Attributs dérivés (0-99, mêmes bornes que les attributs de base) — voir data.js:player().
  derived: {
    passing: { technique: 0.55, mental: 0.30, form: 0.15 },
    dribbling: { technique: 0.50, speed: 0.30, mental: 0.20 },
    finishing: { technique: 0.50, mental: 0.35, form: 0.15 },
    defending: { physical: 0.40, mental: 0.35, speed: 0.25 },
    goalkeeping: { physical: 0.45, mental: 0.35, form: 0.20 }
  },
  // Hauteur de la ligne défensive "sans balle" (voir defensiveCompactionFor ci-dessus), selon le
  // plan défensif — 0 = reste sur sa position "avec balle" (ligne très haute), 1 = recule jusqu'à
  // coller sa propre ligne de but (bloc totalement replié). "zone" reprend le réglage historique.
  defenseShape: {
    compactionByPlan: { low: 0.6, zone: 0.4, high: 0.2 },
    compactionDefault: 0.4
  },
  // Pression ressentie par le porteur selon la distance (unités terrain) au défenseur le plus proche.
  pressure: { noPressureDist: 16, maxPressureDist: 4 },
  // Déplacement réel du défenseur le plus proche vers le porteur pendant une possession (voir
  // simulatePossessionChain:defShadow) — au lieu de rester figé sur son ancre de formation jusqu'au
  // tacle/à l'interception. `engageThreshold` : pression minimale (0-1) pour déclencher une avancée.
  // `stepFraction` : part du trajet restant vers le porteur parcourue à chaque action où il reste le
  // plus proche. `minStepDistance` : sous ce seuil, pas la peine d'émettre un beat de replacement.
  pressing: { engageThreshold: 0.15, stepFraction: 0.55, minStepDistance: 1.5 },
  chain: { maxActions: 6 }, // longueur max d'une possession avant qu'on force une conclusion
  tempo: {
    // chance d'une 2e possession (transition rapide) le même camp la même minute, selon le plan offensif
    extraChainChance: { direct: 0.40, possession: 0.18, transition: 0.42 },
    earlyPhaseExtraChance: 0.30 // en plus, pendant l'escalier de départ (0'-7')
  },
  // Poids de base de chaque décision (avant ajustement par zone/pression/tactique/poste) — voir chooseActionType.
  decision: {
    shotBase: 1.6, crossBase: 1.1, dribbleBase: 0.9, carryBase: 1.0,
    short: 2.0, progressive: 1.3, through: 0.8, clear: 1.4
  },
  pass: {
    baseSuccess: { short: 0.87, progressive: 0.74, through: 0.55, cross: 0.50 },
    ratingSpread: 220, pressurePenalty: 0.35, defenderPenaltySpread: 300,
    interceptionControlRadius: 2.5, interceptionMaxSpeed: 26
  },
  dribble: { base: 0.50, ratingSpread: 140, advanceDistance: 9, duelDistance: 5 },
  carry: { advanceDistance: 7 },
  // Faute lors d'un duel perdu par le défenseur (voir computeFoulChance) : plus il est dominé par
  // le dribbleur, plus il risque la faute plutôt que le tacle propre ; `pressureBonus` ajoute un
  // peu plus de fautes quand le défenseur est déjà lui-même en délicatesse (pressé par le système).
  foul: { baseChance: 0.16, ratingGapSpread: 120, pressureBonus: 0.10 },
  shot: { finishingSpread: 140, gkSpread: 160, onTargetBase: 0.55, onTargetSpread: 300, onTargetPressurePenalty: 0.15 },
  xg: {
    baseAtGoalMouth: 0.60, distanceDecay: 34, referenceAngle: 0.60,
    throughBallMod: 1.25, crossMod: 0.80, counterMod: 1.20, highRecoveryMod: 1.15,
    faceToFaceMod: 1.35, numericSuperiorityMod: 1.12, pressurePenalty: 0.50,
    shooterQualitySpread: 150, gkQualitySpread: 150
  },
  // Fatigue en cours de match (état transitoire, jamais sauvegardé — voir engine.js:staminaState).
  stamina: { drainPerTouch: 1.1, regenPerMinute: 0.6, pressingExtraDrain: 0.5, min: 55, max: 100, effectSpread: 0.15 },
  beatDurations: {
    short: 0.5, progressive: 0.6, through: 0.68, cross: 0.62, carry: 0.5, dribble: 0.45,
    interception: 0.4, tackle: 0.45, clear: 0.55, shot: 0.65, outcome: 0.4, press: 0.35
  },
  earlyPhase: { xgBoost: 1.35 } // 0'-7' : effectifs réduits, plus d'espaces -> occasions plus dangereuses
};

// ----- Attributs dérivés (voir data.js:player pour speed/technique/physical/mental/form) -----
function weightedAttr(p, w) {
  return (w.technique || 0) * p.technique + (w.mental || 0) * p.mental + (w.form || 0) * p.form +
    (w.speed || 0) * p.speed + (w.physical || 0) * p.physical;
}
function computePassingRating(p) { return weightedAttr(p, MATCH_BALANCE.derived.passing); }
function computeDribblingRating(p) { return weightedAttr(p, MATCH_BALANCE.derived.dribbling); }
function computeFinishingRating(p) { return weightedAttr(p, MATCH_BALANCE.derived.finishing); }
function computeDefendingRating(p) { return weightedAttr(p, MATCH_BALANCE.derived.defending); }
function computeGoalkeepingRating(p) { return weightedAttr(p, MATCH_BALANCE.derived.goalkeeping); }

// ----- Sélection pondérée d'un joueur (copie volontairement locale de la logique équivalente
// d'engine.js:weightedPick — ce fichier est chargé AVANT engine.js, voir CLAUDE.md, et reste
// autonome plutôt que de dépendre d'une fonction définie plus tard dans l'ordre de chargement). -----
function pickCarrierWeighted(players) {
  if (!players.length) return null;
  const weights = players.map(p => {
    let w = (p.technique + p.physical + p.speed) / 3;
    if (p.pos === "ATT") w *= 1.6; else if (p.pos === "MID") w *= 1.7; else if (p.pos === "GK") w *= 0.05; else w *= 1.0;
    return Math.max(0.01, w);
  });
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < players.length; i++) { r -= weights[i]; if (r <= 0) return players[i]; }
  return players[players.length - 1];
}

// ----- Pression défensive -----
function nearestDefenderInfo(pos, defenders, defAnchors) {
  let best = null, bestDist = Infinity;
  defenders.forEach(d => {
    const a = defAnchors[d.id];
    if (!a) return;
    const dist = Math.hypot(a.x - pos.x, a.y - pos.y);
    if (dist < bestDist) { bestDist = dist; best = d; }
  });
  return { defender: best, distance: bestDist === Infinity ? 40 : bestDist };
}
function computePressure(distance) {
  const B = MATCH_BALANCE.pressure;
  if (distance >= B.noPressureDist) return 0;
  if (distance <= B.maxPressureDist) return 1;
  return 1 - (distance - B.maxPressureDist) / (B.noPressureDist - B.maxPressureDist);
}

// ----- Zone du terrain relative au but visé (final/mid/own tiers) -----
function fieldZone(pos, side) {
  const d = Math.abs(pos.y - attackingGoalY(side));
  if (d <= 33) return "final";
  if (d <= 66) return "mid";
  return "own";
}

// ===================== DÉCISION =====================
// Choisit une décision cohérente selon la zone, la pression, le plan offensif, le poste du
// porteur et le nombre d'actions déjà jouées dans la possession (force une conclusion en fin de
// chaîne plutôt que de tourner indéfiniment).
function chooseActionType(ctx) {
  const { carrier, zone, pressure, attackPlanKey, mentality, pos, side, actionsLeft, hasPassOptions, roleKey, teamStyleKey } = ctx;
  const D = MATCH_BALANCE.decision;
  const isWide = pos.x < 25 || pos.x > 75;
  const goalDist = Math.abs(attackingGoalY(side) - pos.y);

  const w = {
    shot: zone === "final" ? D.shotBase * (1 - pressure * 0.4) * (goalDist < 28 ? 1.4 : 0.8) : (zone === "mid" && goalDist < 38 ? D.shotBase * 0.22 : 0),
    cross: (hasPassOptions && zone !== "own" && isWide) ? D.crossBase : 0,
    dribble: pressure > 0.3 ? D.dribbleBase * (0.6 + pressure) : D.dribbleBase * 0.45,
    carry: pressure < 0.55 ? D.carryBase : D.carryBase * 0.3,
    // Sans coéquipier valable (1 seul joueur de champ actif : escalier de départ, Dé Géant 1v1,
    // fin d'escalier inversé du Matchball), aucune décision de passe n'est proposée — la seule
    // solution est de conduire/dribbler/tirer soi-même, comme un vrai 1 contre 1.
    short: hasPassOptions ? D.short : 0,
    progressive: hasPassOptions ? D.progressive : 0,
    through: hasPassOptions ? (zone !== "own" ? D.through : D.through * 0.3) : 0,
    clear: zone === "own" && pressure > 0.5 ? D.clear * pressure : 0
  };

  if (attackPlanKey === "possession") { w.short *= 1.5; w.through *= 0.7; w.dribble *= 0.85; }
  else if (attackPlanKey === "direct") { w.progressive *= 1.6; w.through *= 1.3; w.short *= 0.7; }
  else if (attackPlanKey === "transition") { w.through *= 1.5; w.carry *= 1.2; w.short *= 0.8; }

  // La mentalité change la prise de risque, sans transformer un tir donné en but.
  // Le mode équilibré conserve exactement les poids historiques.
  if (mentality === "cautious") {
    w.short *= 1.25; w.through *= 0.70; w.dribble *= 0.80; w.clear *= 1.15;
  } else if (mentality === "attacking") {
    w.progressive *= 1.10; w.through *= 1.20; w.carry *= 1.08; w.short *= 0.85;
  }

  if (actionsLeft <= 1) {
    w.short *= 0.3; w.progressive *= 0.5; w.carry *= 0.4; w.clear *= 1.3;
    if (zone === "final") w.shot *= 1.6;
  }

  const position = ctx.slotPos || carrier.pos;
  if (position === "ATT") { w.shot *= 1.3; w.dribble *= 1.15; }
  else if (position === "DEF") { w.shot *= 0.25; w.clear *= 1.4; w.short *= 1.2; }
  else if (position === "GK") { w.short *= 1.4; w.progressive *= 1.2; w.shot = 0; w.dribble *= 0.2; w.cross = 0; }

  const roleWeights = ROLE_ACTION_WEIGHTS[roleKey] || {};
  Object.keys(roleWeights).forEach(key => { w[key] *= roleWeights[key]; });
  if (teamStyleKey === "control") { w.short *= 1.22; w.through *= 0.9; w.dribble *= 0.85; }
  else if (teamStyleKey === "pressing") { w.progressive *= 1.12; w.carry *= 1.05; }
  else if (teamStyleKey === "counter") { w.through *= 1.25; w.carry *= 1.15; w.short *= 0.8; }
  else if (teamStyleKey === "compact") { w.short *= 1.12; w.clear *= 1.2; w.through *= 0.85; }
  else if (teamStyleKey === "wide") { w.cross *= 1.35; w.progressive *= 1.1; w.short *= 0.85; }

  return weightedChoice(w);
}
function weightedChoice(weights) {
  const entries = Object.entries(weights).filter(([, v]) => v > 0);
  if (!entries.length) return "short";
  const total = entries.reduce((s, [, v]) => s + v, 0);
  let r = Math.random() * total;
  for (const [k, v] of entries) { r -= v; if (r <= 0) return k; }
  return entries[entries.length - 1][0];
}

// ===================== RÉSOLUTION =====================
function resolvePassChance(kind, passer, pressure, defenderRating, staminaFactor) {
  const B = MATCH_BALANCE.pass;
  const rating = computePassingRating(passer) * (staminaFactor || 1);
  let chance = B.baseSuccess[kind] + (rating - 70) / B.ratingSpread - pressure * B.pressurePenalty;
  if (defenderRating != null) chance -= (defenderRating - 70) / B.defenderPenaltySpread;
  return clamp(chance, 0.12, 0.97);
}
function resolveDribbleChance(attacker, defender, staminaFactor, distance) {
  // Un duel suppose un adversaire à portée : sans lui, c'est une conduite libre,
  // pas un tacle gagné à distance par un défenseur fictif.
  if (!defender || (distance != null && distance > MATCH_BALANCE.dribble.duelDistance)) return 1;
  const B = MATCH_BALANCE.dribble;
  const atk = computeDribblingRating(attacker) * (staminaFactor || 1);
  const def = computeDefendingRating(defender);
  return clamp(B.base + (atk - def) / B.ratingSpread, 0.15, 0.9);
}

// ----- Faute lors d'un duel (dribble) perdu par le défenseur : plus probable quand il est
// nettement dominé — voir engine.js:attemptRealAttack pour la conséquence (carton jaune ou
// penalty selon la zone, via les mêmes mécanismes que la faute aléatoire déjà existante). -----
function computeFoulChance(defender, carrier, pressure) {
  const F = MATCH_BALANCE.foul;
  const gap = computeDribblingRating(carrier) - computeDefendingRating(defender);
  return clamp(F.baseChance + Math.max(0, gap) / F.ratingGapSpread + pressure * F.pressureBonus, 0.03, 0.5);
}
// Surface de réparation : à moins de 18 unités de la ligne de but visée, dans le couloir central
// (voir le tracé du rectangle dans app.js:drawPitchMarkings, mêmes proportions).
function isInPenaltyBox(pos, side) {
  const dist = Math.abs(attackingGoalY(side) - pos.y);
  return dist <= 18 && pos.x >= 19 && pos.x <= 81;
}

// ----- xG : distance + angle du but vu depuis le point de tir, modulé par le contexte de l'action -----
function computeShotXG(shotCtx) {
  const B = MATCH_BALANCE.xg;
  const { pos, side, pressure, assistType, isCounter, isHighRecovery, numericSuperiority, faceToFace, shooterQuality, gkQuality } = shotCtx;
  const goalY = attackingGoalY(side);
  const dy = Math.max(0.001, Math.abs(goalY - pos.y));
  const postA = Math.atan2(GOAL_X_MIN - pos.x, dy);
  const postB = Math.atan2(GOAL_X_MAX - pos.x, dy);
  const angle = Math.abs(postB - postA);
  const distance = Math.hypot(50 - pos.x, dy);

  let xg = B.baseAtGoalMouth * Math.exp(-distance / B.distanceDecay) * clamp(angle / B.referenceAngle, 0.15, 2.2);
  if (assistType === "through") xg *= B.throughBallMod;
  else if (assistType === "cross") xg *= B.crossMod;
  if (isCounter) xg *= B.counterMod;
  if (isHighRecovery) xg *= B.highRecoveryMod;
  if (faceToFace) xg *= B.faceToFaceMod;
  if (numericSuperiority) xg *= B.numericSuperiorityMod;
  xg *= (1 - pressure * B.pressurePenalty);
  xg *= clamp(0.7 + (shooterQuality - 70) / B.shooterQualitySpread, 0.6, 1.35);
  xg *= clamp(1.3 - (gkQuality - 70) / B.gkQualitySpread, 0.7, 1.3);
  return clamp(xg, 0.01, 0.95);
}

// ----- Résolution du tir face au gardien, à partir de l'xG déjà calculé -----
function resolveShotOutcome(xg, shooterFinishing, gkRating, pressure) {
  const B = MATCH_BALANCE.shot;
  let goalChance = xg * clamp(0.6 + shooterFinishing / B.finishingSpread, 0.7, 1.3) * clamp(1.25 - gkRating / B.gkSpread, 0.75, 1.25);
  goalChance = clamp(goalChance, 0.02, 0.92);
  if (Math.random() < goalChance) return "goal";
  const onTargetChance = clamp(B.onTargetBase + shooterFinishing / B.onTargetSpread - pressure * B.onTargetPressurePenalty, 0.25, 0.85);
  return Math.random() < onTargetChance ? "save" : "miss";
}

// ===================== CIBLAGE (choix du coéquipier/point visé) =====================
function pickPassTarget(kind, side, teammates, carrier, atkAnchors, pos, defenders, defAnchors, setup) {
  const mates = teammates.filter(p => p.id !== carrier.id && p.pos !== "GK");
  if (!mates.length) return null;
  const scored = mates.map(p => {
    const a = atkAnchors[p.id] || pos;
    const forwardness = side === "home" ? (a.y - pos.y) : (pos.y - a.y);
    const dist = Math.hypot(a.x - pos.x, a.y - pos.y);
    const nearest = defenders ? nearestDefenderInfo(a, defenders, defAnchors || {}).distance : 20;
    const openness = clamp(nearest, 0, 20);
    let score = kind === "short" ? -dist + openness * 0.7
      : forwardness * (kind === "through" ? 1.5 : 1.0) + openness * 0.9 - dist * 0.15;
    const roleKey = actionRoleKey(setup, p.id, actionSlotPosition(setup, p.id, p.pos));
    // Un appui vient au ballon ; un joueur de profondeur est une solution de
    // passe verticale. L'espace libre et la distance restent prépondérants.
    if (kind === "short") score += roleKey === "creator" || roleKey === "target" ? 7 : roleKey === "ball_winner" ? 3 : 0;
    else if (kind === "through") score += roleKey === "runner" ? 9 : roleKey === "poacher" ? 7 : roleKey === "target" ? -6 : roleKey === "stay_back" ? -8 : 0;
    else score += roleKey === "creator" || roleKey === "box_to_box" ? 4 : roleKey === "runner" ? 3 : 0;
    return { p, a, forwardness, dist, score };
  });
  scored.sort((x, y) => y.score - x.score);
  const pool = scored.slice(0, Math.min(2, scored.length));
  if (setup && setup.playerRoles) {
    const weights = pool.map(candidate => Math.exp((candidate.score - pool[0].score) / 14));
    let draw = Math.random() * weights.reduce((sum, value) => sum + value, 0);
    for (let i = 0; i < pool.length; i++) { draw -= weights[i]; if (draw <= 0) return pool[i].p; }
    return pool[pool.length - 1].p;
  }
  return pool[Math.floor(Math.random() * pool.length)].p;
}
function pickBoxTarget(teammates, carrier, atkAnchors, side, setup) {
  const goalY = attackingGoalY(side);
  const mates = teammates.filter(p => p.id !== carrier.id && p.pos !== "GK");
  if (!mates.length) return null;
  const scored = mates.map(p => ({ p, a: atkAnchors[p.id] || { x: 50, y: goalY } }));
  const arrival = candidate => {
    const roleKey = actionRoleKey(setup, candidate.p.id, actionSlotPosition(setup, candidate.p.id, candidate.p.pos));
    return Math.abs(goalY - candidate.a.y) - (roleKey === "poacher" ? 5 : roleKey === "runner" || roleKey === "target" ? 2 : 0);
  };
  scored.sort((x, y) => arrival(x) - arrival(y));
  return scored[0];
}
function advancedPoint(pos, side, distance) {
  const dir = side === "home" ? 1 : -1;
  const jitterX = (Math.random() - 0.5) * 10;
  return { x: clamp(pos.x + jitterX, 3, 97), y: clamp(pos.y + dir * distance, 2, 98) };
}
function clearTarget(pos, side) {
  const dir = side === "home" ? 1 : -1;
  return { x: clamp(20 + Math.random() * 60, 5, 95), y: clamp(pos.y + dir * 30, 2, 98) };
}
function pickShotTarget(side, onTarget) {
  const y = attackingGoalY(side);
  const nearY = side === "home" ? y - 6 : y + 6;
  let x;
  if (onTarget) x = GOAL_X_MIN + 2 + Math.random() * (GOAL_X_MAX - GOAL_X_MIN - 4);
  else x = Math.random() < 0.5 ? GOAL_X_MIN - 3 - Math.random() * 8 : GOAL_X_MAX + 3 + Math.random() * 8;
  return { x: clamp(x, 2, 98), y: onTarget ? nearY : y };
}
function lerpPoint(a, b, t) { return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }; }

// Coupe une passe uniquement si un défenseur peut rejoindre sa trajectoire pendant
// le vol du ballon. Le défenseur proche du passeur n'est pas forcément l'intercepteur.
function findPassInterception(from, to, defenders, defAnchors, duration) {
  const dx = to.x - from.x, dy = to.y - from.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared < 0.01) return null;
  let best = null;
  defenders.forEach(defender => {
    const origin = defAnchors[defender.id];
    if (!origin) return;
    const fraction = clamp(((origin.x - from.x) * dx + (origin.y - from.y) * dy) / lengthSquared, 0.08, 0.96);
    const point = lerpPoint(from, to, fraction);
    const distance = Math.hypot(point.x - origin.x, point.y - origin.y);
    const speed = MATCH_BALANCE.pass.interceptionMaxSpeed * clamp(defender.speed / 100, 0.55, 1);
    const travelTime = duration * fraction;
    if (distance > MATCH_BALANCE.pass.interceptionControlRadius + speed * travelTime) return;
    if (!best || fraction < best.fraction || (fraction === best.fraction && distance < best.distance)) {
      best = { defender, origin, point, fraction, distance };
    }
  });
  return best;
}

// Une passe imprécise sans intercepteur atteignable peut sortir du terrain : on
// prolonge sa direction jusqu'à la première ligne plutôt que d'inventer un tacle.
function overhitPassExit(from, to) {
  let dx = to.x - from.x, dy = to.y - from.y;
  if (Math.hypot(dx, dy) < 0.01) dx = from.x < 50 ? -1 : 1;
  const tx = dx > 0 ? (PITCH_W - from.x) / dx : (dx < 0 ? -from.x / dx : Infinity);
  const ty = dy > 0 ? (PITCH_H - from.y) / dy : (dy < 0 ? -from.y / dy : Infinity);
  const t = Math.max(0, Math.min(tx, ty));
  const exit = { x: clamp(from.x + dx * t, 0, PITCH_W), y: clamp(from.y + dy * t, 0, PITCH_H) };
  // L'imprécision doit être visible : une passe déclarée sortie ne peut pas
  // traverser le but entre les poteaux sans que le moteur compte un but.
  if ((exit.y === 0 || exit.y === PITCH_H) && exit.x >= GOAL_X_MIN && exit.x <= GOAL_X_MAX) {
    exit.x = exit.x < 50 ? GOAL_X_MIN - 4 : GOAL_X_MAX + 4;
  }
  return exit;
}

function makeBeat(type, side, playerId, gkId, from, to, duration, toPlayerId) {
  return { type, side, playerId: playerId || null, toPlayerId: toPlayerId || null, gkId: gkId || null, from: { x: from.x, y: from.y }, to: { x: to.x, y: to.y }, duration, event: null };
}

// ----- Phrase d'amorce (voir engine.js:attemptRealAttack) : uniquement pour les actions qui
// "racontent" vraiment quelque chose (passe en profondeur, centre, dribble) juste avant un tir —
// pas besoin d'annoncer chaque passe courte, cf. consigne "pas besoin d'afficher chaque passe". -----
function buildLeadIn(lastActionType, assister, scorer) {
  if (lastActionType === "through" && assister) return `${assister.name} trouve ${scorer.name} entre les lignes.`;
  if (lastActionType === "cross" && assister) return `${assister.name} centre pour ${scorer.name}.`;
  if (lastActionType === "dribble") return `${scorer.name} élimine son défenseur.`;
  return null;
}

// ----- Phrase de récupération en tout début de possession (ex. "Soares récupère le ballon dans
// l'axe.") : uniquement quand la possession part de son propre camp ou du milieu de terrain — déjà
// en position offensive, la récupération n'a rien de notable à raconter (voir engine.js:
// attemptRealAttack, qui ne l'affiche de toute façon que si la possession débouche sur un tir). -----
function buildRecoveryLine(carrier, pos, zone) {
  if (zone === "final") return null;
  const lateral = pos.x < 35 ? "côté gauche" : pos.x > 65 ? "côté droit" : "dans l'axe";
  const depthPhrase = zone === "own" ? "dans son propre camp" : "au milieu de terrain";
  return `${carrier.name} récupère le ballon ${lateral} ${depthPhrase}.`;
}

// ===================== ORCHESTRATION D'UNE POSSESSION =====================
// params: {
//   side, attackers, defenders, gk, ownGK?, atkAnchors, defAnchors,
//   attackPlanKey, attackMod, defenseMod, atkSetup?, defSetup?,
//   earlyPhaseBoost, withSequence, staminaFactorFor(playerId) -> multiplicateur de fatigue (0.85-1),
//   initialState?: {carrierId, ball, positions, isCounter, isHighRecovery, restartType}
// }
// Renvoie { outcome, scorer, assister, gk, xG, leadIn, recoveryLine, foul, beats, touchedIds,
//           attackStats:{shots,shotsOnTarget,passesAttempted,passesCompleted,clearances,possessionActions},
//           defenseStats:{interceptions,tacklesWon,fouls},
//           endState:{carrierId,ball,positions,nextSide,restartType,releasePoint,isCounter,isHighRecovery} }
// "retained" signifie que le budget d'actions est écoulé sans perte de possession.
// releasePoint est le dernier point réellement atteint ; ball peut être le point de
// reprise réglementaire suivant (engagement/dégagement du gardien). Chaque beat animé
// contient positionsBefore/positionsAfter, utilisés aussi par la chorégraphie.
function simulatePossessionChain(params) {
  const {
    side, attackers, defenders, gk, atkAnchors, defAnchors,
    attackPlanKey, attackMod, defenseMod, earlyPhaseBoost, withSequence,
    staminaFactorFor
  } = params;
  const initial = params.initialState || null;
  const mentality = params.mentality || "balanced";
  const defenseMentality = params.defenseMentality || "balanced";
  const atkSetup = params.atkSetup || null;
  const defSetup = params.defSetup || null;
  const attackStyle = actionTeamStyle(atkSetup);
  const defenseStyle = actionTeamStyle(defSetup);
  const ownGK = params.ownGK || attackers.find(p => p.pos === "GK") || null;
  const oppSide = side === "home" ? "away" : "home";
  const beats = withSequence ? [] : null;
  const touchedIds = new Set();
  const attackStats = { shots: 0, shotsOnTarget: 0, passesAttempted: 0, passesCompleted: 0, clearances: 0, possessionActions: 0 };
  const defenseStats = { interceptions: 0, tacklesWon: 0, fouls: 0 };
  const fieldAttackers = attackers.filter(p => p.pos !== "GK");
  const attackingPlayers = ownGK ? fieldAttackers.concat(ownGK) : fieldAttackers;
  const allPlayers = attackingPlayers.concat(defenders, gk ? [gk] : []);
  const playerById = new Map(allPlayers.map(p => [p.id, p]));
  const positions = {};
  const copyPoint = p => ({ x: clamp(p.x, 0, PITCH_W), y: clamp(p.y, 0, PITCH_H) });
  const snapshot = () => Object.fromEntries(Object.entries(positions).map(([id, p]) => [id, copyPoint(p)]));
  [atkAnchors, defAnchors, initial && initial.positions].forEach(source => {
    Object.entries(source || {}).forEach(([id, p]) => {
      if (playerById.has(id) && p && Number.isFinite(p.x) && Number.isFinite(p.y)) positions[id] = copyPoint(p);
    });
  });
  if (ownGK && !positions[ownGK.id]) positions[ownGK.id] = { x: 50, y: gkAnchorY(side) };
  if (gk && !positions[gk.id]) positions[gk.id] = { x: 50, y: gkAnchorY(oppSide) };
  allPlayers.forEach(p => {
    if (!positions[p.id]) positions[p.id] = { x: 50, y: p.pos === "GK" ? gkAnchorY(p === ownGK ? side : oppSide) : 50 };
  });

  if (!fieldAttackers.length && !ownGK) {
    return { outcome: "none", beats: beats || [], attackStats, defenseStats, touchedIds: [], xG: 0,
      endState: { carrierId: null, ball: initial && initial.ball ? copyPoint(initial.ball) : { x: 50, y: 50 },
        positions: snapshot(), nextSide: oppSide, restartType: "looseBall", isCounter: false, isHighRecovery: false } };
  }

  let carrier = initial && attackingPlayers.find(p => p.id === initial.carrierId);
  if (!carrier && initial && initial.ball) {
    carrier = [...fieldAttackers].sort((a, b) =>
      Math.hypot(positions[a.id].x - initial.ball.x, positions[a.id].y - initial.ball.y)
      - Math.hypot(positions[b.id].x - initial.ball.x, positions[b.id].y - initial.ball.y))[0];
  }
  carrier = carrier || pickCarrierWeighted(fieldAttackers) || ownGK;
  let pos = initial && initial.ball ? copyPoint(initial.ball) : copyPoint(positions[carrier.id]);
  positions[carrier.id] = copyPoint(pos);
  touchedIds.add(carrier.id);
  const startZone = fieldZone(pos, side);
  const isCounter = initial ? !!initial.isCounter : startZone === "own";
  const isHighRecovery = initial ? !!initial.isHighRecovery : startZone === "final";
  const recoveryLine = initial && !isCounter && !isHighRecovery ? null : buildRecoveryLine(carrier, pos, startZone);
  let lastActionType = null;
  let assister = null;
  let outcome = "retained";
  let foul = null;
  let scorer = null, finalGk = gk || null, shotXG = 0, leadIn = null;
  let terminal = null;
  const staminaFor = p => (staminaFactorFor ? staminaFactorFor(p.id) : 1) * (attackMod || 1);
  const playerSpeed = p => MATCH_BALANCE.pass.interceptionMaxSpeed
    * clamp(0.6 + (p && Number.isFinite(p.speed) ? p.speed : 60) / 250, 0.6, 1);
  function shadowPos(defender) { return positions[defender.id] || { x: 50, y: 50 }; }

  // Le moteur et l'animation partagent désormais les mêmes positions avant/après
  // chaque action. Les joueurs sans ballon rejoignent des appuis ou leur bloc
  // progressivement ; le porteur reste fixé au ballon pendant un pressing.
  function emitBeat(beat, updates, freeze) {
    updates = updates || {};
    const before = beats ? snapshot() : null;
    Object.entries(updates).forEach(([id, target]) => {
      const origin = positions[id];
      if (origin) beat.duration = Math.max(beat.duration,
        Math.hypot(target.x - origin.x, target.y - origin.y) / playerSpeed(playerById.get(id)));
    });
    const ballAtEnd = beat.type === "press" ? pos : beat.to;
    if (!freeze) {
      allPlayers.forEach(player => {
        if (player.id === carrier.id || updates[player.id]) return;
        const current = positions[player.id];
        const attacking = attackingPlayers.some(p => p.id === player.id);
        const base = (attacking ? atkAnchors : defAnchors)[player.id] || current;
        let target;
        if (player.pos === "GK") {
          target = { x: clamp(50 + (ballAtEnd.x - 50) * 0.12, 42, 58),
            y: gkAnchorY(attacking ? side : oppSide) };
        } else {
          const teamMentality = attacking ? mentality : defenseMentality;
          const teamSide = attacking ? side : oppSide;
          const setup = attacking ? atkSetup : defSetup;
          const roleKey = actionRoleKey(setup, player.id, actionSlotPosition(setup, player.id, player.pos));
          target = tacticalOffBallTarget(base, ballAtEnd, teamSide, attacking, roleKey,
            attacking ? attackStyle : defenseStyle, teamMentality);
        }
        const distance = Math.hypot(target.x - current.x, target.y - current.y);
        const step = Math.min(1, playerSpeed(player) * beat.duration / Math.max(0.001, distance));
        positions[player.id] = lerpPoint(current, target, step);
      });
    }
    Object.entries(updates).forEach(([id, target]) => { positions[id] = copyPoint(target); });
    if (beats) {
      beat.positionsBefore = before;
      beat.positionsAfter = snapshot();
      beats.push(beat);
    }
    return beat;
  }

  function finish(nextSide, carrierId, ball, restartType, releasePoint) {
    const liveRecovery = nextSide !== side && !restartType;
    const zone = fieldZone(ball, nextSide);
    terminal = { nextSide, carrierId: carrierId || null, ball: copyPoint(ball),
      restartType: restartType || null, releasePoint: copyPoint(releasePoint || ball),
      isCounter: liveRecovery && zone === "own",
      isHighRecovery: liveRecovery && zone === "final" };
  }

  function keeperRestart(releasePoint) {
    const ball = finalGk ? { x: 50, y: gkAnchorY(oppSide) } : { x: 50, y: oppSide === "home" ? 8 : 92 };
    finish(oppSide, finalGk && finalGk.id, ball, "goalKick", releasePoint);
  }

  function losePass(kind, target, duration) {
    const interception = findPassInterception(pos, target, defenders, positions, duration);
    const end = interception ? interception.point : overhitPassExit(pos, target);
    const intendedDistance = Math.hypot(target.x - pos.x, target.y - pos.y);
    const actualDistance = Math.hypot(end.x - pos.x, end.y - pos.y);
    const flightDuration = interception ? duration * interception.fraction
      : duration * Math.max(1, actualDistance / Math.max(1, intendedDistance));
    const flight = makeBeat(kind, side, carrier.id, null, pos, end, flightDuration);
    const updates = {};
    if (interception) {
      defenseStats.interceptions++;
      touchedIds.add(interception.defender.id);
      flight.interceptorId = interception.defender.id;
      flight.interceptorFrom = copyPoint(interception.origin);
      flight.interceptorTo = copyPoint(end);
      updates[interception.defender.id] = end;
    }
    emitBeat(flight, updates);
    emitBeat(makeBeat(interception ? "interception" : "out", oppSide,
      interception ? interception.defender.id : null, null, end, end, MATCH_BALANCE.beatDurations.interception),
      interception ? { [interception.defender.id]: end } : {}, true);
    if (interception) {
      finish(oppSide, interception.defender.id, end, null);
    } else if (end.y === attackingGoalY(side)) {
      keeperRestart(end);
    } else {
      finish(oppSide, null, end, end.y === ownGoalY(side) ? "corner" : "kickIn");
    }
  }

  let actionsLeft = MATCH_BALANCE.chain.maxActions;
  while (actionsLeft-- > 0) {
    attackStats.possessionActions++;
    const { defender: nearestDef, distance } = nearestDefenderInfo(pos, defenders, positions);
    const pressure = clamp(computePressure(distance) * (defenseMod || 1), 0, 1);
    const zone = fieldZone(pos, side);
    if (nearestDef) {
      const P = MATCH_BALANCE.pressing;
      const defensiveRole = actionRoleKey(defSetup, nearestDef.id, actionSlotPosition(defSetup, nearestDef.id, nearestDef.pos));
      const rolePressing = defensiveRole === "ball_winner" ? 1.15 : defensiveRole === "stay_back" ? 0.85 : 1;
      const pressingIntent = clamp(defenseStyle.pressing * rolePressing, 0.7, 1.35);
      if (pressure > P.engageThreshold / pressingIntent) {
        const engaged = shadowPos(nearestDef);
        const stepTarget = lerpPoint(engaged, pos, clamp(P.stepFraction * pressingIntent, 0.3, 0.75));
        if (Math.hypot(stepTarget.x - engaged.x, stepTarget.y - engaged.y) > P.minStepDistance) {
          emitBeat(makeBeat("press", oppSide, nearestDef.id, null, engaged, stepTarget, MATCH_BALANCE.beatDurations.press),
            { [nearestDef.id]: stepTarget });
        }
      }
    }

    const hasPassOptions = fieldAttackers.some(p => p.id !== carrier.id);
    const slotPos = actionSlotPosition(atkSetup, carrier.id, carrier.pos);
    const decision = chooseActionType({ carrier, zone, pressure, attackPlanKey, mentality, pos, side, actionsLeft, hasPassOptions,
      slotPos, roleKey: actionRoleKey(atkSetup, carrier.id, slotPos), teamStyleKey: attackStyle.key });

    if (decision === "shot") {
      attackStats.shots++;
      const faceToFace = lastActionType === "through" && pressure < 0.3;
      const numericSuperiority = fieldAttackers.length > defenders.length;
      let xg = computeShotXG({
        pos, side, pressure, assistType: lastActionType, isCounter, isHighRecovery,
        numericSuperiority, faceToFace,
        shooterQuality: computeFinishingRating(carrier) * staminaFor(carrier),
        gkQuality: finalGk ? computeGoalkeepingRating(finalGk) : 55
      });
      xg = clamp(xg * (earlyPhaseBoost || 1), 0.01, 0.95);
      shotXG = xg;
      const res = resolveShotOutcome(xg, computeFinishingRating(carrier) * staminaFor(carrier),
        finalGk ? computeGoalkeepingRating(finalGk) : 55, pressure);
      const target = pickShotTarget(side, res !== "miss");
      const keeperTarget = finalGk ? { x: clamp(target.x, 37, 63),
        y: res === "save" ? target.y : positions[finalGk.id].y } : null;
      emitBeat(makeBeat("shot", side, carrier.id, finalGk ? finalGk.id : null, pos, target, MATCH_BALANCE.beatDurations.shot),
        finalGk ? { [finalGk.id]: keeperTarget } : {});
      scorer = carrier;
      leadIn = buildLeadIn(lastActionType, assister, scorer);
      if (res === "goal") {
        attackStats.shotsOnTarget++;
        outcome = "goal";
        const goalPoint = { x: target.x, y: attackingGoalY(side) };
        emitBeat(makeBeat("goal", side, carrier.id, finalGk ? finalGk.id : null,
          target, goalPoint, MATCH_BALANCE.beatDurations.outcome), {}, true);
        finish(oppSide, null, { x: 50, y: 50 }, "kickoff", goalPoint);
      } else if (res === "save") {
        attackStats.shotsOnTarget++;
        outcome = "save";
        emitBeat(makeBeat("save", side, carrier.id, finalGk ? finalGk.id : null,
          target, target, MATCH_BALANCE.beatDurations.outcome), finalGk ? { [finalGk.id]: target } : {}, true);
        finish(oppSide, finalGk && finalGk.id, target, finalGk ? null : "looseBall");
        // Un arrêt construit une nouvelle relance, pas une contre-attaque déjà lancée.
        terminal.isCounter = false;
        terminal.isHighRecovery = false;
      } else {
        outcome = "miss";
        emitBeat(makeBeat("miss", side, carrier.id, finalGk ? finalGk.id : null,
          target, target, MATCH_BALANCE.beatDurations.outcome), {}, true);
        keeperRestart(target);
      }
      break;
    }

    if (decision === "clear") {
      attackStats.clearances++;
      outcome = "clearance";
      const target = clearTarget(pos, side);
      const flightTime = MATCH_BALANCE.beatDurations.clear;
      const receiver = nearestDefenderInfo(target, defenders, positions);
      const canReach = receiver.defender
        && receiver.distance <= MATCH_BALANCE.pass.interceptionControlRadius + playerSpeed(receiver.defender) * flightTime;
      const updates = canReach ? { [receiver.defender.id]: target } : {};
      emitBeat(makeBeat("clear", side, carrier.id, null, pos, target, flightTime), updates);
      finish(oppSide, canReach ? receiver.defender.id : null, target, canReach ? null : "looseBall");
      break;
    }

    if (decision === "cross") {
      const boxTarget = pickBoxTarget(fieldAttackers, carrier, positions, side, atkSetup);
      if (!boxTarget) break;
      attackStats.passesAttempted++;
      const chance = resolvePassChance("cross", carrier, pressure,
        nearestDef ? computeDefendingRating(nearestDef) : null, staminaFor(carrier));
      if (Math.random() < chance) {
        attackStats.passesCompleted++;
        touchedIds.add(boxTarget.p.id);
        const target = copyPoint(boxTarget.a);
        emitBeat(makeBeat("cross", side, carrier.id, null, pos, target,
          MATCH_BALANCE.beatDurations.cross, boxTarget.p.id), { [boxTarget.p.id]: target });
        positions[carrier.id] = copyPoint(pos);
        assister = carrier; lastActionType = "cross";
        carrier = boxTarget.p; pos = target;
        continue;
      }
      outcome = "turnover";
      losePass("cross", boxTarget.a, MATCH_BALANCE.beatDurations.cross);
      break;
    }

    if (decision === "dribble") {
      const advance = advancedPoint(pos, side, MATCH_BALANCE.dribble.advanceDistance);
      const duelDistance = nearestDef ? Math.hypot(shadowPos(nearestDef).x - pos.x, shadowPos(nearestDef).y - pos.y) : Infinity;
      if (!nearestDef || duelDistance > MATCH_BALANCE.dribble.duelDistance) {
        emitBeat(makeBeat("carry", side, carrier.id, null, pos, advance, MATCH_BALANCE.beatDurations.carry),
          { [carrier.id]: advance });
        pos = advance; lastActionType = "carry";
        continue;
      }
      const chance = resolveDribbleChance(carrier, nearestDef, staminaFor(carrier), duelDistance);
      if (Math.random() < chance) {
        emitBeat(makeBeat("dribble", side, carrier.id, null, pos, advance, MATCH_BALANCE.beatDurations.dribble),
          { [carrier.id]: advance });
        pos = advance; lastActionType = "dribble";
        continue;
      }
      touchedIds.add(nearestDef.id);
      if (Math.random() < computeFoulChance(nearestDef, carrier, pressure)) {
        defenseStats.fouls++;
        outcome = "foul";
        foul = { severity: isInPenaltyBox(pos, side) ? "penalty" : "yellow", by: nearestDef, against: carrier };
        finish(side, carrier.id, pos, foul.severity === "penalty" ? "penalty" : "freeKick");
      } else {
        outcome = "turnover";
        defenseStats.tacklesWon++;
        finish(oppSide, nearestDef.id, pos, null);
      }
      emitBeat(makeBeat("tackle", oppSide, nearestDef.id, null, pos, pos, MATCH_BALANCE.beatDurations.tackle),
        { [nearestDef.id]: pos });
      break;
    }

    if (decision === "carry") {
      const advance = advancedPoint(pos, side, MATCH_BALANCE.carry.advanceDistance);
      emitBeat(makeBeat("carry", side, carrier.id, null, pos, advance, MATCH_BALANCE.beatDurations.carry),
        { [carrier.id]: advance });
      pos = advance; lastActionType = "carry";
      continue;
    }

    const receiver = pickPassTarget(decision, side, fieldAttackers, carrier, positions, pos, defenders, positions, atkSetup);
    if (!receiver) break;
    attackStats.passesAttempted++;
    const targetPos = copyPoint(positions[receiver.id]);
    const chance = resolvePassChance(decision, carrier, pressure,
      nearestDef ? computeDefendingRating(nearestDef) : null, staminaFor(carrier));
    if (Math.random() < chance) {
      attackStats.passesCompleted++;
      touchedIds.add(receiver.id);
      emitBeat(makeBeat("pass", side, carrier.id, null, pos, targetPos,
        MATCH_BALANCE.beatDurations[decision], receiver.id), { [receiver.id]: targetPos });
      positions[carrier.id] = copyPoint(pos);
      assister = carrier; lastActionType = decision;
      carrier = receiver; pos = targetPos;
      continue;
    }
    outcome = "turnover";
    losePass("pass", targetPos, MATCH_BALANCE.beatDurations[decision]);
    break;
  }

  const endState = terminal || { carrierId: carrier.id, ball: copyPoint(pos), releasePoint: copyPoint(pos),
    nextSide: side, restartType: null, isCounter, isHighRecovery };
  endState.positions = snapshot();
  return {
    outcome, scorer, assister: (assister && scorer && assister.id === scorer.id) ? null : assister,
    gk: finalGk, xG: shotXG, leadIn, recoveryLine, foul,
    beats: beats || [], touchedIds: Array.from(touchedIds), attackStats, defenseStats, endState
  };
}

// ----- Nombre de possessions à jouer ce côté-ci cette minute (tempo/rythme du match) -----
function planChainCount(attackPlanKey, earlyPhase, teamStyleKey) {
  let n = 1;
  const extra = (MATCH_BALANCE.tempo.extraChainChance[attackPlanKey] != null) ? MATCH_BALANCE.tempo.extraChainChance[attackPlanKey] : 0.2;
  const tempo = actionTeamStyle({ teamStyle: teamStyleKey }).tempo;
  if (Math.random() < clamp(extra * tempo, 0, 0.65)) n++;
  if (earlyPhase && Math.random() < MATCH_BALANCE.tempo.earlyPhaseExtraChance) n++;
  return n;
}

