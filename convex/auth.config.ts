import type { AuthConfig } from "convex/server";
import { z } from "zod";

export default {
  providers: [{ domain: z.url().parse(process.env["CONVEX_SITE_URL"]), applicationID: "convex" }],
} satisfies AuthConfig;
