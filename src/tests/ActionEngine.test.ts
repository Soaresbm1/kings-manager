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
