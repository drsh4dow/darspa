import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";
import { routeTree } from "./routeTree.gen";
import { PageError, PageNotFound } from "./components/route-feedback";

export function getRouter() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        enabled: !import.meta.env.SSR,
        staleTime: 10_000,
        refetchInterval: 30_000,
        retry: false,
        throwOnError: true,
      },
    },
  });

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

  setupRouterSsrQueryIntegration({ router, queryClient });

  return router;
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
