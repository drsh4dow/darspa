import staticHosting from "@convex-dev/static-hosting/convex.config";
import rateLimiter from "@convex-dev/rate-limiter/convex.config";
import { defineApp } from "convex/server";

// Auth owns root discovery URLs; static hosting supplies the documented catch-all.
const app = defineApp();

app.use(staticHosting);

app.use(rateLimiter);

export default app;
