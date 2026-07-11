# Direct-first daily Amazon pricing implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Check every known, active Amazon ASIN once a day, using Webshare only for one retry after an Amazon anti-bot response.

**Architecture:** Product-page collection gets an explicit direct attempt followed by at most one proxied retry. The browser keeps separate persistent profiles for direct and proxied contexts, so cookies and IP-specific challenges never leak across transports. `CatalogScanService` becomes an ASIN-price scheduler only: it persists completion state, schedules the next daily run, and never invokes the Amazon Store importer.

**Tech Stack:** Electron utility process, Playwright Chromium, TypeScript, Vitest, SQLite settings, React/shadcn UI.

## Global constraints

- New doll discovery, Amazon search, Store import and image loading are not part of a scheduled price refresh.
- A product is priced only after the existing ASIN + catalog-facts verification succeeds.
- Direct is attempted first. Only CAPTCHA/robot markup, `202`, `429`, or an internal temporary-block marker may use one configured proxy route for that same region.
- No proxy retry for `no_price`, `out_of_stock`, `identity_mismatch`, `conflict`, or `parser_changed`; do not log proxy credentials.
- A daily run covers all configured Amazon regions and every active catalog entry with a confirmed ASIN, at most once per doll-region per run.
- Use the Maia/Violet shadcn system and existing `CatalogScanStatus`; desktop V0 only.

---

### Task 1: Model the direct-first retry policy

**Files:**
- Modify: `apps/desktop/src/main/collector/proxy-transport.ts`
- Modify: `apps/desktop/src/collector/contracts.ts`
- Modify: `apps/desktop/src/collector/amazon/product-page.ts`
- Test: `apps/desktop/tests/main/proxy-transport.test.ts`
- Test: `apps/desktop/tests/collector/amazon-product-page.test.ts`

**Interfaces:**
- Produces `hasProxyRoute(transport, region): boolean` without exposing credentials.
- Produces `shouldRetryWithProxy(status: AmazonPageStatus): boolean` as the sole collector retry classifier.
- `AmazonProxyTransport` remains the private, encrypted source of regional routes; no renderer contract gains a secret.

- [ ] **Step 1: Write the failing transport and classifier tests.**

```ts
it('checks all regions directly even when no regional proxy route exists', () => {
  const transport = parseAmazonProxyTransport({ mode: 'proxy', routes: { amazon_uk: ['http://user:secret@uk.example:10000'] } });
  expect(regionsForCatalogScan(transport)).toEqual(['amazon_us', 'amazon_uk', 'amazon_de', 'amazon_es', 'amazon_it']);
  expect(hasProxyRoute(transport, 'amazon_uk')).toBe(true);
  expect(hasProxyRoute(transport, 'amazon_de')).toBe(false);
});

it.each(['blocked', 'captcha_required'] as const)('retries %s through a configured proxy', (status) => {
  expect(shouldRetryWithProxy(status)).toBe(true);
});

it.each(['no_price', 'out_of_stock', 'identity_mismatch', 'conflict', 'parser_changed'] as const)('does not retry %s through a proxy', (status) => {
  expect(shouldRetryWithProxy(status)).toBe(false);
});
```

- [ ] **Step 2: Run the focused tests and confirm they fail because the new helpers/expectations do not exist.**

Run: `npm --prefix apps/desktop test -- proxy-transport amazon-product-page`

Expected: FAIL mentioning `hasProxyRoute` and `shouldRetryWithProxy`.

- [ ] **Step 3: Implement the minimal public-free helpers.**

```ts
export function hasProxyRoute(transport: AmazonProxyTransport, region: AmazonRegion): boolean {
  return transport.mode === 'proxy' && (transport.routes[region] ?? []).length > 0;
}

export function regionsForCatalogScan(): AmazonRegion[] {
  return [...amazonRegions];
}

export function shouldRetryWithProxy(status: AmazonPageStatus): boolean {
  return status === 'blocked' || status === 'captcha_required';
}
```

Keep `ProxyRouteSelector` for route selection inside proxy retries; update its callers instead of removing its redaction guarantees.

- [ ] **Step 4: Run the focused tests and confirm they pass.**

Run: `npm --prefix apps/desktop test -- proxy-transport amazon-product-page`

Expected: PASS.

- [ ] **Step 5: Commit the policy layer.**

```powershell
git add apps/desktop/src/main/collector/proxy-transport.ts apps/desktop/src/collector/contracts.ts apps/desktop/src/collector/amazon/product-page.ts apps/desktop/tests/main/proxy-transport.test.ts apps/desktop/tests/collector/amazon-product-page.test.ts
git commit -m "feat: define direct-first Amazon retry policy"
```

### Task 2: Isolate direct and proxy browser attempts

**Files:**
- Modify: `apps/desktop/src/collector/browser.ts`
- Modify: `apps/desktop/src/collector/amazon/collect.ts`
- Modify: `apps/desktop/src/collector/worker.ts`
- Test: `apps/desktop/tests/collector/browser.test.ts`
- Test: `apps/desktop/tests/collector/collect.test.ts`

**Interfaces:**
- Extend `CollectorDriver` with `openProductDirect(region, url)` and `openProductViaProxy(region, url)`.
- `BrowserCollectorDriver.configureTransport()` only supplies candidate proxy routes; `openProductDirect()` must never launch with a Playwright proxy.
- `collectDoll()` first uses `openProductDirect()`, parses it, and invokes `openProductViaProxy()` exactly once only when `shouldRetryWithProxy()` and `driver.hasProxyRoute(region)` are both true.

- [ ] **Step 1: Write the failing collection tests.**

```ts
it('retries the same confirmed ASIN through proxy exactly once after a direct CAPTCHA', async () => {
  const driver: CollectorDriver = {
    hasProxyRoute: vi.fn(() => true),
    openProductDirect: vi.fn(async () => '<form action="/errors/validateCaptcha"></form>'),
    openProductViaProxy: vi.fn(async () => verifiedProductHtml),
    search: vi.fn(),
  };

  const result = await collectDoll(knownAsinRequest, driver, vi.fn());

  expect(result.regions.amazon_uk?.status).toBe('verified');
  expect(driver.openProductViaProxy).toHaveBeenCalledTimes(1);
});

it('does not use a proxy after a direct no-price product page', async () => {
  const driver = directDriver('<input id="ASIN" value="B0FK1V67X5"><span id="productTitle">Monster High Robecca JHK59</span>');
  await collectDoll(knownAsinRequest, driver, vi.fn());
  expect(driver.openProductViaProxy).not.toHaveBeenCalled();
});

it('returns the direct block when no regional proxy route is configured', async () => {
  const driver = blockedDirectDriver(false);
  const result = await collectDoll(knownAsinRequest, driver, vi.fn());
  expect(result.regions.amazon_uk?.status).toBe('blocked');
  expect(driver.openProductViaProxy).not.toHaveBeenCalled();
});
```

Add browser-level tests for profile names such as `amazon_uk/direct` and `amazon_uk/route-<hash>`, and assert direct launch options omit `proxy` while the proxied launch receives only the selected route.

- [ ] **Step 2: Run focused collection/browser tests and confirm they fail for the missing direct/proxy methods.**

Run: `npm --prefix apps/desktop test -- collect browser`

Expected: FAIL because `openProductDirect`, `openProductViaProxy`, or `hasProxyRoute` is missing.

- [ ] **Step 3: Implement the two-attempt collector with separate contexts.**

```ts
async function readKnownProduct(region: AmazonRegion, url: string): Promise<AmazonPageResult> {
  const direct = parseAmazonProductPage(await driver.openProductDirect(region, url), { region, expectedAsin });
  if (!shouldRetryWithProxy(direct.status) || !driver.hasProxyRoute(region)) return direct;
  return parseAmazonProductPage(await driver.openProductViaProxy(region, url), { region, expectedAsin });
}
```

`BrowserCollectorDriver` stores direct contexts separately from proxy contexts and only calls the interactive CAPTCHA-window path for an explicit product request after the proxied retry itself challenges. Close/recreate a failed context before retrying a navigation error, preserving the existing one-navigation retry limit.

- [ ] **Step 4: Run the focused tests and confirm they pass.**

Run: `npm --prefix apps/desktop test -- collect browser`

Expected: PASS.

- [ ] **Step 5: Commit the collector retry path.**

```powershell
git add apps/desktop/src/collector/browser.ts apps/desktop/src/collector/amazon/collect.ts apps/desktop/src/collector/worker.ts apps/desktop/tests/collector/browser.test.ts apps/desktop/tests/collector/collect.test.ts
git commit -m "feat: retry Amazon blocks through regional proxy"
```

### Task 3: Replace Store polling with a persisted daily ASIN scheduler

**Files:**
- Modify: `apps/desktop/src/main/catalog/scan-service.ts`
- Modify: `apps/desktop/src/main/app-services.ts`
- Modify: `apps/desktop/src/main.ts`
- Test: `apps/desktop/tests/main/catalog-scan-service.test.ts`
- Test: `apps/desktop/tests/main/app-services.test.ts`

**Interfaces:**
- `CatalogScanService` takes `asinPriceRefresh`, `regions`, and optional `initialState`; it no longer depends on `OfficialStoreImportService`.
- `start()` schedules one daily run from persisted `completedAt`; an overdue completion schedules one deferred run after startup, not an immediate loop.
- `runNow()` refreshes the active confirmed-ASIN catalog once, writes an idle state with `nextRunAt = completedAt + 86_400_000`, and schedules only one future timer.

- [ ] **Step 1: Replace Store-focused tests with failing daily scheduler tests.**

```ts
it('refreshes active confirmed ASINs without invoking Store import and schedules tomorrow', async () => {
  const refresh = { run: vi.fn(async () => ({ processed: 2, total: 2, errors: [] })) };
  const service = new CatalogScanService({ asinPriceRefresh: refresh, regions: () => ['amazon_de', 'amazon_uk'], now, schedule });
  await service.runNow();
  expect(refresh.run).toHaveBeenCalledWith(['amazon_de', 'amazon_uk'], expect.any(Function));
  expect(service.getState().nextRunAt).toBe('2026-07-11T10:00:00.000Z');
});

it('defers one overdue daily run after application start', () => {
  const service = new CatalogScanService({ asinPriceRefresh: refresh, initialState: { ...idle, completedAt: '2026-07-09T10:00:00.000Z' }, now, schedule });
  service.start();
  expect(schedule).toHaveBeenCalledWith(expect.any(Function), expect.any(Number));
  expect(refresh.run).not.toHaveBeenCalled();
});
```

The tests must also prove an app start with a still-fresh `completedAt` does not run immediately, manual refresh clears an existing timer, empty configured regions produce a concise error, and concurrent `runNow()` calls never overlap.

- [ ] **Step 2: Run the scheduler/app-service tests and confirm they fail against the Store implementation.**

Run: `npm --prefix apps/desktop test -- catalog-scan-service app-services`

Expected: FAIL because the service still calls `officialStoreImport` and `startBackgroundServices()` does not start the scheduler.

- [ ] **Step 3: Implement the ASIN-only scheduler and wire it at startup.**

```ts
const DAY_MS = 86_400_000;

start(): void {
  const dueAt = this.state.completedAt ? new Date(this.state.completedAt).getTime() + DAY_MS : this.now().getTime() + DAY_MS;
  const delay = dueAt <= this.now().getTime() ? DEFERRED_OVERDUE_RUN_MS : dueAt - this.now().getTime();
  this.timer = this.schedule(() => { void this.runNow(); }, delay);
}
```

In `main.ts`, load `catalogScanState` from `SettingsRepository`, construct `CatalogScanService` only with `AsinPriceRefreshService`, pass the complete five-region list, and call `startBackgroundServices({ updates, scan: catalogScan })`. Leave dormant Store-import code uncalled; do not remove manual migrations or historical data.

- [ ] **Step 4: Run scheduler/app-service tests and confirm they pass.**

Run: `npm --prefix apps/desktop test -- catalog-scan-service app-services asin-price-refresh-service`

Expected: PASS.

- [ ] **Step 5: Commit the daily scheduler.**

```powershell
git add apps/desktop/src/main/catalog/scan-service.ts apps/desktop/src/main/app-services.ts apps/desktop/src/main.ts apps/desktop/tests/main/catalog-scan-service.test.ts apps/desktop/tests/main/app-services.test.ts
git commit -m "feat: schedule daily ASIN price checks"
```

### Task 4: Explain the actual scheduled work in the catalog status surface

**Files:**
- Modify: `apps/desktop/src/renderer/features/dolls/catalog-scan-status.tsx`
- Test: `apps/desktop/tests/renderer/catalog-scan-status.test.tsx`

**Interfaces:**
- The component continues to consume `window.vetka.catalog.getScanState`, `onScanStateChanged`, and `refreshNow`; no IPC contract changes.
- `CatalogScanState.phase` is `catalog_scan | null`; no renderer branch references `official_store`.

- [ ] **Step 1: Write failing renderer tests for daily price wording.**

```tsx
it('shows a daily price check instead of an Amazon Store scan', async () => {
  window.vetka.catalog.getScanState = async () => success({ status: 'idle', nextRunAt: '2026-07-11T10:00:00.000Z' });
  render(<CatalogScanStatus />);
  expect(await screen.findByText('Проверка цен')).toBeVisible();
  expect(screen.queryByText(/Monster High Store/i)).not.toBeInTheDocument();
});
```

Add a running-state assertion for `Проверяются цены: 2 из 29` and retain the existing disabled, spinning manual-refresh button test.

- [ ] **Step 2: Run the renderer test and confirm it fails due to Store copy.**

Run: `npm --prefix apps/desktop test -- catalog-scan-status`

Expected: FAIL with old `Автопроверка Amazon` or `Monster High Store` copy.

- [ ] **Step 3: Implement the smallest existing shadcn composition.**

Keep the existing bordered status surface, `Badge`, and `Button size="sm"`. Rename the heading to `Проверка цен`; show `По расписанию: раз в день` when idle, `Проверяются цены: <processed> из <total>` while running, and retain the concise error line. Do not add a card stack, new component package, custom height, or raw colors.

- [ ] **Step 4: Run the renderer test and confirm it passes.**

Run: `npm --prefix apps/desktop test -- catalog-scan-status`

Expected: PASS.

- [ ] **Step 5: Commit the status copy.**

```powershell
git add apps/desktop/src/renderer/features/dolls/catalog-scan-status.tsx apps/desktop/tests/renderer/catalog-scan-status.test.tsx
git commit -m "feat: show daily catalog price status"
```

### Task 5: Verify behavior, package and publish

**Files:**
- Modify: `apps/desktop/package.json` only to bump the release patch version after all tests pass.
- Modify: `CHANGELOG.md` or current release notes if the repository uses one.

- [ ] **Step 1: Run the complete automated suite.**

Run: `npm --prefix apps/desktop test && npm --prefix apps/desktop run lint && npm --prefix apps/desktop run typecheck`

Expected: all tests, lint and typecheck pass.

- [ ] **Step 2: Run a focused Electron/manual QA pass.**

For a known ASIN, inspect logs or deterministic test instrumentation to prove: direct verified result makes no proxy launch; direct CAPTCHA makes one regional proxy launch; direct no-price makes no proxy launch. In the UI inspect idle, running, no-proxy-region error and manual refresh states at 1080×720, 1280×800 and 1440×900, with expanded and collapsed sidebar.

- [ ] **Step 3: Build and inspect the Windows package.**

Run: `npm --prefix apps/desktop run package && npm --prefix apps/desktop run release:verify-version`

Expected: package succeeds, Chromium manifest/executable remain present, and app/package/tag versions match.

- [ ] **Step 4: Commit release metadata, push `main`, tag and publish through the existing GitHub release workflow.**

```powershell
git add apps/desktop/package.json CHANGELOG.md
git commit -m "chore: release v1.0.24"
git push origin main
git tag v1.0.24
git push origin v1.0.24
```

Confirm the workflow publishes the setup executable, full nupkg, `RELEASES` and checksums before reporting that the in-app updater can deliver the version.
