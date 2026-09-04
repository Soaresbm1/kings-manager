# Phase 5A — Core Match Engine Port Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the core of `engine.js` — `createMatchEngine`, `simulateMatch`, `simulatePenaltyShootout`, the match-completion player-progression functions (`applyMatchPlayerStats`, `updateFormAfterMatch`, `developPlayer`, `bumpAttribute`), and their geometry/strength helpers (`formationAttackFactor`, `formationDefenseFactor`, `computeTeamStrength`) — to `src/match/MatchEngine.ts`, faithfully, with injectable RNG. `engine.js` is NOT modified. `app.js` still calls the legacy JS exactly as before.

**Why "5A" not "Phase 5":** the roadmap's Phase 5 ("MatchEngine/MatchState orchestration port") also lists `generateSchedule`, `computeStandings`, `computeTopScorers/Assists/Ratings`, `chooseAiFormation`, `chooseAiPlans`, `simulateAIMatch`, `runBalanceSimulation`, `fillPositionGaps`, `simulateAITransfers` — `engine.js` is 1685 lines and this is too much for one bite-sized plan. This plan covers only the match-orchestration core (everything a single match actually needs, end to end, including what happens to players right after). A separate **Phase 5B** plan will cover schedule/standings/AI/transfers once this lands — those are self-contained, lower-risk, and don't block anything else.

**Architecture:** One file, `src/match/MatchEngine.ts`. `createMatchEngine` is ported as a factory function returning a typed `MatchEngine` interface, matching the legacy closure-based factory pattern exactly (same private nested functions, same closure variables) — this is *not* rewritten as a class; the closure pattern already works and a faithful port shouldn't restructure it. It imports `MATCH_BALANCE`, `clamp`, `PITCH_H`, `GOAL_X_MIN`, `GOAL_X_MAX`, `computeSideAnchors`, `gkAnchorY`, `simulatePossessionChain`, `planChainCount` from `src/match/ActionEngine.ts` (Phase 4), and `getFormations`, `getAttackPlan`, `getDefensePlan`, `getValueStarBounds` from `src/data/legacyDataAdapter.ts` (Phase 3, extended this phase — see below).

## Design notes (read before reviewing the code)

- **RNG**: `createMatchEngine(..., rng: () => number = Math.random)` takes ONE rng for the whole match, captured once in the closure — every nested function (`performPenaltyAttempt`, `advancePhaseState`, `simulateMinute`, etc.) just calls the closed-over `rng()`, no per-function parameter threading needed (unlike `ActionEngine.ts`'s standalone exported functions, which don't share a closure). `simulateMatch`/`simulatePenaltyShootout`/`developPlayer`/`bumpAttribute`/`updateFormAfterMatch` are top-level functions, so they DO take their own `rng: () => number = Math.random` parameter, threaded explicitly (same pattern as Phase 4). `attemptRealAttack`'s call into `simulatePossessionChain` passes the SAME `rng` through, so a whole match — action-engine internals included — draws from one seedable stream when one is supplied.
- **"Array with a bolted-on property" → structured object**: the legacy code repeatedly returns a plain event array with an extra `.sequence` (and, once, `.possession`) property attached directly to it (`evts.sequence = [...]`, `minuteEvents.possession = homePossession`) — works fine in loose JS, awkward and unsafe to type precisely in strict TypeScript. This port replaces that pattern with a small structured type, `EngineEventBatch { events: MatchEvent[]; sequence: MatchAction[] }`, returned by `performPenaltyAttempt`/`performShootoutAttempt`/`performPresidentPenaltyKick`/`triggerPresidentPenalty`/`activateCard`, and a `MinuteResult { events, sequence, possession?, stopAfterPenalty }` for `simulateMinute`. This is a deliberate, narrow, documented deviation from a literal transcription — **no formula, constant, timing, or branch of game logic changes**, only how "events + their beats" are packaged for the caller. Every internal call site is updated consistently (`result.events`/`result.sequence` instead of spreading a bolted-on array).
- **`MatchEvent.type` gained two values**: `"shootout"` and `"shootout miss"`, used by `simulatePenaltyShootout` and missed in Phase 2's first inventory of `engine.js`'s event-construction sites. Added directly to `src/match/MatchTypes.ts` (widening a union is non-breaking).
- **`legacyDataAdapter.ts` gained `getValueStarBounds()`**: `developPlayer` needs `data.js`'s `VALUE_STAR_MIN`/`VALUE_STAR_MAX` (used to recompute a player's value after an attribute change, with the exact same star curve as player creation) — two more `data.js` globals Phase 3 didn't anticipate needing. Same `declare global { var ... }` pattern as everything else in that file.
- **`MatchState`/`MatchSnapshot` (Phase 2) are intentionally NOT extended or produced by this phase** — per Phase 2's own design note, `MatchEngine.ts`'s actual internal state (card sanctions, per-player stamina, dice/president state) is closure-private, matching the legacy code; nothing here claims to conform to the lighter `MatchState` summary type from Phase 2. That reconciliation (if ever needed) is Phase 6+'s problem once `CollectiveMovement`/`MatchBridge` are being built for real and it's clear what shape they actually need.
- **Test fixtures don't depend on Phase 5B's AI functions**: `tests.js`'s existing `createMatchEngine`/`simulateMinute`/`getFormationAnchors` tests all call `chooseAiFormation(LEAGUES.xxx.teams[n])` to build a starting XI from real data — that function is Phase 5B scope, not yet ported. This plan's ported tests reuse Phase 4's `buildTestSquad`/`buildTestSetup` local-fixture pattern instead, keeping Phase 5A fully self-contained.

## Global Constraints

(carried forward from Phases 1-4, still in force)

- TypeScript strict mode; avoid `any`.
- Zero behavior change — `engine.js` is NOT modified. `app.js` keeps calling the legacy JS exactly as before, until Phase 8.
- Never delete or rewrite `tests.js`/`tests-node.js`/`tests.html`; `node tests-node.js` must keep reporting `59/60`.
- No `index.html`/`data.js`/`matchengine-actions.js`/`matchchoreo.js`/`app.js` changes.
- Every formula/constant/branch must match the legacy source exactly (read in full this session) — faithful port, not a redesign, except the two documented deviations above (RNG injection, event-batch structuring).
- Always run `npm run build` (not just `npm test`) — Vitest does not type-check (Phase 4 finding).
- Use `== null` (not `=== null`) when checking an optional field for "absent" (Phase 4 finding).

---

### Task 1: Extend shared types (`MatchTypes.ts`, `legacyDataAdapter.ts`)

**Files:**
- Modify: `src/match/MatchTypes.ts` (add `"shootout"` / `"shootout miss"` to `MatchEvent.type`)
- Modify: `src/data/legacyDataAdapter.ts` (add `VALUE_STAR_MIN`/`VALUE_STAR_MAX` ambient globals + `getValueStarBounds()`)

- [x] **Step 1: Widen `MatchEvent.type`** (already done, see this session's edit to `MatchTypes.ts`)
- [x] **Step 2: Add `getValueStarBounds()`** (already done, see this session's edit to `legacyDataAdapter.ts`)
- [x] **Step 3: Type-check**

Run: `npm run build`
Expected: clean (both edits are additive; nothing else references these yet).

- [ ] **Step 4: Commit**

```bash
git add src/match/MatchTypes.ts src/data/legacyDataAdapter.ts
git commit -m "$(cat <<'EOF'
Extend MatchEvent type and legacy adapter for Phase 5 (shootout events, value-star bounds)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01VVyw7NW46uymNTs4Cnoacb
EOF
)"
```

---

### Task 2: `src/match/MatchEngine.ts` — full port

**Files:**
- Create: `src/match/MatchEngine.ts`

**Interfaces:**
- Consumes: `Player`, `Team`, `PlayerPosition`, `SecretCardKey` (`src/data/types.ts`); `TeamSide`, `Vector2`, `TacticalSetup`, `MatchAction`, `MatchEvent`, `MatchStatistics` (`src/match/MatchTypes.ts`); `MATCH_BALANCE`, `clamp`, `PITCH_H`, `GOAL_X_MIN`, `GOAL_X_MAX`, `computeSideAnchors`, `gkAnchorY`, `simulatePossessionChain`, `planChainCount` (`src/match/ActionEngine.ts`); `getFormations`, `getAttackPlan`, `getDefensePlan`, `getValueStarBounds` (`src/data/legacyDataAdapter.ts`).
- Produces (exported): `InjurySeverityTier`, `INJURY_SEVERITY_TIERS`, `formationAttackFactor`, `formationDefenseFactor`, `TeamStrength`, `computeTeamStrength`, `PlayerMatchStat`, `EngineEventBatch`, `MinuteResult`, `ShootoutResult`, `MatchResult`, `ActivateCardOptions`, `TriggerPresidentPenaltyOptions`, `FormationAnchor`, `SpecialActionKind`, `MatchEngine` (interface), `createMatchEngine`, `simulateMatch`, `applyMatchPlayerStats`, `updateFormAfterMatch`, `developPlayer`, `bumpAttribute`, `simulatePenaltyShootout` — consumed by Phase 5B (AI/schedule/standings) and Phase 8 (bridge).

- [ ] **Step 1: Write `src/match/MatchEngine.ts`**

```ts
import type { Player, Team, PlayerPosition, SecretCardKey } from "../data/types";
import type { TeamSide, Vector2, TacticalSetup, MatchAction, MatchEvent, MatchStatistics } from "./MatchTypes";
import {
  MATCH_BALANCE, clamp, PITCH_H, GOAL_X_MIN, GOAL_X_MAX,
  computeSideAnchors, gkAnchorY, simulatePossessionChain, planChainCount
} from "./ActionEngine";
import { getFormations, getAttackPlan, getDefensePlan, getValueStarBounds } from "../data/legacyDataAdapter";

// ===================== MOTEUR DE MATCH — port TypeScript de engine.js (cœur) ====================
// Port fidèle du cœur d'engine.js (createMatchEngine, simulateMatch, simulatePenaltyShootout,
// progression des joueurs après match) — voir docs/superpowers/plans/2026-09-04-phaser-ts-
// migration-phase5a-match-engine.md pour les deux déviations délibérées (injection RNG, structures
// {events,sequence} à la place des tableaux à propriété greffée). engine.js N'EST PAS modifié ;
// app.js continue de l'appeler tel quel jusqu'à la Phase 8. generateSchedule/computeStandings/
// IA/transferts restent dans engine.js — Phase 5B.

export interface InjurySeverityTier {
  label: string;
  chance: number;
  minDays: number;
  maxDays: number;
}
export const INJURY_SEVERITY_TIERS: InjurySeverityTier[] = [
  { label: "légère", chance: 0.7, minDays: 1, maxDays: 3 },
  { label: "modérée", chance: 0.95, minDays: 4, maxDays: 8 },
  { label: "grave", chance: 1.01, minDays: 9, maxDays: 20 }
];

export function formationAttackFactor(formationKey: TacticalSetup["formation"]): number {
  const f = getFormations()[formationKey] || getFormations()["1-2-2-2"];
  return 0.92 + f.att * 0.06 + f.mid * 0.015;
}
export function formationDefenseFactor(formationKey: TacticalSetup["formation"]): number {
  const f = getFormations()[formationKey] || getFormations()["1-2-2-2"];
  return 0.92 + f.def * 0.06 + f.mid * 0.01;
}

export interface TeamStrength {
  overall: number;
  speed: number;
  technique: number;
  physical: number;
  mental: number;
  form: number;
}
export function computeTeamStrength(team: Team, lineup: string[]): TeamStrength {
  let speed = 0, technique = 0, physical = 0, mental = 0, form = 0, count = 0;
  lineup.forEach((pid) => {
    const p = team.players.find((pl) => pl.id === pid);
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

export interface PlayerMatchStat {
  goals: number;
  assists: number;
}
export interface EngineEventBatch {
  events: MatchEvent[];
  sequence: MatchAction[];
}
export interface MinuteResult {
  events: MatchEvent[];
  sequence: MatchAction[] | null;
  possession?: number;
  stopAfterPenalty: boolean;
}
export interface ShootoutResult {
  events: MatchEvent[];
  homeScore: number;
  awayScore: number;
  homeWins: boolean;
}
export interface MatchResult extends MatchStatistics {
  events: MatchEvent[];
  playerStats: Record<string, PlayerMatchStat>;
  ratings: Record<string, number>;
  penaltyWinner: TeamSide | null;
  shootout: ShootoutResult | null;
}
export interface ActivateCardOptions {
  taker?: Player;
  player?: Player;
  targetName?: string;
  copyKey?: SecretCardKey;
  mode?: "steal" | "copy";
}
export interface TriggerPresidentPenaltyOptions {
  presidentName?: string;
}
export interface FormationAnchor extends Vector2 {
  pos: PlayerPosition;
}
export type SpecialActionKind = "card" | "president";

interface CardState {
  key: SecretCardKey | null;
  used: boolean;
  doubleUntil: number;
  starPlayerId: string | null;
  starUsed: boolean;
  sanctionUntil: number;
}
interface YellowSanction { playerId: string; until: number; }
interface RedSanction { playerId: string; pos: PlayerPosition; until: number; }
interface CardSanctions {
  yellow: YellowSanction[];
  redActive: RedSanction[];
}
interface DiceState {
  active: boolean;
  rolled: boolean;
  announced: boolean;
  count: number;
}
interface PhaseState {
  minuteEvents: MatchEvent[];
  stopAfterPenalty: boolean;
  sequence: MatchAction[] | null;
  homeActiveOutfield: string[];
  awayActiveOutfield: string[];
  homeActiveLineup: string[];
  awayActiveLineup: string[];
  homeAttackers: Player[];
  awayAttackers: Player[];
  homeGK: Player | undefined;
  awayGK: Player | undefined;
  homeAtkAnchors: Record<string, Vector2>;
  awayAtkAnchors: Record<string, Vector2>;
  homeDefAnchors: Record<string, Vector2>;
  awayDefAnchors: Record<string, Vector2>;
}

export interface MatchEngine {
  totalMinutes: number;
  halfTime: number;
  simulateMinute(minute: number, opts?: { withSequence?: boolean }): MinuteResult;
  finalize(shootoutResult: ShootoutResult | null): MatchResult;
  getScore(): { homeGoals: number; awayGoals: number };
  getPlayerStats(): Record<string, PlayerMatchStat>;
  setCard(side: TeamSide, key: SecretCardKey): void;
  getCards(): { home: SecretCardKey | null; away: SecretCardKey | null };
  isCardUsed(side: TeamSide): boolean;
  activateCard(side: TeamSide, key: SecretCardKey, options: ActivateCardOptions, minute: number): EngineEventBatch;
  getAttackers(side: TeamSide): Player[];
  getGK(side: TeamSide): Player | undefined;
  getActiveLineupIds(side: TeamSide, minute: number): string[];
  getOutfieldCap(minute: number): number;
  ESCALIER_END_MINUTE: number;
  MATCHBALL_START_MINUTE: number;
  getAvailableOutfieldIds(side: TeamSide, minute: number): string[];
  triggerPresidentPenalty(side: TeamSide, minute: number, options: TriggerPresidentPenaltyOptions): EngineEventBatch;
  isPresidentPenaltyUsed(side: TeamSide): boolean;
  getPresidents(side: TeamSide): string[];
  isMatchDecided(): boolean;
  getMatchballWinner(): TeamSide | null;
  isSpecialActionWindowOpen(minute: number, kind: SpecialActionKind): boolean;
  getFormationAnchors(side: TeamSide, minute: number): Record<string, FormationAnchor>;
}

export function createMatchEngine(
  homeTeam: Team,
  homeSetup: TacticalSetup,
  awayTeam: Team,
  awaySetup: TacticalSetup,
  rng: () => number = Math.random
): MatchEngine {
  const TOTAL_MINUTES = 40;
  const HALF_TIME = 20;
  const homeBonus = 1.08;

  const EARLY_PHASE_END_MINUTE = 7;
  const EARLY_PHASE_GOAL_BOOST = 1.5;

  const ESCALIER_END_MINUTE = 5;
  const DOUBLE_GOAL_START_MINUTE = 17;
  const DICE_START_MINUTE = 21;
  const DICE_END_MINUTE = 23;
  const MATCHBALL_START_MINUTE = 36;
  const SPECIAL_WINDOW_1: [number, number] = [5, 17];
  const SPECIAL_WINDOW_2: [number, number] = [23, 36];
  const PRESIDENT_PENALTY_DEADLINE = 35;

  const events: MatchEvent[] = [];
  let homeGoals = 0, awayGoals = 0;
  let homeShots = 0, awayShots = 0;
  let homeShotsOnTarget = 0, awayShotsOnTarget = 0;
  let homeXG = 0, awayXG = 0;
  let homePassesAttempted = 0, homePassesCompleted = 0, awayPassesAttempted = 0, awayPassesCompleted = 0;
  let homeInterceptions = 0, awayInterceptions = 0, homeTackles = 0, awayTackles = 0;
  let homeSaves = 0, awaySaves = 0, homeClearances = 0, awayClearances = 0;
  let homeFouls = 0, awayFouls = 0;
  let possessionSum = 0, possessionCount = 0;
  const playerStats: Record<string, PlayerMatchStat> = {};

  const staminaState: Record<TeamSide, Record<string, number>> = { home: {}, away: {} };
  function staminaValue(side: TeamSide, id: string): number {
    const v = staminaState[side][id];
    return v == null ? 100 : v;
  }
  function staminaFactor(side: TeamSide, id: string): number {
    const B = MATCH_BALANCE.stamina;
    return (1 - B.effectSpread) + B.effectSpread * (staminaValue(side, id) / 100);
  }
  function drainStamina(side: TeamSide, ids: string[], extra: number): void {
    const B = MATCH_BALANCE.stamina;
    ids.forEach((id) => {
      staminaState[side][id] = clamp(staminaValue(side, id) - B.drainPerTouch - (extra || 0), B.min, B.max);
    });
  }
  function regenStamina(side: TeamSide, activeIds: string[]): void {
    const B = MATCH_BALANCE.stamina;
    activeIds.forEach((id) => {
      staminaState[side][id] = clamp(staminaValue(side, id) + B.regenPerMinute, B.min, B.max);
    });
  }

  const diceState: DiceState = { active: false, rolled: false, announced: false, count: 6 };
  function ensureDiceRolled(): number {
    if (!diceState.rolled) {
      diceState.rolled = true;
      diceState.count = 1 + Math.floor(rng() * 3);
    }
    return diceState.count;
  }
  let globalDoubleGoalActive = false;
  let matchballDecided = false;
  let matchballWinnerSide: TeamSide | null = null;
  let matchballTarget: number | null = null;
  const presidentState: Record<TeamSide, { used: boolean }> = { home: { used: false }, away: { used: false } };
  const cardSanctions: Record<TeamSide, CardSanctions> = {
    home: { yellow: [], redActive: [] },
    away: { yellow: [], redActive: [] }
  };

  function computeOutfieldCap(minute: number): number {
    if (minute >= MATCHBALL_START_MINUTE) {
      return Math.max(1, 6 - (minute - (MATCHBALL_START_MINUTE - 1)));
    }
    let cap = Math.min(6, minute + 1);
    if (minute >= DICE_START_MINUTE && minute <= DICE_END_MINUTE) {
      cap = Math.min(cap, ensureDiceRolled());
    }
    return cap;
  }
  function getPhaseOutfieldCap(minute: number): number { return Math.max(1, computeOutfieldCap(minute)); }

  function getActiveOutfieldIds(team: Team, setup: TacticalSetup, minute: number, side: TeamSide): string[] {
    const cap = getPhaseOutfieldCap(minute);
    const suspended = new Set(
      cardSanctions[side].yellow.filter((y) => minute <= y.until).map((y) => y.playerId)
    );
    const outfield = setup.lineup
      .map((id) => team.players.find((p) => p.id === id))
      .filter((p): p is Player => !!p && p.pos !== "GK" && !suspended.has(p.id));
    if (outfield.length <= cap) return outfield.map((p) => p.id);

    if (Array.isArray(setup.activeOverride) && setup.activeOverride.length) {
      const overrideIds = setup.activeOverride.filter((id) => outfield.some((p) => p.id === id));
      if (overrideIds.length >= cap) return overrideIds.slice(0, cap);
    }
    return [...outfield].sort((a, b) => b.overall - a.overall).slice(0, cap).map((p) => p.id);
  }

  function isGlobalDoubleGoalActive(minute: number): boolean { return globalDoubleGoalActive && minute <= HALF_TIME; }
  function isInWindow(minute: number, [start, end]: [number, number]): boolean { return minute >= start && minute <= end; }
  function isSpecialActionWindowOpen(minute: number, kind: SpecialActionKind): boolean {
    const deadline = kind === "president" ? PRESIDENT_PENALTY_DEADLINE : SPECIAL_WINDOW_2[1];
    return isInWindow(minute, SPECIAL_WINDOW_1) || isInWindow(minute, [SPECIAL_WINDOW_2[0], deadline]);
  }

  function isMatchDecided(): boolean { return matchballDecided; }
  function getMatchballWinner(): TeamSide | null { return matchballWinnerSide; }

  function getAttackers(team: Team, setup: TacticalSetup): Player[] {
    return setup.lineup
      .map((id) => team.players.find((p) => p.id === id))
      .filter((p): p is Player => !!p && p.pos !== "GK");
  }
  function getGK(team: Team, setup: TacticalSetup): Player | undefined {
    return setup.lineup
      .map((id) => team.players.find((p) => p.id === id))
      .find((p): p is Player => !!p && p.pos === "GK");
  }

  function weightedPick(players: Player[]): Player | null {
    if (players.length === 0) return null;
    const weights = players.map((p) => {
      let w = (p.technique + p.physical + p.speed) / 3;
      if (p.pos === "ATT") w *= 2.2;
      else if (p.pos === "MID") w *= 1.5;
      else w *= 0.6;
      return w;
    });
    const total = weights.reduce((a, b) => a + b, 0);
    let r = rng() * total;
    for (let i = 0; i < players.length; i++) {
      r -= weights[i];
      if (r <= 0) return players[i];
    }
    return players[players.length - 1];
  }

  function recordStat(id: string, field: keyof PlayerMatchStat): void {
    playerStats[id] = playerStats[id] || { goals: 0, assists: 0 };
    playerStats[id][field]++;
  }

  const cardState: Record<TeamSide, CardState> = {
    home: { key: null, used: false, doubleUntil: 0, starPlayerId: null, starUsed: false, sanctionUntil: 0 },
    away: { key: null, used: false, doubleUntil: 0, starPlayerId: null, starUsed: false, sanctionUntil: 0 }
  };

  function setCard(side: TeamSide, key: SecretCardKey): void { cardState[side].key = key; }
  function getCards(): { home: SecretCardKey | null; away: SecretCardKey | null } {
    return { home: cardState.home.key, away: cardState.away.key };
  }
  function isCardUsed(side: TeamSide): boolean { return cardState[side].used; }

  function applyGoalBonus(side: TeamSide, minute: number, scorerId: string | null): string {
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

  function registerGoal(side: TeamSide, minute: number, scorerId: string | null): string {
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

  function removeFromLineup(setupRef: TacticalSetup, playerId: string): void {
    const idx = setupRef.lineup.indexOf(playerId);
    if (idx >= 0) setupRef.lineup.splice(idx, 1);
  }

  function addBenchSubstitute(teamRef: Team, setupRef: TacticalSetup, preferredPos: PlayerPosition): Player | null {
    const benchPool = teamRef.players.filter((p) => !setupRef.lineup.includes(p.id));
    if (benchPool.length === 0) return null;
    const sameRole = benchPool.filter((p) => p.pos === preferredPos);
    const candidates = sameRole.length > 0 ? sameRole : benchPool;
    const best = [...candidates].sort((a, b) => b.overall - a.overall)[0];
    setupRef.lineup.push(best.id);
    return best;
  }

  function performPenaltyAttempt(side: TeamSide, minute: number, options: { taker?: Player; withSequence?: boolean }, label: string): EngineEventBatch {
    const team = side === "home" ? homeTeam : awayTeam;
    const setup = side === "home" ? homeSetup : awaySetup;
    const oppTeam = side === "home" ? awayTeam : homeTeam;
    const oppSetup = side === "home" ? awaySetup : homeSetup;
    const oppGK = getGK(oppTeam, oppSetup);
    const evts: MatchEvent[] = [];
    const sequence: MatchAction[] = [];
    const taker = options.taker || weightedPick(getAttackers(team, setup));
    if (!taker) return { events: evts, sequence };

    if (side === "home") homeShots++; else awayShots++;
    const scored = rng() < (0.7 + taker.mental / 400 - (oppGK ? oppGK.physical / 600 : 0));
    let ev: MatchEvent;
    if (scored) {
      recordStat(taker.id, "goals");
      const tag = registerGoal(side, minute, taker.id);
      ev = { minute, type: "goal", team: team.name, side, scorerId: taker.id, gkId: oppGK ? oppGK.id : null, text: `${minute}' — ⚽ ${label} ! ${taker.name} (${team.name}) transforme et marque !${tag}` };
    } else {
      ev = { minute, type: "save", team: team.name, side, takerId: taker.id, gkId: oppGK ? oppGK.id : null, text: `${minute}' — ⚽ ${label} ! ${taker.name} (${team.name}) tire... mais ${oppGK ? oppGK.name : "le gardien"} arrête !` };
    }
    evts.push(ev);
    if (options.withSequence) {
      const penaltySpot: Vector2 = { x: 50, y: side === "home" ? PITCH_H - 12 : 12 };
      const goalY = side === "home" ? PITCH_H : 0;
      const goalX = clamp(GOAL_X_MIN + rng() * (GOAL_X_MAX - GOAL_X_MIN), GOAL_X_MIN, GOAL_X_MAX);
      const finalY = scored ? goalY : (side === "home" ? goalY - 6 : goalY + 6);
      sequence.push({ type: scored ? "goal" : "save", side, playerId: taker.id, gkId: oppGK ? oppGK.id : null, from: penaltySpot, to: { x: goalX, y: finalY }, duration: 0.9, event: ev });
    }
    return { events: evts, sequence };
  }

  function performShootoutAttempt(side: TeamSide, minute: number, options: { taker?: Player; withSequence?: boolean }, label: string): EngineEventBatch {
    const team = side === "home" ? homeTeam : awayTeam;
    const setup = side === "home" ? homeSetup : awaySetup;
    const oppTeam = side === "home" ? awayTeam : homeTeam;
    const oppSetup = side === "home" ? awaySetup : homeSetup;
    const oppGK = getGK(oppTeam, oppSetup);
    const evts: MatchEvent[] = [];
    const sequence: MatchAction[] = [];
    const shooter = options.taker || weightedPick(getAttackers(team, setup));
    if (!shooter) return { events: evts, sequence };

    if (side === "home") homeShots++; else awayShots++;
    const startPos: Vector2 = { x: 50, y: 50 };
    const goalY = side === "home" ? PITCH_H : 0;
    const goalX = clamp(GOAL_X_MIN + rng() * (GOAL_X_MAX - GOAL_X_MIN), GOAL_X_MIN, GOAL_X_MAX);

    const fault = rng() < 0.08;
    if (fault) {
      const ev: MatchEvent = { minute, type: "miss", team: team.name, side, takerId: shooter.id, text: `${minute}' — 🥊 ${label} ! ${shooter.name} (${team.name}) commet une faute technique, le but est refusé !` };
      evts.push(ev);
      if (options.withSequence) sequence.push({ type: "dribble", side, playerId: shooter.id, from: startPos, to: { x: goalX, y: side === "home" ? goalY - 12 : goalY + 12 }, duration: 0.6, event: ev });
      return { events: evts, sequence };
    }
    const gkFault = rng() < 0.06;
    let chance = 0.55 + shooter.technique / 300 - (oppGK ? oppGK.physical / 500 : 0);
    if (gkFault) chance += 0.3;
    chance = Math.max(0.1, Math.min(0.95, chance));
    const scored = rng() < chance;
    let ev: MatchEvent;
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
      sequence.push({ type: scored ? "goal" : "save", side, playerId: shooter.id, gkId: oppGK ? oppGK.id : null, from: startPos, to: { x: goalX, y: finalY }, duration: 1, event: ev });
    }
    if (!scored && gkFault) {
      const phaseEv: MatchEvent = { minute, type: "phase", text: `🥊 Faute du gardien de ${oppTeam.name} ! Penalty immédiat accordé.` };
      evts.push(phaseEv);
      const penaltyResult = performPenaltyAttempt(side, minute, { taker: shooter, withSequence: options.withSequence }, "Penalty");
      evts.push(...penaltyResult.events);
      if (options.withSequence) {
        sequence.push({ type: "phase", side, playerId: null, from: { x: 50, y: 50 }, to: { x: 50, y: 50 }, duration: 0.6, event: phaseEv });
        sequence.push(...penaltyResult.sequence);
      }
    }
    return { events: evts, sequence };
  }

  function isPresidentPenaltyUsed(side: TeamSide): boolean { return presidentState[side].used; }
  function getPresidents(side: TeamSide): string[] {
    const team = side === "home" ? homeTeam : awayTeam;
    return (team.presidents && team.presidents.length) ? team.presidents : [team.name + " (Président)"];
  }

  function performPresidentPenaltyKick(side: TeamSide, minute: number, presidentName: string): EngineEventBatch {
    const team = side === "home" ? homeTeam : awayTeam;
    const oppTeam = side === "home" ? awayTeam : homeTeam;
    const oppSetup = side === "home" ? awaySetup : homeSetup;
    const oppGK = getGK(oppTeam, oppSetup);
    const evts: MatchEvent[] = [];

    if (side === "home") homeShots++; else awayShots++;
    const chance = Math.max(0.25, Math.min(0.7, 0.5 - (oppGK ? oppGK.physical / 700 : 0)));
    const scored = rng() < chance;
    let ev: MatchEvent;
    if (scored) {
      const tag = registerGoal(side, minute, null);
      ev = { minute, type: "goal", team: team.name, side, scorerId: null, gkId: oppGK ? oppGK.id : null, text: `${minute}' — ⚽ Penalty du Président ! ${presidentName} (président de ${team.name}) s'élance... et MARQUE !${tag}` };
    } else {
      ev = { minute, type: "save", team: team.name, side, takerId: null, gkId: oppGK ? oppGK.id : null, text: `${minute}' — ⚽ Penalty du Président ! ${presidentName} (président de ${team.name}) tire... mais ${oppGK ? oppGK.name : "le gardien"} arrête !` };
    }
    evts.push(ev);
    const penaltySpot: Vector2 = { x: 50, y: side === "home" ? PITCH_H - 12 : 12 };
    const goalY = side === "home" ? PITCH_H : 0;
    const goalX = clamp(GOAL_X_MIN + rng() * (GOAL_X_MAX - GOAL_X_MIN), GOAL_X_MIN, GOAL_X_MAX);
    const finalY = scored ? goalY : (side === "home" ? goalY - 6 : goalY + 6);
    const sequence: MatchAction[] = [{ type: scored ? "goal" : "save", side, playerId: null, gkId: oppGK ? oppGK.id : null, from: penaltySpot, to: { x: goalX, y: finalY }, duration: 0.9, event: ev }];
    return { events: evts, sequence };
  }

  function triggerPresidentPenalty(side: TeamSide, minute: number, options: TriggerPresidentPenaltyOptions): EngineEventBatch {
    if (presidentState[side].used) return { events: [], sequence: [] };
    if (!isSpecialActionWindowOpen(minute, "president")) return { events: [], sequence: [] };
    presidentState[side].used = true;
    const team = side === "home" ? homeTeam : awayTeam;
    const presidents = getPresidents(side);
    const presidentName = options.presidentName && presidents.includes(options.presidentName)
      ? options.presidentName
      : presidents[Math.floor(rng() * presidents.length)];
    const phaseEv: MatchEvent = { minute, type: "phase", text: `🛎️ ${presidentName} actionne le buzzer pour ${team.name} et s'apprête à tirer lui-même le penalty !` };
    const evts: MatchEvent[] = [phaseEv];
    const kickResult = performPresidentPenaltyKick(side, minute, presidentName);
    evts.push(...kickResult.events);
    const sequence: MatchAction[] = [
      { type: "phase", side, playerId: null, from: { x: 50, y: 50 }, to: { x: 50, y: 50 }, duration: 0.6, event: phaseEv },
      ...kickResult.sequence
    ];
    return { events: evts, sequence };
  }

  function activateCard(side: TeamSide, key: SecretCardKey, options: ActivateCardOptions, minute: number): EngineEventBatch {
    if (!isSpecialActionWindowOpen(minute, "card")) return { events: [], sequence: [] };
    const opp: TeamSide = side === "home" ? "away" : "home";
    const team = side === "home" ? homeTeam : awayTeam;
    const setup = side === "home" ? homeSetup : awaySetup;
    const oppTeam = side === "home" ? awayTeam : homeTeam;
    const oppSetup = side === "home" ? awaySetup : homeSetup;
    const evts: MatchEvent[] = [];
    const sequence: MatchAction[] = [];
    const announce = (ev: MatchEvent) => sequence.push({ type: "phase", side, playerId: null, from: { x: 50, y: 50 }, to: { x: 50, y: 50 }, duration: 0.8, event: ev });

    switch (key) {
      case "doubleGoal": {
        cardState[side].doubleUntil = minute + 4;
        const ev: MatchEvent = { minute, type: "phase", text: `🟡 ${team.name} active la Carte But Double ! Pendant 4 minutes, chaque but marqué comptera double.` };
        evts.push(ev); announce(ev);
        break;
      }
      case "sanction": {
        cardState[opp].sanctionUntil = minute + 4;
        const targetName = options.targetName || "un joueur adverse";
        const ev: MatchEvent = { minute, type: "phase", text: `🔴 ${team.name} active la Carte Sanction sur ${targetName} ! ${oppTeam.name} joue à 6 contre 7 pendant 4 minutes.` };
        evts.push(ev); announce(ev);
        break;
      }
      case "penalty": {
        const result = performPenaltyAttempt(side, minute, { taker: options.taker, withSequence: true }, "Carte Penalty");
        evts.push(...result.events);
        sequence.push(...result.sequence);
        break;
      }
      case "shootout": {
        const result = performShootoutAttempt(side, minute, { taker: options.taker, withSequence: true }, "Carte Shootout");
        evts.push(...result.events);
        sequence.push(...result.sequence);
        break;
      }
      case "reversePenalty": {
        const taker = options.taker || weightedPick(getAttackers(oppTeam, oppSetup));
        if (taker) {
          if (opp === "home") homeShots++; else awayShots++;
          const sideGK = getGK(team, setup);
          const scored = rng() < (0.7 + taker.mental / 400 - (sideGK ? sideGK.physical / 600 : 0));
          const penaltySpot: Vector2 = { x: 50, y: opp === "home" ? PITCH_H - 12 : 12 };
          const goalY = opp === "home" ? PITCH_H : 0;
          const goalX = clamp(GOAL_X_MIN + rng() * (GOAL_X_MAX - GOAL_X_MIN), GOAL_X_MIN, GOAL_X_MAX);
          let ev: MatchEvent;
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
          const ev: MatchEvent = { minute, type: "phase", text: `⭐ ${team.name} active la Carte Joueur Étoile sur ${p.name} ! Son prochain but avant la 38e minute comptera double.` };
          evts.push(ev); announce(ev);
        }
        break;
      }
      case "joker": {
        if (options.mode === "steal") {
          if (!cardState[opp].used && cardState[opp].key) {
            const stolenKey = cardState[opp].key;
            cardState[opp].used = true;
            const ev: MatchEvent = { minute, type: "phase", text: `🃏 ${team.name} active le Joker et VOLE la carte adverse !` };
            evts.push(ev); announce(ev);
            const stolenResult = activateCard(side, stolenKey, options, minute);
            evts.push(...stolenResult.events);
            sequence.push(...stolenResult.sequence);
          } else {
            const ev: MatchEvent = { minute, type: "phase", text: `🃏 ${team.name} active le Joker, mais le vol échoue (carte adverse déjà jouée) !` };
            evts.push(ev); announce(ev);
          }
        } else {
          const ev: MatchEvent = { minute, type: "phase", text: `🃏 ${team.name} active le Joker en copiant une autre Arme Secrète !` };
          evts.push(ev); announce(ev);
          if (options.copyKey) {
            const copiedResult = activateCard(side, options.copyKey, options, minute);
            evts.push(...copiedResult.events);
            sequence.push(...copiedResult.sequence);
          }
        }
        break;
      }
    }

    cardState[side].used = true;
    return { events: evts, sequence };
  }

  function issueYellowCard(side: TeamSide, victim: Player, minute: number, minuteEvents: MatchEvent[], seq: MatchAction[] | null, victimPos: Vector2 | undefined): void {
    const teamRef = side === "home" ? homeTeam : awayTeam;
    const setupRef = side === "home" ? homeSetup : awaySetup;
    if (minute >= MATCHBALL_START_MINUTE) {
      removeFromLineup(setupRef, victim.id);
      const sub = addBenchSubstitute(teamRef, setupRef, victim.pos);
      const yellowEv: MatchEvent = {
        minute, type: "yellow", team: teamRef.name, side, playerId: victim.id, inId: sub ? sub.id : null, outId: victim.id,
        text: `${minute}' — 🟨 Carton jaune pour ${victim.name} (${teamRef.name}) ! En Matchball, pas de réduction d'effectif${sub ? `, ${sub.name} le remplace` : ""} — shootout accordé à l'adversaire !`
      };
      minuteEvents.push(yellowEv);
      if (seq) seq.push({ type: "phase", side, playerId: null, from: { x: 50, y: 50 }, to: { x: 50, y: 50 }, duration: 1, event: yellowEv });
      const oppSide: TeamSide = side === "home" ? "away" : "home";
      const oppTeamRef = oppSide === "home" ? homeTeam : awayTeam;
      const oppSetupRef = oppSide === "home" ? homeSetup : awaySetup;
      const shooter = weightedPick(getAttackers(oppTeamRef, oppSetupRef));
      if (shooter) {
        const shootoutResult = performShootoutAttempt(oppSide, minute, { taker: shooter, withSequence: !!seq }, "Shootout (carton jaune)");
        minuteEvents.push(...shootoutResult.events);
        if (seq) seq.push(...shootoutResult.sequence);
      }
    } else {
      cardSanctions[side].yellow.push({ playerId: victim.id, until: minute + 2 });
      const ev: MatchEvent = {
        minute, type: "yellow", team: teamRef.name, side, playerId: victim.id,
        text: `${minute}' — 🟨 Carton jaune pour ${victim.name} (${teamRef.name}) : exclu 2 minutes, ${teamRef.name} joue en infériorité numérique !`
      };
      minuteEvents.push(ev);
      if (seq) {
        const p = victimPos || { x: 50, y: side === "home" ? 30 : 70 };
        seq.push({ type: "phase", side, playerId: victim.id, from: p, to: p, duration: 1.4, event: ev });
      }
    }
  }

  function attemptRealAttack(
    minute: number, minuteEvents: MatchEvent[], side: TeamSide, teamName: string,
    attackers: Player[], defenders: Player[], gk: Player | undefined,
    atkAnchors: Record<string, Vector2>, defAnchors: Record<string, Vector2>,
    attackPlanKey: TacticalSetup["attackPlan"], defensePlanKey: TacticalSetup["defensePlan"],
    attackMod: number, defenseMod: number, earlyPhaseBoost: number,
    ctx: { sequence: MatchAction[] } | null
  ): number | undefined {
    const oppSide: TeamSide = side === "home" ? "away" : "home";
    const defensePressingExtra = defensePlanKey === "high" ? MATCH_BALANCE.stamina.pressingExtraDrain : 0;

    const chain = simulatePossessionChain({
      side, attackers, defenders, gk: gk || null, atkAnchors, defAnchors,
      attackPlanKey, attackMod, defenseMod, earlyPhaseBoost,
      withSequence: !!ctx,
      staminaFactorFor: (id) => staminaFactor(side, id),
      rng
    });
    if (chain.outcome === "none") return;

    if (side === "home") {
      homeShots += chain.attackStats.shots; homeShotsOnTarget += chain.attackStats.shotsOnTarget;
      homeXG += chain.xG; homePassesAttempted += chain.attackStats.passesAttempted; homePassesCompleted += chain.attackStats.passesCompleted;
      homeClearances += chain.attackStats.clearances;
      awayInterceptions += chain.defenseStats.interceptions; awayTackles += chain.defenseStats.tacklesWon; awayFouls += chain.defenseStats.fouls;
    } else {
      awayShots += chain.attackStats.shots; awayShotsOnTarget += chain.attackStats.shotsOnTarget;
      awayXG += chain.xG; awayPassesAttempted += chain.attackStats.passesAttempted; awayPassesCompleted += chain.attackStats.passesCompleted;
      awayClearances += chain.attackStats.clearances;
      homeInterceptions += chain.defenseStats.interceptions; homeTackles += chain.defenseStats.tacklesWon; homeFouls += chain.defenseStats.fouls;
    }
    if (chain.outcome === "save") { if (side === "home") awaySaves++; else homeSaves++; }

    drainStamina(side, chain.touchedIds, 0);
    if (chain.defenseStats.interceptions || chain.defenseStats.tacklesWon || chain.defenseStats.fouls || chain.attackStats.shots) {
      drainStamina(oppSide, chain.touchedIds.filter((id) => attackers.every((p) => p.id !== id)), defensePressingExtra);
    }

    const isShotChain = chain.outcome === "goal" || chain.outcome === "save" || chain.outcome === "miss";
    if (ctx && isShotChain && chain.recoveryLine) {
      const recoveryEv: MatchEvent = { minute, type: "phase", team: teamName, side, text: `${minute}' — ${chain.recoveryLine}` };
      minuteEvents.push(recoveryEv);
      if (chain.beats.length) chain.beats[0].event = recoveryEv;
    }
    if (ctx && isShotChain && chain.leadIn) {
      const leadEv: MatchEvent = { minute, type: "phase", team: teamName, side, text: `${minute}' — ${chain.leadIn}` };
      minuteEvents.push(leadEv);
      if (chain.beats.length >= 2) chain.beats[chain.beats.length - 2].event = leadEv;
    }

    let ev: MatchEvent | null = null;
    if (chain.outcome === "goal" && chain.scorer) {
      recordStat(chain.scorer.id, "goals");
      let assistText = "";
      if (chain.assister) { recordStat(chain.assister.id, "assists"); assistText = ` (passe décisive de ${chain.assister.name})`; }
      const goalTag = registerGoal(side, minute, chain.scorer.id);
      ev = {
        minute, type: "goal", team: teamName, side, scorerId: chain.scorer.id, assisterId: chain.assister ? chain.assister.id : null, gkId: chain.gk ? chain.gk.id : null, xG: Math.round(chain.xG * 100) / 100,
        text: `${minute}' — BUT ! ${chain.scorer.name} (${teamName}) marque${assistText} !${goalTag}`
      };
    } else if (chain.outcome === "save" && chain.scorer) {
      ev = {
        minute, type: "save", team: teamName, side, takerId: chain.scorer.id, gkId: chain.gk ? chain.gk.id : null, xG: Math.round(chain.xG * 100) / 100,
        text: `${minute}' — Tir de ${chain.scorer.name}, arrêt du gardien ${chain.gk ? chain.gk.name : "adverse"} !`
      };
    } else if (chain.outcome === "miss" && chain.scorer) {
      ev = {
        minute, type: "miss", team: teamName, side, takerId: chain.scorer.id, xG: Math.round(chain.xG * 100) / 100,
        text: `${minute}' — ${chain.scorer.name} tente sa chance mais le tir passe à côté.`
      };
    }
    if (ev) {
      minuteEvents.push(ev);
      if (ctx && chain.beats.length) chain.beats[chain.beats.length - 1].event = ev;
    }
    if (ctx) ctx.sequence.push(...chain.beats);

    if (chain.foul) {
      if (chain.foul.severity === "penalty") {
        const penaltyResult = performPenaltyAttempt(side, minute, { taker: chain.foul.against, withSequence: !!ctx }, "Penalty (faute dans la surface)");
        minuteEvents.push(...penaltyResult.events);
        if (ctx) ctx.sequence.push(...penaltyResult.sequence);
      } else {
        issueYellowCard(oppSide, chain.foul.by, minute, minuteEvents, ctx ? ctx.sequence : null, defAnchors[chain.foul.by.id]);
      }
    }
    return chain.attackStats.possessionActions;
  }

  function advancePhaseState(minute: number, withSequence: boolean): PhaseState {
    const minuteEvents: MatchEvent[] = [];
    const sequence: MatchAction[] | null = withSequence ? [] : null;
    const announce = (ev: MatchEvent) => { if (sequence) sequence.push({ type: "phase", side: ev.side || null, playerId: null, from: { x: 50, y: 50 }, to: { x: 50, y: 50 }, duration: 1, event: ev }); };

    (([["home", homeSetup, homeTeam], ["away", awaySetup, awayTeam]]) as [TeamSide, TacticalSetup, Team][]).forEach(([side, setupRef, teamRef]) => {
      const sanctions = cardSanctions[side];
      sanctions.redActive = sanctions.redActive.filter((entry) => {
        if (minute > entry.until) {
          const sub = addBenchSubstitute(teamRef, setupRef, entry.pos);
          if (sub) {
            const ev: MatchEvent = {
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

    const prevCap = computeOutfieldCap(minute - 1);
    const curCap = computeOutfieldCap(minute);
    if (minute <= ESCALIER_END_MINUTE && curCap > prevCap) {
      const ev: MatchEvent = {
        minute, type: "phase",
        text: `🔼 Un nouveau joueur entre sur le terrain pour chaque équipe (${curCap + 1}v${curCap + 1}) !`
      };
      minuteEvents.push(ev);
      if (withSequence) announce(ev);
    }

    if (minute === DOUBLE_GOAL_START_MINUTE && !globalDoubleGoalActive) {
      globalDoubleGoalActive = true;
      const ev: MatchEvent = {
        minute, type: "phase",
        text: `🟠 Un ballon d'une autre couleur entre en jeu ! Tous les buts comptent double jusqu'à la mi-temps !`
      };
      minuteEvents.push(ev);
      if (withSequence) announce(ev);
    }

    if (minute === DICE_START_MINUTE && !diceState.announced) {
      diceState.announced = true;
      diceState.active = true;
      const count = ensureDiceRolled();
      const ev: MatchEvent = {
        minute, type: "phase",
        text: `🎲 LE DÉ GÉANT tombe sur ${count} ! Format ${count}v${count} jusqu'à la 23e minute !`
      };
      minuteEvents.push(ev);
      if (withSequence) announce(ev);
    }
    if (minute === DICE_END_MINUTE + 1 && diceState.active) {
      diceState.active = false;
      const ev: MatchEvent = { minute, type: "phase", text: "🔼 Retour au format complet (7v7) !" };
      minuteEvents.push(ev);
      if (withSequence) announce(ev);
    }

    if (minute === MATCHBALL_START_MINUTE && matchballTarget === null && !matchballDecided) {
      if (homeGoals === awayGoals) {
        matchballDecided = true;
        const ev: MatchEvent = {
          minute, type: "phase",
          text: `🏆 MATCHBALL ! Égalité au coup d'envoi du Matchball : le match se décide directement aux tirs au but !`
        };
        minuteEvents.push(ev);
        if (withSequence) announce(ev);
      } else {
        matchballTarget = Math.max(homeGoals, awayGoals) + 1;
        const ev: MatchEvent = {
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
    const homeAttackers = homeActiveOutfield.map((id) => homeTeam.players.find((p) => p.id === id)).filter((p): p is Player => !!p);
    const awayAttackers = awayActiveOutfield.map((id) => awayTeam.players.find((p) => p.id === id)).filter((p): p is Player => !!p);
    const homeGK = homeGKPlayer;
    const awayGK = awayGKPlayer;

    const homeAtkAnchors = computeSideAnchors(homeSetup, homeActiveOutfield, "home", true);
    const awayAtkAnchors = computeSideAnchors(awaySetup, awayActiveOutfield, "away", true);
    const homeDefAnchors = computeSideAnchors(homeSetup, homeActiveOutfield, "home", false);
    const awayDefAnchors = computeSideAnchors(awaySetup, awayActiveOutfield, "away", false);
    function anchorFor(side: TeamSide, playerId: string): Vector2 {
      const anchors = side === "home" ? homeAtkAnchors : awayAtkAnchors;
      return (anchors && anchors[playerId]) || { x: 50, y: side === "home" ? 30 : 70 };
    }

    if (rng() < 0.004) {
      const side: TeamSide = rng() < 0.5 ? "home" : "away";
      const pool = side === "home" ? homeActiveLineup.map((id) => homeTeam.players.find((p) => p.id === id)) : awayActiveLineup.map((id) => awayTeam.players.find((p) => p.id === id));
      const filteredPool = pool.filter((p): p is Player => !!p);
      const victim = filteredPool[Math.floor(rng() * filteredPool.length)];
      if (victim) {
        const severityRoll = rng();
        const tier = INJURY_SEVERITY_TIERS.find((t) => severityRoll < t.chance);
        if (tier) {
          const daysOut = tier.minDays + Math.floor(rng() * (tier.maxDays - tier.minDays + 1));
          victim.injuryDaysLeft = Math.max(victim.injuryDaysLeft || 0, daysOut);
          victim.injurySeverity = tier.label;
          victim.injured = true;
          const ev: MatchEvent = {
            minute, type: "injury", team: side === "home" ? homeTeam.name : awayTeam.name, side, playerId: victim.id,
            text: `${minute}' — ${victim.name} se blesse (${tier.label}) : indisponible ${daysOut} jour${daysOut > 1 ? "s" : ""} !`
          };
          minuteEvents.push(ev);
          if (withSequence && sequence) {
            const pos = anchorFor(side, victim.id);
            sequence.push({ type: "phase", side, playerId: victim.id, from: pos, to: pos, duration: 1.4, event: ev });
          }
        }
      }
    }

    if (rng() < 0.012) {
      const side: TeamSide = rng() < 0.5 ? "home" : "away";
      const pool = side === "home" ? homeAttackers : awayAttackers;
      const victim = pool[Math.floor(rng() * pool.length)];
      if (victim) issueYellowCard(side, victim, minute, minuteEvents, withSequence ? sequence : null, anchorFor(side, victim.id));
    }

    if (rng() < 0.002) {
      const side: TeamSide = rng() < 0.5 ? "home" : "away";
      const pool = side === "home"
        ? homeAttackers.concat(homeGK ? [homeGK] : [])
        : awayAttackers.concat(awayGK ? [awayGK] : []);
      const victim = pool[Math.floor(rng() * pool.length)];
      if (victim) {
        const setupRef = side === "home" ? homeSetup : awaySetup;
        const teamRef = side === "home" ? homeTeam : awayTeam;
        const redEv: MatchEvent = {
          minute, type: "red", team: teamRef.name, side, playerId: victim.id,
          text: `${minute}' — CARTON ROUGE ! ${victim.name} est expulsé !`
        };
        minuteEvents.push(redEv);
        if (withSequence && sequence) {
          const pos = anchorFor(side, victim.id);
          sequence.push({ type: "phase", side, playerId: victim.id, from: pos, to: pos, duration: 1.4, event: redEv });
        }
        removeFromLineup(setupRef, victim.id);
        if (minute >= MATCHBALL_START_MINUTE) {
          const oppSide: TeamSide = side === "home" ? "away" : "home";
          const phaseEv: MatchEvent = { minute, type: "phase", text: "🔴 Carton rouge en Matchball : penalty immédiat accordé à l'adversaire !" };
          minuteEvents.push(phaseEv);
          if (withSequence) announce(phaseEv);
          const penaltyResult = performPenaltyAttempt(oppSide, minute, { withSequence }, "Penalty (carton rouge)");
          minuteEvents.push(...penaltyResult.events);
          if (withSequence && sequence) sequence.push(...penaltyResult.sequence);
        } else {
          cardSanctions[side].redActive.push({ playerId: victim.id, pos: victim.pos, until: minute + 5 });
        }
      }
    }

    let stopAfterPenalty = false;
    if (rng() < 0.006) {
      const isHome = rng() < 0.5;
      const side: TeamSide = isHome ? "home" : "away";
      const attackersPool = isHome ? homeAttackers : awayAttackers;
      const taker = weightedPick(attackersPool);
      const penaltyResult = performPenaltyAttempt(side, minute, { taker: taker || undefined, withSequence }, "PENALTY");
      minuteEvents.push(...penaltyResult.events);
      if (withSequence && sequence) sequence.push(...penaltyResult.sequence);
      stopAfterPenalty = true;
    }

    return {
      minuteEvents, stopAfterPenalty, sequence,
      homeActiveOutfield, awayActiveOutfield, homeActiveLineup, awayActiveLineup,
      homeAttackers, awayAttackers, homeGK, awayGK,
      homeAtkAnchors, awayAtkAnchors, homeDefAnchors, awayDefAnchors
    };
  }

  function simulateMinute(minute: number, opts?: { withSequence?: boolean }): MinuteResult {
    const withSequence = !!(opts && opts.withSequence);
    const phase = advancePhaseState(minute, withSequence);
    const minuteEvents = phase.minuteEvents;
    if (phase.stopAfterPenalty) {
      events.push(...minuteEvents);
      return { events: minuteEvents, sequence: withSequence ? phase.sequence : null, stopAfterPenalty: true };
    }

    const { homeActiveOutfield, awayActiveOutfield, homeActiveLineup, awayActiveLineup, homeAttackers, awayAttackers, homeGK, awayGK } = phase;
    const sequence = phase.sequence;

    const homeStrength = computeTeamStrength(homeTeam, homeActiveLineup);
    const awayStrength = computeTeamStrength(awayTeam, awayActiveLineup);

    const homeAtk = getAttackPlan(homeSetup.attackPlan);
    const awayAtk = getAttackPlan(awaySetup.attackPlan);
    const homeDef = getDefensePlan(homeSetup.defensePlan);
    const awayDef = getDefensePlan(awaySetup.defensePlan);

    const homeSanctioned = minute <= cardState.home.sanctionUntil;
    const awaySanctioned = minute <= cardState.away.sanctionUntil;
    const homeRedPenalty = 1 - (cardSanctions.home.redActive.length + (homeSanctioned ? 1 : 0)) * 0.12;
    const awayRedPenalty = 1 - (cardSanctions.away.redActive.length + (awaySanctioned ? 1 : 0)) * 0.12;

    const homeAttackPower = homeStrength.overall * homeAtk.goalMod * homeBonus * homeRedPenalty * formationAttackFactor(homeSetup.formation);
    const awayAttackPower = awayStrength.overall * awayAtk.goalMod * awayRedPenalty * formationAttackFactor(awaySetup.formation);
    const homeDefenseFactor = (awayDef.concedeMod / homeRedPenalty) / formationDefenseFactor(awaySetup.formationOOP || awaySetup.formation);
    const awayDefenseFactor = (homeDef.concedeMod / awayRedPenalty) / formationDefenseFactor(homeSetup.formationOOP || homeSetup.formation);
    const homeAttackMod = clamp(homeAttackPower / 65, 0.75, 1.4);
    const awayAttackMod = clamp(awayAttackPower / 65, 0.75, 1.4);
    const homeDefenseMod = clamp(1 / homeDefenseFactor, 0.75, 1.4);
    const awayDefenseMod = clamp(1 / awayDefenseFactor, 0.75, 1.4);

    regenStamina("home", homeActiveLineup);
    regenStamina("away", awayActiveLineup);

    if (rng() < 0.0006) {
      const isHomeOG = rng() < 0.5;
      const team = isHomeOG ? homeTeam : awayTeam;
      const activeOutfieldIds = isHomeOG ? homeActiveOutfield : awayActiveOutfield;
      const lineupPlayers = activeOutfieldIds.map((id) => team.players.find((p) => p.id === id)).filter((p): p is Player => !!p);
      const victim = lineupPlayers[Math.floor(rng() * lineupPlayers.length)];
      if (victim) {
        const ownGoalSide: TeamSide = isHomeOG ? "home" : "away";
        const tag = registerGoal(isHomeOG ? "away" : "home", minute, null);
        const ev: MatchEvent = { minute, type: "owngoal", team: team.name, side: ownGoalSide, scorerId: victim.id, text: `${minute}' — Catastrophe ! But contre son camp de ${victim.name} (${team.name}) !${tag}` };
        minuteEvents.push(ev);
        if (withSequence && sequence) {
          const anchors = ownGoalSide === "home" ? phase.homeAtkAnchors : phase.awayAtkAnchors;
          const pos = (anchors && anchors[victim.id]) || { x: 50, y: ownGoalSide === "home" ? 30 : 70 };
          const ownGoalYValue = ownGoalSide === "home" ? 0 : PITCH_H;
          const goalX = clamp(GOAL_X_MIN + rng() * (GOAL_X_MAX - GOAL_X_MIN), GOAL_X_MIN, GOAL_X_MAX);
          sequence.push({ type: "owngoal", side: ownGoalSide, playerId: victim.id, from: pos, to: { x: goalX, y: ownGoalYValue }, duration: 0.8, event: ev });
        }
      }
    }

    const earlyPhase = minute <= EARLY_PHASE_END_MINUTE;
    const earlyPhaseBoost = earlyPhase ? EARLY_PHASE_GOAL_BOOST : 1;
    const ctx = withSequence && sequence ? { sequence } : null;

    let homeActions = 0, awayActions = 0;
    const homeChains = planChainCount(homeSetup.attackPlan, earlyPhase, rng);
    for (let i = 0; i < homeChains; i++) {
      homeActions += attemptRealAttack(minute, minuteEvents, "home", homeTeam.name, homeAttackers, awayAttackers, awayGK, phase.homeAtkAnchors, phase.awayDefAnchors, homeSetup.attackPlan, awaySetup.defensePlan, homeAttackMod, homeDefenseMod, earlyPhaseBoost, ctx) || 0;
    }
    const awayChains = planChainCount(awaySetup.attackPlan, earlyPhase, rng);
    for (let i = 0; i < awayChains; i++) {
      awayActions += attemptRealAttack(minute, minuteEvents, "away", awayTeam.name, awayAttackers, homeAttackers, homeGK, phase.awayAtkAnchors, phase.homeDefAnchors, awaySetup.attackPlan, homeSetup.defensePlan, awayAttackMod, awayDefenseMod, earlyPhaseBoost, ctx) || 0;
    }

    const totalActions = homeActions + awayActions;
    const homePossession = totalActions > 0 ? Math.round((homeActions / totalActions) * 100) : 50;
    possessionSum += homePossession;
    possessionCount++;

    events.push(...minuteEvents);
    return { events: minuteEvents, sequence: withSequence ? sequence : null, possession: homePossession, stopAfterPenalty: false };
  }

  function finalize(shootoutResult: ShootoutResult | null): MatchResult {
    const ratings: Record<string, number> = {};
    function rateLineup(team: Team, setup: TacticalSetup, won: boolean, draw: boolean): void {
      setup.lineup.forEach((id) => {
        const p = team.players.find((pl) => pl.id === id);
        if (!p) return;
        let base = 5.5 + (p.form - 75) / 25 + (rng() * 1.2 - 0.6);
        const stat = playerStats[id];
        if (stat) base += stat.goals * 1.2 + stat.assists * 0.7;
        if (won) base += 0.4; else if (draw) base += 0.1; else base -= 0.3;
        ratings[id] = Math.max(1, Math.min(10, Math.round(base * 10) / 10));
      });
    }

    const tied = homeGoals === awayGoals;
    let won = homeGoals > awayGoals;
    let lost = homeGoals < awayGoals;
    let penaltyWinner: TeamSide | null = null;
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
      shootout: shootoutResult || null,
      homeShotsOnTarget, awayShotsOnTarget,
      homeXG: Math.round(homeXG * 100) / 100, awayXG: Math.round(awayXG * 100) / 100,
      homePassesAttempted, homePassesCompleted, awayPassesAttempted, awayPassesCompleted,
      homeInterceptions, awayInterceptions, homeTackles, awayTackles,
      homeSaves, awaySaves, homeClearances, awayClearances,
      homeFouls, awayFouls
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
    getAttackers: (side: TeamSide) => getAttackers(side === "home" ? homeTeam : awayTeam, side === "home" ? homeSetup : awaySetup),
    getGK: (side: TeamSide) => getGK(side === "home" ? homeTeam : awayTeam, side === "home" ? homeSetup : awaySetup),
    getActiveLineupIds: (side: TeamSide, minute: number) => {
      const team = side === "home" ? homeTeam : awayTeam;
      const setup = side === "home" ? homeSetup : awaySetup;
      const gkPlayer = getGK(team, setup);
      const outfieldIds = getActiveOutfieldIds(team, setup, minute, side);
      return gkPlayer ? [gkPlayer.id, ...outfieldIds] : outfieldIds;
    },
    getOutfieldCap: (minute: number) => getPhaseOutfieldCap(minute),
    ESCALIER_END_MINUTE,
    MATCHBALL_START_MINUTE,
    getAvailableOutfieldIds: (side: TeamSide, minute: number) => {
      const team = side === "home" ? homeTeam : awayTeam;
      const setup = side === "home" ? homeSetup : awaySetup;
      const suspended = new Set(
        cardSanctions[side].yellow.filter((y) => minute <= y.until).map((y) => y.playerId)
      );
      return setup.lineup
        .map((id) => team.players.find((p) => p.id === id))
        .filter((p): p is Player => !!p && p.pos !== "GK" && !suspended.has(p.id))
        .map((p) => p.id);
    },
    triggerPresidentPenalty,
    isPresidentPenaltyUsed,
    getPresidents,
    isMatchDecided,
    getMatchballWinner,
    isSpecialActionWindowOpen,
    getFormationAnchors: (side: TeamSide, minute: number) => {
      const team = side === "home" ? homeTeam : awayTeam;
      const setup = side === "home" ? homeSetup : awaySetup;
      const gkPlayer = getGK(team, setup);
      const outfieldIds = getActiveOutfieldIds(team, setup, minute, side);
      const anchors = computeSideAnchors(setup, outfieldIds, side, true) as Record<string, FormationAnchor>;
      outfieldIds.forEach((id) => {
        const p = team.players.find((pl) => pl.id === id);
        if (anchors[id] && p) anchors[id].pos = p.pos;
      });
      if (gkPlayer) anchors[gkPlayer.id] = { x: 50, y: gkAnchorY(side), pos: "GK" };
      return anchors;
    }
  };
}

const MAX_SIM_MATCH_MINUTE = 200;

export function simulateMatch(homeTeam: Team, homeSetup: TacticalSetup, awayTeam: Team, awaySetup: TacticalSetup, rng: () => number = Math.random): MatchResult {
  const engine = createMatchEngine(homeTeam, homeSetup, awayTeam, awaySetup, rng);
  for (let minute = 1; minute <= engine.totalMinutes || (!engine.isMatchDecided() && minute <= MAX_SIM_MATCH_MINUTE); minute++) {
    engine.simulateMinute(minute);
    if (engine.isMatchDecided()) break;
  }
  const score = engine.getScore();
  const shootout = score.homeGoals === score.awayGoals
    ? simulatePenaltyShootout(homeTeam, homeSetup, awayTeam, awaySetup, rng)
    : null;
  return engine.finalize(shootout);
}

export function applyMatchPlayerStats(team: Team, setup: TacticalSetup, result: MatchResult): void {
  setup.lineup.forEach((id) => {
    const p = team.players.find((pl) => pl.id === id);
    if (!p) return;
    const stat = result.playerStats[id];
    const rating = result.ratings[id] || 6;
    if (stat) { p.goals += stat.goals || 0; p.assists += stat.assists || 0; }
    p.ratingSum = (p.ratingSum || 0) + rating;
    if (stat) { p.careerGoals = (p.careerGoals || 0) + (stat.goals || 0); p.careerAssists = (p.careerAssists || 0) + (stat.assists || 0); }
    p.careerRatingSum = (p.careerRatingSum || 0) + rating;
  });
}

export function updateFormAfterMatch(team: Team, setup: TacticalSetup, goalsFor: number, goalsAgainst: number, ratings: Record<string, number>, rng: () => number = Math.random): void {
  team.players.forEach((p) => {
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
      developPlayer(p, r, rng);
    } else {
      p.form = Math.max(40, Math.min(99, p.form - 1));
    }
  });
}

const DEV_ATTRS: ("speed" | "technique" | "physical" | "mental")[] = ["speed", "technique", "physical", "mental"];

export function developPlayer(p: Player, rating: number, rng: () => number = Math.random): void {
  let growthChance: number, declineChance: number;
  if (p.age <= 21) { growthChance = 0.30; declineChance = 0; }
  else if (p.age <= 25) { growthChance = 0.18; declineChance = 0; }
  else if (p.age <= 29) { growthChance = 0.08; declineChance = 0.02; }
  else if (p.age <= 33) { growthChance = 0.02; declineChance = 0.10; }
  else { growthChance = 0; declineChance = 0.18; }

  if (rating >= 7.5 && rng() < growthChance + 0.1) {
    bumpAttribute(p, 1, rng);
  } else if (rating >= 6.5 && rng() < growthChance) {
    bumpAttribute(p, 1, rng);
  } else if (rating < 5 && rng() < declineChance) {
    bumpAttribute(p, -1, rng);
  }

  p.overall = Math.round((p.speed + p.technique + p.physical + p.mental) / 4);
  const { min: VALUE_STAR_MIN, max: VALUE_STAR_MAX } = getValueStarBounds();
  const stars = Math.max(0, Math.min(5, (p.overall - VALUE_STAR_MIN) / (VALUE_STAR_MAX - VALUE_STAR_MIN) * 5));
  const valueMultiplier = 0.55 + 0.85 * Math.pow(stars / 5, 1.8);
  p.value = Math.round(p.overall * 1000 * valueMultiplier);
}

export function bumpAttribute(p: Player, delta: number, rng: () => number = Math.random): void {
  const attr = DEV_ATTRS[Math.floor(rng() * DEV_ATTRS.length)];
  p[attr] = Math.max(30, Math.min(99, p[attr] + delta));
}

export function simulatePenaltyShootout(homeTeam: Team, homeSetup: TacticalSetup, awayTeam: Team, awaySetup: TacticalSetup, rng: () => number = Math.random): ShootoutResult {
  const events: MatchEvent[] = [];

  function shooters(team: Team, setup: TacticalSetup): Player[] {
    return setup.lineup
      .map((id) => team.players.find((p) => p.id === id))
      .filter((p): p is Player => !!p && p.pos !== "GK")
      .sort((a, b) => (b.technique + b.mental) - (a.technique + a.mental));
  }
  function gk(team: Team, setup: TacticalSetup): Player | undefined {
    return setup.lineup.map((id) => team.players.find((p) => p.id === id)).find((p): p is Player => !!p && p.pos === "GK");
  }

  const homeShooters = shooters(homeTeam, homeSetup);
  const awayShooters = shooters(awayTeam, awaySetup);
  const homeGK = gk(homeTeam, homeSetup);
  const awayGK = gk(awayTeam, awaySetup);

  let homeScore = 0, awayScore = 0;

  events.push({ type: "phase", text: "🥅 Séance de tirs au but ! Chaque tireur s'élance depuis le rond central, seul face au gardien." });

  function takeKick(team: Team, taker: Player, opposingGK: Player | undefined, round: number): boolean {
    const fault = rng() < 0.05;
    if (fault) {
      events.push({ type: "shootout miss", text: `Tir n°${round} — ${taker.name} (${team.name}) part du milieu de terrain mais perd le contrôle du ballon !` });
      return false;
    }
    const gkFault = rng() < 0.05;
    let chance = 0.55 + taker.technique / 300 - (opposingGK ? opposingGK.physical / 500 : 0);
    if (gkFault) chance += 0.25;
    chance = Math.max(0.35, Math.min(0.92, chance));
    const scored = rng() < chance;
    if (scored) {
      events.push({ type: "shootout", text: `Tir n°${round} — ${taker.name} (${team.name}) part du milieu de terrain, élimine le gardien et marque !` });
    } else {
      events.push({ type: "shootout miss", text: `Tir n°${round} — ${taker.name} (${team.name}) s'élance depuis le milieu... mais ${opposingGK ? opposingGK.name : "le gardien"} sort vainqueur du face-à-face !` });
    }
    return scored;
  }

  for (let i = 0; i < 5; i++) {
    const homeTaker = homeShooters[i % homeShooters.length];
    const awayTaker = awayShooters[i % awayShooters.length];
    if (homeTaker && takeKick(homeTeam, homeTaker, awayGK, i + 1)) homeScore++;
    if (awayTaker && takeKick(awayTeam, awayTaker, homeGK, i + 1)) awayScore++;

    const remaining = 5 - (i + 1);
    if (Math.abs(homeScore - awayScore) > remaining) break;
  }

  let round = 6;
  while (homeScore === awayScore) {
    const homeTaker = homeShooters[(round - 1) % homeShooters.length];
    const awayTaker = awayShooters[(round - 1) % awayShooters.length];
    const homeScored = homeTaker ? takeKick(homeTeam, homeTaker, awayGK, round) : false;
    const awayScored = awayTaker ? takeKick(awayTeam, awayTaker, homeGK, round) : false;
    if (homeScored) homeScore++;
    if (awayScored) awayScore++;
    round++;
    if (round > 20) break;
  }

  const homeWins = homeScore > awayScore;
  events.push({
    type: "phase",
    text: `🏆 ${homeWins ? homeTeam.name : awayTeam.name} remporte la séance de tirs au but ${homeScore} - ${awayScore} !`
  });

  return { events, homeScore, awayScore, homeWins };
}
```

- [ ] **Step 2: Type-check**

Run: `npm run build`
Expected: clean. If `homeShooters`/`awayShooters` empty-array indexing or similar raises no error (tsconfig does not set `noUncheckedIndexedAccess`), that's expected — matches every other file in this migration so far.

- [ ] **Step 3: Commit**

```bash
git add src/match/MatchEngine.ts
git commit -m "$(cat <<'EOF'
Port engine.js's core match orchestration to TypeScript (MatchEngine.ts)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01VVyw7NW46uymNTs4Cnoacb
EOF
)"
```

---

### Task 3: Vitest suite

**Files:**
- Create: `src/tests/MatchEngine.test.ts`

**Interfaces:**
- Consumes: everything exported from `src/match/MatchEngine.ts` (Task 2), plus the `makeTestPlayer`/`buildTestSquad`/`buildTestSetup` fixture pattern from `src/tests/ActionEngine.test.ts` (Phase 4), duplicated locally (small enough not to warrant a shared test-utils module yet — revisit if a third test file needs it).

- [ ] **Step 1: Write `src/tests/MatchEngine.test.ts`**

```ts
import { describe, it, expect, beforeAll } from "vitest";
import type { Player, PlayerPosition, FormationKey } from "../data/types";
import type { FormationSlot } from "../data/types";
import {
  createMatchEngine, simulateMatch, simulatePenaltyShootout,
  applyMatchPlayerStats, updateFormAfterMatch, developPlayer, bumpAttribute
} from "../match/MatchEngine";

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
    },
    FORMATIONS: {
      "1-2-2-2": { name: "2-2-2", gk: 1, def: 2, mid: 2, att: 2 },
      "1-3-2-1": { name: "3-2-1", gk: 1, def: 3, mid: 2, att: 1 },
      "1-2-3-1": { name: "2-3-1", gk: 1, def: 2, mid: 3, att: 1 }
    },
    ATTACK_PLANS: {
      direct: { name: "Jeu direct", desc: "...", goalMod: 1.1, possMod: 0.9 },
      possession: { name: "Possession", desc: "...", goalMod: 0.95, possMod: 1.25 },
      transition: { name: "Transition rapide", desc: "...", goalMod: 1.15, possMod: 1.0 }
    },
    DEFENSE_PLANS: {
      low: { name: "Bloc bas", desc: "...", concedeMod: 0.85, riskMod: 0.9 },
      high: { name: "Pressing haut", desc: "...", concedeMod: 1.15, riskMod: 1.2 },
      zone: { name: "Défense en zone", desc: "...", concedeMod: 1.0, riskMod: 1.0 }
    },
    VALUE_STAR_MIN: 60,
    VALUE_STAR_MAX: 95
  });
});

function makeTestPlayer(id: string, name: string, pos: PlayerPosition, overall: number, age = 25): Player {
  return {
    id, name, pos,
    speed: overall, technique: overall, physical: overall, mental: overall, overall,
    form: 80, age, value: 100000,
    goals: 0, assists: 0, rating: 0, matches: 0,
    careerGoals: 0, careerAssists: 0, careerMatches: 0, careerRatingSum: 0,
    injured: false, injuryDaysLeft: 0, injurySeverity: null, suspended: false
  };
}

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

function buildTestTeam(id: string, name: string, overall: number) {
  return { id, name, color: "#ffffff", budget: 100000, coach: "Coach", presidents: ["President"], players: buildTestSquad(overall) };
}

describe("createMatchEngine: constantes Kings League", () => {
  it("ESCALIER_END_MINUTE et MATCHBALL_START_MINUTE ont les valeurs officielles", () => {
    const home = buildTestTeam("h", "Home FC", 65);
    const away = buildTestTeam("a", "Away FC", 65);
    const engine = createMatchEngine(home, buildTestSetup(home.players), away, buildTestSetup(away.players));
    expect(engine.ESCALIER_END_MINUTE).toBe(5);
    expect(engine.MATCHBALL_START_MINUTE).toBe(36);
  });

  it("getOutfieldCap suit l'escalier de départ (1v1 -> 7v7) puis l'escalier inversé du Matchball (5v5 -> 1v1)", () => {
    const home = buildTestTeam("h", "Home FC", 65);
    const away = buildTestTeam("a", "Away FC", 65);
    const engine = createMatchEngine(home, buildTestSetup(home.players), away, buildTestSetup(away.players));
    expect(engine.getOutfieldCap(0)).toBe(1);
    expect(engine.getOutfieldCap(1)).toBe(2);
    expect(engine.getOutfieldCap(4)).toBe(5);
    expect(engine.getOutfieldCap(5)).toBe(6);
    expect(engine.getOutfieldCap(10)).toBe(6);
    expect(engine.getOutfieldCap(36)).toBe(5);
    expect(engine.getOutfieldCap(37)).toBe(4);
    expect(engine.getOutfieldCap(40)).toBe(1);
    expect(engine.getOutfieldCap(50)).toBe(1);
  });
});

describe("createMatchEngine + simulateMinute: simulation complète (40 min) sans erreur", () => {
  it("match humain (withSequence) et match IA (sans séquence) sont structurellement compatibles", () => {
    function makeEngines() {
      const home = buildTestTeam("h", "Home FC", 65);
      const away = buildTestTeam("a", "Away FC", 65);
      return {
        human: createMatchEngine(home, buildTestSetup(home.players), away, buildTestSetup(away.players)),
        ai: createMatchEngine(buildTestTeam("h2", "Home FC 2", 65), buildTestSetup(buildTestSquad(65)), buildTestTeam("a2", "Away FC 2", 65), buildTestSetup(buildTestSquad(65)))
      };
    }
    const { human: engineHuman, ai: engineAi } = makeEngines();
    for (let m = 1; m <= 40; m++) engineHuman.simulateMinute(m, { withSequence: true });
    const resultHuman = engineHuman.finalize(null);
    for (let m = 1; m <= 40; m++) engineAi.simulateMinute(m);
    const resultAi = engineAi.finalize(null);

    (["homeGoals", "awayGoals", "homeShots", "awayShots", "homeXG", "awayXG", "homePossession", "awayPossession"] as const).forEach((key) => {
      expect(typeof resultHuman[key]).toBe("number");
      expect(Number.isNaN(resultHuman[key])).toBe(false);
      expect(typeof resultAi[key]).toBe("number");
      expect(Number.isNaN(resultAi[key])).toBe(false);
    });
  });
});

describe("simulateMinute: séquence de beats", () => {
  const CHOREO_BEAT_TYPES = ["pass", "cross", "carry", "dribble", "tackle", "interception", "clear", "out", "press", "shot", "goal", "save", "miss", "owngoal", "phase"];

  it("withSequence:true produit une séquence de beats structurellement valide, minute après minute", () => {
    const home = buildTestTeam("h", "Home FC", 65);
    const away = buildTestTeam("a", "Away FC", 65);
    const engine = createMatchEngine(home, buildTestSetup(home.players), away, buildTestSetup(away.players));
    const allIds = new Set([...home.players.map((p) => p.id), ...away.players.map((p) => p.id)]);
    for (let minute = 1; minute <= 40; minute++) {
      const result = engine.simulateMinute(minute, { withSequence: true });
      expect(Array.isArray(result.sequence)).toBe(true);
      (result.sequence || []).forEach((beat) => {
        expect(CHOREO_BEAT_TYPES).toContain(beat.type);
        (["from", "to"] as const).forEach((k) => {
          expect(beat[k].x).toBeGreaterThanOrEqual(0);
          expect(beat[k].x).toBeLessThanOrEqual(100);
          expect(beat[k].y).toBeGreaterThanOrEqual(0);
          expect(beat[k].y).toBeLessThanOrEqual(100);
        });
        expect(typeof beat.duration).toBe("number");
        expect(beat.duration).toBeGreaterThanOrEqual(0);
        [beat.playerId, beat.toPlayerId, beat.gkId].forEach((id) => {
          expect(id == null || allIds.has(id)).toBe(true);
        });
      });
      if (engine.isMatchDecided()) break;
    }
  });

  it("sans options, ne construit aucune séquence (chemin IA inchangé, coût nul)", () => {
    const home = buildTestTeam("h", "Home FC", 65);
    const away = buildTestTeam("a", "Away FC", 65);
    const engine = createMatchEngine(home, buildTestSetup(home.players), away, buildTestSetup(away.players));
    for (let minute = 1; minute <= 10; minute++) {
      const result = engine.simulateMinute(minute);
      expect(result.sequence).toBeNull();
    }
  });
});

describe("getFormationAnchors", () => {
  it("une ancre par joueur actif (GK inclus), toutes sur le terrain", () => {
    const home = buildTestTeam("h", "Home FC", 65);
    const away = buildTestTeam("a", "Away FC", 65);
    const engine = createMatchEngine(home, buildTestSetup(home.players), away, buildTestSetup(away.players));
    const anchors = engine.getFormationAnchors("home", 20);
    expect(Object.keys(anchors).length).toBe(7);
    Object.values(anchors).forEach((a) => {
      expect(a.x).toBeGreaterThanOrEqual(0);
      expect(a.x).toBeLessThanOrEqual(100);
      expect(a.y).toBeGreaterThanOrEqual(0);
      expect(a.y).toBeLessThanOrEqual(100);
    });
  });
});

describe("simulatePenaltyShootout", () => {
  it("jamais de match nul (règle Kings League), scores cohérents avec le vainqueur", () => {
    for (let i = 0; i < 30; i++) {
      const home = buildTestTeam("h", "Home FC", 65);
      const away = buildTestTeam("a", "Away FC", 65);
      const result = simulatePenaltyShootout(home, buildTestSetup(home.players), away, buildTestSetup(away.players));
      expect(result.homeScore).not.toBe(result.awayScore);
      expect(result.homeWins).toBe(result.homeScore > result.awayScore);
      expect(result.events.length).toBeGreaterThan(0);
    }
  });
});

describe("simulateMatch", () => {
  it("ne se termine jamais sur une égalité (tirs au but si besoin)", () => {
    for (let i = 0; i < 5; i++) {
      const home = buildTestTeam("h", "Home FC", 65);
      const away = buildTestTeam("a", "Away FC", 65);
      const result = simulateMatch(home, buildTestSetup(home.players), away, buildTestSetup(away.players));
      const decided = result.homeGoals !== result.awayGoals || result.penaltyWinner !== null;
      expect(decided).toBe(true);
    }
  });
});

describe("applyMatchPlayerStats / updateFormAfterMatch / developPlayer", () => {
  it("les stats carrière s'accumulent et la forme reste bornée [40,99]", () => {
    const team = buildTestTeam("h", "Home FC", 65);
    const setup = buildTestSetup(team.players);
    const result = simulateMatch(team, setup, buildTestTeam("a", "Away FC", 65), buildTestSetup(buildTestSquad(65)));
    applyMatchPlayerStats(team, setup, result);
    team.players.forEach((p) => {
      if (setup.lineup.includes(p.id)) {
        expect(p.ratingSum).toBeGreaterThan(0);
        expect(p.careerRatingSum).toBeGreaterThan(0);
      }
    });
    updateFormAfterMatch(team, setup, result.homeGoals, result.awayGoals, result.ratings);
    team.players.forEach((p) => {
      expect(p.form).toBeGreaterThanOrEqual(40);
      expect(p.form).toBeLessThanOrEqual(99);
    });
  });

  it("developPlayer recalcule overall/value de façon cohérente après une progression forcée", () => {
    const p = makeTestPlayer("x", "X", "MID", 70, 20);
    const before = p.overall;
    let changed = false;
    for (let i = 0; i < 50 && !changed; i++) {
      developPlayer(p, 8);
      if (p.overall !== before) changed = true;
    }
    expect(changed).toBe(true);
    expect(p.overall).toBeGreaterThanOrEqual(30);
    expect(p.overall).toBeLessThanOrEqual(99);
    expect(p.value).toBeGreaterThan(0);
  });

  it("bumpAttribute reste dans les bornes [30,99]", () => {
    const p = makeTestPlayer("x", "X", "MID", 98);
    for (let i = 0; i < 20; i++) bumpAttribute(p, 1);
    (["speed", "technique", "physical", "mental"] as const).forEach((attr) => {
      expect(p[attr]).toBeLessThanOrEqual(99);
    });
    const p2 = makeTestPlayer("y", "Y", "MID", 31);
    for (let i = 0; i < 20; i++) bumpAttribute(p2, -1);
    (["speed", "technique", "physical", "mental"] as const).forEach((attr) => {
      expect(p2[attr]).toBeGreaterThanOrEqual(30);
    });
  });
});
```

- [ ] **Step 2: Run it**

Run: `npm test`
Expected: all pass. Given this is a faithful port with the same probabilistic structure as `ActionEngine.ts` (which passed 29/29 on the first run), a first-run failure most likely indicates a real port bug (a formula/branch transcribed incorrectly) — compare carefully against the literal `engine.js` source before changing a test's expectation.

- [ ] **Step 3: Full verification**

Run, in order: `npm run build`, `npm test`, `npm run test:legacy` (expect unchanged `59/60`), `npm run lint`.
Expected: all green, no regressions.

- [ ] **Step 4: Commit**

```bash
git add src/tests/MatchEngine.test.ts
git commit -m "$(cat <<'EOF'
Add Vitest suite for MatchEngine (Kings League rules, full-match, shootout, progression)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01VVyw7NW46uymNTs4Cnoacb
EOF
)"
```

---

### Task 4: Documentation

**Files:**
- Modify: `docs/superpowers/plans/2026-09-04-phaser-ts-migration-roadmap.md`

- [ ] **Step 1: Update the roadmap with a "Phase 5A — done" note**

Record: what's ported vs. deferred to Phase 5B (`generateSchedule`, `computeStandings`, `computeTopScorers/Assists/Ratings`, `chooseAiFormation`, `chooseAiPlans`, `simulateAIMatch`, `runBalanceSimulation`, `fillPositionGaps`, `simulateAITransfers` — still only in `engine.js`); the `EngineEventBatch`/`MinuteResult` design (replaces bolted-on array properties); the single-closure-rng pattern for `createMatchEngine` vs. explicit-parameter rng for top-level functions; the two `legacyDataAdapter.ts`/`MatchTypes.ts` extensions this phase needed and why (a reminder that every phase touching more of `engine.js` will likely need one or two more).

- [ ] **Step 2: Commit**

```bash
git add docs
git commit -m "$(cat <<'EOF'
Document Phase 5A completion (core match engine port)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01VVyw7NW46uymNTs4Cnoacb
EOF
)"
```

---

## Definition of done for Phase 5A

- [ ] `src/match/MatchEngine.ts` exists: `createMatchEngine`, `simulateMatch`, `simulatePenaltyShootout`, `applyMatchPlayerStats`, `updateFormAfterMatch`, `developPlayer`, `bumpAttribute`, `formationAttackFactor`, `formationDefenseFactor`, `computeTeamStrength`, `INJURY_SEVERITY_TIERS` — faithful, typed, injectable RNG.
- [ ] `src/tests/MatchEngine.test.ts` covers: exact Kings League constants (`ESCALIER_END_MINUTE`, `MATCHBALL_START_MINUTE`), the full escalier/matchball `getOutfieldCap` schedule, a full 40-minute match (human + AI paths), beat-sequence validity, `getFormationAnchors`, penalty shootout (never a draw), `simulateMatch` (never undecided), and player-progression bookkeeping.
- [ ] `npm run build`, `npm test`, `npm run test:legacy` (`59/60`, unchanged), `npm run lint` all pass.
- [ ] Zero changes to `engine.js` or any other pre-existing `.js`/`.html` file.
- [ ] Roadmap updated, Phase 5B scope explicitly named as still pending.

Do not start Phase 5B (schedule/standings/AI/transfers) or Phase 6 in this plan — write Phase 5B's own bite-sized plan once this Definition of Done is fully checked off.
