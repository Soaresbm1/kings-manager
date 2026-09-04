import { describe, it, expect, beforeAll } from "vitest";
import type {
  League, LeagueKey, Formation, FormationKey, FormationSlot,
  AttackPlan, AttackPlanKey, DefensePlan, DefensePlanKey,
  SecretCard, SecretCardKey, Player, Team, PlayerPosition
} from "../data/types";
import * as adapter from "../data/legacyDataAdapter";

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
function makeLeague(name: string): League {
  return { name, teams: [team] };
}
const fixtureLeagues: Record<LeagueKey, League> = {
  france: makeLeague("France"),
  brazil: makeLeague("Brésil"),
  spain: makeLeague("Espagne"),
  italy: makeLeague("Italie"),
  germany: makeLeague("Allemagne"),
  mexico: makeLeague("Mexique")
};

const formation: Formation = { name: "2-2-2", gk: 1, def: 2, mid: 2, att: 2 };
const fixtureFormations: Record<FormationKey, Formation> = {
  "1-2-2-2": formation, "1-3-2-1": formation, "1-2-3-1": formation
};
const slots: FormationSlot[] = [{ pos: "GK", x: 50, y: 90 }];
const fixtureFormationSlots: Record<FormationKey, FormationSlot[]> = {
  "1-2-2-2": slots, "1-3-2-1": slots, "1-2-3-1": slots
};

const attackPlan: AttackPlan = { name: "Possession", desc: "...", goalMod: 0.95, possMod: 1.25 };
const fixtureAttackPlans: Record<AttackPlanKey, AttackPlan> = {
  direct: attackPlan, possession: attackPlan, transition: attackPlan
};
const defensePlan: DefensePlan = { name: "Bloc bas", desc: "...", concedeMod: 0.85, riskMod: 0.9 };
const fixtureDefensePlans: Record<DefensePlanKey, DefensePlan> = {
  low: defensePlan, high: defensePlan, zone: defensePlan
};

const secretCard: SecretCard = { key: "doubleGoal", name: "But Double", icon: "🟡", desc: "...", risk: 2 };
const fixtureSecretCards: Record<SecretCardKey, SecretCard> = {
  doubleGoal: secretCard, sanction: secretCard, penalty: secretCard, shootout: secretCard,
  starPlayer: secretCard, reversePenalty: secretCard, joker: secretCard
};
const fixtureSecretCardOrder: SecretCardKey[] = ["doubleGoal", "sanction", "penalty", "shootout", "starPlayer", "reversePenalty", "joker"];
const fixturePositions: PlayerPosition[] = ["GK", "DEF", "MID", "ATT"];

beforeAll(() => {
  Object.assign(globalThis, {
    LEAGUES: fixtureLeagues,
    FORMATIONS: fixtureFormations,
    FORMATION_SLOTS: fixtureFormationSlots,
    ATTACK_PLANS: fixtureAttackPlans,
    DEFENSE_PLANS: fixtureDefensePlans,
    SECRET_CARDS: fixtureSecretCards,
    SECRET_CARD_ORDER: fixtureSecretCardOrder,
    POSITIONS: fixturePositions
  });
});

describe("legacyDataAdapter", () => {
  it("getLeagues/getLeague read the injected LEAGUES global", () => {
    expect(adapter.getLeagues()).toBe(fixtureLeagues);
    expect(adapter.getLeague("france").name).toBe("France");
  });

  it("getFormations/getFormation read the injected FORMATIONS global", () => {
    expect(adapter.getFormations()).toBe(fixtureFormations);
    expect(adapter.getFormation("1-2-2-2").att).toBe(2);
  });

  it("getFormationSlots/getFormationSlotsFor read the injected FORMATION_SLOTS global", () => {
    expect(adapter.getFormationSlots()).toBe(fixtureFormationSlots);
    expect(adapter.getFormationSlotsFor("1-2-2-2")).toEqual(slots);
  });

  it("getAttackPlans/getAttackPlan read the injected ATTACK_PLANS global", () => {
    expect(adapter.getAttackPlans()).toBe(fixtureAttackPlans);
    expect(adapter.getAttackPlan("possession").goalMod).toBeCloseTo(0.95);
  });

  it("getDefensePlans/getDefensePlan read the injected DEFENSE_PLANS global", () => {
    expect(adapter.getDefensePlans()).toBe(fixtureDefensePlans);
    expect(adapter.getDefensePlan("zone").riskMod).toBeCloseTo(0.9);
  });

  it("getSecretCards/getSecretCard/getSecretCardOrder read the injected globals", () => {
    expect(adapter.getSecretCards()).toBe(fixtureSecretCards);
    // fixtureSecretCards réutilise volontairement le même objet `secretCard` (key: "doubleGoal")
    // pour toutes les clés — seule l'identité d'objet est donc vérifiable ici, pas `.key`.
    expect(adapter.getSecretCard("joker")).toBe(secretCard);
    expect(adapter.getSecretCardOrder()).toEqual(fixtureSecretCardOrder);
  });

  it("getPositions reads the injected POSITIONS global", () => {
    expect(adapter.getPositions()).toEqual(["GK", "DEF", "MID", "ATT"]);
  });

  it("findTeam finds an existing team and returns undefined for a missing one", () => {
    expect(adapter.findTeam("france", "t1")).toBe(team);
    expect(adapter.findTeam("france", "does-not-exist")).toBeUndefined();
  });

  it("findPlayer finds an existing player and returns undefined for a missing one", () => {
    expect(adapter.findPlayer("france", "p1")).toBe(player);
    expect(adapter.findPlayer("france", "does-not-exist")).toBeUndefined();
  });
});
