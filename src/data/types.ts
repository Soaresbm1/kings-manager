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
