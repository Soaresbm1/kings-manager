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
    const home = buildTestTeam("h", "Home FC", 65);
    const away = buildTestTeam("a", "Away FC", 65);
    const engineHuman = createMatchEngine(home, buildTestSetup(home.players), away, buildTestSetup(away.players));
    const home2 = buildTestTeam("h2", "Home FC 2", 65);
    const away2 = buildTestTeam("a2", "Away FC 2", 65);
    const engineAi = createMatchEngine(home2, buildTestSetup(home2.players), away2, buildTestSetup(away2.players));

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
