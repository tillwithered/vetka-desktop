# ASIN-first Amazon pricing

## Goal

Make a manual or scheduled catalog refresh update prices for existing dolls from their Amazon product cards, even when the doll is absent from the currently loaded Monster High Store page.

## Root cause

The current `CatalogScanService` only invokes the official Store import. The Store is a lazy, incomplete discovery surface: the live UK page loaded only a subset of cards and did not contain Robecca Steam. The direct UK product card `B0FK1V67X5` was reachable through the configured proxy and exposed the exact Mattel SKU `JHK59` and a price of GBP 19.99. The price refresh path already knows how to open a confirmed ASIN across regions, but the global refresh never calls it.

## Chosen model

Use two separate collection paths.

1. **Official Store discovery** imports new dolls and may seed a confirmed ASIN when a product is visible in a Monster High Store page.
2. **ASIN-first price refresh** checks every active catalog doll that already has one or more confirmed ASINs. For each configured Amazon region it opens `https://{region}/dp/{asin}` directly. It does not use Amazon search.

The direct regional product card is accepted only when all required identity checks pass:

- The opened page ASIN equals the expected ASIN.
- Its product evidence contains the exact Mattel SKU.
- The title has Monster High/doll context and matches the catalog’s required title terms.
- UPC/EAN, if present, is an additional strong fact but is not required when SKU and title/context pass.

A failed check never creates a price. It records the matching diagnostic and preserves the last verified price.

## Global refresh flow

`Обновить сейчас` runs sequentially through the configured proxy regions:

1. Import the official Monster High Store for new catalogue items.
2. Read all active catalog entries.
3. For each entry with at least one confirmed ASIN, call the existing direct-card refresh across those regions.
4. Persist only verified offers, including seller, availability, thumbnail and the match facts.
5. Report partial errors by region/doll without discarding previously verified prices. Schedule the next run two hours later.

The card-level `Обновить цены` uses the same ASIN-first route, so individual and bulk refreshes cannot disagree on identity rules.

## Scope and exclusions

- The app will not search Amazon results during ASIN-first refreshes.
- A direct page cannot create a new arbitrary doll; it can only update a catalog doll with a confirmed ASIN.
- Store discovery remains scoped to configured regions and preserves proxy-only behavior.
- No proxy credentials are exposed to the renderer or logs.

## Verification

- Collector test: a US/ES-confirmed ASIN is opened directly in UK and produces a UK result only after ASIN, SKU and title/context verification.
- Negative tests: mismatched ASIN, SKU mismatch, and one weak title fact do not persist a price.
- Scan-service test: global refresh performs Store discovery and then active-catalog ASIN refresh.
- Price-service/repository test: the UK result for `B0FK1V67X5`/`JHK59` becomes a confirmed UK listing and keeps previous offers on failure.
- Full test, lint, typecheck, package, and a live manual check of Robecca UK after updating.
