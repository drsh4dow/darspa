# Foundation verification

Verified on 2026-09-26 against development deployment `industrious-retriever-886` in US East.

## Automated checks

- A clean snapshot without `.env.local` or `node_modules` passed a frozen Bun install through Vite+, strict TypeScript, type-aware Oxlint with all generic anti-slop rules, Oxfmt, six focused tests, and production build. A second lint-fix/format pass left source files unchanged.
- A value-based check of 160 source/asset files found no known provider or automation credentials, including in browser bundles.
- Tests cover repeatable development preparation, the public query contract, owned-variable-only reconciliation, unchanged-value no-ops, invalid/wrong-environment source rejection, and refusal of a production key before network access.
- Vendored anti-slop source matches commit `c44ef22ca116d0ba62a3ff663a0bd13a3f3fa40b`; only local provenance and the upstream root license were added. The nested Stylistic license/provenance are intact.

## Local and hosted behavior

- `vp run dev` starts both the real Convex watcher and Vite frontend with Infisical public development configuration.
- The page reads a synthetic database record through `development:status`. Repeating preparation does not duplicate it.
- Convex static hosting serves the page and JS/CSS assets with appropriate content types. `/desarrollo/comprobacion` loads directly and survives a reload. A missing `.js` file returns 404 rather than HTML.
- Observed cache headers: HTML requires revalidation, the hashed JS has a one-year cache, and CSS has a four-hour cache. Publication uses the component's staged, atomic upload path.
- Desktop (1280px) and mobile (390px) screenshots were opened and reviewed. Loading and failed-connection states were exercised using a separate local frontend pointed at an unreachable test backend. The retry button reloads and retries. Keyboard activation of the skip link moves focus to `main`.
- Browser axe checks of the hosted success state and local error state found zero violations or incomplete checks for the selected WCAG A/AA tags. This is focused foundation verification, not certification of the future site.

## Live sync and isolation

- Removing the owned source marker made reconciliation fail with a sanitized error. The previous Convex value was retained.
- Restoring a new marker propagated through the next scheduled cron without manually invoking sync or rebuilding the frontend. The hosted browser displayed `Sincronización automática verificada`.
- A temporary unrelated destination variable stayed unchanged. A temporary unowned source variable was not copied. Both test sentinels were removed afterward.
- The scoped service token could not read the production Google credential (HTTP 404), and a private before/after comparison confirmed production provider values did not change during the sync test.
- The current Infisical plan rejected machine-identity folder grants. The unused identity was removed; a supported read-only `dev:/convex` service token provides the required scope instead.

## Limits

The [Quality workflow](https://github.com/drsh4dow/darspa/actions/workflows/ci.yml) runs on pushes to `master` and pull requests; its run history records remote results for each commit. No production Convex deployment, custom domain, authentication, payment, email, or Meta operation was performed. The legacy application's business workflows were not run; this slice makes no feature-parity claim. Provider integration checks belong to their later tickets.
