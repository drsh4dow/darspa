# Dar Spa

Replacement for the sibling `darspa-next` application. This slice provides an isolated development shell, not the public site or business workflows. Scope: [issue #2](https://github.com/drsh4dow/darspa/issues/2), governed by [specification #1](https://github.com/drsh4dow/darspa/issues/1).

## Start

Install [Vite+](https://viteplus.dev/guide/install) and the Infisical CLI, then authenticate Infisical and Convex with your own accounts. Versions are pinned in `package.json`; Vite+ manages Node and Bun. Keep the committed `bun.lock` as the only package-manager lockfile.

```sh
vp install --frozen-lockfile
vp run dev:prepare # deploy development functions and seed synthetic data; safe to repeat
vp run dev         # Convex watcher and Vite frontend together
```

Open the localhost URL printed by Vite. The development commands inject only Infisical `dev:/frontend`; the existing `.infisical.json` selects the project. They target the shared foundation development deployment, not a separate deployment per developer. Stop both watchers with Ctrl-C.

## Verify and host

```sh
vp run verify       # Oxfmt, strict/type-aware Oxlint, TypeScript, focused tests, build
vp run format       # apply Oxfmt
vp lint --fix       # apply safe lint fixes; run format afterwards
vp run deploy:dev   # prepare backend, build, atomically publish assets to Convex
```

Individual `check`, `format:check`, `lint`, `typecheck`, `test`, and `build` commands are in `package.json`. `vp check` rejects lint warnings. Third-party declaration files are skipped by TypeScript; owned frontend, backend, tests, and Vite configuration use strict checking. Vendored rules, generated bindings, and installed agent assets are excluded from lint/format, not application source.

The CI workflow runs `verify` with a frozen install and no secrets or deployments. Generated Convex bindings are committed so clean-checkout checks do not require cloud credentials. Regenerate them with `vp exec convex codegen` after changing the backend, against the development target.

Hosted development: <https://industrious-retriever-886.convex.site>. Reload `/desarrollo/comprobacion` to check SPA fallback. The page is marked `noindex`; public SEO and routing belong to the public-site slice. Convex static hosting owns `/`; future HTTP endpoints live under `/api`.

Before changing credentials, deployments, or provider configuration, read [environment operations](docs/environments.md). [Verification evidence](docs/verification.md) records what was exercised and remaining limits.

## Code boundaries

- `src/`: Spanish application shell, semantic Tailwind tokens, adapted shadcn button.
- `convex/`: schema, typed functions, static hosting, and internal development secret sync.
- `tools/oxlint/anti-slop/`: vendored rules with pinned provenance. Follow upstream's update procedure when upgrading; keep `oxlint` and `@oxlint/plugins` aligned with Vite+'s bundled version.

The foundation marker is intentionally public. Provider secrets never belong in a `VITE_` variable or a public query. Authentication, payments, email, patient data, and production hosting are not implemented here.
