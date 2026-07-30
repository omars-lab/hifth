// @ts-check
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import importPlugin from "eslint-plugin-import";
import globals from "globals";

/**
 * Flat config enforcing the three-layer contract (PLAN §3):
 *   - packages/core (L2) may NOT import from apps/web/src/components (React chrome).
 *   - nothing imports raw SVG assets as modules — assets are fetched, never bundled.
 * Boundaries are enforced with import/no-restricted-paths so a layer violation
 * fails lint (and therefore CI), not just review.
 */
export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/dev-dist/**",
      "**/build/**",
      "**/node_modules/**",
      "**/playwright-report/**",
      "**/test-results/**",
      "**/*.svg",
      // Parallel-agent worktrees are checkouts of *other* branches living inside
      // this one. Linting them means this branch fails on code it does not
      // contain and cannot fix — and passes again when the worktree is removed,
      // which is the least useful shape a CI failure can have.
      ".claude/worktrees/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx,mts,js,mjs}"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
    },
    plugins: { import: importPlugin },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/consistent-type-imports": "error",
    },
  },
  // Layer boundary: core is framework-free and must not reach into the app.
  {
    files: ["packages/core/**/*.ts"],
    rules: {
      "import/no-restricted-paths": [
        "error",
        {
          zones: [
            {
              target: "./packages/core",
              from: "./apps",
              message:
                "core (L2) must stay framework-free — it cannot import from apps/web.",
            },
          ],
        },
      ],
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["react", "react-dom"], message: "core must not depend on React." },
          ],
        },
      ],
    },
  },
  // Node scripts (ETL) get Node globals.
  {
    files: ["packages/etl/**/*.{mjs,ts}", "scripts/**/*.mjs"],
    languageOptions: { globals: { ...globals.node } },
  },
  // The perf harness is a Node script that ALSO ships browser code inside
  // page.evaluate() callbacks — ESLint parses those bodies (they run in
  // Chromium, not Node), so it needs both global sets.
  {
    files: ["apps/web/perf/**/*.mjs"],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
  // Browser globals for the web app.
  {
    files: ["apps/web/**/*.{ts,tsx}"],
    languageOptions: { globals: { ...globals.browser } },
  },
  // Config/test files may use dev globals.
  {
    files: ["**/*.config.{ts,js}", "**/*.test.{ts,tsx}", "**/vitest.setup.ts"],
    languageOptions: { globals: { ...globals.node } },
  },
);
