import { NodeFileSystem } from "@effect/platform-node";
import { Effect, FileSystem } from "effect";
import { expect, test } from "vite-plus/test";

// Guard the application's color boundary without inspecting imported artwork or
// Tailwind's own palette. Components consume semantic tokens, not palette shades.
const palette =
  "(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)";

const paletteColor = `(?:${palette}-\\d+|white|black)`;

const colorUtilities =
  "(?:bg|text|border(?:-[trblxyse])?|divide|outline|ring(?:-offset)?|shadow|inset-shadow|fill|stroke|decoration|accent|caret|from|via|to)";

const forbiddenColors = [
  /#[\da-f]{3,8}\b/i,
  /\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/i,
  new RegExp(`\\b${colorUtilities}-${paletteColor}\\b`),
  /\b(?:color|background(?:-color)?|fill|stroke)\s*:\s*(?!var\(|inherit\b|initial\b|unset\b|revert\b|currentColor\b|transparent\b|none\b)[a-z]+\b/i,
];

test("application colors use semantic tokens backed by the Tailwind palette", () =>
  Effect.runPromise(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const violations: string[] = [];

      for (const path of yield* fs.glob("src/**/*.{css,ts,tsx}")) {
        const source = yield* fs.readFileString(path);

        for (const [index, line] of source.split("\n").entries()) {
          if (forbiddenColors.some((pattern) => pattern.test(line))) {
            violations.push(`${path}:${index + 1}: ${line.trim()}`);
          }
        }

        // Palette references belong only in the central semantic token definitions.
        const componentStyles =
          path === "src/styles.css" ? source.replace(/:root\s*\{[^}]*\}/, "") : source;

        if (new RegExp(`--color-${paletteColor}\\b`).test(componentStyles)) {
          violations.push(`${path}: palette variables outside the semantic theme`);
        }
      }

      expect(violations).toEqual([]);
    }).pipe(
      // The test boundary owns and releases its filesystem layer.
      // oxlint-disable-next-line effecttsgo/strict-effect-provide
      Effect.provide(NodeFileSystem.layer),
    ),
  ));
