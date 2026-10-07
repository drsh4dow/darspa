import { auth } from "./auth";

// Private query keys include the account, including when another tab changes the session.
export function useAccountId() {
  return auth.useSession().data?.user.id;
}

// undefined means the session is still resolving; null means signed out.
export function useCustomer() {
  const session = auth.useSession();

  if (session.isPending) return undefined;

  if (session.error !== null) throw session.error;

  if (session.data === null) return null;
  const { id, email, role } = session.data.user;

  return { id, email, role };
}
