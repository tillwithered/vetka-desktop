# Mattel Creations Collector Catalog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a separate Monster High collector catalog sourced only from Mattel Creations with direct daily refresh, archive state, and no Amazon or proxy dependency.

**Architecture:** Store collector products in dedicated SQLite tables, parse official collection/product HTML through a direct HTTP client, and use a separate direct Playwright fallback only for ambiguous lifecycle state. Expose a narrow IPC API and reuse the existing catalog page patterns for a dedicated `Коллекционки` route.

**Tech Stack:** Electron, TypeScript, Zod, SQLite, Cheerio, Playwright Core, React, TanStack Query, Vitest, existing shadcn Maia primitives.

## Global Constraints

- Mattel Creations is the only source; never call Amazon, Webshare, or proxy settings.
- Include full-size dolls and doll multipacks only; exclude merchandise, memberships, games, décor, and non-doll figures.
- Preserve sold-out products in an archive and restore them if they return.
- Keep lifecycle state separate from refresh health; failures preserve last-known product facts.
- Refresh at most once per 24 hours plus manual refresh; do not run catch-up loops.
- Use the locked Maia/Violet/Inter/Lucide/default-radius/solid-menu/subtle-accent UI and existing local patterns.

---

### Task 1: Persist collector catalog records and scan state

**Files:**
- Create: `apps/desktop/src/main/db/migrations/0006_collector_catalog.sql`
- Modify: `apps/desktop/src/main/db/migrate.ts`
- Create: `apps/desktop/src/main/collectibles/repository.ts`
- Modify: `apps/desktop/src/shared/contracts.ts`
- Test: `apps/desktop/tests/main/database.test.ts`
- Create: `apps/desktop/tests/main/collectibles-repository.test.ts`

**Interfaces:**
- Produces `Collectible`, `CollectibleLifecycle`, `CollectibleCheckResult`, and `CollectiblesScanState` contracts.
- Produces `CollectiblesRepository.upsert()`, `list()`, `recordFailure()`, `finishCompleteScan()`, `getScanState()`, and `setScanState()`.

- [ ] **Step 1: Write failing migration and repository tests.**

```ts
it('upserts by canonical URL then upgrades identity to SKU without duplication', () => {
  repository.upsert({ ...record, mattelSku: null, canonicalUrl: url });
  repository.upsert({ ...record, mattelSku: 'JKM54', canonicalUrl: url });
  expect(repository.list({ archived: false })).toHaveLength(1);
  expect(repository.list({ archived: false })[0]).toMatchObject({ mattelSku: 'JKM54' });
});

it('archives only after two consecutive complete scans omit a product', () => {
  repository.upsert(record);
  repository.finishCompleteScan([]);
  expect(repository.list({ archived: false })).toHaveLength(1);
  repository.finishCompleteScan([]);
  expect(repository.list({ archived: true })).toHaveLength(1);
});
```

- [ ] **Step 2: Run focused tests and confirm RED.**

Run: `npm.cmd --prefix apps/desktop test -- database collectibles-repository`

Expected: FAIL because migration 6 and the repository do not exist.

- [ ] **Step 3: Implement migration, contracts, and repository.**

Create strict tables with these columns:

```sql
CREATE TABLE collectibles (
  id TEXT PRIMARY KEY,
  mattel_sku TEXT UNIQUE,
  canonical_url TEXT NOT NULL UNIQUE,
  name_ru TEXT NOT NULL,
  official_name TEXT NOT NULL,
  line_name TEXT,
  price_minor INTEGER CHECK (price_minor IS NULL OR price_minor >= 0),
  currency TEXT,
  lifecycle TEXT NOT NULL CHECK (lifecycle IN ('in_stock','preorder','coming_soon','fang_club','sold_out')),
  sale_starts_at TEXT,
  fang_club_only INTEGER NOT NULL CHECK (fang_club_only IN (0,1)),
  image_url TEXT,
  last_check_result TEXT NOT NULL CHECK (last_check_result IN ('verified','error')),
  last_checked_at TEXT NOT NULL,
  missing_complete_scans INTEGER NOT NULL DEFAULT 0,
  archived_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE TABLE collectibles_scan_state (
  singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
  status TEXT NOT NULL CHECK (status IN ('idle','running')),
  started_at TEXT,
  completed_at TEXT,
  next_run_at TEXT,
  processed INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL DEFAULT 0,
  last_error TEXT
) STRICT;
```

Use `crypto.randomUUID()` for new IDs. `recordFailure()` updates only check health/time. `finishCompleteScan(urls)` resets present rows to zero missing scans and increments absent rows, archiving at two.

- [ ] **Step 4: Run focused tests and confirm GREEN.**

Run: `npm.cmd --prefix apps/desktop test -- database collectibles-repository`

Expected: PASS.

- [ ] **Step 5: Commit persistence.**

```powershell
git add apps/desktop/src/main/db/migrations/0006_collector_catalog.sql apps/desktop/src/main/db/migrate.ts apps/desktop/src/main/collectibles/repository.ts apps/desktop/src/shared/contracts.ts apps/desktop/tests/main/database.test.ts apps/desktop/tests/main/collectibles-repository.test.ts
git commit -m "feat: persist Mattel Creations catalog"
```

### Task 2: Parse Mattel Creations collection and product pages

**Files:**
- Create: `apps/desktop/src/main/collectibles/parser.ts`
- Create: `apps/desktop/tests/fixtures/mattel-creations/collection.html`
- Create: `apps/desktop/tests/fixtures/mattel-creations/in-stock.html`
- Create: `apps/desktop/tests/fixtures/mattel-creations/sold-out.html`
- Create: `apps/desktop/tests/fixtures/mattel-creations/coming-soon.html`
- Create: `apps/desktop/tests/main/collectibles-parser.test.ts`

**Interfaces:**
- Produces `parseCollectibleCollection(html, baseUrl): string[]`.
- Produces `parseCollectibleProduct(html, canonicalUrl): ParsedCollectible | { ambiguous: true } | null`.

- [ ] **Step 1: Add sanitized official fixtures and failing parser tests.**

```ts
it('discovers unique product URLs and excludes merchandise links', () => {
  expect(parseCollectibleCollection(collectionHtml, baseUrl)).toEqual([
    'https://creations.mattel.com/products/monster-high-skullector-ghostbusters-gozer-doll-jkm54',
    'https://creations.mattel.com/products/beetlejuice-waiting-room-2-pack-jcx58',
  ]);
});

it('parses exact identity, money, image, and active lifecycle', () => {
  expect(parseCollectibleProduct(inStockHtml, gozerUrl)).toMatchObject({
    mattelSku: 'JKM54', officialName: 'Monster High Skullector Ghostbusters Gozer Doll',
    priceMinor: 7000, currency: 'USD', lifecycle: 'in_stock', fangClubOnly: false,
  });
});
```

- [ ] **Step 2: Run parser tests and confirm RED.**

Run: `npm.cmd --prefix apps/desktop test -- collectibles-parser`

Expected: FAIL because parser functions do not exist.

- [ ] **Step 3: Implement structured-data-first parsing.**

Use Cheerio to read canonical links, `application/ld+json`, Shopify product JSON embedded in scripts, SKU text matching `SKU#:` and official images. Determine lifecycle from structured variant availability and the active product form. Return `{ ambiguous: true }` when hidden labels conflict and no active structured availability resolves them. Return `null` for excluded merchandise.

```ts
export type ParsedCollectible = {
  mattelSku: string | null;
  canonicalUrl: string;
  officialName: string;
  nameRu: string;
  lineName: string | null;
  priceMinor: number | null;
  currency: string | null;
  lifecycle: CollectibleLifecycle;
  saleStartsAt: string | null;
  fangClubOnly: boolean;
  imageUrl: string | null;
};
```

For V0, `nameRu` uses a deterministic concise transliteration/known-character map and falls back to the official name; it is never invented from unrelated marketing copy.

- [ ] **Step 4: Run parser tests and confirm GREEN.**

Run: `npm.cmd --prefix apps/desktop test -- collectibles-parser`

Expected: PASS for collection, in-stock, sold-out, coming-soon/Fang Club, hidden-label ambiguity, and merchandise exclusion fixtures.

- [ ] **Step 5: Commit parser and fixtures.**

```powershell
git add apps/desktop/src/main/collectibles/parser.ts apps/desktop/tests/fixtures/mattel-creations apps/desktop/tests/main/collectibles-parser.test.ts
git commit -m "feat: parse Mattel Creations products"
```

### Task 3: Add direct HTTP collection with browser fallback

**Files:**
- Create: `apps/desktop/src/main/collectibles/client.ts`
- Create: `apps/desktop/src/main/collectibles/browser.ts`
- Create: `apps/desktop/tests/main/collectibles-client.test.ts`
- Create: `apps/desktop/tests/main/collectibles-browser.test.ts`

**Interfaces:**
- Produces `MattelCreationsClient.collect(): Promise<CollectiblesCollectionResult>`.
- Produces `DirectMattelBrowser.open(url): Promise<string>` with no proxy argument or dependency.

- [ ] **Step 1: Write failing direct-transport tests.**

```ts
it('uses direct fetch and browser fallback only for ambiguous products', async () => {
  const result = await client.collect();
  expect(fetchHtml).toHaveBeenCalledWith('https://creations.mattel.com/collections/monster-high');
  expect(browser.open).toHaveBeenCalledTimes(1);
  expect(result.complete).toBe(true);
});

it('has no Amazon region or proxy configuration surface', () => {
  expect(DirectMattelBrowser.length).toBeLessThanOrEqual(2);
});
```

- [ ] **Step 2: Run focused tests and confirm RED.**

Run: `npm.cmd --prefix apps/desktop test -- collectibles-client collectibles-browser`

Expected: FAIL because direct client and browser do not exist.

- [ ] **Step 3: Implement direct fetch and isolated browser profile.**

Use Node `fetch` with a 30-second abort timeout, a Vetka user agent, and redirects enabled. `DirectMattelBrowser` uses the existing browser executable discovery, a separate `mattel-creations-profile`, headless Chromium, and blocks image/font/media requests. It exposes no proxy configuration and never imports Amazon region or proxy modules.

`collect()` marks the scan complete only when the collection request succeeds and every discovered URL is either parsed, positively excluded, or returns a per-product error recorded in `errors`; transport failure of the collection itself sets `complete: false`.

- [ ] **Step 4: Run focused tests and confirm GREEN.**

Run: `npm.cmd --prefix apps/desktop test -- collectibles-client collectibles-browser`

Expected: PASS and no proxy/Amazon imports in the collector files.

- [ ] **Step 5: Commit the direct collector.**

```powershell
git add apps/desktop/src/main/collectibles/client.ts apps/desktop/src/main/collectibles/browser.ts apps/desktop/tests/main/collectibles-client.test.ts apps/desktop/tests/main/collectibles-browser.test.ts
git commit -m "feat: collect Mattel Creations directly"
```

### Task 4: Schedule and expose collector refresh

**Files:**
- Create: `apps/desktop/src/main/collectibles/service.ts`
- Modify: `apps/desktop/src/main/app-services.ts`
- Modify: `apps/desktop/src/shared/channels.ts`
- Modify: `apps/desktop/src/shared/contracts.ts`
- Modify: `apps/desktop/src/main/ipc/register-ipc.ts`
- Modify: `apps/desktop/src/preload.ts`
- Test: `apps/desktop/tests/main/app-services.test.ts`
- Create: `apps/desktop/tests/main/collectibles-service.test.ts`
- Modify: `apps/desktop/tests/main/ipc-validation.test.ts`

**Interfaces:**
- Produces `CollectiblesService.start()`, `runNow()`, `list(filter)`, and `getState()`.
- Adds `window.vetka.collectibles.list()`, `getScanState()`, `refreshNow()`, and `onScanStateChanged()`.

- [ ] **Step 1: Write failing service and IPC tests.**

```ts
it('runs once when due and schedules exactly 24 hours from completion', async () => {
  service.start();
  await vi.runAllTimersAsync();
  expect(client.collect).toHaveBeenCalledOnce();
  expect(repository.getScanState().nextRunAt).toBe(new Date(now + 86_400_000).toISOString());
});

it('does not create catch-up loops after downtime', async () => {
  service.start();
  await vi.runAllTimersAsync();
  expect(client.collect).toHaveBeenCalledOnce();
});
```

- [ ] **Step 2: Run focused tests and confirm RED.**

Run: `npm.cmd --prefix apps/desktop test -- collectibles-service app-services ipc-validation`

Expected: FAIL because service, channels, and API are missing.

- [ ] **Step 3: Implement scheduler, partial persistence, IPC, and preload.**

`runNow()` sets running state, upserts successful products, calls `recordFailure()` for failed known URLs, and calls `finishCompleteScan()` only when `result.complete` is true. It persists completion and next-run timestamps even when individual products fail. `startBackgroundServices` starts the collector independently so its failure cannot prevent app startup or Amazon pricing.

- [ ] **Step 4: Run focused tests and confirm GREEN.**

Run: `npm.cmd --prefix apps/desktop test -- collectibles-service app-services ipc-validation security`

Expected: PASS with no proxy data crossing IPC.

- [ ] **Step 5: Commit service integration.**

```powershell
git add apps/desktop/src/main/collectibles/service.ts apps/desktop/src/main/app-services.ts apps/desktop/src/shared/channels.ts apps/desktop/src/shared/contracts.ts apps/desktop/src/main/ipc/register-ipc.ts apps/desktop/src/preload.ts apps/desktop/tests/main/app-services.test.ts apps/desktop/tests/main/collectibles-service.test.ts apps/desktop/tests/main/ipc-validation.test.ts
git commit -m "feat: schedule Mattel Creations refresh"
```

### Task 5: Wire collector dependencies into Electron startup

**Files:**
- Modify: `apps/desktop/src/main.ts`
- Test: `apps/desktop/tests/main/app-services.test.ts`

**Interfaces:**
- Consumes repository, direct client/browser, and service from Tasks 1-4.
- Supplies the service to IPC and background startup, and closes its browser during shutdown.

- [ ] **Step 1: Add a failing composition test or extracted factory assertion.**

```ts
it('starts collectibles independently from Amazon catalog pricing', () => {
  startBackgroundServices({ collectibles, scan });
  expect(collectibles.start).toHaveBeenCalledOnce();
  expect(scan.start).toHaveBeenCalledOnce();
});
```

- [ ] **Step 2: Run the startup test and confirm RED.**

Run: `npm.cmd --prefix apps/desktop test -- app-services`

Expected: FAIL because `collectibles` is not accepted or started.

- [ ] **Step 3: Compose the collector in `main.ts`.**

Instantiate `CollectiblesRepository`, `DirectMattelBrowser`, `MattelCreationsClient`, and `CollectiblesService` beside existing catalog services. Pass the service to `registerIpcHandlers`, `startBackgroundServices`, and app shutdown cleanup.

- [ ] **Step 4: Run startup/main tests and confirm GREEN.**

Run: `npm.cmd --prefix apps/desktop test -- app-services database security`

Expected: PASS.

- [ ] **Step 5: Commit startup wiring.**

```powershell
git add apps/desktop/src/main.ts apps/desktop/src/main/app-services.ts apps/desktop/tests/main/app-services.test.ts
git commit -m "feat: start collector catalog service"
```

### Task 6: Build the separate Collectibles page

**Files:**
- Create: `apps/desktop/src/renderer/features/collectibles/collectibles-page.tsx`
- Create: `apps/desktop/src/renderer/features/collectibles/collectibles-table.tsx`
- Create: `apps/desktop/src/renderer/features/collectibles/collectibles-scan-status.tsx`
- Modify: `apps/desktop/src/components/patterns/app-shell.tsx`
- Modify: `apps/desktop/src/renderer/app.tsx`
- Modify: `apps/desktop/tests/setup.ts`
- Modify: `apps/desktop/tests/renderer/app-shell.test.tsx`
- Create: `apps/desktop/tests/renderer/collectibles-page.test.tsx`

**Interfaces:**
- Adds `/collectibles` and a `Коллекционки` sidebar destination.
- Uses `window.vetka.collectibles` from Task 4.

- [ ] **Step 1: Write failing navigation and page-state tests.**

```tsx
it('shows active and archived collectibles with direct Mattel actions', async () => {
  render(<App />);
  await user.click(screen.getByRole('link', { name: 'Коллекционки' }));
  expect(await screen.findByText('Monster High Skullector Ghostbusters Gozer Doll')).toBeVisible();
  expect(screen.getByText('В продаже')).toBeVisible();
  expect(screen.getByRole('link', { name: 'Открыть на Mattel' })).toHaveAttribute('href', gozerUrl);
  await user.click(screen.getByRole('tab', { name: 'Архив' }));
  expect(await screen.findByText('Beetlejuice Waiting Room 2-Pack')).toBeVisible();
});
```

Add cases for loading skeleton, empty state, stale/error Alert, pending disabled refresh, long title, missing SKU/date, and partial result copy.

- [ ] **Step 2: Run renderer tests and confirm RED.**

Run: `npm.cmd --prefix apps/desktop test -- collectibles-page app-shell`

Expected: FAIL because route, navigation, and page do not exist.

- [ ] **Step 3: Implement the smallest approved local composition.**

Use `PageHeader`, `PageToolbar`, `TableSurface`, `EmptyState`, `Tabs`, `Table`, `Badge`, `Input`, `Button size="sm"`, `Skeleton`, and `Alert`. Columns are image/name, line, SKU, Mattel price, lifecycle, last check, and external action. Search covers Russian/English name, line, and SKU. Use `GemIcon` or another semantically clear Lucide icon with sidebar tooltip and accessible label.

- [ ] **Step 4: Run renderer tests and confirm GREEN.**

Run: `npm.cmd --prefix apps/desktop test -- collectibles-page app-shell product-patterns`

Expected: PASS for populated and non-ideal states.

- [ ] **Step 5: Commit the Collectibles UI.**

```powershell
git add apps/desktop/src/renderer/features/collectibles apps/desktop/src/components/patterns/app-shell.tsx apps/desktop/src/renderer/app.tsx apps/desktop/tests/setup.ts apps/desktop/tests/renderer/app-shell.test.tsx apps/desktop/tests/renderer/collectibles-page.test.tsx
git commit -m "feat: add collector catalog page"
```

### Task 7: Full verification and release

**Files:**
- Modify: `apps/desktop/package.json`
- Modify: `apps/desktop/package-lock.json`

- [ ] **Step 1: Run full deterministic verification.**

Run: `npm.cmd --prefix apps/desktop test; npm.cmd --prefix apps/desktop run lint; npm.cmd --prefix apps/desktop run typecheck; npm.cmd --prefix apps/desktop run package; npm.cmd --prefix apps/desktop run release:verify-version`

Expected: all commands exit 0 without warnings promoted to errors.

- [ ] **Step 2: Run live Mattel verification.**

Refresh `https://creations.mattel.com/collections/monster-high` directly and inspect representative active, upcoming/preorder or Fang Club, and sold-out products. Confirm no proxy configuration or Amazon URL appears in logs or requests.

- [ ] **Step 3: Run visual QA.**

Inspect `/collectibles` in Electron at 1080x720, 1280x800, and 1440x900 with expanded and collapsed sidebars. Verify loading, empty, populated, error/stale, pending, long-name, missing-field, and archive states against the local positive and sidebar-collapse reference images.

- [ ] **Step 4: Bump one patch version and re-run the release verifier.**

Update `version` in `package.json` and `package-lock.json` to the next unused patch only after all prior checks pass.

- [ ] **Step 5: Commit the release.**

```powershell
git add apps/desktop/package.json apps/desktop/package-lock.json
git commit -m "chore: release next Vetka Desktop patch"
```
