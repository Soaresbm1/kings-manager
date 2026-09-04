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
