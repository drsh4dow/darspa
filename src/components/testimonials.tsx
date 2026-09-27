import testimonials from "../content/testimonials.json";
import { cn } from "../lib/utils";

// Preserve the three editorial groups used by the legacy scrolling columns.
const columns = [
  { id: "primary", reviews: testimonials.slice(0, 14), className: "" },
  { id: "secondary", reviews: testimonials.slice(14, 26), className: "hidden md:block" },
  {
    id: "tertiary",
    reviews: testimonials.slice(26),
    className: "hidden lg:block [animation-duration:50s]",
  },
];

export function Testimonials() {
  return (
    <section className="bg-secondary py-10">
      <div className="mx-auto w-full max-w-384 px-2 sm:px-4">
        <h2 className="mb-2 text-center text-3xl font-black text-heading lg:text-5xl">
          Cambia Tu Vida Con DarSpa
        </h2>
        <p className="text-center text-sm font-bold text-muted-foreground">
          Cientos de personas han conseguido cambios reales
        </p>
        <div className="relative grid h-196 max-h-[60vh] grid-cols-1 items-start gap-8 overflow-hidden px-4 sm:mt-20 md:grid-cols-2 lg:grid-cols-3">
          <div
            className="pointer-events-none absolute inset-x-0 top-0 z-1 h-32 bg-linear-to-b from-secondary to-transparent"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 z-1 h-32 bg-linear-to-b from-transparent to-secondary"
            aria-hidden="true"
          />
          {columns.map((column) => (
            // Continuous scrolling, including reduced motion, is an explicit owner decision.
            <div className={cn("animate-reviews-scroll", column.className)} key={column.id}>
              {[false, true].map((duplicate) => (
                <div
                  className="grid gap-8 py-4"
                  key={String(duplicate)}
                  aria-hidden={duplicate || undefined}
                >
                  {column.reviews.map((review) => (
                    <figure
                      className="rounded-3xl bg-card p-6 text-card-foreground shadow-md shadow-foreground/5"
                      key={review.name}
                    >
                      <span className="sr-only">5 de 5 estrellas</span>
                      <div className="flex text-primary" aria-hidden="true">
                        {[0, 1, 2, 3, 4].map((star) => (
                          <svg
                            key={star}
                            className="size-5"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                            aria-hidden="true"
                          >
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 0 0 .95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 0 0-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 0 0-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 0 0-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 0 0 .951-.69l1.07-3.292z" />
                          </svg>
                        ))}
                      </div>
                      <blockquote>
                        <p className="mt-3 text-base leading-7">{review.comment}</p>
                      </blockquote>
                      <figcaption className="mt-3 text-sm text-muted-foreground">
                        – {review.name}
                      </figcaption>
                    </figure>
                  ))}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
