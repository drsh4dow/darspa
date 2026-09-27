import { fileURLToPath } from "node:url";
import { effectNative, strict as effectStrict } from "@effect/tsgo/oxlint-presets";
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { defineConfig } from "vite-plus";
import publicPaths from "./content/generated/paths.json";

const managedFiles = [
  ".agent/**",
  ".agents/**",
  ".claude/**",
  ".codex/**",
  ".continue/**",
  ".cursor/**",
  ".gemini/**",
  ".opencode/**",
  ".pi/**",
  ".roo/**",
  ".windsurf/**",
  "agent/**",
  "tools/oxlint/anti-slop/**",
  "convex/_generated/**",
  "src/routeTree.gen.ts",
  "skills-lock.json",
  ".infisical.json",
];

export default defineConfig({
  plugins: [
    tanstackStart({
      // Convex hosting uses index.html for all unmatched client-side routes.
      spa: { enabled: true, maskPath: "/mi-cuenta", prerender: { outputPath: "/index" } },
      prerender: { enabled: true, autoStaticPathsDiscovery: false, crawlLinks: false },
      pages: publicPaths.map((path) => ({
        path,
        prerender: { outputPath: path === "/" ? "/pages/home.html" : `/pages${path}.html` },
      })),
    }),
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    tailwindcss(),
  ],
  // The auth redirect allowlist deliberately accepts only this local origin.
  server: { port: 5173, strictPort: true },
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  fmt: { ignorePatterns: managedFiles },
  lint: {
    ignorePatterns: managedFiles,
    plugins: [
      "typescript",
      "react",
      "react-perf",
      "jsx-a11y",
      "import",
      "unicorn",
      "oxc",
      "effecttsgo",
    ],
    categories: { correctness: "error", suspicious: "error", perf: "error" },
    options: { typeAware: true, typeCheck: true, denyWarnings: true },
    jsPlugins: [
      { name: "vite-plus", specifier: "vite-plus/oxlint-plugin" },
      { name: "anti-slop", specifier: "./tools/oxlint/anti-slop/index.ts" },
    ],
    rules: {
      ...effectNative.rules,
      ...effectStrict.rules,
      "vite-plus/prefer-vite-plus-imports": "error",
      // Prefer explicit control flow and bindings without imposing cosmetic ordering.
      "prefer-const": "error",
      "no-nested-ternary": "error",
      "no-multi-assign": "error",
      "no-return-assign": ["error", "always"],
      "unicorn/error-message": "error",
      "unicorn/no-unreadable-array-destructuring": "error",
      // Convex's document metadata is part of its public API.
      "no-underscore-dangle": ["error", { allow: ["_id", "_creationTime"] }],
      "typescript/no-explicit-any": "error",
      "typescript/no-non-null-assertion": "error",
      "typescript/no-floating-promises": "error",
      "typescript/no-misused-promises": "error",
      "typescript/no-unsafe-assignment": "error",
      "typescript/no-unsafe-argument": "error",
      "typescript/no-unsafe-call": "error",
      "typescript/no-unsafe-member-access": "error",
      "typescript/no-unsafe-return": "error",
      "typescript/consistent-type-imports": "error",
      "typescript/consistent-type-exports": "error",
      "typescript/switch-exhaustiveness-check": "error",
      // React's automatic JSX runtime does not require a React import.
      "react/react-in-jsx-scope": "off",
      "import/no-duplicates": "error",
      "import/no-unassigned-import": ["error", { allow: ["**/*.css"] }],
      "react/rules-of-hooks": "error",
      "react/exhaustive-deps": "error",
      // React Compiler handles memoization; inline props do not warrant blanket bans.
      "react-perf/jsx-no-new-object-as-prop": "off",
      "react-perf/jsx-no-new-array-as-prop": "off",
      "react-perf/jsx-no-new-function-as-prop": "off",
      "oxc/no-accumulating-spread": "error",
      "anti-slop/no-array-filter-map": "error",
      "anti-slop/no-reduce-accumulator-copy": "error",
      "anti-slop/no-chained-type-assertions": "error",
      "anti-slop/no-conditional-empty-object-spread": "error",
      "anti-slop/no-known-value-widening": "error",
      "anti-slop/no-module-mocking": "error",
      "anti-slop/no-object-parameters": "error",
      "anti-slop/no-reflect-apply": "error",
      "anti-slop/no-reflect-get": "error",
      "anti-slop/no-runtime-typeof": "error",
      "anti-slop/no-shape-in-symbol-names": "error",
      "anti-slop/no-unknown-parameters": "error",
      "anti-slop/no-unknown-returns": "error",
      "anti-slop/no-unknown-type-aliases": "error",
      "anti-slop/no-unsafe-dictionary-type": "error",
      "anti-slop/no-widen-then-assert": "error",
      "anti-slop/require-readable-spacing": "error",
      "anti-slop/require-safety-comment-for-type-assertion": "error",
    },
  },
  test: {
    include: ["convex/**/*.test.ts", "content/**/*.test.ts", "scripts/**/*.test.ts"],
    env: {
      DARSPA_DEVELOPMENT_LABEL: "Configuración de prueba",
      CONVEX_CLOUD_URL: "https://industrious-retriever-886.convex.cloud",
      DEVELOPMENT_EMAIL_RECIPIENT: "recipient@example.com",
      RESEND_API_KEY: "test-only",
      AUTH_EMAIL_FROM: "Dar Spa <acceso@example.com>",
    },
    server: { deps: { inline: ["convex-test"] } },
  },
});
