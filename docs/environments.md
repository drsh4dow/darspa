# Environment operations

## Targets and access

| Resource              | Target                                                                      |
| --------------------- | --------------------------------------------------------------------------- |
| Convex team / project | `darspa` / `darspa`                                                         |
| Development reference | `darspa:darspa:dev/foundation`                                              |
| Deployment            | `industrious-retriever-886`, type `dev`, region `us` (US East, N. Virginia) |
| Backend               | `https://industrious-retriever-886.convex.cloud`                            |
| Hosted frontend       | `https://industrious-retriever-886.convex.site`                             |
| Infisical project     | `b0bb221b-dffd-4c26-9600-6e5d9ea82205` (existing linkage)                   |

No production Convex deployment or domain attachment has been provisioned. Vercel still hosts the legacy application and manages DNS. Development contains only synthetic data and does not call external providers.

Use your authenticated CLI sessions for interactive work. Always select the Infisical environment explicitly. Never use a personal session token for unattended jobs. Avoid `convex env list` and unredirected `infisical export` in shared logs: they print values.

## Infisical layout

| Environment / path | Contents and consumers                                                                                                                    |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `dev:/frontend`    | Public `VITE_CONVEX_URL` and development `CONVEX_DEPLOYMENT`, injected by package scripts                                                 |
| `dev:/convex`      | `DARSPA_DEVELOPMENT_LABEL`, the only automatically synced variable in this slice                                                          |
| `dev:/automation`  | `INFISICAL_SYNC_TOKEN` and `INFISICAL_SYNC_CONVEX_KEY`; bootstrap credentials, backend only                                               |
| `prod:/providers`  | Existing `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `TX_API_KEY_ID`, `TX_API_KEY_SECRET`; stored for later provider slices, not deployed |

Existing Infisical `dev`, `staging`, and `prod` environments remain distinct; no default environment was added to the linkage.

The two legacy Vercel environments were pulled to restricted temporary files. Google and Webpay development credentials matched production, so none were copied into new development. Production credential presence is not proof of working provider access. Callback URLs must be configured for the new application in the owning slice.

Excluded legacy configuration: PostgreSQL URLs, NextAuth sessions/signing material, SMTP, Facebook login, retired Instagram credentials, old callback/public URLs, and Vercel/Turbo platform variables (including ephemeral OIDC tokens). Resend and Meta setup remain later-slice work. Production provider secrets are not accessible through the sync token.

## Automatic development sync

`convex/crons.ts` runs the internal `secretSync:reconcileDevelopment` action every minute. It reads the current Infisical folder through an unattended, read-only service token and patches only the explicitly owned marker on the fixed development deployment. The marker is deliberately public so its propagation can be seen on the page; additional backend secrets must never be returned by `development:status`.

Native discovery found a [Convex app connection](https://infisical.com/docs/integrations/app-connections/convex), but no Convex destination in Infisical's [secret-sync catalog](https://infisical.com/docs/integrations/secret-syncs/overview) or its source destination definitions (checked 2026-09-26). A small polling action is sufficient here. There is no public webhook, custom signing protocol, or second server. Convex authenticates the internal cron trigger. Polling costs about 43,200 reads/action invocations per 30 days; expected propagation is within one minute plus request time.

Safety and retry behavior:

- The action checks the current deployment URL and the deployment-specific key prefix before IO. The source project, environment, path, and destination are fixed in `convex/lib/developmentSync.ts`.
- Source imports, personal overrides, recursive reads, and reference expansion are disabled. Response metadata must match `dev:/convex`.
- Only `DARSPA_DEVELOPMENT_LABEL` is written; unknown keys are ignored. Missing, hidden, duplicate, or empty marker values fail closed. No variables are deleted. Unchanged values do not cause writes.
- Each HTTP call has a ten-second timeout. Convex permits [at most one execution of a given cron](https://docs.convex.dev/scheduling/cron-jobs#error-handling) at once. A failure appears in the cron dashboard/logs; the next tick reads current source data and retries. Avoid manually invoking sync while a cron run is active.
- A write may succeed even if its response is lost. Reconciliation is idempotent; the next invocation compares the current environment value. Failed uploads/syncs require no destructive cleanup.
- Logs contain a generic sync failure, never provider response bodies or secret values. Inspect credential scope/expiry and provider availability when failures persist.

View runs at <https://dashboard.convex.dev/t/darspa/darspa/industrious-retriever-886>. A harmless verification change is:

```sh
infisical secrets set 'DARSPA_DEVELOPMENT_LABEL=Prueba de desarrollo' --env dev --path /convex
```

Wait for the hosted page to update without rebuilding. Restore the intended label afterward. Keep production verification separate; this sync is intentionally development-only.

## Credentials and rotation

Infisical's machine-identity folder permissions require a paid plan on this account. The unused no-access identity was removed. The supported [service-token mechanism](https://infisical.com/docs/documentation/platform/token) supplies the required isolation without changing the plan.

- Infisical token `darspa-development-sync`: read-only, exact scope `dev:/convex`, one-year expiry (rotate before 2027-09-26).
- Convex key `infisical-development-sync`: restricted to development deployment `industrious-retriever-886`, with the deployment-wide authority exposed by the CLI. Application code narrows use to one environment variable; this key must remain backend-only. No production key exists.

Infisical `dev:/automation` owns both values. Copies in the Convex backend bootstrap the sync and are intentionally outside its writable allowlist. Rotation is an operator action, not recursive credential self-sync:

1. Create a replacement read-only Infisical token with `infisical service-token create --scope dev:/convex --access-level read --expiry-seconds 31536000 --token-only`. Redirect stdout to a mode-600 temporary file; never run it unredirected in a shared terminal. Remove the CLI's trailing newline before importing the token value.
2. Create a replacement development key with `vp exec convex deployment token create <name> --deployment darspa:darspa:dev/foundation --save-env <restricted-temporary-env-file>`.
3. Store replacements in Infisical `dev:/automation` using `infisical secrets set NAME=@<value-file> --env dev --path /automation`. The Convex key command emits an env file; extract its value privately before importing.
4. Pass each value to `vp exec convex env set NAME --deployment darspa:darspa:dev/foundation` through stdin, not command arguments. Do not inject `/automation` into Vite.
5. Confirm a harmless source change propagates automatically, then revoke the old credentials through their owning services. Remove only the temporary files created for rotation.

Use separate credentials and a reviewed allowlist when production sync is introduced. Never widen this token to `prod` or `/**`.
