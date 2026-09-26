import { useConvexAuth, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

// undefined means the session is still resolving; null means signed out.
export function useCustomer() {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const customer = useQuery(api.accounts.viewer, isAuthenticated ? {} : "skip");

  if (isLoading) return undefined;

  return isAuthenticated ? customer : null;
}
