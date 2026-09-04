import type { Player, FormationKey, AttackPlanKey, DefensePlanKey } from "../data/types";
import type { TeamSide, Vector2, TacticalSetup, MatchAction, MatchActionType } from "./MatchTypes";
import { getFormationSlotsFor } from "../data/legacyDataAdapter";

// ===================== MOTEUR D'ACTIONS — port TypeScript de matchengine-actions.js ============
// Port fidèle, ligne par ligne (voir docs/superpowers/plans/2026-09-04-phaser-ts-migration-
// phase4-action-engine.md) : mêmes fonctions, mêmes formules, mêmes constantes MATCH_BALANCE.
// matchengine-actions.js N'EST PAS supprimé ni modifié — engine.js continue de l'appeler tel quel
// jusqu'à la Phase 8 (intégration/pont). Seule différence délibérée : chaque Math.random() est
// remplacé par un paramètre `rng: () => number` injectable (défaut Math.random), pour rendre la
// simulation seedable/testable — voir la note "Phase 4" de la feuille de route.

// ----- Géométrie du terrain (repère 0-100 x 0-100, y=0 but domicile / y=100 but extérieur) -----
export const PITCH_W = 100;
export const PITCH_H = 100;
export const GOAL_X_MIN = 41;
export const GOAL_X_MAX = 59;

export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export interface OutfieldAnchor {
  x: number;
  depth: number;
}

// Répartit n joueurs de champ (1 à 6) en lignes def→att : utilisé pour les phases à effectif
// réduit (escalier de départ, Dé Géant, escalier inversé du Matchball) où FORMATION_SLOTS (figé à
// 6 joueurs de champ) ne s'applique pas.
export function computeOutfieldAnchors(n: number): OutfieldAnchor[] {
  if (n <= 0) return [];
  const rowCount = n <= 2 ? n : n <= 4 ? 2 : 3;
  const base = Math.floor(n / rowCount);
  let extra = n - base * rowCount;
  const rowCounts: number[] = [];
  for (let r = 0; r < rowCount; r++) {
    rowCounts.push(base + (extra > 0 ? 1 : 0));
    if (extra > 0) extra--;
  }
  const anchors: OutfieldAnchor[] = [];
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
export function anchorToY(depth: number, side: TeamSide): number {
  if (side === "home") return clamp(8 + depth * 36, 4, 44);
  return clamp(92 - depth * 36, 56, 96);
}
export function gkAnchorY(side: TeamSide): number {
  return side === "home" ? 5 : 95;
}

// ===================== CONSTANTES D'ÉQUILIBRAGE (point d'entrée unique pour ajuster le jeu) =====
export const MATCH_BALANCE = {
  derived: {
    passing: { technique: 0.55, mental: 0.30, form: 0.15 },
    dribbling: { technique: 0.50, speed: 0.30, mental: 0.20 },
    finishing: { technique: 0.50, mental: 0.35, form: 0.15 },
    defending: { physical: 0.40, mental: 0.35, speed: 0.25 },
    goalkeeping: { physical: 0.45, mental: 0.35, form: 0.20 }
  },
  defenseShape: {
    compactionByPlan: { low: 0.6, zone: 0.4, high: 0.2 },
    compactionDefault: 0.4
  },
  pressure: { noPressureDist: 16, maxPressureDist: 4 },
  pressing: { engageThreshold: 0.15, stepFraction: 0.55, minStepDistance: 1.5 },
  chain: { maxActions: 6 },
  tempo: {
    extraChainChance: { direct: 0.40, possession: 0.18, transition: 0.42 },
    earlyPhaseExtraChance: 0.30
  },
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
  foul: { baseChance: 0.16, ratingGapSpread: 120, pressureBonus: 0.10 },
  shot: { finishingSpread: 140, gkSpread: 160, onTargetBase: 0.55, onTargetSpread: 300, onTargetPressurePenalty: 0.15 },
  xg: {
    baseAtGoalMouth: 0.60, distanceDecay: 34, referenceAngle: 0.60,
    throughBallMod: 1.25, crossMod: 0.80, counterMod: 1.20, highRecoveryMod: 1.15,
    faceToFaceMod: 1.35, numericSuperiorityMod: 1.12, pressurePenalty: 0.50,
    shooterQualitySpread: 150, gkQualitySpread: 150
  },
  stamina: { drainPerTouch: 1.1, regenPerMinute: 0.6, pressingExtraDrain: 0.5, min: 55, max: 100, effectSpread: 0.15 },
  beatDurations: {
    short: 0.5, progressive: 0.6, through: 0.68, cross: 0.62, carry: 0.5, dribble: 0.45,
    interception: 0.4, tackle: 0.45, clear: 0.55, shot: 0.65, outcome: 0.4, press: 0.35
  },
  earlyPhase: { xgBoost: 1.35 }
};

// Repli défensif : fraction du trajet vers sa propre ligne de but qu'un joueur parcourt en plus
// sans le ballon — dépend du plan défensif choisi.
export function defensiveCompactionFor(defensePlanKey: DefensePlanKey): number {
  const byPlan = MATCH_BALANCE.defenseShape.compactionByPlan;
  const value = byPlan[defensePlanKey];
  return value != null ? value : MATCH_BALANCE.defenseShape.compactionDefault;
}

// Ancre x/y de chaque joueur de champ actif d'un côté donné : en formation complète (7v7), reprend
// FORMATION_SLOTS (via legacyDataAdapter.getFormationSlotsFor, remplace la référence globale directe
// de la version JS) + setup.assignments. En dehors du 7v7, repli sur computeOutfieldAnchors.
export function computeSideAnchors(
  setup: TacticalSetup,
  activeOutfieldIds: string[],
  side: TeamSide,
  possessing: boolean
): Record<string, Vector2> {
  const anchors: Record<string, Vector2> = {};
  const formationKey: FormationKey = possessing ? setup.formation : setup.formationOOP || setup.formation;
  const assignments = possessing ? setup.assignments : setup.assignmentsOOP || setup.assignments;
  const slots = getFormationSlotsFor(formationKey);
  let useSlots = !!(slots && Array.isArray(assignments) && activeOutfieldIds.length === 6);
  if (useSlots) {
    for (const id of activeOutfieldIds) {
      const idx = assignments.indexOf(id);
      if (idx < 0 || !slots[idx] || slots[idx].pos === "GK") {
        useSlots = false;
        break;
      }
    }
  }
  if (useSlots) {
    activeOutfieldIds.forEach((id) => {
      const slot = slots[assignments.indexOf(id)];
      anchors[id] = { x: slot.x, y: side === "home" ? PITCH_H - slot.y : slot.y };
    });
  } else {
    const rowAnchors = computeOutfieldAnchors(activeOutfieldIds.length);
    activeOutfieldIds.forEach((id, i) => {
      const a = rowAnchors[i] || { x: 50, depth: 0.5 };
      anchors[id] = { x: a.x, y: anchorToY(a.depth, side) };
    });
  }
  if (!possessing && useSlots) {
    const ownGoalYValue = side === "home" ? 4 : PITCH_H - 4;
    const compaction = defensiveCompactionFor(setup.defensePlan);
    activeOutfieldIds.forEach((id) => {
      const a = anchors[id];
      if (!a) return;
      anchors[id] = { x: a.x, y: a.y + (ownGoalYValue - a.y) * compaction };
    });
  }
  return anchors;
}

export function attackingGoalY(side: TeamSide): number {
  return side === "home" ? PITCH_H : 0;
}
export function ownGoalY(side: TeamSide): number {
  return side === "home" ? 0 : PITCH_H;
}

// ----- Attributs dérivés (voir data.js:player pour speed/technique/physical/mental/form) -----
export interface AttributeWeights {
  technique?: number;
  mental?: number;
  form?: number;
  speed?: number;
  physical?: number;
}
export function weightedAttr(p: Player, w: AttributeWeights): number {
  return (w.technique || 0) * p.technique + (w.mental || 0) * p.mental + (w.form || 0) * p.form +
    (w.speed || 0) * p.speed + (w.physical || 0) * p.physical;
}
export function computePassingRating(p: Player): number { return weightedAttr(p, MATCH_BALANCE.derived.passing); }
export function computeDribblingRating(p: Player): number { return weightedAttr(p, MATCH_BALANCE.derived.dribbling); }
export function computeFinishingRating(p: Player): number { return weightedAttr(p, MATCH_BALANCE.derived.finishing); }
export function computeDefendingRating(p: Player): number { return weightedAttr(p, MATCH_BALANCE.derived.defending); }
export function computeGoalkeepingRating(p: Player): number { return weightedAttr(p, MATCH_BALANCE.derived.goalkeeping); }

// ----- Sélection pondérée d'un joueur -----
export function pickCarrierWeighted(players: Player[], rng: () => number = Math.random): Player | null {
  if (!players.length) return null;
  const weights = players.map((p) => {
    let w = (p.technique + p.physical + p.speed) / 3;
    if (p.pos === "ATT") w *= 1.6;
    else if (p.pos === "MID") w *= 1.7;
    else if (p.pos === "GK") w *= 0.05;
    else w *= 1.0;
    return Math.max(0.01, w);
  });
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (let i = 0; i < players.length; i++) {
    r -= weights[i];
    if (r <= 0) return players[i];
  }
  return players[players.length - 1];
}

// ----- Pression défensive -----
export interface NearestDefenderInfo {
  defender: Player | null;
  distance: number;
}
export function nearestDefenderInfo(pos: Vector2, defenders: Player[], defAnchors: Record<string, Vector2>): NearestDefenderInfo {
  let best: Player | null = null;
  let bestDist = Infinity;
  defenders.forEach((d) => {
    const a = defAnchors[d.id];
    if (!a) return;
    const dist = Math.hypot(a.x - pos.x, a.y - pos.y);
    if (dist < bestDist) { bestDist = dist; best = d; }
  });
  return { defender: best, distance: bestDist === Infinity ? 40 : bestDist };
}
export function computePressure(distance: number): number {
  const B = MATCH_BALANCE.pressure;
  if (distance >= B.noPressureDist) return 0;
  if (distance <= B.maxPressureDist) return 1;
  return 1 - (distance - B.maxPressureDist) / (B.noPressureDist - B.maxPressureDist);
}

// ----- Zone du terrain relative au but visé (final/mid/own tiers) -----
export type FieldZone = "final" | "mid" | "own";
export function fieldZone(pos: Vector2, side: TeamSide): FieldZone {
  const d = Math.abs(pos.y - attackingGoalY(side));
  if (d <= 33) return "final";
  if (d <= 66) return "mid";
  return "own";
}

// ===================== DÉCISION =====================
export type ActionDecision = "shot" | "cross" | "dribble" | "carry" | "short" | "progressive" | "through" | "clear";

export interface ChooseActionTypeContext {
  carrier: Player;
  zone: FieldZone;
  pressure: number;
  attackPlanKey: AttackPlanKey;
  pos: Vector2;
  side: TeamSide;
  actionsLeft: number;
  hasPassOptions: boolean;
}

// Choisit une décision cohérente selon la zone, la pression, le plan offensif, le poste du
// porteur et le nombre d'actions déjà jouées dans la possession.
export function chooseActionType(ctx: ChooseActionTypeContext, rng: () => number = Math.random): ActionDecision {
  const { carrier, zone, pressure, attackPlanKey, pos, side, actionsLeft, hasPassOptions } = ctx;
  const D = MATCH_BALANCE.decision;
  const isWide = pos.x < 25 || pos.x > 75;
  const goalDist = Math.abs(attackingGoalY(side) - pos.y);

  const w: Record<ActionDecision, number> = {
    shot: zone === "final" ? D.shotBase * (1 - pressure * 0.4) * (goalDist < 28 ? 1.4 : 0.8) : (zone === "mid" && goalDist < 38 ? D.shotBase * 0.22 : 0),
    cross: (hasPassOptions && zone !== "own" && isWide) ? D.crossBase : 0,
    dribble: pressure > 0.3 ? D.dribbleBase * (0.6 + pressure) : D.dribbleBase * 0.45,
    carry: pressure < 0.55 ? D.carryBase : D.carryBase * 0.3,
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

  return weightedChoice(w, rng) as ActionDecision;
}

export function weightedChoice(weights: Record<string, number>, rng: () => number = Math.random): string {
  const entries = Object.entries(weights).filter(([, v]) => v > 0);
  if (!entries.length) return "short";
  const total = entries.reduce((s, [, v]) => s + v, 0);
  let r = rng() * total;
  for (const [k, v] of entries) {
    r -= v;
    if (r <= 0) return k;
  }
  return entries[entries.length - 1][0];
}

// ===================== RÉSOLUTION =====================
export type PassKind = "short" | "progressive" | "through" | "cross";

export function resolvePassChance(
  kind: PassKind,
  passer: Player,
  pressure: number,
  defenderRating: number | null,
  staminaFactor: number
): number {
  const B = MATCH_BALANCE.pass;
  const rating = computePassingRating(passer) * (staminaFactor || 1);
  let chance = B.baseSuccess[kind] + (rating - 70) / B.ratingSpread - pressure * B.pressurePenalty;
  if (defenderRating != null) chance -= (defenderRating - 70) / B.defenderPenaltySpread;
  return clamp(chance, 0.12, 0.97);
}
export function resolveDribbleChance(attacker: Player, defender: Player | null, staminaFactor: number): number {
  const B = MATCH_BALANCE.dribble;
  const atk = computeDribblingRating(attacker) * (staminaFactor || 1);
  const def = defender ? computeDefendingRating(defender) : 40;
  return clamp(B.base + (atk - def) / B.ratingSpread, 0.15, 0.9);
}

// ----- Faute lors d'un duel (dribble) perdu par le défenseur -----
export function computeFoulChance(defender: Player, carrier: Player, pressure: number): number {
  const F = MATCH_BALANCE.foul;
  const gap = computeDribblingRating(carrier) - computeDefendingRating(defender);
  return clamp(F.baseChance + Math.max(0, gap) / F.ratingGapSpread + pressure * F.pressureBonus, 0.03, 0.5);
}
// Surface de réparation : à moins de 18 unités de la ligne de but visée, dans le couloir central.
export function isInPenaltyBox(pos: Vector2, side: TeamSide): boolean {
  const dist = Math.abs(attackingGoalY(side) - pos.y);
  return dist <= 18 && pos.x >= 19 && pos.x <= 81;
}

// ----- xG : distance + angle du but vu depuis le point de tir, modulé par le contexte -----
export interface ShotContext {
  pos: Vector2;
  side: TeamSide;
  pressure: number;
  assistType: ActionDecision | null;
  isCounter: boolean;
  isHighRecovery: boolean;
  numericSuperiority: boolean;
  faceToFace: boolean;
  shooterQuality: number;
  gkQuality: number;
}
export function computeShotXG(shotCtx: ShotContext): number {
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
export type ShotOutcome = "goal" | "save" | "miss";
export function resolveShotOutcome(
  xg: number,
  shooterFinishing: number,
  gkRating: number,
  pressure: number,
  rng: () => number = Math.random
): ShotOutcome {
  const B = MATCH_BALANCE.shot;
  let goalChance = xg * clamp(0.6 + shooterFinishing / B.finishingSpread, 0.7, 1.3) * clamp(1.25 - gkRating / B.gkSpread, 0.75, 1.25);
  goalChance = clamp(goalChance, 0.02, 0.92);
  if (rng() < goalChance) return "goal";
  const onTargetChance = clamp(B.onTargetBase + shooterFinishing / B.onTargetSpread - pressure * B.onTargetPressurePenalty, 0.25, 0.85);
  return rng() < onTargetChance ? "save" : "miss";
}

// ===================== CIBLAGE (choix du coéquipier/point visé) =====================
export function pickPassTarget(
  kind: ActionDecision,
  side: TeamSide,
  teammates: Player[],
  carrier: Player,
  atkAnchors: Record<string, Vector2>,
  pos: Vector2,
  rng: () => number = Math.random
): Player | null {
  const mates = teammates.filter((p) => p.id !== carrier.id && p.pos !== "GK");
  if (!mates.length) return null;
  const scored = mates.map((p) => {
    const a = atkAnchors[p.id] || pos;
    const forwardness = side === "home" ? a.y - pos.y : pos.y - a.y;
    const dist = Math.hypot(a.x - pos.x, a.y - pos.y);
    return { p, a, forwardness, dist };
  });
  if (kind === "short") scored.sort((x, y) => x.dist - y.dist);
  else scored.sort((x, y) => y.forwardness - x.forwardness);
  const pool = scored.slice(0, Math.min(2, scored.length));
  return pool[Math.floor(rng() * pool.length)].p;
}

export interface BoxTarget {
  p: Player;
  a: Vector2;
}
export function pickBoxTarget(teammates: Player[], carrier: Player, atkAnchors: Record<string, Vector2>, side: TeamSide): BoxTarget | null {
  const goalY = attackingGoalY(side);
  const mates = teammates.filter((p) => p.id !== carrier.id && p.pos !== "GK");
  if (!mates.length) return null;
  const scored = mates.map((p) => ({ p, a: atkAnchors[p.id] || { x: 50, y: goalY } }));
  scored.sort((x, y) => Math.abs(goalY - x.a.y) - Math.abs(goalY - y.a.y));
  return scored[0];
}
export function advancedPoint(pos: Vector2, side: TeamSide, distance: number, rng: () => number = Math.random): Vector2 {
  const dir = side === "home" ? 1 : -1;
  const jitterX = (rng() - 0.5) * 10;
  return { x: clamp(pos.x + jitterX, 3, 97), y: clamp(pos.y + dir * distance, 2, 98) };
}
export function clearTarget(pos: Vector2, side: TeamSide, rng: () => number = Math.random): Vector2 {
  const dir = side === "home" ? 1 : -1;
  return { x: clamp(20 + rng() * 60, 5, 95), y: clamp(pos.y + dir * 30, 2, 98) };
}
export function pickShotTarget(side: TeamSide, onTarget: boolean, rng: () => number = Math.random): Vector2 {
  const y = attackingGoalY(side);
  const nearY = side === "home" ? y - 6 : y + 6;
  let x: number;
  if (onTarget) x = GOAL_X_MIN + 2 + rng() * (GOAL_X_MAX - GOAL_X_MIN - 4);
  else x = rng() < 0.5 ? GOAL_X_MIN - 3 - rng() * 8 : GOAL_X_MAX + 3 + rng() * 8;
  return { x: clamp(x, 2, 98), y: nearY };
}
export function lerpPoint(a: Vector2, b: Vector2, t: number): Vector2 {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

export function makeBeat(
  type: MatchActionType,
  side: TeamSide | null,
  playerId: string | null,
  gkId: string | null,
  from: Vector2,
  to: Vector2,
  duration: number,
  toPlayerId?: string | null
): MatchAction {
  return {
    type, side, playerId: playerId || null, toPlayerId: toPlayerId || null, gkId: gkId || null,
    from: { x: from.x, y: from.y }, to: { x: to.x, y: to.y }, duration, event: null
  };
}

// ----- Phrase d'amorce : uniquement pour les actions qui "racontent" vraiment quelque chose
// (passe en profondeur, centre, dribble) juste avant un tir. -----
export function buildLeadIn(lastActionType: ActionDecision | null, assister: { name: string } | null, scorer: { name: string }): string | null {
  if (lastActionType === "through" && assister) return `${assister.name} trouve ${scorer.name} entre les lignes.`;
  if (lastActionType === "cross" && assister) return `${assister.name} centre pour ${scorer.name}.`;
  if (lastActionType === "dribble") return `${scorer.name} élimine son défenseur.`;
  return null;
}

// ----- Phrase de récupération en tout début de possession -----
export function buildRecoveryLine(carrier: { name: string }, pos: Vector2, zone: FieldZone): string | null {
  if (zone === "final") return null;
  const lateral = pos.x < 35 ? "côté gauche" : pos.x > 65 ? "côté droit" : "dans l'axe";
  const depthPhrase = zone === "own" ? "dans son propre camp" : "au milieu de terrain";
  return `${carrier.name} récupère le ballon ${lateral} ${depthPhrase}.`;
}

// ===================== ORCHESTRATION D'UNE POSSESSION =====================
export interface PossessionChainParams {
  side: TeamSide;
  attackers: Player[];
  defenders: Player[];
  gk: Player | null;
  atkAnchors: Record<string, Vector2>;
  defAnchors: Record<string, Vector2>;
  attackPlanKey: AttackPlanKey;
  attackMod?: number;
  defenseMod?: number;
  earlyPhaseBoost?: number;
  withSequence: boolean;
  staminaFactorFor?: (playerId: string) => number;
  rng?: () => number;
}
export interface FoulResult {
  severity: "yellow" | "penalty";
  by: Player;
  against: Player;
}
export interface AttackStats {
  shots: number;
  shotsOnTarget: number;
  passesAttempted: number;
  passesCompleted: number;
  clearances: number;
  possessionActions: number;
}
export interface DefenseStats {
  interceptions: number;
  tacklesWon: number;
  fouls: number;
}
export type PossessionOutcome = "goal" | "save" | "miss" | "clearance" | "turnover" | "foul" | "none";
export interface PossessionChainResult {
  outcome: PossessionOutcome;
  scorer: Player | null;
  assister: Player | null;
  gk: Player | null;
  xG: number;
  leadIn: string | null;
  recoveryLine: string | null;
  foul: FoulResult | null;
  beats: MatchAction[];
  touchedIds: string[];
  attackStats: AttackStats;
  defenseStats: DefenseStats;
}

export function simulatePossessionChain(params: PossessionChainParams): PossessionChainResult {
  const {
    side, attackers, defenders, gk, atkAnchors, defAnchors,
    attackPlanKey, attackMod, defenseMod, earlyPhaseBoost, withSequence,
    staminaFactorFor
  } = params;
  const rng = params.rng || Math.random;
  const oppSide: TeamSide = side === "home" ? "away" : "home";
  const beats: MatchAction[] | null = withSequence ? [] : null;
  const touchedIds = new Set<string>();
  const attackStats: AttackStats = { shots: 0, shotsOnTarget: 0, passesAttempted: 0, passesCompleted: 0, clearances: 0, possessionActions: 0 };
  const defenseStats: DefenseStats = { interceptions: 0, tacklesWon: 0, fouls: 0 };

  const fieldAttackers = attackers.filter((p) => p.pos !== "GK");
  if (!fieldAttackers.length) {
    return { outcome: "none", scorer: null, assister: null, gk: null, xG: 0, leadIn: null, recoveryLine: null, foul: null, beats: beats || [], touchedIds: [], attackStats, defenseStats };
  }

  let carrier = pickCarrierWeighted(fieldAttackers, rng) as Player;
  touchedIds.add(carrier.id);
  const hasPassOptions = fieldAttackers.length >= 2;
  let pos: Vector2 = Object.assign({}, atkAnchors[carrier.id] || { x: 50, y: side === "home" ? 30 : 70 });
  const startZone = fieldZone(pos, side);
  const isCounter = startZone === "own";
  const recoveryLine = buildRecoveryLine(carrier, pos, startZone);
  let lastActionType: ActionDecision | null = null;
  let assister: Player | null = null;
  let outcome: PossessionOutcome = "turnover";
  let foul: FoulResult | null = null;
  let scorer: Player | null = null;
  const finalGk: Player | null = gk || null;
  let shotXG = 0;
  let leadIn: string | null = null;

  const staminaFor = (p: Player) => (staminaFactorFor ? staminaFactorFor(p.id) : 1) * (attackMod || 1);

  const defShadow: Record<string, Vector2> = {};
  function shadowPos(defender: Player): Vector2 {
    return defShadow[defender.id] || defAnchors[defender.id] || { x: 50, y: 50 };
  }

  let actionsLeft = MATCH_BALANCE.chain.maxActions;
  while (actionsLeft-- > 0) {
    attackStats.possessionActions++;
    const effectiveDefPos = Object.keys(defShadow).length ? Object.assign({}, defAnchors, defShadow) : defAnchors;
    const { defender: nearestDef, distance } = nearestDefenderInfo(pos, defenders, effectiveDefPos);
    const pressure = clamp(computePressure(distance) * (defenseMod || 1), 0, 1);
    const zone = fieldZone(pos, side);

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

    const decision = chooseActionType({ carrier, zone, pressure, attackPlanKey, pos, side, actionsLeft, hasPassOptions }, rng);

    if (decision === "shot") {
      attackStats.shots++;
      const faceToFace = lastActionType === "through" && pressure < 0.3;
      const numericSuperiority = fieldAttackers.length > defenders.length;
      let xg = computeShotXG({
        pos, side, pressure, assistType: lastActionType, isCounter, isHighRecovery: isCounter,
        numericSuperiority, faceToFace,
        shooterQuality: computeFinishingRating(carrier) * staminaFor(carrier),
        gkQuality: finalGk ? computeGoalkeepingRating(finalGk) : 55
      });
      xg = clamp(xg * (earlyPhaseBoost || 1), 0.01, 0.95);
      shotXG = xg;
      const res = resolveShotOutcome(xg, computeFinishingRating(carrier) * staminaFor(carrier), finalGk ? computeGoalkeepingRating(finalGk) : 55, pressure, rng);
      const shotFrom = Object.assign({}, pos);
      const onTarget = res !== "miss";
      const target = pickShotTarget(side, onTarget, rng);
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
      const target = clearTarget(pos, side, rng);
      if (beats) beats.push(makeBeat("clear", side, carrier.id, null, pos, target, MATCH_BALANCE.beatDurations.clear));
      break;
    }

    if (decision === "cross") {
      const boxTarget = pickBoxTarget(fieldAttackers, carrier, atkAnchors, side);
      if (!boxTarget) { outcome = "turnover"; break; }
      attackStats.passesAttempted++;
      const chance = resolvePassChance("cross", carrier, pressure, nearestDef ? computeDefendingRating(nearestDef) : null, staminaFor(carrier));
      if (rng() < chance) {
        attackStats.passesCompleted++;
        touchedIds.add(boxTarget.p.id);
        if (beats) beats.push(makeBeat("cross", side, carrier.id, null, pos, boxTarget.a, MATCH_BALANCE.beatDurations.cross, boxTarget.p.id));
        assister = carrier;
        lastActionType = "cross";
        carrier = boxTarget.p;
        pos = Object.assign({}, boxTarget.a);
        continue;
      }
      outcome = "turnover";
      const target = boxTarget ? boxTarget.a : advancedPoint(pos, side, 10, rng);
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
      const advance = advancedPoint(pos, side, MATCH_BALANCE.dribble.advanceDistance, rng);
      if (rng() < chance) {
        if (beats) beats.push(makeBeat("dribble", side, carrier.id, null, pos, advance, MATCH_BALANCE.beatDurations.dribble));
        pos = advance;
        lastActionType = "dribble";
        continue;
      }
      if (nearestDef) touchedIds.add(nearestDef.id);
      const tacklePos = nearestDef ? shadowPos(nearestDef) : advance;
      if (nearestDef && rng() < computeFoulChance(nearestDef, carrier, pressure)) {
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
      const advance = advancedPoint(pos, side, MATCH_BALANCE.carry.advanceDistance, rng);
      if (beats) beats.push(makeBeat("carry", side, carrier.id, null, pos, advance, MATCH_BALANCE.beatDurations.carry));
      pos = advance;
      lastActionType = "carry";
      continue;
    }

    // passes (short / progressive / through)
    const receiver = pickPassTarget(decision, side, fieldAttackers, carrier, atkAnchors, pos, rng);
    if (!receiver) { outcome = "turnover"; break; }
    attackStats.passesAttempted++;
    const targetPos = atkAnchors[receiver.id] || pos;
    const chance = resolvePassChance(decision, carrier, pressure, nearestDef ? computeDefendingRating(nearestDef) : null, staminaFor(carrier));
    if (rng() < chance) {
      attackStats.passesCompleted++;
      touchedIds.add(receiver.id);
      if (beats) beats.push(makeBeat("pass", side, carrier.id, null, pos, targetPos, MATCH_BALANCE.beatDurations[decision], receiver.id));
      assister = carrier;
      lastActionType = decision;
      carrier = receiver;
      pos = Object.assign({}, targetPos);
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
    outcome,
    scorer,
    assister: assister && scorer && assister.id === scorer.id ? null : assister,
    gk: finalGk,
    xG: shotXG,
    leadIn,
    recoveryLine,
    foul,
    beats: beats || [],
    touchedIds: Array.from(touchedIds),
    attackStats,
    defenseStats
  };
}

// ----- Nombre de possessions à jouer ce côté-ci cette minute (tempo/rythme du match) -----
export function planChainCount(attackPlanKey: AttackPlanKey, earlyPhase: boolean, rng: () => number = Math.random): number {
  let n = 1;
  const extra = MATCH_BALANCE.tempo.extraChainChance[attackPlanKey] != null ? MATCH_BALANCE.tempo.extraChainChance[attackPlanKey] : 0.2;
  if (rng() < extra) n++;
  if (earlyPhase && rng() < MATCH_BALANCE.tempo.earlyPhaseExtraChance) n++;
  return n;
}
