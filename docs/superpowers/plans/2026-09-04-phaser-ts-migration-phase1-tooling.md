# Phase 1 — Tooling & Baseline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Get TypeScript (strict), Vite, Phaser 3 and Vitest installed and wired up so `npm install && npm run dev` boots the *existing, unmodified* Kings Manager app through Vite, `npm run build` produces a working static build, `npm test` runs a real (if minimal) Vitest suite, and `npm run test:e2e` runs a real Playwright smoke test — with zero behavior change to the game itself.

**Architecture:** Add a `src/` tree with a single `src/main.ts` entry (imports Phaser to prove the bundler pipeline works, mounts nothing yet) loaded as `<script type="module">` *after* the five existing classic `<script src="...">` tags in `index.html`, which keep loading `data.js`/`matchengine-actions.js`/`engine.js`/`matchchoreo.js`/`app.js` exactly as before, in the same order, as global non-module scripts. Vite serves/bundles both kinds of script from the same `index.html`. The old hand-rolled test suite (`tests.js`/`tests-node.js`/`tests.html`) is untouched and keeps being the authority on game logic; Vitest gets a new, separate, minimal smoke suite under `src/tests/` that proves it can reach the legacy globals (needed by later phases), not a rewrite of the existing tests.

**Tech Stack:** TypeScript 6.0.x (strict — NOT the newer TS 7 line: `typescript-eslint@8.69.0`'s peer range is `>=4.8.4 <6.1.0` as of this session, discovered during Task 2 execution), Vite 8, Phaser 3.90, Vitest 5, ESLint 10 + typescript-eslint 8 (flat config), @playwright/test 1.62 (already installed).

**Spec:** `docs/superpowers/plans/2026-09-04-phaser-ts-migration-roadmap.md` (the roadmap — itself derived from the user's full migration brief given in the 2026-09-04 conversation; read the roadmap's "Current-state summary" section before touching any file below, it records exact line numbers/behavior read directly from the source files).

## Global Constraints

- TypeScript strict mode; avoid `any` (from the very first `src/` file onward, even though Phase 1 only adds one trivial file).
- Zero behavior change to the running game in this phase — every existing screen, save, and match must work identically through `npm run dev` as it does today opening `index.html` directly.
- `data.js`/`matchengine-actions.js`/`engine.js`/`matchchoreo.js`/`app.js` are NOT modified in this phase except the one-line `<script type="module" src="/src/main.ts">` addition to `index.html` itself (not to the four files it loads).
- `tests-node.js` must keep working unmodified (`node tests-node.js` — do not change `package.json`'s `"type"` field, it would break its `require()` calls).
- Never delete or rewrite `tests.js`/`tests-node.js`/`tests.html` in this phase.
- All old `localStorage` saves must keep loading (nothing in this phase touches `STATE`/`applySaveData`, so this is automatically satisfied — verified by manual check in Task 6, not by code change).
- Baseline established this session: `node tests-node.js` → **59/60 passing**, one pre-existing unrelated data-integrity failure (`Karasu FC` roster short on `DEF` players) — not a regression to chase in this phase.

---

### Task 1: Migration branch + recorded baseline

**Files:**
- None created/modified — this task is git/process only.

**Interfaces:**
- Produces: a `migration/phaser-ts` branch, and the confirmed baseline test output this plan's Global Constraints already state (59/60), used by every later task as the "did I break anything" reference.

- [x] **Step 1: Create and switch to the migration branch**

Run: `git checkout -b migration/phaser-ts`
Expected: `Switched to a new branch 'migration/phaser-ts'`

- [x] **Step 2: Re-confirm the baseline test suite passes at the same rate**

Run: `node tests-node.js`
Expected: last line `59/60 tests réussis`, exit code `1` (the one pre-existing `Karasu FC` DEF-count failure — expected, not a regression). If the count differs from 59/60, STOP and investigate before continuing — Phase 1 must start from a known baseline.

- [x] **Step 3: Commit nothing yet (empty step, baseline is a read-only check)**

No commit here — Task 2 makes the first real commit once `package.json`/lockfile exist to commit.

---

### Task 2: Install TypeScript, Vite, Phaser, Vitest and configure them

**Files:**
- Modify: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.mts`
- Create: `vitest.config.mts`
- Create: `src/main.ts`
- Modify: `index.html`

**Interfaces:**
- Produces: a `src/` TypeScript entry point that later phases add real modules under (`src/match/`, `src/game/`, `src/data/`, `src/rendering/`), and the `npm run dev`/`npm run build` scripts every later task relies on.

- [x] **Step 1: Install the new dependencies**

Run:
```bash
npm install --save-dev typescript@^6.0.3 vite@^8.2.2 phaser@^3.90.0 vitest@^5.0.0 eslint@^10.9.1 typescript-eslint@^8.69.0
```
Expected: `package.json`'s `devDependencies` gains `typescript`, `vite`, `phaser`, `vitest`, `eslint`, `typescript-eslint`; `package-lock.json` updates; exit code 0. (Versions above are what was current on npm as of this session. TypeScript is pinned to the 6.0.x line, not the newer 7.x — `typescript-eslint@8.69.0`'s peer range is `>=4.8.4 <6.1.0`; TS 7.0.2 resolves with an ERESOLVE conflict against it. Re-check this constraint before bumping TypeScript in a later phase.)

- [x] **Step 2: Add npm scripts to `package.json`**

Edit the `"scripts"` field to:
```json
"scripts": {
  "dev": "vite",
  "build": "tsc --noEmit && vite build",
  "preview": "vite preview",
  "test": "vitest run",
  "test:watch": "vitest",
  "test:legacy": "node tests-node.js",
  "test:e2e": "playwright test",
  "lint": "eslint ."
}
```
Also change `"main": "app.js"` is fine to leave as-is (unrelated to the browser app), and leave `"type": "commonjs"` untouched (Global Constraints — `tests-node.js` needs `require()` to keep working).

- [x] **Step 3: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "module": "ESNext",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "skipLibCheck": true,
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "forceConsistentCasingInFileNames": true,
    "types": ["vite/client", "node"]
  },
  "include": ["src"]
}
```
This intentionally does NOT include `app.js`/`engine.js`/etc. (they stay plain global-scope JS, ported to `src/` in later phases per the roadmap) — `tsc --noEmit` only type-checks `src/`.

(`"node"` was added to `types` after first writing this file with only `["vite/client"]` — Task 3's `src/tests/smoke.test.ts` uses `node:fs`/`node:path`/`node:url`/`node:vm`, and without `"node"` in `types`, `tsc --noEmit` fails with `TS2591: Cannot find name 'node:fs'` even though `@types/node` is installed, since an explicit `types` array opts out of auto-including every installed `@types/*` package. Caught by running `npm run build` — Task 2 Step 9's own verification only ran the build BEFORE Task 3 added that test file, so this didn't surface until the Definition of Done's full re-run.)

- [x] **Step 4: Create `vite.config.mts`** (note the `.mts` extension, not `.ts` — `package.json` keeps `"type": "commonjs"` per the Global Constraints, and Vite 8's native config loader warns/will-error on ESM `import`/`export default` syntax in a `.ts` file loaded as CommonJS; `.mts` forces ESM parsing regardless of `package.json`'s `type`, discovered while verifying `npm run dev` in this task)

```ts
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    target: "es2020",
    outDir: "dist"
  }
});
```
Root defaults to the project root (where `index.html` already lives), so no `root`/`publicDir` override is needed — Vite serves the existing `images/`, `style.css`, and the five legacy `<script src>` files exactly where they already are.

- [x] **Step 5: Create `vitest.config.mts`** (same `.mts` reasoning as Step 4)

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"]
  }
});
```

- [x] **Step 6: Create `src/main.ts`**

```ts
import Phaser from "phaser";

// Étape 1 de la migration (voir docs/superpowers/plans/2026-09-04-phaser-ts-migration-roadmap.md) :
// vérifie seulement que la chaîne Vite/TypeScript/Phaser fonctionne et se charge APRÈS l'app
// legacy (data.js/matchengine-actions.js/engine.js/matchchoreo.js/app.js, chargés juste avant en
// tant que scripts classiques) — ne monte encore rien à l'écran, aucun changement de comportement.
console.log(`[kings-manager] pipeline Vite/TypeScript/Phaser prête (Phaser ${Phaser.VERSION})`);
```

- [x] **Step 7: Load the new entry point from `index.html`, after the legacy scripts**

In `index.html`, after line 699 (`  <script src="app.js"></script>`) and before `</body>`, add:
```html
  <script type="module" src="/src/main.ts"></script>
```
So the tail of the file reads:
```html
  <script src="data.js"></script>
  <script src="matchengine-actions.js"></script>
  <script src="engine.js"></script>
  <script src="matchchoreo.js"></script>
  <script src="app.js"></script>
  <script type="module" src="/src/main.ts"></script>
</body>

</html>
```

- [x] **Step 8: Verify `npm run dev` boots the existing app unchanged**

Run: `npm run dev` (in background/separate terminal, or with a short timeout), then fetch `http://localhost:5173/` (Vite's default port — check the terminal output for the actual port it picked).
Expected: HTTP 200, the page HTML contains `id="screen-home"` and `KINGS MANAGER 7v7`, and the five legacy `<script src="...">` tags are served as-is (check with `curl -s http://localhost:5173/data.js | head -c 200` — should return the start of `data.js`, not a 404 or a Vite transform error). Stop the dev server after checking (`Ctrl+C`, or kill the background process).

- [x] **Step 9: Verify `npm run build` succeeds — and add a static-copy plugin (discovered necessary during this task)**

Run: `npm run build` first, as a naive check. It reports `✓ built in ...` (exit 0) but this is misleading: `vite build` (unlike `vite dev`) silently refuses to bundle any classic (non `type="module"`) `<script src>` — it leaves the 5 legacy `<script src="data.js">` etc. tags untouched in `dist/index.html` but never copies `data.js`/`matchengine-actions.js`/`engine.js`/`matchchoreo.js`/`app.js` into `dist/`. Separately, `images/players/**` is referenced only dynamically at runtime (`app.js:playerPhotoUrl`, string-built paths) so it never appears in Vite's static asset graph either and is also never copied. Left as-is, the production build serves a game where every legacy script 404s and every player photo 404s — confirmed by inspecting `dist/` after a first build (only `index.html` and `assets/` existed, no `data.js`, no `images/`).

Fix: add a small local Vite plugin to `vite.config.mts` that copies these specific files/directories into `dist/` on build (avoids adding a new dependency for something this targeted):

```ts
import { defineConfig, type Plugin } from "vite";
import { cpSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// L'app legacy (data.js/matchengine-actions.js/engine.js/matchchoreo.js/app.js, chargés en
// balises <script> classiques, voir CLAUDE.md) et images/ (photos référencées dynamiquement par
// app.js, ex. playerPhotoUrl — jamais présentes littéralement dans le HTML/CSS, donc invisibles au
// graphe de modules de Vite) doivent être copiées telles quelles dans dist/ : `vite dev` les sert
// déjà directement depuis la racine du projet, mais `vite build` ignore silencieusement tout
// <script src> non "module" et tout fichier jamais référencé littéralement — sans cette copie
// explicite, le build de production charge un jeu cassé (404 sur data.js et sur chaque photo).
const LEGACY_STATIC_FILES = ["data.js", "matchengine-actions.js", "engine.js", "matchchoreo.js", "app.js"];
const LEGACY_STATIC_DIRS = ["images"];

function copyLegacyStaticAssets(): Plugin {
  return {
    name: "copy-legacy-static-assets",
    apply: "build",
    closeBundle() {
      const outDir = resolve(__dirname, "dist");
      for (const file of LEGACY_STATIC_FILES) {
        cpSync(resolve(__dirname, file), resolve(outDir, file));
      }
      for (const dir of LEGACY_STATIC_DIRS) {
        cpSync(resolve(__dirname, dir), resolve(outDir, dir), { recursive: true });
      }
    }
  };
}

export default defineConfig({
  plugins: [copyLegacyStaticAssets()],
  build: {
    target: "es2020",
    outDir: "dist"
  }
});
```
(`style.css` and `images/favicon.png` do NOT need this treatment — Vite already bundles them correctly since `index.html` references them literally via `<link rel="stylesheet">`/`<link rel="icon">`/`<img src>`, confirmed present as hashed files under `dist/assets/` in the build output.)

Re-run: `npm run build`
Expected: `tsc --noEmit` reports no errors, `vite build` completes, and this time `dist/` contains `index.html`, `assets/` (bundled JS/CSS/favicon), the 5 legacy `.js` files copied verbatim, and a full `images/` copy (confirm with `Get-ChildItem dist` — should list all 5 `.js` files and an `images` directory; `(Get-ChildItem dist\images -Recurse -File).Count` should roughly match `(Get-ChildItem images -Recurse -File).Count`). The "can't be bundled without type=module" lines still print during the build — harmless now that the plugin's `closeBundle` copies those exact files right after, but real: don't mistake it for a new problem in a later phase.

- [x] **Step 10: Verify the build output actually runs**

Run: `npm run preview` (serves `dist/`), fetch the root URL.
Expected: HTTP 200, same `id="screen-home"` content as Step 8. Stop the preview server after checking. Also spot-checked `GET /data.js`, `/app.js`, and `/images/favicon.png` through the preview server — all HTTP 200.

- [x] **Step 11: Re-run the legacy baseline to confirm no regression**

Run: `node tests-node.js`
Expected: still `59/60 tests réussis` (unchanged from Task 1 Step 2 — nothing in this task touched `data.js`/`matchengine-actions.js`/`engine.js`/`matchchoreo.js`).

- [ ] **Step 12: Commit**

```bash
git add package.json package-lock.json tsconfig.json vite.config.mts vitest.config.mts src/main.ts index.html
git commit -m "$(cat <<'EOF'
Add Vite + TypeScript + Phaser + Vitest tooling, app boots unchanged

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01VVyw7NW46uymNTs4Cnoacb
EOF
)"
```

---

### Task 3: Minimal Vitest smoke suite (pipeline + legacy-globals reachability)

**Files:**
- Create: `src/tests/smoke.test.ts`

**Interfaces:**
- Consumes: none from earlier tasks beyond `vitest.config.ts`'s `include: ["src/**/*.test.ts"]`.
- Produces: proof, relied on by every later phase's Vitest tests, that a Vitest test file CAN load the legacy global-scope files (`data.js` etc.) via the same `vm.runInContext` technique `tests-node.js` already uses — later phases' tests for the TypeScript ports will compare against these same legacy globals during the transition.

- [x] **Step 1: Write the failing test**

Create `src/tests/smoke.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "../..");

describe("vitest pipeline", () => {
  it("runs a basic assertion", () => {
    expect(1 + 1).toBe(2);
  });
});

describe("legacy globals reachability (same technique as tests-node.js)", () => {
  it("loads data.js and finds the 6 Kings League leagues", () => {
    const context: Record<string, unknown> = {};
    vm.createContext(context);
    const code = readFileSync(resolve(projectRoot, "data.js"), "utf8");
    vm.runInContext(code, context, { filename: "data.js" });
    // `const LEAGUES = ...` is a top-level lexical declaration: per the ECMAScript spec it lives
    // in the global *lexical* environment, not as an own property of the vm context's global
    // object (unlike `function`/`var` declarations, which vm DOES expose as context properties —
    // that's how tests-node.js reaches `context.runAllTests()`). Pull it out explicitly by
    // running one more statement in the SAME context, which can see the lexical `LEAGUES` as a
    // free variable and assign it onto `this` (the context's global object).
    vm.runInContext("this.LEAGUES = LEAGUES;", context);

    const leagues = context.LEAGUES as Record<string, { name: string; teams: unknown[] }>;
    expect(Object.keys(leagues).sort()).toEqual(
      ["brazil", "france", "germany", "italy", "mexico", "spain"].sort()
    );
    expect(leagues.france.teams.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run it, hit the expected `const`-vs-`vm` snag, and fix it**

Run: `npm test`
Expected on the FIRST attempt (without the `this.LEAGUES = LEAGUES;` line above): `TypeError: Cannot convert undefined or null to object` at `Object.keys(leagues)` — `context.LEAGUES` is `undefined`. Reason: `data.js` declares `const LEAGUES = {...}` at top level; per the ECMAScript spec, a top-level `const`/`let` lives in the global *lexical* environment, not as an own property of the vm context object (unlike `function`/`var` declarations, which DO become context properties — that's how `tests-node.js` successfully calls `context.runAllTests()`, since `tests.js` declares `function runAllTests() {...}`). Fix: add the extra `vm.runInContext("this.LEAGUES = LEAGUES;", context);` statement shown above (already included in the Step 1 code block) — it runs in the SAME context, so it can see the lexical `LEAGUES` as a free variable and assign it as a real property. Later phases' Vitest tests that need other legacy `const`s (`FORMATIONS`, `MATCH_BALANCE`, etc.) will need the same pattern.

- [x] **Step 3: Confirm it passes**

Run: `npm test`
Expected: `Test Files 1 passed (1)`, `Tests 2 passed (2)`, exit code 0.

- [x] **Step 4: Commit**

```bash
git add src/tests/smoke.test.ts
git commit -m "$(cat <<'EOF'
Add Vitest smoke suite proving legacy-globals reachability

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01VVyw7NW46uymNTs4Cnoacb
EOF
)"
```

---

### Task 4: Minimal ESLint flat config for `src/`

**Files:**
- Create: `eslint.config.mjs` (`.mjs`, not `.js` — same `"type": "commonjs"` reasoning as `vite.config.mts`/`vitest.config.mts` in Task 2: a `.js` file using `import`/`export default` would be parsed as CommonJS and fail; confirmed by hitting this immediately when first named it `eslint.config.js`)

**Interfaces:**
- Produces: `npm run lint` (already wired in Task 2's `package.json`), scoped to `src/**/*.ts` only — the legacy root-level `.js` files are intentionally NOT linted in this phase (they are untouched global-scope scripts pending their own port; adding lint rules to them now would create noise unrelated to this migration).

- [x] **Step 1: Create `eslint.config.mjs`**

```js
// @ts-check
import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.ts"]
  },
  {
    ignores: ["dist/**", "node_modules/**", "*.js", "src/**/*.test.ts"]
  }
);
```
Note the last `ignores` entry excludes every root-level `*.js` (the legacy `data.js`/`engine.js`/etc.) and test files from linting for now — only `src/**/*.ts` production code is linted starting this phase. `eslint.config.mjs`/`vite.config.mts`/`vitest.config.mts` themselves are `.mjs`/`.mts`, not `.js`, so the `*.js` ignore pattern doesn't need to (and shouldn't) special-case them.

- [x] **Step 2: Install `@eslint/js` (peer dependency used above)**

Run: `npm install --save-dev @eslint/js`
Expected: added to `devDependencies`, exit code 0.

- [x] **Step 3: Run lint and confirm it passes clean**

Run: `npm run lint`
Expected: no errors (only `src/main.ts` and `src/tests/smoke.test.ts` — the latter is excluded by `ignores`, so only `src/main.ts` is actually linted; it's simple enough to pass `recommended` cleanly). Exit code 0.

- [x] **Step 4: Commit**

```bash
git add eslint.config.mjs package.json package-lock.json
git commit -m "$(cat <<'EOF'
Add minimal ESLint flat config scoped to src/

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01VVyw7NW46uymNTs4Cnoacb
EOF
)"
```

---

### Task 5: Playwright config wired to the Vite dev server + real smoke test

**Files:**
- Modify: `playwright.config.ts`
- Modify: `tests/example.spec.ts` (replace its content entirely — same filename kept for this phase; a rename to something like `tests/app-boot.spec.ts` is left to a later phase alongside the rest of the Playwright work, to keep this task's diff minimal)

**Interfaces:**
- Produces: `npm run test:e2e` that boots the real app via `npm run dev` automatically (Playwright's `webServer` option) rather than requiring a manually-started server.

- [x] **Step 1: Add a `webServer` block and `baseURL` to `playwright.config.ts`**

In `playwright.config.ts`, uncomment/replace the existing commented-out `baseURL` and `webServer` blocks:
```ts
  use: {
    baseURL: "http://localhost:5173",

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: "on-first-retry",
  },
```
and, after the `projects` array (before the final closing `});`), add:
```ts

  webServer: {
    command: "npm run dev",
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
  },
```

- [x] **Step 2: Replace `tests/example.spec.ts` with a real smoke test of this app**

```ts
import { test, expect } from "@playwright/test";

test("app boots to the home screen with no console errors", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => consoleErrors.push(err.message));

  await page.goto("/");

  await expect(page.locator("#screen-home")).toBeVisible();
  await expect(page).toHaveTitle("Kings Manager 7v7");

  expect(consoleErrors).toEqual([]);
});
```

- [x] **Step 3: Run the e2e test**

Run: `npm run test:e2e`
Expected: Playwright starts the Vite dev server itself (per `webServer`), runs the one test across the `chromium`/`firefox`/`webkit` projects already configured, all pass. Exit code 0. (Actual: `3 passed (25.7s)`.)

- [x] **Step 4: Commit**

```bash
git add playwright.config.ts tests/example.spec.ts
git commit -m "$(cat <<'EOF'
Wire Playwright to the Vite dev server, replace boilerplate test

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01VVyw7NW46uymNTs4Cnoacb
EOF
)"
```

---

### Task 6: Manual save-compatibility spot check + `.gitignore` update

**Files:**
- Modify: `.gitignore`

**Interfaces:**
- None — this task is a verification + one config tweak, no new production code.

- [x] **Step 1: Add the Vite build output directory to `.gitignore`**

Append to `.gitignore`:
```
# Vite
dist/
```

- [x] **Step 2: Manual check — an existing save still loads through `npm run dev`**

No `mcp__claude-in-chrome__*` browser-automation tool was available this session, so instead of manually clicking through the UI, this was verified with a throwaway Playwright test (`tests/_tmp-save-check.spec.ts`, deleted immediately after — not part of the permanent suite) that calls the app's own real global save functions (`app.js`'s `STATE`/`saveGame`/`getSavesMap`/`applySaveData`, all plain top-level `function`/`let` declarations from a classic script — genuinely global on `window` in a real browser, unlike the `vm`-context `const` gotcha hit in Task 3) through `page.evaluate`: set a minimal `STATE`, call `saveGame()`, assert `localStorage["kingsManager7v7_saves"]` contains it, `page.reload()`, call `getSavesMap()` + `applySaveData()`, assert the reloaded `STATE.league.name` matches. Result: **passed** (`1 passed (4.3s)`, chromium) — confirms Task 2's `<script type="module" src="/src/main.ts">` addition doesn't disturb the legacy scripts' execution order/global exposure or `localStorage` round-tripping. Test file deleted after this passed; this exact scenario becomes a real permanent Playwright test in a later phase once there's a Phaser-rendered match to also assert on.

- [x] **Step 3: Commit**

```bash
git add .gitignore
git commit -m "$(cat <<'EOF'
Ignore Vite build output

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01VVyw7NW46uymNTs4Cnoacb
EOF
)"
```

---

## Definition of done for Phase 1

- [x] `npm install && npm run dev` boots the unmodified game (all existing screens/saves work).
- [x] `npm run build` succeeds (`tsc --noEmit` clean + `vite build` produces a working `dist/`).
- [x] `npm test` passes (Vitest smoke suite).
- [x] `npm run test:legacy` still reports `59/60` (unchanged baseline).
- [x] `npm run test:e2e` passes (Playwright smoke test, auto-boots the dev server).
- [x] `npm run lint` passes clean on `src/`.
- [x] Everything is committed on `migration/phaser-ts`, in small commits, one per task.
- [x] The roadmap doc (`2026-09-04-phaser-ts-migration-roadmap.md`) is updated to note Phase 1 is done and record anything learned that changes assumptions for Phase 2 (domain types).

**Phase 1 completed 2026-09-04.** Full re-verification pass, all green: `npm run build` (`✓ built in 999ms`), `npm test` (`Test Files 1 passed`, `Tests 2 passed`), `npm run test:legacy` (`59/60`, same pre-existing unrelated failure), `npm run lint` (clean), `npm run test:e2e` (`3 passed`, chromium/firefox/webkit). Seven commits on `migration/phaser-ts`. See the roadmap's "Phase 1 — done" note for what changes for Phase 2.

Do not start Phase 2 (domain types) in this plan — write its own bite-sized plan once Phase 1's Definition of Done is fully checked off, per the roadmap's "why plans get written late" rationale.
