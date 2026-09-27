import { Effect, Schema } from "effect";
import { expect, test } from "vite-plus/test";
import { accountSearch } from "./account-search";

const decodeAccountSearch = Schema.decodeUnknownEffect(accountSearch);

test("account search preserves valid sign-in fields and strips unrelated parameters", () => {
  expect(Effect.runSync(decodeAccountSearch({}))).toEqual({});
  expect(
    Effect.runSync(
      decodeAccountSearch({
        code: "sign-in-token",
        metodo: "google",
        redirect: "/admin",
        unrelated: "ignored",
      }),
    ),
  ).toEqual({ code: "sign-in-token", metodo: "google", redirect: "/admin" });
});

test("invalid optional choices are discarded without accepting an invalid authentication code", () => {
  for (const redirect of ["https://example.com", "//example.com", "/admin/other", null]) {
    expect(
      Effect.runSync(decodeAccountSearch({ code: "token", metodo: "invalid", redirect })),
    ).toEqual({ code: "token", metodo: undefined, redirect: undefined });
  }

  for (const code of [123, null, ["token"]]) {
    expect(() => Effect.runSync(decodeAccountSearch({ code }))).toThrow();
  }
});
