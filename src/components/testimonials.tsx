import testimonials from "../content/testimonials.json";

// Preserve the three editorial groups used by the legacy scrolling columns.
const columns = [testimonials.slice(0, 14), testimonials.slice(14, 26), testimonials.slice(26)];

export function Testimonials() {
  return (
    <section className="testimonials-section">
      <div className="page-width">
        <h2 className="section-title">Cambia Tu Vida Con DarSpa</h2>
        <p className="section-caption">Cientos de personas han conseguido cambios reales</p>
        <div className="testimonial-window">
          {columns.map((reviews, index) => (
            <div className="testimonial-column" key={index}>
              {[false, true].map((duplicate) => (
                <div
                  className="testimonial-cycle"
                  key={String(duplicate)}
                  aria-hidden={duplicate || undefined}
                >
                  {reviews.map((review) => (
                    <figure key={review.name}>
                      <span className="sr-only">5 de 5 estrellas</span>
                      <div className="review-stars" aria-hidden="true">
                        {[0, 1, 2, 3, 4].map((star) => (
                          <svg
                            key={star}
                            viewBox="0 0 20 20"
                            fill="currentColor"
                            aria-hidden="true"
                          >
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 0 0 .95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 0 0-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 0 0-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 0 0-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 0 0 .951-.69l1.07-3.292z" />
                          </svg>
                        ))}
                      </div>
                      <blockquote>
                        <p>{review.comment}</p>
                      </blockquote>
                      <figcaption>– {review.name}</figcaption>
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
