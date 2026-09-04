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
