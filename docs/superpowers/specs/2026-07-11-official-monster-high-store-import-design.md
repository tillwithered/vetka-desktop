# Official Monster High Store import design

## Goal

Build the local doll catalogue directly from the official Monster High Stores on Amazon US, UK, DE, ES and IT, automatically adding high-confidence doll cards and their current product-page price.

## Regional store sources

- US: `https://www.amazon.com/stores/MonsterHigh/page/8153CA24-16BD-4D5B-B6FD-FAB40CBF9D55`
- UK: `https://www.amazon.co.uk/stores/MonsterHigh/page/F08243CA-36AF-405B-B3CF-BF5EA9644BBE`
- DE: `https://www.amazon.de/stores/MonsterHigh/page/5E7E208A-1FAE-46F1-9E9B-1EC19E18108F`
- ES: `https://www.amazon.es/stores/MonsterHigh/page/497AFA99-E38B-4DBC-9BEC-0751E198AA35`
- IT: `https://www.amazon.it/stores/MonsterHigh/page/38828C3D-2177-488D-9D09-F758976215AF`

These URLs were resolved from Monster High brand links on Amazon product pages, not guessed from a naming pattern.

## Import flow

1. On manual catalogue refresh, load each regional Store once, collect unique `/dp/{ASIN}` product links, and keep the source region.
2. Open each product link once and parse the existing Amazon product-page fields: ASIN, title, image, New price, seller and fulfilment.
3. Admit a product only when all checks pass:
   - product page is a Monster High/Mattel doll context;
   - product is a doll rather than an accessory, clothes, replacement part, furniture or vehicle;
   - title contains a Mattel SKU matching `[A-Z]{2,4}[0-9]{2,4}`;
   - New condition and a price are present.
4. Use the SKU as the catalogue identity. If the SKU already exists, refresh its name, image and regional listing; otherwise create a doll and active catalog entry with the Store page as evidence.
5. Save the visible product-page price as a normal confirmed regional offer with seller and fulfilment. The product is official because it was discovered through the Monster High Store; the offer seller is not inferred to be Mattel. Existing user image paths are never overwritten.
6. After official-store import finishes, run the existing cross-region ASIN discovery and price refresh for the active catalogue. Store reads happen once per region, not once per doll.

## Data and operations

- Add a `StoreImportService` in the main process that coordinates Store reads, product checks, `CatalogRepository.importSeed()` and `PriceService` persistence.
- Extend the collector protocol with a Store page method and a structured Store product link parser. Browser contexts remain bundled Chromium and headless.
- Cache each region's Store result for the active import run only; the next manual refresh gets current prices and current official assortment.
- Store failures or transient Amazon blocks are recorded in import state by region. They never delete existing dolls or prices.

## User experience

- The existing «Обновить сейчас» action becomes an official-store import followed by the regional price pass.
- The status area reports progress as `Store US 14/38`, then `Проверяем цены 7/…`, and reports individual region blocks rather than finishing as a silent empty result.
- Existing table and detail layouts remain unchanged in this iteration; new official dolls appear in the same catalogue list with their source prices.

## Test coverage

- Parse Store product links, reject non-product links and deduplicate ASINs.
- Import a valid Store doll with SKU, image and New price into a new catalog entry and confirmed regional listing.
- Reject an accessory even if it appears on the official Store page.
- Update an existing SKU without replacing a manual image.
- A blocked Store region updates import state but preserves existing data.
- Renderer status distinguishes Store import progress from ordinary price refresh progress.
