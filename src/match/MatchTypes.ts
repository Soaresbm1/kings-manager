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
