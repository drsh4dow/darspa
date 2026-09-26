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

`content/generated/catalog.json` is derived output, not an editor. Both the site and `convex/catalog.ts` consume it. There is no separately editable catalog table or public catalog mutation.

- `api.catalog.list` returns offerings currently available for sale.
- `api.catalog.get({ id })` also resolves withdrawn offerings; an unknown identity returns `null`.
- Future checkout must call `requirePublishedOffering(id)` in its backend mutation and snapshot the returned name, description, price and identity. It must reject client prices and recheck availability, regardless of cached browser content.
- The `legacyId` mapping supports the later purchase/voucher migration. Historical purchases must store their original terms, not consult today's catalog to reconstruct them.

Backend and static assets deploy sequentially, not atomically. If the upload fails, the backend may already have the new catalog. Retry the same `vp run deploy:dev` command. The static-hosting component stages files before publishing its manifest. The backend remains authoritative during this interval; a future checkout must handle unavailable or changed offerings explicitly.

The `@convex-dev/static-hosting` 0.2.1 uploader has a Bun patch in `patches/`: each file gets up to three attempts on HTTP 5xx responses, with 500 ms and 1 s delays. The unpatched CLI abandoned entire uploads after isolated 502/520 gateway errors. Other failures still fail immediately; retry exhaustion uses the component's existing cleanup and leaves the previous manifest published. Only the upload transport is patched, not publication or serving. Upload URLs and payload bytes are reused, and authorization URLs are never logged. A lost success response can leave an unreferenced storage file; the component's existing age-gated maintenance handles those on later uploads. `scripts/storage-upload.test.ts` exercises recovery, exhaustion and authorization rejection against a local HTTP server. Remove the patch and its transport test when an upstream release provides equivalent retry handling.

## Hosting and discovery

TanStack Start prerenders all public paths listed in `content/generated/paths.json`. Public HTML is served directly without a JavaScript requirement. News and offering detail pages have individual URLs, titles, canonical URLs and social metadata. Assets and fonts are local.

The installed `@convex-dev/static-hosting` 0.2.1 component only resolves exact asset paths. `convex/http.ts` maps the finite set of public URLs to `/pages/*.html`; it does not implement a general file server. The component still owns asset serving and upload. Trailing slashes on public pages redirect to the canonical path with HTTP 308. Unknown paths return HTTP 404 rather than the homepage.

`/mi-cuenta` and `/admin` receive the generic client-only shell and remain `noindex`. Public canonical URLs point to `https://darspa.cl`. On development hosts, HTTP `X-Robots-Tag` headers and `/robots.txt` prevent indexing. `/sitemap.xml` lists public URLs only. Custom-domain configuration, DNS and final-domain verification are not part of this development publication.

## Remaining work in issue #4

Instagram authorization and implementation are deferred until after the public pages, at the owner's request. The homepage currently has an honest Instagram-link fallback, not an automatic feed or a completed provider integration. Scheduled refresh, cache retention, token renewal with Infisical coordination, and the protected administrator status contract still need implementation and verification.

Checkout and anonymous exam-order generation belong to separate tickets. This site explains that they are not enabled yet and offers contact/booking links instead of nonfunctional purchase or generation buttons.
