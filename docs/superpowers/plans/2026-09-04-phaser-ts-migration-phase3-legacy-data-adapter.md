# Phase 3 — Legacy Data Adapter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `src/data/legacyDataAdapter.ts`, a thin typed wrapper that reads the still-global `LEAGUES`/`FORMATIONS`/`FORMATION_SLOTS`/`ATTACK_PLANS`/`DEFENSE_PLANS`/`SECRET_CARDS`/`SECRET_CARD_ORDER`/`POSITIONS` (loaded by `data.js`'s untouched classic `<script>` tag) and exposes them typed against Phase 2's `src/data/types.ts`, without copying or duplicating the data. `data.js` itself is not modified or ported.

**Architecture:** `legacyDataAdapter.ts` references the legacy globals as bare identifiers (not imports — they aren't a module) and types them via a `declare global { var ... }` block colocated in the same file. It exposes one `getX()`/`getX(key)` pair per legacy data collection, plus two small lookup helpers (`findTeam`, `findPlayer`) that later phases will otherwise have re-implemented independently. No business logic, no data transformation beyond typing.

**Tech Stack:** TypeScript 6.0.x strict (unchanged). No new dependencies.

**Spec:** `docs/superpowers/plans/2026-09-04-phaser-ts-migration-roadmap.md`, and Phase 2's plan (`2026-09-04-phaser-ts-migration-phase2-domain-types.md`) for the exact type shapes this adapter returns.

## Global Constraints

(carried forward from Phase 1/2, still in force)

- TypeScript strict mode; avoid `any`.
- Zero behavior change — `data.js` and every other legacy `.js`/`.html` file stay untouched (this phase, unlike Phase 1, doesn't even need an `index.html` edit — see Task 1's spike result: no `window` bridge script is needed).
- Never delete or rewrite `tests.js`/`tests-node.js`/`tests.html`.
- Kings League rules are unaffected — this phase only adds a read-only typed accessor to data already fully implemented in `data.js`.

---

### Task 1: Spike — confirm a Vite-bundled ES module can read a classic script's top-level `const` (completed)

This task is already done; recorded here for the record and because it determines Task 2's design.

**Question:** `data.js` declares `const LEAGUES = {...}` etc. as top-level lexical declarations in a classic (non-`module`) `<script>` tag. Per the ECMAScript spec, top-level `let`/`const` bind in the realm's Global Environment Record's *declarative* part, not as properties of the Global Object (`window`) — confirmed for `vm` contexts in Phase 1 (`context.LEAGUES` was `undefined` after running `data.js` via `vm.runInContext`, requiring an extra `this.LEAGUES = LEAGUES;` statement in the same context to pull it out). The open question for Phase 3: does a `<script type="module">` (Vite's bundled `src/main.ts`, sharing the same page/realm as `data.js`) resolve a bare `LEAGUES` reference the same way a browser's shared classic-script declarative scope would, or does module scope only see `window`/`globalThis` properties (in which case `data.js` would need an explicit `window.LEAGUES = LEAGUES` bridge, which would require touching `data.js` or adding a small bridge `<script>` to `index.html`)?

- [x] **Step 1: Add a temporary probe to `src/main.ts`**

Temporarily added: `console.log("[spike] typeof LEAGUES from ES module:", typeof LEAGUES, "window.LEAGUES:", typeof (window as unknown as Record<string, unknown>).LEAGUES);`

- [x] **Step 2: Add a temporary Playwright test capturing the console output**

`tests/_tmp-spike.spec.ts` (deleted immediately after): navigated to `/`, captured console messages matching `"spike"`.

- [x] **Step 3: Run it and read the result**

Run: `npx playwright test tests/_tmp-spike.spec.ts --project=chromium --reporter=list`
Result: `[spike] typeof LEAGUES from ES module: object window.LEAGUES: undefined`

**Conclusion:** a bare `LEAGUES` reference from the bundled ES module correctly resolves to `data.js`'s `const LEAGUES` (`typeof` = `"object"`, not `"undefined"`) — confirming both classic scripts AND module scripts sharing one page/realm draw from the same Global Environment Record for free-identifier resolution, and confirming (as expected from the Phase 1 `vm` finding) that this binding is genuinely NOT a `window`/`globalThis` property. **Design consequence: no `window` bridge script, no `index.html` edit, no `data.js` edit needed.** `legacyDataAdapter.ts` can reference `LEAGUES`/`FORMATIONS`/etc. as bare identifiers directly, typed via a colocated `declare global` block.

- [x] **Step 4: Revert the temporary probe and delete the temporary test**

`src/main.ts` reverted to its Phase 1 content exactly; `tests/_tmp-spike.spec.ts` deleted. Confirmed via `git status --porcelain` (clean before Task 2 starts).

---

### Task 2: `src/data/legacyDataAdapter.ts`

**Files:**
- Create: `src/data/legacyDataAdapter.ts`

**Interfaces:**
- Consumes: every type from `src/data/types.ts` (Phase 2, Task 1).
- Produces: `getLeagues`, `getLeague`, `getFormations`, `getFormation`, `getFormationSlots`, `getFormationSlotsFor`, `getAttackPlans`, `getAttackPlan`, `getDefensePlans`, `getDefensePlan`, `getSecretCards`, `getSecretCard`, `getSecretCardOrder`, `getPositions`, `findTeam`, `findPlayer` — consumed by Phase 5+ (`MatchEngine.ts`, `MatchBridge.ts`) whenever they need typed access to league/team/formation/plan/card data without importing `data.js` as a module (impossible — it's not one).

- [x] **Step 1: Write `src/data/legacyDataAdapter.ts`**

```ts
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
```

- [x] **Step 2: Type-check and lint**

Run: `npm run build` then `npm run lint`.
Expected: both clean. If lint flags the `declare global { var ... }` block (some rule sets forbid `var`), fix with the narrowest possible adjustment (e.g. a targeted `// eslint-disable-next-line` on just that block with a comment explaining why) rather than restructuring the file — do not silently switch to `let`/`const` here, since (per Step 1's comment) `var` is specifically what makes the ambient declaration assignable for Task 3's test fixtures. (Actual: both clean on first try, no lint rule flagged the ambient `var`.)

- [x] **Step 3: Commit**

```bash
git add src/data/legacyDataAdapter.ts
git commit -m "$(cat <<'EOF'
Add typed adapter for data.js's legacy global data (LEAGUES, FORMATIONS, ...)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01VVyw7NW46uymNTs4Cnoacb
EOF
)"
```

---

### Task 3: Vitest suite for the adapter (fixture-injected, no real browser needed)

**Files:**
- Create: `src/tests/legacyDataAdapter.test.ts`

**Interfaces:**
- Consumes: every export from `src/data/legacyDataAdapter.ts` (Task 2) and every type from `src/data/types.ts`.

**Why this is a legitimate unit test, not a stub:** `legacyDataAdapter.ts`'s functions read the legacy globals lazily (at CALL time, not at module-import time — none of them are `export const x = LEAGUES` eagerly-evaluated bindings). A bare identifier read that isn't resolved by any enclosing lexical scope falls back to a `globalThis` property lookup in both a real browser (already proven in Task 1: the reverse direction — `data.js`'s `const` is NOT a `globalThis` property, but the adapter functions don't care how `LEAGUES` got bound, only that it resolves) and in Node/Vitest. So setting `globalThis.LEAGUES = <fixture>` (etc.) before calling an adapter function makes it resolve to the fixture, in Node, without needing a real browser — this tests the adapter's OWN logic (does `getLeague("france")` really return `LEAGUES.france`?), which is exactly what needs unit coverage; Task 1's Playwright spike already separately proved the browser wiring itself.

- [x] **Step 1: Write `src/tests/legacyDataAdapter.test.ts`**

```ts
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
```

- [x] **Step 2: Run it**

Run: `npm test`
Expected: `Test Files 3 passed (3)` (this file + Phase 2's `types.test.ts` + Phase 1's `smoke.test.ts`), 9 new tests passing. **Actual on first run: 1 of the 9 new tests failed** — `getSecretCard("joker").key` expected `"joker"` but got `"doubleGoal"`. Root cause: the test's own `fixtureSecretCards` fixture reuses ONE shared `secretCard` object (`key: "doubleGoal"`) for all 7 `SecretCardKey` entries (to keep the fixture short) — so every key's lookup returns the same object, whose `.key` field is always `"doubleGoal"`, never the key it was looked up by. This is a test-fixture bug, not an adapter bug (`getSecretCard(key)` correctly returns `SECRET_CARDS[key]` either way). Fixed by asserting object identity (`toBe(secretCard)`) instead of `.key`, matching every other assertion in this file's pattern. Final: `Test Files 3 passed (3)`, `Tests 12 passed (12)`.

- [x] **Step 3: Full verification**

Run, in order: `npm run build`, `npm test`, `npm run test:legacy` (expect unchanged `59/60`), `npm run lint`.
Expected: all green, no regressions. (Actual: all green.)

- [x] **Step 4: Commit**

```bash
git add src/tests/legacyDataAdapter.test.ts
git commit -m "$(cat <<'EOF'
Add fixture-injected Vitest suite for the legacy data adapter

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01VVyw7NW46uymNTs4Cnoacb
EOF
)"
```

---

## Definition of done for Phase 3

- [x] `src/data/legacyDataAdapter.ts` exists, exposing typed read-only access to every legacy static data collection (`LEAGUES`, `FORMATIONS`, `FORMATION_SLOTS`, `ATTACK_PLANS`, `DEFENSE_PLANS`, `SECRET_CARDS`, `SECRET_CARD_ORDER`, `POSITIONS`) plus `findTeam`/`findPlayer` helpers.
- [x] `src/tests/legacyDataAdapter.test.ts` covers every exported function with fixture-injected globals.
- [x] `npm run build`, `npm test`, `npm run test:legacy` (`59/60`, unchanged), `npm run lint` all pass.
- [x] Zero changes to `data.js` or any other pre-existing `.js`/`.html` file (confirmed: this phase needed no `index.html` edit either, per Task 1's spike result; `git diff --stat` across all Phase 3 commits touches only `.ts` files).
- [x] Four commits on `migration/phaser-ts` (spike is not a separate commit — folded into the record above; adapter, test, docs).
- [x] The roadmap doc is updated to note Phase 3 is done, recording the module-can-read-classic-script-const finding (load-bearing for any future phase that needs another legacy global) and the `declare global { var ... }` pattern used.

**Phase 3 completed 2026-09-04.**

Do not start Phase 4 (ActionEngine port) in this plan — write its own bite-sized plan once Phase 3's Definition of Done is fully checked off.
