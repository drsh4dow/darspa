import staticHosting from "@convex-dev/static-hosting/convex.config";
import { defineApp } from "convex/server";

const app = defineApp({ httpPrefix: "/api" });

app.use(staticHosting, { httpPrefix: "/" });

export default app;
