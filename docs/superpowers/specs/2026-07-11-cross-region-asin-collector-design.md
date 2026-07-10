# Cross-region ASIN collector design

## Goal

Make each confirmed Amazon ASIN reusable across Amazon US, UK, DE, ES and IT before falling back to marketplace search. A temporary Amazon block must never be reported as an absent offer.

## Evidence and decision

Robecca Steam is confirmed in ES as ASIN `B0FK1V67X5`, but the current collector only attempts confirmed listings in their original region. It therefore starts every other region with keyword search. Amazon UK can return HTTP 202/503 to the packaged Chromium even though the product is available in a normal browser, and the present flow reduces that result to `no_price`.

The collector will use a direct cross-region probe first. It constructs the target region's canonical `/dp/{ASIN}` URL from every confirmed listing for the doll, opens it, and applies the existing SKU/EAN/title fact-triangle before accepting the regional price. A copied ASIN is only a lead: it has no authority to create a listing by itself. Only a verified, New offer creates or refreshes that region's confirmed listing. The current SKU-based search remains a fallback for products whose ASIN differs by marketplace.

## Flow

For every requested region:

1. Gather all confirmed listing ASINs for the doll, regardless of their source region, deduplicated in stable order.
2. Probe `https://{target-host}/dp/{ASIN}` for each ASIN. Parse the product page and require the existing catalog fact-triangle: exact Mattel SKU or UPC/EAN, title/required-term evidence, and Monster High/doll context. A mismatched ASIN is rejected and cannot create a regional price.
3. On the first verified matching New offer, return it and skip search.
4. If direct probes produce no verified match, run the existing ordered catalogue search and fact-triangle validation.
5. If Amazon responds with a transient block (HTTP 202, 429, or 5xx) or CAPTCHA, return `blocked`/`captcha_required` for that region. Do not substitute `no_price`.

## Persistence and visibility

For an existing confirmed listing in a blocked region, persist a `price_checks` record with status `blocked`. For a region without a listing, return the blocked collector status so the catalog scan can surface it in its last error/state rather than making the absence look like an ordinary no-price result. Existing verified prices remain unchanged.

## Boundaries

- No system Chrome/Edge and no browser extension are introduced.
- The bundled persistent Chromium remains headless except for an explicit CAPTCHA window.
- The matcher remains strict: an ASIN copied from another region still needs the same SKU/EAN/title facts and New condition; ASIN equality alone is never a match.
- The direct probe is bounded by the doll's known unique ASINs; it does not brute-force Amazon.

## Tests

- A known ES Robecca ASIN is probed on UK before `search()` and becomes a UK verified result when the facts match.
- A cross-region direct product with mismatched identity is rejected and search continues.
- A transient HTTP response is represented as `blocked`, never `no_price`.
- PriceService passes global confirmed listings to each per-region request and stores a blocked check for an existing regional listing.
