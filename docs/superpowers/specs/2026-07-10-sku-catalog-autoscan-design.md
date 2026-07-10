# SKU Catalog and Automatic Amazon Scan — Design

## Goal

Turn the verified Monster High SKU catalog into the source of truth for Vetka Desktop: on application start and every two hours while it remains open, scan Amazon US, UK, DE, and ES; record only verified new-condition offers and their price history.

## Scope

- Import or update catalog rows by exact `mattel_sku`; never create a duplicate doll for the same SKU.
- `active` catalog rows participate in scheduled scans. `monitor_only` rows remain visible but are skipped by the scheduler.
- The first scan is queued after the app's services are ready. The next scan begins 120 minutes after the previous scan completes; overlapping scans are prohibited.
- A manual “refresh catalog now” command uses the same run and lock.
- For each active SKU, scan Amazon US, UK, DE, and ES. The collector searches by `Monster High {SKU}`, opens an offered product page, and accepts it only when all of the following are true:
  1. the exact Mattel SKU is present in the product evidence;
  2. at least one catalog-required title term matches;
  3. condition is `New`;
  4. no catalog reject term matches.
- An accepted result creates or reuses an `amazon_listings` row and writes an immutable `price_check` and, where a current price is valid, a `price_snapshot`.
- A rejected search result is discarded. It creates neither a candidate listing nor any UI queue.

## Deliberate constraints

- This is a local desktop task runner, not a Windows background service. Closing the app stops the cadence.
- No CAPTCHA solving or circumvention is implemented. CAPTCHA, blocking, parser changes, and network errors create diagnostic checks without changing the last verified price.
- No eBay, Mattel price collection, cloud sync, notification delivery, or automatic purchasing belongs in this change.
- Discount thresholds stay out of catalog matching. “Favorable” is calculated from each doll’s own historical verified prices, not from a global guessed value.

## Data model

Add a `catalog_entries` table keyed by `mattel_sku` with: canonical name, character, line, product type, monitor status, required terms, reject terms, search query, source URL, source check date, and evidence text. It is linked one-to-one to an optional `dolls` row after import.

Import is idempotent:

1. validate every row before any writes;
2. upsert catalog entry by normalized SKU;
3. update or create the corresponding doll by exact SKU without replacing manual notes, favorite state, images, or order data;
4. report inserted, updated, skipped, and invalid counts.

The bundled seed is the verified V1 workbook converted to an application-owned JSON asset. Its 21 records are not a second manually maintained list.

## Components and boundaries

`main/catalog` owns catalog validation, import, and the active-record query.

`collector/amazon` owns Amazon URL/search/page parsing and produces raw, region-scoped evidence only. It knows no SQLite or UI state.

`main/prices` owns accepting a result, persisting checks/snapshots, and preserving the last good value on failure. It no longer persists review candidates during a catalog scan.

`main/catalog-scan` orchestrates one serial full-catalog run, emits progress, and owns the two-hour timer. It depends on catalog, price service, and collector through typed interfaces.

IPC exposes three narrow operations: get scan state, start a manual run, and subscribe to progress. The renderer never reads the database or controls a timer directly.

## User experience

The catalog screen is a compact desktop worklist with SKU, product name, source state, best verified price by region, last successful check, and scan state. A header communicates the next scheduled scan and a single “Refresh now” control. The existing doll detail price history remains the source for charts; it gains a concise region/status summary.

Only accepted offers appear. A blocked region is shown as a status beside that region, while its prior verified price stays visible and marked with its check time.

## Error handling

- A scan is serial. A manual request during a run returns the in-progress state rather than starting another run.
- One SKU/region failure does not abort other regions or products.
- Malformed catalog import fails before writes and identifies rows by SKU/row number.
- A failure records its check status when an existing listing is known. A search result that fails identity rules is silently dropped because it is not evidence about a canonical listing.
- App shutdown clears the timer and waits only for in-flight persistence; it does not leave a timer alive.

## Verification

Unit and integration tests prove:

- idempotent SKU import; exact-SKU update; no duplicate doll; invalid data leaves the database unchanged;
- active rows only are scheduled; one startup run and two-hour cadence; no overlapping runs; timers stop on disposal;
- every US/UK/DE/ES task uses the catalog SKU and rules;
- exact-SKU/New/title-term match persists a snapshot; wrong SKU, missing title term, used condition, or reject term persists nothing;
- one region failing does not prevent another verified region from being saved;
- last verified price survives CAPTCHA/parser/network failures;
- renderer presents progress and the existing price view displays saved data.

Live Amazon pages are verified manually at release time, not in deterministic CI.
