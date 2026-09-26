import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { developmentTarget, syncDevelopmentSecrets } from "./lib/developmentSync";

// Infisical's Convex app connection manages access keys, not runtime secret synchronization.
export const reconcileDevelopment = internalAction({
  args: {},
  returns: v.object({ changed: v.boolean() }),
  handler: async () => {
    if (process.env["CONVEX_CLOUD_URL"] !== developmentTarget.deploymentUrl) {
      throw new Error("Development secret sync cannot run on another deployment");
    }

    const token = process.env["INFISICAL_SYNC_TOKEN"];
    const key = process.env["INFISICAL_SYNC_CONVEX_KEY"];

    if (!token || !key) throw new Error("Development secret sync credentials are missing");

    try {
      return await syncDevelopmentSecrets(token, key, process.env, fetch);
    } catch {
      // Provider errors (including invalid JSON) can contain secret response bodies.
      // Keep failure reporting in the cron dashboard, without logging those bodies.
      throw new Error(
        "Development secret sync failed. Next cron tick will reconcile against Infisical.",
      );
    }
  },
});
