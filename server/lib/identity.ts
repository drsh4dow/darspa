import { Effect } from "effect";
import { Forbidden, type Viewer } from "../../shared/contracts";

export const requireAdministrator = Effect.fnUntraced(function* (user: Viewer) {
  if (user.role !== "administrator") {
    return yield* new Forbidden({ message: "No tienes permiso para administrar Dar Spa." });
  }

  return user;
});
