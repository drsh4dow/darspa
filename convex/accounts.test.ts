import { convexTest } from "convex-test";
import { Clock, Effect } from "effect";
import { expect, test } from "vite-plus/test";
import { api, internal } from "./_generated/api";
import { resolveCustomerIdentity } from "./lib/identity";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

test("verified identities converge without granting unverified claims historical ownership", () =>
  Effect.runPromise(
    Effect.gen(function* () {
      const run = Effect.runPromiseWith(yield* Effect.context());
      const backend = convexTest(schema, modules);

      const legacyId = yield* Effect.promise(() =>
        backend.mutation(internal.migrationIdentity.register, {
          legacyId: "synthetic-legacy-1",
          verifiedEmail: "CUSTOMER@example.com",
        }),
      );

      const pending = yield* Effect.promise(() =>
        backend.run((ctx) =>
          run(
            resolveCustomerIdentity(ctx, {
              email: "customer@example.com",
              verified: false,
              existingUserId: null,
            }),
          ),
        ),
      );

      const unclaimed = yield* Effect.promise(() => backend.run((ctx) => ctx.db.get(legacyId)));

      expect(unclaimed?.userId).toBeUndefined();

      const google = yield* Effect.promise(() =>
        backend.run((ctx) =>
          run(
            resolveCustomerIdentity(ctx, {
              email: "Customer@example.com",
              verified: true,
              existingUserId: null,
            }),
          ),
        ),
      );

      const email = yield* Effect.promise(() =>
        backend.run((ctx) =>
          run(
            resolveCustomerIdentity(ctx, {
              email: "customer@example.com",
              verified: true,
              existingUserId: pending,
            }),
          ),
        ),
      );

      const linked = yield* Effect.promise(() => backend.run((ctx) => ctx.db.get(legacyId)));
      const customer = yield* Effect.promise(() => backend.run((ctx) => ctx.db.get(google)));

      const repeated = yield* Effect.promise(() =>
        backend.mutation(internal.migrationIdentity.register, {
          legacyId: "synthetic-legacy-1",
          verifiedEmail: "customer@example.com",
        }),
      );

      expect(email).toBe(google);
      expect(linked?.userId).toBe(google);
      expect(customer?.role).toBeUndefined();
      expect(repeated).toBe(legacyId);

      yield* Effect.promise(() =>
        expect(
          backend.mutation(internal.migrationIdentity.register, {
            legacyId: "synthetic-duplicate",
            verifiedEmail: "customer@example.com",
          }),
        ).rejects.toThrow("Multiple legacy identities"),
      );
      yield* Effect.promise(() =>
        expect(
          backend.run((ctx) =>
            run(
              resolveCustomerIdentity(ctx, {
                email: "other@example.com",
                verified: true,
                existingUserId: google,
              }),
            ),
          ),
        ).rejects.toThrow("verificar esta identidad"),
      );
    }),
  ));

test("migration also associates customers who signed in before import; absent evidence remains unclaimed", () =>
  Effect.runPromise(
    Effect.gen(function* () {
      const run = Effect.runPromiseWith(yield* Effect.context());
      const backend = convexTest(schema, modules);

      const userId = yield* Effect.promise(() =>
        backend.run((ctx) =>
          run(
            resolveCustomerIdentity(ctx, {
              email: "before@example.com",
              verified: true,
              existingUserId: null,
            }),
          ),
        ),
      );

      const linked = yield* Effect.promise(() =>
        backend.mutation(internal.migrationIdentity.register, {
          legacyId: "synthetic-before",
          verifiedEmail: "before@example.com",
        }),
      );

      const unclaimed = yield* Effect.promise(() =>
        backend.mutation(internal.migrationIdentity.register, {
          legacyId: "synthetic-unverified",
        }),
      );

      const linkedIdentity = yield* Effect.promise(() => backend.run((ctx) => ctx.db.get(linked)));

      const unclaimedIdentity = yield* Effect.promise(() =>
        backend.run((ctx) => ctx.db.get(unclaimed)),
      );

      expect(linkedIdentity?.userId).toBe(userId);
      expect(unclaimedIdentity?.userId).toBeUndefined();
    }),
  ));

test("ownership, live role revocation and session invalidation are enforced at backend boundaries", () =>
  Effect.runPromise(
    Effect.gen(function* () {
      const run = Effect.runPromiseWith(yield* Effect.context());
      const backend = convexTest(schema, modules);

      const { ownerId, otherId, sessionId } = yield* Effect.promise(() =>
        backend.run((ctx) =>
          run(
            Effect.gen(function* () {
              const owner = yield* resolveCustomerIdentity(ctx, {
                email: "owner@example.com",
                verified: true,
                existingUserId: null,
              });

              const other = yield* resolveCustomerIdentity(ctx, {
                email: "other@example.com",
                verified: true,
                existingUserId: null,
              });

              const now = yield* Clock.currentTimeMillis;

              const session = yield* Effect.promise(() =>
                ctx.db.insert("authSessions", { userId: owner, expirationTime: now + 60_000 }),
              );

              return { ownerId: owner, otherId: other, sessionId: session };
            }),
          ),
        ),
      );

      const customer = backend.withIdentity({ subject: `${ownerId}|${sessionId}` });
      const anonymous = yield* Effect.promise(() => backend.query(api.accounts.viewer));

      expect(anonymous).toBeNull();
      yield* Effect.promise(() =>
        expect(backend.query(api.accounts.get, { customerId: ownerId })).rejects.toThrow(
          "iniciar sesión",
        ),
      );
      yield* Effect.promise(() =>
        expect(backend.query(api.accounts.administration)).rejects.toThrow("iniciar sesión"),
      );

      const ownAccount = yield* Effect.promise(() =>
        customer.query(api.accounts.get, { customerId: ownerId }),
      );

      expect(ownAccount).toEqual({ id: ownerId, email: "owner@example.com" });

      yield* Effect.promise(() =>
        expect(customer.query(api.accounts.get, { customerId: otherId })).rejects.toThrow(
          "permiso",
        ),
      );
      yield* Effect.promise(() =>
        expect(customer.query(api.accounts.administration)).rejects.toThrow("permiso"),
      );

      const change = {
        email: "owner@example.com",
        operator: "operator@example.com",
        reason: "Synthetic verification",
        deploymentUrl: "https://industrious-retriever-886.convex.cloud",
      };

      yield* Effect.promise(() =>
        expect(
          backend.mutation(internal.administrators.setRole, {
            ...change,
            deploymentUrl: "https://wrong.convex.cloud",
            role: "administrator",
          }),
        ).rejects.toThrow("deployment"),
      );
      yield* Effect.promise(() =>
        backend.mutation(internal.administrators.setRole, { ...change, role: "administrator" }),
      );

      const administration = yield* Effect.promise(() =>
        customer.query(api.accounts.administration),
      );

      const repeated = yield* Effect.promise(() =>
        backend.mutation(internal.administrators.setRole, { ...change, role: "administrator" }),
      );

      expect(administration).toEqual({ email: "owner@example.com" });
      expect(repeated).toEqual({ changed: false });

      yield* Effect.promise(() =>
        backend.mutation(internal.administrators.setRole, { ...change, role: "customer" }),
      );
      yield* Effect.promise(() =>
        expect(customer.query(api.accounts.administration)).rejects.toThrow("permiso"),
      );

      const changes = yield* Effect.promise(() =>
        backend.run((ctx) => ctx.db.query("roleChanges").collect()),
      );

      expect(changes.map(({ from, to, operator }) => ({ from, to, operator }))).toEqual([
        { from: "customer", to: "administrator", operator: "operator@example.com" },
        { from: "administrator", to: "customer", operator: "operator@example.com" },
      ]);

      yield* Effect.promise(() => backend.run((ctx) => ctx.db.delete(sessionId)));
      const signedOut = yield* Effect.promise(() => customer.query(api.accounts.viewer));
      expect(signedOut).toBeNull();
      yield* Effect.promise(() =>
        expect(customer.query(api.accounts.get, { customerId: ownerId })).rejects.toThrow(
          "iniciar sesión",
        ),
      );
    }),
  ));
