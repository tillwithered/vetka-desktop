# Retail Mattel and Amazon catalog completion

## Goal

Complete Vetka's operational Monster High retail catalog from current official Mattel products and attach verified Amazon listings for US, UK, DE, ES, and IT so the existing price collector can keep regional prices current.

## Scope and source of truth

The official Mattel retail catalog at `https://shop.mattel.com/collections/dolls#filter.ss_brand=Monster%20High` is the catalog source of truth. Include current full-size Monster High dolls and doll multipacks. Exclude apparel, books, minis, vehicles, styling heads, furniture, accessories without a doll, and regional-language duplicates of the same SKU.

Each retained product must have a product-specific official Mattel page. A collection landing page is discovery evidence, not a substitute for the product page. A product remains in the local catalog when Mattel temporarily marks it unavailable; its catalog activity and Amazon availability are tracked separately.

Mattel Creations products are excluded from this retail catalog and handled by the separate collector catalog.

## Product identity

Each retail doll stores:

- a concise Russian operational name;
- the exact official English Mattel title;
- character and line;
- Mattel SKU/article number;
- UPC or EAN when officially published;
- a product-specific Mattel URL;
- at least one official Mattel image URL;
- source check time and evidence.

The Mattel SKU is the primary identity key. Product URL and UPC/EAN are additional identity evidence. Import is idempotent and updates an existing SKU instead of creating a duplicate. A manually supplied image always wins; an official Mattel image may replace a missing or Amazon-derived image.

## Amazon listing map

Amazon discovery is separate from price collection. For every retail SKU, curate zero or one confirmed listing per marketplace: Amazon US, UK, DE, ES, and IT. A region may remain empty when no trustworthy matching product exists.

A listing is accepted only after its direct product page confirms:

- the expected ASIN from the final product URL or page metadata;
- the exact Mattel SKU;
- Monster High and compatible title/character context;
- `New` condition when an offer is present.

Titles translated by Amazon may differ, so exact title equality is not required. Exact SKU plus compatible product context is required. Bundles, used products, replacement parts, outfits, and accessories are rejected. The same physical product may use different ASINs across regions.

Confirmed mappings are saved as trusted listings and are not replaced by search results during price refresh. Missing regions do not block importing the doll.

## Price collection

The existing ASIN-first price path remains the only automatic Amazon pricing path. It opens confirmed direct product cards for US, UK, DE, ES, and IT, verifies identity again, and persists only verified `New` offers. Store pages and Amazon search are not part of scheduled price refresh.

Each request starts direct. Only a classified Amazon block, CAPTCHA, or retryable HTTP response may trigger one retry through the configured marketplace proxy. An unavailable product, identity mismatch, parser error, or normal page without a price preserves the last verified price and does not consume a proxy retry.

The full mapped retail catalog refreshes once per 24-hour cycle while Vetka is running. Manual refresh may run outside that cadence. A doll-region pair is requested at most once per scheduled cycle.

## Data and error handling

Catalog import is transactional. Invalid identity data fails before writes and reports the affected SKU. Amazon verification failures are isolated by doll and region, so one failure cannot abort the remaining catalog.

The last verified price remains visible after a failed check and carries its real check time. A failed check records a diagnostic without manufacturing a zero price or changing the confirmed listing to a different product.

## Interface

The existing `Куклы` page remains the retail Amazon workspace. It shows the Russian name, Mattel image, line, SKU/article number, and available regional price summary. The detail view retains the official English name, Mattel source link, regional listings, and price history.

Applicable loading, empty, populated, error, long-content, stale-price, and partial-region states remain supported. No new retail navigation item or UI library is introduced.

## Verification

- Compare the curated SKU set with the live Mattel Monster High retail collection and open every retained official product URL.
- Prove idempotent SKU import, Russian and English identity persistence, product-specific Mattel sources, and manual-image preservation.
- Prove that every seeded ASIN mapping has the expected region, final ASIN, exact Mattel SKU, and compatible product context.
- Prove that missing regions remain empty and that rejected or mismatched candidates never create listings or prices.
- Run the full automated test suite, lint, typecheck, package, and release-version checks.
- Live-check at least one available mapped doll per Amazon marketplace when a matching offer exists.
- Visually check the retail table and detail view in Electron at 1080x720, 1280x800, and 1440x900 with the sidebar expanded and collapsed.
