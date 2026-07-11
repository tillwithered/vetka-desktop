# Curated catalog and daily pricing

## Goal

Make Vetka a Russian-first operational catalog for currently sold Monster High dolls while keeping Amazon price monitoring useful and within the Webshare 1 GB monthly budget.

## Catalog source

Mattel is the sole automatic catalog source. The initial agent-curated import reads live official Mattel Monster High product pages and writes, for each current doll:

- a concise Russian display name in the form `Персонаж — Линейка`;
- the official English Mattel title;
- character, line, SKU, UPC/EAN when published, and Mattel product URL;
- Mattel product image URL.

The Russian display name is shown in the table, page heading, selectors and orders. The official English title is retained in the doll specification block for identity verification and source traceability. Mattel image URLs are saved directly; Playwright never downloads images through Webshare.

New dolls are added manually. Automatic Amazon Store discovery and Amazon search are removed from the normal workflow.

## Price monitoring

Amazon pricing is ASIN-first only. A price check opens the direct product card only for a doll with a previously confirmed ASIN. It verifies expected ASIN, exact Mattel SKU, and Monster High/title context before persisting a New offer. A failed verification, unavailable product, or proxy error keeps the last verified price.

The full active catalog is checked automatically once every 24 hours while Vetka is running. Each doll-region pair is requested at most once per daily cycle. A manual check may run outside that cadence. No scheduled Store import, Amazon search, or image fetch is permitted.

The next cycle is calculated from the persisted completion time. If Vetka was closed past the due time, it schedules one deferred run after startup rather than creating multiple catch-up scans.

## Proxy and bandwidth rules

Each price request starts direct to minimise residential bandwidth. CAPTCHA, robot-check markup, HTTP 202/429, or a classified temporary Amazon block trigger exactly one retry through the configured residential route for that marketplace: US, UK, DE, ES, or IT. A normal no-price, out-of-stock result, identity mismatch, or parser error never consumes a proxy retry.

The direct attempt and proxy retry use separate isolated browser profiles. A proxy-mode retry never falls back to the local IP again.

Store discovery is not part of scheduled work. The collector continues to block image, font, and media resources. The daily budget is bounded by the number of active confirmed ASINs times configured regions; the UI states the next price check rather than claiming that it scans a Store.

## Interface

The existing doll detail profile gains an `Официальное название` fact below the Russian-facing identity facts. It uses the existing Card and fact-grid composition at desktop widths and supports an empty value for manually created legacy dolls.

The catalog status surface is renamed from `Автопроверка Amazon` to `Проверка цен`. During a run it reports the current region and processed doll count; idle copy gives the daily schedule and next due time. The manual button remains `Обновить сейчас`.

## Verification

- Unit tests prove automatic daily scheduling, a deferred overdue run, no Store import in automatic mode, and one request per confirmed doll-region per cycle.
- Collector and repository tests prove Mattel/legacy official title persistence, Russian display names, and Mattel image priority.
- Renderer tests cover Russian heading, official-English fact, daily idle/running text, and legacy empty values.
- The initial catalog import is validated against live Mattel URLs and visually checked in Electron at 1080x720, 1280x800 and 1440x900.
- A live Amazon check confirms one doll in each configured region when an offer exists, with the price currency taken from the product page rather than assumed from the marketplace.
