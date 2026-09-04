import type {
  League,
  LeagueKey,
  Formation,
  FormationKey,
  FormationSlot,
  AttackPlan,
  AttackPlanKey,
  DefensePlan,
  DefensePlanKey,
  SecretCard,
  SecretCardKey,
  Player,
  Team,
  PlayerPosition
} from "./types";

// Pont typé vers les données STATIQUES encore chargées par data.js (script classique, voir
// index.html) : LEAGUES/FORMATIONS/FORMATION_SLOTS/ATTACK_PLANS/DEFENSE_PLANS/SECRET_CARDS/
// SECRET_CARD_ORDER/POSITIONS. Un script classique déclare ses `const` de haut niveau dans
// l'environnement lexical global PARTAGÉ par tous les <script> classiques ET par les modules ES
// bundlés (comme celui-ci) chargés dans la même page — vérifié empiriquement avant d'écrire ce
// fichier (voir Task 1 de docs/superpowers/plans/2026-09-04-phaser-ts-migration-phase3-legacy-
// data-adapter.md) : `typeof LEAGUES` vu depuis un module vaut "object", alors que
// `window.LEAGUES` vaut "undefined" (les `const` de haut niveau ne deviennent JAMAIS des
// propriétés de `window`/`globalThis`, contrairement à `var`/`function`). Ce fichier référence donc
// ces identifiants directement, sans les importer (impossible : ils ne sont pas un module) — les
// déclarations `declare global` ci-dessous ne servent qu'à les TYPER pour TypeScript, elles ne
// créent ni ne modifient rien à l'exécution. data.js lui-même n'est pas modifié ni porté ici : ce
// fichier n'en est qu'un accesseur typé en lecture seule, sans copier les données.
declare global {
  // `var` ici décrit uniquement la vue TypeScript de ces globales (assignables, ce qui permet aux
  // tests de les injecter via `Object.assign(globalThis, {...})` — voir legacyDataAdapter.test.ts).
  // data.js les déclare réellement en `const` ; le JavaScript exécuté est strictement identique
  // quel que soit le mot-clé utilisé ici, puisqu'une déclaration ambiante ne produit aucun code.
  var LEAGUES: Record<LeagueKey, League>;
  var FORMATIONS: Record<FormationKey, Formation>;
  var FORMATION_SLOTS: Record<FormationKey, FormationSlot[]>;
  var ATTACK_PLANS: Record<AttackPlanKey, AttackPlan>;
  var DEFENSE_PLANS: Record<DefensePlanKey, DefensePlan>;
  var SECRET_CARDS: Record<SecretCardKey, SecretCard>;
  var SECRET_CARD_ORDER: SecretCardKey[];
  var POSITIONS: PlayerPosition[];
  // Bornes de conversion overall -> note "étoiles" (voir data.js:player, VALUE_STAR_MIN/MAX) —
  // ajoutées en Phase 5, nécessaires à developPlayer (engine.js) pour recalculer la valeur d'un
  // joueur après une progression/régression d'attribut, avec exactement la même courbe qu'à la
  // création du joueur.
  var VALUE_STAR_MIN: number;
  var VALUE_STAR_MAX: number;
}

export function getLeagues(): Record<LeagueKey, League> {
  return LEAGUES;
}

export function getLeague(key: LeagueKey): League {
  return LEAGUES[key];
}

export function getFormations(): Record<FormationKey, Formation> {
  return FORMATIONS;
}

export function getFormation(key: FormationKey): Formation {
  return FORMATIONS[key];
}

export function getFormationSlots(): Record<FormationKey, FormationSlot[]> {
  return FORMATION_SLOTS;
}

export function getFormationSlotsFor(key: FormationKey): FormationSlot[] {
  return FORMATION_SLOTS[key];
}

export function getAttackPlans(): Record<AttackPlanKey, AttackPlan> {
  return ATTACK_PLANS;
}

export function getAttackPlan(key: AttackPlanKey): AttackPlan {
  return ATTACK_PLANS[key];
}

export function getDefensePlans(): Record<DefensePlanKey, DefensePlan> {
  return DEFENSE_PLANS;
}

export function getDefensePlan(key: DefensePlanKey): DefensePlan {
  return DEFENSE_PLANS[key];
}

export function getSecretCards(): Record<SecretCardKey, SecretCard> {
  return SECRET_CARDS;
}

export function getSecretCard(key: SecretCardKey): SecretCard {
  return SECRET_CARDS[key];
}

export function getSecretCardOrder(): SecretCardKey[] {
  return SECRET_CARD_ORDER;
}

export function getPositions(): PlayerPosition[] {
  return POSITIONS;
}

/** Bornes overall -> étoiles (voir data.js:player). Ajouté en Phase 5 pour developPlayer. */
export function getValueStarBounds(): { min: number; max: number } {
  return { min: VALUE_STAR_MIN, max: VALUE_STAR_MAX };
}

/** Cherche une équipe par id dans une ligue donnée — évite à chaque appelant (Phase 5+) de
 * réécrire le même `.teams.find(...)`. */
export function findTeam(leagueKey: LeagueKey, teamId: string): Team | undefined {
  return LEAGUES[leagueKey].teams.find((t) => t.id === teamId);
}

/** Cherche un joueur par id dans toutes les équipes d'une ligue donnée. */
export function findPlayer(leagueKey: LeagueKey, playerId: string): Player | undefined {
  for (const team of LEAGUES[leagueKey].teams) {
    const found = team.players.find((p) => p.id === playerId);
    if (found) return found;
  }
  return undefined;
}
