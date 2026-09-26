import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import catalog from "../../content/generated/catalog.json";
import { OfferingContent } from "../components/offering-content";
import { publicMetadata } from "../lib/metadata";

export const Route = createFileRoute("/tienda/$offeringId")({
  loader: ({ params }) => {
    const offering = catalog.find((item) => item.id === params.offeringId);

    if (!offering) throw notFound();

    return offering;
  },
  head: ({ loaderData }) =>
    loaderData
      ? publicMetadata(
          loaderData.name,
          `${loaderData.name} en Dar Spa. Conoce el servicio, su precio y las condiciones de la GiftCard.`,
          `/tienda/${loaderData.id}`,
          loaderData.image,
        )
      : {},
  component: OfferingPage,
});

function OfferingPage() {
  const offering = Route.useLoaderData();

  return (
    <div className="page-width section-space">
      <Link to="/tienda" className="text-link mb-8 inline-block">
        ← Volver a la tienda
      </Link>
      <div className="offering-detail">
        <OfferingContent offering={offering} title={<h1>{offering.name}</h1>} />
      </div>
    </div>
  );
}
