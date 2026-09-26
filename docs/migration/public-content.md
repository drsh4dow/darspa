# Public content migration inventory

Sources: the sibling `darspa-next` checkout, the live public site, and the public `darspa` Prismic master ref. No credentials were needed to read Prismic. The snapshot contains 71 published documents. This import did not modify Prismic or the legacy site.

| Legacy source              |                   Count | Replacement                                                                                   |
| -------------------------- | ----------------------: | --------------------------------------------------------------------------------------------- |
| `producto`                 |                      26 | `content/offerings/*.md`, including original IDs, CLP prices and availability                 |
| `noticia`                  |                      13 | `content/news/*.md`, including publication dates and all text blocks                          |
| `resumen_profesional`      |                      12 | `src/content/team.json`; all profiles retained, matching the legacy unfiltered team query     |
| `giftcard_template`        |                       5 | `content/voucher-artwork.json` and local artwork                                              |
| `tecnicas`                 |                       8 | Archived with local assets; the legacy public service page actually uses its source-code list |
| `edami_plan`               |                       6 | Archived; not read by any migrated Dar Spa public page                                        |
| `catalogo`                 |                       1 | Archived with its locally stored PDF; not read by the legacy public shop                      |
| Source-controlled services |                      24 | `src/content/services.json` and `public/images/terapias/`                                     |
| Source-controlled exams    |                       8 | `src/content/exams.json` and local illustrations                                              |
| FAQs                       |                       9 | `src/content/faq.json`                                                                        |
| Testimonials               | All three legacy arrays | `src/content/testimonials.json`; additional reviews expand without automatic scrolling        |

`prismic-documents.json` is the migration archive, not runtime content or a second catalog. Asset fields in it reference local files. Original document API links remain as provenance only. `assets.json` records original remote asset URLs, local destinations and SHA-256 checksums. There are 63 retrieved remote assets and one unavailable decorative email asset.

## Artwork for later slices

| Purpose                             | Local file                                                    |
| ----------------------------------- | ------------------------------------------------------------- |
| Metabolic-study order               | `/templates/imagenEstudioMetabolico.png`                      |
| Standard laboratory order           | `/templates/imagenLaboratorioOne.png`                         |
| Alternative laboratory order        | `/templates/imagenLaboratorioTwo.png`                         |
| Voucher foreground                  | `/templates/giftcardForeground.png`                           |
| Five selectable voucher backgrounds | `content/voucher-artwork.json` maps legacy IDs to local files |
| Email group logo                    | `/images/content/879c8c0fd5772fb0.png`                        |
| GiftCard email illustration         | `/images/content/e13b627680b793d3.png`                        |
| GiftCard email step icon            | `/images/content/79d805ac960d5302.png`                        |
| Facebook email icon                 | `/images/content/bfd6e72db5d44943.png`                        |
| Instagram email icon                | `/images/content/ad1db75efe569ea7.png`                        |

The four template PNGs were decoded byte-for-byte from the legacy base64 constants. Their medical text, signatures and artwork were not redrawn. The later exam slice must preserve template selection and patient-field placement.

The decorative exam-email footer background at `yoqbem.stripocdn.email/.../2191625641866113.png` returns HTTP 403. It is not a Prismic asset. No replacement artwork was fabricated. The source email also defines a solid `#0A2B6E` footer background. Owner input is needed if that unavailable texture must be retained.

## Preservation decisions

- Current contact details use the owner's confirmed WhatsApp number, +56 9 7227 5330. Historical news retains its original phone numbers and dated announcements.
- The old English legal documents were translated into Spanish with their sections and meaning preserved. The privacy policy retains the original 14 December 2022 date rather than suggesting fresh legal approval. The owner should review the translation before launch; it is not a legal-policy redesign.
- All 26 published offerings were marked active in Prismic. Nothing was silently retired or repriced. Identity slugs are now stable repository IDs, with the old IDs retained for migration.
- News images are now used on article detail pages; the old list fetched no images despite declaring an image field. The main news archive still displays full article text in chronological order.
- The homepage retains the original banner, logos, two-column composition, first-visit guidance, service content, testimonials and FAQs. Fonts are vendored Nunito and Montserrat. Mobile navigation uses a focus-trapped Radix/shadcn dialog; the testimonial list no longer scrolls automatically.
- Old public routes `/`, `/nosotros`, `/servicios`, `/examenes`, `/noticias`, `/tienda`, `/privacy-policy` and `/terms-of-service` are preserved. `/contacto` and individual news/offering pages add direct links to that content.

No application code, generated public content or browser asset depends on Prismic at runtime. The source archive is deliberately outside the browser bundle.
