# Kings Manager — TypeScript / Phaser 3 / Vite Migration Roadmap

> This is an index/roadmap, not an executable plan. Each phase below gets its own
> bite-sized plan (`superpowers:writing-plans` format) written just before that phase
> starts, once the previous phase has landed and we know what we actually learned from
> it. **Phase 1** (`2026-09-04-phaser-ts-migration-phase1-tooling.md`), **Phase 2**
> (`2026-09-04-phaser-ts-migration-phase2-domain-types.md`), **Phase 3**
> (`2026-09-04-phaser-ts-migration-phase3-legacy-data-adapter.md`) and **Phase 4**
> (`2026-09-04-phaser-ts-migration-phase4-action-engine.md`) are done, each executed
> inline in the same session that wrote its plan.

**Spec:** the user's migration brief (2026-09-04 conversation) — full requirements
reproduced in that conversation, not duplicated here. Read it before writing any
subsequent phase's plan.

## Why phased, and why plans get written late

The spec itself mandates progressive migration with the legacy app kept working at every
step (`MATCH_RENDERER = "legacy" | "phaser"` toggle), and an explicit 16-step order. Several
later phases (the new collective-movement/MovementIntent system in particular) require
design decisions that should be informed by what Phase 1-3 reveal about the current code,
not guessed up front. Writing full bite-sized code for phase 9 today would mean
placeholder code — forbidden by `writing-plans`. So: roadmap now, detailed plan per phase,
just in time.

## Phase 1 — done (2026-09-04)

Tooling landed on `migration/phaser-ts` (7 commits): TypeScript 6.0.x strict, Vite 8, Phaser
3.90 (installed, not yet mounted), Vitest 5, ESLint 10 + typescript-eslint 8. `npm run dev`
serves the unmodified legacy app through Vite; `npm run build`/`npm test`/`npm run
test:legacy`/`npm run lint`/`npm run test:e2e` all green. Full detail (including every
snag hit and how it was fixed) is in
`2026-09-04-phaser-ts-migration-phase1-tooling.md`. What Phase 2+ needs to know:

- **TypeScript is pinned to 6.0.x, not 7.x.** `typescript-eslint@8.69.0`'s peer range is
  `>=4.8.4 <6.1.0`; TS 7.0.2 fails to resolve against it. Re-check this constraint before
  ever bumping TypeScript.
- **Vite/Vitest config files must be `.mts`, ESLint's must be `.mjs`** — `package.json`
  keeps `"type": "commonjs"` (required so `tests-node.js`'s `require()` calls keep
  working), and Vite 8's native config loader rejects ESM `import`/`export default` syntax
  in a `.ts`/`.js` file under a CommonJS package. `.mts`/`.mjs` force ESM regardless of
  `package.json`'s `type`.
- **`vite build` does NOT copy classic (non `type="module"`) `<script src>` files, and does
  NOT copy anything only referenced dynamically at runtime** (e.g. `app.js:playerPhotoUrl`'s
  string-built `images/players/**` paths). `vite.config.mts` now carries a small local
  `copyLegacyStaticAssets` plugin (`closeBundle` hook, plain `fs.cpSync`, no new dependency)
  that copies `data.js`/`matchengine-actions.js`/`engine.js`/`matchchoreo.js`/`app.js` and
  the whole `images/` directory into `dist/` on build. Any later phase that adds another
  legacy-loaded file or another dynamically-referenced asset directory must add it to that
  plugin's file/dir lists too, or the production build will silently 404 on it (`npm run
  dev` would still look fine — this class of bug only shows up in `npm run build` +
  `npm run preview`, so always check both, not just dev).
- **`tsconfig.json`'s `types` array needs `"node"` alongside `"vite/client"`** the moment any
  `src/**/*.ts` file uses a `node:*` import (Vitest test files doing filesystem/vm work, as
  Phase 2+'s legacy-comparison tests will keep doing) — otherwise `tsc --noEmit` (part of
  `npm run build`) fails even though `@types/node` is installed, because an explicit `types`
  array opts out of auto-including every installed `@types/*` package.
- **`vm.runInContext`-loaded legacy globals declared with `const`/`let` are NOT reachable as
  context properties** — only top-level `function`/`var` are (that's the whole reason
  `tests-node.js` can call `context.runAllTests()`). `data.js`'s `LEAGUES`, `FORMATIONS`,
  `MATCH_BALANCE`, etc. are all `const`. To read one from a Vitest test that loads the
  legacy file via `vm`, run one more `vm.runInContext("this.NAME = NAME;", context)`
  statement in the same context afterward (see `src/tests/smoke.test.ts`) — Phase 4/5's
  tests that compare the new TS port's output against the legacy JS behavior will need this
  repeatedly.
- **In a real browser (not `vm`), the opposite is true**: `app.js`'s top-level
  `function`/`let` declarations (`STATE`, `saveGame`, `getSavesMap`, `applySaveData`, etc.)
  ARE real `window` globals, confirmed by driving a save/reload round-trip through
  `page.evaluate` in Playwright. Save-compatibility across this migration is real, not
  assumed.
- No `mcp__claude-in-chrome__*` tool was available in the Phase 1 session — Playwright
  (already installed) covered every browser-behavior check instead (console-error smoke
  test, save/reload round-trip). If browser automation becomes available in a later
  session, prefer it for quick manual spot-checks, but Playwright remains the source of
  truth for anything that should stay regression-tested.

## Phase 2 — done (2026-09-04)

`src/data/types.ts` and `src/match/MatchTypes.ts` landed (3 commits), exporting every type
name the spec requires plus the supporting legacy-data types Phase 3 needs. Pure type-only
work, zero runtime/legacy-file changes, all verified green (`npm run build`/`npm test`/
`npm run test:legacy` 59/60/`npm run lint`). Full reasoning for every non-obvious choice is
recorded in `2026-09-04-phaser-ts-migration-phase2-domain-types.md`'s "Design notes" section
— read it before touching these types again. Load-bearing decisions Phase 3+ must not
re-litigate without a reason:

- **`PlayerRole = MovementIntent["type"]`** — one taxonomy, two names for two call sites
  (the full intent object vs. just the label for debug/rendering).
- **`MatchPhase`** (`"escalier"|"normal"|"specialBall"|"giantDice"|"matchball"`, used on
  `MatchSnapshot.phase`) is the Kings League RULE-CLOCK phase, match-wide. **`TeamPhase`**
  (`settledPossession|attackingTransition|settledDefense|defensiveTransition|setPiece`) is
  the PER-TEAM tactical transition state from the collective-movement spec section — kept
  separate, not wired into `MatchSnapshot` yet (Phase 6 decides where per-side phase state
  actually lives once the movement system is being built for real).
- **`PossessionState`** = `"inPossession"|"outOfPossession"|"contested"` — generalizes
  `matchchoreo.js:assignRoles`'s `possessing = ballSide === p.side` boolean, adds
  `"contested"` for loose-ball moments the current system doesn't distinguish.
- **`MatchAction`** is the direct typed successor of the existing "beat" object
  (`matchengine-actions.js:makeBeat`) — same fields, same nullability. Phase 4's
  `ActionEngine.ts` should produce `MatchAction[]` directly, not a different shape that then
  needs translating.
- **`MatchState`** (broad, mutable, owned by `MatchEngine.ts` in Phase 5) vs
  **`MatchSnapshot`** (lean, read-only, per-frame, consumed only by `MatchScene.ts`) are
  deliberately different types per the spec's own architecture diagram
  (`ActionEngine → MatchState → CollectiveMovement → MatchSnapshot → MatchScene`).
  `MatchState` as defined in Phase 2 does NOT yet include implementation-specific closure
  state from `engine.js:createMatchEngine` (card sanctions, per-player stamina, dice/
  president state) — Phase 5 extends it once that port is actually written; guessing that
  shape now was judged higher-risk than adding it later with real information.
- `tsconfig.json`'s `types: ["vite/client", "node"]` (set during Phase 1) was reused as-is;
  no tsconfig changes were needed for pure type files.

## Phase 3 — done (2026-09-04)

`src/data/legacyDataAdapter.ts` landed (4 commits including the spike record), exposing
typed read-only accessors for every legacy static data collection plus `findTeam`/
`findPlayer` helpers. Zero runtime/legacy-file changes, all verified green. Full detail in
`2026-09-04-phaser-ts-migration-phase3-legacy-data-adapter.md`. Load-bearing findings for
Phase 4+:

- **A Vite-bundled ES module CAN read a classic `<script>`'s top-level `const`/`let` as a
  bare identifier** — empirically confirmed with a temporary Playwright probe:
  `typeof LEAGUES` from `src/main.ts` (a `type="module"` script) is `"object"`, while
  `window.LEAGUES` is `"undefined"`. This means no `window`/`globalThis` bridge script is
  needed anywhere in this migration to reach `data.js`'s globals (or, later,
  `matchengine-actions.js`'s/`engine.js`'s/`matchchoreo.js`'s globals) from TypeScript
  modules — reference them directly as bare identifiers, typed via a colocated
  `declare global { var ... }` block (see `legacyDataAdapter.ts` for the pattern). This
  applies equally to Phase 4 (`ActionEngine.ts` will need `MATCH_BALANCE`,
  `computeSideAnchors`, etc. from `matchengine-actions.js` the same way) and Phase 5
  (`MatchEngine.ts` needing `engine.js`'s exports, if any legacy code still calls into the
  TS side rather than being fully replaced).
- **`declare global { var X: T }` (not `const`/`let`) is the right ambient-declaration
  keyword** even though the real script uses `const` — TypeScript treats ambient `var` as
  assignable (needed so Vitest tests can do `Object.assign(globalThis, {LEAGUES: fixture})`
  to inject fixtures in Node, without a real browser), while ambient `const`/`let` would be
  rejected as read-only by `tsc` even for `globalThis.X = ...` in test setup. No ESLint rule
  in this project's config flags this pattern.
- **Legacy globals with no runtime test coverage possible without a browser** (i.e. every
  future "does the TS code really see the real `data.js`/`engine.js` global, not just a
  fixture" question) should reuse Task 1's Playwright-console-probe technique — cheap,
  fast, and it already caught the one real unknown in this phase. Keep doing this as a
  first step whenever a new phase needs to reach a not-yet-proven legacy global, rather
  than assuming either direction.

## Phase 4 — done (2026-09-04)

`src/match/ActionEngine.ts` landed (2 commits, ~740 lines): a complete, faithful,
line-by-line TypeScript port of `matchengine-actions.js`, verified against the real
source read in full this session. `src/tests/ActionEngine.test.ts` ports every relevant
`tests.js` assertion (structure, continuity, pass-target validity, interception/tackle
turnover, xG bounds, goal-requires-shot, attack-stat consistency, reduced-squad no-pass,
recovery-line phrasing, `chooseActionType` plan-influence) plus new coverage for
`computeSideAnchors`/`compute*Rating` that had none before — **29/29 passed on the very
first run**, strong evidence the port is behaviorally faithful. `matchengine-actions.js`
is completely untouched; `engine.js` still calls it exactly as before. Full detail,
including the complete ported source, is in
`2026-09-04-phaser-ts-migration-phase4-action-engine.md`. Load-bearing findings for
Phase 5+:

- **RNG-injection pattern to reuse**: every function that used `Math.random()` gained a
  final `rng: () => number = Math.random` parameter, threaded explicitly (never a
  module-level mutable RNG variable — that would be real shared state, risky under
  Vitest's parallel test execution). `simulatePossessionChain`'s params object carries an
  optional `rng?: () => number`. Phase 5's `MatchEngine.ts` port has MANY more
  `Math.random()` call sites to convert this same way: injuries, yellow/red cards,
  penalties (`performPenaltyAttempt`/`performShootoutAttempt`/
  `performPresidentPenaltyKick`), own goals, `weightedPick`, `simulatePenaltyShootout`,
  `runBalanceSimulation`, `chooseAiPlans`/AI card activation heuristics. Same rule: default
  `Math.random`, explicit parameter, no shared mutable state.
- **`npm test` (Vitest) does NOT type-check** — confirmed the hard way: a real `tsc`
  error (`string | undefined` not assignable to `string`, from `id === null` only
  narrowing out `null` and leaving `undefined` on an optional field) passed `npm test`
  clean (Vitest's esbuild transform strips types without verifying them) and only
  surfaced in `npm run build`'s `tsc --noEmit` step. **Always run `npm run build` as part
  of verification — `npm test` passing alone is not proof of type correctness.** This
  applies to every future phase's test files, not just this one.
- **Optional fields narrow with `== null`, not `=== null`**: `MatchAction.toPlayerId?`/
  `gkId?` are `string | null | undefined` (optional + explicit `| null`) — checking
  `x === null` only excludes `null`, leaving `string | undefined` for the rest of the
  expression, which then fails to satisfy a plain `string` parameter (e.g. `Set<string>.
  has()`). Use `== null` (loose equality) when the intent is "absent, however that's
  represented" — a real, recurring TS gotcha this codebase's optional fields will keep
  hitting as more of `engine.js`'s data shapes get typed in Phase 5.
- **The trickiest anticipated type-narrowing spot (the `decision` variable inside
  `simulatePossessionChain`'s loop, narrowed from the full 8-value `ActionDecision`
  union down to exactly `"short"|"progressive"|"through"` after five exhaustive-exit
  `if` guards) type-checked correctly with zero casts needed** — confirms TypeScript's
  control-flow narrowing handles this pattern (literal-equality checks, each branch
  exiting via `break`/`continue` on every path) reliably. Safe to rely on the same
  pattern in Phase 5's `simulateMinute`/`advancePhaseState` ports, which have similar
  branching.
- `MATCH_BALANCE` moved from a legacy global (defined inside `matchengine-actions.js`
  itself, not `data.js`) to a plain exported `const` in `ActionEngine.ts` — no adapter
  needed, since it isn't part of `data.js`'s legacy-global surface Phase 3 built for.
  `computeSideAnchors` is the one function that still reaches into a `data.js` global
  (`FORMATION_SLOTS`), now via `legacyDataAdapter.getFormationSlotsFor` instead of a
  direct reference — the intended Phase 3 usage pattern working as designed.

## Current-state summary (established 2026-09-04)

- Baseline tests: `node tests-node.js` → **59/60 passing**. The one failure
  (`Karasu (France) : 2 DEF, minimum requis 3`) is a pre-existing data-integrity issue in
  `data.js` unrelated to this migration — do not let it block any phase; fix separately if
  ever asked.
- `matchengine-actions.js` (621 lines) is already a pure function module (no DOM, no
  `STATE`) — confirmed by direct read. `Math.random()` is used directly in ~10 places
  (`pickCarrierWeighted`, `weightedChoice`, `resolvePassChance`'s callers via chance rolls,
  `resolveDribbleChance`'s caller, `resolveShotOutcome`, `pickPassTarget`, `advancedPoint`,
  `clearTarget`, `pickShotTarget`, `planChainCount`) — not funneled through one RNG seam.
  Phase 7 (ActionEngine port) should introduce an injectable RNG function
  (`() => number`, defaulting to `Math.random`) so simulation becomes seedable/testable —
  this is a deliberate improvement, not just a port.
- `matchchoreo.js` (441 lines) is already a pure, DOM-free, `Math.random()`-free
  interpolation module driven by `step(dt)`. Its collective-movement system
  (`computeDynamicTarget`, `assignRoles`, `steerTowards`) is exactly what Phase 9
  (`MovementIntent`/`CollectiveMovement.ts`) replaces — concrete weaknesses confirmed by
  reading the file:
  - Involved players (carrier/receiver/keeper, `applyBeatFrame`) are snapped straight to
    the ball's interpolated position every frame (`setPlayerPos(beat.toPlayerId, ball.x,
    ball.y)`) — this is the exact "receveur collé au ballon" complaint. The new system
    (Phase 9) must give the receiver its own steered approach to a reception zone instead.
  - `assignRoles` recomputes a **flat one-role-per-player** classification every frame from
    scratch (nearest-to-ball sort, no memory, no hysteresis) — roles can flip frame to
    frame with no stability. `MovementIntent.expiresAt` (spec) fixes this directly.
  - Only one role bucket structure exists: `shortSupport/forwardRunner/wideSupport/
    restDefense` (attack) and `primaryPresser/coverDefender/farSideCompact/holdShape`
    (defense) — no overlap/underlap/runInBehind/dropBetweenLines/provideWidth/mark/
    trackRunner/counterPress/recover distinction from the spec's `MovementIntent.type`.
  - `computeDynamicTarget` is a single additive formula (slot + lateral pull + depth shift
    + role offset), all constants in `MOVE`. There's no `TeamShape` concept — no notion of
    compactness, defensive/pressing lines, or score/fatigue/numerical-inferiority
    modulation, all required by the spec's `TeamShape`.
  - Separation (`applySeparation`) exists but is a simple pairwise target-nudge, teammates
    only — matches spec's "no rigid physics collisions" requirement already; keep this
    behavior, just move it into `CollectiveMovement.ts`.
  - `steerTowards` already does accel-bounded, max-speed-capped, distance-based approach
    easing (`MOVE.accel`, `MOVE.maxSpeedRun/Approach`) — this part is in decent shape and
    can inform (not be copy-pasted into) `PlayerMatchState` steering in Phase 9.
- Match rendering today (`app.js`): a single `<canvas id="match-pitch-canvas">` inside
  `#match-pitch.pitch-field.match-pitch` (`index.html:434-466`,
  `style.css:615-628` — `aspect-ratio: 3/2`, `max-width: 640px`, canvas
  `position:absolute; inset:0`), driven by a `requestAnimationFrame` loop
  (`app.js:startMatchPitchLoop`/`pitchFrameLoop`, `app.js:3449-3487`) that calls
  `choreo.step(dt * matchState.playbackSpeed)` then `renderMatchPitchFrame()`
  (`app.js:3580-3657`, plain 2D `ctx` drawing, logical x/y swapped to landscape screen
  x/y). Debug overlay: `renderPitchDebugOverlay` (`app.js:3664-3724`), toggled by keydown
  `d`/`D` guarded to `#screen-match.active` (`app.js:3100-3105`), backed by module-level
  `let PITCH_DEBUG` (declared earlier in app.js, not re-checked here — grep it in Phase 11).
  This is exactly the container Phaser mounts into (Phase 10-11): replace
  `<canvas id="match-pitch-canvas">` with a Phaser-owned canvas in the same
  `#match-pitch` div, same aspect-ratio/sizing CSS, same `renderMatchPitchFrame`
  call site swapped for a Phaser scene update — nothing else in `app.js`'s screen
  plumbing (`showScreen`, tactics modal, secret card modal, halftime overlay, speed/pause
  buttons) needs to change shape.
- Script load order confirmed unchanged: `data.js → matchengine-actions.js → engine.js →
  matchchoreo.js → app.js` (`index.html:695-699`), all classic non-module `<script src>`
  tags. Vite dev-serves these as static passthrough as long as `index.html`'s *other*
  script tags (the new `main.ts` entry) are `type="module"`; verify this concretely in
  Phase 1 rather than assuming it.
- `matchengine-actions.js` is untracked in git as of session start per the initial status
  snapshot the user was shown, but `git status` at the start of this session shows a clean
  tree on `main` — it was already committed in `5423c99`. Trust `git status` over any
  stale snapshot.

## Phase list (spec's 16-step order, grouped)

1. **Phase 1 — Tooling & baseline** (detailed plan exists). Branch, confirm baseline
   tests, add Vite + TypeScript (strict) + Phaser 3 + Vitest + minimal ESLint, get the
   *existing* app serving unchanged through `npm run dev`, `npm run build` succeeds
   (`tsc --noEmit && vite build`), `npm test` runs (even with zero Vitest tests yet — the
   existing `tests.js`/`tests-node.js` suite keeps running standalone via
   `node tests-node.js` until Phase 13 migrates it). No behavior change.

2. **Phase 2 — Domain types** (`src/data/types.ts`, `src/match/MatchTypes.ts`). Pure type
   declarations for `Player`, `Team`, `Formation`, `TacticalSetup`, `MatchState`,
   `PlayerMatchState`, `BallState`, `MatchAction`, `MatchEvent`, `MatchStatistics`,
   `MovementIntent`, `PlayerRole`, `PossessionState`, `MatchSnapshot`, `TeamShape`,
   `TeamPhase`, `Vector2` — derived from the real shapes read out of `data.js`/
   `engine.js`/`matchengine-actions.js` in this session (do not re-derive from scratch;
   this roadmap + the phase-1 plan's file reads are the source). No runtime code changes.

3. **Phase 3 — Legacy data adapter** (`src/data/legacyDataAdapter.ts`). Thin typed wrapper
   that reads the still-global `LEAGUES`/`FORMATIONS`/`FORMATION_SLOTS`/`ATTACK_PLANS`/
   `DEFENSE_PLANS`/`SECRET_CARDS` (loaded by the untouched classic `<script>` tags) and
   exposes them typed, without copying or duplicating the data. `data.js` itself is not
   ported to TS yet (huge, hand-entered per-league rosters — low value, high risk to
   port mechanically; revisit only if it becomes a blocker).

4. **Phase 4 — ActionEngine port** (`src/match/ActionEngine.ts`). Line-by-line-faithful
   TS port of `matchengine-actions.js`'s `simulatePossessionChain` and everything it calls,
   typed against Phase 2's types, with `Math.random()` replaced by an injected `rng: () =>
   number` (defaulting to `Math.random`) per the note above. Vitest tests port the
   equivalent `tests.js` action-engine assertions (beat structure, carrier/ball
   continuity, pass-to-teammate-only, interception/tackle = turnover, xG bounds,
   goal-requires-shot, attack-stat consistency, reduced-squad behavior). The legacy JS
   file is **not deleted** — `engine.js` keeps calling it until Phase 15.

5. **Phase 5 — MatchEngine/MatchState orchestration port**
   (`src/match/MatchEngine.ts`, `src/match/MatchState.ts`). Port of `createMatchEngine`,
   `simulateMatch`, `simulateMinute`, standings/schedule/AI functions, Kings League
   special-rule windows (escalier, ballon spécial, dé géant, matchball, secret cards,
   president penalty — exact constants preserved, tests assert exact values). Produces the
   `MatchSnapshot` shape end-to-end (still consumed by nothing but Vitest at this point).

6. **Phase 6 — CollectiveMovement redesign** (`src/match/CollectiveMovement.ts`). The
   actual `MovementIntent`/`TeamShape`/steering rebuild described in the spec, replacing
   `matchchoreo.js`'s flat role system — this is the phase most likely to need its own
   sub-plan split (intent assignment, team shape computation, steering/separation, ball
   reception zones are each substantial). Fixed-step simulation (`FIXED_STEP = 1/15`)
   lives here or in `MatchBridge`; decide when writing this phase's plan.

7. **Phase 7 — Phaser scene** (`src/game/phaserConfig.ts`,
   `src/game/scenes/MatchScene.ts`, `src/rendering/*`). Reads `MatchSnapshot` only, never
   touches simulation state. Simple colored-disc rendering first (spec explicitly allows
   this — do not gold-plate visuals before movement quality is proven).

8. **Phase 8 — Integration** (`src/match/MatchBridge.ts` + `app.js` wiring). Mount Phaser
   into the existing `#match-pitch` container alongside a `MATCH_RENDERER` toggle
   (`"legacy" | "phaser"`), wire tactics/secret-card/president-penalty/speed/pause
   controls through the bridge, keep every other screen (`app.js`'s calendar/tactics/
   squad/mercato/standings/saves/summary rendering) untouched.

9. **Phase 9 — Test migration** to Vitest for everything ported so far; keep
   `tests.js`/`tests-node.js` covering whatever hasn't been ported yet (never delete an old
   test before its Vitest equivalent is green, per the spec).

10. **Phase 10 — Playwright real scenarios** replacing `tests/example.spec.ts`: start a
    test career, start a match, let several possessions play, assert the Phaser scene
    renders, assert multiple players change position, assert no console errors, screenshot,
    verify fast-forward/match end. Expose a test-only debug state hook if reasonable.

11. **Phase 11 — Debug overlay parity** in Phaser (keep the `D` key), extended per spec
    (intent, target, velocity vector, team shape, defensive/pressing lines, reception
    zones) — off by default.

12. **Phase 12 — Full rule verification pass** (40-minute matches, escalier, double goals,
    dé géant, matchball, secret cards, president penalty, yellow/red cards, reduced
    squads, no draws) against both renderers side by side via the toggle.

13. **Phase 13 — Remove legacy canvas rendering** only once Phaser has reached functional
    parity per the spec's success criteria — not before.

14. **Phase 14 — Update `CLAUDE.md` and `README.md`** to reflect the new architecture.

## Non-negotiable constraints carried through every phase

(Copied verbatim from the spec — repeat these in every subsequent phase's plan's own
"Global Constraints" section rather than pointing back here, so each plan is
self-contained per `writing-plans` convention.)

- TypeScript strict mode; avoid `any`.
- Simulation must never touch Phaser/DOM objects directly; only `MatchSnapshot` crosses
  the simulation → rendering boundary.
- Fixed-timestep simulation (10-20 Hz), Phaser renders at 60fps and interpolates; match
  outcomes must be framerate-independent.
- All old `localStorage` saves must keep loading; any new persisted `STATE` field needs a
  migration in `app.js:applySaveData`. The new in-memory match state does not need to be
  persisted if it wasn't before.
- Kings League rules (40-minute match, escalier, double-goal window, dé géant, matchball,
  secret cards, president penalty, cards/exclusions/reduced squads, no draws) must keep
  working identically, with tests pinning exact constants.
- Injured/suspended/sent-off players must never appear in the Phaser scene.
- `MATCH_RENDERER` legacy/phaser toggle must exist until legacy removal (phase 13).
- Never delete an old test before its Vitest equivalent exists and passes.
