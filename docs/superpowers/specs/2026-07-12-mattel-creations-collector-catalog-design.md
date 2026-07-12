# Mattel Creations collector catalog

## Goal

Add a separate Monster High collector catalog sourced only from Mattel Creations, with direct low-frequency availability checks and no Amazon discovery, ASINs, marketplace regions, residential proxies, or Webshare traffic.

## Scope and source of truth

The official sources are:

- `https://creations.mattel.com/pages/monster-high` for featured and upcoming releases;
- `https://creations.mattel.com/collections/monster-high` for the Monster High product collection;
- product-specific Mattel Creations pages for final identity, price, availability, sale timing, SKU, and images.

Include full-size dolls and doll multipacks. Exclude apparel, mugs, bags, memberships, games, small non-doll figures, décor, and accessories without a doll. Products are classified from their product page rather than title alone when wording such as `figure` is ambiguous.

Sold-out or removed products are retained as archived collector records. A later successful check may restore an archived item to an active state.

## Collector identity and state

Each collector record stores:

- a concise Russian display name;
- the exact official English Mattel Creations title;
- Mattel SKU when published;
- collector line or collaboration;
- current price and currency;
- lifecycle state;
- public sale, early-access, or preorder time when published;
- Fang Club restriction when published;
- primary official image URL;
- product-specific Mattel Creations URL;
- source check time and last check result.

Lifecycle states are `in_stock`, `preorder`, `coming_soon`, `fang_club`, and `sold_out`. Collection state and check health are separate: a network or parser failure never replaces the last known lifecycle state with a false sold-out state.

SKU is the preferred identity key. When SKU is not yet published, the canonical product URL is the temporary key. When a later check reveals the SKU, the same record is upgraded without duplication.

## Direct collector

The collector never calls Amazon and never reads Amazon proxy settings. It first performs a direct lightweight request to the official landing page, collection, and discovered product pages. It parses official structured product data and page metadata for title, canonical URL, variants, price, currency, availability, SKU, and images.

Mattel pages may contain hidden labels for several lifecycle states at once. The collector must not infer status from the mere presence of words such as `Sold out` or `Coming Soon` in the raw document. It uses structured variant availability and the active rendered product state. When the lightweight response is incomplete or contradictory, it may open that product in the existing local browser runtime without a proxy and inspect the active controls and visible state.

The collector refreshes at most once every 24 hours while Vetka is running, plus a manual `Обновить сейчас` action. Because collector releases are infrequent, it does not poll continuously and does not perform catch-up loops after downtime.

## Persistence and errors

The collector catalog uses its own tables and repository rather than overloading retail dolls, Amazon listings, or price snapshots. Import is idempotent by SKU or canonical URL.

A refresh processes products independently. Successful records commit even if other product pages fail. A failed product retains its last known identity, price, lifecycle state, and image, while `lastCheckResult` and `lastCheckedAt` expose that verification is stale. A product is archived only from positive official evidence or after it is absent from two consecutive complete collection scans; one incomplete response cannot archive the catalog.

## Interface decision

- **Surface type:** separate operational catalog page.
- **User job:** see which Monster High collector dolls are available, upcoming, member-restricted, or sold out and open the official product page.
- **Primary action:** `Обновить сейчас`.
- **Navigation:** a new `Коллекционки` destination in the existing solid sidebar, with an accessible Lucide icon and tooltip in the collapsed icon rail.
- **Existing pattern:** reuse `AppShell`, `PageHeader`, `PageToolbar`, `TableSurface`, `EmptyState`, and the existing table density used by `Куклы`.
- **Registry candidates inspected:** official Maia `dashboard-01`, `dashboard-02`, and `sidebar-07`. The local catalog composition is selected because it already matches the product job and avoids importing unrelated dashboard, chart, drag-and-drop, or nested-navigation behavior.
- **Component map:** existing `Table`, `Badge`, `Tabs`, `Button`, `Input`, `Skeleton`, `Alert`, and `Tooltip` primitives; no new UI library or custom design system.
- **Desktop strategy:** 24px page inset and section gaps, 12-16px related groups, 8px inline groups, `sm` toolbar controls, full-width table, and no mobile/tablet-specific layout.
- **Deviations:** none from the locked Maia, Violet, Inter, Lucide, default-radius, solid-menu, subtle-accent preset.

The table shows image and name, collector line, SKU, Mattel price, lifecycle badge, last check time, and an external Mattel action. `Актуальные` and `Архив` tabs separate active/preorder/upcoming/Fang Club records from sold-out records. Search covers Russian name, official English title, collaboration, and SKU.

No internal collector detail page is added in the first version. The official Mattel product page is the detail source.

The page supports loading, empty, populated, persistent refresh error, disabled/pending refresh, stale data, long names, missing SKU, missing sale time, and partial refresh states. Errors use the last known data instead of clearing the table.

## Verification

- Fixture tests cover collection discovery, product classification, SKU and image extraction, price/currency, every lifecycle state, ambiguous hidden labels, Fang Club windows, and exclusion of merchandise.
- Repository tests cover idempotent SKU/URL upsert, URL-to-SKU identity upgrade, archive and restore, and preservation of last known data after failure.
- Service tests prove one scheduled refresh per 24 hours, manual refresh, no proxy configuration access, no Amazon calls, partial success, and no archive after an incomplete scan.
- Renderer tests cover navigation, active/archive tabs, search, status badges, stale/error state, missing fields, long titles, pending refresh, and the external Mattel link.
- Run the full automated test suite, lint, typecheck, package, and release-version checks.
- Live-check the Mattel Creations collection and representative in-stock, preorder/coming-soon, Fang Club, and sold-out product pages when those states are available.
- Visually check Electron at 1080x720, 1280x800, and 1440x900 with the sidebar expanded and collapsed, comparing against the local positive and sidebar-collapse references.
