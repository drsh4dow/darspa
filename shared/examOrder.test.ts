import { Effect, Schema } from "effect";
import { expect, test } from "vite-plus/test";
import { examOrder } from "./examOrder";

test("the download-only form accepts an absent email without treating an empty age as zero", () =>
  Effect.runPromise(
    Effect.gen(function* () {
      const input = {
        fullName: "María Prueba Muñoz",
        rut: "12.345.678-5",
        age: "35",
        address: "Calle de Prueba 123, Castro",
        diabetes: false,
        surgery: false,
        email: undefined,
      };

      const patient = yield* Schema.decodeEffect(examOrder)(input);
      expect(patient.email).toBeUndefined();
      expect(patient.age).toBe(35);
      yield* Effect.flip(Schema.decodeEffect(examOrder)({ ...input, age: "" }));
      yield* Effect.flip(Schema.decodeEffect(examOrder)({ ...input, email: "" }));
    }),
  ));
