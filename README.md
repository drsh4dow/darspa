# Dar Spa

[Product specification](https://github.com/drsh4dow/darspa/issues/1)

```sh
vp install --frozen-lockfile
vp run dev:prepare
vp run dev
vp run verify
```

- [Publishing content and the catalog](docs/content.md)
- [Public content and asset migration inventory](docs/migration/public-content.md)
- [Credential bootstrap and rotation](docs/environments.md)

## Public website

The public site preserves the legacy home, team, services, exams, news, shop and legal URLs. Contact information and individual news/offering pages have direct URLs. News and offering descriptions live in Markdown; team and ordinary copy live in source. Prismic is no longer a runtime dependency.

`vp run content` validates Markdown metadata and generates the shared published catalog, rendered content and public path list. `vp run build` runs this step and prerenders the public pages. `VITE_CONVEX_URL` is required to construct the application, but static content builds do not query the backend.

`vp run deploy:dev` publishes the backend and `dist/client` to the existing isolated Convex development deployment. It does not deploy a second application server. See the content guide for routing, SEO and retry behavior. Production domain cutover remains separate.

Instagram integration is pending fresh Meta authorization and backend implementation. The homepage currently links to Instagram without loading placeholders. Checkout and exam-order generation remain separate tickets.

## Routing and authentication

TanStack Start generates `src/routeTree.gen.ts` from `src/routes`. Commit it so type checking works before the first build; Start updates it during development and builds. Internal navigation uses TanStack Router links.

The data integration follows [Convex's TanStack Start guide](https://docs.convex.dev/client/tanstack/tanstack-start/). Each `getRouter()` invocation creates a `ConvexQueryClient` and a connected TanStack `QueryClient`. `setupRouterSsrQueryIntegration` owns query dehydration, hydration, and the Query provider. Convex Auth uses the adapter's same Convex client; there is no second subscription client or hand-written cache synchronization.

Account and admin screens remain client-only and use native Convex hooks on that shared client. Their component gates wait for session and role resolution before mounting private queries, and react to logout and role revocation. There are no private route loaders, so a `beforeLoad` gate would require extra auth synchronization without protecting an earlier data request. Revisit that choice before adding private loaders. Convex enforces authorization on every backend request regardless of the UI gate. Signed-out admin visits return to `/admin` after login through `/mi-cuenta`. `/cuenta` is not an alias.
