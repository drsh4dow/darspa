import { useState } from "react";
import { Effect } from "effect";
import { useAuthActions } from "@convex-dev/auth/react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "./ui/button";

export function SignOut() {
  const { signOut } = useAuthActions();
  const navigate = useNavigate();
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  function logout() {
    setPending(true);
    setFailed(false);

    Effect.runFork(
      Effect.gen(function* () {
        // Remove callback markers before auth changes so logout cannot look like a failed login.
        yield* Effect.tryPromise(() => navigate({ to: ".", search: {}, replace: true }));
        yield* Effect.tryPromise(() => signOut());
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
