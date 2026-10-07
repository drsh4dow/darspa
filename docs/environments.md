# Environments, credentials and administration

## Alchemy and state

`alchemy.run.ts` accepts only `local`, `dev` and `prod` in the Darspa Cloudflare account. Each stage has a separate Worker, D1 database and R2 bucket. Production also owns the retained DNS records in `infra/dns.ts`.

Commands select the isolated `darspa` OAuth profile. Configure it with `vp exec alchemy profile edit --profile darspa --add Cloudflare` if needed. The grant needs D1, R2, Workers, DNS/zone and dynamic-redirect permissions, plus account and membership discovery. Do not substitute an unrelated profile or an API token. Credentials remain in Alchemy's user-level credential store, outside the repository.

State is local in `.alchemy/`; preserve it and do not deploy simultaneously from separate checkouts. A fresh checkout must explicitly adopt existing resources rather than recreate them. Configure shared state before enabling CI deployment. D1, R2 and DNS resources are retained on stack destruction; destroying a stack does not erase their data.

## Local and development

Infisical `dev:/cloudflare` supplies local and development provider settings. `vp run dev` starts Alchemy's local Worker on port 8787 and Vite on port 5173. Both ports must be free. Vite proxies the API and voucher documents to the local Worker. Local D1 and R2 do not use development data. The pinned `workerd` override supports the Worker's compatibility date; Alchemy beta.79 otherwise installs an older runtime.

```sh
vp run infra:plan:dev
vp run deploy:dev
```

These commands build assets first and load `dev:/cloudflare`. The development site is `https://dev.darspa.cl`. Its D1 database is `darspa-dev` (`f4a76bf2-54ec-41aa-b72b-64eb658813b1`). Development email is limited to `DEVELOPMENT_EMAIL_RECIPIENTS`, a comma-separated list of approved inboxes. Missing or malformed configuration fails closed.

Drizzle's schema is in `server/db/schema.ts`. Generate migrations with `vp exec drizzle-kit generate --name <name>` and review the SQL before deployment. Alchemy applies the committed Drizzle v1 migration folders in `server/db/migrations`; do not rename or regenerate an applied migration. D1 does not support interactive SQLite transactions; use its atomic batch interface. Application deployment does not roll back schema changes.

## Provider credentials

Each stage's `/cloudflare` folder supplies:

- `BETTER_AUTH_SECRET`: an independently generated authentication secret of at least 32 characters.
- `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET`: the Google OAuth client.
- `RESEND_API_KEY` and `AUTH_EMAIL_FROM`: the verified sending domain and sender.
- `WEBPAY_ENVIRONMENT`, `WEBPAY_COMMERCE_CODE` and `WEBPAY_API_KEY`: the payment provider configuration.
- `DEVELOPMENT_EMAIL_RECIPIENTS`: the local/development recipient allowlist.

The stack supplies `SITE_URL` and `APP_ENVIRONMENT`. Google callbacks are `<SITE_URL>/api/auth/callback/google`; development and `http://localhost:5173` are registered. Webpay returns to `<SITE_URL>/api/webpay/return` through GET or POST. A return is not proof of payment; the backend checks the provider and saved purchase terms before issuing vouchers.

Rotate secrets in Infisical, then plan and redeploy the affected stage. There is no application-side secret-sync cron. Keep old credentials valid until the deployment and relevant provider workflow succeed. Changing `BETTER_AUTH_SECRET` can require users to sign in again. Never put provider secrets in browser-public variables or command output.

Use integration Webpay credentials for development. Production checkout is enabled by owner authorization. Verification reached the production Webpay payment-method screen and cancelled the purchase without entering payment details or making a charge.

## Administrator access

The user must first sign in and have a verified email. The CLI checks the Darspa account, an explicit database UUID and the expected `darspa-dev` or `darspa-prod` database name. It atomically changes the role and records the previous role, new role, time, declared operator and reason. Repeating an already-applied change creates no additional audit event. The operator string is attribution supplied by the caller, not a Cloudflare-attested identity.

```sh
vp run admin:grant --database <uuid> --email <verified-email> --operator <operator-email> --reason '<reason>'
vp run admin:revoke --database <uuid> --email <verified-email> --operator <operator-email> --reason '<reason>'
```

Both commands use the `darspa` OAuth profile. Backend authorization reflects a role change immediately; the browser refreshes the session on focus and every 30 seconds.

## Production and domain ownership

Cloudflare is authoritative at `brodie.ns.cloudflare.com` and `demi.ns.cloudflare.com`. The `prod` stack owns the Worker custom domains for `darspa.cl` and `www.darspa.cl`, including the canonical redirect. Production `workers.dev` and preview URLs are disabled. Do not recreate the old apex Vercel CNAME alongside the Worker domain. The retained Vercel wildcard continues serving `edami.darspa.cl`; mail records are unchanged.

`vp run infra:plan:prod` and `vp run deploy:prod` load `prod:/cloudflare`. The production D1 database is `darspa-prod` (`3533812d-1663-4d57-b116-ee77fc354142`). It has fresh application data, separate from development and the legacy deployments. Production domain ownership is unconditional for the `prod` stage; no activation flag is required.

Development browser verification covers Google and email-link login, logout, sandbox payment, vouchers, staff operations and exam PDF generation. Production verification covers Google and email-link authentication, exam PDF generation and a cancelled production Webpay checkout. Local Google login and logout also passed against Alchemy's emulated D1.

Keep the old deployments, credentials and callbacks during the rollback window. Restoring Vercel requires detaching the Worker's apex domain before recreating its former CNAME, `d2273d29aa6eb7ea.vercel-dns-017.com`; it does not restore or migrate application data. Review a plan before any rollback so a later Alchemy deployment does not undo the intended routing.
