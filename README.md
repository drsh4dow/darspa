# Dar Spa

[Product specification](https://github.com/drsh4dow/darspa/issues/1)

```sh
vp install --frozen-lockfile
vp run dev
vp run verify
```

- [Publishing content and the catalog](docs/content.md)
- [Environments, credentials and administration](docs/environments.md)

## Public website

The public site preserves the legacy home, team, services, exams, news, shop and legal URLs. News and offering descriptions live in Markdown; team and ordinary copy live in source. Prismic is no longer a runtime dependency.

`vp run build` validates content, prepares the PDF artwork and prerenders public pages. It needs no deployment credentials or backend connection. Cloudflare Workers Static Assets serves these pages, fonts and images.

`vp run deploy:dev` deploys the isolated application at `https://dev.darspa.cl` through Alchemy. `vp run deploy:prod` deploys `https://darspa.cl`; `www` redirects to that origin. The Vercel wildcard still serves `edami.darspa.cl`. Old application deployments remain available during the migration's rollback window.

Google and email-link login, Webpay payments, transferable vouchers and anonymous exam-order generation are available. Development uses integration Webpay; production checkout is enabled with production credentials. Instagram integration remains pending fresh Meta authorization and backend implementation; the homepage links to Instagram without a placeholder feed.

## Backend and staff operations

`server/` contains Effect services backed by D1/Drizzle, Better Auth and R2. `shared/api.ts` defines the Effect HttpApi contract used by both the Worker and browser client. Payment settlement, voucher issuance and redemption use atomic D1 statements or batches. Durable job records, leases and a minute cron recover interrupted payment and email work; `waitUntil` accelerates processing but is not the recovery mechanism.

`/admin` supports customer/email lookup, purchases and Webpay orders, purchased/manual vouchers, PDF/email delivery, and QR/manual-code inspection. Manual vouchers have no customer owner or online payment; issuance requires a published offering, external-payment/courtesy classification, and a reason.

Issuance retries reuse a request ID. Redemption confirmations include the inspected revision, so an old confirmation cannot consume a voucher after reversal. Corrections retain history and original expiry. The administrator CLI requires an explicit database UUID and records role changes in D1.

## Routing and authentication

TanStack Start generates `src/routeTree.gen.ts` from `src/routes`. Commit it so type checking works before the first build. Internal navigation uses TanStack Router links.

Better Auth owns the client session. TanStack Query owns API data, with account-scoped private keys and polling instead of subscriptions. Ordinary queries poll every 30 seconds; unresolved payments and deliveries poll more frequently. Logout navigates to a fresh document to clear private query data.

Account, checkout, payment-result and admin screens remain client-only. Their gates wait for session and role resolution before mounting private queries. Every protected API request independently checks the session, role and ownership. Signed-out admin visits return to `/admin` after login through `/mi-cuenta`. `/cuenta` is not an alias.
