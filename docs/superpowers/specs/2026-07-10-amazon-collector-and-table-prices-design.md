# Amazon collector and table prices design

## Goal

Make Amazon price checks invisible during ordinary work, recover from short-lived browser failures, and show saved regional prices directly in the dolls table.

## Collector

- Package Playwright Chromium with Vetka Desktop and launch it from the application resources, not from the user's installed Chrome.
- Keep one isolated persistent profile per Amazon region under Vetka application data; do not use any user browser profile.
- Run ordinary checks with `headless: true`, so no browser windows or tabs are visible.
- If a context or page closes during navigation, discard that region context, recreate it, and retry that one navigation once. A second failure is recorded as a network error with a concise safe diagnostic.
- Continue to validate title, Mattel SKU, required terms, reject terms, condition, availability, and price before persisting an offer. A Hunter x Hunter result for a Monster High SKU remains an identity mismatch and cannot create a price.
- Only CAPTCHA may surface a browser: launch a dedicated visible page for that region, show the existing resume action, and return to headless operation once verification is complete.

## Packaging

- Use the Playwright browser installed during the Windows release build and copy the Chromium runtime into Electron resources.
- The installer becomes larger (approximately 120–180 MB). This is accepted to remove dependence on a separately installed browser and to provide predictable local collection.

## Dolls table price column

- Keep the desktop `TableSurface` and add one compact `Цены` column before actions.
- Closed row state shows the best fresh verified offer as `region · local currency`, plus its KZT equivalent. No price shows an em dash.
- A `Collapsible` row control expands a second table row with the current verified offers for all regions, their freshness, KZT amount, and direct Amazon links.
- The page requests all current offers for visible dolls in one IPC request. It must not make a separate database request per table row.
- Existing doll detail price history and regional offer list remain the full research view; table expansion is an operational summary.

## States and errors

- The scanner status keeps progress and concise per-entry errors, but transient browser closure does not stop the remaining catalog entries.
- Table prices have loading skeletons, no-price state, stale-state badge, and long values truncate without widening desktop action columns.

## Verification

- Unit tests cover closed-context recreation, one transient navigation retry, and identity rejection.
- Repository and IPC tests cover the batch price summary query.
- Renderer tests cover collapsed and expanded prices, no-price, and stale states.
- Final checks: test suite, lint, typecheck, packaged Windows build, and Electron visual QA at 1080×720, 1280×800, and 1440×900.
