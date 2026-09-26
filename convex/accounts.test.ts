import { convexTest } from "convex-test";
import { expect, test } from "vite-plus/test";
import { api, internal } from "./_generated/api";
import { resolveCustomerIdentity } from "./lib/identity";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

test("verified identities converge without granting unverified claims historical ownership", async () => {
  const backend = convexTest(schema, modules);

  const legacyId = await backend.mutation(internal.migrationIdentity.register, {
    legacyId: "synthetic-legacy-1",
    verifiedEmail: "CUSTOMER@example.com",
  });

  const pending = await backend.run((ctx) =>
    resolveCustomerIdentity(ctx, {
      email: "customer@example.com",
      verified: false,
      existingUserId: null,
    }),
  );

  expect((await backend.run((ctx) => ctx.db.get(legacyId)))?.userId).toBeUndefined();

  const google = await backend.run((ctx) =>
    resolveCustomerIdentity(ctx, {
      email: "Customer@example.com",
      verified: true,
      existingUserId: null,
    }),
  );

  const email = await backend.run((ctx) =>
    resolveCustomerIdentity(ctx, {
      email: "customer@example.com",
      verified: true,
      existingUserId: pending,
    }),
  );

  expect(email).toBe(google);
  expect((await backend.run((ctx) => ctx.db.get(legacyId)))?.userId).toBe(google);
  expect((await backend.run((ctx) => ctx.db.get(google)))?.role).toBeUndefined();
  expect(
    await backend.mutation(internal.migrationIdentity.register, {
      legacyId: "synthetic-legacy-1",
      verifiedEmail: "customer@example.com",
    }),
  ).toBe(legacyId);

  await expect(
    backend.mutation(internal.migrationIdentity.register, {
      legacyId: "synthetic-duplicate",
      verifiedEmail: "customer@example.com",
    }),
  ).rejects.toThrow("Multiple legacy identities");
  await expect(
    backend.run((ctx) =>
      resolveCustomerIdentity(ctx, {
        email: "other@example.com",
        verified: true,
        existingUserId: google,
      }),
    ),
  ).rejects.toThrow("verificar esta identidad");
});

test("migration also associates customers who signed in before import; absent evidence remains unclaimed", async () => {
  const backend = convexTest(schema, modules);

  const userId = await backend.run((ctx) =>
    resolveCustomerIdentity(ctx, {
      email: "before@example.com",
      verified: true,
      existingUserId: null,
    }),
  );

  const linked = await backend.mutation(internal.migrationIdentity.register, {
    legacyId: "synthetic-before",
    verifiedEmail: "before@example.com",
  });

  const unclaimed = await backend.mutation(internal.migrationIdentity.register, {
    legacyId: "synthetic-unverified",
  });

  expect((await backend.run((ctx) => ctx.db.get(linked)))?.userId).toBe(userId);
  expect((await backend.run((ctx) => ctx.db.get(unclaimed)))?.userId).toBeUndefined();
});

test("ownership, live role revocation and session invalidation are enforced at backend boundaries", async () => {
  const backend = convexTest(schema, modules);

  const { ownerId, otherId, sessionId } = await backend.run(async (ctx) => {
    const owner = await resolveCustomerIdentity(ctx, {
      email: "owner@example.com",
      verified: true,
      existingUserId: null,
    });

    const other = await resolveCustomerIdentity(ctx, {
      email: "other@example.com",
      verified: true,
      existingUserId: null,
    });

    const session = await ctx.db.insert("authSessions", {
      userId: owner,
      expirationTime: Date.now() + 60_000,
    });

    return { ownerId: owner, otherId: other, sessionId: session };
  });

  const customer = backend.withIdentity({ subject: `${ownerId}|${sessionId}` });

  expect(await backend.query(api.accounts.viewer)).toBeNull();
  await expect(backend.query(api.accounts.get, { customerId: ownerId })).rejects.toThrow(
    "iniciar sesión",
  );
  await expect(backend.query(api.accounts.administration)).rejects.toThrow("iniciar sesión");
  expect(await customer.query(api.accounts.get, { customerId: ownerId })).toEqual({
    id: ownerId,
    email: "owner@example.com",
  });
  await expect(customer.query(api.accounts.get, { customerId: otherId })).rejects.toThrow(
    "permiso",
  );
  await expect(customer.query(api.accounts.administration)).rejects.toThrow("permiso");

  const change = {
    email: "owner@example.com",
    operator: "operator@example.com",
    reason: "Synthetic verification",
    deploymentUrl: "https://industrious-retriever-886.convex.cloud",
  };

  await expect(
    backend.mutation(internal.administrators.setRole, {
      ...change,
      deploymentUrl: "https://wrong.convex.cloud",
      role: "administrator",
    }),
  ).rejects.toThrow("deployment");
  await backend.mutation(internal.administrators.setRole, { ...change, role: "administrator" });
  expect(await customer.query(api.accounts.administration)).toEqual({ email: "owner@example.com" });
  expect(
    await backend.mutation(internal.administrators.setRole, { ...change, role: "administrator" }),
  ).toEqual({ changed: false });
  await backend.mutation(internal.administrators.setRole, { ...change, role: "customer" });
  await expect(customer.query(api.accounts.administration)).rejects.toThrow("permiso");

  const changes = await backend.run((ctx) => ctx.db.query("roleChanges").collect());

  expect(changes.map(({ from, to, operator }) => ({ from, to, operator }))).toEqual([
    { from: "customer", to: "administrator", operator: "operator@example.com" },
    { from: "administrator", to: "customer", operator: "operator@example.com" },
  ]);

  await backend.run((ctx) => ctx.db.delete(sessionId));
  expect(await customer.query(api.accounts.viewer)).toBeNull();
  await expect(customer.query(api.accounts.get, { customerId: ownerId })).rejects.toThrow(
    "iniciar sesión",
  );
});
