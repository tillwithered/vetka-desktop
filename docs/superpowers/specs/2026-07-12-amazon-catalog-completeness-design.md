# Monster High Amazon Catalog Completeness

## Outcome

Every active Mattel retail doll must have an explicit, auditable result for every supported Amazon marketplace: US, UK, DE, ES, and IT. With 28 active dolls, the completeness matrix contains 140 region cells. No cell may be silently empty.

Each region cell must contain one of:

- a currently verified New-condition price with its exact Amazon product URL and check time;
- an exact Amazon product URL with an explicit `no_price` or `out_of_stock` result and check time;
- an Amazon regional search/store evidence URL with an explicit `not_found` result and check time;
- a temporary check failure with its evidence URL, diagnostic status, and retry time. Temporary failures do not count as catalog-complete.

The first full audit includes the user-confirmed Italian JMB81 listing (`B0FJZYDKX9`) and every other active catalog SKU.

## Root causes confirmed

1. `JMB81` omitted `amazon_it` from the verified listing seed although the same ASIN exists on Amazon Italy.
2. `PriceRepository.current()` selects the last price snapshot even when the newest check is `no_price`, so a historical price is presented as current.
3. UI freshness thresholds (one hour / 24 hours) conflict with the daily refresh schedule and create misleading `Давно` / `Устарела` badges.
4. Failed discovery for a region without a known listing is not persisted, leaving no evidence for an empty cell.
5. Optional identity fields are rendered as dashes, making otherwise valid cards look unfinished.

## Chosen approach

### Regional evidence ledger

Add a durable regional check record keyed by active catalog entry and Amazon region. It stores:

- result status (`verified`, `no_price`, `out_of_stock`, `not_found`, or a retryable/error status);
- exact product URL when an ASIN is known;
- otherwise a deterministic regional Amazon search evidence URL containing the Mattel SKU;
- ASIN when known;
- checked timestamp and safe diagnostic summary.

The price collector writes one record for every requested region, including searches that find no matching product. Seed import creates no fake results; only an actual check can establish absence.

### Current versus historical prices

`prices.current` returns a price only when the latest check for the selected confirmed listing is `verified` and the snapshot belongs to that same check. An older snapshot remains available through price history but cannot be used as a current offer or order source.

The detail query exposes five regional states separately from current prices. A `no_price` or `out_of_stock` region therefore keeps its Amazon link and check timestamp without displaying the old amount as current.

### Catalog completion gate

Add a verifier that enumerates all active entries across all five regions and fails unless every cell has:

- a terminal result (`verified`, `no_price`, `out_of_stock`, `not_found`);
- an evidence URL on the correct Amazon domain;
- a check timestamp from the current audit run;
- an identity-safe ASIN mapping whenever an exact product was found.

Retryable failures (`blocked`, `captcha_required`, `network_error`, `parser_changed`, `needs_review`, `identity_mismatch`, `conflict`) remain visible and keep the audit incomplete.

## UI decision

- **Surface type:** existing doll detail page and regional offer list.
- **User job:** decide whether a doll can be bought now in each country and independently verify the result.
- **Primary action:** `Обновить цены`.
- **Existing patterns:** `PageHeader`, existing two-column detail composition, shadcn `Card`, `Badge`, `Button`, `Separator`, and `Alert`; no new UI library.
- **Registry candidates inspected:** `dashboard-01`, `sidebar-07`, and `sidebar-01`. The existing detail composition is the closer fit; the dashboard table pattern informs compact status density.
- **Component map:** `DollIdentityProfile` for sourced identity facts; `RegionalOfferList` for exactly five region states; `PriceHistoryChart` for historical snapshots.
- **Desktop strategy:** retain the existing two-column layout at wide widths and one-column fallback below `xl`; keep links content-sized and region rows scannable at 1080×720.
- **States:** loading, complete price, no price, out of stock, not found, retryable failure, overdue check, and partial scan.
- **Deviation:** none from the locked Maia/Violet/Inter/Lucide preset.

Freshness badges are replaced with operational statuses:

- `Цена подтверждена`
- `Сейчас без цены`
- `Нет в наличии`
- `Карточка не найдена`
- `Не удалось проверить`

Every row shows an absolute last-check time. A separate neutral `Проверка просрочена` marker appears only after 36 hours, giving the daily job a 12-hour grace period. Labels `Свежая`, `Давно`, and `Устарела` are removed.

Historical prices never appear inside a non-verified current region row. The history chart remains the only place for old values.

Optional identity facts with no sourced value are omitted rather than rendered as `—`. Required fields remain Russian name, official English name, Mattel SKU, Mattel URL, image, character, and line. UPC/EAN and generation appear only after they are sourced; the collector may enrich UPC/EAN from primary product facts but must not infer values.

## Data collection and evidence

The full audit processes all 28 active SKUs and all five regions, regardless of existing listings. Known exact ASINs are checked first. Missing regions then use deterministic SKU/identity search. The collector must continue after a single-region failure.

For each cell, evidence is the exact regional product page when available. If no identity-safe listing is found, evidence is the regional Amazon search URL for the Mattel SKU. This is a reproducible proof of what was checked, not a claim that a product can never appear later.

The audit is repeatable daily and manually. New availability automatically replaces `not_found` with an exact listing and price state.

## Testing and verification

Implementation follows red-green TDD for:

1. JMB81 Amazon Italy seed coverage.
2. No current price when the latest check is `no_price` or `out_of_stock`.
3. Preservation of the old snapshot in history.
4. Persistence of a regional `not_found` evidence record.
5. Exactly five regional rows in the UI, each with status, timestamp, and evidence link.
6. Removal of old freshness labels and 36-hour overdue behavior.
7. Coverage verifier over all 140 active cells.
8. Existing identity conflict protections.

Completion requires:

- a real full-catalog audit run;
- 140/140 terminal region cells or continued work until retryable cells resolve;
- links and prices inspected for every active SKU;
- tests, lint, typecheck, catalog audit, packaging, and release-version verification;
- Electron visual QA at 1080×720, 1280×800, and 1440×900 with expanded and collapsed sidebar.

