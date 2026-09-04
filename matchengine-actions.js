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
    ratingSpread: 220, pressurePenalty: 0.35, defenderPenaltySpread: 300
  },
  dribble: { base: 0.50, ratingSpread: 140, advanceDistance: 9 },
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
  const { carrier, zone, pressure, attackPlanKey, pos, side, actionsLeft, hasPassOptions } = ctx;
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

  if (actionsLeft <= 1) {
    w.short *= 0.3; w.progressive *= 0.5; w.carry *= 0.4; w.clear *= 1.3;
    if (zone === "final") w.shot *= 1.6;
  }

  if (carrier.pos === "ATT") { w.shot *= 1.3; w.dribble *= 1.15; }
  else if (carrier.pos === "DEF") { w.shot *= 0.25; w.clear *= 1.4; w.short *= 1.2; }
  else if (carrier.pos === "GK") { w.short *= 1.4; w.progressive *= 1.2; w.shot = 0; w.dribble *= 0.2; w.cross = 0; }

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
function resolveDribbleChance(attacker, defender, staminaFactor) {
  const B = MATCH_BALANCE.dribble;
  const atk = computeDribblingRating(attacker) * (staminaFactor || 1);
  const def = defender ? computeDefendingRating(defender) : 40;
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
function pickPassTarget(kind, side, teammates, carrier, atkAnchors, pos) {
  const mates = teammates.filter(p => p.id !== carrier.id && p.pos !== "GK");
  if (!mates.length) return null;
  const scored = mates.map(p => {
    const a = atkAnchors[p.id] || pos;
    const forwardness = side === "home" ? (a.y - pos.y) : (pos.y - a.y);
    const dist = Math.hypot(a.x - pos.x, a.y - pos.y);
    return { p, a, forwardness, dist };
  });
  if (kind === "short") scored.sort((x, y) => x.dist - y.dist);
  else scored.sort((x, y) => y.forwardness - x.forwardness); // progressive/through : privilégie l'option la plus avancée
  const pool = scored.slice(0, Math.min(2, scored.length));
  return pool[Math.floor(Math.random() * pool.length)].p;
}
function pickBoxTarget(teammates, carrier, atkAnchors, side) {
  const goalY = attackingGoalY(side);
  const mates = teammates.filter(p => p.id !== carrier.id && p.pos !== "GK");
  if (!mates.length) return null;
  const scored = mates.map(p => ({ p, a: atkAnchors[p.id] || { x: 50, y: goalY } }));
  scored.sort((x, y) => Math.abs(goalY - x.a.y) - Math.abs(goalY - y.a.y));
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
  return { x: clamp(x, 2, 98), y: nearY };
}
function lerpPoint(a, b, t) { return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }; }

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
//   side, attackers, defenders, gk, atkAnchors, defAnchors,
//   attackPlanKey, attackMod, defenseMod,
//   earlyPhaseBoost, withSequence, staminaFactorFor(playerId) -> multiplicateur de fatigue (0.85-1)
// }
// Renvoie { outcome, scorer, assister, gk, xG, leadIn, recoveryLine, foul, beats, touchedIds,
//           attackStats:{shots,shotsOnTarget,passesAttempted,passesCompleted,clearances,possessionActions},
//           defenseStats:{interceptions,tacklesWon,fouls} }
function simulatePossessionChain(params) {
  const {
    side, attackers, defenders, gk, atkAnchors, defAnchors,
    attackPlanKey, attackMod, defenseMod, earlyPhaseBoost, withSequence,
    staminaFactorFor
  } = params;
  const oppSide = side === "home" ? "away" : "home";
  const beats = withSequence ? [] : null;
  const touchedIds = new Set();
  const attackStats = { shots: 0, shotsOnTarget: 0, passesAttempted: 0, passesCompleted: 0, clearances: 0, possessionActions: 0 };
  const defenseStats = { interceptions: 0, tacklesWon: 0, fouls: 0 };

  const fieldAttackers = attackers.filter(p => p.pos !== "GK");
  if (!fieldAttackers.length) return { outcome: "none", beats: beats || [], attackStats, defenseStats, touchedIds: [], xG: 0 };

  let carrier = pickCarrierWeighted(fieldAttackers);
  touchedIds.add(carrier.id);
  const hasPassOptions = fieldAttackers.length >= 2; // au moins un coéquipier de champ à qui passer
  let pos = Object.assign({}, atkAnchors[carrier.id] || { x: 50, y: side === "home" ? 30 : 70 });
  const startZone = fieldZone(pos, side);
  const isCounter = startZone === "own";
  const recoveryLine = buildRecoveryLine(carrier, pos, startZone);
  let lastActionType = null;
  let assister = null;
  let outcome = "turnover";
  let foul = null; // { severity: "yellow"|"penalty", by: défenseur, against: attaquant } — voir plus bas
  let scorer = null, finalGk = gk || null, shotXG = 0, leadIn = null;

  // Multiplicateur d'efficacité appliqué au porteur pour CHAQUE action (pas seulement le tir) :
  // fatigue individuelle (staminaFactorFor) x niveau/tactique/avantage du terrain de son équipe
  // (attackMod, voir engine.js:simulateMinute) — sans ça, `attackMod` ne pesait que sur l'xG et le
  // niveau d'une équipe n'avait presque aucun effet sur la tenue de balle ou les dribbles.
  const staminaFor = (p) => (staminaFactorFor ? staminaFactorFor(p.id) : 1) * (attackMod || 1);

  // Position "engagée" de chaque défenseur pendant CETTE possession (voir plus bas) : un défenseur
  // qui presse le porteur avance réellement vers lui, action après action, au lieu de rester figé
  // sur son ancre de formation jusqu'au tacle/à l'interception — il s'y replace ensuite normalement
  // entre deux possessions (lissage habituel de matchchoreo.js vers l'ancre "sans balle").
  const defShadow = {};
  function shadowPos(defender) { return defShadow[defender.id] || defAnchors[defender.id] || { x: 50, y: 50 }; }

  let actionsLeft = MATCH_BALANCE.chain.maxActions;
  while (actionsLeft-- > 0) {
    attackStats.possessionActions++;
    const effectiveDefPos = Object.keys(defShadow).length ? Object.assign({}, defAnchors, defShadow) : defAnchors;
    const { defender: nearestDef, distance } = nearestDefenderInfo(pos, defenders, effectiveDefPos);
    const pressure = clamp(computePressure(distance) * (defenseMod || 1), 0, 1);
    const zone = fieldZone(pos, side);

    // Le défenseur le plus proche avance concrètement vers le porteur dès qu'il est à portée de
    // pressing (voir MATCH_BALANCE.pressing) — la distance ainsi réduite alimente directement la
    // pression ressentie ci-dessus à la PROCHAINE action, cohérent aussi bien pour le match IA
    // instantané que pour l'animation (les beats "press" ne sont émis que si withSequence).
    if (nearestDef) {
      const P = MATCH_BALANCE.pressing;
      if (pressure > P.engageThreshold) {
        const engaged = shadowPos(nearestDef);
        const stepTarget = lerpPoint(engaged, pos, P.stepFraction);
        if (Math.hypot(stepTarget.x - engaged.x, stepTarget.y - engaged.y) > P.minStepDistance) {
          if (beats) beats.push(makeBeat("press", oppSide, nearestDef.id, null, engaged, stepTarget, MATCH_BALANCE.beatDurations.press));
          defShadow[nearestDef.id] = stepTarget;
        }
      }
    }

    const decision = chooseActionType({ carrier, zone, pressure, attackPlanKey, pos, side, actionsLeft, hasPassOptions });

    if (decision === "shot") {
      attackStats.shots++;
      const faceToFace = (lastActionType === "through") && pressure < 0.3;
      const numericSuperiority = fieldAttackers.length > defenders.length;
      let xg = computeShotXG({
        pos, side, pressure, assistType: lastActionType, isCounter, isHighRecovery: isCounter,
        numericSuperiority, faceToFace,
        shooterQuality: computeFinishingRating(carrier) * staminaFor(carrier),
        gkQuality: finalGk ? computeGoalkeepingRating(finalGk) : 55
      });
      xg = clamp(xg * (earlyPhaseBoost || 1), 0.01, 0.95);
      shotXG = xg;
      const res = resolveShotOutcome(xg, computeFinishingRating(carrier) * staminaFor(carrier), finalGk ? computeGoalkeepingRating(finalGk) : 55, pressure);
      const shotFrom = Object.assign({}, pos);
      const onTarget = res !== "miss";
      const target = pickShotTarget(side, onTarget);
      if (beats) beats.push(makeBeat("shot", side, carrier.id, finalGk ? finalGk.id : null, shotFrom, target, MATCH_BALANCE.beatDurations.shot));
      scorer = carrier;
      if (res === "goal") {
        attackStats.shotsOnTarget++;
        outcome = "goal";
        leadIn = buildLeadIn(lastActionType, assister, scorer);
        if (beats) beats.push(makeBeat("goal", side, carrier.id, finalGk ? finalGk.id : null, target, { x: target.x, y: attackingGoalY(side) }, MATCH_BALANCE.beatDurations.outcome));
      } else if (res === "save") {
        attackStats.shotsOnTarget++;
        outcome = "save";
        leadIn = buildLeadIn(lastActionType, assister, scorer);
        if (beats) beats.push(makeBeat("save", side, carrier.id, finalGk ? finalGk.id : null, target, target, MATCH_BALANCE.beatDurations.outcome));
      } else {
        outcome = "miss";
        leadIn = buildLeadIn(lastActionType, assister, scorer);
        if (beats) beats.push(makeBeat("miss", side, carrier.id, finalGk ? finalGk.id : null, target, target, MATCH_BALANCE.beatDurations.outcome));
      }
      break;
    }

    if (decision === "clear") {
      attackStats.clearances++;
      outcome = "clearance";
      const target = clearTarget(pos, side);
      if (beats) beats.push(makeBeat("clear", side, carrier.id, null, pos, target, MATCH_BALANCE.beatDurations.clear));
      break;
    }

    if (decision === "cross") {
      const boxTarget = pickBoxTarget(fieldAttackers, carrier, atkAnchors, side);
      if (!boxTarget) { outcome = "turnover"; break; }
      attackStats.passesAttempted++;
      const chance = resolvePassChance("cross", carrier, pressure, nearestDef ? computeDefendingRating(nearestDef) : null, staminaFor(carrier));
      if (Math.random() < chance) {
        attackStats.passesCompleted++;
        touchedIds.add(boxTarget.p.id);
        if (beats) beats.push(makeBeat("cross", side, carrier.id, null, pos, boxTarget.a, MATCH_BALANCE.beatDurations.cross, boxTarget.p.id));
        assister = carrier; lastActionType = "cross";
        carrier = boxTarget.p; pos = Object.assign({}, boxTarget.a);
        continue;
      }
      outcome = "turnover";
      const target = boxTarget ? boxTarget.a : advancedPoint(pos, side, 10);
      const cutPoint = lerpPoint(pos, target, 0.7);
      if (nearestDef) { defenseStats.interceptions++; touchedIds.add(nearestDef.id); }
      if (beats) {
        beats.push(makeBeat("cross", side, carrier.id, null, pos, cutPoint, MATCH_BALANCE.beatDurations.cross * 0.7));
        beats.push(makeBeat(nearestDef ? "interception" : "out", oppSide, nearestDef ? nearestDef.id : null, null, cutPoint, nearestDef ? shadowPos(nearestDef) : cutPoint, MATCH_BALANCE.beatDurations.interception));
      }
      break;
    }

    if (decision === "dribble") {
      const chance = resolveDribbleChance(carrier, nearestDef, staminaFor(carrier));
      const advance = advancedPoint(pos, side, MATCH_BALANCE.dribble.advanceDistance);
      if (Math.random() < chance) {
        if (beats) beats.push(makeBeat("dribble", side, carrier.id, null, pos, advance, MATCH_BALANCE.beatDurations.dribble));
        pos = advance; lastActionType = "dribble";
        continue;
      }
      if (nearestDef) touchedIds.add(nearestDef.id);
      const tacklePos = nearestDef ? shadowPos(nearestDef) : advance;
      // Un tacle raté par le dribbleur peut être une vraie FAUTE plutôt qu'un tacle propre —
      // d'autant plus probable que le défenseur est nettement dominé (voir computeFoulChance).
      // Dans la surface, la faute devient un penalty pour l'attaque (résolu par engine.js via
      // performPenaltyAttempt, comme le penalty aléatoire existant) ; ailleurs, un carton jaune.
      if (nearestDef && Math.random() < computeFoulChance(nearestDef, carrier, pressure)) {
        defenseStats.fouls++;
        outcome = "foul";
        foul = { severity: isInPenaltyBox(pos, side) ? "penalty" : "yellow", by: nearestDef, against: carrier };
      } else {
        outcome = "turnover";
        defenseStats.tacklesWon++;
      }
      if (beats) beats.push(makeBeat("tackle", oppSide, nearestDef ? nearestDef.id : null, null, pos, tacklePos, MATCH_BALANCE.beatDurations.tackle));
      break;
    }

    if (decision === "carry") {
      const advance = advancedPoint(pos, side, MATCH_BALANCE.carry.advanceDistance);
      if (beats) beats.push(makeBeat("carry", side, carrier.id, null, pos, advance, MATCH_BALANCE.beatDurations.carry));
      pos = advance; lastActionType = "carry";
      continue;
    }

    // passes (short / progressive / through)
    const receiver = pickPassTarget(decision, side, fieldAttackers, carrier, atkAnchors, pos);
    if (!receiver) { outcome = "turnover"; break; }
    attackStats.passesAttempted++;
    const targetPos = atkAnchors[receiver.id] || pos;
    const chance = resolvePassChance(decision, carrier, pressure, nearestDef ? computeDefendingRating(nearestDef) : null, staminaFor(carrier));
    if (Math.random() < chance) {
      attackStats.passesCompleted++;
      touchedIds.add(receiver.id);
      if (beats) beats.push(makeBeat("pass", side, carrier.id, null, pos, targetPos, MATCH_BALANCE.beatDurations[decision], receiver.id));
      assister = carrier; lastActionType = decision;
      carrier = receiver; pos = Object.assign({}, targetPos);
      continue;
    }
    outcome = "turnover";
    const cutPoint = lerpPoint(pos, targetPos, 0.65);
    if (nearestDef) { defenseStats.interceptions++; touchedIds.add(nearestDef.id); }
    if (beats) {
      beats.push(makeBeat("pass", side, carrier.id, null, pos, cutPoint, MATCH_BALANCE.beatDurations[decision] * 0.7));
      beats.push(makeBeat(nearestDef ? "interception" : "out", oppSide, nearestDef ? nearestDef.id : null, null, cutPoint, nearestDef ? shadowPos(nearestDef) : cutPoint, MATCH_BALANCE.beatDurations.interception));
    }
    break;
  }

  return {
    outcome, scorer, assister: (assister && scorer && assister.id === scorer.id) ? null : assister,
    gk: finalGk, xG: shotXG, leadIn, recoveryLine, foul,
    beats: beats || [], touchedIds: Array.from(touchedIds),
    attackStats, defenseStats
  };
}

// ----- Nombre de possessions à jouer ce côté-ci cette minute (tempo/rythme du match) -----
function planChainCount(attackPlanKey, earlyPhase) {
  let n = 1;
  const extra = (MATCH_BALANCE.tempo.extraChainChance[attackPlanKey] != null) ? MATCH_BALANCE.tempo.extraChainChance[attackPlanKey] : 0.2;
  if (Math.random() < extra) n++;
  if (earlyPhase && Math.random() < MATCH_BALANCE.tempo.earlyPhaseExtraChance) n++;
  return n;
}
