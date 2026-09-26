# Dar Spa

[Product specification](https://github.com/drsh4dow/darspa/issues/1)

```sh
vp install --frozen-lockfile
vp run dev:prepare
vp run dev
vp run verify
```

[Credential bootstrap and rotation](docs/environments.md)

## Routing and static builds

TanStack Start generates the route tree from `src/routes`. Commit `src/routeTree.gen.ts` so type checking works before the first build; the Start plugin updates it during development and builds. Internal navigation uses TanStack Router links.

The existing screens are `/`, `/mi-cuenta`, and `/admin`. `/cuenta` is not an alias.

### Data and authentication

The data integration follows [Convex's TanStack Start guide](https://docs.convex.dev/client/tanstack/tanstack-start/). Each `getRouter()` invocation creates a `ConvexQueryClient` and a connected TanStack `QueryClient`. `setupRouterSsrQueryIntegration` owns query dehydration, hydration, and the Query provider. Convex Auth uses the adapter's same Convex client; there is no second subscription client or hand-written cache synchronization.

The homepage loader awaits its public query through the shared QueryClient before rendering, so the static document includes the result without a streaming reveal script. The component reads that same query with `useSuspenseQuery`; the adapter subscribes to updates in the browser. Only the WebSocket connection indicator is client-only.

Account and admin screens remain client-only and use native Convex hooks on that shared client. Their component gates wait for session and role resolution before mounting private queries, and react to logout and role revocation. There are no private route loaders, so a `beforeLoad` gate would require extra auth synchronization without protecting an earlier data request. Revisit that choice before adding private loaders. Convex enforces authorization on every backend request regardless of the UI gate. Signed-out admin visits return to `/admin` after login through `/mi-cuenta`.

### Build and hosting limits

`vp run build` prerenders the homepage, including its public Convex query result, and generates a generic SPA shell in `dist/client`. `VITE_CONVEX_URL` and a reachable Convex deployment are required at build time; missing configuration or a failed prerender fails the build. Only `dist/client` is uploaded by `vp run deploy:dev`; the server bundle is not deployed. Public content changes require a rebuild and upload to update the HTML crawlers receive, even though hydrated browsers receive live updates.

Convex static hosting 0.2.1 always falls back to `index.html` and does not resolve directory indexes. Therefore:

- `home.html` contains the prerendered homepage. The exact `/` HTTP handler serves it.
- `index.html` contains Start's SPA shell, used for account/admin deep links and unknown extensionless paths.
- The client renders a missing-page screen for unknown routes. The host's SPA fallback still returns HTTP 200, not 404.

The exact homepage handler is a workaround for this hosting package, not a TanStack Start requirement. It is intentionally limited to `/`; assets and SPA fallback remain the package's responsibility. Additional public pages need both prerender output and clean-URL serving. Prefer native prerender-aware hosting support over growing a custom file server. A page-specific document cannot be used as the generic SPA fallback without risking hydration mismatches.

This is not yet a production SEO deployment. Before indexing public pages, resolve clean-URL serving and real HTTP 404 responses, and configure production canonical URLs. All current screens remain `noindex, nofollow`; account/admin pages must stay excluded when public pages become indexable.
