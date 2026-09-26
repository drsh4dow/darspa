import { useState } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "./ui/button";

export function SignOut() {
  const { signOut } = useAuthActions();
  const navigate = useNavigate();
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  async function logout() {
    setPending(true);
    setFailed(false);

    try {
      // Remove callback markers before auth changes so logout cannot look like a failed login.
      await navigate({ to: ".", search: {}, replace: true });
      await signOut();
    } catch {
      setFailed(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-3">
      <Button variant="outline" disabled={pending} onClick={() => void logout()}>
        {pending ? "Cerrando sesión…" : "Cerrar sesión"}
      </Button>
      {failed && <p role="alert">No pudimos cerrar tu sesión. Inténtalo nuevamente.</p>}
    </div>
  );
}
