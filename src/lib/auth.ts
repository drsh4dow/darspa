import { createAuthClient } from "better-auth/react";
import { inferAdditionalFields, magicLinkClient } from "better-auth/client/plugins";
import type { Auth } from "../../server/auth";

export const auth = createAuthClient({
  plugins: [inferAdditionalFields<Auth["Service"]>(), magicLinkClient()],
  sessionOptions: { refetchInterval: 30 },
});
