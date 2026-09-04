// ===================== CHORÉGRAPHIE ANIMÉE DU MATCH HUMAIN =====================
// Remplace matchphysics.js (plateau physique à tour de rôle, façon Soccer Stars) : le joueur ne
// tire plus lui-même, il regarde le match se dérouler automatiquement — comme une simulation
// Football Manager Mobile. Module pur (pas de DOM, pas de Math.random ici) : app.js possède le
// <canvas> et la boucle requestAnimationFrame, engine.js décide QUI fait QUOI et QUAND (via
// simulateMinute(minute, {withSequence:true}), voir engine.js) sous forme d'une liste ordonnée de
// "beats" ; ce fichier se contente d'interpoler les positions affichées entre ces beats — SAUF
// pour les joueurs non impliqués dans le beat courant, qui suivent un véritable système de
// déplacement collectif continu (voir "DÉPLACEMENT COLLECTIF" plus bas) plutôt que de rester figés
// sur une ancre de formation fixe jusqu'à la prochaine minute.
//
// Convention identique à engine.js/l'ancien matchphysics.js : terrain 0-100 x 0-100, y=0 but
// domicile, y=100 but extérieur.
//
// Un "beat" (voir matchengine-actions.js:simulatePossessionChain, engine.js:attemptRealAttack) :
//   { type, side, playerId, toPlayerId, gkId, from:{x,y}, to:{x,y}, duration, event }
// - type: "pass"|"cross"|"carry"|"dribble"|"tackle"|"interception"|"clear"|"out"|"press"|
//         "shot"|"goal"|"save"|"miss"|"owngoal"|"phase"
//   (pass/cross : le ballon rejoint toPlayerId ; carry/dribble/tackle/interception : le ballon
//   suit playerId, qui vient de le gagner/garder ; clear/out/shot/goal/save/miss/owngoal : ballon
//   libre, le ou les joueurs impliqués restent sur place pendant qu'il file vers `to` ; press :
//   playerId (un défenseur) se déplace seul vers `to` pour presser le porteur, le ballon ne bouge
//   pas — voir matchengine-actions.js:defShadow.)
// - from/to : trajectoire du ballon pendant ce beat (position déjà exprimée dans le repère match),
//   sauf pour "phase"/"press" qui n'affectent jamais le ballon (voir applyBeatFrame).
// - event : l'événement de commentaire existant (même forme que minuteEvents) à restituer à
//   app.js dès que ce beat termine son animation, ou null pour un beat de pur enchaînement.
//
// Aucun Math.random() : à entrées égales (mêmes beats, mêmes ancres/tactiques, même dt), le
// résultat est entièrement déterministe — les tests peuvent donc comparer des valeurs exactes.

const CHOREO_GK_DIVE_MARGIN = 4;   // le gardien plonge un peu au-delà des montants pendant un tir

function choreoEaseInOutQuad(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
function choreoEaseInQuad(t) { return t * t; }
function choreoEaseOutQuad(t) { return 1 - (1 - t) * (1 - t); }
function choreoLerp(a, b, t) { return a + (b - a) * t; }
function choreoClamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function choreoEasingForBeat(type) {
  if (type === "shot" || type === "clear") return choreoEaseOutQuad;   // frappe/dégagement : contact franc, puis le ballon file
  if (type === "goal" || type === "save" || type === "miss" || type === "owngoal") return choreoEaseInQuad; // le ballon accélère vers le but
  return choreoEaseInOutQuad;
}

// ===================== DÉPLACEMENT COLLECTIF (joueurs non impliqués dans le beat courant) =====
// La formation (voir setAnchors) ne fixe qu'une STRUCTURE DE DÉPART ("slot" de base) — jamais une
// coordonnée figée. La position CIBLE réelle de chaque joueur est recalculée à CHAQUE frame
// (computeDynamicTarget) à partir de cette base + où en est le ballon + qui est en possession +
// le rôle temporaire du joueur (assignRoles) + son poste + le plan tactique de son équipe — puis
// rejointe PROGRESSIVEMENT (steerTowards : vitesse maximale, accélération, ralentissement à
// l'arrivée), jamais instantanément. C'est ce qui fait "vivre" tout le monde en permanence, pas
// seulement le porteur/le receveur/le défenseur directement concerné par le beat en cours.
const MOVE = {
  maxSpeedApproach: 15,  // unités terrain/s : rejoindre une position proche (jogging tactique)
  maxSpeedRun: 26,       // unités terrain/s : appel, repli, pressing — mouvement plus franc
  runThreshold: 4,       // au-delà de cette distance à la cible, on considère qu'il "court"
  accel: 70,             // unités/s² : accélération vers la vitesse désirée (jamais un saut de vitesse)
  lateralPullAttack: 0.30, lateralPullDefend: 0.48, lateralPullMax: 16, // coulissement latéral vers le ballon
  depthShift: { GK: 2, DEF: 6, MID: 10, ATT: 14 }, // montée/repli du bloc selon le poste
  depthShiftDefendFactor: { low: 1.3, zone: 1.0, high: 0.6 }, // bloc bas recule plus, pressing haut moins
  supportOffset: 5, wideOffset: 4, coverOffset: 3, compactOffset: 6, // amplitude des ajustements de rôle
  minSeparation: 4.5, separationForce: 0.4 // évite que deux coéquipiers visent le même point
};
const CHOREO_POSSESSION_BEAT_TYPES = ["pass", "cross", "carry", "dribble", "tackle", "interception", "shot"];

function createChoreographer() {
  const players = new Map(); // id -> {id, side, x, y, vx, vy, role, targetX, targetY}
  const ball = { x: 50, y: 50 };
  // Structure de base par camp : { slots: {id: {x,y,pos}} } — voir setAnchors. `pos` (GK/DEF/MID/
  // ATT) pilote l'amplitude de la montée/repli (depthShift) ; absent (anciens appels/tests), une
  // amplitude "MID" neutre s'applique.
  const formations = { home: { slots: {} }, away: { slots: {} } };
  // Tactique par camp — voir setTactics. Valeurs neutres par défaut si jamais appelé (tests unitaires).
  const tactics = { home: { attackPlan: "possession", defensePlan: "zone" }, away: { attackPlan: "possession", defensePlan: "zone" } };
  let ballSide = null; // camp qui a le ballon EN CE MOMENT (pour le coulissement/la montée du bloc)
  let beats = [];
  let beatIndex = 0;
  let beatElapsed = 0;
  const finishedEvents = []; // événements des beats déjà terminés, pas encore consommés par app.js

  // Synchronise le roster affiché avec les ancres de BASE fournies pour la minute en cours (une
  // entrée par camp, ex. {home: {...}, away: {...}} — voir engine.js:getFormationAnchors). Un
  // joueur déjà affiché n'est jamais téléporté (voir applyRosterSide) ; un nouvel entrant apparaît
  // directement sur son ancre.
  function setAnchors(homeAnchors, awayAnchors) {
    applyRosterSide("home", homeAnchors);
    applyRosterSide("away", awayAnchors);
  }

  // Tactique courante de chaque camp (attackPlan/defensePlan — voir data.js:ATTACK_PLANS/
  // DEFENSE_PLANS) : module l'amplitude de la montée/repli du bloc sans ballon (voir MOVE.
  // depthShiftDefendFactor). Optionnel : si jamais appelé, les valeurs neutres par défaut suffisent.
  function setTactics(homeTactics, awayTactics) {
    if (homeTactics) Object.assign(tactics.home, homeTactics);
    if (awayTactics) Object.assign(tactics.away, awayTactics);
  }

  function applyRosterSide(side, sideAnchors) {
    const keepIds = new Set(Object.keys(sideAnchors));
    Array.from(players.keys()).forEach(id => {
      const p = players.get(id);
      if (p.side === side && !keepIds.has(id)) players.delete(id);
    });
    // Un changement de format (escalier de départ, Dé Géant, escalier inversé du Matchball) rebat
    // toute la grille d'ancrage de ce camp (voir matchengine-actions.js:computeOutfieldAnchors) :
    // les joueurs qui restent ne sont PLUS téléportés dessus (comme avant l'introduction du
    // déplacement collectif continu) — ils y courent progressivement, comme n'importe quelle autre
    // transition (steerTowards, borné par MOVE.maxSpeedRun). Seul un nouvel entrant (escalier,
    // remplacement après carton rouge) apparaît directement sur sa position de départ.
    formations[side].slots = {};
    Object.entries(sideAnchors).forEach(([id, slot]) => {
      formations[side].slots[id] = { x: slot.x, y: slot.y, pos: slot.pos || "MID" };
      if (!players.has(id)) {
        players.set(id, { id, side, x: slot.x, y: slot.y, vx: 0, vy: 0, role: "holdShape", targetX: slot.x, targetY: slot.y });
      }
    });
  }

  // Remplace la file de beats à jouer pour la minute à venir (les positions déjà affichées ne
  // sont jamais réinitialisées : tout part de là où les joueurs/le ballon se trouvent déjà).
  function loadSequence(newBeats) {
    beats = Array.isArray(newBeats) ? newBeats : [];
    beatIndex = 0;
    beatElapsed = 0;
  }

  function isSequenceDone() { return beatIndex >= beats.length; }

  // Intercale des beats juste après celui en cours de lecture (Arme Secrète/Penalty du Président
  // activés en cours de match) : le beat en cours finit normalement, puis ces nouveaux beats
  // jouent, puis la lecture reprend le reste de la séquence déjà chargée — jamais de
  // réinitialisation de beatIndex/beatElapsed, donc jamais de saut ni de perte de progression.
  function insertNext(newBeats) {
    if (!newBeats || !newBeats.length) return;
    beats.splice(beatIndex + 1, 0, ...newBeats);
  }

  function currentBeat() { return beats[beatIndex] || null; }

  // Porteur ponctuel du ballon (voir getState) : seuls les beats où le ballon est physiquement
  // "collé" à un joueur en désignent un — en vol (passe/centre) ou hors-jeu (tir, dégagement...),
  // personne ne "porte" le ballon à cet instant précis.
  function getCarrierId(beat) {
    if (!beat) return null;
    return (beat.type === "dribble" || beat.type === "tackle" || beat.type === "carry" || beat.type === "interception") ? beat.playerId : null;
  }

  // Avance l'horloge d'animation de dt secondes (déjà multiplié par la vitesse de lecture côté
  // app.js). Peut traverser plusieurs beats dans un seul appel (vitesse accélérée, ou un beat à
  // durée nulle) — d'où la boucle plutôt qu'un simple if.
  function step(dt) {
    if (dt <= 0) return;
    let remaining = dt;
    let guard = 0;
    while (remaining > 0 && guard < 1000) {
      guard++;
      const beat = currentBeat();
      if (!beat) { updateOffBall(remaining, null); remaining = 0; break; }

      const duration = Math.max(0, beat.duration || 0);
      const timeLeftInBeat = Math.max(0, duration - beatElapsed);
      const consumed = Math.min(remaining, timeLeftInBeat);
      beatElapsed += consumed;
      remaining -= consumed;
      updateOffBall(consumed, beat);
      applyBeatFrame(beat, duration > 0 ? Math.min(1, beatElapsed / duration) : 1);

      if (beatElapsed >= duration) {
        if (beat.event) finishedEvents.push(beat.event);
        beatIndex++;
        beatElapsed = 0;
        // Un beat à durée nulle enchaîne immédiatement sur le suivant dans la même frame plutôt
        // que de laisser `remaining` se perdre sans jamais faire avancer la lecture.
        if (duration <= 0 && remaining <= 0 && beatIndex < beats.length) remaining = 1e-6;
      }
    }
  }

  // Positionne le ballon et les joueurs impliqués dans le beat courant à l'instant t (0-1).
  // Un beat "phase" (annonce d'escalier/carton/blessure...) ne représente aucune action de jeu :
  // le ballon reste exactement où il était plutôt que de sauter vers son from/to (souvent {50,50}
  // par convention pour ces beats), sans quoi chaque annonce le téléportait au centre du terrain.
  function applyBeatFrame(beat, t) {
    if (beat.type === "phase") return;
    // "press" : un défenseur avance vers le porteur pour presser (voir matchengine-actions.js:
    // defShadow) sans qu'aucune action sur le ballon n'ait lieu — lui seul se déplace, le ballon
    // reste exactement où il est (sinon il "sauterait" jusqu'à la position du défenseur).
    if (beat.type === "press") {
      const eased = choreoEasingForBeat(beat.type)(t);
      setPlayerPos(beat.playerId, choreoLerp(beat.from.x, beat.to.x, eased), choreoLerp(beat.from.y, beat.to.y, eased));
      return;
    }
    const eased = choreoEasingForBeat(beat.type)(t);
    ball.x = choreoLerp(beat.from.x, beat.to.x, eased);
    ball.y = choreoLerp(beat.from.y, beat.to.y, eased);

    if (beat.type === "dribble" || beat.type === "tackle" || beat.type === "carry" || beat.type === "interception") {
      // le joueur qui a le ballon (conduite, dribble, ou défenseur qui vient de tacler/intercepter) le suit
      setPlayerPos(beat.playerId, ball.x, ball.y);
    } else if (beat.type === "pass" || beat.type === "cross") {
      // le passeur/centreur reste sur sa position de départ, le receveur avance pour accueillir le ballon
      setPlayerPos(beat.toPlayerId, ball.x, ball.y);
    }
    // clear/out/shot/goal/save/miss/owngoal : le joueur reste sur place (from), seul le ballon avance.

    if (beat.gkId) {
      const diveX = clampToGoalMouth(beat.to.x);
      const gk = players.get(beat.gkId);
      if (gk) setPlayerPos(beat.gkId, diveX, gk.y);
    }
  }

  function clampToGoalMouth(x) {
    return Math.max(41 - CHOREO_GK_DIVE_MARGIN, Math.min(59 + CHOREO_GK_DIVE_MARGIN, x));
  }

  function setPlayerPos(id, x, y) {
    if (!id) return;
    const p = players.get(id);
    if (p) { p.x = x; p.y = y; }
  }

  // ----- Déplacement collectif (voir section "DÉPLACEMENT COLLECTIF" en tête de fichier) -----

  // Met à jour `ballSide` (qui a le ballon EN CE MOMENT) — seuls les beats où le ballon change
  // effectivement de main/de trajectoire comptent comme une possession ; une annonce ("phase"), un
  // ajustement de pressing ("press"), un dégagement/une sortie ("clear"/"out") ou l'issue d'un tir
  // (goal/save/miss/owngoal) ne changent pas QUI attaque — la minute suivante corrigera de toute
  // façon via son premier beat de possession réel.
  function updateBallSide(beat) {
    if (beat && CHOREO_POSSESSION_BEAT_TYPES.includes(beat.type) && beat.side) ballSide = beat.side;
  }

  // Rôle temporaire de chaque joueur actif pour la frame courante, calculé UNE fois par camp (pas
  // par joueur : a besoin de comparer les joueurs entre eux). Le gardien n'est jamais tagué (il
  // suit son propre ajustement minimal, voir computeDynamicTarget) :
  // - équipe qui attaque : le coéquipier le plus proche du porteur propose une solution courte
  //   (shortSupport, triangle de passe) ; les attaquants appellent la profondeur (forwardRunner) ;
  //   les joueurs écartés gardent la largeur (wideSupport) ; le reste assure l'équilibre (restDefense).
  // - équipe qui défend : le joueur le plus proche du ballon presse (primaryPresser, cohérent avec
  //   le beat "press" explicite de matchengine-actions.js) ; les deux suivants couvrent
  //   (coverDefender) ; les joueurs côté opposé se resserrent vers l'axe (farSideCompact) ; le
  //   reste tient sa ligne (holdShape).
  function assignRoles() {
    const roles = new Map();
    const beat = currentBeat();
    const carrierId = getCarrierId(beat);
    ["home", "away"].forEach(side => {
      const slots = formations[side].slots;
      const ids = Object.keys(slots).filter(id => slots[id].pos !== "GK" && players.has(id));
      if (!ids.length) return;
      const possessing = ballSide === side;
      const withDist = ids.map(id => {
        const p = players.get(id);
        return { id, dist: Math.hypot(p.x - ball.x, p.y - ball.y), slot: slots[id] };
      }).sort((a, b) => a.dist - b.dist);

      if (possessing) {
        const rest = withDist.filter(e => e.id !== carrierId);
        rest.slice(0, 1).forEach(e => roles.set(e.id, "shortSupport"));
        rest.slice(1).forEach(e => {
          if (e.slot.pos === "ATT") roles.set(e.id, "forwardRunner");
          else if (e.slot.x < 30 || e.slot.x > 70) roles.set(e.id, "wideSupport");
          else roles.set(e.id, "restDefense");
        });
      } else {
        withDist.slice(0, 1).forEach(e => roles.set(e.id, "primaryPresser"));
        withDist.slice(1, 3).forEach(e => roles.set(e.id, "coverDefender"));
        withDist.slice(3).forEach(e => {
          roles.set(e.id, (e.slot.x < 30 || e.slot.x > 70) ? "farSideCompact" : "holdShape");
        });
      }
    });
    return roles;
  }

  // Décalage additionnel (dx, dy) selon le rôle temporaire — de petites amplitudes bornées
  // (MOVE.supportOffset & consorts) : jamais de quoi produire un déplacement absurde à elles
  // seules, seulement de quoi différencier visiblement le comportement d'un joueur à l'autre.
  function roleAdjustment(role, side, slot) {
    const dirY = side === "home" ? 1 : -1;
    switch (role) {
      case "shortSupport": return { dx: (slot.x < 50 ? 1 : -1) * MOVE.supportOffset * 0.6, dy: -dirY * MOVE.supportOffset };
      case "forwardRunner": return { dx: 0, dy: dirY * MOVE.supportOffset };
      case "wideSupport": return { dx: (slot.x < 50 ? -1 : 1) * MOVE.wideOffset, dy: 0 };
      case "primaryPresser": return { dx: 0, dy: dirY * MOVE.supportOffset * 0.5 };
      case "coverDefender": return { dx: 0, dy: -dirY * MOVE.coverOffset };
      case "farSideCompact": return { dx: (slot.x < 50 ? 1 : -1) * MOVE.compactOffset, dy: 0 };
      default: return { dx: 0, dy: 0 };
    }
  }

  // Position CIBLE (pas la position affichée) d'un joueur non impliqué dans le beat courant :
  // targetPosition = slot de base + coulissement latéral vers le ballon + montée/repli du bloc
  // (selon possession/poste/plan défensif) + ajustement de rôle — chaque terme borné (voir MOVE),
  // le résultat est ensuite recadré dans le terrain.
  function computeDynamicTarget(p, role) {
    const slot = formations[p.side].slots[p.id];
    if (!slot) return { x: p.x, y: p.y };
    const possessing = ballSide === p.side;
    const tac = tactics[p.side] || {};

    const pull = possessing ? MOVE.lateralPullAttack : MOVE.lateralPullDefend;
    const lateral = choreoClamp((ball.x - slot.x) * pull, -MOVE.lateralPullMax, MOVE.lateralPullMax);

    let depth = MOVE.depthShift[slot.pos] || MOVE.depthShift.MID;
    if (!possessing) depth *= (MOVE.depthShiftDefendFactor[tac.defensePlan] != null ? MOVE.depthShiftDefendFactor[tac.defensePlan] : 1);
    const dirY = p.side === "home" ? 1 : -1;
    const depthShift = dirY * (possessing ? depth : -depth);

    const roleAdj = roleAdjustment(role, p.side, slot);
    return {
      x: choreoClamp(slot.x + lateral + roleAdj.dx, 3, 97),
      y: choreoClamp(slot.y + depthShift + roleAdj.dy, 3, 97)
    };
  }

  // Écarte légèrement deux cibles COÉQUIPIÈRES trop proches l'une de l'autre (jamais entre
  // adversaires : un marquage serré est légitime) — agit sur la cible, pas sur la position
  // affichée, pour que le mouvement de séparation reste fluide plutôt qu'un sursaut.
  function applySeparation(targets) {
    const entries = Array.from(targets.entries());
    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        const idA = entries[i][0], a = entries[i][1];
        const idB = entries[j][0], b = entries[j][1];
        const pa = players.get(idA), pb = players.get(idB);
        if (!pa || !pb || pa.side !== pb.side) continue;
        const dx = a.x - b.x, dy = a.y - b.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 0.01 && dist < MOVE.minSeparation) {
          const push = (MOVE.minSeparation - dist) * MOVE.separationForce;
          const nx = dx / dist, ny = dy / dist;
          a.x = choreoClamp(a.x + nx * push, 3, 97); a.y = choreoClamp(a.y + ny * push, 3, 97);
          b.x = choreoClamp(b.x - nx * push, 3, 97); b.y = choreoClamp(b.y - ny * push, 3, 97);
        }
      }
    }
  }

  // Rapproche progressivement `p` de (tx, ty) : vitesse maximale différente selon la distance
  // restante (jogging proche de la cible, course franche au-delà de MOVE.runThreshold),
  // accélération bornée (jamais un saut de vitesse), et jamais de dépassement de la cible en un
  // seul pas — c'est ce qui garantit l'absence de téléportation et de tremblement.
  function steerTowards(p, tx, ty, dt) {
    const dx = tx - p.x, dy = ty - p.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.02) { p.vx = 0; p.vy = 0; p.x = tx; p.y = ty; return; }
    const nearFactor = choreoClamp(dist / MOVE.runThreshold, 0.15, 1);
    const maxSpeed = dist > MOVE.runThreshold ? MOVE.maxSpeedRun : MOVE.maxSpeedApproach * nearFactor;
    const desiredSpeed = Math.min(maxSpeed, dist / Math.max(dt, 1e-3));
    const nx = dx / dist, ny = dy / dist;
    p.vx = approachValue(p.vx || 0, nx * desiredSpeed, MOVE.accel * dt);
    p.vy = approachValue(p.vy || 0, ny * desiredSpeed, MOVE.accel * dt);
    // Garde-fou explicite : vx/vy sont ajustés composante par composante ci-dessus (accélération
    // bornée sur chaque axe séparément) — un changement brusque de direction de la cible (rôle qui
    // bascule, perte de balle...) peut ponctuellement composer une vitesse combinée légèrement
    // au-dessus de MOVE.maxSpeedRun ; on la ramène explicitement dans les clous plutôt que de
    // dépendre uniquement de l'arithmétique par axe.
    const speed = Math.hypot(p.vx, p.vy);
    if (speed > MOVE.maxSpeedRun) { const s = MOVE.maxSpeedRun / speed; p.vx *= s; p.vy *= s; }
    p.x = choreoClamp(p.x + p.vx * dt, 1, 99);
    p.y = choreoClamp(p.y + p.vy * dt, 1, 99);
  }
  function approachValue(current, desired, maxDelta) {
    const diff = desired - current;
    if (Math.abs(diff) <= maxDelta) return desired;
    return current + Math.sign(diff) * maxDelta;
  }

  // Remplace l'ancien rappel exponentiel vers une ancre fixe : chaque joueur NON impliqué dans le
  // beat courant reçoit une cible recalculée à cette frame précise (voir computeDynamicTarget) et
  // s'en rapproche progressivement (steerTowards) — c'est ce qui fait bouger toute l'équipe en
  // permanence, pas seulement le porteur/le receveur/le défenseur du beat en cours.
  // Joueurs directement pilotés par le beat en cours (applyBeatFrame : porteur, receveur,
  // gardien qui plonge) — ils suivent le ballon par construction et peuvent légitimement aller
  // vite (une frappe, un centre...) ; seuls les joueurs HORS de cet ensemble relèvent du
  // déplacement collectif continu (updateOffBall) et de sa vitesse maximale bornée.
  function computeInvolvedIds(beat) {
    const involved = new Set();
    if (beat) {
      if (beat.playerId) involved.add(beat.playerId);
      if (beat.toPlayerId) involved.add(beat.toPlayerId);
      if (beat.gkId) involved.add(beat.gkId);
    }
    return involved;
  }

  function updateOffBall(dt, activeBeat) {
    if (dt <= 0) return;
    updateBallSide(activeBeat || currentBeat());
    const involved = computeInvolvedIds(activeBeat);
    const roles = assignRoles();
    const targets = new Map();
    players.forEach(p => {
      if (involved.has(p.id)) return;
      p.role = roles.get(p.id) || "holdShape";
      targets.set(p.id, computeDynamicTarget(p, p.role));
    });
    applySeparation(targets);
    targets.forEach((target, id) => {
      const p = players.get(id);
      if (!p) return;
      p.targetX = target.x; p.targetY = target.y;
      steerTowards(p, target.x, target.y, dt);
    });
  }

  // Événements des beats terminés depuis le dernier appel (dans l'ordre), pour qu'app.js les
  // pousse au commentaire/mette à jour le score au moment exact où l'action correspondante
  // s'affiche à l'écran — jamais tout balancé d'un coup en début de minute.
  function consumeFinishedEvents() {
    const evts = finishedEvents.splice(0, finishedEvents.length);
    return evts;
  }

  function getState() {
    const beat = currentBeat();
    const ballCarrierId = getCarrierId(beat);
    const involvedIds = Array.from(computeInvolvedIds(beat));
    return {
      players: Array.from(players.values()).map(p => ({
        id: p.id, side: p.side, x: p.x, y: p.y,
        role: p.role, targetX: p.targetX, targetY: p.targetY
      })),
      ball: { x: ball.x, y: ball.y },
      ballCarrierId,
      possessionSide: ballSide,
      // Joueurs pilotés directement par le beat en cours (voir computeInvolvedIds) — exclus du
      // déplacement collectif continu ce tour-ci ; utile pour le mode de débogage visuel (app.js)
      // et pour distinguer, dans les tests, la vitesse du ballon de celle du déplacement collectif.
      involvedIds,
      currentBeat: beat ? { type: beat.type, from: beat.from, to: beat.to } : null
    };
  }

  return {
    setAnchors, setTactics, loadSequence, isSequenceDone, insertNext, step, consumeFinishedEvents, getState
  };
}
