import { useState } from "react";
import { Effect } from "effect";
import { auth } from "../lib/auth";
import { Button } from "./ui/button";

export function SignOut() {
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  function logout() {
    setPending(true);
    setFailed(false);

    Effect.runFork(
      Effect.gen(function* () {
        yield* Effect.tryPromise(() => auth.signOut({}, { throw: true }));
        // A new document clears private query data and callback markers together.
        window.location.replace("/mi-cuenta");
      }).pipe(
        Effect.catch(() => Effect.sync(() => setFailed(true))),
        Effect.ensuring(Effect.sync(() => setPending(false))),
      ),
    );
  }

  return (
    <div className="space-y-3">
      <Button variant="outline" disabled={pending} onClick={logout}>
        {pending ? "Cerrando sesión…" : "Cerrar sesión"}
      </Button>
      {failed && <p role="alert">No pudimos cerrar tu sesión. Inténtalo nuevamente.</p>}
    </div>
  );
}
