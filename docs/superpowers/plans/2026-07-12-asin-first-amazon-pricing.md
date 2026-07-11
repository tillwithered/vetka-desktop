# ASIN-first Amazon pricing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make global and card-level refreshes update known dolls from their confirmed Amazon ASIN across configured regions, without Amazon search.

**Architecture:** Store import remains discovery-only. A new ASIN-only collection flag prevents fallback to search; an active-catalog orchestrator selects only entries with confirmed ASINs; the existing scan service runs Store discovery and ASIN price refresh in sequence.

**Tech Stack:** Electron, TypeScript, SQLite, Playwright Chromium, Vitest.

## Global Constraints

- Proxy scans use configured regions only and never fall back to the local IP.
- A price is persisted only after expected ASIN, exact SKU evidence, and Monster High/title context match.
- ASIN-first refresh never invokes Amazon search.
- Failed checks preserve a prior verified price and record their diagnostic.

---

### Task 1: Add an ASIN-only collection mode

**Files:**
- Modify: `apps/desktop/src/collector/contracts.ts`
- Modify: `apps/desktop/src/collector/amazon/collect.ts`
- Modify: `apps/desktop/src/main/prices/service.ts`
- Test: `apps/desktop/tests/collector/collect.test.ts`
- Test: `apps/desktop/tests/main/price-service.test.ts`

**Consumes:** confirmed `knownListings`, existing `matchCatalogOffer` and direct product-card parser.

**Produces:** `knownAsinsOnly?: boolean`; a requested region with no valid known ASIN returns `no_price` without a search request.

- [ ] **Step 1: Write the failing collector test**

```ts
it('does not search when ASIN-first refresh has no confirmed listing', async () => {
  const driver: CollectorDriver = {
    openProduct: vi.fn(async () => ''),
    search: vi.fn(async () => '<div data-asin="B0HUNTER00"></div>'),
  };
  const result = await collectDoll({
    type: 'refresh-doll', requestId: 'asin-only-empty', dataDir: 'C:/data',
    doll: { id: 'robecca', name: 'Robecca Steam', mattelSku: 'JHK59' },
    knownListings: [], regions: ['amazon_uk'], knownAsinsOnly: true,
    catalogRules: { mattelSku: 'JHK59', requiredTerms: ['Robecca Steam', 'Creeproduction'], rejectTerms: ['outfit'] },
  }, driver, vi.fn());
  expect(driver.search).not.toHaveBeenCalled();
  expect(result.regions.amazon_uk).toMatchObject({ status: 'no_price', asin: null });
});
```

- [ ] **Step 2: Verify red**

Run: `npm.cmd test -- tests/collector/collect.test.ts`

Expected: the test fails because `driver.search` is called.

- [ ] **Step 3: Implement the smallest guard**

Add this optional property to `CollectorRequest` in `apps/desktop/src/collector/contracts.ts`:

```ts
knownAsinsOnly?: boolean;
```

In `collectDoll`, after the loop that checks confirmed listings and before `catalogTerms`, add:

```ts
if (request.knownAsinsOnly) {
  result.regions[region] = {
    status: 'no_price', asin: null, title: null, regularPrice: null,
    primePrice: null, subscriptionPrice: null, couponText: null,
    seller: null, fulfilledByAmazon: false, availability: null,
    condition: null, region, url: null, reviewCandidates: [],
  };
  continue;
}
```

In `PriceService.refresh`, include `knownAsinsOnly: true` in the `collector.refreshDoll` input.

- [ ] **Step 4: Add the service assertion**

Extend the existing price-service catalog request assertion:

```ts
expect(collector.refreshDoll).toHaveBeenCalledWith(expect.objectContaining({
  knownAsinsOnly: true,
  catalogRules: expect.objectContaining({ mattelSku: 'JMB92' }),
}));
```

- [ ] **Step 5: Verify green and commit**

Run: `npm.cmd test -- tests/collector/collect.test.ts tests/main/price-service.test.ts`

```powershell
git add apps/desktop/src/collector/contracts.ts apps/desktop/src/collector/amazon/collect.ts apps/desktop/src/main/prices/service.ts apps/desktop/tests/collector/collect.test.ts apps/desktop/tests/main/price-service.test.ts
git commit -m "feat: make price refresh ASIN-first"
```

### Task 2: Refresh active entries that have confirmed ASINs

**Files:**
- Create: `apps/desktop/src/main/catalog/asin-price-refresh-service.ts`
- Test: `apps/desktop/tests/main/asin-price-refresh-service.test.ts`

**Consumes:** `CatalogRepository.listActive`, `PriceRepository.listListings`, `PriceService.refreshCatalogEntry`.

**Produces:** `AsinPriceRefreshService.run(regions, onProgress)`, which skips unseeded dolls and reports `{ processed, total, errors }`.

- [ ] **Step 1: Write the failing orchestration test**

```ts
it('refreshes only active entries with a confirmed ASIN', async () => {
  const confirmed = { mattelSku: 'JHK59', dollId: 'robecca', monitorStatus: 'active' as const };
  const unseeded = { mattelSku: 'JMB92', dollId: 'willow', monitorStatus: 'active' as const };
  const refreshCatalogEntry = vi.fn(async () => undefined);
  const service = new AsinPriceRefreshService({
    catalog: { listActive: () => [confirmed, unseeded] as never[] },
    prices: { listListings: (id: string) => id === 'robecca' ? [{ status: 'confirmed' }] : [] },
    priceService: { refreshCatalogEntry },
  });
  await expect(service.run(['amazon_uk'])).resolves.toEqual({ processed: 1, total: 1, errors: [] });
  expect(refreshCatalogEntry).toHaveBeenCalledWith(confirmed, ['amazon_uk']);
});
```

- [ ] **Step 2: Verify red**

Run: `npm.cmd test -- tests/main/asin-price-refresh-service.test.ts`

Expected: module-not-found failure.

- [ ] **Step 3: Implement the focused service**

```ts
export class AsinPriceRefreshService {
  constructor(private readonly dependencies: {
    catalog: Pick<CatalogRepository, 'listActive'>;
    prices: Pick<PriceRepository, 'listListings'>;
    priceService: Pick<PriceService, 'refreshCatalogEntry'>;
  }) {}

  async run(regions: readonly AmazonRegion[], onProgress?: (event: { processed: number; total: number; entry: CatalogEntry }) => void) {
    const entries = this.dependencies.catalog.listActive().filter((entry) => entry.dollId && this.dependencies.prices.listListings(entry.dollId).some((listing) => listing.status === 'confirmed'));
    const errors: string[] = [];
    for (const [index, entry] of entries.entries()) {
      try { await this.dependencies.priceService.refreshCatalogEntry(entry, [...regions]); }
      catch { errors.push(`${entry.mattelSku}: price refresh failed`); }
      onProgress?.({ processed: index + 1, total: entries.length, entry });
    }
    return { processed: entries.length, total: entries.length, errors };
  }
}
```

- [ ] **Step 4: Verify green and commit**

Run: `npm.cmd test -- tests/main/asin-price-refresh-service.test.ts`

```powershell
git add apps/desktop/src/main/catalog/asin-price-refresh-service.ts apps/desktop/tests/main/asin-price-refresh-service.test.ts
git commit -m "feat: refresh active catalog prices by ASIN"
```

### Task 3: Make bulk refresh two-phase

**Files:**
- Modify: `apps/desktop/src/main/catalog/scan-service.ts`
- Modify: `apps/desktop/src/main.ts`
- Test: `apps/desktop/tests/main/catalog-scan-service.test.ts`

**Consumes:** `OfficialStoreImportService.run` and `AsinPriceRefreshService.run`.

**Produces:** A global operation whose state changes from `official_store` to `catalog_scan`, combines partial errors, and still schedules the next check in two hours.

- [ ] **Step 1: Write the failing scan test**

```ts
it('refreshes active confirmed ASINs after Store discovery', async () => {
  const officialStoreImport = { run: vi.fn(async () => ({ errors: [] })) };
  const asinPriceRefresh = { run: vi.fn(async () => ({ processed: 1, total: 1, errors: [] })) };
  const service = new CatalogScanService({
    officialStoreImport, asinPriceRefresh, regions: () => ['amazon_uk'],
    schedule: vi.fn(), clearSchedule: vi.fn(),
  });
  await service.runNow();
  expect(officialStoreImport.run).toHaveBeenCalledBefore(asinPriceRefresh.run as never);
  expect(asinPriceRefresh.run).toHaveBeenCalledWith(['amazon_uk'], expect.any(Function));
  expect(service.getState()).toMatchObject({ status: 'idle', phase: 'catalog_scan', processed: 1, total: 1, lastError: null });
});
```

- [ ] **Step 2: Verify red**

Run: `npm.cmd test -- tests/main/catalog-scan-service.test.ts`

Expected: the constructor type rejects the absent `asinPriceRefresh` dependency.

- [ ] **Step 3: Add the second phase**

Add this optional dependency to `CatalogScanService`:

```ts
asinPriceRefresh?: {
  run(regions: readonly AmazonRegion[], onProgress?: (event: { processed: number; total: number }) => void): Promise<{ errors?: string[] }>;
};
```

After Store import completes, call it and update scan state:

```ts
const priceResult = this.dependencies.asinPriceRefresh
  ? await this.dependencies.asinPriceRefresh.run(regions, (event) => {
      this.setState({ ...this.state, phase: 'catalog_scan', region: null, processed: event.processed, total: event.total });
    })
  : { errors: [] };
lastError = [...(storeResult.errors ?? []), ...(priceResult.errors ?? [])].join(' В· ') || null;
```

In `main.ts`, construct `new AsinPriceRefreshService({ catalog, prices, priceService })` and pass it as `asinPriceRefresh` to `CatalogScanService`.

- [ ] **Step 4: Verify green and commit**

Run: `npm.cmd test -- tests/main/catalog-scan-service.test.ts tests/main/asin-price-refresh-service.test.ts`

```powershell
git add apps/desktop/src/main/catalog/scan-service.ts apps/desktop/src/main.ts apps/desktop/tests/main/catalog-scan-service.test.ts
git commit -m "feat: refresh catalog prices during bulk scan"
```

### Task 4: Release and live acceptance

**Files:**
- Modify: `apps/desktop/package.json`

- [ ] **Step 1: Increase the patch version and run verification**

```powershell
npm.cmd test
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run package
```

- [ ] **Step 2: Verify packaged Chromium**

```powershell
$resources = Resolve-Path 'out\Vetka Desktop-win32-x64\resources'
$manifest = Join-Path $resources 'playwright-chromium.json'
$payload = Get-Content -Raw $manifest | ConvertFrom-Json
$browser = Join-Path (Join-Path $resources 'playwright-chromium') $payload.executable
if (!(Test-Path $manifest) -or !(Test-Path $browser)) { throw 'Missing packaged Chromium' }
```

- [ ] **Step 3: Commit, tag and publish the next patch release**

```powershell
git add apps/desktop/package.json
git commit -m "chore: release vNEXT"
git push origin main
git tag -a vNEXT -m "Release vNEXT"
git push origin vNEXT
```

- [ ] **Step 4: Live acceptance**

Update Vetka Desktop, click `Обновить сейчас`, and check that Robecca `JHK59` has a UK listing for ASIN `B0FK1V67X5` in GBP. Its saved diagnostic must contain `mattelSku: true`, `title: true`, and `dollContext: true`.
