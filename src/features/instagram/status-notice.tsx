import { useQuery } from "@tanstack/react-query";
import { request } from "../../lib/api";

export function InstagramStatusNotice() {
  const { data } = useQuery({
    queryKey: ["instagram-status"],
    queryFn: ({ signal }) => request((api) => api.operations.instagramStatus(), signal),
    throwOnError: false,
    refetchInterval: 300_000,
  });

  if (data?.status !== "reconnect_required") return null;

  return (
    <output className="block rounded-lg border border-border bg-secondary/40 p-4 text-sm">
      <p className="font-bold">Instagram necesita reconectarse.</p>
      <p className="mt-1">
        Las novedades de la página principal muestran las últimas publicaciones guardadas. Para
        actualizarlas, genera un nuevo token en Meta, guárdalo como INSTAGRAM_ACCESS_TOKEN en
        Infisical y vuelve a desplegar.
      </p>
    </output>
  );
}
