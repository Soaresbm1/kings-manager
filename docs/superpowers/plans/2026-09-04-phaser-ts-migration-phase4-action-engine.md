# Phase 4 — ActionEngine Port Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `src/match/ActionEngine.ts`, a line-by-line-faithful TypeScript port of `matchengine-actions.js`'s `simulatePossessionChain()` and everything it calls (pitch geometry, `MATCH_BALANCE`, derived attribute ratings, decision-making, resolution, targeting), typed against Phase 2/3's types, with every `Math.random()` replaced by an injected `rng: () => number` parameter (defaulting to `Math.random`) so the simulation becomes seedable/testable. `matchengine-actions.js` itself is NOT deleted or modified — `engine.js` keeps calling it exactly as today until Phase 8 (integration) wires the new bridge. This TS port is unused scaffolding until then, proven correct by its own test suite.

**Architecture:** One new file, `src/match/ActionEngine.ts`, containing every function from `matchengine-actions.js` in the same order, same names, same formulas — verified line-by-line against the real source (read in full this session). It imports `Player`/`FormationKey`/`AttackPlanKey`/`DefensePlanKey`/`PlayerPosition` from `src/data/types.ts`, `TeamSide`/`Vector2`/`TacticalSetup`/`MatchAction`/`MatchActionType` from `src/match/MatchTypes.ts`, and `getFormationSlotsFor` from `src/data/legacyDataAdapter.ts` (replacing the legacy file's direct reference to the global `FORMATION_SLOTS`, since `computeSideAnchors` needs it and Phase 3 built exactly this accessor for that purpose). `MATCH_BALANCE` itself moves from a legacy global to a proper exported `const` in this file (it's defined IN `matchengine-actions.js`, not in `data.js` — nothing to adapt, just port).

**RNG injection design:** every function that (directly or transitively) called `Math.random()` gains a final `rng: () => number = Math.random` parameter. `simulatePossessionChain`'s `params` object gains an optional `rng?: () => number` field (`const rng = params.rng || Math.random`), threaded explicitly into every helper call it makes. This is deliberately explicit parameter-passing, not a module-level mutable RNG variable — the latter would be real shared mutable state that could leak between concurrently-running Vitest tests/files; explicit injection has no such risk and matches "seedable/testable" from the spec literally (a caller supplies a seeded generator, gets a reproducible chain).

**Tech Stack:** TypeScript 6.0.x strict (unchanged). No new dependencies.

**Spec:** `docs/superpowers/plans/2026-09-04-phaser-ts-migration-roadmap.md`; the full literal source of `matchengine-actions.js` (read in full this session — every formula/constant in this plan's code blocks is transcribed directly from it, not reconstructed from memory); `tests.js` lines 286-509 and 579-597 (the action-engine and geometry test suites being ported).

## Global Constraints

(carried forward from Phases 1-3, still in force)

- TypeScript strict mode; avoid `any`.
- Zero behavior change to the running game — `matchengine-actions.js` is NOT modified, NOT deleted. `engine.js` keeps calling the legacy JS file, unchanged, until Phase 8.
- Never delete or rewrite `tests.js`/`tests-node.js`/`tests.html`; `node tests-node.js` must keep reporting `59/60` after this phase.
- No `index.html`/`data.js`/`engine.js`/`matchchoreo.js`/`app.js` changes.
- Every formula/constant/branch in the port must match the legacy source exactly — this is a **faithful port**, not a redesign. The only intentional behavioral difference is RNG injection (same distribution, same call sites, just seedable).

---

### Task 1: `src/match/ActionEngine.ts` — full port

**Files:**
- Create: `src/match/ActionEngine.ts`

**Interfaces:**
- Consumes: `Player`, `PlayerPosition`, `FormationKey`, `AttackPlanKey`, `DefensePlanKey` (`src/data/types.ts`); `TeamSide`, `Vector2`, `TacticalSetup`, `MatchAction`, `MatchActionType` (`src/match/MatchTypes.ts`); `getFormationSlotsFor` (`src/data/legacyDataAdapter.ts`).
- Produces (all exported): `PITCH_W`, `PITCH_H`, `GOAL_X_MIN`, `GOAL_X_MAX`, `clamp`, `OutfieldAnchor`, `computeOutfieldAnchors`, `anchorToY`, `gkAnchorY`, `MATCH_BALANCE`, `defensiveCompactionFor`, `computeSideAnchors`, `attackingGoalY`, `ownGoalY`, `AttributeWeights`, `weightedAttr`, `computePassingRating`, `computeDribblingRating`, `computeFinishingRating`, `computeDefendingRating`, `computeGoalkeepingRating`, `pickCarrierWeighted`, `NearestDefenderInfo`, `nearestDefenderInfo`, `computePressure`, `FieldZone`, `fieldZone`, `ActionDecision`, `ChooseActionTypeContext`, `chooseActionType`, `weightedChoice`, `PassKind`, `resolvePassChance`, `resolveDribbleChance`, `computeFoulChance`, `isInPenaltyBox`, `ShotContext`, `computeShotXG`, `ShotOutcome`, `resolveShotOutcome`, `pickPassTarget`, `BoxTarget`, `pickBoxTarget`, `advancedPoint`, `clearTarget`, `pickShotTarget`, `lerpPoint`, `makeBeat`, `buildLeadIn`, `buildRecoveryLine`, `PossessionChainParams`, `FoulResult`, `AttackStats`, `DefenseStats`, `PossessionOutcome`, `PossessionChainResult`, `simulatePossessionChain`, `planChainCount` — consumed by Phase 5 (`MatchEngine.ts`).

- [x] **Step 1: Write `src/match/ActionEngine.ts`**

```ts
import type { Player, PlayerPosition, FormationKey, AttackPlanKey, DefensePlanKey } from "../data/types";
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
```

- [x] **Step 2: Type-check**

Run: `npm run build`
Expected: `tsc --noEmit` passes with no errors. The trickiest spot is the `decision` variable inside `simulatePossessionChain`'s loop: after the five `if (decision === "X") { ...; break/continue; }` guards (shot/clear/cross/dribble/carry, each exiting on every path), TypeScript's control-flow narrowing should reduce `decision`'s type to exactly `"short" | "progressive" | "through"` by the time it reaches `pickPassTarget(decision, ...)`/`resolvePassChance(decision, ...)`/`MATCH_BALANCE.beatDurations[decision]` — if `tsc` reports a type error here instead, this is the one spot in the port where the narrowing might need an explicit assertion; investigate before reaching for `as` — if a cast becomes genuinely necessary, cast to the narrowed union (`decision as "short" | "progressive" | "through"`), never to `any`. (Actual: clean on the first try — `tsc` narrowed `decision` correctly, no cast needed anywhere in the file.)

- [x] **Step 3: Commit**

```bash
git add src/match/ActionEngine.ts
git commit -m "$(cat <<'EOF'
Port matchengine-actions.js to TypeScript (ActionEngine.ts) with injectable RNG

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01VVyw7NW46uymNTs4Cnoacb
EOF
)"
```

---

### Task 2: Vitest suite porting the equivalent `tests.js` assertions

**Files:**
- Create: `src/tests/ActionEngine.test.ts`

**Interfaces:**
- Consumes: every export from `src/match/ActionEngine.ts` (Task 1) and `Player`/`PlayerPosition` from `src/data/types.ts`.

**Which `tests.js` tests this ports** (verbatim assertions, same iteration counts, same thresholds — see `tests.js` lines 290-319 and 364-597 for the originals): `clamp` bounds, `computeOutfieldAnchors(n)` count/bounds for n=1..6, `anchorToY` stays in own half, `gkAnchorY` values, `simulatePossessionChain`: beat structure validity (200 trials), ball/carrier continuity (200 trials), pass/cross always targets an active teammate (300 trials), interception/tackle always causes turnover-or-foul, never a goal (300 trials, weak attackers vs strong defenders), xG always in [0,1] (400 trials), goal never happens without a real shot (400 trials, strong attackers), attack-stat internal consistency (300 trials), no pass attempted with only 1 active field player (100 trials), recovery-line phrasing (`buildRecoveryLine` unit test + 300-trial chain check), `chooseActionType`: attack plan measurably shifts decision frequency (possession→short, direct→through, 3000 trials each). Plus two small additions not in `tests.js` today, filling a real gap noticed while porting (`computeSideAnchors` and the `compute*Rating` functions had no dedicated test, only indirect exercise via `buildChainScenario`) — kept minimal, one assertion each, not scope creep.

Because `computeSideAnchors` (used by this file's own `buildChainScenario` test helper) calls `getFormationSlotsFor`, which reads the ambient `FORMATION_SLOTS` global (Phase 3's `legacyDataAdapter.ts`), this test file injects a realistic `FORMATION_SLOTS["1-2-2-2"]` fixture via `Object.assign(globalThis, ...)` in a `beforeAll` — same technique as Phase 3's `legacyDataAdapter.test.ts`, reusing the REAL slot coordinates read from `data.js` (not invented numbers) so `computeSideAnchors`'s "useSlots" branch activates exactly like production.

- [ ] **Step 1: Write `src/tests/ActionEngine.test.ts`**

```ts
import { describe, it, expect, beforeAll } from "vitest";
import type { Player, PlayerPosition, FormationKey } from "../data/types";
import type { FormationSlot } from "../data/types";
import type { PossessionChainParams } from "../match/ActionEngine";
import {
  clamp, computeOutfieldAnchors, anchorToY, gkAnchorY, computeSideAnchors,
  computePassingRating, computeDribblingRating, computeFinishingRating, computeDefendingRating, computeGoalkeepingRating,
  chooseActionType, buildRecoveryLine, simulatePossessionChain
} from "../match/ActionEngine";

const FIXTURE_FORMATION_SLOTS_2_2_2: FormationSlot[] = [
  { pos: "GK", x: 50, y: 90 },
  { pos: "DEF", x: 25, y: 68 },
  { pos: "DEF", x: 75, y: 68 },
  { pos: "MID", x: 25, y: 42 },
  { pos: "MID", x: 75, y: 42 },
  { pos: "ATT", x: 30, y: 15 },
  { pos: "ATT", x: 70, y: 15 }
];

beforeAll(() => {
  Object.assign(globalThis, {
    FORMATION_SLOTS: {
      "1-2-2-2": FIXTURE_FORMATION_SLOTS_2_2_2,
      "1-3-2-1": FIXTURE_FORMATION_SLOTS_2_2_2,
      "1-2-3-1": FIXTURE_FORMATION_SLOTS_2_2_2
    }
  });
});

function makeTestPlayer(id: string, name: string, pos: PlayerPosition, overall: number): Player {
  return {
    id, name, pos,
    speed: overall, technique: overall, physical: overall, mental: overall, overall,
    form: 80, age: 25, value: 100000,
    goals: 0, assists: 0, rating: 0, matches: 0,
    careerGoals: 0, careerAssists: 0, careerMatches: 0, careerRatingSum: 0,
    injured: false, injuryDaysLeft: 0, injurySeverity: null, suspended: false
  };
}

// Mini-effectif (1 GK + 2 DEF + 2 MID + 2 ATT, formation "1-2-2-2") avec des attributs contrôlés —
// même structure que tests.js:buildTestSquad.
function buildTestSquad(overall: number): Player[] {
  return [
    makeTestPlayer("gk", "GK", "GK", overall),
    makeTestPlayer("d1", "D1", "DEF", overall), makeTestPlayer("d2", "D2", "DEF", overall),
    makeTestPlayer("m1", "M1", "MID", overall), makeTestPlayer("m2", "M2", "MID", overall),
    makeTestPlayer("a1", "A1", "ATT", overall), makeTestPlayer("a2", "A2", "ATT", overall)
  ];
}

function buildTestSetup(players: Player[], formation: FormationKey = "1-2-2-2") {
  return {
    formation,
    assignments: players.map((p) => p.id),
    lineup: players.map((p) => p.id),
    attackPlan: "possession" as const,
    defensePlan: "zone" as const
  };
}

// Construit tout ce dont simulatePossessionChain a besoin pour une possession "home" contre des
// joueurs "away" — même structure que tests.js:buildChainScenario.
function buildChainScenario(homeOverall: number, awayOverall: number, overrides?: Partial<PossessionChainParams>): PossessionChainParams {
  const homePlayers = buildTestSquad(homeOverall);
  const awayPlayers = buildTestSquad(awayOverall);
  const homeSetup = buildTestSetup(homePlayers);
  const awaySetup = buildTestSetup(awayPlayers);
  const homeOutfieldIds = homePlayers.filter((p) => p.pos !== "GK").map((p) => p.id);
  const awayOutfieldIds = awayPlayers.filter((p) => p.pos !== "GK").map((p) => p.id);
  const atkAnchors = computeSideAnchors(homeSetup, homeOutfieldIds, "home", true);
  const defAnchors = computeSideAnchors(awaySetup, awayOutfieldIds, "away", false);
  return {
    side: "home",
    attackers: homePlayers.filter((p) => p.pos !== "GK"),
    defenders: awayPlayers.filter((p) => p.pos !== "GK"),
    gk: awayPlayers.find((p) => p.pos === "GK") || null,
    atkAnchors, defAnchors,
    attackPlanKey: "possession", attackMod: 1, defenseMod: 1, earlyPhaseBoost: 1,
    withSequence: true, staminaFactorFor: () => 1,
    ...overrides
  };
}

const ACTION_BEAT_TYPES = ["pass", "cross", "carry", "dribble", "tackle", "interception", "clear", "out", "press", "shot", "goal", "save", "miss"];

describe("géométrie du terrain", () => {
  it("clamp : borne bien aux deux extrémités et laisse passer une valeur déjà dans l'intervalle", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(15, 0, 10)).toBe(10);
  });

  it("computeOutfieldAnchors(n) : renvoie exactement n ancrages, tous dans des bornes plausibles", () => {
    for (let n = 1; n <= 6; n++) {
      const anchors = computeOutfieldAnchors(n);
      expect(anchors.length).toBe(n);
      anchors.forEach((a) => {
        expect(a.depth).toBeGreaterThanOrEqual(0);
        expect(a.depth).toBeLessThanOrEqual(1);
        expect(a.x).toBeGreaterThanOrEqual(0);
        expect(a.x).toBeLessThanOrEqual(100);
      });
    }
  });

  it("anchorToY : reste strictement dans sa propre moitié de terrain, quel que soit le côté", () => {
    [0, 0.5, 1].forEach((depth) => {
      const yHome = anchorToY(depth, "home");
      const yAway = anchorToY(depth, "away");
      expect(yHome).toBeGreaterThanOrEqual(4);
      expect(yHome).toBeLessThanOrEqual(44);
      expect(yAway).toBeGreaterThanOrEqual(56);
      expect(yAway).toBeLessThanOrEqual(96);
    });
  });

  it("gkAnchorY : gardien collé à sa propre ligne de but", () => {
    expect(gkAnchorY("home")).toBe(5);
    expect(gkAnchorY("away")).toBe(95);
  });

  it("computeSideAnchors : une ancre par joueur de champ actif, toutes sur le terrain", () => {
    const players = buildTestSquad(65);
    const setup = buildTestSetup(players);
    const outfieldIds = players.filter((p) => p.pos !== "GK").map((p) => p.id);
    const anchors = computeSideAnchors(setup, outfieldIds, "home", true);
    outfieldIds.forEach((id) => {
      expect(anchors[id]).toBeDefined();
      expect(anchors[id].x).toBeGreaterThanOrEqual(0);
      expect(anchors[id].x).toBeLessThanOrEqual(100);
      expect(anchors[id].y).toBeGreaterThanOrEqual(0);
      expect(anchors[id].y).toBeLessThanOrEqual(100);
    });
  });
});

describe("attributs dérivés", () => {
  it("compute*Rating renvoient une valeur positive cohérente avec l'overall du joueur", () => {
    const p = makeTestPlayer("x", "X", "MID", 80);
    expect(computePassingRating(p)).toBeCloseTo(80, 0);
    expect(computeDribblingRating(p)).toBeCloseTo(80, 0);
    expect(computeFinishingRating(p)).toBeCloseTo(80, 0);
    expect(computeDefendingRating(p)).toBeCloseTo(80, 0);
    expect(computeGoalkeepingRating(p)).toBeCloseTo(80, 0);
  });
});

describe("simulatePossessionChain", () => {
  it("structure valide d'une action (chaque beat a des positions/durées cohérentes)", () => {
    const scenario = buildChainScenario(65, 65);
    const allIds = new Set([...scenario.attackers.map((p) => p.id), ...scenario.defenders.map((p) => p.id), scenario.gk!.id]);
    for (let i = 0; i < 200; i++) {
      const chain = simulatePossessionChain(scenario);
      chain.beats.forEach((beat) => {
        expect(ACTION_BEAT_TYPES).toContain(beat.type);
        (["from", "to"] as const).forEach((k) => {
          expect(beat[k].x).toBeGreaterThanOrEqual(0);
          expect(beat[k].x).toBeLessThanOrEqual(100);
          expect(beat[k].y).toBeGreaterThanOrEqual(0);
          expect(beat[k].y).toBeLessThanOrEqual(100);
        });
        expect(typeof beat.duration).toBe("number");
        expect(beat.duration).toBeGreaterThanOrEqual(0);
        [beat.playerId, beat.toPlayerId, beat.gkId].forEach((id) => {
          // `id == null` (et non `=== null`) : toPlayerId/gkId sont `string | null | undefined`
          // (champs optionnels de MatchAction) — il faut exclure les deux pour que `allIds.has(id)`
          // ci-dessous type-check (Set<string>.has attend un `string`, pas `string | undefined`).
          expect(id == null || allIds.has(id)).toBe(true);
        });
      });
    }
  });

  it("continuité du porteur et du ballon (jamais de téléportation d'une action à l'autre)", () => {
    const scenario = buildChainScenario(65, 65);
    for (let i = 0; i < 200; i++) {
      const chain = simulatePossessionChain(scenario);
      const ballBeats = chain.beats.filter((b) => b.type !== "press");
      for (let b = 1; b < ballBeats.length; b++) {
        expect(ballBeats[b].from.x).toBeCloseTo(ballBeats[b - 1].to.x, 6);
        expect(ballBeats[b].from.y).toBeCloseTo(ballBeats[b - 1].to.y, 6);
      }
    }
  });

  it("une passe/un centre ne vise jamais un adversaire, toujours un coéquipier actif", () => {
    const scenario = buildChainScenario(65, 65);
    const attackerIds = new Set(scenario.attackers.map((p) => p.id));
    let checked = 0;
    for (let i = 0; i < 300; i++) {
      const chain = simulatePossessionChain(scenario);
      chain.beats.forEach((beat) => {
        if ((beat.type === "pass" || beat.type === "cross") && beat.side === "home" && beat.toPlayerId) {
          checked++;
          expect(attackerIds.has(beat.toPlayerId)).toBe(true);
        }
      });
    }
    expect(checked).toBeGreaterThan(0);
  });

  it("une interception/un tacle provoque toujours un changement de possession (jamais un but)", () => {
    const scenario = buildChainScenario(35, 95);
    let sawTurnoverWithDefenseAction = false;
    for (let i = 0; i < 300; i++) {
      const chain = simulatePossessionChain(scenario);
      const hasDefensiveBeat = chain.beats.some((b) => b.type === "interception" || b.type === "tackle");
      if (hasDefensiveBeat) {
        sawTurnoverWithDefenseAction = true;
        expect(chain.outcome === "turnover" || chain.outcome === "foul").toBe(true);
        if (chain.outcome === "foul") {
          expect(chain.foul?.by).toBeTruthy();
          expect(chain.foul?.against).toBeTruthy();
          expect(["yellow", "penalty"]).toContain(chain.foul?.severity);
        } else {
          expect(chain.defenseStats.interceptions + chain.defenseStats.tacklesWon).toBeGreaterThan(0);
        }
      }
    }
    expect(sawTurnoverWithDefenseAction).toBe(true);
  });

  it("xG toujours compris entre 0 et 1", () => {
    const scenario = buildChainScenario(65, 65);
    let shotsSeen = 0;
    for (let i = 0; i < 400; i++) {
      const chain = simulatePossessionChain(scenario);
      if (chain.outcome === "goal" || chain.outcome === "save" || chain.outcome === "miss") {
        shotsSeen++;
        expect(chain.xG).toBeGreaterThanOrEqual(0);
        expect(chain.xG).toBeLessThanOrEqual(1);
      }
    }
    expect(shotsSeen).toBeGreaterThan(0);
  });

  it("un but ne survient jamais sans tir réel (xG > 0, scorer défini)", () => {
    const scenario = buildChainScenario(80, 50);
    let goalsSeen = 0;
    for (let i = 0; i < 400; i++) {
      const chain = simulatePossessionChain(scenario);
      if (chain.outcome === "goal") {
        goalsSeen++;
        expect(chain.scorer).toBeTruthy();
        expect(chain.xG).toBeGreaterThan(0);
        expect(chain.attackStats.shots).toBeGreaterThanOrEqual(1);
      }
    }
    expect(goalsSeen).toBeGreaterThan(0);
  });

  it("statistiques d'attaque toujours cohérentes entre elles", () => {
    const scenario = buildChainScenario(65, 65);
    for (let i = 0; i < 300; i++) {
      const chain = simulatePossessionChain(scenario);
      const s = chain.attackStats;
      expect(s.shotsOnTarget).toBeLessThanOrEqual(s.shots);
      expect(s.passesCompleted).toBeLessThanOrEqual(s.passesAttempted);
      if (s.shots === 0) expect(chain.xG).toBe(0);
    }
  });

  it("sans coéquipier de champ disponible (1 seul joueur actif), aucune passe n'est tentée", () => {
    const scenario = buildChainScenario(65, 65);
    scenario.attackers = scenario.attackers.slice(0, 1);
    scenario.atkAnchors = { [scenario.attackers[0].id]: { x: 50, y: 30 } };
    for (let i = 0; i < 100; i++) {
      const chain = simulatePossessionChain(scenario);
      expect(chain.attackStats.passesAttempted).toBe(0);
      chain.beats.forEach((b) => {
        expect(b.type).not.toBe("pass");
        expect(b.type).not.toBe("cross");
      });
    }
  });

  it("la récupération de balle est cohérente (jamais depuis le tiers offensif, toujours nommée)", () => {
    const scenario = buildChainScenario(65, 65);
    let sawRecovery = false;
    for (let i = 0; i < 300; i++) {
      const chain = simulatePossessionChain(scenario);
      if (chain.recoveryLine) {
        sawRecovery = true;
        expect(chain.recoveryLine).toContain("récupère le ballon");
      }
    }
    expect(sawRecovery).toBe(true);
  });
});

describe("buildRecoveryLine", () => {
  it("aucune phrase depuis le tiers offensif, sinon mentionne le joueur et la zone", () => {
    const player = { name: "Testeur" };
    expect(buildRecoveryLine(player, { x: 50, y: 90 }, "final")).toBeNull();
    const own = buildRecoveryLine(player, { x: 50, y: 10 }, "own");
    expect(own).toContain("Testeur");
    expect(own).toContain("récupère le ballon");
    expect(own).toContain("propre camp");
    const mid = buildRecoveryLine(player, { x: 20, y: 50 }, "mid");
    expect(mid).toContain("côté gauche");
    expect(mid).toContain("milieu de terrain");
  });
});

describe("chooseActionType", () => {
  it("le plan offensif influence réellement la fréquence des décisions (possession/direct)", () => {
    const carrier = makeTestPlayer("c", "C", "MID", 70);
    function frequencyOf(decisionType: string, attackPlanKey: "possession" | "direct", n: number): number {
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
    expect(shortPossession).toBeGreaterThan(shortDirect);

    const throughDirect = frequencyOf("through", "direct", N);
    const throughPossession = frequencyOf("through", "possession", N);
    expect(throughDirect).toBeGreaterThan(throughPossession);
  });
});
```

- [x] **Step 2: Run it**

Run: `npm test`
Expected: `Test Files 4 passed (4)` (this file + Phase 1-3's three suites). Given the RNG-injection refactor changes nothing about the actual random distributions (still `Math.random()` by default), every ported probabilistic assertion should behave identically to its `tests.js` counterpart — but treat any failure here as a real port bug (a formula transcribed wrong, a branch reordered) and fix `ActionEngine.ts`, not the test, unless the test itself has a mistake (compare carefully against the `tests.js` original before concluding that). (Actual: `Test Files 4 passed`, `Tests 29 passed` — passed on the very first run, no port bug found, strong evidence the faithful transcription was correct.)

- [x] **Step 3: Full verification**

Run, in order: `npm run build`, `npm test`, `npm run test:legacy` (expect unchanged `59/60`), `npm run lint`.
Expected: all green, no regressions. **Actual: `npm run build` failed** where `npm test` had passed — `tsc --noEmit` (part of `build`) reported `TS2345: Argument of type 'string | undefined' is not assignable to parameter of type 'string'` at the `[beat.playerId, beat.toPlayerId, beat.gkId].forEach((id) => { expect(id === null || allIds.has(id))... })` check. Root cause/important finding: **Vitest's `npm test` does NOT type-check** — it transforms `.ts` via esbuild (syntax-only, strips types without verifying them), so a real type error can slip through `npm test` green and only surface in `npm run build`'s `tsc --noEmit` pass. Always run `npm run build` as part of verification, never rely on `npm test` alone to catch type errors. The actual bug: `id === null` only narrows out `null`, leaving `string | undefined` (since `toPlayerId?`/`gkId?` are optional, i.e. `string | null | undefined`) — `Set<string>.has()` requires `string`. Fixed by using `id == null` (loose equality — excludes both `null` and `undefined`) instead of `id === null`. Re-ran full verification after the fix: `npm run build` ✅ (`✓ built in 877ms`), `npm test` ✅ (`Tests 29 passed`), `npm run test:legacy` ✅ (`59/60`), `npm run lint` ✅.

- [x] **Step 4: Commit**

```bash
git add src/tests/ActionEngine.test.ts
git commit -m "$(cat <<'EOF'
Port ActionEngine's tests.js assertions to Vitest

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01VVyw7NW46uymNTs4Cnoacb
EOF
)"
```

---

### Task 3: Documentation

**Files:**
- Modify: `docs/superpowers/plans/2026-09-04-phaser-ts-migration-roadmap.md`

- [x] **Step 1: Update the roadmap with a "Phase 4 — done" note**

Record: the file is a faithful, verified line-by-line port (not a redesign); the RNG-injection pattern (`rng: () => number = Math.random`, threaded explicitly, no module-level mutable state) that Phase 5+ should reuse for `engine.js`'s own `Math.random()` call sites (injuries, cards, penalties, own goals, `weightedPick`, `simulatePenaltyShootout`, `runBalanceSimulation`); the one tricky TS narrowing spot in `simulatePossessionChain` and how it resolved; that `matchengine-actions.js` remains completely untouched and still the one `engine.js` actually calls. Also recorded: `npm test` does not type-check (must always also run `npm run build`), and the `== null` vs `=== null` gotcha on optional fields.

- [ ] **Step 2: Commit**

```bash
git add docs
git commit -m "$(cat <<'EOF'
Document Phase 4 completion (ActionEngine port)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01VVyw7NW46uymNTs4Cnoacb
EOF
)"
```

---

## Definition of done for Phase 4

- [x] `src/match/ActionEngine.ts` exists, a complete, faithful, typed port of `matchengine-actions.js`, with injectable RNG.
- [x] `src/tests/ActionEngine.test.ts` ports every relevant `tests.js` action-engine/geometry assertion, plus minimal new coverage for previously-untested `computeSideAnchors`/`compute*Rating`.
- [x] `npm run build`, `npm test`, `npm run test:legacy` (`59/60`, unchanged), `npm run lint` all pass.
- [x] Zero changes to `matchengine-actions.js` or any other pre-existing `.js`/`.html` file (confirmed via `git diff --stat` across all Phase 4 commits — only `.ts` files touched).
- [x] Roadmap updated with the RNG-injection pattern recorded for reuse in Phase 5.

**Phase 4 completed 2026-09-04.**

Do not start Phase 5 (MatchEngine/MatchState orchestration port) in this plan — write its own bite-sized plan once Phase 4's Definition of Done is fully checked off.
