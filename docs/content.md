# Publishing public content

Edit sources, run `vp run content`, review the changes, then run `vp run verify`. Commit the sources and `content/generated/` together. `vp run deploy:dev` regenerates content, deploys the backend, builds the public HTML, and uploads it to the isolated development site. Production cutover is separate.

## Sources

| Content                                             | Edit here                              |
| --------------------------------------------------- | -------------------------------------- |
| News                                                | `content/news/*.md`                    |
| Offering descriptions, prices and sale availability | `content/offerings/*.md`               |
| Legal documents                                     | `content/legal/*.md`                   |
| Team, services, exams, FAQs and testimonials        | `src/content/*.json`                   |
| Contact details, Doctoralia link and ordinary copy  | `src/content/site.ts`, page components |
| Logos, photos and service illustrations             | `public/images/`                       |
| Voucher backgrounds and legacy identities           | `content/voucher-artwork.json`         |
| Approved exam and voucher overlay artwork           | `public/templates/`                    |

Markdown uses YAML frontmatter. It cannot execute code or embed raw HTML. Offering metadata is validated by `content/schema.ts`; prices must be positive, safe whole CLP numbers and `available` must be a boolean. Offerings are ordered by ascending price; optional `displayOrder` (a nonnegative integer, default `0`) orders equal-priced offerings before the ID tiebreaker. This preserves the legacy catalog's visual order without relying on Prismic response order. Team members use their source `order` field.

Metadata images must be local and exist at publication time. News dates use ISO 8601 with a timezone.

```markdown
---
id: masaje-relajacion
name: Masaje de relajación
priceClp: 25000
available: true
image: /images/terapias/relajacion.png
imageAlt: Masaje de relajación
---

Descripción del servicio.
```

The filename must match `id` (or `slug` for news). New offerings do not need a `legacyId`. Never reuse or rename an issued offering's identity. To withdraw an offering, set `available: false` instead of deleting its file. Its detail page and identity remain available; it disappears from the sale listing.

Run `vp run content` after editing Markdown during a local frontend session. The development server watches generated files, not Markdown. Normal source edits in `src/` use hot reload.

## Catalog authority

`content/generated/catalog.json` is derived output, not an editor. Both the site and `server/catalog.ts` consume it. There is no separately editable catalog table or public catalog mutation.

- `GET /api/catalog` returns offerings currently available for sale.
- Withdrawn offerings retain their prerendered detail page, but checkout rejects them.
- Checkout calls `requirePublishedOffering(id)` and snapshots the returned name, description, price and identity. It rejects a changed client price and rechecks availability, regardless of cached browser content.
- Historical purchases and vouchers retain their original terms rather than consulting today's catalog.

Alchemy uploads assets before publishing the Worker with its asset manifest. Retry an interrupted deployment with the same command and preserved `.alchemy/` state. D1 migrations run separately and are not rolled back with the Worker; review schema compatibility before deployment.

## Hosting and discovery

TanStack Start prerenders all public paths listed in `content/generated/paths.json`. Public HTML is served directly without a JavaScript requirement. News and offering detail pages have individual URLs, titles, canonical URLs and social metadata. Assets and fonts are local.

`infra/application.ts` configures Cloudflare's native asset rewrites for public pages and the four private client routes. Add new private routes to that list. Trailing slashes redirect to the canonical path with HTTP 308. Unknown paths return HTTP 404 rather than the account shell. The Worker handles the API, transferable voucher PDFs, `/robots.txt` and `/sitemap.xml`.

Private routes receive the client-only shell and remain `noindex`. Public canonical URLs point to `https://darspa.cl`. On development hosts, HTTP `X-Robots-Tag` headers and `/robots.txt` prevent indexing. `/sitemap.xml` lists public URLs only. Production uses the same routing at `https://darspa.cl`; deployment stages have separate databases and document buckets.

## Instagram follow-up

Instagram authorization and implementation are tracked in [issue #9](https://github.com/drsh4dow/darspa/issues/9), pending the clinic owner's Meta access and fresh authorization. The homepage currently has an honest Instagram-link fallback, not an automatic feed or a completed provider integration. Scheduled refresh, cache retention, token renewal with Infisical coordination, and the protected administrator status contract still need implementation and verification.

Checkout and anonymous exam-order generation use the same-origin Worker API. Exam-order email failure leaves the generated PDF available to download.
