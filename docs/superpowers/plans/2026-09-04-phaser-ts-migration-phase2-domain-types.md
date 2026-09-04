# Phase 2 — Domain Types Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add strict TypeScript type declarations for every domain/match concept named in the user's migration spec (`Player`, `Team`, `Formation`, `TacticalSetup`, `MatchState`, `PlayerMatchState`, `BallState`, `MatchAction`, `MatchEvent`, `MatchStatistics`, `MovementIntent`, `PlayerRole`, `PossessionState`, `MatchSnapshot`, `TeamShape`, `TeamPhase`, `Vector2`) plus the legacy data-shape types Phase 3's adapter will need (`League`, `FormationSlot`, `AttackPlan`, `DefensePlan`, `SecretCard`) — with **zero runtime behavior change**. This is pure `.ts` type-only work; nothing in `data.js`/`engine.js`/`matchengine-actions.js`/`matchchoreo.js`/`app.js` is touched.

**Architecture:** Two new files, matching the roadmap's indicative `src/` layout:
- `src/data/types.ts` — types for the STATIC data currently in `data.js` (players, teams, leagues, formations, tactical plans, secret cards). These mirror the real object shapes read directly out of `data.js` in Phase 1's research (see the roadmap's "Current-state summary"), not invented from scratch.
- `src/match/MatchTypes.ts` — types for a LIVE match: the legacy interchange shapes (`TacticalSetup`, `MatchAction` — the typed successor of today's "beat" objects from `matchengine-actions.js`/`matchchoreo.js`, `MatchEvent`, `MatchStatistics`) AND the new forward-looking simulation/rendering shapes the spec asks for (`Vector2`, `PlayerRole`, `PossessionState`, `MovementIntent`, `TeamShape`, `TeamPhase`, `BallState`, `PlayerMatchState`, `MatchState`, `MatchSnapshot`). The new shapes are additive scaffolding for Phase 4-9; nothing constructs them at runtime yet.

A `src/tests/types.test.ts` Vitest file exercises every exported type by constructing one valid literal object per interface/type alias (this is the practical "test" for type-only code — if a field is missing, wrong, or misspelled, `tsc`/Vitest's type-checking fails to compile before any assertion even runs).

**Tech Stack:** TypeScript 6.0.x strict (unchanged from Phase 1). No new dependencies.

**Spec:** `docs/superpowers/plans/2026-09-04-phaser-ts-migration-roadmap.md` (roadmap) and the user's full migration brief it summarizes — in particular the `MovementIntent`, `TeamShape`, `TeamPhase`, `MatchSnapshot`, `BallState`, `PlayerMatchState` code blocks given verbatim in that brief, and the `Player`/`Team`/`Formation`/etc. real shapes recorded in the roadmap's "Current-state summary" (from direct reads of `data.js`/`engine.js`/`matchengine-actions.js`/`matchchoreo.js` done in Phase 1).

## Global Constraints

(carried forward from Phase 1's plan, still in force for the whole migration)

- TypeScript strict mode; avoid `any`.
- Zero behavior change — this phase adds ONLY `.ts` files with type/interface declarations (and one test file); no existing file's runtime behavior changes.
- `data.js`/`matchengine-actions.js`/`engine.js`/`matchchoreo.js`/`app.js` are NOT modified.
- Never delete or rewrite `tests.js`/`tests-node.js`/`tests.html`.
- All old `localStorage` saves must keep loading (automatically true — nothing here touches `STATE`/`applySaveData`).
- Kings League rules (40-minute match, escalier, double-goal window, dé géant, matchball, secret cards, president penalty, cards/exclusions/reduced squads, no draws) are UNCHANGED — this phase only names concepts already implemented in `engine.js`, it does not reimplement them.

## Design notes carried into the types below (read before reviewing the code)

Two of the spec's named types have real ambiguity the spec itself doesn't fully resolve; the choices made here are documented inline in the type files too, not just here:

- **`PlayerRole` vs `MovementIntent`'s `type` field**: the spec lists both as separate named types but only gives a field list for `MovementIntent` (which already has a `type` union of 15 intent kinds). `PlayerRole` is defined as `MovementIntent["type"]` — the same 15-value union, extracted as its own named type so rendering/debug code (Phase 7/11) can reference "the role a player currently has" without importing the whole `MovementIntent` interface. This is not inventing a second, different role taxonomy alongside the intent one — there is exactly one taxonomy, exposed under two names for two different call sites.
- **`MatchSnapshot.phase: MatchPhase`**: the spec's `MatchSnapshot` snippet uses a type called `MatchPhase`, but the only `phase`-shaped type the spec actually defines by name is `TeamPhase` (`settledPossession | attackingTransition | settledDefense | defensiveTransition | setPiece`), which is explicitly a **per-team** tactical transition state (a team is in `attackingTransition` right after ITS side wins the ball; the other team is simultaneously in `defensiveTransition`) — it cannot be a single value for the whole match. Meanwhile `engine.js` already tracks a genuinely match-wide clock phase for the Kings League rules (escalier 0-5', normal play, ballon spécial 17-20', dé géant 21-23', matchball 36'+) via `type: "phase"` commentary events and time-window constants. `MatchPhase` is defined here as that Kings League rule-clock enum (`"escalier" | "normal" | "specialBall" | "giantDice" | "matchball"`), used for `MatchSnapshot.phase`; `TeamPhase` is kept as its own, separate, per-side type for Phase 6's collective-movement system to attach however it needs (e.g. one per side, not on `MatchSnapshot` directly) — not wired into `MatchSnapshot` in this phase, since the spec doesn't show where per-side phase belongs and forcing a guess now would risk a wrong shape Phase 6 has to undo.
- **`PossessionState`**: not given a field/value list anywhere in the spec. Defined here as `"inPossession" | "outOfPossession" | "contested"`, generalizing the boolean `possessing = ballSide === p.side` check `matchchoreo.js:assignRoles` already makes per player, plus a `"contested"` value for loose-ball moments (mid-tackle/interception) the current system doesn't distinguish but the richer intent taxonomy (`counterPress`, `recover`) implies is needed.
- **`MatchAction`**: the spec lists this as a required type without a field list. Defined here as the direct typed successor of the existing "beat" object (`matchengine-actions.js:makeBeat`/consumed by `matchchoreo.js`) — `{ type, side, playerId, toPlayerId, gkId, from, to, duration, event }` — since that is already the real atomic action record the whole pipeline (`ActionEngine` in Phase 4 → `CollectiveMovement` in Phase 6 → `MatchScene` in Phase 7) passes around; giving it a new, different shape would create a pointless translation step.
- **`MatchState` vs `MatchSnapshot`**: per the spec's own architecture diagram (`ActionEngine → MatchState → CollectiveMovement → MatchSnapshot → MatchScene`), `MatchState` is the broader MUTABLE simulation state (score, minute, tactical setups, teams, accumulated statistics/events) that Phase 5's `MatchEngine.ts` will own — the TS-side merge of what's currently split between `engine.js:createMatchEngine`'s closure variables and `app.js`'s `matchState` global. `MatchSnapshot` is the leaner, READ-ONLY per-frame payload handed to rendering. `MatchState` here covers the fields with clear real-world equivalents (`minute`, `homeTeam`/`awayTeam`, `homeSetup`/`awaySetup`, goals, `paused`/`finished`, matchball decision, `events`, `statistics`); it intentionally does NOT yet include the more implementation-specific closure state (`cardState`, `cardSanctions`, `staminaState`, `diceState`, `presidentState`) — Phase 5 adds those once the actual port work settles their exact shape, rather than guessing here and risking a mismatch that has to be undone.

---

### Task 1: `src/data/types.ts` — static domain data types

**Files:**
- Create: `src/data/types.ts`

**Interfaces:**
- Produces: `PlayerPosition`, `Player`, `Team`, `LeagueKey`, `League`, `FormationKey`, `Formation`, `FormationSlot`, `AttackPlanKey`, `AttackPlan`, `DefensePlanKey`, `DefensePlan`, `SecretCardKey`, `SecretCard` — all exported, all consumed by Task 2's file and by Phase 3's legacy data adapter.

- [x] **Step 1: Write `src/data/types.ts`**

```ts
// Types du domaine STATIQUE (data.js) : postes, joueurs, équipes, ligues, formations, plans
// tactiques, cartes secrètes. Reflètent fidèlement les formes réelles observées dans data.js
// (voir docs/superpowers/plans/2026-09-04-phaser-ts-migration-roadmap.md) — data.js lui-même
// n'est pas encore porté en TypeScript (Phase 3 lui ajoute un adaptateur typé, sans le réécrire).

export type PlayerPosition = "GK" | "DEF" | "MID" | "ATT";

export interface Player {
  id: string;
  name: string;
  pos: PlayerPosition;
  speed: number;
  technique: number;
  physical: number;
  mental: number;
  overall: number;
  form: number;
  age: number;
  value: number;
  goals: number;
  assists: number;
  rating: number;
  matches: number;
  /** Somme des notes de la saison en cours ; absente tant qu'aucun match noté ne l'a initialisée
   * (voir engine.js, toujours lu via `p.ratingSum || 0`). Remise à 0 par startNewSeason. */
  ratingSum?: number;
  careerGoals: number;
  careerAssists: number;
  careerMatches: number;
  careerRatingSum: number;
  injured: boolean;
  injuryDaysLeft: number;
  injurySeverity: string | null;
  suspended: boolean;
}

export interface Team {
  id: string;
  name: string;
  color: string;
  budget: number;
  coach: string;
  presidents: string[];
  players: Player[];
}

export type LeagueKey = "france" | "brazil" | "spain" | "italy" | "germany" | "mexico";

export interface League {
  name: string;
  teams: Team[];
}

export type FormationKey = "1-2-2-2" | "1-3-2-1" | "1-2-3-1";

export interface Formation {
  name: string;
  gk: number;
  def: number;
  mid: number;
  att: number;
}

export interface FormationSlot {
  pos: PlayerPosition;
  x: number;
  y: number;
}

export type AttackPlanKey = "direct" | "possession" | "transition";

export interface AttackPlan {
  name: string;
  desc: string;
  goalMod: number;
  possMod: number;
}

export type DefensePlanKey = "low" | "high" | "zone";

export interface DefensePlan {
  name: string;
  desc: string;
  concedeMod: number;
  riskMod: number;
}

export type SecretCardKey =
  | "doubleGoal"
  | "sanction"
  | "penalty"
  | "shootout"
  | "starPlayer"
  | "reversePenalty"
  | "joker";

export interface SecretCard {
  key: SecretCardKey;
  name: string;
  icon: string;
  desc: string;
  risk: number;
}
```

- [x] **Step 2: Type-check**

Run: `npm run build`
Expected: `tsc --noEmit` passes with no errors (this file has no test yet — Task 3 adds the construction test that actually exercises every field).

- [x] **Step 3: Commit**

```bash
git add src/data/types.ts
git commit -m "$(cat <<'EOF'
Add TypeScript types for static domain data (Player, Team, League, ...)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01VVyw7NW46uymNTs4Cnoacb
EOF
)"
```

---

### Task 2: `src/match/MatchTypes.ts` — match/movement/rendering types

**Files:**
- Create: `src/match/MatchTypes.ts`

**Interfaces:**
- Consumes: `Player`, `Team` from `src/data/types.ts` (Task 1).
- Produces: `TeamSide`, `Vector2`, `TacticalSetup`, `MatchActionType`, `MatchAction`, `MatchEvent`, `MatchStatistics`, `MatchPhase`, `TeamPhase`, `PossessionState`, `MovementIntent`, `PlayerRole`, `TeamShape`, `BallState`, `PlayerMatchState`, `MatchState`, `MatchSnapshot` — all exported, consumed by every later phase (`ActionEngine.ts`, `MatchEngine.ts`, `CollectiveMovement.ts`, `MatchScene.ts`, `MatchBridge.ts`).

- [x] **Step 1: Write `src/match/MatchTypes.ts`**

```ts
import type { Team } from "../data/types";
import type { FormationKey, AttackPlanKey, DefensePlanKey } from "../data/types";

export type TeamSide = "home" | "away";

export interface Vector2 {
  x: number;
  y: number;
}

/** Composition/tactique d'une équipe pour UN match — reflète setup.{lineup,assignments,...}
 * tel qu'utilisé aujourd'hui par engine.js/app.js (voir la feuille de route). `assignments`/
 * `assignmentsOOP` sont un slot par entrée de FORMATION_SLOTS[formation] (7 entrées, `null` = slot
 * vide) ; `lineup` est la liste des ids réellement alignés, dérivée d'`assignments.filter(Boolean)`. */
export interface TacticalSetup {
  lineup: string[];
  assignments: (string | null)[];
  assignmentsOOP?: (string | null)[];
  formation: FormationKey;
  formationOOP?: FormationKey;
  attackPlan: AttackPlanKey;
  defensePlan: DefensePlanKey;
  activeOverride?: string[] | null;
  escalierOrder?: string[] | null;
  matchballOrder?: string[] | null;
}

/** Types d'action identiques à ceux déjà produits par matchengine-actions.js (makeBeat) et
 * consommés par matchchoreo.js — voir le commentaire d'en-tête de matchchoreo.js. */
export type MatchActionType =
  | "pass"
  | "cross"
  | "carry"
  | "dribble"
  | "tackle"
  | "interception"
  | "clear"
  | "out"
  | "press"
  | "shot"
  | "goal"
  | "save"
  | "miss"
  | "owngoal"
  | "phase";

/** Successeur typé du "beat" existant (matchengine-actions.js:makeBeat) : l'unité atomique que
 * l'ActionEngine (Phase 4) produit et que CollectiveMovement/MatchScene (Phases 6-7) consomment.
 * `playerId`/`toPlayerId`/`gkId` sont nullable comme aujourd'hui (ex. un beat "clear" n'a pas de
 * receveur ; un beat "phase" n'a pas de joueur du tout). */
export interface MatchAction {
  type: MatchActionType;
  side: TeamSide | null;
  playerId: string | null;
  toPlayerId?: string | null;
  gkId?: string | null;
  from: Vector2;
  to: Vector2;
  duration: number;
  event: MatchEvent | null;
}

/** Événement de commentaire tel que produit aujourd'hui par engine.js (voir attemptRealAttack,
 * issueYellowCard, activateCard, performPenaltyAttempt...). Volontairement permissif (la plupart
 * des champs optionnels) : les différents types d'événement n'utilisent pas tous les mêmes champs
 * (ex. un événement "phase" de shootout n'a ni `minute` ni `side`), et une union discriminante
 * stricte sera dérivée pendant le port réel (Phase 5) une fois chaque site de construction
 * comparé au type. Ne pas resserrer ce type au jugé avant ce moment-là. */
export interface MatchEvent {
  type: "goal" | "save" | "miss" | "yellow" | "red" | "injury" | "owngoal" | "phase";
  text: string;
  minute?: number;
  team?: string;
  side?: TeamSide;
  scorerId?: string | null;
  assisterId?: string | null;
  takerId?: string | null;
  gkId?: string | null;
  playerId?: string | null;
  inId?: string | null;
  outId?: string | null;
  xG?: number;
}

/** Statistiques agrégées d'un match, mêmes champs que le retour de engine.js:finalize()
 * (hors events/playerStats/ratings/penaltyWinner/shootout, qui ne sont pas des "statistiques"). */
export interface MatchStatistics {
  homeGoals: number;
  awayGoals: number;
  homeShots: number;
  awayShots: number;
  homeShotsOnTarget: number;
  awayShotsOnTarget: number;
  homePossession: number;
  awayPossession: number;
  homeXG: number;
  awayXG: number;
  homePassesAttempted: number;
  homePassesCompleted: number;
  awayPassesAttempted: number;
  awayPassesCompleted: number;
  homeInterceptions: number;
  awayInterceptions: number;
  homeTackles: number;
  awayTackles: number;
  homeSaves: number;
  awaySaves: number;
  homeClearances: number;
  awayClearances: number;
  homeFouls: number;
  awayFouls: number;
}

/** Phase d'horloge Kings League (échelle du MATCH ENTIER, pas par équipe) : escalier de départ
 * (0-5'), jeu normal, ballon spécial (17-20', buts doubles), dé géant (21-23'), Matchball (36'+).
 * Voir la note de design en tête de ce plan pour la distinction avec TeamPhase (par équipe). */
export type MatchPhase = "escalier" | "normal" | "specialBall" | "giantDice" | "matchball";

/** État collectif d'UNE équipe (par équipe, pas par match — voir la note de design en tête de ce
 * plan). Alimente le système de mouvement collectif (Phase 6) ; pas encore rattaché à MatchState/
 * MatchSnapshot dans cette phase. */
export type TeamPhase =
  | "settledPossession"
  | "attackingTransition"
  | "settledDefense"
  | "defensiveTransition"
  | "setPiece";

/** Rapport d'UN joueur à la possession, généralise le booléen `possessing = ballSide === p.side`
 * déjà calculé par matchchoreo.js:assignRoles ; "contested" couvre les instants de ballon disputé
 * (tacle/interception en cours) qu'assignRoles ne distingue pas aujourd'hui mais que les intentions
 * counterPress/recover (Phase 6) impliquent de distinguer. */
export type PossessionState = "inPossession" | "outOfPossession" | "contested";

/** Intention de déplacement d'un joueur — remplace le système de rôle "à plat" de matchchoreo.js
 * (shortSupport/forwardRunner/wideSupport/restDefense/primaryPresser/coverDefender/farSideCompact/
 * holdShape) par une taxonomie plus riche et STABLE (expiresAt : une intention ne doit pas changer
 * à chaque frame). Voir docs/superpowers/plans/2026-09-04-phaser-ts-migration-roadmap.md pour le
 * contexte complet de ce que ce système remplace. */
export interface MovementIntent {
  type:
    | "holdShape"
    | "support"
    | "overlap"
    | "underlap"
    | "runInBehind"
    | "dropBetweenLines"
    | "provideWidth"
    | "cover"
    | "press"
    | "mark"
    | "trackRunner"
    | "protectGoal"
    | "counterPress"
    | "recover"
    | "receivePass";
  target: Vector2;
  urgency: number;
  expiresAt: number;
  relatedPlayerId?: string;
}

/** Étiquette de rôle courant d'un joueur, pour l'affichage/le debug (Phase 7/11) sans avoir besoin
 * de tout l'objet MovementIntent (target/urgency/expiresAt). Même taxonomie que MovementIntent.type
 * — voir la note de design en tête de ce plan : il n'y a qu'une seule taxonomie de rôle. */
export type PlayerRole = MovementIntent["type"];

/** Forme collective dynamique d'une équipe (Phase 6) : centre du bloc, largeur/longueur occupées,
 * ligne défensive/de pressing, compacité — calculée selon le ballon, la possession, la formation,
 * le plan tactique, la phase de transition, le score, la fatigue et l'infériorité numérique. */
export interface TeamShape {
  center: Vector2;
  width: number;
  length: number;
  defensiveLine: number;
  pressingLine: number;
  compactness: number;
}

/** État du ballon, indépendant des sprites Phaser — voir la note "Ballon" du brief de migration.
 * `ownerId` est nul pendant une passe/un tir tant que personne n'a contrôlé/repris le ballon. */
export interface BallState {
  position: Vector2;
  previousPosition: Vector2;
  velocity: Vector2;
  height: number;
  ownerId: string | null;
  targetPosition: Vector2 | null;
  trajectory: "controlled" | "groundPass" | "loftedPass" | "cross" | "shot" | "loose";
}

/** État d'un joueur DANS le match (position/vitesse/intention/forme physique) — distinct du
 * `Player` statique (data/types.ts), qui décrit ses attributs/carrière, pas son état sur le
 * terrain à l'instant t. */
export interface PlayerMatchState {
  id: string;
  position: Vector2;
  previousPosition: Vector2;
  velocity: Vector2;
  facing: Vector2;
  intent: MovementIntent;
  stamina: number;
  active: boolean;
}

/** État mutable complet d'un match en cours — ce que possédera MatchEngine.ts (Phase 5), fusion
 * TypeScript de ce qui est aujourd'hui réparti entre la fermeture de engine.js:createMatchEngine
 * et le global `matchState` d'app.js. Voir la note de design en tête de ce plan : ce type ne
 * couvre pas encore l'état interne le plus spécifique à l'implémentation (cartons, fatigue par
 * joueur, dé géant, président...) — Phase 5 l'étend une fois ce port réellement écrit. */
export interface MatchState {
  minute: number;
  totalMinutes: number;
  halfTime: number;
  homeTeam: Team;
  awayTeam: Team;
  homeSetup: TacticalSetup;
  awaySetup: TacticalSetup;
  homeGoals: number;
  awayGoals: number;
  paused: boolean;
  finished: boolean;
  matchDecided: boolean;
  matchballWinnerSide: TeamSide | null;
  events: MatchEvent[];
  statistics: MatchStatistics;
}

/** Payload LECTURE SEULE par frame, produit par CollectiveMovement (Phase 6) et consommé
 * uniquement par MatchScene (Phase 7) — jamais l'inverse. Voir le diagramme d'architecture du
 * brief : ActionEngine → MatchState → CollectiveMovement → MatchSnapshot → MatchScene. */
export interface MatchSnapshot {
  matchTime: number;
  possessionSide: TeamSide | null;
  phase: MatchPhase;
  ball: BallState;
  players: Record<string, PlayerMatchState>;
  events: MatchEvent[];
}
```

- [x] **Step 2: Type-check**

Run: `npm run build`
Expected: `tsc --noEmit` passes with no errors.

- [x] **Step 3: Commit**

```bash
git add src/match/MatchTypes.ts
git commit -m "$(cat <<'EOF'
Add TypeScript types for match/movement/rendering domain

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01VVyw7NW46uymNTs4Cnoacb
EOF
)"
```

---

### Task 3: Construction test exercising every exported type

**Files:**
- Create: `src/tests/types.test.ts`

**Interfaces:**
- Consumes: every type from `src/data/types.ts` and `src/match/MatchTypes.ts` (Tasks 1-2).

- [x] **Step 1: Write the test**

```ts
import { describe, it, expect } from "vitest";
import type {
  Player,
  Team,
  League,
  Formation,
  FormationSlot,
  AttackPlan,
  DefensePlan,
  SecretCard
} from "../data/types";
import type {
  Vector2,
  TacticalSetup,
  MatchAction,
  MatchEvent,
  MatchStatistics,
  MovementIntent,
  PlayerRole,
  PossessionState,
  TeamShape,
  TeamPhase,
  MatchPhase,
  BallState,
  PlayerMatchState,
  MatchState,
  MatchSnapshot
} from "../match/MatchTypes";

// Un objet littéral par type exporté : si un champ manque, est mal nommé ou mal typé, `tsc`
// refuse de compiler ce fichier AVANT même que Vitest n'exécute la moindre assertion — c'est le
// vrai "test rouge" possible pour du code qui ne fait que déclarer des types.

const player: Player = {
  id: "p1", name: "Test Player", pos: "MID",
  speed: 70, technique: 70, physical: 70, mental: 70, overall: 70,
  form: 80, age: 24, value: 500000,
  goals: 0, assists: 0, rating: 0, matches: 0,
  careerGoals: 0, careerAssists: 0, careerMatches: 0, careerRatingSum: 0,
  injured: false, injuryDaysLeft: 0, injurySeverity: null, suspended: false
};

const team: Team = {
  id: "t1", name: "Test FC", color: "#ffffff", budget: 100000,
  coach: "Coach", presidents: ["President"], players: [player]
};

const league: League = { name: "France", teams: [team] };

const formation: Formation = { name: "2-2-2", gk: 1, def: 2, mid: 2, att: 2 };
const formationSlot: FormationSlot = { pos: "GK", x: 50, y: 90 };
const attackPlan: AttackPlan = { name: "Possession", desc: "...", goalMod: 0.95, possMod: 1.25 };
const defensePlan: DefensePlan = { name: "Bloc bas", desc: "...", concedeMod: 0.85, riskMod: 0.9 };
const secretCard: SecretCard = { key: "doubleGoal", name: "But Double", icon: "🟡", desc: "...", risk: 2 };

const vector: Vector2 = { x: 50, y: 50 };

const tacticalSetup: TacticalSetup = {
  lineup: ["p1"],
  assignments: ["p1", null, null, null, null, null, null],
  formation: "1-2-2-2",
  attackPlan: "possession",
  defensePlan: "zone"
};

const matchEvent: MatchEvent = { type: "goal", text: "BUT !", minute: 12, side: "home", scorerId: "p1" };

const matchAction: MatchAction = {
  type: "pass", side: "home", playerId: "p1", toPlayerId: "p2", gkId: null,
  from: vector, to: { x: 60, y: 40 }, duration: 0.6, event: null
};

const matchStatistics: MatchStatistics = {
  homeGoals: 1, awayGoals: 0, homeShots: 3, awayShots: 1,
  homeShotsOnTarget: 2, awayShotsOnTarget: 0, homePossession: 55, awayPossession: 45,
  homeXG: 1.1, awayXG: 0.3, homePassesAttempted: 20, homePassesCompleted: 17,
  awayPassesAttempted: 15, awayPassesCompleted: 11, homeInterceptions: 2, awayInterceptions: 3,
  homeTackles: 4, awayTackles: 2, homeSaves: 1, awaySaves: 2, homeClearances: 3, awayClearances: 5,
  homeFouls: 1, awayFouls: 2
};

const movementIntent: MovementIntent = {
  type: "runInBehind", target: vector, urgency: 0.8, expiresAt: 12.5, relatedPlayerId: "p1"
};

const playerRole: PlayerRole = "press";
const possessionState: PossessionState = "contested";

const teamShape: TeamShape = {
  center: vector, width: 40, length: 60, defensiveLine: 30, pressingLine: 70, compactness: 0.6
};

const teamPhase: TeamPhase = "attackingTransition";
const matchPhase: MatchPhase = "specialBall";

const ballState: BallState = {
  position: vector, previousPosition: vector, velocity: { x: 1, y: 0 },
  height: 0, ownerId: "p1", targetPosition: null, trajectory: "controlled"
};

const playerMatchState: PlayerMatchState = {
  id: "p1", position: vector, previousPosition: vector, velocity: { x: 0, y: 0 },
  facing: { x: 0, y: 1 }, intent: movementIntent, stamina: 100, active: true
};

const matchState: MatchState = {
  minute: 12, totalMinutes: 40, halfTime: 20,
  homeTeam: team, awayTeam: team, homeSetup: tacticalSetup, awaySetup: tacticalSetup,
  homeGoals: 1, awayGoals: 0, paused: false, finished: false,
  matchDecided: false, matchballWinnerSide: null,
  events: [matchEvent], statistics: matchStatistics
};

const matchSnapshot: MatchSnapshot = {
  matchTime: 12.5, possessionSide: "home", phase: matchPhase, ball: ballState,
  players: { p1: playerMatchState }, events: [matchEvent]
};

describe("domain types compile and construct correctly", () => {
  it("every literal above satisfies its declared type", () => {
    // La preuve est déjà faite par la compilation : ces assertions ne font que garantir que
    // Vitest exécute bien ce fichier (aucun test silencieusement ignoré).
    expect(player.pos).toBe("MID");
    expect(team.players).toHaveLength(1);
    expect(league.teams[0]).toBe(team);
    expect(formation.att).toBe(2);
    expect(formationSlot.pos).toBe("GK");
    expect(attackPlan.goalMod).toBeCloseTo(0.95);
    expect(defensePlan.riskMod).toBeCloseTo(0.9);
    expect(secretCard.key).toBe("doubleGoal");
    expect(tacticalSetup.lineup).toContain("p1");
    expect(matchEvent.type).toBe("goal");
    expect(matchAction.type).toBe("pass");
    expect(matchStatistics.homeGoals).toBe(1);
    expect(movementIntent.type).toBe("runInBehind");
    expect(playerRole).toBe("press");
    expect(possessionState).toBe("contested");
    expect(teamShape.compactness).toBeCloseTo(0.6);
    expect(teamPhase).toBe("attackingTransition");
    expect(matchPhase).toBe("specialBall");
    expect(ballState.trajectory).toBe("controlled");
    expect(playerMatchState.active).toBe(true);
    expect(matchState.homeGoals).toBe(1);
    expect(matchSnapshot.players.p1).toBe(playerMatchState);
  });
});
```

- [x] **Step 2: Run it**

Run: `npm test`
Expected: `Test Files 2 passed (2)` (this new file + Task 3 of Phase 1's `smoke.test.ts`), all assertions pass. If any type in Task 1/2 has a typo or missing field, this step fails first as a TypeScript compile error inside Vitest's output (Vitest type-checks via esbuild transform) — fix the type file, not the test. (Actual: `Test Files 2 passed`, `Tests 3 passed` — passed on first run, no type errors hit.)

- [x] **Step 3: Full verification**

Run, in order: `npm run build` (tsc --noEmit + vite build), `npm test`, `npm run test:legacy` (expect unchanged `59/60`), `npm run lint`.
Expected: all green, no regressions. (Actual: all green — build `✓ built in 4.68s`, legacy `59/60`, lint clean.)

- [x] **Step 4: Commit**

```bash
git add src/tests/types.test.ts
git commit -m "$(cat <<'EOF'
Add construction test exercising every Phase 2 domain type

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01VVyw7NW46uymNTs4Cnoacb
EOF
)"
```

---

## Definition of done for Phase 2

- [x] `src/data/types.ts` and `src/match/MatchTypes.ts` exist, exporting every type name the spec requires (`Player`, `Team`, `Formation`, `TacticalSetup`, `MatchState`, `PlayerMatchState`, `BallState`, `MatchAction`, `MatchEvent`, `MatchStatistics`, `MovementIntent`, `PlayerRole`, `PossessionState`, `MatchSnapshot`, `TeamShape`, `TeamPhase`, `Vector2`) plus the supporting legacy-data types Phase 3 needs.
- [x] `src/tests/types.test.ts` constructs and asserts on one valid instance of every exported type.
- [x] `npm run build`, `npm test`, `npm run test:legacy` (`59/60`, unchanged), `npm run lint` all pass.
- [x] Zero changes to any pre-existing `.js`/`.html` file (confirmed: `git diff --stat` across all 3 Phase 2 commits touches only `.ts` files).
- [x] Three commits on `migration/phaser-ts`.
- [x] The roadmap doc is updated to note Phase 2 is done, and records the `PlayerRole`/`MatchPhase`/`PossessionState`/`MatchAction`/`MatchState` design decisions made here so Phase 3+ don't re-litigate them.

**Phase 2 completed 2026-09-04.**

Do not start Phase 3 (legacy data adapter) in this plan — write its own bite-sized plan once Phase 2's Definition of Done is fully checked off.
