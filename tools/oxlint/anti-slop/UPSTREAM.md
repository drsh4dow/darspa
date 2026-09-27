# Anti-slop provenance

- Source: https://github.com/dmmulroy/anti-slop
- Commit: `c44ef22ca116d0ba62a3ff663a0bd13a3f3fa40b`
- Source path: `skills/install-anti-slop/assets/anti-slop/`
- Installed path: `tools/oxlint/anti-slop/`
- Installed using that revision's `skills/install-anti-slop/scripts/install.mjs`.
- Intentional deviations: none to plugin code. This provenance file and the source repository's root MIT license were added locally.
- All generic rules and all five Effect rules are enabled at `error` in `vite.config.ts`.
- Effect activation is configuration-only: the existing `effect/index.ts` plugin and source revision are unchanged; no dependency changes were needed.
- `no-service-constructor-imports` covers relative project imports, not package-alias imports.
- The nested Stylistic license and provenance are preserved in `vendor/eslint-stylistic/`.
