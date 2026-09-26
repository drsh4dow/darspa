import type { ReactNode } from "react";
import type { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { App } from "../App";
import "../styles.css";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    links: [{ rel: "icon", href: "/favicon.png", type: "image/png" }],
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1.0" },
      { name: "robots", content: "noindex, nofollow" },
      { title: "Dar Spa" },
      {
        name: "description",
        content: "Centro Nutricional Avanzado en Castro, Chiloé.",
      },
    ],
  }),
  shellComponent: Document,
  component: Application,
});

function Document({ children }: { children: ReactNode }) {
  return (
    <html lang="es-CL">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function Application() {
  return (
    <App>
      <Outlet />
    </App>
  );
}
