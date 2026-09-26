# Public website verification

Development site: https://industrious-retriever-886.convex.site

The fidelity pass is now published to development. Initial uploads failed on isolated HTTP 502/520 responses; the uploader now has bounded per-file retries through the dependency patch documented in `docs/content.md`. The patched deployment published all 197 files and cleaned up the previous manifest's storage. This successful upload did not encounter another 5xx response; recovery is covered by the local HTTP tests, not evidence that the upstream gateway cause has disappeared. The public backend catalog query returned all 26 offerings.

Visual acceptance is pending owner review. The initial port passed technical checks but did not match the legacy design; those checks did not establish visual parity. Issue #4 remains incomplete, chiefly because Instagram is not implemented.

## Visual fidelity pass

Reference: an isolated copy of `darspa-next` on port 5180 with fake provider credentials and an unreachable local database. Replacement preview: port 5174. The legacy checkout, production deployment and DNS were not changed.

Compared rendered screenshots at 1440px and 390px, with additional 320px overflow and 768px layout checks. Waited for page content, fonts and visible images. Compared home, team, services, exams, news, catalog and offering quick-view states. Reviewed the shared footer, mobile navigation, contact and translated legal pages separately.

Restored:

- The fixed 56px header, navigation placement, icon actions, left mobile drawer and scrolling promotion banner.
- Legacy typography, page widths, section spacing, hero composition/backgrounds, service-card borders and circular photos.
- Circular team portraits and the observed team order. Removed biography disclosures; the imported biographies remain in source.
- Scrolling testimonial columns, original FAQ column grouping and original public copy. Removed invented introductions, category navigation, catalog notices and the extra homepage gift section.
- Catalog spacing, breakpoints, equal-price ordering and offering dialogs. Direct offering/article URLs from the initial migration remain available.
- The supplied vector logo in the header, hero and footer. `public/images/darspa-logo.svg` was optimized with SVGO 4.0.1 from the untouched root original (39.1 KiB to 27.3 KiB). The badge and tagline retain the legacy composition.

Intentional differences:

- Darker action fills and secondary text where the legacy colors fail contrast checks. Visible focus, semantic buttons and a drawer close button.
- The promotion banner slides in and out over 500 ms, matching the legacy transition; reduced motion makes this transition immediate. Hidden banner actions are inert.
- At the owner's request, testimonials scroll continuously: no hover pause, pause control or reduced-motion stop. This deliberately gives up a pause mechanism for moving content and does not meet WCAG 2.2.2.
- Long service names wrap at 320px instead of causing horizontal overflow. News hover decoration stays inside the viewport.
- The WhatsApp contact is **+56 9 7227 5330**.
- Instagram has a link fallback rather than the legacy perpetual spinners. Its placement and surrounding layout are preserved; the feed is not complete.
- Checkout and exam-order generation belong to later tickets. The offering action opens WhatsApp; the cart and exam-order controls explain their unavailable state when opened, not in large page banners.
- Legal text is the Spanish translation of the legacy English documents. Contact and direct article/offering pages have no equivalent standalone legacy layout.

## Verification

- `vp run verify` passed formatting, lint, TypeScript, 23 tests and a build that prerenders 48 public routes plus the private-page shell.
- Upload transport tests use a local HTTP server to verify recovery from `502 → 520 → 200`, exhaustion after three attempts, immediate authorization rejection, and preservation of the binary payload and content type.
- Hosted checks matched SHA-256 hashes for the main JavaScript bundle, the previously failing PDF, and the SVG logo. Representative service, offering and news deep links returned HTTP 200 with development noindex headers; an unknown path returned 404. The hydrated catalog opened its offering dialog with the correct WhatsApp destination and no recorded browser errors.
- The catalog regression test calls the public Convex queries anonymously with the real generated catalog, including display-order metadata, to catch return-validator drift.
- Browser interaction checks cover offering-dialog keyboard focus trapping, Escape and focus restoration, mobile navigation and the skip link. Motion checks cover banner entry/exit, hidden-action focus exclusion, and uninterrupted marquee movement on hover and under reduced motion.
- Focused axe checks cover home, menu, team, catalog/dialog, contact and legal pages. Manually review the reported image/gradient contrast and Radix focus-guard checks; automated results are not WCAG certification.

## Earlier migration checks retained

The initial migration compared all 26 offering identities, prices, availability flags and descriptions with the public Prismic snapshot, all 63 downloaded asset checksums, and all four decoded template PNGs. Hosted checks covered the 48 public HTML routes, canonical/social metadata, local image references, sitemap/robots, private-page noindex shells and deliberate 404s. These establish content/routing behavior, not visual acceptance.

## Remaining work

- Owner visual review of this pass.
- Fresh Instagram authorization, supported post types, cache/failure behavior, token renewal and protected administrator reconnection status.
- Owner review of the translated legal documents.
- The unavailable decorative Stripo email background (HTTP 403); see the migration inventory.
- Production/custom-domain verification and DNS cutover remain separate. The development host is deliberately noindex.
- The main-bundle size warning remains; no warning threshold was increased.
