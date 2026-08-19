// ===================== PLATEAU PHYSIQUE PERSISTANT (match humain, façon Soccer Stars) =====================
// Remplace matchshoot.js (mini-jeu de tir limité aux occasions) et matchvisual.js (visualisation
// passive par "steering") : le match humain entier se joue désormais sur UN SEUL plateau physique
// persistant, du coup d'envoi à la fin, avec alternance stricte de tours entre le joueur et l'IA
// (voir app.js:chooseAiTurn/la boucle de tours). Moteur pur (pas de DOM) — app.js possède le
// <canvas>, les événements pointer et la boucle de rendu.
//
// Convention (héritée de l'ancien matchvisual.js) : HOME défend en HAUT (y=0), AWAY défend en BAS
// (y=100). Terrain carré 0–100 × 0–100 (aspect-ratio fixe côté CSS, indispensable pour des
// collisions cercle-cercle correctes — un terrain non carré déformerait les distances).

const PITCH_W = 100;
const PITCH_H = 100;
const GOAL_X_MIN = 41;
const GOAL_X_MAX = 59;
const MAX_SHOT_SPEED = 120;       // vitesse max d'un flick (unités/s)
const SETTLE_EPS = 0.6;           // vitesse en-dessous de laquelle une entité est "immobile"
const SUBSTEPS = 4;
const DISC_FRICTION_PER_SEC = 0.42;
const BALL_FRICTION_PER_SEC = 0.58;
const RESTITUTION = 0.82;         // collisions disque-disque / disque-ballon
const WALL_RESTITUTION = 0.55;    // rebond sur les bords/lignes de but hors cadre
const GK_SAVE_ZONE_Y = 12;        // distance à sa propre ligne sous laquelle un contact gardien-ballon est un "arrêt"
const MAX_TURN_ELAPSED = 4;        // secondes : garde-fou si la physique ne se stabilise jamais naturellement (contact prolongé/jitter) — un tir normal (avec rebonds) se stabilise bien avant, mais un tir à pleine vitesse sans aucun contact peut légitimement prendre 2-3s par pure friction

// --- Helpers génériques (migrés de l'ancien matchvisual.js, toujours utiles ici) ---
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

// Répartit n joueurs de champ (1 à 6) en lignes def→att, indépendamment des FORMATION_SLOTS
// figés de l'onglet Tactique (ceux-ci supposent toujours 6 joueurs de champ).
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

// Convertit un ancrage (x, depth 0-1) + le côté en position y réelle, pour une formation de
// coup d'envoi/remise en jeu. Reste STRICTEMENT dans sa propre moitié de terrain (jamais au-delà
// de la ligne médiane, même pour le joueur le plus avancé) : évite qu'un disque n'apparaisse dans
// le camp adverse à l'entrée en jeu (escalier) ou après une remise en jeu suite à un but. Laisse
// aussi une marge d'au moins 6 unités avec le centre (y=50, où le ballon apparaît) : la somme des
// rayons disque+ballon avoisine 5 unités, donc sans cette marge un joueur très avancé pouvait
// apparaître en chevauchement direct avec le ballon au coup d'envoi.
function anchorToY(depth, side) {
  if (side === "home") return clamp(8 + depth * 36, 4, 44);
  return clamp(92 - depth * 36, 56, 96);
}
function gkAnchorY(side) { return side === "home" ? 5 : 95; }

function clampSpeed(vx, vy, max) {
  const speed = Math.sqrt(vx * vx + vy * vy);
  if (speed <= max || speed === 0) return { vx, vy };
  const k = max / speed;
  return { vx: vx * k, vy: vy * k };
}

function applyFriction(entity, factor) {
  entity.vx *= factor; entity.vy *= factor;
  if (Math.abs(entity.vx) < 0.02) entity.vx = 0;
  if (Math.abs(entity.vy) < 0.02) entity.vy = 0;
}

// Collision cercle-cercle élastique (positions + échange d'impulsion) entre deux entités
// {x,y,vx,vy,r,mass}. Renvoie true si une collision a bien eu lieu.
function resolveCollision(a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const minDist = a.r + b.r;
  if (dist >= minDist || dist <= 0.0001) return false;

  const nx = dx / dist, ny = dy / dist;
  const overlap = minDist - dist;
  const totalMass = a.mass + b.mass;
  a.x -= nx * overlap * (b.mass / totalMass);
  a.y -= ny * overlap * (b.mass / totalMass);
  b.x += nx * overlap * (a.mass / totalMass);
  b.y += ny * overlap * (a.mass / totalMass);

  const rvx = b.vx - a.vx, rvy = b.vy - a.vy;
  const velAlongNormal = rvx * nx + rvy * ny;
  if (velAlongNormal > 0) return true; // déjà en train de s'écarter

  const j = -(1 + RESTITUTION) * velAlongNormal / (1 / a.mass + 1 / b.mass);
  const ix = j * nx, iy = j * ny;
  a.vx -= ix / a.mass; a.vy -= iy / a.mass;
  b.vx += ix / b.mass; b.vy += iy / b.mass;
  return true;
}

// Rebond amorti sur les 4 bords du terrain (utilisé pour les disques ; le ballon a sa propre
// logique dans step() car les lignes de but haut/bas ont une ouverture — la cage).
function bounceWalls(entity) {
  if (entity.x - entity.r < 0) { entity.x = entity.r; entity.vx = Math.abs(entity.vx) * WALL_RESTITUTION; }
  else if (entity.x + entity.r > PITCH_W) { entity.x = PITCH_W - entity.r; entity.vx = -Math.abs(entity.vx) * WALL_RESTITUTION; }
  if (entity.y - entity.r < 0) { entity.y = entity.r; entity.vy = Math.abs(entity.vy) * WALL_RESTITUTION; }
  else if (entity.y + entity.r > PITCH_H) { entity.y = PITCH_H - entity.r; entity.vy = -Math.abs(entity.vy) * WALL_RESTITUTION; }
}

function createTurnMatch() {
  const discs = new Map(); // id -> {id, side, isGK, x,y,vx,vy,r,mass}
  const ball = { x: 50, y: 50, vx: 0, vy: 0, r: 1.8, mass: 0.4, lastToucherId: null, lastToucherSide: null };
  let touchHistory = []; // [{id, side}], réinitialisé à chaque coup d'envoi/remise en jeu
  let pendingGoalOutcome = null; // gèle step() jusqu'à consumeTurnOutcome()
  let saveFlavorThisTurn = null; // pur commentaire, ne gèle rien
  let turnElapsed = 0; // secondes écoulées depuis le dernier shoot() — garde-fou anti-blocage

  function createDisc(id, side, isGK, pos) {
    return { id, side, isGK, x: pos.x, y: pos.y, vx: 0, vy: 0, r: isGK ? 3.6 : 3.2, mass: isGK ? 1.6 : 1 };
  }

  function anchorFor(outfieldIds, index, side) {
    const anchors = computeOutfieldAnchors(outfieldIds.length);
    const a = anchors[index] || { x: 50, depth: 0.5 };
    return { x: a.x, y: anchorToY(a.depth, side) };
  }

  // Crée/retire les disques pour coller à la composition active (escalier, Dé Géant, Matchball) :
  // seuls les NOUVEAUX joueurs sont positionnés (à l'ancre la plus avancée disponible, cohérent
  // avec "un nouveau joueur entre sur le terrain") — les disques déjà en jeu ne sont jamais
  // téléportés en cours de partie.
  function applySideLineup(side, outfieldIds, gkId) {
    const keepIds = new Set(outfieldIds);
    if (gkId) keepIds.add(gkId);
    Array.from(discs.values()).forEach(d => {
      if (d.side === side && !keepIds.has(d.id)) discs.delete(d.id);
    });
    outfieldIds.forEach((id, idx) => {
      if (!discs.has(id)) discs.set(id, createDisc(id, side, false, anchorFor(outfieldIds, idx, side)));
    });
    if (gkId && !discs.has(gkId)) {
      discs.set(gkId, createDisc(gkId, side, true, { x: 50, y: gkAnchorY(side) }));
    }
  }

  function setActiveLineups(homeOutfieldIds, homeGkId, awayOutfieldIds, awayGkId) {
    applySideLineup("home", homeOutfieldIds, homeGkId);
    applySideLineup("away", awayOutfieldIds, awayGkId);
  }

  // Remise en jeu après un but : ballon au centre, chaque camp reprend sa formation de coup
  // d'envoi (même disques qu'avant le but, juste repositionnés).
  function resetForKickoff() {
    ball.x = 50; ball.y = 50; ball.vx = 0; ball.vy = 0;
    ball.lastToucherId = null; ball.lastToucherSide = null;
    touchHistory = [];
    ["home", "away"].forEach(side => {
      const outfield = Array.from(discs.values()).filter(d => d.side === side && !d.isGK);
      const anchors = computeOutfieldAnchors(outfield.length);
      outfield.forEach((d, idx) => {
        const a = anchors[idx] || { x: 50, depth: 0.5 };
        d.x = a.x; d.y = anchorToY(a.depth, side);
        d.vx = 0; d.vy = 0;
      });
      const gk = Array.from(discs.values()).find(d => d.side === side && d.isGK);
      if (gk) { gk.x = 50; gk.y = gkAnchorY(side); gk.vx = 0; gk.vy = 0; }
    });
  }

  function isSettled() {
    // Dès qu'un but est détecté, step() se fige immédiatement (voir plus bas) — le ballon/les
    // disques peuvent donc encore avoir de la vitesse à cet instant précis. Sans ce court-circuit,
    // isSettled() ne redeviendrait jamais vrai (plus aucune friction appliquée) et bloquerait la
    // partie : plus personne ne pourrait jamais jouer un tour.
    if (pendingGoalOutcome) return true;
    const slow = e => (e.vx * e.vx + e.vy * e.vy) < SETTLE_EPS * SETTLE_EPS;
    if (!slow(ball)) return false;
    for (const d of discs.values()) if (!slow(d)) return false;
    return true;
  }

  function shoot(discId, vx, vy) {
    if (pendingGoalOutcome) return false;
    if (!isSettled()) return false;
    const disc = discs.get(discId);
    if (!disc) return false;
    const v = clampSpeed(vx, vy, MAX_SHOT_SPEED);
    disc.vx = v.vx; disc.vy = v.vy;
    turnElapsed = 0;
    return true;
  }

  // Ligne de but franchie dans l'axe des poteaux : détermine but normal / contre son camp à
  // partir du dernier disque à avoir touché le ballon, et l'éventuelle passe décisive (touche
  // précédente du même camp).
  function setPendingGoal(concedingSide) {
    const scoringSide = concedingSide === "home" ? "away" : "home";
    const isOwnGoal = ball.lastToucherSide === concedingSide;
    let assisterId = null;
    if (!isOwnGoal && touchHistory.length >= 2) {
      const prev = touchHistory[touchHistory.length - 2];
      if (prev.side === scoringSide && prev.id !== ball.lastToucherId) assisterId = prev.id;
    }
    pendingGoalOutcome = {
      type: isOwnGoal ? "owngoal" : "goal",
      concedingSide, scoringSide,
      scorerId: ball.lastToucherId,
      assisterId
    };
  }

  function step(dt) {
    if (pendingGoalOutcome || dt <= 0) return;
    turnElapsed += dt;
    if (turnElapsed > MAX_TURN_ELAPSED) {
      // La physique n'est jamais parvenue à se stabiliser naturellement (contact prolongé,
      // micro-rebonds...) : on force l'arrêt pour ne jamais bloquer la partie.
      discs.forEach(d => { d.vx = 0; d.vy = 0; });
      ball.vx = 0; ball.vy = 0;
      return;
    }
    const h = dt / SUBSTEPS;
    for (let s = 0; s < SUBSTEPS && !pendingGoalOutcome; s++) {
      discs.forEach(d => {
        applyFriction(d, Math.pow(DISC_FRICTION_PER_SEC, h));
        d.x += d.vx * h; d.y += d.vy * h;
        bounceWalls(d);
      });

      applyFriction(ball, Math.pow(BALL_FRICTION_PER_SEC, h));
      ball.x += ball.vx * h; ball.y += ball.vy * h;

      const discList = Array.from(discs.values());
      for (let i = 0; i < discList.length; i++) {
        for (let j = i + 1; j < discList.length; j++) resolveCollision(discList[i], discList[j]);
      }
      discList.forEach(d => {
        const touched = resolveCollision(d, ball);
        if (!touched) return;
        ball.lastToucherId = d.id;
        ball.lastToucherSide = d.side;
        if (touchHistory.length === 0 || touchHistory[touchHistory.length - 1].id !== d.id) {
          touchHistory.push({ id: d.id, side: d.side });
        }
        if (d.isGK && !saveFlavorThisTurn) {
          const nearOwnLine = d.side === "home" ? ball.y < GK_SAVE_ZONE_Y : ball.y > PITCH_H - GK_SAVE_ZONE_Y;
          if (nearOwnLine) {
            const attackingSide = d.side === "home" ? "away" : "home";
            const takerTouch = [...touchHistory].reverse().find(t => t.side === attackingSide);
            if (takerTouch) saveFlavorThisTurn = { side: attackingSide, takerId: takerTouch.id, gkId: d.id };
          }
        }
      });
      if (pendingGoalOutcome) break;

      // Lignes de but (haut = cage domicile, bas = cage extérieur) : ouverture dans l'axe des
      // poteaux, rebond amorti ailleurs (comme une rambarde).
      if (ball.y - ball.r < 0) {
        if (ball.x > GOAL_X_MIN && ball.x < GOAL_X_MAX) setPendingGoal("home");
        else { ball.y = ball.r; ball.vy = Math.abs(ball.vy) * WALL_RESTITUTION; }
      } else if (ball.y + ball.r > PITCH_H) {
        if (ball.x > GOAL_X_MIN && ball.x < GOAL_X_MAX) setPendingGoal("away");
        else { ball.y = PITCH_H - ball.r; ball.vy = -Math.abs(ball.vy) * WALL_RESTITUTION; }
      }
      if (ball.x - ball.r < 0) { ball.x = ball.r; ball.vx = Math.abs(ball.vx) * WALL_RESTITUTION; }
      else if (ball.x + ball.r > PITCH_W) { ball.x = PITCH_W - ball.r; ball.vx = -Math.abs(ball.vx) * WALL_RESTITUTION; }
    }
  }

  // À appeler une fois le plateau à l'arrêt (isSettled()) après un tir : renvoie null (rien de
  // spécial, tour terminé normalement), un but/csc (et remet le plateau en formation de coup
  // d'envoi), ou un arrêt du gardien (flavor pur, ne modifie rien).
  function consumeTurnOutcome() {
    if (pendingGoalOutcome) {
      const outcome = pendingGoalOutcome;
      pendingGoalOutcome = null;
      resetForKickoff();
      return outcome;
    }
    if (saveFlavorThisTurn) {
      const s = saveFlavorThisTurn;
      saveFlavorThisTurn = null;
      return { type: "save", side: s.side, takerId: s.takerId, gkId: s.gkId };
    }
    return null;
  }

  function getState() {
    return {
      discs: Array.from(discs.values()).map(d => ({ id: d.id, side: d.side, isGK: d.isGK, x: d.x, y: d.y, r: d.r })),
      ball: { x: ball.x, y: ball.y, r: ball.r }
    };
  }

  // Filet de sécurité ultime, appelable depuis app.js : force l'arrêt complet de tout le monde
  // (sans repositionner ni geler pendingGoalOutcome) pour garantir qu'isSettled() redevienne
  // vrai, si un tir retente sans jamais y parvenir seul.
  function forceSettle() {
    ball.vx = 0; ball.vy = 0;
    discs.forEach(d => { d.vx = 0; d.vy = 0; });
    turnElapsed = 0;
  }

  return {
    pitchW: PITCH_W, pitchH: PITCH_H, goalXMin: GOAL_X_MIN, goalXMax: GOAL_X_MAX,
    setActiveLineups, step, shoot, isSettled, forceSettle,
    consumeTurnOutcome,
    // Replace tous les disques actifs en formation de coup d'envoi (ballon au centre) — appelé à
    // chaque changement de phase (escalier, Ballon Spécial, Dé Géant, Matchball, reprise de la
    // mi-temps), pas seulement après un but.
    resetFormation: resetForKickoff,
    getState
  };
}
