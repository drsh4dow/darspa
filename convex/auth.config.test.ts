import { expect, test } from "vite-plus/test";
import authConfig from "./auth.config";

test("the configured JWT issuer is not normalized with a trailing slash", () => {
  expect(authConfig.providers).toEqual([
    { domain: "https://synthetic.convex.site", applicationID: "convex" },
  ]);
});
