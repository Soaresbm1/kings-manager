// ===================== CHORÉGRAPHIE ANIMÉE DU MATCH HUMAIN =====================
// Remplace matchphysics.js (plateau physique à tour de rôle, façon Soccer Stars) : le joueur ne
// tire plus lui-même, il regarde le match se dérouler automatiquement — comme une simulation
// Football Manager Mobile. Module pur (pas de DOM, pas de Math.random ici) : app.js possède le
// <canvas> et la boucle requestAnimationFrame, engine.js décide QUI fait QUOI et QUAND (via
// simulateMinute(minute, {withSequence:true}), voir engine.js) sous forme d'une liste ordonnée de
// "beats" ; ce fichier se contente d'interpoler les positions affichées entre ces beats.
//
// Convention identique à engine.js/l'ancien matchphysics.js : terrain 0-100 x 0-100, y=0 but
// domicile, y=100 but extérieur.
//
// Un "beat" (voir engine.js:buildPossessionBeats et consorts) :
//   { type, side, playerId, toPlayerId, gkId, mark, from:{x,y}, to:{x,y}, duration, event }
// - type: "pass"|"dribble"|"tackle"|"shot"|"goal"|"save"|"miss"|"owngoal"|"phase"
// - from/to : trajectoire du ballon pendant ce beat (position déjà exprimée dans le repère match).
// - mark (optionnel, beats "dribble") : { id, from:{x,y}, to:{x,y} } — mouvement secondaire d'UN
//   défenseur qui prend en chasse le porteur de balle pendant son slalom, interpolé avec le même
//   easing que le beat principal mais indépendamment du ballon/porteur.
// - event : l'événement de commentaire existant (même forme que minuteEvents) à restituer à
//   app.js dès que ce beat termine son animation, ou null pour un beat de pur enchaînement.
//
// Aucun Math.random() : une fois les beats et les ancres fixés, l'interpolation est entièrement
// déterministe — les tests peuvent donc comparer des valeurs exactes (comme l'ancien
// matchphysics.js le faisait pour sa physique).

const CHOREO_IDLE_EASE_RATE = 2.6; // vitesse de rappel des joueurs non impliqués vers leur ancre
const CHOREO_GK_DIVE_MARGIN = 4;   // le gardien plonge un peu au-delà des montants pendant un tir

function choreoEaseInOutQuad(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
function choreoEaseInQuad(t) { return t * t; }
function choreoEaseOutQuad(t) { return 1 - (1 - t) * (1 - t); }
function choreoLerp(a, b, t) { return a + (b - a) * t; }
function choreoEasingForBeat(type) {
  if (type === "shot") return choreoEaseOutQuad;   // le tireur ralentit sa course avant de frapper
  if (type === "goal" || type === "save" || type === "miss" || type === "owngoal") return choreoEaseInQuad; // le ballon accélère vers le but
  return choreoEaseInOutQuad;
}

function createChoreographer() {
  const players = new Map(); // id -> {id, side, x, y}
  const ball = { x: 50, y: 50 };
  let anchors = {}; // id -> {x,y}, ancre de formation courante (les deux camps confondus)
  let beats = [];
  let beatIndex = 0;
  let beatElapsed = 0;
  const finishedEvents = []; // événements des beats déjà terminés, pas encore consommés par app.js

  // Synchronise le roster affiché avec les ancres fournies pour la minute en cours (une entrée
  // par camp, ex. {home: {...}, away: {...}} — voir engine.js:getFormationAnchors). Un joueur déjà
  // affiché n'est jamais téléporté (voir applyRoster) ; un nouvel entrant apparaît à son ancre.
  function setAnchors(homeAnchors, awayAnchors) {
    anchors = {};
    applyRosterSide("home", homeAnchors);
    applyRosterSide("away", awayAnchors);
  }

  function applyRosterSide(side, sideAnchors) {
    const keepIds = new Set(Object.keys(sideAnchors));
    Array.from(players.keys()).forEach(id => {
      const p = players.get(id);
      if (p.side === side && !keepIds.has(id)) players.delete(id);
    });
    Object.entries(sideAnchors).forEach(([id, pos]) => {
      anchors[id] = pos;
      if (!players.has(id)) players.set(id, { id, side, x: pos.x, y: pos.y });
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
      if (!beat) { easeIdle(remaining); remaining = 0; break; }

      const duration = Math.max(0, beat.duration || 0);
      const timeLeftInBeat = Math.max(0, duration - beatElapsed);
      const consumed = Math.min(remaining, timeLeftInBeat);
      beatElapsed += consumed;
      remaining -= consumed;
      easeIdle(consumed, beat);
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
    const eased = choreoEasingForBeat(beat.type)(t);
    ball.x = choreoLerp(beat.from.x, beat.to.x, eased);
    ball.y = choreoLerp(beat.from.y, beat.to.y, eased);

    if (beat.type === "dribble" || beat.type === "tackle") {
      setPlayerPos(beat.playerId, ball.x, ball.y);
    } else if (beat.type === "pass") {
      // le passeur reste sur sa position de départ, le receveur avance pour accueillir le ballon
      setPlayerPos(beat.toPlayerId, ball.x, ball.y);
    }
    // shot/goal/save/miss/owngoal : le tireur reste sur place (from), seul le ballon avance.

    if (beat.gkId) {
      const diveX = clampToGoalMouth(beat.to.x);
      const gk = players.get(beat.gkId);
      if (gk) setPlayerPos(beat.gkId, diveX, gk.y);
    }

    // Mouvement secondaire optionnel (voir engine.js:buildPossessionBeats) : un défenseur précis
    // qui prend en chasse le porteur de balle pendant un beat "dribble", indépendamment du
    // joueur/ballon principal du beat — sans ça, le défenseur resterait figé pendant tout le
    // slalom au lieu de visiblement essayer de revenir sur le porteur.
    if (beat.mark && beat.mark.id) {
      const mx = choreoLerp(beat.mark.from.x, beat.mark.to.x, eased);
      const my = choreoLerp(beat.mark.from.y, beat.mark.to.y, eased);
      setPlayerPos(beat.mark.id, mx, my);
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

  // Rappelle en douceur (lissage exponentiel, pas un lerp figé) tout joueur non impliqué dans le
  // beat courant vers son ancre de formation — les joueurs ne sont donc jamais figés pendant
  // qu'une action se déroule ailleurs sur le terrain.
  function easeIdle(dt, activeBeat) {
    if (dt <= 0) return;
    const involved = new Set();
    if (activeBeat) {
      if (activeBeat.playerId) involved.add(activeBeat.playerId);
      if (activeBeat.toPlayerId) involved.add(activeBeat.toPlayerId);
      if (activeBeat.gkId) involved.add(activeBeat.gkId);
      if (activeBeat.mark && activeBeat.mark.id) involved.add(activeBeat.mark.id);
    }
    const factor = 1 - Math.exp(-CHOREO_IDLE_EASE_RATE * dt);
    players.forEach(p => {
      if (involved.has(p.id)) return;
      const anchor = anchors[p.id];
      if (!anchor) return;
      p.x = choreoLerp(p.x, anchor.x, factor);
      p.y = choreoLerp(p.y, anchor.y, factor);
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
    const ballCarrierId = beat && (beat.type === "dribble" || beat.type === "tackle")
      ? beat.playerId
      : null;
    return {
      players: Array.from(players.values()).map(p => ({ id: p.id, side: p.side, x: p.x, y: p.y })),
      ball: { x: ball.x, y: ball.y },
      ballCarrierId
    };
  }

  return {
    setAnchors, loadSequence, isSequenceDone, insertNext, step, consumeFinishedEvents, getState
  };
}
