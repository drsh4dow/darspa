import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexQueryClient } from "@convex-dev/react-query";
import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";
import { routeTree } from "./routeTree.gen";
import { PageError, PageNotFound } from "./components/route-feedback";

export function getRouter() {
  const convexUrl = import.meta.env.VITE_CONVEX_URL;

  if (!convexUrl) throw new Error("VITE_CONVEX_URL is required to build and run Dar Spa.");

  const convexQueryClient = new ConvexQueryClient(convexUrl);

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        queryKeyHashFn: convexQueryClient.hashFn(),
        queryFn: convexQueryClient.queryFn(),
      },
    },
  });

  convexQueryClient.connect(queryClient);

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
    defaultPendingComponent: () => <output>Cargando…</output>,
    defaultErrorComponent: PageError,
    defaultNotFoundComponent: PageNotFound,
  });

  router.options.Wrap = ({ children }) => (
    <ConvexAuthProvider
      client={convexQueryClient.convexClient}
      replaceURL={(href) => router.navigate({ href, replace: true })}
    >
      {children}
    </ConvexAuthProvider>
  );

  setupRouterSsrQueryIntegration({ router, queryClient });

  return router;
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
