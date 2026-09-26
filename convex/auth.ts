import Google from "@auth/core/providers/google";
import Resend from "@auth/core/providers/resend";
import { convexAuth } from "@convex-dev/auth/server";
import { z } from "zod";
import type { MutationCtx } from "./_generated/server";
import { developmentTarget } from "./lib/developmentSync";
import { checkDevelopmentRecipient, sendEmail } from "./lib/email";
import { emailAddress, resolveCustomerIdentity } from "./lib/identity";
import { signInEmail, signInLinkLifetimeMinutes } from "./lib/signInEmail";

const googleIdentity = z.object({
  sub: z.string().min(1),
  email: emailAddress,
  email_verified: z.literal(true),
});

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Google({
      // Google's email_verified claim must be true, not merely a claimed address.
      profile(rawProfile) {
        const profile = googleIdentity.parse(rawProfile);

        return { id: profile.sub, email: profile.email, emailVerified: true };
      },
    }),
    Resend({
      maxAge: signInLinkLifetimeMinutes * 60,
      async sendVerificationRequest({ identifier, url, token }) {
        const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));

        const fingerprint = Array.from(new Uint8Array(digest), (byte) =>
          byte.toString(16).padStart(2, "0"),
        ).join("");

        const assetOrigin = new URL(z.url().parse(process.env["CONVEX_SITE_URL"]));

        await sendEmail({
          ...signInEmail(new URL(url), assetOrigin),
          to: identifier,
          idempotencyKey: `sign-in/${fingerprint}`,
        });
      },
    }),
  ],
  callbacks: {
    async redirect({ redirectTo }) {
      const site = z.url().parse(process.env["SITE_URL"]);
      const destination = new URL(redirectTo, site);
      const allowed = [new URL(site).origin];

      if (process.env["CONVEX_CLOUD_URL"] === developmentTarget.deploymentUrl) {
        allowed.push("http://localhost:5173");
      }

      if (!allowed.includes(destination.origin) || destination.pathname !== "/mi-cuenta") {
        throw new Error("Destino de autenticación no permitido.");
      }

      return destination.href;
    },
    async createOrUpdateUser(ctx: MutationCtx, { existingUserId, profile, type }) {
      const email = emailAddress.parse(profile.email);
      checkDevelopmentRecipient(email);

      const userId = await resolveCustomerIdentity(ctx, {
        email,
        verified: profile.emailVerified === true,
        existingUserId,
      });

      if (type === "email") {
        const user = await ctx.db.get(userId);

        if (user?.lastSignInEmailAt !== undefined && Date.now() - user.lastSignInEmailAt < 60_000) {
          throw new Error("Espera un minuto antes de pedir otro enlace.");
        }

        await ctx.db.patch(userId, { lastSignInEmailAt: Date.now() });
      }

      return userId;
    },
  },
});
